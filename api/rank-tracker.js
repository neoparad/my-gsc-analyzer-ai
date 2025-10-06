import { google } from 'googleapis'
import { checkBasicAuth } from './_auth.js'

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

    // 環境変数から認証情報を取得
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
      } catch (e) {
        throw new Error('Failed to parse GOOGLE_CREDENTIALS environment variable: ' + e.message)
      }
    } else {
      // ローカル開発環境用
      try {
        const fs = await import('fs')
        const path = await import('path')
        const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
      } catch (e) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set and local credentials file not found')
      }
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

    console.log(`📅 Fetching rank data: ${formatDate(startDate)} to ${formatDate(endDate)} (${queries.length} queries)`)

    // 各クエリの順位履歴を取得
    const results = []

    for (const query of queries) {
      try {
        // 比較分析と同じ方法でデータ取得
        const requestBody = {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['query', 'page', 'date'],
          rowLimit: 25000
        }

        console.log(`  Requesting GSC data for "${query}" on ${siteUrl}`)

        const response = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody
        })

        const allRows = response.data.rows || []

        // クエリでフィルタリング（完全一致のみ、全角半角スペース両対応）
        const normalizedQuery = query.replace(/　/g, ' ').toLowerCase().trim()

        const rows = allRows.filter(row => {
          const rowQuery = row.keys[0]
          const normalizedRowQuery = rowQuery.replace(/　/g, ' ').toLowerCase().trim()

          // 完全一致のみ
          return normalizedRowQuery === normalizedQuery
        })

        console.log(`  → Got ${allRows.length} total rows, ${rows.length} matching "${query}"`)

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

          // ページタイトルは別途取得が必要なため、URLのみ返す
          pageTitle = topPageUrl.split('/').pop() || topPageUrl
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
