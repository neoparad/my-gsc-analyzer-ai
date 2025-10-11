import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Gemini AIクライアントを取得
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables')
  }
  return new GoogleGenerativeAI(apiKey)
}

/**
 * サイテーションからトピックを抽出
 * @param {Array<object>} citations - サイテーション配列
 * @returns {Promise<Array<string>>} - 抽出されたトピック配列
 */
export async function extractTopics(citations) {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // サイテーションのコンテキストを結合（最大20件まで）
    const contexts = citations.slice(0, 20).map(c => {
      return `${c.context_before || ''} ${c.citation_text || ''} ${c.context_after || ''}`
    }).join('\n\n')

    const prompt = `以下は、あるウェブサイトに関する言及や被リンクの文脈です。
これらの文脈から、主要なトピックやテーマを5〜10個抽出してください。
トピックは日本語で、簡潔に（1〜3単語程度）表現してください。

【文脈】
${contexts}

【出力形式】
トピックをカンマ区切りで出力してください。
例: SEO対策, コンテンツマーケティング, ウェブ解析, 検索順位, バックリンク

トピック:`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    // カンマ区切りでトピックを分割
    const topics = response.split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .slice(0, 10)

    return topics

  } catch (error) {
    console.error('Topic extraction error:', error)
    return []
  }
}

/**
 * 個別サイテーションのセンチメント分析
 * @param {string} context - サイテーションの文脈
 * @returns {Promise<string>} - 'positive' | 'neutral' | 'negative'
 */
export async function analyzeSentiment(context) {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `以下の文脈について、感情分析を行ってください。
このウェブサイトへの言及が、ポジティブ、ニュートラル、ネガティブのいずれかを判定してください。

【文脈】
${context}

【判定基準】
- ポジティブ: 肯定的、推薦、賞賛、評価が高い
- ニュートラル: 中立的、事実のみの記述、特に感情を含まない
- ネガティブ: 否定的、批判、問題点の指摘

【出力形式】
"positive", "neutral", "negative" のいずれかのみを出力してください。

判定:`

    const result = await model.generateContent(prompt)
    const response = result.response.text().trim().toLowerCase()

    // 'positive', 'neutral', 'negative'のいずれかに正規化
    if (response.includes('positive')) return 'positive'
    if (response.includes('negative')) return 'negative'
    return 'neutral'

  } catch (error) {
    console.error('Sentiment analysis error:', error)
    return 'neutral'
  }
}

/**
 * バッチでセンチメント分析を実行
 * @param {Array<object>} citations - サイテーション配列
 * @param {Function} progressCallback - 進捗コールバック
 * @returns {Promise<Array<object>>} - センチメントが追加されたサイテーション配列
 */
export async function batchAnalyzeSentiment(citations, progressCallback) {
  const results = []
  let processed = 0

  for (const citation of citations) {
    try {
      const context = `${citation.context_before || ''} ${citation.citation_text || ''} ${citation.context_after || ''}`
      const sentiment = await analyzeSentiment(context)

      results.push({
        ...citation,
        sentiment
      })

      processed++
      if (progressCallback) {
        progressCallback(Math.round((processed / citations.length) * 100))
      }

      // API制限対策（500msに短縮）
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error('Sentiment analysis error:', error)
      results.push({
        ...citation,
        sentiment: 'neutral'
      })
    }
  }

  return results
}

/**
 * サイテーショングループのサマリーを生成
 * @param {Array<object>} citations - サイテーション配列
 * @param {string} domain - 対象ドメイン
 * @returns {Promise<object>} - サマリー情報
 */
