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
    const { customer_id } = req.body

    if (!customer_id) {
      return res.status(400).json({
        error: 'Customer IDが必要です'
      })
    }

    // 環境変数から認証情報を取得
    const clientConfig = {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    }

    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

    if (!clientConfig.client_id || !clientConfig.client_secret || !clientConfig.developer_token || !refreshToken) {
      return res.status(500).json({
        error: 'Google Ads API認証情報が設定されていません'
      })
    }

    // Google Ads API クライアント初期化
    const client = new GoogleAdsApi({
      ...clientConfig,
      refresh_token: refreshToken
    })

    const customer = client.Customer({
      customer_id: customer_id.replace(/-/g, ''),
      refresh_token: refreshToken
    })

    // キャンペーン一覧取得
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM campaign
      WHERE
        campaign.status IN ('ENABLED', 'PAUSED')
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
    `

    const response = await customer.query(query)

    const campaigns = response.map(row => ({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      impressions: parseInt(row.metrics.impressions) || 0,
      clicks: parseInt(row.metrics.clicks) || 0,
      cost: (parseInt(row.metrics.cost_micros) || 0) / 1000000
    }))

    console.log(`Fetched ${campaigns.length} campaigns from Google Ads`)

    res.status(200).json({
      success: true,
      campaigns,
      customer_id
    })

  } catch (error) {
    console.error('Google Ads API Error:', error)

    if (error.errors) {
      console.error('Google Ads API Errors:', JSON.stringify(error.errors, null, 2))
    }

    res.status(500).json({
      error: 'キャンペーン一覧の取得に失敗しました',
      details: error.message
    })
  }
}
