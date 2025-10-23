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
    const { siteUrl, queries, period = 30 } = req.body

    if (!siteUrl || !queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'siteUrl and queries are required' })
    }

    // 環境変数から認証情報を取得（本番環境では必須）
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
      } catch (e) {
        console.error('Failed to parse GOOGLE_CREDENTIALS:', e)
        throw new Error('Failed to parse GOOGLE_CREDENTIALS environment variable: ' + e.message)
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // ローカル開発環境用のみ（本番環境ではエラー）
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
    // GSCは通常2-3日前までのデータなので、最新の利用可能な日付を使用
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 2) // 2日前まで試す

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - period)

    const formatDate = (date) => date.toISOString().split('T')[0]

    console.log(`📅 Fetching rank data: ${formatDate(startDate)} to ${formatDate(endDate)} (${queries.length} queries)`)

    // 各クエリの順位履歴を取得
    const results = []

    for (const query of queries) {
      try {
        // 特定のクエリだけを取得するためにフィルターを使用
        const requestBody = {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['query', 'page', 'date'],
          dimensionFilterGroups: [{
            filters: [{
              dimension: 'query',
              operator: 'equals',
              expression: query
            }]
          }],
          rowLimit: 25000
        }

        console.log(`  Requesting GSC data for "${query}" on ${siteUrl} (with filter)`)

        const response = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody
        })

        // APIレベルでフィルターされているので、全ての行が目的のクエリ
        const rows = response.data.rows || []

        console.log(`  → Got ${rows.length} rows for "${query}"`)

        if (rows.length > 0) {
          console.log(`  → First 3 rows:`, rows.slice(0, 3).map(r => ({
            query: r.keys[0],
            page: r.keys[1],
            date: r.keys[2],
            position: r.position,
            clicks: r.clicks
          })))
        }

        // 日付ごとの順位を計算
        const history = {}
        const pageRanks = {}

        // ページごとのクリック数を集計
        // keys = [query, page, date]
        rows.forEach(row => {
          const date = row.keys[2]
          const page = row.keys[1]
          const position = row.position

          if (!pageRanks[date]) {
            pageRanks[date] = []
          }
          pageRanks[date].push({ page, position, clicks: row.clicks })
        })

        // 各日付で最もクリックされたページの順位を使用
        Object.keys(pageRanks).forEach(date => {
          const bestPage = pageRanks[date].sort((a, b) => b.clicks - a.clicks)[0]
          history[date] = bestPage.position
        })

        // 実際に取得できた最新日のデータを使用
        const availableDates = Object.keys(history).sort()
        const latestAvailableDate = availableDates[availableDates.length - 1]
        const currentPosition = latestAvailableDate ? history[latestAvailableDate] : null

        // トップページ情報を取得
        let topPageUrl = ''
        let pageTitle = ''

        if (rows.length > 0) {
          const topPage = rows.sort((a, b) => b.clicks - a.clicks)[0]
          topPageUrl = topPage.keys[1]

          // ページタイトルを取得
          try {
            const pageResponse = await fetch(topPageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GSC-Rank-Tracker/1.0)'
              },
              signal: AbortSignal.timeout(5000) // 5秒タイムアウト
            })

            if (pageResponse.ok) {
              const html = await pageResponse.text()
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
              pageTitle = titleMatch ? titleMatch[1].trim() : topPageUrl.split('/').filter(Boolean).pop() || topPageUrl
            } else {
              pageTitle = topPageUrl.split('/').filter(Boolean).pop() || topPageUrl
            }
          } catch (error) {
            console.warn(`Failed to fetch page title for ${topPageUrl}:`, error.message)
            pageTitle = topPageUrl.split('/').filter(Boolean).pop() || topPageUrl
          }
        }

        const result = {
          query,
          topPageUrl,
          pageTitle,
          currentPosition,
          latestDate: latestAvailableDate || null,
          history
        }

        console.log(`Query "${query}": currentPosition=${currentPosition}, latestDate=${latestAvailableDate}, historyDates=${Object.keys(history).length}`)
        console.log(`  → History sample:`, Object.entries(history).slice(0, 3))

        results.push(result)

      } catch (error) {
        console.error(`Error fetching data for query: ${query}`, error)
        results.push({
          query,
          topPageUrl: '',
          pageTitle: '',
          currentPosition: null,
          history: {}
        })
      }
    }

    res.status(200).json({ results })

  } catch (error) {
    console.error('Rank Tracker API Error:', error)
    res.status(500).json({
      error: 'ランクトラッカーデータの取得に失敗しました',
      details: error.message
    })
  }
}
