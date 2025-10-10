import { checkBasicAuth } from '../../lib/auth.js'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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
    const { url, mode = 'both', viewport = 'desktop', extractCritical = false, simulateInteraction = false } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URLは必須です' })
    }

    // URL validation
    let targetUrl
    try {
      targetUrl = new URL(url)
    } catch (err) {
      return res.status(400).json({ error: '有効なURLを入力してください' })
    }

    console.log('Starting CSS/JS analysis for:', url, 'mode:', mode, 'viewport:', viewport)

    // Puppeteer browser setup
    const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production'

    // Define viewport sizes
    const viewportSizes = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 }
    }

    const selectedViewport = viewportSizes[viewport] || viewportSizes.desktop

    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      defaultViewport: selectedViewport,
      executablePath: isProduction
        ? await chromium.executablePath()
        : process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: isProduction ? chromium.headless : true,
      ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage()

    // Set viewport
    await page.setViewport(selectedViewport)

    // Set timeout
    page.setDefaultTimeout(30000)

    // Start coverage based on mode
    const shouldAnalyzeCSS = mode === 'css' || mode === 'both'
    const shouldAnalyzeJS = mode === 'js' || mode === 'both'

    if (shouldAnalyzeCSS) {
      await page.coverage.startCSSCoverage()
    }

    if (shouldAnalyzeJS) {
      await page.coverage.startJSCoverage()
    }

    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Extract critical CSS (above the fold)
    let criticalCSS = null
    if (extractCritical && shouldAnalyzeCSS) {
      criticalCSS = await extractCriticalCSS(page)
    }

    // Simulate interactions if requested
    if (simulateInteraction) {
      await simulatePageInteractions(page)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Stop coverage and get results
    let cssAnalysis = null
    let jsAnalysis = null

    if (shouldAnalyzeCSS) {
      const cssCoverage = await page.coverage.stopCSSCoverage()
      cssAnalysis = analyzeCSSCoverage(cssCoverage)
      if (criticalCSS) {
        cssAnalysis.critical = criticalCSS
      }
    }

    if (shouldAnalyzeJS) {
      const jsCoverage = await page.coverage.stopJSCoverage()
      jsAnalysis = analyzeJSCoverage(jsCoverage)
    }

    await browser.close()
    browser = null

    const response = {
      url,
      timestamp: new Date().toISOString(),
      mode,
      viewport: {
        type: viewport,
        width: selectedViewport.width,
        height: selectedViewport.height
      }
    }

    if (cssAnalysis) response.css = cssAnalysis
    if (jsAnalysis) response.js = jsAnalysis

    res.status(200).json(response)

  } catch (error) {
    console.error('CSS analysis error:', error)

    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('Error closing browser:', closeError)
      }
    }

    res.status(500).json({
      error: '分析に失敗しました',
      details: error.message
    })
  }
}

