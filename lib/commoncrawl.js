import { XMLParser } from 'fast-xml-parser'

/**
 * Common Crawl Index API経由でドメインの被リンク・言及を検索
 * @param {string} domain - 検索対象ドメイン
 * @param {string} yearMonth - 'YYYY-MM' 形式の年月
 * @returns {Promise<Array>} - 検索結果の配列
 */
export async function searchDomainInCommonCrawl(domain, yearMonth) {
  try {
    // 年月から適切なCommon CrawlインデックスIDを取得
    const indexId = getIndexIdFromYearMonth(yearMonth)

    // Common Crawl Index APIのエンドポイント
    const indexUrl = `https://index.commoncrawl.org/${indexId}-index`

    // URLエンコードされたドメイン検索クエリ
    const searchQuery = `url:${domain}/*`
    const encodedQuery = encodeURIComponent(searchQuery)

    // ページング対応（最大1000件まで取得）
    const results = []
    let offset = 0
    const limit = 100

    while (offset < 1000) {
      const apiUrl = `${indexUrl}?url=${encodedQuery}&output=json&limit=${limit}&offset=${offset}`

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GSC-Citation-Analyzer/1.0)'
        }
      })

      if (!response.ok) {
        console.error(`Common Crawl API error: ${response.status}`)
        break
      }

      const text = await response.text()
      if (!text) break

      // 改行区切りのJSON形式を解析
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length === 0) break

      for (const line of lines) {
        try {
          const item = JSON.parse(line)
          results.push(item)
        } catch (e) {
          console.error('JSON parse error:', e)
        }
      }

      if (lines.length < limit) break
      offset += limit

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return results
  } catch (error) {
    console.error('Common Crawl search error:', error)
    return []
  }
}

/**
 * 年月からCommon CrawlのインデックスIDを取得
 * @param {string} yearMonth - 'YYYY-MM' 形式
 * @returns {string} - インデックスID
 */
function getIndexIdFromYearMonth(yearMonth) {
  // Common Crawlの実際のインデックスIDは月次で異なるため、
  // 近似値を返す（実装時に実際のインデックスリストから選択するロジックを追加）
  const [year, month] = yearMonth.split('-')

  // 簡易的なマッピング（2024年以降の主要インデックス）
  const indexMap = {
    '2024-01': 'CC-MAIN-2024-10',
    '2024-02': 'CC-MAIN-2024-10',
    '2024-03': 'CC-MAIN-2024-10',
    '2024-04': 'CC-MAIN-2024-18',
    '2024-05': 'CC-MAIN-2024-18',
    '2024-06': 'CC-MAIN-2024-26',
    '2024-07': 'CC-MAIN-2024-33',
    '2024-08': 'CC-MAIN-2024-33',
    '2024-09': 'CC-MAIN-2024-38',
    '2024-10': 'CC-MAIN-2024-42',
    '2024-11': 'CC-MAIN-2024-46',
    '2024-12': 'CC-MAIN-2024-51',
    '2025-01': 'CC-MAIN-2025-04',
    '2025-02': 'CC-MAIN-2025-09'
  }

  return indexMap[yearMonth] || 'CC-MAIN-2024-10'
}

/**
 * WARCファイルからHTMLコンテンツを取得
 * @param {object} indexRecord - Common Crawl Index APIから取得したレコード
 * @returns {Promise<string>} - HTMLコンテンツ
 */
export async function fetchWARCContent(indexRecord) {
  try {
    const { filename, offset, length } = indexRecord

    // Common CrawlのS3バケットURL
    const warcUrl = `https://data.commoncrawl.org/${filename}`

    // Rangeヘッダーで該当箇所のみ取得
    const response = await fetch(warcUrl, {
      headers: {
        'Range': `bytes=${offset}-${parseInt(offset) + parseInt(length) - 1}`
      }
    })

    if (!response.ok) {
      console.error(`WARC fetch error: ${response.status}`)
      return null
    }

    const content = await response.text()

    // WARCレコードからHTMLを抽出
    const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i)
    return htmlMatch ? htmlMatch[0] : null

  } catch (error) {
    console.error('WARC fetch error:', error)
    return null
  }
}

/**
 * HTMLから特定ドメインへのリンクと周辺テキストを抽出
 * @param {string} html - HTMLコンテンツ
 * @param {string} targetDomain - 対象ドメイン
 * @param {string} sourceUrl - ソースURL
 * @returns {Array<object>} - 抽出された被リンク・言及情報
 */
