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
    const { keyword, keywords, isBatch } = req.body

    // バッチモードの場合
    if (isBatch && keywords && Array.isArray(keywords)) {
      if (keywords.length === 0) {
        return res.status(400).json({ error: 'キーワードは必須です' })
      }

      if (keywords.length > 50) {
        return res.status(400).json({
          error: '一度に処理できるキーワードは最大50個までです',
          max_limit: 50
        })
      }

      console.log(`FAQ Maker Batch: Processing ${keywords.length} keywords`)

      const batchResults = []

      for (const kw of keywords) {
        if (!kw || !kw.trim()) continue

        try {
          console.log(`Processing keyword: "${kw}"`)

          const serpsQuestions = await fetchGooglePAA(kw)
          const braveQuestions = await fetchBraveFAQ(kw)
          const topQuestions = await analyzeAndPrioritizeQuestions(
            kw,
            serpsQuestions,
            braveQuestions
          )
          const questionsWithAnswers = await generateAnswers(kw, topQuestions)

          batchResults.push({
            keyword: kw,
            questions: questionsWithAnswers,
            metadata: {
              serps_count: serpsQuestions.length,
              brave_count: braveQuestions.length,
              total_questions: questionsWithAnswers.length
            }
          })

        } catch (error) {
          console.error(`Error processing keyword "${kw}":`, error)
          batchResults.push({
            keyword: kw,
            error: error.message,
            questions: []
          })
        }
      }

      return res.status(200).json({
        success: true,
        isBatch: true,
        results: batchResults,
        total_keywords: keywords.length,
        successful: batchResults.filter(r => !r.error).length,
        failed: batchResults.filter(r => r.error).length
      })
    }

    // 通常モード（単一キーワード）
    if (!keyword) {
      return res.status(400).json({ error: 'キーワードは必須です' })
    }

    console.log(`FAQ Maker: Analyzing keyword "${keyword}"`)

    // Step 1: Google SERPS APIで関連する質問を取得
    const serpsQuestions = await fetchGooglePAA(keyword)

    // Step 2: BRAVE APIでよくある質問を取得
    const braveQuestions = await fetchBraveFAQ(keyword)

    // Step 3: Gemini AIで質問の統合・優先順位付け・追加質問生成
    const topQuestions = await analyzeAndPrioritizeQuestions(
      keyword,
      serpsQuestions,
      braveQuestions
    )

    // Step 4: 各質問に対してPREP法で回答生成
    const questionsWithAnswers = await generateAnswers(keyword, topQuestions)

    res.status(200).json({
      success: true,
      keyword,
      questions: questionsWithAnswers,
      metadata: {
        serps_count: serpsQuestions.length,
        brave_count: braveQuestions.length,
        total_questions: questionsWithAnswers.length
      }
    })

  } catch (error) {
    console.error('FAQ Maker Error:', error)
    res.status(500).json({
      error: 'FAQ生成に失敗しました',
      details: error.message
    })
  }
}

// Google SERPS APIでPAA（People Also Ask）を取得
async function fetchGooglePAA(keyword) {
  const apiKey = process.env.SERPS_API_KEY
  if (!apiKey) {
    console.warn('SERPS_API_KEY not configured, skipping Google PAA')
    return []
  }

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&engine=google&api_key=${apiKey}&hl=ja&gl=jp`

    const response = await fetch(url)
    if (!response.ok) throw new Error('SERPS API request failed')

    const data = await response.json()

    // "People Also Ask"セクションから質問を抽出
    const paaQuestions = data.related_questions || []

    return paaQuestions.map(item => ({
      question: item.question,
      snippet: item.snippet || '',
      source: 'google_paa'
    }))
  } catch (error) {
    console.error('Google PAA fetch error:', error)
    return []
  }
}

// BRAVE Search APIでよくある質問を取得
async function fetchBraveFAQ(keyword) {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    console.warn('BRAVE_API_KEY not configured, skipping Brave FAQ')
    return []
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(keyword)}&country=JP&search_lang=ja`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    })

    if (!response.ok) throw new Error('Brave API request failed')

    const data = await response.json()

    // FAQセクションから質問を抽出
    const faqItems = data.faq?.results || []

    return faqItems.map(item => ({
      question: item.question,
      answer: item.answer || '',
      source: 'brave_faq'
    }))
  } catch (error) {
    console.error('Brave FAQ fetch error:', error)
    return []
  }
}

