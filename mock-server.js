import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { serve } from 'inngest/express'
import { inngest } from './inngest/client.js'
import { functions } from './inngest/functions/index.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Inngest serve endpoint
app.use('/api/inngest', serve({ client: inngest, functions }))

// Real Google Search Console API endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { site_url, past_start, past_end, current_start, current_end, url_filter, query_filter } = req.body

    // デバッグログ
    console.log('受信したsite_url:', site_url)
    console.log('リクエストボディ全体:', req.body)

    // 認証情報を読み込み
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    // Google API認証
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    console.log('認証完了、API呼び出し開始...')

    // より多くのデータを取得する関数
    const getAllSearchData = async (startDate, endDate, urlFilter = '') => {
      let allRows = []
      let startRow = 0
      const rowLimit = 25000

      while (true) {
        console.log(`データ取得中... ${startRow} 行目から ${rowLimit} 件`)

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
        console.log(`取得完了: ${rows.length} 件`)

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
    console.log('過去期間データ取得開始...')
    const pastRows = await getAllSearchData(past_start, past_end, url_filter)
    console.log('過去期間データ取得完了:', pastRows.length, '行')
    console.log('過去期間サンプルデータ:', JSON.stringify(pastRows[0], null, 2))

    // 現在期間のデータ取得
    console.log('現在期間データ取得開始...')
    const currentRows = await getAllSearchData(current_start, current_end, url_filter)
    console.log('現在期間データ取得完了:', currentRows.length, '行')

    // データ処理（簡易版）
    console.log('データ処理開始...')

    let result
    try {
      // データ形式を統一
      const pastData = { rows: pastRows }
      const currentData = { rows: currentRows }

      result = processSearchConsoleData(pastData, currentData, url_filter, query_filter)
      console.log('データ処理完了')
    } catch (processError) {
      console.error('データ処理でエラー:', processError.message)
      throw processError
    }

    console.log('処理結果サンプル:', JSON.stringify(result.improved_queries[0], null, 2))
    console.log('=== クリック変化の比較 ===')
    console.log('期間ベース（Search Console形式）:', result.summary.clicks_change)
    console.log('クエリベース（詳細分析）:', result.summary.query_clicks_change)
    console.log('========================')
    console.log('レスポンス送信中...')

    res.json(result)
    console.log('レスポンス送信完了！')

  } catch (error) {
    console.error('=== API Error Details ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error response:', error.response?.data)
    console.error('========================')
    res.status(500).json({ error: error.message })
  }
})

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

