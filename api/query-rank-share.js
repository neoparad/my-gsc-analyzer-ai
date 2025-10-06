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
    const { siteUrl, startMonth, endMonth, directories, viewMode = 'monthly' } = req.body

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

    // データ取得（月ごとに効率的に取得）
    console.log(`📊 Fetching query rank share data from ${formatDate(start)} to ${formatDate(end)}`)

    const allQueryData = {}

    // 月ごとにデータ取得
    const currentMonth = new Date(start)
    while (currentMonth <= end) {
      const monthStart = new Date(currentMonth)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      if (monthEnd > end) monthEnd.setTime(end.getTime())

      const yearMonth = currentMonth.toISOString().substring(0, 7)
      console.log(`  Fetching ${yearMonth}...`)

      let monthRows = []
      let startRow = 0
      const rowLimit = 25000

      // ディレクトリごとにデータ取得してマージ
      const directoryRows = new Map() // ページURLをキーとしてrowを保存

      for (const dir of directories) {
        let dirStartRow = 0
        while (true) {
          const requestBody = {
            startDate: formatDate(monthStart),
            endDate: formatDate(monthEnd),
            dimensions: ['query', 'page'],
            dimensionFilterGroups: [{
              filters: [{
                dimension: 'page',
                operator: 'contains',
                expression: dir
              }]
            }],
            rowLimit,
            startRow: dirStartRow
          }

          const response = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody
          })

          const rows = response.data.rows || []
          if (rows.length === 0) break

          monthRows = monthRows.concat(rows)

          if (rows.length < rowLimit) break
          dirStartRow += rowLimit

          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      console.log(`    → Got ${monthRows.length} rows for ${yearMonth}`)

      // クエリごとの平均順位計算（APIフィルタ済みデータ）
      monthRows.forEach(row => {
        const query = row.keys[0]
        const position = row.position || 100

        const key = `${yearMonth}:${query}`
        if (!allQueryData[key]) {
          allQueryData[key] = []
        }
        allQueryData[key].push(position)
      })

      currentMonth.setMonth(currentMonth.getMonth() + 1)
    }

    console.log(`  Total unique query-month combinations: ${Object.keys(allQueryData).length}`)

    // 順位範囲の定義
    const rankRanges = ['1～3位未満', '3～5位未満', '6～10位未満', '10～20位未満', '20位以上～圏外']

    const getRankRange = (position) => {
      if (position < 3) return '1～3位未満'
      if (position < 6) return '3～5位未満'
      if (position < 10) return '6～10位未満'
      if (position < 20) return '10～20位未満'
      return '20位以上～圏外'
    }

    // 平均順位を計算して順位範囲別に集計
    const monthlyData = {}
    Object.keys(allQueryData).forEach(key => {
      const [yearMonth, query] = key.split(':')
      const positions = allQueryData[key]

      // 平均順位を計算
      const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      const rankRange = getRankRange(avgPosition)

      if (!monthlyData[yearMonth]) {
        monthlyData[yearMonth] = {}
        rankRanges.forEach(range => {
          monthlyData[yearMonth][range] = new Set()
        })
      }

      monthlyData[yearMonth][rankRange].add(query)
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

    // チャートデータを生成（100%積み上げ用）
    const chartData = periods.map(period => {
      const dataPoint = { period }
      let totalQueries = 0
      const queryCounts = {}

      if (viewMode === 'monthly') {
        const monthData = monthlyData[period]
        if (monthData) {
          rankRanges.forEach(range => {
            const count = monthData[range] ? monthData[range].size : 0
            queryCounts[range] = count
            totalQueries += count
          })
        }
      } else {
        // 四半期集計
        const [year, q] = period.split('-Q')
        const quarterStart = (parseInt(q) - 1) * 3 + 1
        const allQueries = {}
        rankRanges.forEach(range => allQueries[range] = new Set())

        for (let m = 0; m < 3; m++) {
          const month = quarterStart + m
          const monthKey = `${year}-${String(month).padStart(2, '0')}`
          const monthData = monthlyData[monthKey]
          if (monthData) {
            rankRanges.forEach(range => {
              if (monthData[range]) {
                monthData[range].forEach(q => allQueries[range].add(q))
              }
            })
          }
        }

        rankRanges.forEach(range => {
          const count = allQueries[range].size
          queryCounts[range] = count
          totalQueries += count
        })
      }

      // パーセンテージに変換
      rankRanges.forEach(range => {
        dataPoint[range] = totalQueries > 0 ? (queryCounts[range] / totalQueries) * 100 : 0
      })

      return dataPoint
    })

    // テーブルデータを生成
    const tableData = []
    periods.forEach(period => {
      let totalQueries = 0
      const queryCounts = {}

      if (viewMode === 'monthly') {
        const monthData = monthlyData[period]
        if (monthData) {
          rankRanges.forEach(range => {
            queryCounts[range] = monthData[range] ? monthData[range].size : 0
            totalQueries += queryCounts[range]
          })
        }
      } else {
        // 四半期集計
        const [year, q] = period.split('-Q')
        const quarterStart = (parseInt(q) - 1) * 3 + 1
        const allQueries = {}
        rankRanges.forEach(range => allQueries[range] = new Set())

        for (let m = 0; m < 3; m++) {
          const month = quarterStart + m
          const monthKey = `${year}-${String(month).padStart(2, '0')}`
          const monthData = monthlyData[monthKey]
          if (monthData) {
            rankRanges.forEach(range => {
              if (monthData[range]) {
                monthData[range].forEach(q => allQueries[range].add(q))
              }
            })
          }
        }

        rankRanges.forEach(range => {
          queryCounts[range] = allQueries[range].size
          totalQueries += queryCounts[range]
        })
      }

      rankRanges.forEach(range => {
        const queryCount = queryCounts[range] || 0
        const shareRate = totalQueries > 0 ? (queryCount / totalQueries) * 100 : 0

        tableData.push({
          period,
          rankRange: range,
          queryCount,
          shareRate
        })
      })
    })

    res.status(200).json({ chartData, tableData })

  } catch (error) {
    console.error('Query Rank Share API Error:', error)
    res.status(500).json({
      error: 'クエリ順位シェア分析データの取得に失敗しました',
      details: error.message
    })
  }
}
