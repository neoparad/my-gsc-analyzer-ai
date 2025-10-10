import { getQueries, saveQuery, deleteQuery, saveQueries } from '../lib/supabase.js'
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
    // GETリクエスト: クエリ一覧を取得
    if (req.method === 'GET') {
      const { userId, siteUrl } = req.query

      if (!userId || !siteUrl) {
        return res.status(400).json({ error: 'userId and siteUrl are required' })
      }

      const queries = await getQueries(userId, siteUrl)
      return res.status(200).json({ queries })
    }

    // POSTリクエスト: クエリを保存（1件または複数件）
    if (req.method === 'POST') {
      const { userId, siteUrl, query, queries } = req.body

      if (!userId || !siteUrl) {
        return res.status(400).json({ error: 'userId and siteUrl are required' })
      }

      // 複数のクエリを一括保存
      if (queries && Array.isArray(queries)) {
        const results = await saveQueries(userId, siteUrl, queries)
        return res.status(200).json({ results })
      }

      // 単一のクエリを保存
      if (query) {
        const queryId = await saveQuery(userId, siteUrl, query)
        return res.status(200).json({ queryId })
      }

      return res.status(400).json({ error: 'query or queries are required' })
    }

    // DELETEリクエスト: クエリを削除
    if (req.method === 'DELETE') {
      const { queryId } = req.body

      if (!queryId) {
        return res.status(400).json({ error: 'queryId is required' })
      }

      await deleteQuery(queryId)
      return res.status(200).json({ success: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Rank Tracker Queries API Error:', error)
    res.status(500).json({
      error: 'データベース操作に失敗しました',
      details: error.message
    })
  }
}
