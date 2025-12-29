import { verifyToken } from '../../lib/auth-middleware.js'
import { getSupabaseClient } from '../../lib/supabase.js'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT,DELETE,OPTIONS')
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

  const { id } = req.query
  const userId = req.user.userId

  if (!id) {
    return res.status(400).json({ error: 'サイトIDが必要です' })
  }

  const supabase = getSupabaseClient()

  try {
    // PUT: サイト情報更新
    if (req.method === 'PUT') {
      const { displayName, isActive, accountId } = req.body
      const isAdmin = req.user.role === 'admin'

      const updateData = {}
      if (displayName !== undefined) updateData.display_name = displayName
      if (isActive !== undefined) updateData.is_active = isActive

      // 管理者のみtabiraiアカウントを使用可能
      if (accountId !== undefined) {
        updateData.account_id = accountId === 'tabirai' && !isAdmin
          ? 'link-th'
          : accountId
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: '更新する項目を指定してください' })
      }

      // 管理者は全サイト更新可能、一般ユーザーは自分のサイトのみ
      let query = supabase
        .from('user_sites')
        .update(updateData)
        .eq('id', id)

      if (!isAdmin) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query.select().single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'サイトが見つかりません' })
        }
        console.error('Error updating site:', error)
        return res.status(500).json({ error: 'サイトの更新に失敗しました' })
      }

      return res.status(200).json(data)
    }

    // DELETE: サイト削除
    if (req.method === 'DELETE') {
      const isAdmin = req.user.role === 'admin'

      console.log('[DELETE Site] Request:', {
        siteId: id,
        userId: userId,
        userRole: req.user.role,
        isAdmin: isAdmin
      })

      // まず削除対象のサイトを確認
      let checkQuery = supabase
        .from('user_sites')
        .select('*')
        .eq('id', id)

      if (!isAdmin) {
        checkQuery = checkQuery.eq('user_id', userId)
      }

      const { data: existingData, error: checkError } = await checkQuery.single()

      console.log('[DELETE Site] Check result:', { existingData, checkError })

      if (checkError || !existingData) {
        console.log('[DELETE Site] Site not found or no permission')
        return res.status(404).json({
          error: 'サイトが見つからないか、削除権限がありません',
          debug: { siteId: id, userId, isAdmin }
        })
      }

      // 削除を実行
      const { error: deleteError } = await supabase
        .from('user_sites')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting site:', deleteError)
        return res.status(500).json({ error: 'サイトの削除に失敗しました', details: deleteError.message })
      }

      console.log('[DELETE Site] Successfully deleted:', existingData)
      return res.status(200).json({ success: true, deleted: existingData })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

