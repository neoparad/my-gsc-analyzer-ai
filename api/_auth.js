// Basic認証チェック用のヘルパー関数
export function checkBasicAuth(req, res) {
  // ローカル開発環境では認証を無効化
  return true

  /* 認証を有効にする場合は以下のコメントを解除
  const basicAuth = req.headers['authorization']

  if (!basicAuth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
    res.status(401).json({ error: 'Authentication required' })
    return false
  }

  const authValue = basicAuth.split(' ')[1]
  const [user, pwd] = Buffer.from(authValue, 'base64').toString().split(':')

  const validUser = process.env.BASIC_AUTH_USER || 'admin'
  const validPassword = process.env.BASIC_AUTH_PASSWORD || 'password'

  if (user === validUser && pwd === validPassword) {
    return true
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
  res.status(401).json({ error: 'Invalid credentials' })
  return false
  */
}
