import { verifyToken } from '../../lib/auth-middleware.js'
import { getUserSites, addUserSite, normalizeSiteUrl, extractDomain } from '../../lib/user-sites.js'
import { getSupabaseClient } from '../../lib/supabase.js'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // JWT認証チェック
  const authResult = verifyToken(req, res)
  if (authResult !== true) {
    return
  }

  const userId = req.user.userId

  try {
    // GET: ユーザーのサイト一覧取得
    if (req.method === 'GET') {
      const userRole = req.user.role || 'user'
      const sites = await getUserSites(userId, userRole)
      return res.status(200).json(sites)
    }

    // POST: ユーザーにサイトを追加
    if (req.method === 'POST') {
      const { siteUrl, accountId, displayName } = req.body

      if (!siteUrl) {
        return res.status(400).json({ error: 'siteUrlは必須です' })
      }

      // 管理者のみtabiraiアカウントを使用可能
      const finalAccountId = accountId === 'tabirai' && req.user.role !== 'admin' 
        ? 'link-th' 
        : (accountId || 'link-th')

      const site = await addUserSite(userId, siteUrl, finalAccountId, displayName)
      return res.status(201).json(site)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

