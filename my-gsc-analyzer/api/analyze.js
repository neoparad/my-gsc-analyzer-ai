import { google } from 'googleapis'
import { checkBasicAuth } from './_auth.js'

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
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
    const { site_url, past_start, past_end, current_start, current_end, url_filter, query_filter } = req.body

    // 環境変数から認証情報を取得
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
      } catch (e) {
        throw new Error('Failed to parse GOOGLE_CREDENTIALS environment variable: ' + e.message)
      }
    } else {
      // ローカル開発環境用（Node.jsのfsを使用）
      try {
        const fs = await import('fs')
        const path = await import('path')
        const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
      } catch (e) {
        throw new Error('GOOGLE_CREDENTIALS environment variable is not set and local credentials file not found')
      }
    }

    // Google API認証
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // より多くのデータを取得する関数
    const getAllSearchData = async (startDate, endDate, urlFilter = '') => {
      let allRows = []
      let startRow = 0
      const rowLimit = 25000

      while (true) {
        const requestBody = {
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          dataState: 'final',
          rowLimit,
          startRow
        }

        // URLフィルタをAPI側で適用
        if (urlFilter) {
          requestBody.dimensionFilterGroups = [{
            filters: [{
              dimension: 'page',
              operator: 'contains',
              expression: urlFilter
            }]
          }]
        }

        const response = await searchconsole.searchanalytics.query({
          siteUrl: site_url,
          requestBody
        })

        const rows = response.data?.rows || []

        if (rows.length === 0) break

        allRows = allRows.concat(rows)

        if (rows.length < rowLimit) break

        startRow += rowLimit

        // API制限対策
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return allRows
    }

    // 過去期間のデータ取得
    const pastRows = await getAllSearchData(past_start, past_end, url_filter)

    // 現在期間のデータ取得
    const currentRows = await getAllSearchData(current_start, current_end, url_filter)

    // データ処理
    const pastData = { rows: pastRows }
    const currentData = { rows: currentRows }

    const result = processSearchConsoleData(pastData, currentData, url_filter, query_filter)

    res.status(200).json(result)

  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

function processSearchConsoleData(pastData, currentData, urlFilter, queryFilter) {
  // 基本的なデータ処理ロジック
  const pastRows = pastData.rows || []
  const currentRows = currentData.rows || []

  // フィルタリング
  const filteredPast = pastRows.filter(row => {
    const [query, url] = row.keys
    return (!urlFilter || url.includes(urlFilter)) && (!queryFilter || query.includes(queryFilter))
  })

  const filteredCurrent = currentRows.filter(row => {
    const [query, url] = row.keys
    return (!urlFilter || url.includes(urlFilter)) && (!queryFilter || query.includes(queryFilter))
  })

  // 簡易的な比較処理
  const improved_queries = []
  const declined_queries = []

  // クエリごとにベストポジションを選択
  const pastBest = {}
  const currentBest = {}

  // 過去期間のベストポジション
  filteredPast.forEach(row => {
    const [query] = row.keys
    if (!pastBest[query] || row.position < pastBest[query].position) {
      pastBest[query] = row
    }
  })

  // 現在期間のベストポジション
  filteredCurrent.forEach(row => {
    const [query] = row.keys
    if (!currentBest[query] || row.position < currentBest[query].position) {
      currentBest[query] = row
    }
  })

  // 全クエリを統合して比較
  const allQueries = new Set([...Object.keys(pastBest), ...Object.keys(currentBest)])

  allQueries.forEach(query => {
    const pastRow = pastBest[query]
    const currentRow = currentBest[query]

    if (currentRow) {
      // 現在期間に存在するクエリ
      const item = {
        query,
        url: currentRow.keys[1],
        directory: currentRow.keys[1].split('/')[3] || 'root',
        past_position: pastRow?.position || null,
        current_position: currentRow.position,
        change: pastRow ? (pastRow.position - currentRow.position) : 'new',
        clicks_change: pastRow ? (currentRow.clicks - pastRow.clicks) : currentRow.clicks,
        status: pastRow ? (pastRow.position > currentRow.position ? 'improved' : 'declined') : 'new',
        past_clicks: pastRow?.clicks || 0,
        current_clicks: currentRow.clicks,
        past_impressions: pastRow?.impressions || 0,
        current_impressions: currentRow.impressions
      }

      if (item.status === 'improved' || item.status === 'new') {
        improved_queries.push(item)
      } else {
        declined_queries.push(item)
      }
    } else if (pastRow) {
      // 消失したクエリ
      const item = {
        query,
        url: pastRow.keys[1],
        directory: pastRow.keys[1].split('/')[3] || 'root',
        past_position: pastRow.position,
        current_position: null,
        change: 'disappeared',
        clicks_change: -pastRow.clicks,
        status: 'disappeared',
        past_clicks: pastRow.clicks,
        current_clicks: 0,
        past_impressions: pastRow.impressions,
        current_impressions: 0
      }

      declined_queries.push(item)
    }
  })

  return {
    improved_queries,
    declined_queries,
    directory_analysis: getDirectoryAnalysis(improved_queries, declined_queries),
    summary: {
      improved_total: improved_queries.length,
      declined_total: declined_queries.length,
      new_queries: improved_queries.filter(q => q.status === 'new').length,
      disappeared_queries: declined_queries.filter(q => q.status === 'disappeared').length,

      // 期間ベース比較（Search Console形式）
      clicks_past: filteredPast.reduce((sum, row) => sum + (row.clicks || 0), 0),
      clicks_current: filteredCurrent.reduce((sum, row) => sum + (row.clicks || 0), 0),
      clicks_change: filteredCurrent.reduce((sum, row) => sum + (row.clicks || 0), 0) - filteredPast.reduce((sum, row) => sum + (row.clicks || 0), 0),
      impressions_past: filteredPast.reduce((sum, row) => sum + (row.impressions || 0), 0),
      impressions_current: filteredCurrent.reduce((sum, row) => sum + (row.impressions || 0), 0),
      impressions_change: filteredCurrent.reduce((sum, row) => sum + (row.impressions || 0), 0) - filteredPast.reduce((sum, row) => sum + (row.impressions || 0), 0),

      // クエリベース比較（詳細分析用）
      query_clicks_change: [...improved_queries, ...declined_queries].reduce((sum, item) => sum + (item.clicks_change || 0), 0),
      query_impressions_change: [...improved_queries, ...declined_queries].reduce((sum, item) => sum + (item.current_impressions - item.past_impressions), 0),

      filtered_queries: filteredCurrent.length
    },
    filters_applied: { url_filter: urlFilter, query_filter: queryFilter }
  }
}

function getDirectoryAnalysis(improved, declined) {
  const directories = {}
  ;[...improved, ...declined].forEach(item => {
    directories[item.directory] = (directories[item.directory] || 0) + 1
  })
  return directories
}
