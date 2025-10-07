import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkBasicAuth } from '../lib/auth.js'
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

  try {
    const { selectedItem, pageSpeedData, deepAnalysisData, url, device } = req.body

    if (!selectedItem || !url) {
      return res.status(400).json({ error: '選択された改善項目とURLが必要です' })
    }

    console.log(`🔍 Starting detailed analysis for: ${selectedItem.title}`)

    // カテゴリ別の詳細分析を実行
    let detailedAnalysisData = {}

    if (selectedItem.category === 'JavaScript') {
      console.log('  → Running detailed JavaScript analysis...')
      detailedAnalysisData = await analyzeJavaScriptDetailed(url, selectedItem, device)
    } else if (selectedItem.category === 'CSS') {
      console.log('  → Running detailed CSS analysis...')
      detailedAnalysisData = await analyzeCSSDetailed(url, selectedItem, device)
    } else if (selectedItem.category === '画像') {
      console.log('  → Running detailed image analysis...')
      detailedAnalysisData = await analyzeImagesDetailed(url, selectedItem, device)
    } else if (selectedItem.category === 'HTML') {
      console.log('  → Running detailed HTML/DOM analysis...')
      detailedAnalysisData = await analyzeHTMLDetailed(url, selectedItem, device)
    } else {
      // その他のカテゴリは既存データを使用
      detailedAnalysisData = extractRelevantData(selectedItem, deepAnalysisData)
    }

    // AIで改善プランを生成
    console.log('  → Generating improvement plan with AI...')
    const detailedPlan = await generateImprovementPlan(selectedItem, detailedAnalysisData, pageSpeedData)

    console.log('  ✓ Detailed improvement plan generated')

    res.status(200).json({
      detailedPlan,
      analysisData: detailedAnalysisData
    })

  } catch (error) {
    console.error('Detailed Improvement API Error:', error)
    res.status(500).json({
      error: '詳細改善プランの生成に失敗しました',
      details: error.message
    })
  }
}

// JavaScript詳細分析（関数レベルのカバレッジ）
async function analyzeJavaScriptDetailed(url, selectedItem, device = 'mobile') {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })

  try {
    const page = await browser.newPage()

    if (device === 'mobile') {
      await page.setViewport({ width: 375, height: 812 })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15')
    } else {
      await page.setViewport({ width: 1920, height: 1080 })
    }

    // カバレッジ開始
    await page.coverage.startJSCoverage()

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    // カバレッジ取得
    const jsCoverage = await page.coverage.stopJSCoverage()

    // 対象ファイルのみ抽出
    const targetFiles = selectedItem.technicalDetails?.targetFiles || []
    const relevantCoverage = jsCoverage.filter(entry =>
      targetFiles.some(targetFile => entry.url.includes(targetFile))
    )

    // 詳細な使用状況を分析
    const detailedFiles = relevantCoverage.map(entry => {
      const totalBytes = entry.text.length
      const usedBytes = entry.ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
      const unusedBytes = totalBytes - usedBytes

      // 未使用範囲の詳細を抽出（最大10個まで）
      const unusedRanges = []
      let lastEnd = 0
      for (const range of entry.ranges) {
        if (range.start > lastEnd) {
          const unusedCode = entry.text.substring(lastEnd, range.start)
          unusedRanges.push({
            start: lastEnd,
            end: range.start,
            size: range.start - lastEnd,
            preview: unusedCode.substring(0, 200).replace(/\n/g, ' ').trim()
          })
        }
        lastEnd = range.end
      }

      // 残りの未使用部分
      if (lastEnd < totalBytes) {
        const unusedCode = entry.text.substring(lastEnd)
        unusedRanges.push({
          start: lastEnd,
          end: totalBytes,
          size: totalBytes - lastEnd,
          preview: unusedCode.substring(0, 200).replace(/\n/g, ' ').trim()
        })
      }

      return {
        url: entry.url,
        totalBytes,
        usedBytes,
        unusedBytes,
        usedPercentage: ((usedBytes / totalBytes) * 100).toFixed(2),
        unusedPercentage: ((unusedBytes / totalBytes) * 100).toFixed(2),
        unusedRanges: unusedRanges.slice(0, 10) // 最大10個
      }
    })

    return {
      type: 'javascript',
      files: detailedFiles,
      summary: {
        totalFiles: detailedFiles.length,
        totalSize: detailedFiles.reduce((sum, f) => sum + f.totalBytes, 0),
        totalUnused: detailedFiles.reduce((sum, f) => sum + f.unusedBytes, 0),
        potentialSavings: detailedFiles.reduce((sum, f) => sum + f.unusedBytes, 0)
      }
    }

  } finally {
    await browser.close()
  }
}

