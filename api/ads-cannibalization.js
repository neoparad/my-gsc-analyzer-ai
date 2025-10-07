import { google } from 'googleapis'
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
    const {
      site_url,
      start_date,
      end_date,
      ads_data, // フロントエンドからGoogle Adsデータを受け取る（CSV等）
      filters
    } = req.body

    // Google Search Console認証
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    } else if (process.env.NODE_ENV !== 'production') {
      const fs = await import('fs')
      const path = await import('path')
      const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    } else {
      throw new Error('GOOGLE_CREDENTIALS environment variable is required')
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // GSCデータ取得
    const getAllSearchData = async (startDate, endDate) => {
      let allRows = []
      let startRow = 0
      const rowLimit = 25000

      while (true) {
        const response = await searchconsole.searchanalytics.query({
          siteUrl: site_url,
          requestBody: {
            startDate,
            endDate,
            dimensions: ['query', 'page'],
            dataState: 'final',
            rowLimit,
            startRow
          }
        })

        const rows = response.data?.rows || []
        if (rows.length === 0) break

        allRows = allRows.concat(rows)
        if (rows.length < rowLimit) break

        startRow += rowLimit
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return allRows
    }

    const gscRows = await getAllSearchData(start_date, end_date)

    // GSCデータをクエリごとに集計（最良順位を使用）
    const gscData = {}
    gscRows.forEach(row => {
      const [query, url] = row.keys
      if (!gscData[query] || row.position < gscData[query].position) {
        gscData[query] = {
          query,
          url,
          position: row.position,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          directory: extractDirectory(url)
        }
      }
    })

    // Google Adsデータとマージ
    const cannibalizationData = []

    if (ads_data && Array.isArray(ads_data)) {
      ads_data.forEach(adRow => {
        const query = adRow.query?.toLowerCase().trim()
        const gscMatch = gscData[query]

        if (gscMatch) {
          // カニバリゼーションスコア計算
          const canibalizationScore = calculateCanibalizationScore(
            gscMatch.position,
            gscMatch.clicks,
            adRow.ad_clicks,
            adRow.cost
          )

          // 削減可能額推定
          const estimatedSavings = estimateSavings(
            gscMatch.position,
            adRow.cost,
            gscMatch.clicks,
            adRow.ad_clicks
          )

          cannibalizationData.push({
            query,
            url: gscMatch.url,
            directory: gscMatch.directory,
            organic_position: gscMatch.position,
            organic_clicks: gscMatch.clicks,
            organic_impressions: gscMatch.impressions,
            organic_ctr: gscMatch.ctr,
            ad_clicks: adRow.ad_clicks,
            ad_impressions: adRow.ad_impressions,
            ad_cost: adRow.cost,
            ad_cpc: adRow.cpc,
            ad_conversions: adRow.conversions || 0,
            canibalization_score: canibalizationScore,
            estimated_savings: estimatedSavings,
            savings_confidence: calculateSavingsConfidence(gscMatch.position, canibalizationScore)
          })
        }
      })
    }

    // フィルター適用
    let filteredData = cannibalizationData

    if (filters) {
      // 順位フィルター
      if (filters.position_range) {
        filteredData = filteredData.filter(item =>
          item.organic_position >= filters.position_range.min &&
          item.organic_position < filters.position_range.max
        )
      }

      // キーワードフィルター
      if (filters.keywords?.include?.terms?.length > 0) {
        filteredData = filteredData.filter(item => {
          const query = item.query.toLowerCase()
          const operator = filters.keywords.include.operator

          if (operator === 'AND') {
            return filters.keywords.include.terms.every(term =>
              query.includes(term.toLowerCase())
            )
          } else {
            return filters.keywords.include.terms.some(term =>
              query.includes(term.toLowerCase())
            )
          }
        })
      }

      // 除外キーワードフィルター
      if (filters.keywords?.exclude?.terms?.length > 0) {
        filteredData = filteredData.filter(item => {
          const query = item.query.toLowerCase()
          return !filters.keywords.exclude.terms.some(term =>
            query.includes(term.toLowerCase())
          )
        })
      }

      // ディレクトリフィルター
      if (filters.directories?.paths?.length > 0) {
        filteredData = filteredData.filter(item =>
          filters.directories.paths.some(path =>
            item.directory.startsWith(path)
          )
        )
      }

      // パフォーマンスフィルター
      if (filters.performance) {
        if (filters.performance.min_ad_spend) {
          filteredData = filteredData.filter(item =>
            item.ad_cost >= filters.performance.min_ad_spend
          )
        }
        if (filters.performance.min_organic_clicks) {
          filteredData = filteredData.filter(item =>
            item.organic_clicks >= filters.performance.min_organic_clicks
          )
        }
        if (filters.performance.has_conversion) {
          filteredData = filteredData.filter(item =>
            item.ad_conversions > 0
          )
        }
      }
    }

    // ソート
    const sortBy = filters?.sort_by || 'estimated_savings'
    const sortOrder = filters?.sort_order || 'desc'

    filteredData.sort((a, b) => {
      const aVal = a[sortBy] || 0
      const bVal = b[sortBy] || 0
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })

    // サマリー計算
    const summary = {
      total_queries: filteredData.length,
      total_ad_spend: filteredData.reduce((sum, item) => sum + item.ad_cost, 0),
      total_estimated_savings: filteredData.reduce((sum, item) => sum + item.estimated_savings, 0),
      avg_position: filteredData.length > 0
        ? filteredData.reduce((sum, item) => sum + item.organic_position, 0) / filteredData.length
        : 0,
      avg_canibalization_score: filteredData.length > 0
        ? filteredData.reduce((sum, item) => sum + item.canibalization_score, 0) / filteredData.length
        : 0,
      high_confidence_count: filteredData.filter(item => item.savings_confidence === 'high').length,
      medium_confidence_count: filteredData.filter(item => item.savings_confidence === 'medium').length
    }

    // ディレクトリ別集計
    const directoryBreakdown = calculateDirectoryBreakdown(filteredData)

    // クエリタイプ別集計
    const queryTypeBreakdown = calculateQueryTypeBreakdown(filteredData)

    res.status(200).json({
      summary,
      queries: filteredData,
      directory_breakdown: directoryBreakdown,
      query_type_breakdown: queryTypeBreakdown,
      metadata: {
        gsc_queries: Object.keys(gscData).length,
        ads_queries: ads_data?.length || 0,
        matched_queries: cannibalizationData.length,
        filtered_queries: filteredData.length,
        date_range: { start: start_date, end: end_date }
      }
    })

  } catch (error) {
    console.error('Ads Cannibalization Analysis Error:', error)
    res.status(500).json({ error: error.message })
  }
}

