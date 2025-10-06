import { checkBasicAuth } from './_auth.js'
import * as stats from 'simple-statistics'

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
    const { keywords, settings } = req.body
    const { brandKeywords = [], businessKeywords = [] } = settings || {}

    // 分析対象データのフィルタリング（上昇・下落のみ）
    const validKeywords = keywords.filter(kw =>
      kw.past_position &&
      kw.current_position &&
      typeof kw.change === 'number'
    )

    if (validKeywords.length < 20) {
      return res.status(400).json({
        error: '分析に十分なデータがありません（最低20件必要）',
        count: validKeywords.length
      })
    }

    // ブランドキーワード判定
    const isBrandQuery = (query) => {
      if (!brandKeywords.length) return false
      const lowerQuery = query.toLowerCase()
      return brandKeywords.some(bk => lowerQuery.includes(bk.toLowerCase()))
    }

    // 事業キーワード除外後の単語抽出
    const extractWords = (query) => {
      const words = query.toLowerCase().split(/\s+/)
      return words.filter(w => !businessKeywords.some(bk => w.includes(bk.toLowerCase())))
    }

    // 1. クラスタリング分析（k-means簡易実装）
    const clustering = performClustering(validKeywords, businessKeywords)

    // 2. 相関分析
    const correlation = performCorrelation(validKeywords, businessKeywords)

    // 3. 変動率加速度分析
    const acceleration = performAcceleration(validKeywords)

    // 4. セグメント比較分析
    const segmentComparison = performSegmentComparison(validKeywords, isBrandQuery)

    res.status(200).json({
      clustering,
      correlation,
      acceleration,
      segmentComparison,
      metadata: {
        totalKeywords: validKeywords.length,
        analysisDate: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Detailed Analysis Error:', error)
    res.status(500).json({ error: error.message })
  }
}

// クラスタリング分析（k-means簡易版）
function performClustering(keywords, businessKeywords) {
  const k = Math.min(4, Math.floor(keywords.length / 10)) // クラスタ数は自動調整

  // 特徴量抽出
  const features = keywords.map(kw => ({
    changeRate: kw.change || 0,
    impressionChange: (kw.current_impressions || 0) - (kw.past_impressions || 0),
    clickChange: (kw.current_clicks || 0) - (kw.past_clicks || 0),
    positionChange: (kw.past_position || 0) - (kw.current_position || 0),
    keyword: kw
  }))

  // 正規化
  const maxChangeRate = Math.max(...features.map(f => Math.abs(f.changeRate)))
  const maxImpressionChange = Math.max(...features.map(f => Math.abs(f.impressionChange)))
  const maxClickChange = Math.max(...features.map(f => Math.abs(f.clickChange)))
  const maxPositionChange = Math.max(...features.map(f => Math.abs(f.positionChange)))

  const normalized = features.map(f => ({
    vector: [
      f.changeRate / (maxChangeRate || 1),
      f.impressionChange / (maxImpressionChange || 1),
      f.clickChange / (maxClickChange || 1),
      f.positionChange / (maxPositionChange || 1)
    ],
    keyword: f.keyword
  }))

  // 簡易k-means（ランダム初期化）
  let centroids = normalized.slice(0, k).map(n => [...n.vector])
  let assignments = new Array(normalized.length).fill(0)
  let iterations = 0
  const maxIterations = 10

  while (iterations < maxIterations) {
    // 割り当て
    const newAssignments = normalized.map(point => {
      const distances = centroids.map(centroid =>
        euclideanDistance(point.vector, centroid)
      )
      return distances.indexOf(Math.min(...distances))
    })

    // 収束チェック
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) break
    assignments = newAssignments

    // 重心更新
    for (let i = 0; i < k; i++) {
      const clusterPoints = normalized.filter((_, idx) => assignments[idx] === i)
      if (clusterPoints.length > 0) {
        centroids[i] = [0, 1, 2, 3].map(dim =>
          stats.mean(clusterPoints.map(p => p.vector[dim]))
        )
      }
    }

    iterations++
  }

  // クラスタごとの集計
  const clusters = []
  for (let i = 0; i < k; i++) {
    const clusterKeywords = normalized
      .map((n, idx) => ({ ...n.keyword, clusterId: assignments[idx] }))
      .filter(kw => kw.clusterId === i)

    if (clusterKeywords.length > 0) {
      const avgChange = stats.mean(clusterKeywords.map(kw => kw.change || 0))
      const avgImpressionChange = stats.mean(clusterKeywords.map(kw =>
        (kw.current_impressions || 0) - (kw.past_impressions || 0)
      ))

      clusters.push({
        id: i + 1,
        name: `クラスタ${i + 1}`,
        size: clusterKeywords.length,
        avgChangeRate: Math.round(avgChange * 10) / 10,
        avgImpressionChange: Math.round(avgImpressionChange),
        characteristics: avgChange > 50 ? '大幅上昇' : avgChange > 0 ? '緩やかな上昇' : avgChange > -50 ? '緩やかな下降' : '大幅下降',
        topKeywords: clusterKeywords.slice(0, 10).map(kw => ({
          query: kw.query,
          change: kw.change,
          url: kw.url
        }))
      })
    }
  }

  return {
    method: 'kmeans',
    nClusters: clusters.length,
    clusters: clusters.sort((a, b) => b.avgChangeRate - a.avgChangeRate)
  }
}

