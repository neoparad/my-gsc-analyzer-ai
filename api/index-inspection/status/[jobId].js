import { checkBasicAuth } from '../../../lib/auth.js'
import { jobs } from '../start.js'

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

    const job = jobs.get(jobId)

    if (!job) {
      return res.status(404).json({ error: 'ジョブが見つかりません' })
    }

    const progress = job.totalUrls > 0
      ? (job.completedUrls / job.totalUrls) * 100
      : 0

    res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      total: job.totalUrls,
      completed: job.completedUrls,
      progress: Math.round(progress * 10) / 10,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
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
