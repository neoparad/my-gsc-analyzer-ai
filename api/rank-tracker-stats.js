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
    const { queries } = req.body

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'クエリデータが必要です' })
    }

    // 1. 時系列トレンド分析
    const trendAnalysis = calculateTrendAnalysis(queries)

    // 2. 順位変動の統計的特徴
    const volatilityAnalysis = calculateVolatilityAnalysis(queries)

    // 3. クエリ間の相関分析
    const correlationAnalysis = calculateCorrelationAnalysis(queries)

    // 4. 予測モデリング
    const predictionAnalysis = calculatePredictionAnalysis(queries)

    res.status(200).json({
      trendAnalysis,
      volatilityAnalysis,
      correlationAnalysis,
      predictionAnalysis,
      metadata: {
        totalQueries: queries.length,
        analysisDate: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Statistical Analysis Error:', error)
    res.status(500).json({
      error: '統計分析中にエラーが発生しました',
      details: error.message
    })
  }
}

// 1. 時系列トレンド分析
function calculateTrendAnalysis(queries) {
  const results = []

  queries.forEach(q => {
    const history = q.history
    const dates = Object.keys(history).sort()
    const positions = dates.map(d => history[d])

    if (positions.length < 7) return

    // 移動平均線（7日、14日、30日）
    const ma7 = calculateMovingAverage(positions, 7)
    const ma14 = calculateMovingAverage(positions, 14)
    const ma30 = calculateMovingAverage(positions, 30)

    // 変化点検出（順位が大きく変動した日）
    const changePoints = detectChangePoints(positions, dates)

    results.push({
      query: q.query,
      movingAverages: {
        ma7: ma7[ma7.length - 1],
        ma14: ma14[ma14.length - 1],
        ma30: ma30[ma30.length - 1]
      },
      changePoints,
      trend: ma7[ma7.length - 1] < ma7[0] ? 'improving' : 'declining'
    })
  })

  return results
}

// 移動平均計算
function calculateMovingAverage(data, window) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null)
    } else {
      const slice = data.slice(i - window + 1, i + 1)
      result.push(slice.reduce((a, b) => a + b, 0) / window)
    }
  }
  return result
}

// 変化点検出
function detectChangePoints(positions, dates) {
  const changePoints = []
  for (let i = 1; i < positions.length; i++) {
    const change = positions[i] - positions[i - 1]
    if (Math.abs(change) > 10) { // 10位以上の変動
      changePoints.push({
        date: dates[i],
        change,
        from: positions[i - 1],
        to: positions[i]
      })
    }
  }
  return changePoints
}

// 2. ボラティリティ分析
function calculateVolatilityAnalysis(queries) {
  const results = []

  queries.forEach(q => {
    const positions = Object.values(q.history).filter(p => p !== null)
    if (positions.length < 2) return

    // 加速度・減速度（1次微分と2次微分）
    const velocities = []
    const accelerations = []

    for (let i = 1; i < positions.length; i++) {
      velocities.push(positions[i] - positions[i - 1])
    }

    for (let i = 1; i < velocities.length; i++) {
      accelerations.push(velocities[i] - velocities[i - 1])
    }

    // ボラティリティ指数（標準偏差）
    const mean = positions.reduce((a, b) => a + b, 0) / positions.length
    const variance = positions.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / positions.length
    const volatility = Math.sqrt(variance)

    results.push({
      query: q.query,
      volatilityIndex: volatility,
      avgVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
      avgAcceleration: accelerations.length > 0 ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length : 0
    })
  })

  return results.sort((a, b) => b.volatilityIndex - a.volatilityIndex)
}

// 3. 相関分析
function calculateCorrelationAnalysis(queries) {
  // 最大100クエリまで（計算量削減）
  const limitedQueries = queries.slice(0, 100)
  const correlationPairs = []

  for (let i = 0; i < limitedQueries.length; i++) {
    for (let j = i + 1; j < limitedQueries.length; j++) {
      const q1 = limitedQueries[i]
      const q2 = limitedQueries[j]

      // 共通の日付のみで相関計算
      const commonDates = Object.keys(q1.history).filter(d => q2.history[d] !== undefined)
      if (commonDates.length < 5) continue

      const values1 = commonDates.map(d => q1.history[d])
      const values2 = commonDates.map(d => q2.history[d])

      const correlation = calculatePearsonCorrelation(values1, values2)

      if (Math.abs(correlation) > 0.7) { // 強い相関のみ
        correlationPairs.push({
          query1: q1.query,
          query2: q2.query,
          correlation: correlation.toFixed(3)
        })
      }
    }
  }

  return correlationPairs.slice(0, 20) // Top 20
}

// ピアソン相関係数
function calculatePearsonCorrelation(x, y) {
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))

  return denominator === 0 ? 0 : numerator / denominator
}

// 4. 予測モデリング
function calculatePredictionAnalysis(queries) {
  const results = []

  queries.forEach(q => {
    const dates = Object.keys(q.history).sort()
    const positions = dates.map(d => q.history[d])

    if (positions.length < 14) return

    // 線形回帰で予測
    const x = positions.map((_, i) => i)
    const y = positions

    const { slope, intercept } = linearRegression(x, y)

    // 7日後の予測
    const nextX = positions.length
    const prediction = slope * nextX + intercept

    // 信頼区間計算（簡易版）
    const residuals = positions.map((yi, i) => yi - (slope * i + intercept))
    const stdError = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / (positions.length - 2))
    const confidenceInterval = 1.96 * stdError // 95%信頼区間

    results.push({
      query: q.query,
      currentPosition: positions[positions.length - 1],
      predicted7Days: prediction,
      confidenceIntervalLower: prediction - confidenceInterval,
      confidenceIntervalUpper: prediction + confidenceInterval,
      trend: slope < 0 ? 'improving' : 'declining'
    })
  })

  return results
}

// 線形回帰
function linearRegression(x, y) {
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}