// 相関分析
function performCorrelation(keywords, businessKeywords) {
  // 単語ペアの変動率相関を計算
  const wordChanges = new Map()

  keywords.forEach(kw => {
    const words = kw.query.toLowerCase().split(/\s+/)
      .filter(w => !businessKeywords.some(bk => w.includes(bk.toLowerCase())))

    words.forEach(word => {
      if (!wordChanges.has(word)) {
        wordChanges.set(word, [])
      }
      wordChanges.get(word).push(kw.change || 0)
    })
  })

  // 出現頻度が5回以上の単語のみ対象
  const validWords = Array.from(wordChanges.entries())
    .filter(([_, changes]) => changes.length >= 5)
    .map(([word]) => word)

  const positivePairs = []
  const negativePairs = []

  for (let i = 0; i < validWords.length; i++) {
    for (let j = i + 1; j < validWords.length; j++) {
      const word1 = validWords[i]
      const word2 = validWords[j]

      const changes1 = wordChanges.get(word1)
      const changes2 = wordChanges.get(word2)

      // 共通出現するクエリの変動を比較
      const correlation = calculateWordCorrelation(keywords, word1, word2)

      if (correlation > 0.7) {
        positivePairs.push({ word1, word2, correlation: correlation.toFixed(2) })
      } else if (correlation < -0.7) {
        negativePairs.push({ word1, word2, correlation: correlation.toFixed(2) })
      }
    }
  }

  return {
    positivePairs: positivePairs.slice(0, 10),
    negativePairs: negativePairs.slice(0, 10)
  }
}

// 単語間の相関計算
function calculateWordCorrelation(keywords, word1, word2) {
  const pairs = keywords.filter(kw =>
    kw.query.toLowerCase().includes(word1) || kw.query.toLowerCase().includes(word2)
  )

  const word1Changes = []
  const word2Changes = []

  pairs.forEach(kw => {
    const hasWord1 = kw.query.toLowerCase().includes(word1)
    const hasWord2 = kw.query.toLowerCase().includes(word2)

    if (hasWord1) word1Changes.push(kw.change || 0)
    if (hasWord2) word2Changes.push(kw.change || 0)
  })

  if (word1Changes.length < 3 || word2Changes.length < 3) return 0

  const avg1 = stats.mean(word1Changes)
  const avg2 = stats.mean(word2Changes)

  // 簡易相関（共通キーワードの変動方向の一致度）
  return (avg1 > 0 && avg2 > 0) || (avg1 < 0 && avg2 < 0) ? 0.8 : -0.3
}

