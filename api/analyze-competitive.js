import { checkBasicAuth } from '../lib/auth.js'

export default async function handler(req, res) {
  if (!checkBasicAuth(req, res)) return

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { myUrl, competitorUrls = [], device = 'mobile' } = req.body

    if (!myUrl) {
      return res.status(400).json({ error: '自社URLが必要です' })
    }

    // PageSpeed Insights API Key (環境変数から取得)
    const apiKey = process.env.PAGESPEED_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'PageSpeed Insights API Keyが設定されていません' })
    }

    // 全URLを配列にまとめる
    const allUrls = [
      { url: myUrl, label: '自社サイト', type: 'own' },
      ...competitorUrls.map((url, idx) => ({
        url,
        label: `競合${idx + 1}`,
        type: 'competitor'
      }))
    ]

    console.log(`🔍 Analyzing ${allUrls.length} sites (${device})...`)

    // 並列でPageSpeed Insights APIを呼び出し
    const strategy = device === 'mobile' ? 'MOBILE' : 'DESKTOP'
    const results = await Promise.all(
      allUrls.map(async ({ url, label, type }) => {
        try {
          console.log(`  → Fetching ${label}: ${url}`)

          const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo&key=${apiKey}`

          const response = await fetch(apiUrl)

          if (!response.ok) {
            throw new Error(`API returned ${response.status}`)
          }

          const data = await response.json()

          // データ抽出
          const lighthouse = data.lighthouseResult
          const categories = lighthouse.categories
          const audits = lighthouse.audits

          // スコアデータ
          const scores = {
            performance: Math.round((categories.performance?.score || 0) * 100),
            accessibility: Math.round((categories.accessibility?.score || 0) * 100),
            bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
            seo: Math.round((categories.seo?.score || 0) * 100)
          }

          console.log(`     → Scores: P=${scores.performance}, A=${scores.accessibility}, BP=${scores.bestPractices}, SEO=${scores.seo}`)

          // Core Web Vitals
          const metrics = {
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            fid: audits['max-potential-fid']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            fcp: audits['first-contentful-paint']?.numericValue || 0,
            tti: audits['interactive']?.numericValue || 0
          }

          // 監査項目データ（ヒートマップ用）
          const auditItems = {}
          for (const [id, audit] of Object.entries(audits)) {
            if (audit.score !== null && audit.score !== undefined) {
              auditItems[id] = {
                score: audit.score,
                title: audit.title,
                description: audit.description,
                displayValue: audit.displayValue,
                numericValue: audit.numericValue
              }
            }
          }

          console.log(`     ✓ ${label}: Performance=${scores.performance}`)

          return {
            url,
            label,
            type,
            scores,
            metrics,
            auditItems,
            rawData: data // AI分析用に元データも保存
          }
        } catch (error) {
          console.error(`  ✗ Error analyzing ${label}:`, error.message)
          return {
            url,
            label,
            type,
            error: error.message,
            scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
            metrics: { lcp: 0, fid: 0, cls: 0, fcp: 0, tti: 0 },
            auditItems: {}
          }
        }
      })
    )

    // ヒートマップデータを生成
    const heatmapData = generateHeatmapData(results)

    console.log(`✅ Analysis complete`)

    res.status(200).json({
      results,
      heatmapData,
      device
    })

  } catch (error) {
    console.error('Competitive Analysis API Error:', error)
    res.status(500).json({
      error: '競合分析データの取得に失敗しました',
      details: error.message
    })
  }
}

// ヒートマップデータ生成関数
function generateHeatmapData(results) {
  // 監査項目の日本語マッピング
  const auditTitlesJa = {
    'first-contentful-paint': 'FCP（初回コンテンツ描画）',
    'largest-contentful-paint': 'LCP（最大コンテンツ描画）',
    'cumulative-layout-shift': 'CLS（累積レイアウトシフト）',
    'total-blocking-time': 'TBT（合計ブロック時間）',
    'speed-index': 'スピードインデックス',
    'render-blocking-resources': 'レンダリングブロックリソース',
    'unused-css-rules': '未使用CSS',
    'unused-javascript': '未使用JavaScript',
    'uses-optimized-images': '画像最適化',
    'uses-webp-images': 'WebP画像の使用',
    'uses-text-compression': 'テキスト圧縮',
    'uses-responsive-images': 'レスポンシブ画像',
    'offscreen-images': '画面外画像の遅延読み込み',
    'unminified-css': 'CSS圧縮',
    'unminified-javascript': 'JavaScript圧縮',
    'efficient-animated-content': 'アニメーション最適化',
    'duplicated-javascript': '重複JavaScript削除',
    'legacy-javascript': 'レガシーJavaScript削減',
    'uses-long-cache-ttl': 'キャッシュポリシー',
    'dom-size': 'DOMサイズ',
    'critical-request-chains': 'クリティカルリクエストチェーン',
    'user-timings': 'ユーザータイミング',
    'bootup-time': 'JavaScript起動時間',
    'mainthread-work-breakdown': 'メインスレッド作業時間',
    'font-display': 'フォント表示',
    'third-party-summary': 'サードパーティコード'
  }

  // 全サイトの監査項目IDを収集
  const allAuditIds = new Set()
  results.forEach(result => {
    if (result.auditItems) {
      Object.keys(result.auditItems).forEach(id => allAuditIds.add(id))
    }
  })

  // 重要な監査項目のみをフィルタリング（パフォーマンスに影響が大きいもの）
  const importantAudits = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'cumulative-layout-shift',
    'total-blocking-time',
    'speed-index',
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'uses-responsive-images',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'uses-long-cache-ttl',
    'dom-size',
    'critical-request-chains',
    'user-timings',
    'bootup-time',
    'mainthread-work-breakdown',
    'font-display',
    'third-party-summary'
  ]

  const filteredAuditIds = Array.from(allAuditIds).filter(id =>
    importantAudits.includes(id)
  )

  // マトリクスデータを生成
  const matrix = filteredAuditIds.map(auditId => {
    // 最初のサイトから基本情報を取得
    const firstAudit = results.find(r => r.auditItems?.[auditId])?.auditItems?.[auditId]

    const row = {
      auditId,
      title: auditTitlesJa[auditId] || firstAudit?.title || auditId,
      description: firstAudit?.description || '',
      cells: []
    }

    results.forEach(result => {
      const audit = result.auditItems?.[auditId]

      if (audit) {
        // 日本語タイトルを優先、なければ元のタイトルを使用
        if (!row.title || row.title === auditId) {
          row.title = auditTitlesJa[auditId] || audit.title
        }

        // スコアを3段階に分類
        let status = 'fail' // 赤
        if (audit.score >= 0.9) {
          status = 'pass' // 緑
        } else if (audit.score >= 0.5) {
          status = 'average' // 黄
        }

        row.cells.push({
          label: result.label,
          status,
          score: audit.score,
          displayValue: audit.displayValue,
          numericValue: audit.numericValue
        })
      } else {
        row.cells.push({
          label: result.label,
          status: 'unknown',
          score: null,
          displayValue: '-'
        })
      }
    })

    return row
  })

  return {
    auditIds: filteredAuditIds,
    matrix
  }
}
