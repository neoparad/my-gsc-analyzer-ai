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

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'ジョブがまだ完了していません',
        status: job.status
      })
    }

    res.status(200).json(job.results)

  } catch (error) {
    console.error('Get results error:', error)
    res.status(500).json({
      error: '結果の取得に失敗しました',
      details: error.message
    })
  }
}
