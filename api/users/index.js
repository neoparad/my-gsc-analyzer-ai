import { withAdmin } from '../../lib/auth-middleware.js'
import { getSupabaseClient } from '../../lib/supabase.js'
import bcrypt from 'bcryptjs'

async function handler(req, res) {
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

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch (supabaseError) {
    console.error('[User API] Failed to initialize Supabase:', supabaseError)
    return res.status(500).json({ 
      error: 'データベース接続に失敗しました',
      details: supabaseError.message 
    })
  }

  try {
    // GET: ユーザー一覧取得（管理者のみ）
    if (req.method === 'GET') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, email, display_name, role, is_active, created_at, last_login_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        return res.status(500).json({ error: 'ユーザー一覧の取得に失敗しました' })
      }

      return res.status(200).json(users || [])
    }

    // POST: ユーザー作成（管理者のみ）
    if (req.method === 'POST') {
      const { username, password, email, displayName, role, sites } = req.body

      if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' })
      }

      // パスワードのハッシュ化
      const saltRounds = 10
      const passwordHash = await bcrypt.hash(password, saltRounds)

      // ユーザー作成
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username,
          password_hash: passwordHash,
          email: email || null,
          display_name: displayName || username,
          role: role || 'user'
        })
        .select('id, username, email, display_name, role, is_active, created_at')
        .single()

      if (createError) {
        console.error('[User API] Error creating user:', createError)
        
        if (createError.code === '23505') { // 一意制約違反
          return res.status(409).json({ 
            error: 'このユーザー名は既に使用されています',
            details: createError.message 
          })
        }
        
        if (createError.code === 'PGRST116') { // 結果が見つからない（通常は発生しない）
          return res.status(500).json({ 
            error: 'ユーザーの作成に失敗しました',
            details: 'データベースから結果を取得できませんでした',
            code: createError.code
          })
        }
        
        // その他のデータベースエラー
        return res.status(500).json({ 
          error: 'ユーザーの作成に失敗しました',
          details: createError.message,
          code: createError.code,
          hint: createError.hint || null
        })
      }

      // サイトが指定されている場合、サイトも作成
      const createdSites = []
      if (sites && Array.isArray(sites) && sites.length > 0) {
        const { addUserSite } = await import('../../lib/user-sites.js')
        
        for (const site of sites) {
          try {
            if (site.siteUrl) {
              // 管理者のみtabiraiアカウントを使用可能
              const finalAccountId = site.accountId === 'tabirai' && req.user.role !== 'admin' 
                ? 'link-th' 
                : (site.accountId || 'link-th')
              
              const createdSite = await addUserSite(
                newUser.id,
                site.siteUrl,
                finalAccountId,
                site.displayName || null
              )
              createdSites.push(createdSite)
            }
          } catch (siteError) {
            console.error('Error creating site:', siteError)
            // サイト作成エラーは記録するが、ユーザー作成は成功とする
          }
        }
      }

      return res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        displayName: newUser.display_name,
        isActive: newUser.is_active,
        createdAt: newUser.created_at,
        sites: createdSites
      })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[User API] Error:', error)
    res.status(500).json({ 
      error: error.message || 'ユーザー操作に失敗しました',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// 管理者権限が必要なエンドポイント
export default withAdmin(handler)

