import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { checkBasicAuth } from '../lib/auth.js'

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

  let browser = null

  try {
    const { url, device = 'mobile' } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URLが必要です' })
    }

    console.log(`🔍 Deep Analysis Starting: ${url} (${device})`)

    // Puppeteerブラウザを起動（Vercel対応）
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    })

    const page = await browser.newPage()

    // デバイス設定
    if (device === 'mobile') {
      await page.setViewport({ width: 375, height: 812, isMobile: true })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15')
    } else {
      await page.setViewport({ width: 1920, height: 1080 })
    }

    // パフォーマンスメトリクスとリソース収集の準備
    const resources = []
    const coverageData = { css: [], js: [] }

    // リソースの監視
    page.on('response', async (response) => {
      const url = response.url()
      const resourceType = response.request().resourceType()

      try {
        const headers = response.headers()
        const status = response.status()

        resources.push({
          url,
          type: resourceType,
          status,
          size: headers['content-length'] ? parseInt(headers['content-length']) : null,
          contentType: headers['content-type'],
          cached: !!headers['cf-cache-status'] || !!headers['x-cache']
        })
      } catch (e) {
        // Ignore errors
      }
    })

    // CSS/JSカバレッジ測定を開始
    await Promise.all([
      page.coverage.startCSSCoverage(),
      page.coverage.startJSCoverage()
    ])

    console.log('  → Navigating to URL...')

    // ページにアクセス
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    })

    console.log('  → Page loaded, collecting data...')

    // HTMLソースを取得
    const htmlContent = await page.content()

    // すべてのCSSを取得
    const stylesheets = await page.evaluate(() => {
      const sheets = []
      for (const sheet of document.styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules)
          sheets.push({
            href: sheet.href,
            rules: rules.map(rule => rule.cssText),
            totalRules: rules.length
          })
        } catch (e) {
          // CORS制限でアクセスできないCSSはスキップ
        }
      }
      return sheets
    })

    // すべてのJavaScriptファイルのURLを取得
    const scripts = await page.evaluate(() => {
      return Array.from(document.scripts).map(script => ({
        src: script.src,
        inline: !script.src,
        async: script.async,
        defer: script.defer,
        type: script.type,
        size: script.textContent?.length || 0
      }))
    })

    // DOM構造の分析
    const domAnalysis = await page.evaluate(() => {
      const countNodes = (node) => {
        let count = 1
        for (const child of node.children) {
          count += countNodes(child)
        }
        return count
      }

      return {
        totalNodes: countNodes(document.body),
        depth: (() => {
          let maxDepth = 0
          const getDepth = (node, depth = 0) => {
            maxDepth = Math.max(maxDepth, depth)
            for (const child of node.children) {
              getDepth(child, depth + 1)
            }
          }
          getDepth(document.body)
          return maxDepth
        })(),
        images: document.images.length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length,
        iframes: document.querySelectorAll('iframe').length
      }
    })

    // 画像の詳細情報を取得
    const images = await page.evaluate(() => {
      return Array.from(document.images).map(img => ({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        displayWidth: img.width,
        displayHeight: img.height,
        alt: img.alt,
        loading: img.loading,
        format: img.src.split('.').pop()?.split('?')[0]
      }))
    })

    // パフォーマンスメトリクスを取得
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0]
      const paint = performance.getEntriesByType('paint')

      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        transferSize: navigation?.transferSize,
        encodedBodySize: navigation?.encodedBodySize,
        decodedBodySize: navigation?.decodedBodySize
      }
    })

    // カバレッジデータを取得
    const [cssCoverage, jsCoverage] = await Promise.all([
      page.coverage.stopCSSCoverage(),
      page.coverage.stopJSCoverage()
    ])

    // 未使用CSSの計算
    const unusedCSS = cssCoverage.map(entry => {
      let unusedBytes = 0
      for (const range of entry.ranges) {
        unusedBytes += range.end - range.start
      }
      return {
        url: entry.url,
        totalBytes: entry.text.length,
        unusedBytes,
        usedPercentage: ((entry.text.length - unusedBytes) / entry.text.length * 100).toFixed(2)
      }
    })

    // 未使用JavaScriptの計算
    const unusedJS = jsCoverage.map(entry => {
      let unusedBytes = 0
      for (const range of entry.ranges) {
        unusedBytes += range.end - range.start
      }
      return {
        url: entry.url,
        totalBytes: entry.text.length,
        unusedBytes,
        usedPercentage: ((entry.text.length - unusedBytes) / entry.text.length * 100).toFixed(2)
      }
    })

    // フォント情報を取得
    const fonts = await page.evaluate(() => {
      const usedFonts = new Set()
      document.fonts.forEach(font => {
        usedFonts.add(`${font.family} (${font.weight})`)
      })
      return Array.from(usedFonts)
    })

    console.log('  ✓ Deep analysis complete')

    await browser.close()
    browser = null

    res.status(200).json({
      url,
      device,
      analysis: {
        html: {
          length: htmlContent.length,
          snippet: htmlContent.substring(0, 1000) // 最初の1000文字のみ
        },
        stylesheets,
        scripts,
        dom: domAnalysis,
        images,
        performance: performanceMetrics,
        resources,
        coverage: {
          css: unusedCSS,
          js: unusedJS
        },
        fonts
      }
    })

  } catch (error) {
    console.error('Deep Analysis API Error:', error)

    if (browser) {
      await browser.close()
    }

    res.status(500).json({
      error: '詳細分析に失敗しました',
      details: error.message
    })
  }
}
