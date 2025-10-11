import { checkBasicAuth } from '../lib/auth.js'
import { getSupabaseClient } from '../lib/supabase.js'
import { searchDomainInCommonCrawl, fetchWARCContent, extractCitations, extractDomain } from '../lib/commoncrawl.js'
import { extractTopics, batchAnalyzeSentiment, calculateCitationScore } from '../lib/citation-ai.js'

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { user_id, domain, months, query_include, query_exclude } = req.body

    if (!user_id || !domain || !months || !Array.isArray(months)) {
      res.status(400).json({ error: 'user_id, domain, and months (array) are required' })
      return
    }

    const supabase = getSupabaseClient()

    // 分析ジョブを作成
    const { data: job, error: jobError } = await supabase
      .from('analysis_jobs')
      .insert({
        user_id,
        domain,
        job_type: 'initial',
        status: 'processing',
        crawl_months: months,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      res.status(500).json({ error: 'Failed to create analysis job' })
      return
    }

    // 非同期で分析を実行（バックグラウンド処理）
    processCitationAnalysis(job.id, user_id, domain, months, query_include, query_exclude).catch(error => {
      console.error('Background analysis error:', error)
    })

    res.status(202).json({
      message: 'Citation analysis started',
      job_id: job.id,
      status: 'processing'
    })

  } catch (error) {
    console.error('API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

/**
 * バックグラウンドで実行されるサイテーション分析処理
 */
async function processCitationAnalysis(jobId, userId, domain, months, queryInclude, queryExclude) {
  const supabase = getSupabaseClient()
  let totalCitations = 0

  try {
    console.log(`Starting citation analysis for ${domain}`)

    const allCitations = []

    // 各月のデータを取得
    for (let i = 0; i < months.length; i++) {
      const month = months[i]
      console.log(`Processing month: ${month}`)

      try {
        // キャッシュチェック
        const { data: cachedData } = await supabase
          .from('crawl_cache')
          .select('*')
          .eq('domain', domain)
          .eq('crawl_month', month)

        if (cachedData && cachedData.length > 0) {
          console.log(`Using cached data for ${month}`)
          // キャッシュから既存のサイテーションを取得
          const { data: existingCitations } = await supabase
            .from('citations')
            .select('*')
            .eq('user_id', userId)
            .eq('domain', domain)
            .gte('crawl_date', `${month}-01`)
            .lt('crawl_date', getNextMonth(month))

          if (existingCitations) {
            allCitations.push(...existingCitations)
          }
        } else {
          // Common Crawlから新規取得
          const indexRecords = await searchDomainInCommonCrawl(domain, month)
          console.log(`Found ${indexRecords.length} index records for ${month}`)

          // 最大10件まで処理（パフォーマンス改善）
          const limitedRecords = indexRecords.slice(0, 10)

          for (const record of limitedRecords) {
            try {
              const html = await fetchWARCContent(record)
              if (html) {
                const citations = extractCitations(html, domain, record.url)

                // フィルタリング適用
                const filteredCitations = citations.filter(citation => {
                  const text = `${citation.context_before || ''} ${citation.citation_text || ''} ${citation.context_after || ''}`.toLowerCase()

                  // クエリ含むフィルタ
                  if (queryInclude && !text.includes(queryInclude.toLowerCase())) {
                    return false
                  }

                  // クエリ除外フィルタ
                  if (queryExclude) {
                    const excludeList = queryExclude.split(',').map(q => q.trim().toLowerCase()).filter(q => q)
                    if (excludeList.some(excludeQuery => text.includes(excludeQuery))) {
                      return false
                    }
                  }

                  return true
                })

                // 各サイテーションをDBに保存
                for (const citation of filteredCitations) {
                  const citationData = {
                    user_id: userId,
                    domain,
                    source_url: citation.source_url,
                    source_domain: extractDomain(citation.source_url),
                    citation_text: citation.citation_text,
                    context_before: citation.context_before,
                    context_after: citation.context_after,
                    citation_type: citation.citation_type,
                    anchor_text: citation.anchor_text,
                    is_dofollow: citation.is_dofollow,
                    crawl_date: `${month}-15`, // 月の中旬を代表日とする
                    sentiment: 'neutral' // 初期値
                  }

                  const { data: inserted } = await supabase
                    .from('citations')
                    .upsert(citationData, {
                      onConflict: 'user_id,domain,source_url,citation_text',
                      ignoreDuplicates: false
                    })
                    .select()
                    .single()

                  if (inserted) {
                    allCitations.push(inserted)
                  }
                }
              }

              // レート制限対策
              await new Promise(resolve => setTimeout(resolve, 200))

            } catch (e) {
              console.error('Record processing error:', e)
            }
          }

          // キャッシュに記録
          await supabase
            .from('crawl_cache')
            .insert({
              domain,
              crawl_month: month,
              warc_file: 'multiple',
              citations_found: limitedRecords.length
            })
        }

        // 進捗を更新
        const progress = Math.round(((i + 1) / months.length) * 50) // 50%までをクロール処理
        await supabase
          .from('analysis_jobs')
          .update({ progress, total_citations: allCitations.length })
          .eq('id', jobId)

      } catch (monthError) {
        console.error(`Error processing month ${month}:`, monthError)
      }
    }

    console.log(`Collected ${allCitations.length} citations. Starting AI analysis...`)

    // AI分析: トピック抽出
    const topics = await extractTopics(allCitations)
    console.log('Extracted topics:', topics)

    // AI分析: センチメント分析（最大30件まで、それ以降はneutralとする）
    const citationsToAnalyze = allCitations.slice(0, 30)
    const citationsSkipped = allCitations.slice(30)

    const citationsWithSentiment = await batchAnalyzeSentiment(citationsToAnalyze, (progress) => {
      // 50%〜100%をセンチメント分析に割り当て
      const totalProgress = 50 + Math.round(progress / 2)
      supabase
        .from('analysis_jobs')
        .update({ progress: totalProgress })
        .eq('id', jobId)
        .then(() => {})
        .catch(e => console.error('Progress update error:', e))
    })

    // スキップされたサイテーションをneutralとして追加
    const allAnalyzedCitations = [
      ...citationsWithSentiment,
      ...citationsSkipped.map(c => ({ ...c, sentiment: 'neutral' }))
    ]

    // センチメント結果をDBに反映
    for (const citation of allAnalyzedCitations) {
      await supabase
        .from('citations')
        .update({
          sentiment: citation.sentiment,
          topics: topics
        })
        .eq('id', citation.id)
    }

    // 月次集計を作成
    for (const month of months) {
      const monthCitations = allAnalyzedCitations.filter(c => {
        return c.crawl_date && c.crawl_date.startsWith(month)
      })

      if (monthCitations.length > 0) {
        const linkCount = monthCitations.filter(c => c.citation_type === 'link').length
        const mentionCount = monthCitations.filter(c => c.citation_type === 'mention').length
        const uniqueDomains = new Set(monthCitations.map(c => c.source_domain)).size

        const sentimentCounts = {
          positive: monthCitations.filter(c => c.sentiment === 'positive').length,
          neutral: monthCitations.filter(c => c.sentiment === 'neutral').length,
          negative: monthCitations.filter(c => c.sentiment === 'negative').length
        }

        const citationScore = calculateCitationScore(monthCitations)

        await supabase
          .from('citation_scores')
          .upsert({
            user_id: userId,
            domain,
            month,
            total_citations: monthCitations.length,
            link_count: linkCount,
            mention_count: mentionCount,
            unique_domains: uniqueDomains,
            sentiment_positive: sentimentCounts.positive,
            sentiment_neutral: sentimentCounts.neutral,
            sentiment_negative: sentimentCounts.negative,
            top_topics: topics,
            citation_score: citationScore
          }, {
            onConflict: 'user_id,domain,month'
          })

        await supabase
          .from('monthly_citations')
          .upsert({
            user_id: userId,
            domain,
            month,
            citation_count: monthCitations.length,
            link_count: linkCount,
            mention_count: mentionCount
          }, {
            onConflict: 'user_id,domain,month'
          })
      }
    }

    // ジョブを完了に更新
    await supabase
      .from('analysis_jobs')
      .update({
        status: 'completed',
        progress: 100,
        total_citations: allAnalyzedCitations.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    console.log(`Citation analysis completed for ${domain}`)

  } catch (error) {
    console.error('Analysis processing error:', error)

    // ジョブを失敗に更新
    await supabase
      .from('analysis_jobs')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('id', jobId)
  }
}

/**
 * 次の月を取得（YYYY-MM形式）
 */
function getNextMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}