function analyzeCSSCoverage(coverage) {
  let totalBytes = 0
  let usedBytes = 0
  let externalTotalBytes = 0
  let externalUsedBytes = 0
  let inlineTotalBytes = 0
  let inlineUsedBytes = 0
  const files = []

  for (const entry of coverage) {
    const total = entry.text.length
    let used = 0

    // Calculate used bytes from ranges
    for (const range of entry.ranges) {
      used += range.end - range.start
    }

    const unused = total - used
    const usagePercentage = total > 0 ? (used / total) * 100 : 0

    // Determine if external or inline
    const isInline = entry.url.startsWith('data:') || entry.url.includes('<style>')
    const fileType = isInline ? 'inline' : 'external'

    totalBytes += total
    usedBytes += used

    if (isInline) {
      inlineTotalBytes += total
      inlineUsedBytes += used
    } else {
      externalTotalBytes += total
      externalUsedBytes += used
    }

    // Extract unused ranges and code
    const unusedRanges = extractUnusedRanges(entry.ranges, total)
    const unusedCode = extractUnusedCode(entry.text, unusedRanges)

    files.push({
      url: entry.url,
      totalBytes: total,
      usedBytes: used,
      unusedBytes: unused,
      usagePercentage: usagePercentage,
      type: fileType,
      unusedRanges: unusedRanges,
      unusedCode: unusedCode.length > 50000 ? unusedCode.substring(0, 50000) + '\n\n... (省略されました。ファイルが大きすぎます)' : unusedCode,
      fullText: total < 100000 ? entry.text : null // Only include full text for smaller files
    })
  }

  const unusedBytes = totalBytes - usedBytes
  const usagePercentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  // Sort files by unused bytes (descending)
  files.sort((a, b) => b.unusedBytes - a.unusedBytes)

  return {
    totalBytes,
    usedBytes,
    unusedBytes,
    usagePercentage,
    files,
    external: {
      totalBytes: externalTotalBytes,
      usedBytes: externalUsedBytes,
      unusedBytes: externalTotalBytes - externalUsedBytes,
      usagePercentage: externalTotalBytes > 0 ? (externalUsedBytes / externalTotalBytes) * 100 : 0
    },
    inline: {
      totalBytes: inlineTotalBytes,
      usedBytes: inlineUsedBytes,
      unusedBytes: inlineTotalBytes - inlineUsedBytes,
      usagePercentage: inlineTotalBytes > 0 ? (inlineUsedBytes / inlineTotalBytes) * 100 : 0
    }
  }
}

function analyzeJSCoverage(coverage) {
  let totalBytes = 0
  let usedBytes = 0
  let externalTotalBytes = 0
  let externalUsedBytes = 0
  let inlineTotalBytes = 0
  let inlineUsedBytes = 0
  const files = []

  for (const entry of coverage) {
    const total = entry.text.length
    let used = 0

    // Calculate used bytes from ranges
    for (const range of entry.ranges) {
      used += range.end - range.start
    }

    const unused = total - used
    const usagePercentage = total > 0 ? (used / total) * 100 : 0

    // Determine if external or inline
    const isInline = entry.url.startsWith('data:') || entry.url.includes('<script>')
    const fileType = isInline ? 'inline' : 'external'

    totalBytes += total
    usedBytes += used

    if (isInline) {
      inlineTotalBytes += total
      inlineUsedBytes += used
    } else {
      externalTotalBytes += total
      externalUsedBytes += used
    }

    // Extract unused ranges and code
    const unusedRanges = extractUnusedRanges(entry.ranges, total)
    const unusedCode = extractUnusedCode(entry.text, unusedRanges)

    files.push({
      url: entry.url,
      totalBytes: total,
      usedBytes: used,
      unusedBytes: unused,
      usagePercentage: usagePercentage,
      type: fileType,
      unusedRanges: unusedRanges,
      unusedCode: unusedCode.length > 50000 ? unusedCode.substring(0, 50000) + '\n\n... (省略されました。ファイルが大きすぎます)' : unusedCode,
      fullText: total < 100000 ? entry.text : null
    })
  }

  const unusedBytes = totalBytes - usedBytes
  const usagePercentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  // Sort files by unused bytes (descending)
  files.sort((a, b) => b.unusedBytes - a.unusedBytes)

  return {
    totalBytes,
    usedBytes,
    unusedBytes,
    usagePercentage,
    files,
    external: {
      totalBytes: externalTotalBytes,
      usedBytes: externalUsedBytes,
      unusedBytes: externalTotalBytes - externalUsedBytes,
      usagePercentage: externalTotalBytes > 0 ? (externalUsedBytes / externalTotalBytes) * 100 : 0
    },
    inline: {
      totalBytes: inlineTotalBytes,
      usedBytes: inlineUsedBytes,
      unusedBytes: inlineTotalBytes - inlineUsedBytes,
      usagePercentage: inlineTotalBytes > 0 ? (inlineUsedBytes / inlineTotalBytes) * 100 : 0
    }
  }
}

