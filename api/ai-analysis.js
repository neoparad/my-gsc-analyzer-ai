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
    const { keywords, settings, clusteringResult } = req.body
    const { brandKeywords = [], businessKeywords = [] } = settings || {}

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // 分析対象データ（上昇・下落のみ）
    let validKeywords = keywords.filter(kw =>
      kw.past_position &&
      kw.current_position &&
      typeof kw.change === 'number'
    )

    if (validKeywords.length < 10) {
      return res.status(400).json({
        error: '分析に十分なデータがありません（最低10件必要）',
        count: validKeywords.length
      })
    }

    // パフォーマンスのため最大100件に制限
    if (validKeywords.length > 100) {
      // 変動率の絶対値が大きい順にソート
      validKeywords = validKeywords
        .sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0))
        .slice(0, 100)
    }

    // バッチサイズ（API制限を考慮）
    const batchSize = 50
    const batches = []
    for (let i = 0; i < validKeywords.length; i += batchSize) {
      batches.push(validKeywords.slice(i, i + batchSize))
    }

    // 1. 検索意図分類
    const intentClassification = await analyzeSearchIntent(model, batches, businessKeywords)

    // 2. 自動カテゴリ分類
    const categoryClassification = await analyzeCategories(model, batches, businessKeywords)

    // 3. クラスタ解釈
    const clusterInterpretation = clusteringResult
      ? await interpretClusters(model, clusteringResult, businessKeywords)
      : null

    res.status(200).json({
      intentClassification,
      categoryClassification,
      clusterInterpretation,
      metadata: {
        totalKeywords: validKeywords.length,
        batches: batches.length,
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

// 検索意図分類
async function analyzeSearchIntent(model, batches, businessKeywords) {
  const allResults = {
    informational: { keywords: [], avgChange: 0, count: 0 },
    transactional: { keywords: [], avgChange: 0, count: 0 },
    navigational: { keywords: [], avgChange: 0, count: 0 },
    commercial: { keywords: [], avgChange: 0, count: 0 }
  }

  for (const batch of batches) {
    const keywordList = batch.map(kw => `"${kw.query}": 変動率${kw.change}%`).join('\n')

    const prompt = `以下のキーワードを検索意図別に分類してください。

【除外すべき事業キーワード】
${businessKeywords.join(', ')}

【分析対象キーワード】
${keywordList}

【分類カテゴリ】
1. informational: 情報を探している
2. transactional: 購入・予約したい
3. navigational: 特定サイトに行きたい
4. commercial: 比較検討している

【出力形式】
JSON形式で、以下のように出力してください:
{
  "classifications": [
    {"query": "キーワード", "intent": "informational", "change": 数値},
    ...
  ]
}

JSONのみを返してください。`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.classifications && Array.isArray(parsed.classifications)) {
          parsed.classifications.forEach(item => {
            const intent = item.intent || 'informational'
            if (allResults[intent]) {
              allResults[intent].keywords.push({
                query: item.query,
                change: item.change || 0
              })
              allResults[intent].count++
            }
          })
        }
      }

      // API制限対策（短縮）
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      console.error('Intent analysis batch error:', error)
    }
  }

  // 平均変動率を計算
  Object.keys(allResults).forEach(intent => {
    if (allResults[intent].count > 0) {
      const changes = allResults[intent].keywords.map(k => k.change || 0)
      allResults[intent].avgChange = Math.round(
        changes.reduce((sum, c) => sum + c, 0) / changes.length * 10
      ) / 10
      allResults[intent].keywords = allResults[intent].keywords.slice(0, 10) // Top 10のみ
    }
  })

  return allResults
}

// カテゴリ分類
async function analyzeCategories(model, batches, businessKeywords) {
  const allCategories = new Map()

  for (const batch of batches) {
    const keywordList = batch.map(kw => `"${kw.query}": 変動率${kw.change}%`).join('\n')

    const prompt = `以下のキーワードを、意味的なカテゴリに自動分類してください。

【除外キーワード】
${businessKeywords.join(', ')}

【キーワードリスト】
${keywordList}

【指示】
- 似た意味・ニーズのキーワードをグルーピング
- カテゴリ名は日本語で簡潔に
- 1キーワードは1カテゴリのみ
- カテゴリ数は5-10個程度

【出力形式】
JSON形式で、以下のように出力してください:
{
  "categories": [
    {
      "name": "カテゴリ名",
      "keywords": [
        {"query": "キーワード", "change": 数値},
        ...
      ]
    },
    ...
  ]
}

JSONのみを返してください。`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.categories && Array.isArray(parsed.categories)) {
          parsed.categories.forEach(category => {
            const name = category.name
            if (!allCategories.has(name)) {
              allCategories.set(name, [])
            }
            allCategories.get(name).push(...(category.keywords || []))
          })
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error('Category analysis batch error:', error)
    }
  }

  // カテゴリごとに集計
  const categories = []
  allCategories.forEach((keywords, name) => {
    const changes = keywords.map(k => k.change || 0)
    const avgChange = changes.length > 0
      ? Math.round(changes.reduce((sum, c) => sum + c, 0) / changes.length * 10) / 10
      : 0

    categories.push({
      name,
      count: keywords.length,
      avgChange,
      keywords: keywords.slice(0, 10)
    })
  })

  return categories.sort((a, b) => b.avgChange - a.avgChange)
}

// クラスタ解釈
async function interpretClusters(model, clusteringResult, businessKeywords) {
  const interpretations = []

  for (const cluster of clusteringResult.clusters) {
    const keywordList = cluster.topKeywords
      .map(kw => `"${kw.query}": 変動率${kw.change}%`)
      .join('\n')

    const prompt = `以下のクラスタリング結果に、わかりやすい説明を付けてください。

【クラスタ情報】
- クラスタID: ${cluster.id}
- サイズ: ${cluster.size}件
- 平均変動率: ${cluster.avgChangeRate}%
- 特徴: ${cluster.characteristics}

【含まれるキーワード（上位10件）】
${keywordList}

【除外キーワード】
${businessKeywords.join(', ')}

【指示】
- このクラスタに名前を付ける（20文字以内）
- なぜこれらが同じグループになったか説明（100文字以内）
- ビジネス上の示唆を提示（100文字以内）

【出力形式】
JSON形式で、以下のように出力してください:
{
  "name": "クラスタ名",
  "explanation": "説明",
  "businessInsight": "ビジネス示唆"
}

JSONのみを返してください。`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        interpretations.push({
          clusterId: cluster.id,
          clusterSize: cluster.size,
          avgChangeRate: cluster.avgChangeRate,
          name: parsed.name || `クラスタ${cluster.id}`,
          explanation: parsed.explanation || '',
          businessInsight: parsed.businessInsight || ''
        })
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error('Cluster interpretation error:', error)
      interpretations.push({
        clusterId: cluster.id,
        clusterSize: cluster.size,
        avgChangeRate: cluster.avgChangeRate,
        name: `クラスタ${cluster.id}`,
        explanation: '解釈に失敗しました',
        businessInsight: ''
      })
    }
  }

  return interpretations
}
