import { checkBasicAuth } from '../lib/auth.js'
import { getSupabaseClient } from '../lib/supabase.js'

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { job_id, user_id } = req.query

    if (!job_id) {
      res.status(400).json({ error: 'job_id is required' })
      return
    }

    const supabase = getSupabaseClient()

    // ジョブ情報を取得
    let query = supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', job_id)

    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data: job, error: jobError } = await query.single()

    if (jobError || !job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    // ジョブが完了している場合、サイテーションデータも取得
    let citations = null
    let citationScores = null
    let monthlyCitations = null

    if (job.status === 'completed') {
      // サイテーションデータを取得
      const { data: citationsData } = await supabase
        .from('citations')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('domain', job.domain)
        .order('crawl_date', { ascending: false })
        .limit(1000) // 最大1000件

      citations = citationsData || []

      // 月次スコアを取得
      const { data: scoresData } = await supabase
        .from('citation_scores')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('domain', job.domain)
        .order('month', { ascending: true })

      citationScores = scoresData || []

      // 月次推移を取得
      const { data: monthlyData } = await supabase
        .from('monthly_citations')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('domain', job.domain)
        .order('month', { ascending: true })

      monthlyCitations = monthlyData || []
    }

    res.status(200).json({
      job: {
        id: job.id,
        domain: job.domain,
        status: job.status,
        progress: job.progress,
        total_citations: job.total_citations,
        error_message: job.error_message,
        started_at: job.started_at,
        completed_at: job.completed_at,
        crawl_months: job.crawl_months
      },
      citations,
      citation_scores: citationScores,
      monthly_citations: monthlyCitations
    })

  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}
