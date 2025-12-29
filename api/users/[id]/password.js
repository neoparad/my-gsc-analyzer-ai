import { verifyToken } from '../../../lib/auth-middleware.js'
import { getSupabaseClient } from '../../../lib/supabase.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 認証チェック
  const authResult = verifyToken(req, res)
  if (authResult !== true) {
    return
  }

  const { id } = req.query
  if (!id) {
    return res.status(400).json({ error: 'ユーザーIDが必要です' })
  }

  // 本人または管理者のみパスワード変更可能
  const isAdmin = req.user.role === 'admin'
  const isOwnAccount = req.user.userId === id

  if (!isAdmin && !isOwnAccount) {
    return res.status(403).json({ error: 'パスワードを変更する権限がありません' })
  }

  try {
    const { newPassword, currentPassword } = req.body

    if (!newPassword) {
      return res.status(400).json({ error: '新しいパスワードは必須です' })
    }

    const supabase = getSupabaseClient()

    // 本人の場合、現在のパスワードを確認
    if (!isAdmin && isOwnAccount) {
      if (!currentPassword) {
        return res.status(400).json({ error: '現在のパスワードは必須です' })
      }

      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', id)
        .single()

      if (fetchError || !user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' })
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash)
      if (!isPasswordValid) {
        return res.status(401).json({ error: '現在のパスワードが正しくありません' })
      }
    }

    // 新しいパスワードをハッシュ化
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(newPassword, saltRounds)

    // パスワードを更新
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating password:', updateError)
      return res.status(500).json({ error: 'パスワードの更新に失敗しました' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

