import { checkBasicAuth } from '../../../lib/auth.js'
import { getSupabaseClient } from '../../../lib/supabase.js'

export default async function handler(req, res) {
  if (!checkBasicAuth(req, res)) return

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
    const { jobId } = req.query

    if (!jobId) {
      return res.status(400).json({ error: 'jobIdは必須です' })
    }

    const supabase = getSupabaseClient()

    // Supabaseからジョブ情報を取得
    const { data: job, error } = await supabase
      .from('index_inspection_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single()

    if (error || !job) {
      return res.status(404).json({ error: 'ジョブが見つかりません' })
    }

    const progress = job.total_urls > 0
      ? (job.completed_urls / job.total_urls) * 100
      : 0

    res.status(200).json({
      jobId: job.job_id,
      status: job.status,
      total: job.total_urls,
      completed: job.completed_urls,
      progress: Math.round(progress * 10) / 10,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      error: job.error || null
    })

  } catch (error) {
    console.error('Get status error:', error)
    res.status(500).json({
      error: 'ステータスの取得に失敗しました',
      details: error.message
    })
  }
}
