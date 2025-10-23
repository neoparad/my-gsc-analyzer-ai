import { createClient } from '@supabase/supabase-js'

// Supabaseクライアントの初期化
let supabase = null

export function getSupabaseClient() {
  if (supabase) {
    return supabase
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not set. Please set SUPABASE_URL and SUPABASE_ANON_KEY in environment variables.')
  }

  supabase = createClient(supabaseUrl, supabaseKey)
  return supabase
}

// クエリを保存・更新する
export async function saveQuery(userId, siteUrl, queryData) {
  const supabase = getSupabaseClient()

  // クエリが既に存在するか確認
  const { data: existingQuery, error: fetchError } = await supabase
    .from('rank_tracker_queries')
    .select('id')
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .eq('query', queryData.query)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = 結果が見つからない
    throw fetchError
  }

  let queryId

  if (existingQuery) {
    // 既存のクエリを更新
    const { data, error } = await supabase
      .from('rank_tracker_queries')
      .update({
        top_page_url: queryData.topPageUrl,
        page_title: queryData.pageTitle,
        current_position: queryData.currentPosition,
        latest_date: queryData.latestDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingQuery.id)
      .select()
      .single()

    if (error) throw error
    queryId = existingQuery.id
  } else {
    // 新しいクエリを挿入
    const { data, error } = await supabase
      .from('rank_tracker_queries')
      .insert({
        user_id: userId,
        site_url: siteUrl,
        query: queryData.query,
        top_page_url: queryData.topPageUrl,
        page_title: queryData.pageTitle,
        current_position: queryData.currentPosition,
        latest_date: queryData.latestDate
      })
      .select()
      .single()

    if (error) throw error
    queryId = data.id
  }

  // 履歴データを保存
  if (queryData.history && Object.keys(queryData.history).length > 0) {
    const historyRecords = Object.entries(queryData.history).map(([date, position]) => ({
      query_id: queryId,
      date,
      position
    }))

    // 既存の履歴データと重複しないようにupsertを使用
    const { error: historyError } = await supabase
      .from('rank_tracker_history')
      .upsert(historyRecords, { onConflict: 'query_id,date' })

    if (historyError) throw historyError
  }

  return queryId
}

// ユーザーの全クエリを取得
export async function getQueries(userId, siteUrl) {
  const supabase = getSupabaseClient()

  const { data: queries, error } = await supabase
    .from('rank_tracker_queries')
    .select(`
      *,
      rank_tracker_history (
        date,
        position
      )
    `)
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .order('created_at', { ascending: false })

  if (error) throw error

  // 履歴データをオブジェクト形式に変換
  return queries.map(query => ({
    id: query.id,
    query: query.query,
    siteUrl: query.site_url,
    topPageUrl: query.top_page_url || '',
    pageTitle: query.page_title || '',
    currentPosition: query.current_position || null,
    latestDate: query.latest_date || null,
    history: query.rank_tracker_history.reduce((acc, h) => {
      acc[h.date] = h.position
      return acc
    }, {})
  }))
}

// クエリを削除
export async function deleteQuery(queryId) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('rank_tracker_queries')
    .delete()
    .eq('id', queryId)

  if (error) throw error

  return true
}

// 複数のクエリを一括保存
export async function saveQueries(userId, siteUrl, queries) {
  const results = []

  for (const queryData of queries) {
    try {
      const queryId = await saveQuery(userId, siteUrl, queryData)
      results.push({ success: true, queryId })
    } catch (error) {
      console.error(`Failed to save query: ${queryData.query}`, error)
      results.push({ success: false, error: error.message })
    }
  }

  return results
}

// ========================================
// ページトラッカー用関数
// ========================================

// ページを登録・更新する
export async function savePage(userId, siteUrl, pageUrl, pageTitle = '') {
  const supabase = getSupabaseClient()

  // ページが既に存在するか確認
  const { data: existingPage, error: fetchError } = await supabase
    .from('page_tracker_pages')
    .select('id')
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .eq('page_url', pageUrl)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  let pageId

  if (existingPage) {
    // 既存のページを更新
    const { data, error } = await supabase
      .from('page_tracker_pages')
      .update({
        page_title: pageTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingPage.id)
      .select()
      .single()

    if (error) throw error
    pageId = existingPage.id
  } else {
    // 新しいページを挿入
    const { data, error } = await supabase
      .from('page_tracker_pages')
      .insert({
        user_id: userId,
        site_url: siteUrl,
        page_url: pageUrl,
        page_title: pageTitle
      })
      .select()
      .single()

    if (error) throw error
    pageId = data.id
  }

  return pageId
}

// 日次データを保存
export async function saveDailyData(pageId, dailyData) {
  const supabase = getSupabaseClient()

  const records = dailyData.map(day => ({
    page_id: pageId,
    date: day.date,
    clicks: day.clicks,
    impressions: day.impressions,
    ctr: day.ctr,
    position: day.position,
    top_queries: JSON.stringify(day.topQueries || [])
  }))

  // upsertで既存データは更新、新規データは挿入
  const { error } = await supabase
    .from('page_tracker_daily')
    .upsert(records, { onConflict: 'page_id,date' })

  if (error) throw error

  return true
}

// ユーザーの全ページを取得
export async function getPages(userId, siteUrl) {
  const supabase = getSupabaseClient()

  const { data: pages, error } = await supabase
    .from('page_tracker_pages')
    .select(`
      *,
      page_tracker_daily (
        date,
        clicks,
        impressions,
        ctr,
        position,
        top_queries
      )
    `)
    .eq('user_id', userId)
    .eq('site_url', siteUrl)
    .order('updated_at', { ascending: false })

  if (error) throw error

  // データを整形
  return pages.map(page => ({
    id: page.id,
    pageUrl: page.page_url,
    pageTitle: page.page_title || '',
    siteUrl: page.site_url,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    dailyData: page.page_tracker_daily
      .map(d => ({
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.ctr,
        position: d.position,
        topQueries: typeof d.top_queries === 'string' ? JSON.parse(d.top_queries) : d.top_queries
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }))
}

// ページを削除
export async function deletePage(pageId) {
  const supabase = getSupabaseClient()

  const { error } = await supabase
    .from('page_tracker_pages')
    .delete()
    .eq('id', pageId)

  if (error) throw error

  return true
}

// 複数ページを一括保存
export async function savePages(userId, siteUrl, pages) {
  const results = []

  for (const pageData of pages) {
    try {
      const pageId = await savePage(userId, siteUrl, pageData.pageUrl, pageData.pageTitle)

      if (pageData.dailyData && pageData.dailyData.length > 0) {
        await saveDailyData(pageId, pageData.dailyData)
      }

      results.push({ success: true, pageId })
    } catch (error) {
      console.error(`Failed to save page: ${pageData.pageUrl}`, error)
      results.push({ success: false, error: error.message })
    }
  }

  return results
}
