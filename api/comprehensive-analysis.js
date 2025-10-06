import { GoogleGenerativeAI } from '@google/generative-ai'
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
    const { pageSpeedData, deepAnalysisData } = req.body

    if (!pageSpeedData || !deepAnalysisData) {
      return res.status(400).json({ error: 'PageSpeedデータとDeep Analysisデータが必要です' })
    }

    console.log('🤖 Generating comprehensive improvement items with AI...')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    // PageSpeed Insightsのデータから課題を抽出
    const audits = pageSpeedData.lighthouseResult.audits
    const categories = pageSpeedData.lighthouseResult.categories

    // Puppeteerから取得した詳細データ
    const { coverage, images, dom, stylesheets, scripts } = deepAnalysisData.analysis

    // AIに送るプロンプトを構築
    const prompt = `あなたはWebパフォーマンス最適化の専門家です。以下のPageSpeed InsightsとブラウザからのDeep Analysis結果を総合的に分析し、具体的な改善項目リストを作成してください。

# PageSpeed Insights スコア
- Performance: ${Math.round((categories.performance?.score || 0) * 100)}
- Accessibility: ${Math.round((categories.accessibility?.score || 0) * 100)}
- Best Practices: ${Math.round((categories['best-practices']?.score || 0) * 100)}
- SEO: ${Math.round((categories.seo?.score || 0) * 100)}

# Deep Analysis結果
## DOM構造
- 総ノード数: ${dom.totalNodes}
- DOM深度: ${dom.depth}
- 画像数: ${dom.images}

## CSSカバレッジ（未使用CSS）
${coverage.css.map(c => `- ${c.url}: ${c.usedPercentage}% 使用済み (未使用: ${(c.unusedBytes / 1024).toFixed(2)}KB)`).join('\n').substring(0, 500)}

## JavaScriptカバレッジ（未使用JS）
${coverage.js.map(j => `- ${j.url}: ${j.usedPercentage}% 使用済み (未使用: ${(j.unusedBytes / 1024).toFixed(2)}KB)`).join('\n').substring(0, 500)}

## 画像情報
${images.slice(0, 10).map(img => `- ${img.src}: ${img.width}x${img.height} (表示: ${img.displayWidth}x${img.displayHeight}), フォーマット: ${img.format}`).join('\n')}

## PageSpeed主要課題
${Object.entries(audits)
  .filter(([_, audit]) => audit.score !== null && audit.score < 0.9)
  .slice(0, 15)
  .map(([id, audit]) => `- ${audit.title}: スコア ${(audit.score * 100).toFixed(0)} - ${audit.description}`)
  .join('\n')}

# 出力フォーマット
以下のJSON配列形式で、優先度の高い改善項目から順に出力してください：

\`\`\`json
[
  {
    "id": "unique-id",
    "title": "改善項目のタイトル",
    "category": "CSS" | "JavaScript" | "画像" | "HTML" | "フォント" | "その他",
    "priority": "高" | "中" | "低",
    "difficulty": "易" | "中" | "難",
    "impact": 1-5の数値（5が最大のインパクト）,
    "estimatedImprovement": "予想される改善効果（例: LCP 0.5秒改善）",
    "summary": "改善内容の要約（1-2文）",
    "technicalDetails": {
      "targetFiles": ["対象ファイルのURL"],
      "currentState": "現在の状態",
      "specificIssue": "具体的な問題点"
    }
  }
]
\`\`\`

重要：
- 実際のファイルURL、サイズ、数値データを使用してください
- 優先度は影響度と実装難易度を考慮してください
- 上位10-15項目程度に絞ってください
- 各項目は実装可能な具体的な内容にしてください`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log('  ✓ AI analysis complete')

    // JSONをパース
    let improvementItems
    try {
      improvementItems = JSON.parse(text)
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e)
      return res.status(500).json({
        error: 'AI応答の解析に失敗しました',
        details: e.message
      })
    }

    res.status(200).json({
      improvementItems,
      summary: {
        totalItems: improvementItems.length,
        highPriority: improvementItems.filter(item => item.priority === '高').length,
        categories: [...new Set(improvementItems.map(item => item.category))]
      }
    })

  } catch (error) {
    console.error('Comprehensive Analysis API Error:', error)
    res.status(500).json({
      error: '総合分析に失敗しました',
      details: error.message
    })
  }
}