// ディレクトリ抽出
function extractDirectory(url) {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    return pathParts.length > 0 ? `/${pathParts[0]}/` : '/'
  } catch {
    return '/'
  }
}

// カニバリゼーションスコア計算（0-100）
function calculateCanibalizationScore(position, organicClicks, adClicks, adCost) {
  // 順位が高いほど、オーガニックが強いほど、広告費が高いほどスコアが高い
  const positionScore = Math.max(0, (10 - position) / 10 * 40) // 最大40点
  const clickRatioScore = organicClicks / (organicClicks + adClicks) * 40 // 最大40点
  const costScore = Math.min(20, adCost / 1000 * 20) // 最大20点

  return Math.round(positionScore + clickRatioScore + costScore)
}

// 削減可能額推定
function estimateSavings(position, adCost, organicClicks, adClicks) {
  // 順位に応じた削減率
  let savingsRate = 0

  if (position < 1.5) {
    savingsRate = 0.9 // 1位台なら90%削減可能
  } else if (position < 2.0) {
    savingsRate = 0.8 // 2位未満なら80%削減可能
  } else if (position < 3.0) {
    savingsRate = 0.6 // 3位未満なら60%削減可能
  } else if (position < 5.0) {
    savingsRate = 0.4 // 5位未満なら40%削減可能
  } else {
    savingsRate = 0.2 // それ以外は20%削減可能
  }

  // オーガニッククリックが少ない場合は削減率を下げる
  const clickRatio = organicClicks / (organicClicks + adClicks)
  if (clickRatio < 0.3) {
    savingsRate *= 0.5 // クリック比率が低い場合は半減
  }

  return Math.round(adCost * savingsRate)
}

// 削減可能性の信頼度
function calculateSavingsConfidence(position, canibalizationScore) {
  if (position < 2.0 && canibalizationScore >= 70) return 'high'
  if (position < 3.0 && canibalizationScore >= 50) return 'medium'
  return 'low'
}

// ディレクトリ別集計
function calculateDirectoryBreakdown(data) {
  const breakdown = {}

  data.forEach(item => {
    if (!breakdown[item.directory]) {
      breakdown[item.directory] = {
        count: 0,
        total_ad_cost: 0,
        total_estimated_savings: 0,
        total_organic_clicks: 0,
        total_ad_clicks: 0
      }
    }

    breakdown[item.directory].count++
    breakdown[item.directory].total_ad_cost += item.ad_cost
    breakdown[item.directory].total_estimated_savings += item.estimated_savings
    breakdown[item.directory].total_organic_clicks += item.organic_clicks
    breakdown[item.directory].total_ad_clicks += item.ad_clicks
  })

  return Object.entries(breakdown)
    .map(([directory, stats]) => ({
      directory,
      ...stats,
      savings_rate: stats.total_ad_cost > 0
        ? (stats.total_estimated_savings / stats.total_ad_cost * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => b.total_estimated_savings - a.total_estimated_savings)
}

// クエリタイプ別集計
function calculateQueryTypeBreakdown(data) {
  const types = {
    'ブランド名': [],
    '地名+格安': [],
    '地名+空港': [],
    '地名+比較': [],
    '地名のみ': [],
    'その他': []
  }

  const brandKeywords = ['tabirai', 'たびらい']
  const priceKeywords = ['格安', '安い', '最安', 'セール']
  const airportKeywords = ['空港', 'エアポート']
  const comparisonKeywords = ['比較', 'おすすめ', 'ランキング']

  data.forEach(item => {
    const query = item.query.toLowerCase()

    if (brandKeywords.some(kw => query.includes(kw))) {
      types['ブランド名'].push(item)
    } else if (priceKeywords.some(kw => query.includes(kw))) {
      types['地名+格安'].push(item)
    } else if (airportKeywords.some(kw => query.includes(kw))) {
      types['地名+空港'].push(item)
    } else if (comparisonKeywords.some(kw => query.includes(kw))) {
      types['地名+比較'].push(item)
    } else if (/[都道府県]|東京|大阪|沖縄|北海道/.test(query)) {
      types['地名のみ'].push(item)
    } else {
      types['その他'].push(item)
    }
  })

  return Object.entries(types)
    .map(([type, items]) => ({
      type,
      count: items.length,
      total_ad_cost: items.reduce((sum, item) => sum + item.ad_cost, 0),
      total_estimated_savings: items.reduce((sum, item) => sum + item.estimated_savings, 0),
      example_queries: items.slice(0, 3).map(item => item.query)
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.total_estimated_savings - a.total_estimated_savings)
}
