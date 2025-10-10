import { checkBasicAuth } from '../../lib/auth.js'
import { XMLParser } from 'fast-xml-parser'

export default async function handler(req, res) {
  if (!checkBasicAuth(req, res)) return

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
    const { sitemapUrl } = req.body

    if (!sitemapUrl) {
      return res.status(400).json({ error: 'sitemapUrlは必須です' })
    }

    console.log(`Parsing sitemap: ${sitemapUrl}`)

    // サイトマップ取得
    const response = await fetch(sitemapUrl)
    if (!response.ok) {
      throw new Error('サイトマップの取得に失敗しました')
    }

    const text = await response.text()
    let urls = []

    // XML形式の場合
    if (text.includes('<?xml') || text.includes('<urlset') || text.includes('<sitemapindex')) {
      const parser = new XMLParser()
      const result = parser.parse(text)

      // sitemapindex の場合（サイトマップインデックス）
      if (result.sitemapindex && result.sitemapindex.sitemap) {
        const sitemaps = Array.isArray(result.sitemapindex.sitemap)
          ? result.sitemapindex.sitemap
          : [result.sitemapindex.sitemap]

        // 各サイトマップから URL を取得
        for (const sm of sitemaps.slice(0, 10)) { // 最大10個まで
          try {
            const smResponse = await fetch(sm.loc)
            const smText = await smResponse.text()
            const smResult = parser.parse(smText)

            if (smResult.urlset && smResult.urlset.url) {
              const urlEntries = Array.isArray(smResult.urlset.url)
                ? smResult.urlset.url
                : [smResult.urlset.url]
              urls.push(...urlEntries.map(u => u.loc))
            }
          } catch (err) {
            console.error('Error parsing sitemap:', sm.loc, err)
          }
        }
      }
      // 通常のサイトマップの場合
      else if (result.urlset && result.urlset.url) {
        const urlEntries = Array.isArray(result.urlset.url)
          ? result.urlset.url
          : [result.urlset.url]
        urls = urlEntries.map(u => u.loc)
      }
    }
    // テキスト形式の場合
    else {
      urls = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http://') || line.startsWith('https://'))
    }

    // 重複削除
    urls = [...new Set(urls)]

    console.log(`Found ${urls.length} URLs in sitemap`)

    res.status(200).json({
      success: true,
      urls,
      count: urls.length
    })

  } catch (error) {
    console.error('Parse sitemap error:', error)
    res.status(500).json({
      error: 'サイトマップの解析に失敗しました',
      details: error.message
    })
  }
}