async function extractCriticalCSS(page) {
  try {
    const critical = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets)
      const criticalCSS = []
      const viewportHeight = window.innerHeight

      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || [])
          for (const rule of rules) {
            if (rule.type === CSSRule.STYLE_RULE) {
              // Check if any element matching this selector is above the fold
              const elements = document.querySelectorAll(rule.selectorText)
              for (const element of elements) {
                const rect = element.getBoundingClientRect()
                if (rect.top < viewportHeight && rect.bottom > 0) {
                  criticalCSS.push({
                    selector: rule.selectorText,
                    cssText: rule.cssText,
                    source: sheet.href || 'inline'
                  })
                  break
                }
              }
            }
          }
        } catch (e) {
          // Skip inaccessible stylesheets (CORS)
        }
      }

      return criticalCSS
    })

    const criticalText = critical.map(r => r.cssText).join('\n')
    const criticalSize = new Blob([criticalText]).size

    return {
      rules: critical.length,
      size: criticalSize,
      text: criticalText,
      preview: critical.slice(0, 10).map(r => r.selector)
    }
  } catch (error) {
    console.error('Critical CSS extraction error:', error)
    return null
  }
}

async function simulatePageInteractions(page) {
  try {
    await page.evaluate(async () => {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Scroll back to top
      window.scrollTo(0, 0)
      await new Promise(resolve => setTimeout(resolve, 500))

      // Trigger hover on interactive elements
      const interactiveElements = document.querySelectorAll('button, a, [role="button"], .dropdown, .menu')
      for (let i = 0; i < Math.min(interactiveElements.length, 10); i++) {
        const element = interactiveElements[i]
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Click on expandable elements if any
      const expandables = document.querySelectorAll('[aria-expanded="false"], .accordion, .collapse')
      for (let i = 0; i < Math.min(expandables.length, 5); i++) {
        try {
          expandables[i].click()
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (e) {
          // Skip elements that can't be clicked
        }
      }
    })
  } catch (error) {
    console.error('Interaction simulation error:', error)
  }
}

function extractUnusedRanges(usedRanges, totalLength) {
  if (usedRanges.length === 0) {
    return [{ start: 0, end: totalLength }]
  }

  // Sort used ranges by start position
  const sortedRanges = [...usedRanges].sort((a, b) => a.start - b.start)
  const unusedRanges = []

  // Check if there's unused code before the first used range
  if (sortedRanges[0].start > 0) {
    unusedRanges.push({ start: 0, end: sortedRanges[0].start })
  }

  // Check gaps between used ranges
  for (let i = 0; i < sortedRanges.length - 1; i++) {
    const currentEnd = sortedRanges[i].end
    const nextStart = sortedRanges[i + 1].start

    if (currentEnd < nextStart) {
      unusedRanges.push({ start: currentEnd, end: nextStart })
    }
  }

  // Check if there's unused code after the last used range
  const lastEnd = sortedRanges[sortedRanges.length - 1].end
  if (lastEnd < totalLength) {
    unusedRanges.push({ start: lastEnd, end: totalLength })
  }

  return unusedRanges
}

function extractUnusedCode(fullText, unusedRanges) {
  if (!unusedRanges || unusedRanges.length === 0) {
    return ''
  }

  const unusedCodeParts = []

  for (const range of unusedRanges) {
    const code = fullText.substring(range.start, range.end)
    const lineStart = fullText.substring(0, range.start).split('\n').length
    const lineEnd = fullText.substring(0, range.end).split('\n').length

    unusedCodeParts.push({
      lines: `行 ${lineStart}-${lineEnd}`,
      bytes: `${range.end - range.start} bytes`,
      code: code
    })
  }

  // Format for display
  return unusedCodeParts.map((part, index) =>
    `/* 未使用コード #${index + 1} (${part.lines}, ${part.bytes}) */\n${part.code}\n`
  ).join('\n')
}
