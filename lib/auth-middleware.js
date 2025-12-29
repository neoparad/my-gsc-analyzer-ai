import jwt from 'jsonwebtoken'

/**
 * JWTトークンを検証し、リクエストにユーザー情報を追加するミドルウェア
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェア関数
 */
export function verifyToken(req, res, next) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '認証トークンが必要です' })
    }

    const token = authHeader.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: '認証トークンが必要です' })
    }

    // JWTトークンを検証
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET環境変数が設定されていません')
      return res.status(500).json({ error: 'サーバー設定エラー' })
    }

    const decoded = jwt.verify(token, jwtSecret)
    
    // リクエストオブジェクトにユーザー情報を追加
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role || 'user'
    }

    // next()が関数の場合は呼び出す（Expressスタイル）
    if (typeof next === 'function') {
      next()
    }
    
    return true
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '無効なトークンです' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'トークンの有効期限が切れています' })
    }
    console.error('Token verification error:', error)
    return res.status(401).json({ error: '認証エラーが発生しました' })
  }
}

/**
 * 管理者権限をチェックするミドルウェア
 * @param {Object} req - リクエストオブジェクト（verifyTokenで処理済み）
 * @param {Object} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェア関数
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '認証が必要です' })
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' })
  }

  if (typeof next === 'function') {
    next()
  }
  
  return true
}

/**
 * 認証が必要なエンドポイント用のラッパー関数
 * Vercel Serverless Functions用に最適化
 */
export function withAuth(handler) {
  return async (req, res) => {
    const authResult = verifyToken(req, res)
    if (authResult !== true) {
      return // エラーレスポンスは既に送信済み
    }
    return handler(req, res)
  }
}

/**
 * 管理者権限が必要なエンドポイント用のラッパー関数
 */
export function withAdmin(handler) {
  return async (req, res) => {
    const authResult = verifyToken(req, res)
    if (authResult !== true) {
      return
    }
    
    const adminResult = requireAdmin(req, res)
    if (adminResult !== true) {
      return
    }
    
    return handler(req, res)
  }
}

