import { checkBasicAuth } from '../lib/auth.js'
import { getSupabaseClient } from '../lib/supabase.js'
import { generateCitationSummary } from '../lib/citation-ai.js'

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { user_id, domain } = req.method === 'GET' ? req.query : req.body

    if (!user_id || !domain) {
      res.status(400).json({ error: 'user_id and domain are required' })
      return
    }

    const supabase = getSupabaseClient()

    // サイテーションデータを取得
    const { data: citations, error: citationsError } = await supabase
      .from('citations')
      .select('*')
      .eq('user_id', user_id)
      .eq('domain', domain)
      .order('crawl_date', { ascending: false })

    if (citationsError) {
      console.error('Error fetching citations:', citationsError)
      res.status(500).json({ error: 'Failed to fetch citations' })
      return
    }

    if (!citations || citations.length === 0) {
      res.status(404).json({ error: 'No citations found for this domain' })
      return
    }

    // 月次スコアを取得
    const { data: scores } = await supabase
      .from('citation_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('domain', domain)
      .order('month', { ascending: true })

    // 月次推移を取得
    const { data: monthly } = await supabase
      .from('monthly_citations')
      .select('*')
      .eq('user_id', user_id)
      .eq('domain', domain)
      .order('month', { ascending: true })

    // 統計情報を計算
    const stats = {
      total_citations: citations.length,
      total_links: citations.filter(c => c.citation_type === 'link').length,
      total_mentions: citations.filter(c => c.citation_type === 'mention').length,

      sentiment: {
        positive: citations.filter(c => c.sentiment === 'positive').length,
        neutral: citations.filter(c => c.sentiment === 'neutral').length,
        negative: citations.filter(c => c.sentiment === 'negative').length
      },

      unique_source_domains: new Set(citations.map(c => c.source_domain)).size,

      dofollow_links: citations.filter(c => c.is_dofollow === true).length,
      nofollow_links: citations.filter(c => c.is_dofollow === false).length,

      // トップソースドメイン
      top_source_domains: getTopSourceDomains(citations, 10),

      // トップトピック
      top_topics: getTopTopics(citations, 10),

      // 月次推移
      monthly_trend: monthly || [],

      // スコア推移
      score_trend: scores || [],

      // 最新スコア
      latest_score: scores && scores.length > 0 ? scores[scores.length - 1].citation_score : 0,

      // 最近のサイテーション（最新10件）
      recent_citations: citations.slice(0, 10).map(c => ({
        source_url: c.source_url,
        source_domain: c.source_domain,
        citation_type: c.citation_type,
        sentiment: c.sentiment,
        anchor_text: c.anchor_text,
        context: `${c.context_before || ''} [${c.citation_text}] ${c.context_after || ''}`,
        crawl_date: c.crawl_date
      }))
    }

    // AI サマリーを生成（POSTの場合のみ）
    let aiSummary = null
    if (req.method === 'POST') {
      aiSummary = await generateCitationSummary(citations, domain)
    }

    res.status(200).json({
      domain,
      stats,
      ai_summary: aiSummary
    })

  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * トップソースドメインを取得
 */
function getTopSourceDomains(citations, limit = 10) {
  const domainCounts = {}

  citations.forEach(c => {
    const domain = c.source_domain
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1
    }
  })

  return Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count }))
}

/**
 * トップトピックを取得
 */
function getTopTopics(citations, limit = 10) {
  const topicCounts = {}

  citations.forEach(c => {
    if (c.topics && Array.isArray(c.topics)) {
      c.topics.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      })
    }
  })

  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }))
}
