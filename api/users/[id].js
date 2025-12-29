import { withAdmin } from '../../lib/auth-middleware.js'
import { getSupabaseClient } from '../../lib/supabase.js'
import bcrypt from 'bcryptjs'

async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { id } = req.query
  if (!id) {
    return res.status(400).json({ error: 'ユーザーIDが必要です' })
  }

  const supabase = getSupabaseClient()

  try {
    // GET: ユーザー情報取得
    if (req.method === 'GET') {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, display_name, role, is_active, created_at, last_login_at')
        .eq('id', id)
        .single()

      if (error || !user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' })
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        isActive: user.is_active,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      })
    }

    // PUT: ユーザー情報更新
    if (req.method === 'PUT') {
      const { username, email, displayName, role, isActive } = req.body

      const updateData = {}
      if (username !== undefined) updateData.username = username
      if (email !== undefined) updateData.email = email
      if (displayName !== undefined) updateData.display_name = displayName
      if (role !== undefined) updateData.role = role
      if (isActive !== undefined) updateData.is_active = isActive

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: '更新する項目を指定してください' })
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select('id, username, email, display_name, role, is_active, updated_at')
        .single()

      if (updateError) {
        if (updateError.code === '23505') {
          return res.status(409).json({ error: 'このユーザー名は既に使用されています' })
        }
        console.error('Error updating user:', updateError)
        return res.status(500).json({ error: 'ユーザーの更新に失敗しました' })
      }

      return res.status(200).json({
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        displayName: updatedUser.display_name,
        isActive: updatedUser.is_active
      })
    }

    // DELETE: ユーザー削除
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting user:', error)
        return res.status(500).json({ error: 'ユーザーの削除に失敗しました' })
      }

      return res.status(200).json({ success: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

// 管理者権限が必要なエンドポイント
export default withAdmin(handler)