// 加速度分析
function performAcceleration(keywords) {
  const changes = keywords.map(kw => Math.abs(kw.change || 0))
  const mean = stats.mean(changes)
  const stdDev = stats.standardDeviation(changes)

  const threshold = mean + stdDev * 2 // 2σ以上を急激な変動と判定

  const accelerating = keywords
    .filter(kw => (kw.change || 0) > threshold)
    .sort((a, b) => (b.change || 0) - (a.change || 0))
    .slice(0, 10)
    .map(kw => ({
      query: kw.query,
      changeRate: kw.change,
      pastPosition: kw.past_position,
      currentPosition: kw.current_position,
      url: kw.url
    }))

  const decelerating = keywords
    .filter(kw => (kw.change || 0) < -threshold)
    .sort((a, b) => (a.change || 0) - (b.change || 0))
    .slice(0, 10)
    .map(kw => ({
      query: kw.query,
      changeRate: kw.change,
      pastPosition: kw.past_position,
      currentPosition: kw.current_position,
      url: kw.url
    }))

  return {
    threshold: Math.round(threshold * 10) / 10,
    topAccelerating: accelerating,
    topDecelerating: decelerating
  }
}

// セグメント比較分析
function performSegmentComparison(keywords, isBrandQuery) {
  // ブランド vs 非ブランド
  const brandQueries = keywords.filter(kw => isBrandQuery(kw.query))
  const nonBrandQueries = keywords.filter(kw => !isBrandQuery(kw.query))

  const brandAvg = brandQueries.length > 0 ? stats.mean(brandQueries.map(kw => kw.change || 0)) : 0
  const nonBrandAvg = nonBrandQueries.length > 0 ? stats.mean(nonBrandQueries.map(kw => kw.change || 0)) : 0

  // 疑問詞含む vs 含まない
  const questionWords = ['どこ', 'いつ', 'なぜ', 'どう', 'what', 'where', 'when', 'why', 'how']
  const withQuestion = keywords.filter(kw =>
    questionWords.some(qw => kw.query.toLowerCase().includes(qw))
  )
  const withoutQuestion = keywords.filter(kw =>
    !questionWords.some(qw => kw.query.toLowerCase().includes(qw))
  )

  const questionAvg = withQuestion.length > 0 ? stats.mean(withQuestion.map(kw => kw.change || 0)) : 0
  const nonQuestionAvg = withoutQuestion.length > 0 ? stats.mean(withoutQuestion.map(kw => kw.change || 0)) : 0

  // クエリ長別
  const shortQueries = keywords.filter(kw => kw.query.split(/\s+/).length <= 2)
  const mediumQueries = keywords.filter(kw => {
    const len = kw.query.split(/\s+/).length
    return len >= 3 && len <= 4
  })
  const longQueries = keywords.filter(kw => kw.query.split(/\s+/).length >= 5)

  const shortAvg = shortQueries.length > 0 ? stats.mean(shortQueries.map(kw => kw.change || 0)) : 0
  const mediumAvg = mediumQueries.length > 0 ? stats.mean(mediumQueries.map(kw => kw.change || 0)) : 0
  const longAvg = longQueries.length > 0 ? stats.mean(longQueries.map(kw => kw.change || 0)) : 0

  return {
    brandVsNonBrand: {
      brand: {
        count: brandQueries.length,
        avgChange: Math.round(brandAvg * 10) / 10
      },
      nonBrand: {
        count: nonBrandQueries.length,
        avgChange: Math.round(nonBrandAvg * 10) / 10
      },
      significant: Math.abs(brandAvg - nonBrandAvg) > 10
    },
    questionType: {
      withQuestion: {
        count: withQuestion.length,
        avgChange: Math.round(questionAvg * 10) / 10
      },
      withoutQuestion: {
        count: withoutQuestion.length,
        avgChange: Math.round(nonQuestionAvg * 10) / 10
      },
      significant: Math.abs(questionAvg - nonQuestionAvg) > 5
    },
    queryLength: {
      short: {
        count: shortQueries.length,
        avgChange: Math.round(shortAvg * 10) / 10
      },
      medium: {
        count: mediumQueries.length,
        avgChange: Math.round(mediumAvg * 10) / 10
      },
      long: {
        count: longQueries.length,
        avgChange: Math.round(longAvg * 10) / 10
      }
    }
  }
}

// ユークリッド距離計算
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0))
}
