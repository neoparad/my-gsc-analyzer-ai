import { google } from 'googleapis'
import { GoogleAdsApi } from 'google-ads-api'
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
      customer_id,
      campaign_ids,
      query_filter,
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

    // Google Ads APIからデータ取得
    let adsData = []

    try {
      const clientConfig = {
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      }

      const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

      if (clientConfig.client_id && clientConfig.client_secret && clientConfig.developer_token && refreshToken) {
        const client = new GoogleAdsApi({
          ...clientConfig,
          refresh_token: refreshToken
        })

        const customerId = customer_id || process.env.GOOGLE_ADS_CUSTOMER_ID

        if (customerId) {
          const customer = client.Customer({
            customer_id: customerId.replace(/-/g, ''),
            refresh_token: refreshToken
          })

          const dateCondition = start_date && end_date
            ? `AND segments.date BETWEEN '${start_date}' AND '${end_date}'`
            : ''

          // キャンペーンフィルター
          const campaignCondition = campaign_ids && campaign_ids.length > 0
            ? `AND campaign.id IN (${campaign_ids.join(',')})`
            : ''

          const query = `
            SELECT
              ad_group_criterion.keyword.text,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.average_cpc
            FROM keyword_view
            WHERE
              campaign.status = 'ENABLED'
              AND ad_group.status = 'ENABLED'
              AND ad_group_criterion.status IN ('ENABLED', 'PAUSED')
              ${dateCondition}
              ${campaignCondition}
            ORDER BY metrics.cost_micros DESC
            LIMIT 10000
          `

          const response = await customer.query(query)

          adsData = response.map(row => ({
            query: row.ad_group_criterion.keyword.text.toLowerCase().trim(),
            ad_clicks: parseInt(row.metrics.clicks) || 0,
            ad_impressions: parseInt(row.metrics.impressions) || 0,
            cost: (parseInt(row.metrics.cost_micros) || 0) / 1000000,
            cpc: (parseInt(row.metrics.average_cpc) || 0) / 1000000,
            conversions: parseFloat(row.metrics.conversions) || 0
          }))

          // クエリフィルター適用
          if (query_filter && query_filter.trim()) {
            const filterTerms = query_filter.toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
            adsData = adsData.filter(row =>
              filterTerms.some(term => row.query.includes(term))
            )
            console.log(`Applied query filter: ${query_filter}, remaining: ${adsData.length} keywords`)
          }

          console.log(`Fetched ${adsData.length} keywords from Google Ads API`)
        }
      }
    } catch (adsError) {
      console.error('Google Ads API Error:', adsError)
      // エラーがあってもGSCデータだけで続行
    }

    // Google Adsデータとマージ
    const cannibalizationData = []

    if (adsData && Array.isArray(adsData)) {
      adsData.forEach(adRow => {
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

    // 統計分析
    const statisticalAnalysis = performStatisticalAnalysis(filteredData)

    res.status(200).json({
      summary,
      queries: filteredData,
      directory_breakdown: directoryBreakdown,
      query_type_breakdown: queryTypeBreakdown,
      statistical_analysis: statisticalAnalysis,
      metadata: {
        gsc_queries: Object.keys(gscData).length,
        ads_queries: adsData.length,
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

// ========== 統計分析関数 ==========

// ピアソン相関係数計算
function calculateCorrelation(x, y) {
  const n = x.length
  if (n === 0 || n !== y.length) return 0

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  if (denominator === 0) return 0
  return numerator / denominator
}

// 相関分析
function performCorrelationAnalysis(data) {
  if (data.length === 0) return {}

  const adCosts = data.map(d => d.ad_cost)
  const organicClicks = data.map(d => d.organic_clicks)
  const adClicks = data.map(d => d.ad_clicks)
  const positions = data.map(d => d.organic_position)
  const canibalizationScores = data.map(d => d.canibalization_score)

  return {
    // 広告費 vs オーガニッククリック（負の相関が理想）
    ad_cost_vs_organic_clicks: {
      correlation: calculateCorrelation(adCosts, organicClicks),
      interpretation: getCorrelationInterpretation(calculateCorrelation(adCosts, organicClicks)),
      insight: '負の相関が強いほど、広告削減の余地が大きい'
    },
    // 順位 vs 広告費（負の相関が理想）
    position_vs_ad_cost: {
      correlation: calculateCorrelation(positions, adCosts),
      interpretation: getCorrelationInterpretation(calculateCorrelation(positions, adCosts)),
      insight: '上位表示ほど広告費が高い場合、カニバリゼーションが発生'
    },
    // オーガニッククリック vs 広告クリック（負の相関がカニバリの証拠）
    organic_vs_ad_clicks: {
      correlation: calculateCorrelation(organicClicks, adClicks),
      interpretation: getCorrelationInterpretation(calculateCorrelation(organicClicks, adClicks)),
      insight: '負の相関が強いほど、カニバリゼーションが顕著'
    },
    // カニバリスコア vs 広告費
    canibalization_vs_ad_cost: {
      correlation: calculateCorrelation(canibalizationScores, adCosts),
      interpretation: getCorrelationInterpretation(calculateCorrelation(canibalizationScores, adCosts)),
      insight: '正の相関が強いほど、高スコアのクエリに広告費が集中'
    }
  }
}

// 相関係数の解釈
function getCorrelationInterpretation(r) {
  const abs = Math.abs(r)
  if (abs >= 0.7) return { strength: '強い', direction: r > 0 ? '正' : '負' }
  if (abs >= 0.4) return { strength: '中程度', direction: r > 0 ? '正' : '負' }
  if (abs >= 0.2) return { strength: '弱い', direction: r > 0 ? '正' : '負' }
  return { strength: 'ほぼなし', direction: '-' }
}

// 異常値検出（IQR法）
function detectOutliers(data) {
  if (data.length === 0) return { outliers: [], statistics: {} }

  // 広告費による異常値検出
  const adCosts = data.map(d => d.ad_cost).sort((a, b) => a - b)
  const q1Index = Math.floor(adCosts.length * 0.25)
  const q3Index = Math.floor(adCosts.length * 0.75)
  const q1 = adCosts[q1Index]
  const q3 = adCosts[q3Index]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr

  // 異常値の特定
  const outliers = data.filter(d => d.ad_cost < lowerBound || d.ad_cost > upperBound)
    .map(d => ({
      query: d.query,
      ad_cost: d.ad_cost,
      organic_position: d.organic_position,
      type: d.ad_cost > upperBound ? 'high_cost' : 'low_cost',
      severity: Math.abs(d.ad_cost - (d.ad_cost > upperBound ? upperBound : lowerBound)) / iqr
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 20) // 上位20件

  return {
    outliers,
    statistics: {
      q1,
      q3,
      iqr,
      lowerBound,
      upperBound,
      outlierCount: outliers.length,
      outlierRate: (outliers.length / data.length * 100).toFixed(1)
    }
  }
}

// クラスタリング（簡易版k-means風）
function performClustering(data) {
  if (data.length === 0) return []

  // 特徴量の正規化
  const normalize = (values) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    return range === 0 ? values.map(() => 0.5) : values.map(v => (v - min) / range)
  }

  const normalizedPositions = normalize(data.map(d => d.organic_position))
  const normalizedAdCosts = normalize(data.map(d => d.ad_cost))
  const normalizedOrgClicks = normalize(data.map(d => d.organic_clicks))

  // 3つのクラスターに分類
  const clusters = data.map((item, index) => {
    const pos = normalizedPositions[index]
    const cost = normalizedAdCosts[index]
    const clicks = normalizedOrgClicks[index]

    // クラスター判定ロジック
    if (pos < 0.3 && cost > 0.5) {
      // 高順位 & 高広告費 = 最優先削減候補
      return { ...item, cluster: 'high_priority', cluster_name: '最優先削減候補' }
    } else if (pos < 0.5 && clicks > 0.5) {
      // 中順位 & 高オーガニッククリック = 削減候補
      return { ...item, cluster: 'medium_priority', cluster_name: '削減候補' }
    } else if (cost < 0.3) {
      // 低広告費 = 現状維持
      return { ...item, cluster: 'low_priority', cluster_name: '現状維持' }
    } else {
      // その他 = 要検討
      return { ...item, cluster: 'review_needed', cluster_name: '要検討' }
    }
  })

  // クラスター別サマリー
  const clusterSummary = {
    high_priority: clusters.filter(c => c.cluster === 'high_priority'),
    medium_priority: clusters.filter(c => c.cluster === 'medium_priority'),
    low_priority: clusters.filter(c => c.cluster === 'low_priority'),
    review_needed: clusters.filter(c => c.cluster === 'review_needed')
  }

  return {
    clusters,
    summary: Object.entries(clusterSummary).map(([key, items]) => ({
      cluster: key,
      cluster_name: items[0]?.cluster_name || key,
      count: items.length,
      total_ad_cost: items.reduce((sum, i) => sum + i.ad_cost, 0),
      total_estimated_savings: items.reduce((sum, i) => sum + i.estimated_savings, 0),
      avg_position: items.length > 0 ? items.reduce((sum, i) => sum + i.organic_position, 0) / items.length : 0
    }))
  }
}

// 統計分析メイン関数
function performStatisticalAnalysis(data) {
  if (data.length === 0) {
    return {
      correlation_analysis: {},
      outlier_detection: { outliers: [], statistics: {} },
      clustering: { clusters: [], summary: [] }
    }
  }

  return {
    correlation_analysis: performCorrelationAnalysis(data),
    outlier_detection: detectOutliers(data),
    clustering: performClustering(data)
  }
}
