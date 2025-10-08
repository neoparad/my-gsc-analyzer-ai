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
    const { siteUrl, startDate, endDate, directories = [], brandKeywords = [] } = req.body

    if (!siteUrl || !startDate || !endDate || !brandKeywords || brandKeywords.length === 0) {
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
    const authClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    await authClient.authorize()
    const searchconsole = google.searchconsole({ version: 'v1', auth: authClient })

    console.log(`📊 Fetching brand keyword data from ${startDate} to ${endDate}`)
    console.log(`   Brand keywords: ${brandKeywords.join(', ')}`)

    // ブランドキーワードを含むクエリのデータを日次で取得
    const dailyData = {}

    // ディレクトリフィルタの設定
    const dimensionFilterGroups = []
    if (directories && directories.length > 0) {
      const filters = directories.map(dir => ({
        dimension: 'page',
        operator: 'contains',
        expression: dir
      }))
      dimensionFilterGroups.push({ filters })
    }

    let startRow = 0
    const rowLimit = 25000

    while (true) {
      const requestBody = {
        startDate,
        endDate,
        dimensions: ['query', 'date'],
        rowLimit,
        startRow
      }

      if (dimensionFilterGroups.length > 0) {
        requestBody.dimensionFilterGroups = dimensionFilterGroups
      }

      const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody
      })

      const rows = response.data.rows || []
      if (rows.length === 0) break

      console.log(`  Got ${rows.length} rows (startRow: ${startRow})`)

      // ブランドキーワードを含むクエリのみをフィルタリング
      rows.forEach(row => {
        const query = row.keys[0].toLowerCase()
        const date = row.keys[1]
        const clicks = row.clicks || 0

        // ブランドキーワードのいずれかを含むかチェック
        const isBrandQuery = brandKeywords.some(keyword =>
          query.includes(keyword.toLowerCase())
        )

        if (isBrandQuery) {
          if (!dailyData[date]) {
            dailyData[date] = 0
          }
          dailyData[date] += clicks
        }
      })

      if (rows.length < rowLimit) break
      startRow += rowLimit

      await new Promise(resolve => setTimeout(resolve, 50))
    }

    console.log(`  Total days with brand keyword clicks: ${Object.keys(dailyData).length}`)

    // 統計分析
    const dates = Object.keys(dailyData).sort()
    const clicks = dates.map(date => dailyData[date])

    if (clicks.length === 0) {
      return res.status(200).json({
        statistics: null,
        message: 'ブランドキーワードを含むクエリが見つかりませんでした'
      })
    }

    // 基本統計
    const mean = clicks.reduce((sum, val) => sum + val, 0) / clicks.length
    const variance = clicks.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / clicks.length
    const stdDev = Math.sqrt(variance)
    const cv = (stdDev / mean) * 100

    // 季節性分析（月別）
    const monthlyData = {}
    dates.forEach((date, index) => {
      const month = date.substring(0, 7) // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = []
      }
      monthlyData[month].push(clicks[index])
    })

    const monthlyAvg = Object.keys(monthlyData).map(month => ({
      month,
      avgClicks: Math.round(monthlyData[month].reduce((sum, val) => sum + val, 0) / monthlyData[month].length)
    })).sort((a, b) => a.month.localeCompare(b.month))

    const peakMonth = monthlyAvg.reduce((max, curr) => curr.avgClicks > max.avgClicks ? curr : max, monthlyAvg[0])
    const lowMonth = monthlyAvg.reduce((min, curr) => curr.avgClicks < min.avgClicks ? curr : min, monthlyAvg[0])
    const ratio = peakMonth.avgClicks / lowMonth.avgClicks

    // 曜日パターン分析
    const dowNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
    const dowData = Array(7).fill(0).map(() => [])

    dates.forEach((date, index) => {
      const dow = new Date(date).getDay()
      dowData[dow].push(clicks[index])
    })

    const dowAvg = dowData.map((clicksArray, dow) => ({
      name: dowNames[dow],
      avgClicks: clicksArray.length > 0
        ? Math.round(clicksArray.reduce((sum, val) => sum + val, 0) / clicksArray.length)
        : 0
    }))

    const bestDow = dowAvg.reduce((max, curr) => curr.avgClicks > max.avgClicks ? curr : max, dowAvg[0])
    const worstDow = dowAvg.reduce((min, curr) => curr.avgClicks < min.avgClicks ? curr : min, dowAvg[0])

    // 週末効果（土日 vs 平日）
    const weekendClicks = [...dowData[0], ...dowData[6]].filter(val => val !== undefined)
    const weekdayClicks = [1, 2, 3, 4, 5].flatMap(dow => dowData[dow])

    const weekendAvg = weekendClicks.length > 0
      ? Math.round(weekendClicks.reduce((sum, val) => sum + val, 0) / weekendClicks.length)
      : 0
    const weekdayAvg = weekdayClicks.length > 0
      ? Math.round(weekdayClicks.reduce((sum, val) => sum + val, 0) / weekdayClicks.length)
      : 0
    const weekendEffect = weekdayAvg > 0
      ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
      : 0

    // トレンド分析（線形回帰）
    const n = clicks.length
    const x = Array.from({ length: n }, (_, i) => i)
    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = clicks.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * clicks[i], 0)
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const dailyChange = Math.round(slope * 10) / 10

    let direction = '横ばい'
    if (slope > 0.5) direction = '上昇'
    else if (slope < -0.5) direction = '下降'

    // 期間計算
    const startDateObj = new Date(dates[0])
    const endDateObj = new Date(dates[dates.length - 1])
    const days = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1

    const statistics = {
      period: {
        days,
        start: dates[0],
        end: dates[dates.length - 1]
      },
      basic: {
        mean: Math.round(mean),
        stdDev: Math.round(stdDev * 10) / 10
      },
      cv: Math.round(cv * 10) / 10,
      seasonal: {
        peakMonth,
        lowMonth,
        ratio: Math.round(ratio * 10) / 10,
        monthlyData: monthlyAvg
      },
      weekday: {
        bestDow,
        worstDow,
        weekendEffect,
        weekdayAvg,
        weekendAvg,
        dowData: dowAvg
      },
      trend: {
        direction,
        dailyChange
      }
    }

    res.status(200).json({ statistics })

  } catch (error) {
    console.error('Brand Analysis API Error:', error)
    res.status(500).json({
      error: 'ブランドキーワード分析データの取得に失敗しました',
      details: error.message
    })
  }
}
