import { getPages, savePages, deletePage } from '../lib/supabase.js'
import { checkBasicAuth } from '../lib/auth.js'

export default async function handler(req, res) {
  if (!checkBasicAuth(req, res)) return

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // GET: ページ一覧を取得
    if (req.method === 'GET') {
      const { userId, siteUrl } = req.query
      console.log('[GET] Params:', { userId, siteUrl })

      if (!userId || !siteUrl) {
        console.error('[GET] Missing required params')
        return res.status(400).json({ error: 'userId and siteUrl are required' })
      }

      const pages = await getPages(userId, siteUrl)
      console.log('[GET] Success, pages count:', pages.length)
      return res.status(200).json({ pages })
    }

    // POST: ページを保存
    if (req.method === 'POST') {
      const { userId, siteUrl, pages } = req.body
      console.log('[POST] Params:', { userId, siteUrl, pagesCount: pages?.length })

      if (!userId || !siteUrl || !pages) {
        console.error('[POST] Missing required params')
        return res.status(400).json({ error: 'userId, siteUrl, and pages are required' })
      }

      const results = await savePages(userId, siteUrl, pages)
      console.log('[POST] Success, results:', results)
      return res.status(200).json({ success: true, results })
    }

    // DELETE: ページを削除
    if (req.method === 'DELETE') {
      const { pageId } = req.body
      console.log('[DELETE] PageId:', pageId)

      if (!pageId) {
        console.error('[DELETE] Missing pageId')
        return res.status(400).json({ error: 'pageId is required' })
      }

      await deletePage(pageId)
      console.log('[DELETE] Success')
      return res.status(200).json({ success: true })
    }

    res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Page Tracker Pages API Error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'ページ管理の処理に失敗しました',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
