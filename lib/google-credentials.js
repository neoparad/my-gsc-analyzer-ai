import fs from 'fs'
import path from 'path'

// 利用可能なサービスアカウントのマッピング
const SERVICE_ACCOUNTS = {
  'tabirai': 'tabirai-seo-pj-58a84b33b54a.json',
  'link-th': 'link-th-1735646449171-9802ee6af2b8.json',
  // デフォルト
  'default': 'tabirai-seo-pj-58a84b33b54a.json'
}

/**
 * accountIdを正規化する（小文字、ハイフン統一）
 * @param {string} accountId - サービスアカウントID
 * @returns {string} 正規化されたaccountId
 */
function normalizeAccountId(accountId) {
  if (!accountId) return 'default'
  // 小文字に変換し、アンダースコアをハイフンに変換
  return accountId.toLowerCase().replace(/_/g, '-').trim()
}

/**
 * Google認証情報を取得する
 * @param {string} accountId - サービスアカウントID ('tabirai', 'link-th', 'default')
 * @returns {Object} Google認証情報オブジェクト
 */
export function getGoogleCredentials(accountId = 'default') {
  // accountIdを正規化
  const normalizedAccountId = normalizeAccountId(accountId)
  
  // アカウント固有の環境変数をチェック（最優先）
  // 例: GOOGLE_CREDENTIALS_LINK_TH, GOOGLE_CREDENTIALS_TABIRAI
  const accountEnvVar = `GOOGLE_CREDENTIALS_${normalizedAccountId.toUpperCase().replace(/-/g, '_')}`
  if (process.env[accountEnvVar]) {
    try {
      console.log(`[Credentials] Using account-specific env var: ${accountEnvVar}`)
      return JSON.parse(process.env[accountEnvVar])
    } catch (e) {
      console.error(`Failed to parse ${accountEnvVar}:`, e)
      // フォールバック処理に進む
    }
  }

  // 汎用環境変数から認証情報を取得（後方互換性のため）
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      console.log(`[Credentials] Using generic GOOGLE_CREDENTIALS env var`)
      return JSON.parse(process.env.GOOGLE_CREDENTIALS)
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS:', e)
      // フォールバック処理に進む
    }
  }

  // ローカル開発環境またはファイルベースの認証情報を使用
  try {
    const filename = SERVICE_ACCOUNTS[normalizedAccountId] || SERVICE_ACCOUNTS['default']
    const credentialsPath = path.join(process.cwd(), 'credentials', filename)
    
    if (fs.existsSync(credentialsPath)) {
      console.log(`[Credentials] Using file-based credentials: ${filename}`)
      return JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    }
    
    // ファイルが見つからない場合はデフォルトを試す
    if (normalizedAccountId !== 'default') {
      const defaultPath = path.join(process.cwd(), 'credentials', SERVICE_ACCOUNTS['default'])
      if (fs.existsSync(defaultPath)) {
        console.warn(`[Credentials] File not found for ${normalizedAccountId}, using default`)
        return JSON.parse(fs.readFileSync(defaultPath, 'utf8'))
      }
    }
    
    throw new Error(`Credentials file not found: ${filename}`)
  } catch (e) {
    // 本番環境でファイルが見つからない場合はエラー
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error(`認証情報の取得に失敗しました。アカウント: ${normalizedAccountId}（元の値: ${accountId}）。環境変数 ${accountEnvVar} または GOOGLE_CREDENTIALS を設定してください。エラー: ${e.message}`)
    }
    throw new Error(`Failed to load credentials for account ${normalizedAccountId} (original: ${accountId}): ${e.message}`)
  }
}

/**
 * 利用可能なサービスアカウントの一覧を取得
 * @returns {Array} サービスアカウントIDの配列
 */
export function getAvailableAccounts() {
  return Object.keys(SERVICE_ACCOUNTS).filter(key => key !== 'default')
}

/**
 * リクエストからサービスアカウントIDを取得
 * @param {Object} req - リクエストオブジェクト
 * @returns {string} サービスアカウントID
 */
export function getAccountIdFromRequest(req) {
  // リクエストボディから取得
  if (req.body && req.body.accountId) {
    return req.body.accountId
  }
  
  // クエリパラメータから取得
  if (req.query && req.query.accountId) {
    return req.query.accountId
  }
  
  // デフォルト
  return 'default'
}





