import { GoogleGenerativeAI } from '@google/generative-ai'
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
    const { queries, siteUrl } = req.body

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'クエリデータが必要です' })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // 分析対象データを準備（最大50件に制限）
    const limitedQueries = queries.slice(0, 50)

    // 1. 順位変動の要因推定
    const factorAnalysis = await analyzeRankingFactors(model, limitedQueries, siteUrl)

    // 2. 検索意図の深掘り分析
    const intentAnalysis = await analyzeSearchIntent(model, limitedQueries)

    // 3. クエリポートフォリオ分析
    const portfolioAnalysis = await analyzeQueryPortfolio(model, limitedQueries)

    // 4. 自然言語インサイト生成
    const insights = await generateInsights(model, limitedQueries, siteUrl)

    res.status(200).json({
      factorAnalysis,
      intentAnalysis,
      portfolioAnalysis,
      insights,
      metadata: {
        totalQueries: queries.length,
        analyzedQueries: limitedQueries.length,
        analysisDate: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('AI Analysis Error:', error)
    res.status(500).json({
      error: 'AI分析中にエラーが発生しました',
      details: error.message
    })
  }
}

// 1. 順位変動の要因推定
async function analyzeRankingFactors(model, queries, siteUrl) {
  const queryData = queries.map(q => {
    const dates = Object.keys(q.history).sort()
    const positions = dates.map(d => q.history[d])
    const change = positions.length >= 2 ? positions[positions.length - 1] - positions[0] : 0

    return {
      query: q.query,
      change,
      currentPosition: q.currentPosition
    }
  })

  const prompt = `以下のサイト（${siteUrl}）の検索順位データを分析し、順位変動の主な要因を推定してください。

【クエリと順位変動】
${queryData.map(q => `- "${q.query}": 変動 ${q.change > 0 ? '+' : ''}${q.change.toFixed(1)}位（現在${q.currentPosition}位）`).join('\n')}

以下の観点から分析してください:
1. Googleアルゴリズム更新の影響可能性
2. 季節要因・イベント要因
3. コンテンツ品質の変化
4. 競合サイトの動向

JSON形式で出力してください:
{
  "algorithmImpact": "アルゴリズム更新の影響評価",
  "seasonalFactors": "季節要因の分析",
  "contentQuality": "コンテンツ品質に関する仮説",
  "competitorImpact": "競合影響の評価"
}

JSONのみを返してください。`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (error) {
    console.error('Factor analysis error:', error)
    return null
  }
}

// 2. 検索意図の深掘り分析
async function analyzeSearchIntent(model, queries) {
  const queryList = queries.slice(0, 30).map(q => q.query).join('\n')

  const prompt = `以下のクエリリストを検索意図別に分類し、それぞれの順位変動傾向を分析してください。

【クエリリスト】
${queryList}

以下の検索意図カテゴリで分類:
- 情報型（Informational）: 情報を探している
- 取引型（Transactional）: 購入・予約したい
- ナビゲーション型（Navigational）: 特定サイトに行きたい
- 商業型（Commercial）: 比較検討している

JSON形式で出力してください:
{
  "intentDistribution": {
    "informational": "情報型の割合と傾向",
    "transactional": "取引型の割合と傾向",
    "navigational": "ナビゲーション型の割合と傾向",
    "commercial": "商業型の割合と傾向"
  },
  "recommendations": "各意図に対する改善提案"
}

JSONのみを返してください。`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (error) {
    console.error('Intent analysis error:', error)
    return null
  }
}

// 3. クエリポートフォリオ分析
async function analyzeQueryPortfolio(model, queries) {
  const portfolioData = queries.map(q => {
    const positions = Object.values(q.history).filter(p => p !== null)
    const avg = positions.reduce((a, b) => a + b, 0) / positions.length
    const stdDev = Math.sqrt(positions.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / positions.length)

    return {
      query: q.query,
      avgPosition: avg,
      stability: stdDev
    }
  })

  const prompt = `以下のクエリデータを「成長株」「安定株」「低迷株」に分類してください。

【クエリデータ】
${portfolioData.slice(0, 20).map(q => `- "${q.query}": 平均順位${q.avgPosition.toFixed(1)}、安定性${q.stability.toFixed(1)}`).join('\n')}

分類基準:
- 成長株: 順位が上昇傾向で、今後の成長が期待できる
- 安定株: 順位が安定しており、維持すべき
- 低迷株: 順位が低迷または下降傾向で、改善が必要

JSON形式で出力してください:
{
  "growthQueries": ["成長株クエリリスト"],
  "stableQueries": ["安定株クエリリスト"],
  "decliningQueries": ["低迷株クエリリスト"],
  "strategy": "ポートフォリオ戦略の提案"
}

JSONのみを返してください。`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch (error) {
    console.error('Portfolio analysis error:', error)
    return null
  }
}

// 4. 自然言語インサイト生成
async function generateInsights(model, queries, siteUrl) {
  const insights = []

  // 上位3クエリの詳細インサイト
  const topQueries = queries
    .filter(q => Object.keys(q.history).length >= 7)
    .slice(0, 3)

  for (const q of topQueries) {
    const dates = Object.keys(q.history).sort()
    const positions = dates.map(d => q.history[d])
    const change = positions[positions.length - 1] - positions[0]

    const prompt = `以下のクエリについて、自然言語で洞察を生成してください。

クエリ: "${q.query}"
サイト: ${siteUrl}
期間: ${dates.length}日間
変動: ${change > 0 ? '+' : ''}${change.toFixed(1)}位
現在順位: ${q.currentPosition}位

以下の形式で1-2文で簡潔に:
「このクエリは過去${dates.length}日で${Math.abs(change).toFixed(1)}位${change > 0 ? '上昇' : '下落'}。[検索意図の分類]で[安定性評価]。[今後の展望や推奨アクション]」

JSONは不要。自然な日本語文のみを返してください。`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      insights.push({
        query: q.query,
        insight: text
      })

      // API制限対策
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error('Insight generation error:', error)
    }
  }

  return insights
}
