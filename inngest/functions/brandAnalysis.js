import { inngest } from '../client.js'
import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import * as stats from 'simple-statistics'

export const brandAnalysis = inngest.createFunction(
  {
    id: 'brand-analysis',
    name: 'Brand Keyword Statistical Analysis'
  },
  { event: 'gsc/brand.analyze' },
  async ({ event, step }) => {
    const {
      siteUrl,
      startDate,
      endDate,
      directories,
      brandKeywords // ['tabirai', 'たびらい', 'タビライ']
    } = event.data

    console.log('Inngest: Brand Analysis started', {
      siteUrl,
      startDate,
      endDate,
      directories,
      brandKeywords
    })

    // Step 1: 認証とAPI準備
    const { searchconsole, genAI } = await step.run('setup-apis', async () => {
      const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
      })

      const searchconsole = google.searchconsole({ version: 'v1', auth })
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

      return { searchconsole, genAI }
    })

    // Step 2: データ取得（バッチ処理）
    const rawData = await step.run('fetch-data', async () => {
      const allRows = []

      // ディレクトリフィルタ設定
      const dimensionFilterGroups = directories && directories.length > 0
        ? [{ filters: [{ dimension: 'page', operator: 'contains', expression: directories[0] }] }]
        : undefined

      // 日付範囲を月単位で分割してバッチ処理
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
      return allRows
    })

    // Step 3: ブランドキーワード分類と日次集計
    const dailyData = await step.run('classify-and-aggregate', async () => {
      // ブランドキーワードに該当するかチェック
      const isBrandQuery = (query) => {
        const lowerQuery = query.toLowerCase()
        return brandKeywords.some(keyword =>
          lowerQuery.includes(keyword.toLowerCase())
        )
      }

      // ブランドクエリのみ抽出
      const brandRows = rawData.filter(row => isBrandQuery(row.keys[0]))

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

      const daily = Object.values(dailyMap)
        .map(d => ({
          date: d.date,
          clicks: d.clicks,
          impressions: d.impressions,
          queryCount: d.queries.size,
          ctr: d.impressions > 0 ? (d.clicks / d.impressions * 100) : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      console.log(`Daily data points: ${daily.length}`)
      return daily
    })

    // Step 4: 統計分析
    const statistics = await step.run('statistical-analysis', async () => {
      if (dailyData.length === 0) {
        return { error: 'No data available for analysis' }
      }

      const clicks = dailyData.map(d => d.clicks)
      const dates = dailyData.map(d => new Date(d.date))

      // 基本統計量
      const basicStats = {
        mean: stats.mean(clicks),
        median: stats.median(clicks),
        stdDev: stats.standardDeviation(clicks),
        variance: stats.variance(clicks),
        min: stats.min(clicks),
        max: stats.max(clicks),
        range: stats.max(clicks) - stats.min(clicks)
      }

      // 変動係数（CV）
      const cv = (basicStats.stdDev / basicStats.mean) * 100

      // 月別集計（季節性）
      const monthlyMap = {}
      dailyData.forEach(d => {
        const month = d.date.substring(0, 7) // YYYY-MM
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

      const monthlyAvgs = monthlyData.map(m => m.avgClicks)
      const peakMonth = monthlyData.reduce((max, m) =>
        m.avgClicks > max.avgClicks ? m : max, monthlyData[0])
      const lowMonth = monthlyData.reduce((min, m) =>
        m.avgClicks < min.avgClicks ? m : min, monthlyData[0])

      // 曜日別集計
      const dowMap = {}
      dailyData.forEach(d => {
        const date = new Date(d.date)
        const dow = date.getDay() // 0=日曜
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

      // トレンド分析（線形回帰）
      const timePoints = dailyData.map((_, i) => i)
      const linearRegression = stats.linearRegression(timePoints.map((x, i) => [x, clicks[i]]))
      const trendSlope = linearRegression.m

      // 相関分析（クリック数 vs 表示回数）
      const impressions = dailyData.map(d => d.impressions)
      const correlation = stats.sampleCorrelation(clicks, impressions)

      return {
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
    })

    // Step 5: AI分析コメント生成
    const aiComment = await step.run('generate-ai-comment', async () => {
      if (statistics.error) {
        return 'データ不足のため分析できませんでした。'
      }

      try {
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
        return result.response.text().trim()
      } catch (error) {
        console.error('Gemini API error:', error)
        return `変動係数${statistics.cv.toFixed(1)}%。${statistics.seasonal.peakMonth.month}月にピーク。${statistics.trend.direction}トレンド。`
      }
    })

    return {
      statistics,
      aiComment,
      dailyData: dailyData.slice(0, 100) // 最新100日分のみ返す
    }
  }
)
