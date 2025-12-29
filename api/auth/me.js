import { verifyToken } from '../../lib/auth-middleware.js'
import { getSupabaseClient } from '../../lib/supabase.js'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 認証チェック
  const authResult = verifyToken(req, res)
  if (authResult !== true) {
    return // エラーレスポンスは既に送信済み
  }

  try {
    const supabase = getSupabaseClient()
    
    // ユーザー情報を取得
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, display_name, role, is_active, created_at, last_login_at')
      .eq('id', req.user.userId)
      .single()

    if (error || !user) {
      console.error('Error fetching user:', error)
      return res.status(404).json({ error: 'ユーザーが見つかりません' })
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'このアカウントは無効化されています' })
    }

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      displayName: user.display_name || user.username,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

