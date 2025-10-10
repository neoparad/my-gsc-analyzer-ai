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
    const { customer_id, start_date, end_date } = req.body

    // 環境変数から認証情報を取得
    const clientConfig = {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    }

    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

    if (!clientConfig.client_id || !clientConfig.client_secret || !clientConfig.developer_token || !refreshToken) {
      console.error('Google Ads API credentials not configured')
      return res.status(500).json({
        error: 'Google Ads API認証情報が設定されていません',
        details: 'GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN が必要です'
      })
    }

    // Google Ads API クライアント初期化
    const client = new GoogleAdsApi({
      ...clientConfig,
      refresh_token: refreshToken
    })

    const customerId = customer_id || process.env.GOOGLE_ADS_CUSTOMER_ID

    if (!customerId) {
      return res.status(400).json({
        error: 'Customer IDが必要です',
        details: 'customer_idパラメータまたはGOOGLE_ADS_CUSTOMER_ID環境変数を設定してください'
      })
    }

    const customer = client.Customer({
      customer_id: customerId.replace(/-/g, ''), // ハイフンを削除
      refresh_token: refreshToken
    })

    // 日付範囲の設定
    const dateCondition = start_date && end_date
      ? `AND segments.date BETWEEN '${start_date}' AND '${end_date}'`
      : `AND segments.date >= '${getDefaultStartDate()}' AND segments.date <= '${getDefaultEndDate()}'`

    // GAQL（Google Ads Query Language）クエリ
    const query = `
      SELECT
        campaign.name,
        ad_group.name,
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
      ORDER BY metrics.cost_micros DESC
      LIMIT 10000
    `

    console.log('Fetching Google Ads data with query:', query)

    // データ取得
    const response = await customer.query(query)

    // データを整形
    const adsData = response.map(row => ({
      campaign_name: row.campaign.name,
      ad_group_name: row.ad_group.name,
      query: row.ad_group_criterion.keyword.text,
      ad_impressions: parseInt(row.metrics.impressions) || 0,
      ad_clicks: parseInt(row.metrics.clicks) || 0,
      cost: (parseInt(row.metrics.cost_micros) || 0) / 1000000, // マイクロ単位から円に変換
      cpc: (parseInt(row.metrics.average_cpc) || 0) / 1000000,
      conversions: parseFloat(row.metrics.conversions) || 0
    }))

    console.log(`Fetched ${adsData.length} keywords from Google Ads`)

    res.status(200).json({
      success: true,
      data: adsData,
      total_keywords: adsData.length,
      date_range: {
        start: start_date || getDefaultStartDate(),
        end: end_date || getDefaultEndDate()
      },
      customer_id: customerId
    })

  } catch (error) {
    console.error('Google Ads API Error:', error)

    // エラー詳細をログ出力
    if (error.errors) {
      console.error('Google Ads API Errors:', JSON.stringify(error.errors, null, 2))
    }

    res.status(500).json({
      error: 'Google Ads APIからのデータ取得に失敗しました',
      details: error.message,
      errors: error.errors || []
    })
  }
}

// デフォルトの開始日（30日前）
function getDefaultStartDate() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().split('T')[0]
}

// デフォルトの終了日（昨日）
function getDefaultEndDate() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}
