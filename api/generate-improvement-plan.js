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
    const { siteData } = req.body

    if (!siteData || !siteData.rawData) {
      return res.status(400).json({ error: 'サイトデータが必要です' })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    console.log('🤖 Generating improvement plan with Gemini...')

    // PageSpeed Insightsの監査項目から重要な課題を抽出
    const audits = siteData.rawData.lighthouseResult.audits
    const issues = []

    // パフォーマンスに影響が大きい項目を優先
    const priorityAudits = [
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'unminified-css',
      'unminified-javascript',
      'uses-text-compression',
      'uses-responsive-images',
      'offscreen-images',
      'efficient-animated-content',
      'legacy-javascript',
      'dom-size',
      'bootup-time',
      'mainthread-work-breakdown',
      'font-display',
      'third-party-summary'
    ]

    for (const auditId of priorityAudits) {
      const audit = audits[auditId]
      if (audit && audit.score !== null && audit.score < 0.9) {
        issues.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue,
          numericValue: audit.numericValue
        })
      }
    }

    console.log(`  → Found ${issues.length} improvement opportunities`)

    // Gemini APIに送信するプロンプト
    const prompt = `あなたはWebサイトのパフォーマンス改善コンサルタントです。以下のPageSpeed Insightsの課題リストについて、それぞれの改善プランをJSON形式の配列で出力してください。

各要素には以下のキーを含めてください：
- "title": 課題のタイトル（日本語）
- "priority": 優先度（"高", "中", "低"のいずれか）
- "impact": 改善インパクト（1-5の整数、5が最大）
- "difficulty": 実装難易度（"易", "中", "難"のいずれか）
- "details": 具体的な改善手順（箇条書き、日本語）
- "code_example": コード例（該当する場合のみ）

# 課題リスト
${issues.map(issue => `
- ID: ${issue.id}
  タイトル: ${issue.title}
  説明: ${issue.description}
  スコア: ${issue.score}
  数値: ${issue.displayValue || 'N/A'}
`).join('\n')}

# 出力フォーマット
JSON配列として出力してください。各要素は上記のキーを持つオブジェクトです。`

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    console.log('  ✓ AI analysis complete')

    // JSONをパース
    let improvementPlan
    try {
      improvementPlan = JSON.parse(text)
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', e)
      return res.status(500).json({
        error: 'AI応答の解析に失敗しました',
        details: e.message
      })
    }

    res.status(200).json({
      improvementPlan,
      issueCount: issues.length
    })

  } catch (error) {
    console.error('Improvement Plan Generation API Error:', error)
    res.status(500).json({
      error: '改善プランの生成に失敗しました',
      details: error.message
    })
  }
}
