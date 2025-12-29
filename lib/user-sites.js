import { getSupabaseClient } from './supabase.js'

/**
 * サイトURLを正規化（プロトコルと末尾のスラッシュを統一）
 * @param {string} siteUrl - サイトURL
 * @returns {string} 正規化されたURL
 */
export function normalizeSiteUrl(siteUrl) {
  if (!siteUrl) return ''
  
  // sc-domain:形式の場合はそのまま返す
  if (siteUrl.startsWith('sc-domain:')) {
    return siteUrl
  }
  
  try {
    const url = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`)
    // 常にHTTPSを使用（GSCではHTTPとHTTPSは別プロパティ）
    return `https://${url.hostname}/`
  } catch (e) {
    // URL解析に失敗した場合はそのまま返す
    return siteUrl
  }
}

/**
 * サイトURLからドメイン部分を抽出
 * @param {string} siteUrl - サイトURL
 * @returns {string} ドメイン部分（例: tabirai.net）
 */
export function extractDomain(siteUrl) {
  if (!siteUrl) return ''
  
  // sc-domain:形式の場合
  if (siteUrl.startsWith('sc-domain:')) {
    return siteUrl.replace('sc-domain:', '')
  }
  
  try {
    const url = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`)
    return url.hostname.replace(/^www\./, '') // www.を削除
  } catch (e) {
    // URL解析に失敗した場合はそのまま返す
    return siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

/**
 * ユーザーがアクセス可能なサイトURLの一覧を取得
 * @param {string} userId - ユーザーID（UUID）
 * @param {string} userRole - ユーザーのロール（'admin' または 'user'）
 * @returns {Promise<Array>} サイトURLの配列
 */
export async function getUserSites(userId, userRole = 'user') {
  const supabase = getSupabaseClient()
  
  // 管理者の場合は全サイトを取得
  if (userRole === 'admin') {
    const { data, error } = await supabase
      .from('user_sites')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching all sites (admin):', error)
      throw error
    }

    return data || []
  }
  
  // 一般ユーザーの場合は自分のサイトのみ
  const { data, error } = await supabase
    .from('user_sites')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching user sites:', error)
    throw error
  }

  return data || []
}

/**
 * ユーザーが指定したサイトURLにアクセス可能かチェック
 * @param {string} userId - ユーザーID（UUID）
 * @param {string} siteUrl - チェックするサイトURL
 * @param {string} userRole - ユーザーのロール（'admin' または 'user'）
 * @returns {Promise<boolean>} アクセス可能な場合true
 */
export async function canUserAccessSite(userId, siteUrl, userRole = 'user') {
  if (!userId || !siteUrl) {
    return false
  }

  // 管理者の場合は常にアクセス可能
  if (userRole === 'admin') {
    return true
  }

  const supabase = getSupabaseClient()
  
  // サイトURLを正規化
  const normalizedUrl = normalizeSiteUrl(siteUrl)
  const domain = extractDomain(siteUrl)
  
  // 完全一致またはドメイン一致でチェック
  const { data, error } = await supabase
    .from('user_sites')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`site_url.eq."${siteUrl}",site_url.eq."${normalizedUrl}",site_domain.eq."${domain}"`)
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking site access:', error)
    return false
  }

  return !!data
}

/**
 * canUserAccessSiteのエイリアス（後方互換性のため）
 * @deprecated canUserAccessSiteを使用してください
 */
export const checkSiteAccess = canUserAccessSite

/**
 * ユーザーのサイトURLから使用するサービスアカウントIDを取得
 * @param {string} userId - ユーザーID（UUID）
 * @param {string} siteUrl - サイトURL
 * @returns {Promise<string>} サービスアカウントID（'link-th' または 'tabirai'）
 */
export async function getAccountIdForSite(userId, siteUrl) {
  if (!userId || !siteUrl) {
    return 'link-th' // デフォルト
  }

  const supabase = getSupabaseClient()
  
  const normalizedUrl = normalizeSiteUrl(siteUrl)
  const domain = extractDomain(siteUrl)
  
  const { data, error } = await supabase
    .from('user_sites')
    .select('account_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`site_url.eq."${siteUrl}",site_url.eq."${normalizedUrl}",site_domain.eq."${domain}"`)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    // デフォルトは全ユーザー共通のlink-th
    return 'link-th'
  }

  // account_idを正規化（小文字、ハイフン統一）
  const accountId = data.account_id || 'link-th'
  return accountId.toLowerCase().replace(/_/g, '-').trim()
}


/**
 * ユーザーにサイトを追加
 * @param {string} userId - ユーザーID（UUID）
 * @param {string} siteUrl - サイトURL
 * @param {string} accountId - サービスアカウントID（オプション、デフォルト: 'link-th'）
 * @param {string} displayName - 表示名（オプション）
 * @returns {Promise<Object>} 作成されたサイト情報
 */
export async function addUserSite(userId, siteUrl, accountId = 'link-th', displayName = null) {
  const supabase = getSupabaseClient()
  
  const normalizedUrl = normalizeSiteUrl(siteUrl)
  const domain = extractDomain(siteUrl)
  
  // accountIdを正規化（小文字、ハイフン統一）
  const normalizedAccountId = accountId ? accountId.toLowerCase().replace(/_/g, '-').trim() : 'link-th'
  
  const { data, error } = await supabase
    .from('user_sites')
    .insert({
      user_id: userId,
      site_url: normalizedUrl,
      site_domain: domain,
      account_id: normalizedAccountId,
      display_name: displayName || domain
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding user site:', error)
    throw error
  }

  return data
}