// Gemini AIで質問を分析・優先順位付け・追加生成
async function analyzeAndPrioritizeQuestions(keyword, serpsQuestions, braveQuestions) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  const allQuestions = [
    ...serpsQuestions.map(q => q.question),
    ...braveQuestions.map(q => q.question)
  ].filter(Boolean)

  const prompt = `
あなたはSEO専門家です。以下のキーワードに関する質問を分析してください。

【分析キーワード】
${keyword}

【既存の関連質問】
${allQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

以下のタスクを実行してください：

1. 既存の質問を分析し、重複を統合
2. 検索需要が高く、ユーザーにとって価値のある質問を優先
3. 不足している重要な質問を追加生成
4. 最終的に需要の高い順に10個の質問を出力

【出力形式】
質問のみをJSON配列で出力してください。
例: ["質問1", "質問2", "質問3", ...]

重要：
- 質問は簡潔で明確にする
- 1つの質問に対して簡単に回答できる内容
- おすすめリストではなく、具体的な疑問形式
- JSON配列のみを出力（他の説明は不要）
`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response.text()

    // JSONを抽出
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0])
      return questions.slice(0, 10) // 最大10個
    }

    throw new Error('Failed to parse questions from AI response')
  } catch (error) {
    console.error('Question analysis error:', error)
    // フォールバック：既存の質問から上位10個を返す
    return allQuestions.slice(0, 10)
  }
}

// Gemini AIでPREP法の回答を生成
async function generateAnswers(keyword, questions) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
      temperature: 0.8,  // より創造的で自然な表現
      topP: 0.95,
      topK: 40
    }
  })

  const results = []

  for (const question of questions) {
    const prompt = `
あなたは経験豊富なSEOコンテンツライターです。ユーザーが実際に知りたい情報を、親しみやすく自然な言葉で伝えてください。

【メインキーワード】
${keyword}

【質問】
${question}

【タスク】
1. ユーザーの検索意図、感情、カスタマージャーニーを深く理解する（出力不要）
2. PREP法（結論→理由→具体例→結論）の構造で、100～250文字以内で回答
3. 以下の点に注意：
   - 専門用語は避け、誰でも理解できる平易な言葉を使う
   - 硬い表現ではなく、話しかけるような自然な日本語
   - ユーザーが実際に行動できる具体的な情報を含める
   - 必要に応じて表形式で比較情報を提供（必須ではない）

【出力形式】
以下のJSON形式のみを出力：
{
  "answer_text": "自然で読みやすい回答文章",
  "has_table": true/false,
  "table_data": {
    "headers": ["列1", "列2"],
    "rows": [["データ1", "データ2"]]
  }
}

【良い例】
「結論として〜です。なぜなら〜だからです。例えば〜の場合、〜となります。そのため〜がおすすめです。」

【悪い例】
「〜である。〜となる。〜が挙げられる。」（硬い・機械的な表現）
`

    try {
      const result = await model.generateContent(prompt)
      const response = result.response.text()

      // JSONを抽出
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const answerData = JSON.parse(jsonMatch[0])

        results.push({
          question,
          answer: answerData.answer_text,
          has_table: answerData.has_table || false,
          table: answerData.table_data || null
        })
      } else {
        // フォールバック
        results.push({
          question,
          answer: '回答を生成できませんでした',
          has_table: false,
          table: null
        })
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`Answer generation error for "${question}":`, error)
      results.push({
        question,
        answer: 'エラーが発生しました',
        has_table: false,
        table: null
      })
    }
  }

  return results
}