export function extractCitations(html, targetDomain, sourceUrl) {
  if (!html) return []

  const citations = []

  try {
    // aタグのリンクを抽出
    const linkRegex = /<a[^>]*href=["']([^"']*)[^>]*>(.*?)<\/a>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const [fullMatch, href, anchorText] = match

      if (href.includes(targetDomain)) {
        // リンク前後のコンテキストを取得
        const startPos = Math.max(0, match.index - 200)
        const endPos = Math.min(html.length, match.index + fullMatch.length + 200)
        const context = html.substring(startPos, endPos)

        // タグを除去してテキストのみ抽出
        const contextBefore = html.substring(startPos, match.index).replace(/<[^>]+>/g, '').trim()
        const contextAfter = html.substring(match.index + fullMatch.length, endPos).replace(/<[^>]+>/g, '').trim()

        citations.push({
          citation_type: 'link',
          anchor_text: anchorText.replace(/<[^>]+>/g, '').trim(),
          citation_text: fullMatch,
          context_before: contextBefore.substring(Math.max(0, contextBefore.length - 100)),
          context_after: contextAfter.substring(0, 100),
          source_url: sourceUrl,
          target_url: href,
          is_dofollow: !fullMatch.toLowerCase().includes('rel="nofollow"')
        })
      }
    }

    // テキスト言及を抽出（リンクでない場合）
    const mentionRegex = new RegExp(`\\b${targetDomain.replace('.', '\\.')}\\b`, 'gi')
    const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                            .replace(/<style[\s\S]*?<\/style>/gi, '')
                            .replace(/<[^>]+>/g, ' ')

    let mentionMatch
    while ((mentionMatch = mentionRegex.exec(textContent)) !== null) {
      // 既にリンクとして抽出済みでないかチェック
      const alreadyExtracted = citations.some(c =>
        c.context_before.includes(mentionMatch[0]) ||
        c.context_after.includes(mentionMatch[0])
      )

      if (!alreadyExtracted) {
        const startPos = Math.max(0, mentionMatch.index - 100)
        const endPos = Math.min(textContent.length, mentionMatch.index + mentionMatch[0].length + 100)

        citations.push({
          citation_type: 'mention',
          anchor_text: null,
          citation_text: mentionMatch[0],
          context_before: textContent.substring(startPos, mentionMatch.index).trim(),
          context_after: textContent.substring(mentionMatch.index + mentionMatch[0].length, endPos).trim(),
          source_url: sourceUrl,
          target_url: null,
          is_dofollow: null
        })
      }
    }

  } catch (error) {
    console.error('Citation extraction error:', error)
  }

  return citations
}

/**
 * ソースドメインを抽出
 * @param {string} url - URL
 * @returns {string} - ドメイン
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch (e) {
    return ''
  }
}

/**
 * 月次でのバッチ分析を実行
 * @param {string} domain - 対象ドメイン
 * @param {Array<string>} months - 分析対象月の配列 ['YYYY-MM', ...]
 * @param {Function} progressCallback - 進捗コールバック
 * @returns {Promise<Array>} - 全サイテーション
 */
export async function batchAnalyzeCitations(domain, months, progressCallback) {
  const allCitations = []
  let processed = 0

  for (const month of months) {
    try {
      console.log(`Analyzing ${domain} for ${month}...`)

      // Common Crawlから検索
      const indexRecords = await searchDomainInCommonCrawl(domain, month)
      console.log(`Found ${indexRecords.length} index records for ${month}`)

      // 各レコードからサイテーションを抽出
      for (const record of indexRecords.slice(0, 50)) { // 負荷軽減のため最大50件
        try {
          const html = await fetchWARCContent(record)
          if (html) {
            const citations = extractCitations(html, domain, record.url)
            allCitations.push(...citations)
          }
        } catch (e) {
          console.error('Record processing error:', e)
        }

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      processed++
      if (progressCallback) {
        progressCallback(Math.round((processed / months.length) * 100))
      }

    } catch (error) {
      console.error(`Error analyzing ${month}:`, error)
    }
  }

  return allCitations
}

/**
 * 利用可能なCommon Crawlインデックスリストを取得
 * @returns {Promise<Array<string>>} - インデックスID配列
 */
export async function getAvailableIndexes() {
  try {
    const response = await fetch('https://index.commoncrawl.org/collinfo.json')
    const indexes = await response.json()
    return indexes.map(idx => idx.id)
  } catch (error) {
    console.error('Failed to fetch index list:', error)
    return []
  }
}
