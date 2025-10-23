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
    const { siteUrl, pageUrls, period = 30 } = req.body

    if (!siteUrl || !pageUrls || !Array.isArray(pageUrls) || pageUrls.length === 0) {
      return res.status(400).json({ error: 'siteUrl and pageUrls are required' })
    }

    // 環境変数から認証情報を取得
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
      } catch (e) {
        console.error('Failed to parse GOOGLE_CREDENTIALS:', e)
        throw new Error('Failed to parse GOOGLE_CREDENTIALS environment variable: ' + e.message)
      }
    } else if (process.env.NODE_ENV !== 'production') {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
        console.log('Using local credentials file (development only)')
      } catch (e) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set and local credentials file not found: ' + e.message)
      }
    } else {
      throw new Error('GOOGLE_CREDENTIALS environment variable is required in production')
    }

    // Google Search Console API認証
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const authClient = await auth.getClient()
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient })

    // 日付範囲を計算
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 3) // GSCは3日前までのデータ

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - period)

    const formatDate = (date) => date.toISOString().split('T')[0]

    console.log(`📅 Fetching page data: ${formatDate(startDate)} to ${formatDate(endDate)} (${pageUrls.length} pages)`)

    // 各ページのデータを取得
    const results = []

    for (const pageUrl of pageUrls) {
      try {
        console.log(`  Requesting GSC data for "${pageUrl}"`)

        // ページごとの日次データを取得
        const requestBody = {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['page', 'date', 'query'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'equals',
                  expression: pageUrl
                }
              ]
            }
          ],
          rowLimit: 25000
        }

        const response = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody
        })

        const rows = response.data.rows || []
        console.log(`  → Got ${rows.length} rows for "${pageUrl}"`)

        // 日次データを集計
        const dailyDataMap = {}
        const queryDataMap = {}

        rows.forEach(row => {
          const page = row.keys[0]
          const date = row.keys[1]
          const query = row.keys[2]
          const clicks = row.clicks || 0
          const impressions = row.impressions || 0
          const ctr = row.ctr || 0
          const position = row.position || 0

          // 日次データ集計
          if (!dailyDataMap[date]) {
            dailyDataMap[date] = {
              clicks: 0,
              impressions: 0,
              positions: [],
              queries: {}
            }
          }

          dailyDataMap[date].clicks += clicks
          dailyDataMap[date].impressions += impressions
          dailyDataMap[date].positions.push(position)

          // クエリごとのデータを記録
          if (!dailyDataMap[date].queries[query]) {
            dailyDataMap[date].queries[query] = {
              query,
              clicks: 0,
              impressions: 0,
              position: position
            }
          }
          dailyDataMap[date].queries[query].clicks += clicks
          dailyDataMap[date].queries[query].impressions += impressions

          // 全体のクエリデータ
          if (!queryDataMap[query]) {
            queryDataMap[query] = {
              query,
              clicks: 0,
              impressions: 0,
              positions: []
            }
          }
          queryDataMap[query].clicks += clicks
          queryDataMap[query].impressions += impressions
          queryDataMap[query].positions.push(position)
        })

        // 日次データを配列に変換
        const dailyData = Object.entries(dailyDataMap).map(([date, data]) => {
          // その日のトップクエリ（クリック数順）
          const topQueries = Object.values(data.queries)
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10) // トップ10
            .map(q => ({
              query: q.query,
              clicks: q.clicks,
              impressions: q.impressions,
              position: q.position
            }))

          // 平均順位を計算
          const avgPosition = data.positions.length > 0
            ? data.positions.reduce((sum, pos) => sum + pos, 0) / data.positions.length
            : 0

          // その日のユニーククエリ数を計算
          const uniqueQueryCount = Object.keys(data.queries).length

          return {
            date,
            clicks: data.clicks,
            impressions: data.impressions,
            ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
            position: avgPosition,
            topQueries,
            uniqueQueryCount
          }
        }).sort((a, b) => new Date(a.date) - new Date(b.date))

        // 全期間のトップクエリ
        const topQueries = Object.values(queryDataMap)
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 20)
          .map(q => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            avgPosition: q.positions.reduce((sum, pos) => sum + pos, 0) / q.positions.length
          }))

        // 最新データ
        const latestData = dailyData[dailyData.length - 1] || null
        const totalClicks = dailyData.reduce((sum, d) => sum + d.clicks, 0)
        const totalImpressions = dailyData.reduce((sum, d) => sum + d.impressions, 0)
        const avgPosition = dailyData.length > 0
          ? dailyData.reduce((sum, d) => sum + d.position, 0) / dailyData.length
          : 0

        // ページタイトルを取得
        let pageTitle = ''
        try {
          const pageResponse = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GSC-Page-Tracker/1.0)'
            },
            signal: AbortSignal.timeout(5000) // 5秒タイムアウト
          })

          if (pageResponse.ok) {
            const html = await pageResponse.text()
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            pageTitle = titleMatch ? titleMatch[1].trim() : pageUrl.split('/').filter(Boolean).pop() || pageUrl
          } else {
            pageTitle = pageUrl.split('/').filter(Boolean).pop() || pageUrl
          }
        } catch (error) {
          console.warn(`Failed to fetch page title for ${pageUrl}:`, error.message)
          pageTitle = pageUrl.split('/').filter(Boolean).pop() || pageUrl
        }

        results.push({
          pageUrl,
          pageTitle,
          latestDate: latestData?.date || null,
          latestClicks: latestData?.clicks || 0,
          latestPosition: latestData?.position || 0,
          totalClicks,
          totalImpressions,
          avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
          avgPosition,
          topQueries,
          dailyData
        })

      } catch (error) {
        console.error(`Error fetching data for page: ${pageUrl}`, error)
        results.push({
          pageUrl,
          pageTitle: '',
          latestDate: null,
          latestClicks: 0,
          latestPosition: 0,
          totalClicks: 0,
          totalImpressions: 0,
          avgCtr: 0,
          avgPosition: 0,
          topQueries: [],
          dailyData: []
        })
      }
    }

    res.status(200).json({ results })

  } catch (error) {
    console.error('Page Tracker API Error:', error)
    res.status(500).json({
      error: 'ページトラッカーデータの取得に失敗しました',
      details: error.message
    })
  }
}
