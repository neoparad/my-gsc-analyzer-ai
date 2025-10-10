import { checkBasicAuth } from '../../lib/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
    const { analysisData } = req.body

    if (!analysisData) {
      return res.status(400).json({ error: '分析データは必須です' })
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini APIキーが設定されていません' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Prepare analysis summary
    const summary = prepareAnalysisSummary(analysisData)

    const prompt = `あなたはWebパフォーマンス最適化の専門家です。以下のCSS/JavaScript解析データを分析し、具体的な改善提案を行ってください。

【解析データ】
URL: ${analysisData.url}
ビューポート: ${analysisData.viewport.type} (${analysisData.viewport.width}x${analysisData.viewport.height})

${analysisData.css ? `
CSS分析結果:
- 総サイズ: ${formatBytes(analysisData.css.totalBytes)}
- 使用率: ${analysisData.css.usagePercentage.toFixed(1)}%
- 未使用: ${formatBytes(analysisData.css.unusedBytes)}
- ファイル数: ${analysisData.css.files.length}
- 外部ファイル使用率: ${analysisData.css.external.usagePercentage.toFixed(1)}%
- インライン使用率: ${analysisData.css.inline.usagePercentage.toFixed(1)}%
${analysisData.css.critical ? `- クリティカルCSS: ${analysisData.css.critical.rules}ルール (${formatBytes(analysisData.css.critical.size)})` : ''}

使用率が低いファイルTOP3:
${analysisData.css.files.slice(0, 3).map((f, i) => `${i + 1}. ${f.url.substring(f.url.lastIndexOf('/') + 1)} - 使用率: ${f.usagePercentage.toFixed(1)}% (未使用: ${formatBytes(f.unusedBytes)})`).join('\n')}
` : ''}

${analysisData.js ? `
JavaScript分析結果:
- 総サイズ: ${formatBytes(analysisData.js.totalBytes)}
- 使用率: ${analysisData.js.usagePercentage.toFixed(1)}%
- 未使用: ${formatBytes(analysisData.js.unusedBytes)}
- ファイル数: ${analysisData.js.files.length}
- 外部ファイル使用率: ${analysisData.js.external.usagePercentage.toFixed(1)}%
- インライン使用率: ${analysisData.js.inline.usagePercentage.toFixed(1)}%

使用率が低いファイルTOP3:
${analysisData.js.files.slice(0, 3).map((f, i) => `${i + 1}. ${f.url.substring(f.url.lastIndexOf('/') + 1)} - 使用率: ${f.usagePercentage.toFixed(1)}% (未使用: ${formatBytes(f.unusedBytes)})`).join('\n')}
` : ''}

【出力形式】
以下のJSON形式で、優先度の高い順に3〜5個の改善提案を出力してください。

\`\`\`json
{
  "suggestions": [
    {
      "title": "改善提案のタイトル",
      "priority": "高" | "中" | "低",
      "difficulty": "易" | "中" | "難",
      "category": "遅延読み込み" | "非同期化" | "コード分割" | "クリティカルCSS" | "Tree-shaking" | "圧縮" | "削除",
      "description": "具体的な改善内容の説明（2-3文）",
      "impact": {
        "performance": "パフォーマンスへの影響度（高/中/低）",
        "metrics": ["FCP", "LCP", "TBT"] など改善される指標,
        "estimatedReduction": "削減見込みサイズ（例: 150KB）"
      },
      "implementation": {
        "steps": ["実装手順1", "実装手順2", "実装手順3"],
        "codeExample": "実装コード例（HTMLまたはJavaScript）"
      },
      "beforeAfter": {
        "before": "改善前の状態説明",
        "after": "改善後の期待される状態"
      }
    }
  ],
  "summary": {
    "totalEstimatedReduction": "合計削減見込みサイズ",
    "expectedPerformanceGain": "期待されるパフォーマンス改善度（％）",
    "recommendedOrder": "推奨実装順序の簡潔な説明"
  }
}
\`\`\`

【重要な指示】
- JSON形式のみを出力し、余計な説明文は含めないでください
- 実装コード例は実際に使用可能な具体的なコードを記載してください
- ファイル名やURLは実際の解析データから取得したものを使用してください
- 優先度と難易度は実装の効果とコストを考慮して設定してください
- Core Web Vitalsへの影響を具体的に記載してください`

    console.log('Generating AI diagnosis...')
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log('AI Response length:', text.length)
    console.log('AI Response preview:', text.substring(0, 500))

    // Extract JSON from response
    let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (!jsonMatch) {
      jsonMatch = text.match(/\{[\s\S]*\}/)
    }

    if (!jsonMatch) {
      console.error('Failed to extract JSON from response:', text.substring(0, 1000))
      return res.status(500).json({
        error: 'AI応答からJSONを抽出できませんでした',
        details: 'AI応答形式が期待と異なります',
        responsePreview: text.substring(0, 500)
      })
    }

    let diagnosis
    try {
      const jsonText = jsonMatch[1] || jsonMatch[0]
      console.log('Extracted JSON:', jsonText.substring(0, 500))
      diagnosis = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return res.status(500).json({
        error: 'JSON解析に失敗しました',
        details: parseError.message,
        extractedText: (jsonMatch[1] || jsonMatch[0]).substring(0, 500)
      })
    }

    res.status(200).json({
      diagnosis,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('AI diagnosis error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'AI診断に失敗しました',
      details: error.message,
      type: error.constructor.name
    })
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function prepareAnalysisSummary(data) {
  const summary = {
    url: data.url,
    viewport: data.viewport,
    timestamp: data.timestamp
  }

  if (data.css) {
    summary.css = {
      totalBytes: data.css.totalBytes,
      usagePercentage: data.css.usagePercentage,
      unusedBytes: data.css.unusedBytes,
      fileCount: data.css.files.length,
      lowUsageFiles: data.css.files.filter(f => f.usagePercentage < 50).length
    }
  }

  if (data.js) {
    summary.js = {
      totalBytes: data.js.totalBytes,
      usagePercentage: data.js.usagePercentage,
      unusedBytes: data.js.unusedBytes,
      fileCount: data.js.files.length,
      lowUsageFiles: data.js.files.filter(f => f.usagePercentage < 50).length
    }
  }

  return summary
}