// CSS詳細分析（セレクタレベル）
async function analyzeCSSDetailed(url, selectedItem, device = 'mobile') {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })

  try {
    const page = await browser.newPage()

    if (device === 'mobile') {
      await page.setViewport({ width: 375, height: 812 })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15')
    } else {
      await page.setViewport({ width: 1920, height: 1080 })
    }

    await page.coverage.startCSSCoverage()

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    const cssCoverage = await page.coverage.stopCSSCoverage()

    const targetFiles = selectedItem.technicalDetails?.targetFiles || []
    const relevantCoverage = cssCoverage.filter(entry =>
      targetFiles.some(targetFile => entry.url.includes(targetFile))
    )

    const detailedFiles = relevantCoverage.map(entry => {
      const totalBytes = entry.text.length
      const usedBytes = entry.ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
      const unusedBytes = totalBytes - usedBytes

      // 未使用範囲の抽出
      const unusedRanges = []
      let lastEnd = 0
      for (const range of entry.ranges) {
        if (range.start > lastEnd) {
          const unusedCode = entry.text.substring(lastEnd, range.start)
          unusedRanges.push({
            start: lastEnd,
            end: range.start,
            size: range.start - lastEnd,
            preview: unusedCode.substring(0, 200).replace(/\n/g, ' ').trim()
          })
        }
        lastEnd = range.end
      }

      if (lastEnd < totalBytes) {
        const unusedCode = entry.text.substring(lastEnd)
        unusedRanges.push({
          start: lastEnd,
          end: totalBytes,
          size: totalBytes - lastEnd,
          preview: unusedCode.substring(0, 200).replace(/\n/g, ' ').trim()
        })
      }

      return {
        url: entry.url,
        totalBytes,
        usedBytes,
        unusedBytes,
        usedPercentage: ((usedBytes / totalBytes) * 100).toFixed(2),
        unusedPercentage: ((unusedBytes / totalBytes) * 100).toFixed(2),
        unusedRanges: unusedRanges.slice(0, 10)
      }
    })

    return {
      type: 'css',
      files: detailedFiles,
      summary: {
        totalFiles: detailedFiles.length,
        totalSize: detailedFiles.reduce((sum, f) => sum + f.totalBytes, 0),
        totalUnused: detailedFiles.reduce((sum, f) => sum + f.unusedBytes, 0),
        potentialSavings: detailedFiles.reduce((sum, f) => sum + f.unusedBytes, 0)
      }
    }

  } finally {
    await browser.close()
  }
}

// 画像詳細分析
async function analyzeImagesDetailed(url, selectedItem, device = 'mobile') {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })

  try {
    const page = await browser.newPage()

    if (device === 'mobile') {
      await page.setViewport({ width: 375, height: 812 })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15')
    } else {
      await page.setViewport({ width: 1920, height: 1080 })
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    // 画像情報を詳細に取得
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      return imgs.map(img => {
        const rect = img.getBoundingClientRect()
        const computedStyle = window.getComputedStyle(img)

        return {
          src: img.src || img.currentSrc,
          alt: img.alt,
          width: img.naturalWidth,
          height: img.naturalHeight,
          displayWidth: rect.width,
          displayHeight: rect.height,
          loading: img.loading,
          decoding: img.decoding,
          format: img.src.split('.').pop().split('?')[0].toLowerCase(),
          isVisible: rect.top < window.innerHeight && rect.bottom > 0,
          isInViewport: rect.top >= 0 && rect.bottom <= window.innerHeight,
          objectFit: computedStyle.objectFit,
          position: { top: rect.top, left: rect.left }
        }
      })
    })

    // 画像最適化の可能性を分析
    const detailedImages = images.map(img => {
      const oversized = img.width > img.displayWidth * 2 || img.height > img.displayHeight * 2
      const shouldBeLazy = !img.isInViewport && img.loading !== 'lazy'
      const shouldBeWebP = !['webp', 'avif'].includes(img.format)

      // サイズ削減の試算（概算）
      const currentSize = (img.width * img.height * 3) / 1024 // RGB概算
      const optimizedSize = oversized
        ? (img.displayWidth * 2 * img.displayHeight * 2 * 3) / 1024
        : currentSize
      const webpSavings = shouldBeWebP ? currentSize * 0.3 : 0 // WebPで約30%削減

      return {
        ...img,
        issues: {
          oversized,
          shouldBeLazy,
          shouldBeWebP,
          missingAlt: !img.alt
        },
        optimization: {
          currentEstimatedSize: currentSize.toFixed(2) + ' KB',
          optimizedSize: optimizedSize.toFixed(2) + ' KB',
          webpSavings: webpSavings.toFixed(2) + ' KB',
          totalPotentialSavings: ((currentSize - optimizedSize) + webpSavings).toFixed(2) + ' KB'
        }
      }
    })

    return {
      type: 'image',
      images: detailedImages,
      summary: {
        totalImages: detailedImages.length,
        oversizedImages: detailedImages.filter(img => img.issues.oversized).length,
        missingLazy: detailedImages.filter(img => img.issues.shouldBeLazy).length,
        nonWebP: detailedImages.filter(img => img.issues.shouldBeWebP).length,
        missingAlt: detailedImages.filter(img => img.issues.missingAlt).length
      }
    }

  } finally {
    await browser.close()
  }
}