export async function generateCitationSummary(citations, domain) {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    // 統計情報の準備
    const totalCitations = citations.length
    const linkCount = citations.filter(c => c.citation_type === 'link').length
    const mentionCount = citations.filter(c => c.citation_type === 'mention').length

    // センチメント分布
    const sentimentCounts = {
      positive: citations.filter(c => c.sentiment === 'positive').length,
      neutral: citations.filter(c => c.sentiment === 'neutral').length,
      negative: citations.filter(c => c.sentiment === 'negative').length
    }

    // 主要なソースドメイン
    const sourceDomains = {}
    citations.forEach(c => {
      const domain = c.source_domain || extractDomainFromUrl(c.source_url)
      sourceDomains[domain] = (sourceDomains[domain] || 0) + 1
    })
    const topDomains = Object.entries(sourceDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => `${domain} (${count}件)`)

    // サンプルコンテキストを抽出
    const sampleContexts = citations.slice(0, 10).map(c => {
      return `【${c.citation_type === 'link' ? 'リンク' : '言及'}】${c.source_url}\n${c.context_before || ''} [${c.citation_text}] ${c.context_after || ''}`
    }).join('\n\n')

    const prompt = `${domain} に関するサイテーション（被リンク・言及）分析の結果を要約してください。

【統計情報】
- 総サイテーション数: ${totalCitations}件
- 被リンク: ${linkCount}件
- 言及: ${mentionCount}件
- ポジティブ: ${sentimentCounts.positive}件
- ニュートラル: ${sentimentCounts.neutral}件
- ネガティブ: ${sentimentCounts.negative}件

【主要な参照元ドメイン】
${topDomains.join('\n')}

【サイテーションのサンプル】
${sampleContexts}

【出力内容】
1. 全体的な傾向（2〜3文）
2. 主要なトピック・テーマ（箇条書き）
3. センチメントの解釈（1〜2文）
4. ビジネス上の示唆・推奨アクション（箇条書き）

簡潔にまとめてください。`

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    return {
      summary,
      statistics: {
        total: totalCitations,
        links: linkCount,
        mentions: mentionCount,
        sentiment: sentimentCounts,
        topDomains: topDomains.slice(0, 5)
      }
    }

  } catch (error) {
    console.error('Summary generation error:', error)
    return {
      summary: 'サマリー生成に失敗しました。',
      statistics: {
        total: citations.length,
        links: 0,
        mentions: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        topDomains: []
      }
    }
  }
}

/**
 * 競合比較レポートを生成
 * @param {object} myData - 自社のサイテーションデータ
 * @param {Array<object>} competitorData - 競合のサイテーションデータ配列
 * @returns {Promise<string>} - 比較レポート
 */
export async function generateCompetitorReport(myData, competitorData) {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    const myStats = `【自社: ${myData.domain}】
- 総サイテーション: ${myData.citations.length}件
- 被リンク: ${myData.citations.filter(c => c.citation_type === 'link').length}件
- ポジティブセンチメント: ${myData.citations.filter(c => c.sentiment === 'positive').length}件`

    const competitorStats = competitorData.map(comp => {
      return `【競合: ${comp.domain}】
- 総サイテーション: ${comp.citations.length}件
- 被リンク: ${comp.citations.filter(c => c.citation_type === 'link').length}件
- ポジティブセンチメント: ${comp.citations.filter(c => c.sentiment === 'positive').length}件`
    }).join('\n\n')

    const prompt = `サイテーション（被リンク・言及）の競合比較分析を行ってください。

${myStats}

${competitorStats}

【出力内容】
1. 競合との比較サマリー（3〜4文）
2. 自社の強み・弱み（箇条書き）
3. 改善機会と推奨アクション（箇条書き）

ビジネス担当者向けに、具体的で実行可能な示唆を提供してください。`

    const result = await model.generateContent(prompt)
    return result.response.text()

  } catch (error) {
    console.error('Competitor report generation error:', error)
    return '競合比較レポートの生成に失敗しました。'
  }
}

/**
 * URLからドメインを抽出（ヘルパー関数）
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch (e) {
    return ''
  }
}

/**
 * サイテーションスコアを計算
 * @param {Array<object>} citations - サイテーション配列
 * @returns {number} - スコア（0-100）
 */
export function calculateCitationScore(citations) {
  if (citations.length === 0) return 0

  let score = 0

  // 1. 総サイテーション数（最大40点）
  score += Math.min(citations.length / 10, 40)

  // 2. 被リンク率（最大20点）
  const linkRatio = citations.filter(c => c.citation_type === 'link').length / citations.length
  score += linkRatio * 20

  // 3. ポジティブセンチメント率（最大20点）
  const positiveRatio = citations.filter(c => c.sentiment === 'positive').length / citations.length
  score += positiveRatio * 20

  // 4. ユニークドメイン数（最大20点）
  const uniqueDomains = new Set(citations.map(c => c.source_domain || extractDomainFromUrl(c.source_url)))
  score += Math.min(uniqueDomains.size / 5, 20)

  return Math.round(Math.min(score, 100))
}
