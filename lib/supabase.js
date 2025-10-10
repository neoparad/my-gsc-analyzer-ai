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
