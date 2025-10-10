import { GoogleGenerativeAI } from '@google/generative-ai'
import { google } from 'googleapis'
import { checkBasicAuth } from '../lib/auth.js'

// Search Consoleからデータを取得
async function getSearchConsoleData(siteUrl, startDate, endDate) {
  // 認証情報の取得
  let credentials
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
  } else {
    const fs = await import('fs')
    const path = await import('path')
    const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  }

  // Google API認証
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  })

  const searchconsole = google.searchconsole({ version: 'v1', auth })

  // データ取得
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 100
    }
  })

  return response.data
}

// ユーザーの質問からSearch Console APIパラメータを判断
async function analyzeQuestion(message, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

  const prompt = `ユーザーの質問を分析して、以下のJSON形式で回答してください:
{
  "needsData": true/false,
  "siteUrl": "https://example.com/",
  "days": 30,
  "action": "summary" or "queries" or "advice"
}

質問例と判断:
- "過去30日のパフォーマンスを教えて" → needsData: true, days: 30, action: "summary"
- "検索順位を上げる方法は？" → needsData: false, action: "advice"

ユーザーの質問: ${message}

JSONのみを返してください。`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // JSONを抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }

  return { needsData: false, action: 'advice' }
}

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
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
    const { message, siteUrl } = req.body

    // Gemini AI初期化
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    // 質問を分析
    const analysis = await analyzeQuestion(message, genAI)

    let searchData = null
    let dataContext = ''

    // Search Consoleデータが必要な場合は取得
    if (analysis.needsData) {
      const targetSiteUrl = siteUrl || analysis.siteUrl || 'sc-domain:tabirai.net'
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - (analysis.days || 30))

      const formatDate = (d) => d.toISOString().split('T')[0]

      try {
        searchData = await getSearchConsoleData(
          targetSiteUrl,
          formatDate(startDate),
          formatDate(endDate)
        )

        // データをサマリー化
        if (searchData.rows && searchData.rows.length > 0) {
          const totalClicks = searchData.rows.reduce((sum, row) => sum + (row.clicks || 0), 0)
          const totalImpressions = searchData.rows.reduce((sum, row) => sum + (row.impressions || 0), 0)
          const avgPosition = searchData.rows.reduce((sum, row) => sum + (row.position || 0), 0) / searchData.rows.length
          const avgCtr = (totalClicks / totalImpressions * 100).toFixed(2)

          const topQueries = searchData.rows.slice(0, 10).map(row => ({
            query: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: (row.ctr * 100).toFixed(2) + '%',
            position: row.position.toFixed(1)
          }))

          dataContext = `
実際のSearch Consoleデータ（過去${analysis.days || 30}日間）:
- サイト: ${targetSiteUrl}
- 期間: ${formatDate(startDate)} ～ ${formatDate(endDate)}
- 総クリック数: ${totalClicks.toLocaleString()}
- 総表示回数: ${totalImpressions.toLocaleString()}
- 平均CTR: ${avgCtr}%
- 平均掲載順位: ${avgPosition.toFixed(1)}位
- 総クエリ数: ${searchData.rows.length.toLocaleString()}

トップ10クエリ:
${topQueries.map((q, i) => `${i + 1}. "${q.query}": ${q.clicks}クリック, ${q.impressions}表示, CTR ${q.ctr}, 順位 ${q.position}`).join('\n')}
`
        }
      } catch (error) {
        console.error('Search Console API Error:', error)
        dataContext = '\n※ Search Consoleデータの取得に失敗しました。一般的なアドバイスを提供します。'
      }
    }

    // Gemini AIで分析・回答生成
    const prompt = `あなたはGoogle Search Consoleの分析エキスパートです。
${dataContext ? 'ユーザーのサイトの実際のデータに基づいて、' : ''}具体的で実用的なアドバイスを提供してください。

${dataContext}

ユーザーの質問: ${message}

回答は日本語で、以下の点を含めてください:
1. データの要約（データがある場合）
2. 具体的な改善提案
3. 次にとるべきアクション

回答:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    res.status(200).json({ response: text })
  } catch (error) {
    console.error('Chat API Error:', error)
    res.status(500).json({
      error: 'チャット処理中にエラーが発生しました',
      details: error.message
    })
  }
}