// HTML/DOM詳細分析
async function analyzeHTMLDetailed(url, selectedItem, device = 'mobile') {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless
  })

  try {
    const page = await browser.newPage()

    if (device === 'mobile') {
      await page.setViewport({ width: 375, height: 812 })
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15')
    } else {
      await page.setViewport({ width: 1920, height: 1080 })
    }

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })

    const domAnalysis = await page.evaluate(() => {
      // DOM構造の詳細分析
      function analyzeNode(node, depth = 0) {
        if (depth > 20) return null // 深すぎる場合は打ち切り

        const childCount = node.children ? node.children.length : 0
        const maxChildDepth = Array.from(node.children || [])
          .map(child => analyzeNode(child, depth + 1))
          .filter(Boolean)
          .reduce((max, child) => Math.max(max, child.depth), depth)

        return {
          tag: node.tagName,
          depth,
          childCount,
          maxDepth: maxChildDepth
        }
      }

      const rootAnalysis = analyzeNode(document.body)

      return {
        totalNodes: document.querySelectorAll('*').length,
        depth: rootAnalysis.maxDepth,
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script').length,
        stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
        iframes: document.querySelectorAll('iframe').length,
        forms: document.querySelectorAll('form').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
        buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length
      }
    })

    return {
      type: 'html',
      dom: domAnalysis,
      recommendations: generateDOMRecommendations(domAnalysis)
    }

  } finally {
    await browser.close()
  }
}

function generateDOMRecommendations(domAnalysis) {
  const recommendations = []

  if (domAnalysis.totalNodes > 1500) {
    recommendations.push('DOM要素が1500を超えています。不要な要素を削減してください。')
  }

  if (domAnalysis.depth > 15) {
    recommendations.push('DOMの深さが15を超えています。ネストを浅くすることを検討してください。')
  }

  return recommendations
}

// 既存データから関連情報を抽出
function extractRelevantData(selectedItem, deepAnalysisData) {
  if (!deepAnalysisData) return {}

  const category = selectedItem.category
  const targetFiles = selectedItem.technicalDetails?.targetFiles || []

  if (category === 'JavaScript' && deepAnalysisData.analysis?.coverage?.js) {
    const jsFiles = deepAnalysisData.analysis.coverage.js.filter(j =>
      targetFiles.some(f => j.url.includes(f))
    )
    return { type: 'javascript', files: jsFiles }
  }

  if (category === 'CSS' && deepAnalysisData.analysis?.coverage?.css) {
    const cssFiles = deepAnalysisData.analysis.coverage.css.filter(c =>
      targetFiles.some(f => c.url.includes(f))
    )
    return { type: 'css', files: cssFiles }
  }

  return { type: 'other', data: deepAnalysisData }
}

