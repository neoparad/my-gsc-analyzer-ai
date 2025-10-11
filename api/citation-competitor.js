import { checkBasicAuth } from '../lib/auth.js'
import { getSupabaseClient } from '../lib/supabase.js'
import { generateCompetitorReport } from '../lib/citation-ai.js'

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
    const { user_id, my_domain, competitor_domains, months } = req.body

    if (!user_id || !my_domain || !competitor_domains || !Array.isArray(competitor_domains)) {
      res.status(400).json({ error: 'user_id, my_domain, and competitor_domains (array) are required' })
      return
    }

    const supabase = getSupabaseClient()

    // 自社のサイテーションデータを取得
    const { data: myCitations, error: myError } = await supabase
      .from('citations')
      .select('*')
      .eq('user_id', user_id)
      .eq('domain', my_domain)

    if (myError) {
      console.error('Error fetching my citations:', myError)
      res.status(500).json({ error: 'Failed to fetch citations' })
      return
    }

    // 自社の月次スコアを取得
    const { data: myScores } = await supabase
      .from('citation_scores')
      .select('*')
      .eq('user_id', user_id)
      .eq('domain', my_domain)
      .order('month', { ascending: true })

    // 競合のサイテーションデータを取得（または分析を開始）
    const competitorData = []

    for (const competitorDomain of competitor_domains) {
      // 既存データをチェック
      const { data: competitorCitations } = await supabase
        .from('citations')
        .select('*')
        .eq('domain', competitorDomain)

      const { data: competitorScores } = await supabase
        .from('citation_scores')
        .select('*')
        .eq('domain', competitorDomain)
        .order('month', { ascending: true })

      if (competitorCitations && competitorCitations.length > 0) {
        // 既存データがある場合
        competitorData.push({
          domain: competitorDomain,
          citations: competitorCitations,
          scores: competitorScores || []
        })
      } else {
        // データがない場合は新規分析ジョブを作成（バックグラウンド）
        const { data: job } = await supabase
          .from('analysis_jobs')
          .insert({
            user_id: user_id,
            domain: competitorDomain,
            job_type: 'competitor',
            status: 'pending',
            crawl_months: months || ['2024-12', '2025-01'],
            competitor_domains: [my_domain]
          })
          .select()
          .single()

        competitorData.push({
          domain: competitorDomain,
          citations: [],
          scores: [],
          status: 'pending',
          job_id: job?.id
        })
      }
    }

    // AI比較レポートを生成（既存データがある場合のみ）
    let aiReport = null
    const competitorsWithData = competitorData.filter(c => c.citations.length > 0)

    if (competitorsWithData.length > 0) {
      aiReport = await generateCompetitorReport(
        { domain: my_domain, citations: myCitations },
        competitorsWithData
      )
    }

    // 比較統計を計算
    const comparison = {
      my_domain: {
        domain: my_domain,
        total_citations: myCitations.length,
        total_links: myCitations.filter(c => c.citation_type === 'link').length,
        total_mentions: myCitations.filter(c => c.citation_type === 'mention').length,
        positive_sentiment: myCitations.filter(c => c.sentiment === 'positive').length,
        unique_domains: new Set(myCitations.map(c => c.source_domain)).size,
        recent_score: myScores && myScores.length > 0 ? myScores[myScores.length - 1].citation_score : 0,
        scores: myScores
      },
      competitors: competitorData.map(comp => ({
        domain: comp.domain,
        total_citations: comp.citations.length,
        total_links: comp.citations.filter(c => c.citation_type === 'link').length,
        total_mentions: comp.citations.filter(c => c.citation_type === 'mention').length,
        positive_sentiment: comp.citations.filter(c => c.sentiment === 'positive').length,
        unique_domains: new Set(comp.citations.map(c => c.source_domain)).size,
        recent_score: comp.scores && comp.scores.length > 0 ? comp.scores[comp.scores.length - 1].citation_score : 0,
        scores: comp.scores,
        status: comp.status,
        job_id: comp.job_id
      }))
    }

    res.status(200).json({
      comparison,
      ai_report: aiReport,
      pending_jobs: competitorData.filter(c => c.status === 'pending').map(c => c.job_id)
    })

  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}