// Directory Analysis endpoint
app.post('/api/directory-analysis', async (req, res) => {
  try {
    const { siteUrl, startMonth, endMonth, directories, viewMode, searchType, showOthers } = req.body

    console.log('Directory Analysis request:', { siteUrl, startMonth, endMonth, directories, viewMode, searchType, showOthers })

    // 認証情報を読み込み
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // 月次データを取得
    const start = new Date(startMonth + '-01')
    const end = new Date(endMonth + '-01')
    end.setMonth(end.getMonth() + 1)
    end.setDate(0) // 月末日

    const periods = []
    const chartData = []
    const tableData = []

    if (viewMode === 'monthly') {
      // 月次データ
      let current = new Date(start)
      while (current <= end) {
        const year = current.getFullYear()
        const month = current.getMonth() + 1
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        periods.push({
          label: `${year}年${month}月`,
          startDate,
          endDate
        })

        current.setMonth(current.getMonth() + 1)
      }
    } else {
      // 四半期データ
      const startYear = start.getFullYear()
      const endYear = end.getFullYear()
      const startQ = Math.floor(start.getMonth() / 3) + 1
      const endQ = Math.floor(end.getMonth() / 3) + 1

      for (let year = startYear; year <= endYear; year++) {
        const qStart = year === startYear ? startQ : 1
        const qEnd = year === endYear ? endQ : 4

        for (let q = qStart; q <= qEnd; q++) {
          const qStartMonth = (q - 1) * 3 + 1
          const qEndMonth = q * 3
          const startDate = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
          const endDay = new Date(year, qEndMonth, 0).getDate()
          const endDate = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

          periods.push({
            label: `${year}年Q${q}`,
            startDate,
            endDate
          })
        }
      }
    }

    // 各期間のデータを取得（並列処理で高速化）
    for (const period of periods) {
      const periodChartData = { period: period.label }

      // 2段階取得方式：ディレクトリごとに並列実行
      const fetchTasks = directories.map(async (dir) => {
        try {
          // 検索タイプフィルタの設定
          const dimensionFilterGroups = [{
            filters: [{
              dimension: 'page',
              operator: 'contains',
              expression: dir
            }]
          }]

          // 検索タイプのマッピング（Search Console APIの形式に変換）
          const searchTypeMap = {
            'web': 'web',
            'image': 'image',
            'video': 'video',
            'news': 'news'
          }

          const apiSearchType = searchTypeMap[searchType] || 'web'

          // 1回目：ページ単位で基本データを取得（速い）
          const [pageResponse, queryResponse] = await Promise.all([
            searchconsole.searchanalytics.query({
              siteUrl,
              requestBody: {
                startDate: period.startDate,
                endDate: period.endDate,
                dimensions: ['page'],
                dimensionFilterGroups,
                type: apiSearchType,
                rowLimit: 25000,
                dataState: 'final'
              }
            }),
            // 2回目：クエリ数のみを取得
            searchconsole.searchanalytics.query({
              siteUrl,
              requestBody: {
                startDate: period.startDate,
                endDate: period.endDate,
                dimensions: ['query'],
                dimensionFilterGroups,
                type: apiSearchType,
                rowLimit: 25000,
                dataState: 'final'
              }
            })
          ])

          const pageRows = pageResponse.data?.rows || []
          const queryRows = queryResponse.data?.rows || []

          const clicks = pageRows.reduce((sum, row) => sum + (row.clicks || 0), 0)
          const impressions = pageRows.reduce((sum, row) => sum + (row.impressions || 0), 0)
          const avgPosition = pageRows.length > 0
            ? pageRows.reduce((sum, row) => sum + (row.position || 0), 0) / pageRows.length
            : 0
          const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00'
          const queryCount = queryRows.length

          return {
            period: period.label,
            directory: dir,
            clicks,
            impressions,
            ctr,
            position: avgPosition.toFixed(1),
            queryCount,
            chartClicks: clicks
          }
        } catch (error) {
          console.error(`Error fetching data for ${dir}:`, error.message)
          return null
        }
      })

      // その他ページのデータも並列で取得
      if (showOthers) {
        fetchTasks.push((async () => {
          try {
            // 検索タイプのマッピング
            const searchTypeMap = {
              'web': 'web',
              'image': 'image',
              'video': 'video',
              'news': 'news'
            }
            const apiSearchType = searchTypeMap[searchType] || 'web'

            const [pageResponse, queryResponse] = await Promise.all([
              searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                  startDate: period.startDate,
                  endDate: period.endDate,
                  dimensions: ['page'],
                  type: apiSearchType,
                  rowLimit: 25000,
                  dataState: 'final'
                }
              }),
              searchconsole.searchanalytics.query({
                siteUrl,
                requestBody: {
                  startDate: period.startDate,
                  endDate: period.endDate,
                  dimensions: ['query'],
                  type: apiSearchType,
                  rowLimit: 25000,
                  dataState: 'final'
                }
              })
            ])

            const allPageRows = pageResponse.data?.rows || []
            const allQueryRows = queryResponse.data?.rows || []

            const otherPageRows = allPageRows.filter(row => {
              const url = row.keys[0]
              return !directories.some(dir => url.includes(dir))
            })

            const clicks = otherPageRows.reduce((sum, row) => sum + (row.clicks || 0), 0)
            const impressions = otherPageRows.reduce((sum, row) => sum + (row.impressions || 0), 0)
            const avgPosition = otherPageRows.length > 0
              ? otherPageRows.reduce((sum, row) => sum + (row.position || 0), 0) / otherPageRows.length
              : 0
            const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '0.00'

            // その他のクエリ数（全クエリ数から対象ディレクトリのクエリ数を引く）
            const dirQueryCount = tableData
              .filter(d => d.period === period.label && directories.includes(d.directory))
              .reduce((sum, d) => sum + d.queryCount, 0)
            const queryCount = Math.max(0, allQueryRows.length - dirQueryCount)

            return {
              period: period.label,
              directory: 'その他',
              clicks,
              impressions,
              ctr,
              position: avgPosition.toFixed(1),
              queryCount,
              chartClicks: clicks
            }
          } catch (error) {
            console.error('Error fetching data for others:', error.message)
            return null
          }
        })())
      }

      // 全てのディレクトリのデータを並列で取得
      const results = await Promise.all(fetchTasks)

      // 結果を処理
      results.forEach(result => {
        if (result) {
          periodChartData[result.directory] = result.chartClicks
          tableData.push(result)
        }
      })

      chartData.push(periodChartData)
    }

    res.json({ chartData, tableData })
  } catch (error) {
    console.error('Directory Analysis API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Brand Analysis endpoint (同期版 - 直接実行)
app.post('/api/brand-analysis', async (req, res) => {
  try {
    const { siteUrl, startDate, endDate, directories, brandKeywords } = req.body

    console.log('Brand Analysis request:', {
      siteUrl,
      startDate,
      endDate,
      directories,
      brandKeywords
    })

    // 認証情報を読み込み
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // simple-statistics のインポート
    const stats = await import('simple-statistics')

    // データ取得
    const allRows = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = []

    let current = new Date(start)
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
      const actualEnd = monthEnd > end ? end : monthEnd

      months.push({
        startDate: monthStart.toISOString().split('T')[0],
        endDate: actualEnd.toISOString().split('T')[0]
      })

      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }

    console.log(`Fetching data in ${months.length} batches...`)

    // 各月のデータを並列で取得
    const fetchTasks = months.map(async (period) => {
      try {
        const dimensionFilterGroups = directories && directories.length > 0 && directories[0].trim() !== ''
          ? [{ filters: [{ dimension: 'page', operator: 'contains', expression: directories[0] }] }]
          : undefined

        const response = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: period.startDate,
            endDate: period.endDate,
            dimensions: ['query', 'date'],
            dimensionFilterGroups,
            rowLimit: 25000,
            dataState: 'final'
          }
        })

        return response.data?.rows || []
      } catch (error) {
        console.error(`Error fetching data for ${period.startDate}:`, error.message)
        return []
      }
    })

    const results = await Promise.all(fetchTasks)
    results.forEach(rows => allRows.push(...rows))

    console.log(`Total rows fetched: ${allRows.length}`)

    // ブランドキーワード分類
    const isBrandQuery = (query) => {
      const lowerQuery = query.toLowerCase()
      return brandKeywords.some(keyword =>
        lowerQuery.includes(keyword.toLowerCase())
      )
    }

    const brandRows = allRows.filter(row => isBrandQuery(row.keys[0]))

    // 日次集計
    const dailyMap = {}
    brandRows.forEach(row => {
      const [query, date] = row.keys
      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          clicks: 0,
          impressions: 0,
          queries: new Set()
        }
      }
      dailyMap[date].clicks += row.clicks || 0
      dailyMap[date].impressions += row.impressions || 0
      dailyMap[date].queries.add(query)
    })

    const dailyData = Object.values(dailyMap)
      .map(d => ({
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
        queryCount: d.queries.size,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    console.log(`Daily data points: ${dailyData.length}`)

    if (dailyData.length === 0) {
      return res.json({
        statistics: { error: 'No data available for analysis' },
        aiComment: 'データ不足のため分析できませんでした。',
        dailyData: []
      })
    }

    // 統計分析
    const clicks = dailyData.map(d => d.clicks)
    const dates = dailyData.map(d => new Date(d.date))

    const basicStats = {
      mean: stats.mean(clicks),
      median: stats.median(clicks),
      stdDev: stats.standardDeviation(clicks),
      variance: stats.variance(clicks),
      min: stats.min(clicks),
      max: stats.max(clicks),
      range: stats.max(clicks) - stats.min(clicks)
    }

    const cv = (basicStats.stdDev / basicStats.mean) * 100

    // 月別集計
    const monthlyMap = {}
    dailyData.forEach(d => {
      const month = d.date.substring(0, 7)
      if (!monthlyMap[month]) {
        monthlyMap[month] = { clicks: 0, days: 0 }
      }
      monthlyMap[month].clicks += d.clicks
      monthlyMap[month].days += 1
    })

    const monthlyData = Object.entries(monthlyMap)
      .map(([month, data]) => ({
        month,
        avgClicks: data.clicks / data.days,
        totalClicks: data.clicks
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    const peakMonth = monthlyData.reduce((max, m) =>
      m.avgClicks > max.avgClicks ? m : max, monthlyData[0])
    const lowMonth = monthlyData.reduce((min, m) =>
      m.avgClicks < min.avgClicks ? m : min, monthlyData[0])

    // 曜日別集計
    const dowMap = {}
    dailyData.forEach(d => {
      const date = new Date(d.date)
      const dow = date.getDay()
      if (!dowMap[dow]) {
        dowMap[dow] = { clicks: 0, days: 0 }
      }
      dowMap[dow].clicks += d.clicks
      dowMap[dow].days += 1
    })

    const dowData = Object.entries(dowMap)
      .map(([dow, data]) => ({
        dow: parseInt(dow),
        avgClicks: data.clicks / data.days
      }))
      .sort((a, b) => a.dow - b.dow)

    const dowNames = ['日', '月', '火', '水', '木', '金', '土']
    const bestDow = dowData.reduce((max, d) =>
      d.avgClicks > max.avgClicks ? d : max, dowData[0])
    const worstDow = dowData.reduce((min, d) =>
      d.avgClicks < min.avgClicks ? d : min, dowData[0])

    const weekdayAvg = stats.mean(dowData.filter(d => d.dow >= 1 && d.dow <= 5).map(d => d.avgClicks))
    const weekendAvg = stats.mean(dowData.filter(d => d.dow === 0 || d.dow === 6).map(d => d.avgClicks))

    // トレンド分析
    const timePoints = dailyData.map((_, i) => i)
    const linearRegression = stats.linearRegression(timePoints.map((x, i) => [x, clicks[i]]))
    const trendSlope = linearRegression.m

    // 相関分析
    const impressions = dailyData.map(d => d.impressions)
    const correlation = stats.sampleCorrelation(clicks, impressions)

    const statistics = {
      period: {
        start: startDate,
        end: endDate,
        days: dailyData.length
      },
      basic: basicStats,
      cv: cv,
      seasonal: {
        monthlyData,
        peakMonth: {
          month: peakMonth.month,
          avgClicks: Math.round(peakMonth.avgClicks)
        },
        lowMonth: {
          month: lowMonth.month,
          avgClicks: Math.round(lowMonth.avgClicks)
        },
        ratio: peakMonth.avgClicks / lowMonth.avgClicks
      },
      weekday: {
        dowData: dowData.map(d => ({
          dow: d.dow,
          name: dowNames[d.dow],
          avgClicks: Math.round(d.avgClicks)
        })),
        bestDow: {
          dow: bestDow.dow,
          name: dowNames[bestDow.dow],
          avgClicks: Math.round(bestDow.avgClicks)
        },
        worstDow: {
          dow: worstDow.dow,
          name: dowNames[worstDow.dow],
          avgClicks: Math.round(worstDow.avgClicks)
        },
        weekdayAvg: Math.round(weekdayAvg),
        weekendAvg: Math.round(weekendAvg),
        weekendEffect: ((weekendAvg - weekdayAvg) / weekdayAvg * 100).toFixed(1)
      },
      trend: {
        slope: trendSlope,
        direction: trendSlope > 0 ? '上昇' : trendSlope < 0 ? '下降' : '横ばい',
        dailyChange: trendSlope.toFixed(2)
      },
      correlation: {
        clicksImpressions: correlation.toFixed(3)
      }
    }

    // AI分析コメント生成
    let aiComment = ''
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

      const prompt = `以下のブランドキーワード統計分析結果を、150文字程度で簡潔に要約してください。

統計結果:
- 変動係数: ${statistics.cv.toFixed(1)}%
- 季節性: ピーク${statistics.seasonal.peakMonth.month}月 (${statistics.seasonal.peakMonth.avgClicks}クリック)、低調${statistics.seasonal.lowMonth.month}月 (${statistics.seasonal.lowMonth.avgClicks}クリック)
- トレンド: ${statistics.trend.direction} (${statistics.trend.dailyChange}クリック/日)
- 曜日効果: 平日${statistics.weekday.weekdayAvg}、週末${statistics.weekday.weekendAvg} (${statistics.weekday.weekendEffect}%)

制約:
- 最も重要な要因を中心に
- 事実のみ、推測は「推測されます」と明記
- 150文字程度`

      const result = await model.generateContent(prompt)
      aiComment = result.response.text().trim()
    } catch (error) {
      console.error('Gemini API error:', error)
      aiComment = `変動係数${statistics.cv.toFixed(1)}%。${statistics.seasonal.peakMonth.month}月にピーク。${statistics.trend.direction}トレンド。`
    }

    res.json({
      statistics,
      aiComment,
      dailyData: dailyData.slice(0, 100)
    })

  } catch (error) {
    console.error('Brand Analysis API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Query Rank Share endpoint
app.post('/api/query-rank-share', async (req, res) => {
  try {
    const { siteUrl, startMonth, endMonth, directories, viewMode } = req.body

    console.log('Query Rank Share request:', { siteUrl, startMonth, endMonth, directories, viewMode })

    // 認証情報を読み込み
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // 月次データを取得
    const start = new Date(startMonth + '-01')
    const end = new Date(endMonth + '-01')
    end.setMonth(end.getMonth() + 1)
    end.setDate(0) // 月末日

    const periods = []

    if (viewMode === 'monthly') {
      // 月次データ
      let current = new Date(start)
      while (current <= end) {
        const year = current.getFullYear()
        const month = current.getMonth() + 1
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        periods.push({
          label: `${year}年${month}月`,
          startDate,
          endDate
        })

        current.setMonth(current.getMonth() + 1)
      }
    } else {
      // 四半期データ
      const startYear = start.getFullYear()
      const endYear = end.getFullYear()
      const startQ = Math.floor(start.getMonth() / 3) + 1
      const endQ = Math.floor(end.getMonth() / 3) + 1

      for (let year = startYear; year <= endYear; year++) {
        const qStart = year === startYear ? startQ : 1
        const qEnd = year === endYear ? endQ : 4

        for (let q = qStart; q <= qEnd; q++) {
          const qStartMonth = (q - 1) * 3 + 1
          const qEndMonth = q * 3
          const startDate = `${year}-${String(qStartMonth).padStart(2, '0')}-01`
          const endDay = new Date(year, qEndMonth, 0).getDate()
          const endDate = `${year}-${String(qEndMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

          periods.push({
            label: `${year}年Q${q}`,
            startDate,
            endDate
          })
        }
      }
    }

    const chartData = []
    const tableData = []

    // 順位範囲の定義
    const rankRanges = [
      { label: '1～3位未満', min: 0, max: 3 },
      { label: '3～5位未満', min: 3, max: 5 },
      { label: '6～10位未満', min: 5, max: 10 },
      { label: '10～20位未満', min: 10, max: 20 },
      { label: '20位以上～圏外', min: 20, max: 9999 }
    ]

    // 各期間のデータを取得
    for (const period of periods) {
      // 全ディレクトリのクエリを並列で取得
      const fetchTasks = directories.map(async (dir) => {
        try {
          const response = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
              startDate: period.startDate,
              endDate: period.endDate,
              dimensions: ['query'],
              dimensionFilterGroups: [{
                filters: [{
                  dimension: 'page',
                  operator: 'contains',
                  expression: dir
                }]
              }],
              rowLimit: 25000,
              dataState: 'final'
            }
          })

          return response.data?.rows || []
        } catch (error) {
          console.error(`Error fetching data for ${dir}:`, error.message)
          return []
        }
      })

      const results = await Promise.all(fetchTasks)
      const allQueries = results.flat()

      // 順位範囲ごとにクエリを分類
      const rankCounts = {}
      rankRanges.forEach(range => {
        rankCounts[range.label] = 0
      })

      allQueries.forEach(row => {
        const position = row.position
        for (const range of rankRanges) {
          if (position >= range.min && position < range.max) {
            rankCounts[range.label]++
            break
          }
        }
      })

      // 合計クエリ数
      const totalQueries = Object.values(rankCounts).reduce((sum, count) => sum + count, 0)

      // チャートデータ（100%積み上げ用）
      const periodChartData = { period: period.label }
      rankRanges.forEach(range => {
        periodChartData[range.label] = totalQueries > 0 ? (rankCounts[range.label] / totalQueries * 100) : 0
      })
      chartData.push(periodChartData)

      // テーブルデータ
      rankRanges.forEach(range => {
        tableData.push({
          period: period.label,
          rankRange: range.label,
          queryCount: rankCounts[range.label],
          shareRate: totalQueries > 0 ? (rankCounts[range.label] / totalQueries * 100) : 0
        })
      })
    }

    res.json({ chartData, tableData })
  } catch (error) {
    console.error('Query Rank Share API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Rank Tracker endpoint
app.post('/api/rank-tracker', async (req, res) => {
  try {
    const { siteUrl, queries, period } = req.body

    console.log('Rank Tracker request:', { siteUrl, queries: queries.length, period })

    // 認証情報を読み込み
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

    // Google API認証
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // 各クエリの順位データを取得
    const results = []

    for (const query of queries) {
      console.log(`Fetching data for query: ${query}`)

      // 期間ごとの日別データを取得
      const dailyData = {}
      let topPageUrl = ''
      let pageTitle = ''

      // 現在の日付（3日前）
      const currentDate = new Date()
      currentDate.setDate(currentDate.getDate() - 3)

      // 期間分のデータを一括取得（より効率的）
      try {
        const startDate = new Date(currentDate)
        startDate.setDate(currentDate.getDate() - period + 1)

        const response = await searchconsole.searchanalytics.query({
          siteUrl: siteUrl,
          requestBody: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: currentDate.toISOString().split('T')[0],
            dimensions: ['query', 'page', 'date'],
            dimensionFilterGroups: [{
              filters: [{
                dimension: 'query',
                operator: 'contains',
                expression: query
              }]
            }],
            rowLimit: 1000,
            dataState: 'final'
          }
        })

        const rows = response.data?.rows || []
        console.log(`Got ${rows.length} rows for query: ${query}`)

        // クエリを正規化（全角・半角スペースを統一）
        const normalizeQuery = (q) => q.replace(/[\s　]+/g, ' ').trim().toLowerCase()
        const normalizedSearchQuery = normalizeQuery(query)

        // クエリの完全一致でフィルタリング（スペースの違いを吸収）
        const exactMatchRows = rows.filter(row => {
          const [rowQuery] = row.keys
          return normalizeQuery(rowQuery) === normalizedSearchQuery
        })
        console.log(`Exact match rows: ${exactMatchRows.length}`)

        if (exactMatchRows.length > 0) {
          console.log(`Sample queries found:`, exactMatchRows.slice(0, 3).map(r => r.keys[0]))
        } else {
          console.log(`No exact match. Sample from all rows:`, rows.slice(0, 3).map(r => r.keys[0]))
        }

        // 日付ごとにベストポジションを集計
        const datePositions = {}
        exactMatchRows.forEach(row => {
          const [rowQuery, url, date] = row.keys
          if (!datePositions[date] || row.position < datePositions[date].position) {
            datePositions[date] = { position: row.position, url, query: rowQuery }
          }
        })

        Object.entries(datePositions).forEach(([date, data]) => {
          dailyData[date] = data.position
          if (!topPageUrl && data.url) {
            topPageUrl = data.url
            pageTitle = data.url.split('/').filter(x => x).pop() || data.url
          }
        })

      } catch (error) {
        console.error(`Error fetching data for ${query}:`, error.message)
      }

      // 現在の順位を取得
      const currentDateStr = currentDate.toISOString().split('T')[0]
      const currentPosition = dailyData[currentDateStr] || null

      results.push({
        query,
        topPageUrl,
        pageTitle,
        currentPosition,
        history: dailyData
      })

      console.log(`Completed query: ${query}, positions found: ${Object.keys(dailyData).length}`)
    }

    console.log(`Rank tracker results: ${results.length} queries processed`)
    res.json({ results })

  } catch (error) {
    console.error('Rank Tracker API Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Chat endpoint with Gemini AI
app.post('/api/chat', async (req, res) => {
  try {
    const { message, siteUrl, contextData } = req.body
    console.log('Chat request:', message, siteUrl, contextData ? 'with context' : 'no context')

    // Import Gemini AI
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // Analyze question
    const analyzePrompt = `ユーザーの質問を分析して、以下のJSON形式で回答してください:
{
  "needsData": true/false,
  "days": 30,
  "action": "summary"
}

質問: ${message}
JSONのみを返してください。`

    const analysisResult = await model.generateContent(analyzePrompt)
    const analysisText = analysisResult.response.text()
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { needsData: false }

    let dataContext = ''

    // Get Search Console data if needed
    if (analysis.needsData) {
      const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
      })

      const searchconsole = google.searchconsole({ version: 'v1', auth })

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - (analysis.days || 30))
      const formatDate = (d) => d.toISOString().split('T')[0]

      const response = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl || 'sc-domain:tabirai.net',
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['query'],
          rowLimit: 100
        }
      })

      const data = response.data
      if (data.rows && data.rows.length > 0) {
        const totalClicks = data.rows.reduce((sum, row) => sum + (row.clicks || 0), 0)
        const totalImpressions = data.rows.reduce((sum, row) => sum + (row.impressions || 0), 0)
        const avgPosition = data.rows.reduce((sum, row) => sum + (row.position || 0), 0) / data.rows.length
        const avgCtr = (totalClicks / totalImpressions * 100).toFixed(2)

        const topQueries = data.rows.slice(0, 10).map(row => ({
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: (row.ctr * 100).toFixed(2) + '%',
          position: row.position.toFixed(1)
        }))

        dataContext = `
実際のSearch Consoleデータ（過去${analysis.days || 30}日間）:
- サイト: ${siteUrl || 'sc-domain:tabirai.net'}
- 期間: ${formatDate(startDate)} ～ ${formatDate(endDate)}
- 総クリック数: ${totalClicks.toLocaleString()}
- 総表示回数: ${totalImpressions.toLocaleString()}
- 平均CTR: ${avgCtr}%
- 平均掲載順位: ${avgPosition.toFixed(1)}位
- 総クエリ数: ${data.rows.length.toLocaleString()}

トップ10クエリ:
${topQueries.map((q, i) => `${i + 1}. "${q.query}": ${q.clicks}クリック, ${q.impressions}表示, CTR ${q.ctr}, 順位 ${q.position}`).join('\n')}
`
      }
    }

    // ページコンテキストデータを整形
    let pageContext = ''
    if (contextData) {
      if (contextData.improved_queries) {
        // 比較分析ページのコンテキスト
        const summary = contextData.summary
        pageContext = `
現在のページ: 比較分析

分析結果サマリー:
- 総クエリ数: ${summary.filtered_queries}
- 順位上昇クエリ: ${summary.improved_total}件（新規獲得: ${summary.new_queries}件）
- 順位下落クエリ: ${summary.declined_total}件（消失: ${summary.disappeared_queries}件）
- クリック変化: ${summary.clicks_change > 0 ? '+' : ''}${summary.clicks_change}（${summary.clicks_past} → ${summary.clicks_current}）
- 表示回数変化: ${summary.impressions_change > 0 ? '+' : ''}${summary.impressions_change}（${summary.impressions_past} → ${summary.impressions_current}）

上位改善クエリ（最大20件）:
${contextData.improved_queries.slice(0, 20).map((q, i) =>
  `${i+1}. "${q.query}": ${q.past_position || 'N/A'}位 → ${q.current_position}位 (変化: ${typeof q.change === 'number' && q.change > 0 ? '+' : ''}${q.change})`
).join('\n')}

上位下落クエリ（最大20件）:
${contextData.declined_queries.slice(0, 20).map((q, i) =>
  `${i+1}. "${q.query}": ${q.past_position}位 → ${q.current_position || 'N/A'}位 (変化: ${q.change})`
).join('\n')}
`
      } else if (contextData.queries) {
        // ランクトラッカーページのコンテキスト
        pageContext = `
現在のページ: GSCランクトラッカー

登録クエリ数: ${contextData.queries.length}件
監視期間: ${contextData.period}日間

登録クエリ一覧:
${contextData.queries.map((q, i) => {
  const avgPos = q.history && Object.keys(q.history).length > 0
    ? (Object.values(q.history).reduce((sum, pos) => sum + pos, 0) / Object.values(q.history).length).toFixed(1)
    : 'N/A'
  return `${i+1}. "${q.query}": 現在順位 ${q.currentPosition || 'N/A'}位, 平均順位 ${avgPos}位`
}).join('\n')}
`
      }
    }

    // Generate response with Gemini
    const responsePrompt = `あなたはGoogle Search Consoleの分析エキスパートです。
${dataContext ? 'ユーザーのサイトの実際のデータに基づいて、' : ''}${pageContext ? 'ページに表示されているデータを分析して、' : ''}具体的で実用的なアドバイスを提供してください。

${dataContext}

${pageContext}

ユーザーの質問: ${message}

回答は日本語で、以下の点を含めてください:
1. データの要約（データがある場合）
2. 具体的な改善提案
3. 次にとるべきアクション`

    const result = await model.generateContent(responsePrompt)
    const responseText = result.response.text()

    res.json({ response: responseText })
    console.log('Chat response sent')
  } catch (error) {
    console.error('Chat API Error:', error)
    res.status(500).json({
      error: 'チャット処理中にエラーが発生しました: ' + error.message
    })
  }
})

app.listen(3001, () => {
  console.log('Mock API server running on http://localhost:3001')
})