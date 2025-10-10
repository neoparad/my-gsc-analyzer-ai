import { checkBasicAuth } from '../../lib/auth.js'
import { google } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'

// メモリ内ジョブストア（本番環境ではRedis/DB使用推奨）
const jobs = new Map()

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
    const { urls } = req.body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urlsは必須です' })
    }

    if (urls.length > 100000) {
      return res.status(400).json({ error: 'URLは最大100,000件までです' })
    }

    const jobId = uuidv4()

    // ジョブ初期化
    jobs.set(jobId, {
      jobId,
      status: 'running',
      totalUrls: urls.length,
      completedUrls: 0,
      results: [],
      startedAt: new Date(),
      completedAt: null
    })

    console.log(`[Job ${jobId}] Started with ${urls.length} URLs`)

    // バックグラウンド処理開始（非同期）
    processUrls(jobId, urls).catch(err => {
      console.error(`[Job ${jobId}] Error:`, err)
      const job = jobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = err.message
      }
    })

    res.status(200).json({
      success: true,
      jobId,
      message: `${urls.length}件のURL検査を開始しました`
    })

  } catch (error) {
    console.error('Start inspection error:', error)
    res.status(500).json({
      error: 'URL検査の開始に失敗しました',
      details: error.message
    })
  }
}

async function processUrls(jobId, urls) {
  const job = jobs.get(jobId)
  if (!job) return

  try {
    // Google Search Console API認証
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    })

    const searchconsole = google.searchconsole({ version: 'v1', auth })

    // サイトプロパティを最初のURLから推定
    const siteUrl = extractSiteUrl(urls[0])

    console.log(`[Job ${jobId}] Processing with site URL: ${siteUrl}`)

    // バッチ処理（20 req/秒の制限を考慮）
    const batchSize = 20
    const delayMs = 1000 // 1秒あたり20リクエスト

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(url => inspectUrl(searchconsole, siteUrl, url))
      )

      job.results.push(...batchResults)
      job.completedUrls = job.results.length

      console.log(`[Job ${jobId}] Progress: ${job.completedUrls}/${job.totalUrls}`)

      // レート制限対策
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    job.status = 'completed'
    job.completedAt = new Date()

    console.log(`[Job ${jobId}] Completed successfully`)

  } catch (error) {
    console.error(`[Job ${jobId}] Processing error:`, error)
    job.status = 'failed'
    job.error = error.message
    throw error
  }
}

async function inspectUrl(searchconsole, siteUrl, inspectionUrl) {
  try {
    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl
      }
    })

    return {
      url: inspectionUrl,
      indexStatus: response.data.inspectionResult?.indexStatusResult,
      error: null
    }
  } catch (error) {
    console.error(`Error inspecting ${inspectionUrl}:`, error.message)
    return {
      url: inspectionUrl,
      indexStatus: null,
      error: error.message
    }
  }
}

function extractSiteUrl(url) {
  try {
    const urlObj = new URL(url)
    return `${urlObj.protocol}//${urlObj.hostname}`
  } catch {
    return null
  }
}

// ジョブデータへのアクセスをエクスポート（他のAPIで使用）
export { jobs }
