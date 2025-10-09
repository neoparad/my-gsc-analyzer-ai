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
    const {
      siteUrl,
      startDate,
      endDate,
      directories = [],
      brandKeywords = [],
      campaigns = [],
      viewMode = 'daily',
      enableAdsAnalysis = false,
      customerId,
      selectedCampaignIds = []
    } = req.body

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

    // Google Ads データ取得（オプション）
    let adsData = {}
    if (enableAdsAnalysis && customerId) {
      try {
        const { GoogleAdsApi } = await import('google-ads-api')

        const clientConfig = {
          client_id: process.env.GOOGLE_ADS_CLIENT_ID,
          client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
          developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN
        }
        const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN

        if (clientConfig.client_id && clientConfig.client_secret && clientConfig.developer_token && refreshToken) {
          const client = new GoogleAdsApi({
            ...clientConfig,
            refresh_token: refreshToken
          })

          const customer = client.Customer({
            customer_id: customerId.replace(/-/g, ''),
            refresh_token: refreshToken
          })

          // キャンペーンフィルター条件
          let campaignFilter = ''
          if (selectedCampaignIds.length > 0) {
            const campaignIdList = selectedCampaignIds.join(',')
            campaignFilter = `AND campaign.id IN (${campaignIdList})`
          }

          // 日次の広告データを取得
          const adQuery = `
            SELECT
              segments.date,
              ad_group_criterion.keyword.text,
              metrics.clicks
            FROM keyword_view
            WHERE
              campaign.status = 'ENABLED'
              AND ad_group.status = 'ENABLED'
              AND ad_group_criterion.status IN ('ENABLED', 'PAUSED')
              AND segments.date BETWEEN '${startDate}' AND '${endDate}'
              ${campaignFilter}
            ORDER BY segments.date ASC
          `

          console.log('Fetching Google Ads data with query:', adQuery)

          const adResponse = await customer.query(adQuery)

          // ブランドキーワードを含む広告のクリック数を集計
          adResponse.forEach(row => {
            const keyword = (row.ad_group_criterion?.keyword?.text || '').toLowerCase()
            const date = row.segments.date
            const clicks = parseInt(row.metrics.clicks) || 0

            const isBrandQuery = brandKeywords.some(bk =>
              keyword.includes(bk.toLowerCase())
            )

            if (isBrandQuery) {
              if (!adsData[date]) {
                adsData[date] = 0
              }
              adsData[date] += clicks
            }
          })

          console.log(`  Got ad data for ${Object.keys(adsData).length} days`)
        }
      } catch (adError) {
        console.error('Google Ads API Error (non-fatal):', adError.message)
        // 広告データ取得失敗は致命的エラーではないので続行
      }
    }

    // 推移データの生成
    const trendData = []

    if (viewMode === 'daily') {
      // 日別データ
      dates.forEach((date, index) => {
        const dataPoint = {
          period: date,
          seoClicks: dailyData[date] || 0
        }

        if (enableAdsAnalysis && Object.keys(adsData).length > 0) {
          dataPoint.adClicks = adsData[date] || 0
        }

        // キャンペーン実施中かチェック
        if (campaigns.length > 0) {
          const isInCampaign = campaigns.some(c =>
            date >= c.startDate && date <= c.endDate
          )
          dataPoint.campaignActive = isInCampaign ? 1 : 0
        }

        trendData.push(dataPoint)
      })
    } else {
      // 月別データ
      const monthlyTrend = {}
      const monthlyAds = {}
      const monthlyCampaigns = new Set()

      dates.forEach((date, index) => {
        const month = date.substring(0, 7)
        if (!monthlyTrend[month]) {
          monthlyTrend[month] = 0
        }
        monthlyTrend[month] += dailyData[date] || 0

        if (enableAdsAnalysis && adsData[date]) {
          if (!monthlyAds[month]) {
            monthlyAds[month] = 0
          }
          monthlyAds[month] += adsData[date]
        }

        if (campaigns.length > 0) {
          const isInCampaign = campaigns.some(c =>
            date >= c.startDate && date <= c.endDate
          )
          if (isInCampaign) {
            monthlyCampaigns.add(month)
          }
        }
      })

      Object.keys(monthlyTrend).sort().forEach(month => {
        const dataPoint = {
          period: month,
          seoClicks: monthlyTrend[month]
        }

        if (enableAdsAnalysis) {
          dataPoint.adClicks = monthlyAds[month] || 0
        }

        if (campaigns.length > 0) {
          dataPoint.campaignActive = monthlyCampaigns.has(month) ? 1 : 0
        }

        trendData.push(dataPoint)
      })
    }

    // 変化要因分析
    const changeFactors = {
      trend: {
        type: direction,
        strength: Math.abs(dailyChange),
        description: `${direction === '上昇' ? '+' : direction === '下降' ? '-' : ''}${Math.abs(dailyChange).toFixed(1)}クリック/日の${direction}トレンド`
      },
      seasonality: {
        hasSeasonality: ratio > 1.5,
        peakMonth: peakMonth.month,
        lowMonth: lowMonth.month,
        ratio: ratio.toFixed(1),
        description: ratio > 1.5
          ? `季節性あり（${peakMonth.month}がピーク、${lowMonth.month}が低調）`
          : '季節性は弱い'
      },
      weekdayEffect: {
        hasWeekdayEffect: Math.abs(weekendEffect) > 10,
        bestDay: bestDow.name,
        worstDay: worstDow.name,
        weekendEffect: `${weekendEffect > 0 ? '+' : ''}${weekendEffect}%`,
        description: Math.abs(weekendEffect) > 10
          ? `曜日効果あり（週末は平日比${weekendEffect > 0 ? '+' : ''}${weekendEffect}%）`
          : '曜日による差は小さい'
      }
    }

    if (enableAdsAnalysis && Object.keys(adsData).length > 0) {
      // 広告影響分析
      const seoClicksArray = trendData.map(d => d.seoClicks)
      const adClicksArray = trendData.map(d => d.adClicks || 0)

      // 相関係数を計算
      const seoMean = seoClicksArray.reduce((sum, val) => sum + val, 0) / seoClicksArray.length
      const adMean = adClicksArray.reduce((sum, val) => sum + val, 0) / adClicksArray.length

      let covariance = 0
      let seoVariance = 0
      let adVariance = 0

      for (let i = 0; i < seoClicksArray.length; i++) {
        const seoDiff = seoClicksArray[i] - seoMean
        const adDiff = adClicksArray[i] - adMean
        covariance += seoDiff * adDiff
        seoVariance += seoDiff * seoDiff
        adVariance += adDiff * adDiff
      }

      const correlation = covariance / Math.sqrt(seoVariance * adVariance)

      changeFactors.adsImpact = {
        hasImpact: correlation < -0.3,
        correlation: correlation.toFixed(2),
        description: correlation < -0.3
          ? `広告がSEOを圧迫している可能性あり（相関係数: ${correlation.toFixed(2)}）`
          : correlation > 0.3
          ? `広告とSEOが相乗効果を発揮（相関係数: ${correlation.toFixed(2)}）`
          : '広告の影響は限定的'
      }
    }

    if (campaigns.length > 0) {
      // キャンペーン影響分析
      const campaignPeriods = trendData.filter(d => d.campaignActive === 1)
      const nonCampaignPeriods = trendData.filter(d => d.campaignActive === 0)

      if (campaignPeriods.length > 0 && nonCampaignPeriods.length > 0) {
        const campaignAvg = campaignPeriods.reduce((sum, d) => sum + d.seoClicks, 0) / campaignPeriods.length
        const nonCampaignAvg = nonCampaignPeriods.reduce((sum, d) => sum + d.seoClicks, 0) / nonCampaignPeriods.length
        const campaignEffect = ((campaignAvg - nonCampaignAvg) / nonCampaignAvg) * 100

        changeFactors.campaignImpact = {
          hasImpact: Math.abs(campaignEffect) > 10,
          effect: campaignEffect.toFixed(1),
          description: Math.abs(campaignEffect) > 10
            ? `キャンペーン実施時は通常比${campaignEffect > 0 ? '+' : ''}${campaignEffect.toFixed(1)}%`
            : 'キャンペーンの影響は限定的'
        }
      }
    }

    res.status(200).json({
      statistics,
      trendData,
      changeFactors,
      campaigns,
      viewMode,
      hasAdsData: enableAdsAnalysis && Object.keys(adsData).length > 0
    })

  } catch (error) {
    console.error('Brand Analysis API Error:', error)
    res.status(500).json({
      error: 'ブランドキーワード分析データの取得に失敗しました',
      details: error.message
    })
  }
}
