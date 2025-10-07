import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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

    // Preview環境（テスト環境）では簡易認証
    if (process.env.VERCEL_ENV === 'preview') {
      if (username === 'test' && password === 'test123') {
        const token = jwt.sign(
          { username: 'test' },
          'test-secret-preview',
          { expiresIn: '7d' }
        )
        return res.status(200).json({
          success: true,
          token,
          username: 'test'
        })
      }
      return res.status(401).json({ error: 'テスト環境: test / test123 でログインしてください' })
    }

    // 環境変数から認証情報を取得
    const validUsername = process.env.AUTH_USERNAME
    const validPasswordHash = process.env.AUTH_PASSWORD_HASH
    const jwtSecret = process.env.JWT_SECRET

    if (!validUsername || !validPasswordHash || !jwtSecret) {
      console.error('環境変数が設定されていません')
      return res.status(500).json({ error: 'サーバー設定エラー' })
    }

    // ユーザー名の検証
    if (username !== validUsername) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' })
    }

    // パスワードの検証
    const isPasswordValid = await bcrypt.compare(password, validPasswordHash)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' })
    }

    // JWTトークンを生成
    const token = jwt.sign(
      { username },
      jwtSecret,
      { expiresIn: '7d' } // 7日間有効
    )

    res.status(200).json({
      success: true,
      token,
      username
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'ログイン処理中にエラーが発生しました' })
  }
}
