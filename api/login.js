import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getSupabaseClient } from '../lib/supabase.js'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' })
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET環境変数が設定されていません')
      return res.status(500).json({ error: 'サーバー設定エラー' })
    }

    // Preview環境（テスト環境）では簡易認証
    if (process.env.VERCEL_ENV === 'preview') {
      if (username === 'test' && password === 'test123') {
        const token = jwt.sign(
          { 
            userId: '00000000-0000-0000-0000-000000000000', // テスト用UUID
            username: 'test',
            role: 'admin'
          },
          jwtSecret,
          { expiresIn: '7d' }
        )
        return res.status(200).json({
          success: true,
          token,
          user: {
            id: '00000000-0000-0000-0000-000000000000',
            username: 'test',
            role: 'admin',
            displayName: 'テストユーザー'
          }
        })
      }
      return res.status(401).json({ error: 'テスト環境: test / test123 でログインしてください' })
    }

    // データベースからユーザー情報を取得
    const supabase = getSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, password_hash, email, display_name, role, is_active')
      .eq('username', username)
      .single()

    // ユーザーが見つからない、またはエラーが発生した場合
    if (userError || !user) {
      // 後方互換性: 環境変数ベースの認証も試行
      const validUsername = process.env.AUTH_USERNAME
      const validPasswordHash = process.env.AUTH_PASSWORD_HASH

      if (validUsername && validPasswordHash && username === validUsername) {
        const isPasswordValid = await bcrypt.compare(password, validPasswordHash)
        if (isPasswordValid) {
          // 環境変数ベースの認証が成功した場合、デフォルトユーザーを作成
          // 注意: これは初回移行時の後方互換性のため
          const defaultUserId = '00000000-0000-0000-0000-000000000001'
          const token = jwt.sign(
            { 
              userId: defaultUserId,
              username: validUsername,
              role: 'admin'
            },
            jwtSecret,
            { expiresIn: '7d' }
          )
          return res.status(200).json({
            success: true,
            token,
            user: {
              id: defaultUserId,
              username: validUsername,
              role: 'admin',
              displayName: validUsername
            }
          })
        }
      }
      
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' })
    }

    // アカウントが無効化されている場合
    if (!user.is_active) {
      return res.status(403).json({ error: 'このアカウントは無効化されています' })
    }

    // パスワードの検証
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' })
    }

    // 最終ログイン日時を更新
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // JWTトークンを生成（userId, username, roleを含む）
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        role: user.role || 'user'
      },
      jwtSecret,
      { expiresIn: '7d' } // 7日間有効
    )

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        displayName: user.display_name || user.username
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'ログイン処理中にエラーが発生しました' })
  }
}
