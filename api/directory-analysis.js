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
    const { siteUrl, startMonth, endMonth, directories, viewMode = 'monthly', granularity = 'monthly', searchType = 'web', showOthers = false } = req.body

    if (!siteUrl || !startMonth || !endMonth || !directories || directories.length === 0) {
      return res.status(400).json({ error: '必要なパラメータが不足しています' })
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

    const authClient = await auth.getClient()
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient })

    // 月範囲を計算
    const start = new Date(startMonth + '-01')
    const end = new Date(endMonth + '-01')
    end.setMonth(end.getMonth() + 1)
    end.setDate(end.getDate() - 1)

    const formatDate = (date) => date.toISOString().split('T')[0]

    // データ取得（月ごとに分割して効率的に取得）
    console.log(`📊 Fetching directory analysis data from ${formatDate(start)} to ${formatDate(end)} (granularity: ${granularity})`)

    let allRows = []

    // 月ごとにデータ取得
    const currentMonth = new Date(start)
    while (currentMonth <= end) {
      const monthStart = new Date(currentMonth)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      if (monthEnd > end) monthEnd.setTime(end.getTime())

      const yearMonth = currentMonth.toISOString().substring(0, 7)
      console.log(`  Fetching ${yearMonth}...`)

      // ディレクトリごとにデータ取得
      for (const dir of directories) {
        console.log(`    → Fetching ${dir}...`)
        let startRow = 0
        let dirRowCount = 0
        const rowLimit = 25000

        while (true) {
          const dimensions = granularity === 'daily' ? ['date', 'query', 'page'] : ['query', 'page']

          const requestBody = {
            startDate: formatDate(monthStart),
            endDate: formatDate(monthEnd),
            dimensions,
            dimensionFilterGroups: [{
              filters: [{
                dimension: 'page',
                operator: 'contains',
                expression: dir
              }]
            }],
            searchType,
            rowLimit,
            startRow
          }

          const response = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody
          })

          const rows = response.data.rows || []

          if (rows.length === 0) break

          // 各行に年月情報を追加
          rows.forEach(row => {
            row.yearMonth = yearMonth
          })

          allRows = allRows.concat(rows)
          dirRowCount += rows.length

          if (rows.length < rowLimit) break

          startRow += rowLimit

          // API制限対策
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        if (dirRowCount > 0) {
          console.log(`       ${dir}: ${dirRowCount} rows`)
        }
      }

      console.log(`    → ${yearMonth} total rows: ${allRows.filter(r => r.yearMonth === yearMonth).length}`)
      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    console.log(`  Total rows fetched: ${allRows.length}`)
    const rows = allRows

    // ディレクトリごとにデータを集計
    const dirData = {}
    directories.forEach(dir => {
      dirData[dir] = {}
    })
    if (showOthers) {
      dirData['その他'] = {}
    }

    rows.forEach(row => {
      const keyOffset = granularity === 'daily' ? 1 : 0
      const date = granularity === 'daily' ? row.keys[0] : null
      const query = row.keys[keyOffset]
      const page = row.keys[keyOffset + 1]
      const yearMonth = row.yearMonth
      const dateKey = granularity === 'daily' ? date : yearMonth
      const clicks = row.clicks || 0
      const impressions = row.impressions || 0
      const position = row.position || 0

      // APIフィルタ済みなので、ページがどのディレクトリに属するか判定
      for (const dir of directories) {
        if (page.includes(dir)) {
          if (!dirData[dir][dateKey]) {
            dirData[dir][dateKey] = { clicks: 0, impressions: 0, positionSum: 0, count: 0, queries: new Set() }
          }
          dirData[dir][dateKey].clicks += clicks
          dirData[dir][dateKey].impressions += impressions
          dirData[dir][dateKey].positionSum += position
          dirData[dir][dateKey].count++
          dirData[dir][dateKey].queries.add(query)
          break
        }
      }
    })

    // 期間ごとに集計（月次 or 四半期）
    const periods = []
    const currentDate = new Date(start)
    while (currentDate <= end) {
      if (viewMode === 'monthly') {
        periods.push(currentDate.toISOString().substring(0, 7))
        currentDate.setMonth(currentDate.getMonth() + 1)
      } else {
        // 四半期
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1
        const year = currentDate.getFullYear()
        const periodLabel = `${year}-Q${quarter}`
        if (!periods.includes(periodLabel)) {
          periods.push(periodLabel)
        }
        currentDate.setMonth(currentDate.getMonth() + 3)
      }
    }

    // チャートデータを生成
    const chartData = periods.map(period => {
      const dataPoint = { period }

      Object.keys(dirData).forEach(dir => {
        if (viewMode === 'monthly') {
          const monthData = dirData[dir][period]
          dataPoint[dir] = monthData ? monthData.clicks : 0
        } else {
          // 四半期の場合、該当する3ヶ月分を合計
          const [year, q] = period.split('-Q')
          const quarterStart = (parseInt(q) - 1) * 3 + 1
          let quarterClicks = 0
          for (let m = 0; m < 3; m++) {
            const month = quarterStart + m
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            const monthData = dirData[dir][monthKey]
            if (monthData) quarterClicks += monthData.clicks
          }
          dataPoint[dir] = quarterClicks
        }
      })

      return dataPoint
    })

    // テーブルデータを生成
    const tableData = []
    periods.forEach(period => {
      Object.keys(dirData).forEach(dir => {
        let clicks = 0, impressions = 0, positionSum = 0, count = 0, queryCount = 0

        if (viewMode === 'monthly') {
          const monthData = dirData[dir][period]
          if (monthData) {
            clicks = monthData.clicks
            impressions = monthData.impressions
            positionSum = monthData.positionSum
            count = monthData.count
            queryCount = monthData.queries ? monthData.queries.size : 0
          }
        } else {
          // 四半期集計
          const [year, q] = period.split('-Q')
          const quarterStart = (parseInt(q) - 1) * 3 + 1
          const allQueries = new Set()
          for (let m = 0; m < 3; m++) {
            const month = quarterStart + m
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            const monthData = dirData[dir][monthKey]
            if (monthData) {
              clicks += monthData.clicks
              impressions += monthData.impressions
              positionSum += monthData.positionSum
              count += monthData.count
              if (monthData.queries) {
                monthData.queries.forEach(q => allQueries.add(q))
              }
            }
          }
          queryCount = allQueries.size
        }

        const position = count > 0 ? (positionSum / count).toFixed(1) : '-'
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'

        tableData.push({
          period,
          directory: dir,
          clicks,
          impressions,
          ctr,
          position,
          queryCount
        })
      })
    })

    // ディレクトリごとの時系列データを生成（グラフ用、日次/月次対応）
    const directoryTimeSeriesData = {}
    Object.keys(dirData).forEach(dir => {
      let timeSeriesData = []

      if (granularity === 'daily') {
        // 日次データ: すべての日付をソートして表示
        const allDates = Object.keys(dirData[dir]).sort()
        timeSeriesData = allDates.map(date => {
          const dayData = dirData[dir][date]
          const clicks = dayData.clicks
          const impressions = dayData.impressions
          const position = dayData.count > 0 ? parseFloat((dayData.positionSum / dayData.count).toFixed(1)) : 0
          const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0
          const queryCount = dayData.queries ? dayData.queries.size : 0

          return {
            period: date,
            clicks,
            impressions,
            ctr,
            position,
            queryCount
          }
        })
      } else {
        // 月次/四半期データ
        timeSeriesData = periods.map(period => {
          let clicks = 0, impressions = 0, positionSum = 0, count = 0, queryCount = 0

          if (viewMode === 'monthly') {
            const monthData = dirData[dir][period]
            if (monthData) {
              clicks = monthData.clicks
              impressions = monthData.impressions
              positionSum = monthData.positionSum
              count = monthData.count
              queryCount = monthData.queries ? monthData.queries.size : 0
            }
          } else {
            // 四半期集計
            const [year, q] = period.split('-Q')
            const quarterStart = (parseInt(q) - 1) * 3 + 1
            const allQueries = new Set()
            for (let m = 0; m < 3; m++) {
              const month = quarterStart + m
              const monthKey = `${year}-${String(month).padStart(2, '0')}`
              const monthData = dirData[dir][monthKey]
              if (monthData) {
                clicks += monthData.clicks
                impressions += monthData.impressions
                positionSum += monthData.positionSum
                count += monthData.count
                if (monthData.queries) {
                  monthData.queries.forEach(q => allQueries.add(q))
                }
              }
            }
            queryCount = allQueries.size
          }

          const position = count > 0 ? parseFloat((positionSum / count).toFixed(1)) : 0
          const ctr = impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0

          return {
            period,
            clicks,
            impressions,
            ctr,
            position,
            queryCount
          }
        })
      }

      directoryTimeSeriesData[dir] = timeSeriesData
    })

    console.log('📈 Sending response with directoryTimeSeriesData keys:', Object.keys(directoryTimeSeriesData))
    console.log('📈 Sample data for first directory:', Object.values(directoryTimeSeriesData)[0]?.slice(0, 2))

    res.status(200).json({ chartData, tableData, directoryTimeSeriesData })

  } catch (error) {
    console.error('Directory Analysis API Error:', error)
    res.status(500).json({
      error: 'ディレクトリ分析データの取得に失敗しました',
      details: error.message
    })
  }
}