// AIで改善プランを生成
async function generateImprovementPlan(selectedItem, detailedAnalysisData, pageSpeedData) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  })

  // 分析データをプロンプト用に整形
  let analysisContext = ''

  if (detailedAnalysisData.type === 'javascript') {
    analysisContext = `## JavaScript詳細分析結果
総ファイル数: ${detailedAnalysisData.summary.totalFiles}
総サイズ: ${(detailedAnalysisData.summary.totalSize / 1024).toFixed(2)} KB
未使用コード: ${(detailedAnalysisData.summary.totalUnused / 1024).toFixed(2)} KB
削減可能サイズ: ${(detailedAnalysisData.summary.potentialSavings / 1024).toFixed(2)} KB

### ファイル詳細
${detailedAnalysisData.files.map(f => `
- ${f.url}
  - 総サイズ: ${(f.totalBytes / 1024).toFixed(2)} KB
  - 使用率: ${f.usedPercentage}%
  - 未使用: ${(f.unusedBytes / 1024).toFixed(2)} KB
  - 未使用コード例: ${f.unusedRanges.slice(0, 3).map(r => `\n    - [${r.start}-${r.end}] ${r.preview.substring(0, 100)}...`).join('')}
`).join('\n')}`
  } else if (detailedAnalysisData.type === 'css') {
    analysisContext = `## CSS詳細分析結果
総ファイル数: ${detailedAnalysisData.summary.totalFiles}
総サイズ: ${(detailedAnalysisData.summary.totalSize / 1024).toFixed(2)} KB
未使用CSS: ${(detailedAnalysisData.summary.totalUnused / 1024).toFixed(2)} KB
削減可能サイズ: ${(detailedAnalysisData.summary.potentialSavings / 1024).toFixed(2)} KB

### ファイル詳細
${detailedAnalysisData.files.map(f => `
- ${f.url}
  - 総サイズ: ${(f.totalBytes / 1024).toFixed(2)} KB
  - 使用率: ${f.usedPercentage}%
  - 未使用: ${(f.unusedBytes / 1024).toFixed(2)} KB
`).join('\n')}`
  } else if (detailedAnalysisData.type === 'image') {
    analysisContext = `## 画像詳細分析結果
総画像数: ${detailedAnalysisData.summary.totalImages}
サイズ過大な画像: ${detailedAnalysisData.summary.oversizedImages}
遅延読み込み未設定: ${detailedAnalysisData.summary.missingLazy}
WebP未使用: ${detailedAnalysisData.summary.nonWebP}
alt属性なし: ${detailedAnalysisData.summary.missingAlt}

### 問題のある画像トップ10
${detailedAnalysisData.images
  .filter(img => img.issues.oversized || img.issues.shouldBeLazy || img.issues.shouldBeWebP)
  .slice(0, 10)
  .map(img => `
- ${img.src}
  - 実サイズ: ${img.width}x${img.height}
  - 表示サイズ: ${img.displayWidth.toFixed(0)}x${img.displayHeight.toFixed(0)}
  - フォーマット: ${img.format}
  - 問題: ${Object.entries(img.issues).filter(([k, v]) => v).map(([k]) => k).join(', ')}
  - 削減可能: ${img.optimization.totalPotentialSavings}
`).join('\n')}`
  } else if (detailedAnalysisData.type === 'html') {
    analysisContext = `## DOM構造分析結果
${JSON.stringify(detailedAnalysisData.dom, null, 2)}

推奨事項:
${detailedAnalysisData.recommendations.join('\n')}`
  }

  const prompt = `あなたはWebパフォーマンス最適化の専門家です。以下の詳細な分析結果に基づき、実装可能な改善プランを作成してください。

# 選択された改善項目
- タイトル: ${selectedItem.title}
- カテゴリ: ${selectedItem.category}
- 優先度: ${selectedItem.priority}
- 難易度: ${selectedItem.difficulty}
- 予想改善効果: ${selectedItem.estimatedImprovement}
- 要約: ${selectedItem.summary}

${analysisContext}

# 出力フォーマット
以下のJSON形式で詳細な改善プランを出力してください：

\`\`\`json
{
  "title": "${selectedItem.title}",
  "steps": [
    {
      "stepNumber": 1,
      "title": "ステップのタイトル",
      "description": "何をするかの具体的な説明。上記の分析結果の数値を使用すること。",
      "codeExample": "具体的なコード例（該当する場合）",
      "tools": ["使用するツールやライブラリ"],
      "estimatedTime": "所要時間の目安"
    }
  ],
  "beforeAfter": {
    "before": "改善前の状態（上記分析結果の具体的な数値を使用）",
    "after": "改善後の予想（具体的な数値で）"
  },
  "warnings": ["注意点や潜在的な問題"],
  "testingInstructions": "改善後の検証方法",
  "references": ["参考URL"]
}
\`\`\`

重要：
- 上記の詳細分析結果に含まれる**実際の数値とファイル名**を使用してください
- 実装可能な具体的な手順を提示してください
- コード例は実際に動作するものを提供してください
- 「分析します」ではなく「分析した結果、○○が判明しました」という表現を使ってください`

  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()

  try {
    return JSON.parse(text)
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON:', e)
    throw new Error('AI応答の解析に失敗しました')
  }
}
