import { google } from 'googleapis'
import { verifyToken } from '../lib/auth-middleware.js'
import { getGoogleCredentials } from '../lib/google-credentials.js'
import { canUserAccessSite, getAccountIdForSite } from '../lib/user-sites.js'

export default async function handler(req, res) {

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

  // JWT認証チェック
  const authResult = verifyToken(req, res)
  if (authResult !== true) {
    return
  }

  try {
    const { siteUrl, queries, period = 30, accountId: requestAccountId } = req.body

    if (!siteUrl || !queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'siteUrl and queries are required' })
    }

    // ユーザーがこのサイトにアクセス可能かチェック
    const userRole = req.user.role || 'user'
    const hasAccess = await canUserAccessSite(req.user.userId, siteUrl, userRole)
    if (!hasAccess) {
      return res.status(403).json({ error: 'このサイトにアクセスする権限がありません' })
    }

    // ユーザーのサイト設定からサービスアカウントIDを取得
    const dbAccountId = await getAccountIdForSite(req.user.userId, siteUrl, userRole)
    
    // リクエストボディのaccountIdを優先（フロントエンドから明示的に指定されている場合）
    // ただし、管理者以外はリクエストのaccountIdを無視してデータベースの値を信頼
    // accountIdを正規化（小文字、ハイフン統一）
    const normalizeAccountId = (id) => id ? id.toLowerCase().replace(/_/g, '-').trim() : 'link-th'
    const rawAccountId = (userRole === 'admin' && requestAccountId) ? requestAccountId : dbAccountId
    const accountId = normalizeAccountId(rawAccountId)
    
    console.log(`[Rank Tracker] User: ${req.user.userId}, Site: ${siteUrl}`)
    console.log(`[Rank Tracker] DB accountId: ${dbAccountId}, Request accountId: ${requestAccountId}, Using: ${accountId}`)
    
    // 認証情報を取得
    let credentials
    try {
      credentials = getGoogleCredentials(accountId)
      console.log(`[Rank Tracker] Successfully loaded credentials for account: ${accountId}`)
    } catch (error) {
      console.error(`[Rank Tracker] Failed to load credentials for account ${accountId}:`, error.message)
      // フォールバック: link-thを試す
      if (accountId !== 'link-th') {
        console.log(`[Rank Tracker] Trying fallback account: link-th`)
        try {
          credentials = getGoogleCredentials('link-th')
          console.log(`[Rank Tracker] Using fallback account: link-th`)
        } catch (fallbackError) {
          console.error(`[Rank Tracker] Fallback also failed:`, fallbackError.message)
          throw new Error(`認証情報の取得に失敗しました。アカウント: ${accountId}, エラー: ${error.message}`)
        }
      } else {
        throw error
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
