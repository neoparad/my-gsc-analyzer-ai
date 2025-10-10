import React, { useState } from 'react'
import { Code, FileCode, TrendingUp, AlertCircle, CheckCircle, Download, Monitor, Smartphone, Tablet, Zap, FileText, GitCompare, Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'

function CSSJSAnalysis() {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState('both')
  const [viewport, setViewport] = useState('desktop')
  const [extractCritical, setExtractCritical] = useState(false)
  const [simulateInteraction, setSimulateInteraction] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [comparisonResults, setComparisonResults] = useState([])
  const [aiDiagnosis, setAiDiagnosis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [expandedSuggestions, setExpandedSuggestions] = useState({})
  const [copiedCode, setCopiedCode] = useState({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [showUnusedModal, setShowUnusedModal] = useState(false)

  const handleAnalyze = async () => {
    if (!url) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError(null)

    if (!comparisonMode) {
      setResults(null)
    }

    try {
      const response = await fetch('/api/cssjs-analysis/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ url, mode, viewport, extractCritical, simulateInteraction })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '分析に失敗しました')
      }

      const data = await response.json()

      if (comparisonMode) {
        setComparisonResults(prev => [...prev, data])
      } else {
        setResults(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleComparisonAnalyze = async () => {
    setComparisonMode(true)
    setComparisonResults([])

    const viewports = ['mobile', 'tablet', 'desktop']

    for (const vp of viewports) {
      setViewport(vp)
      setLoading(true)

      try {
        const response = await fetch('/api/cssjs-analysis/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ url, mode, viewport: vp, extractCritical, simulateInteraction })
        })

        if (response.ok) {
          const data = await response.json()
          setComparisonResults(prev => [...prev, data])
        }
      } catch (err) {
        console.error(`Error analyzing ${vp}:`, err)
      }
    }

    setLoading(false)
  }

  const handleExportJSON = () => {
    if (!results && comparisonResults.length === 0) return

    const exportData = comparisonMode ? comparisonResults : results
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cssjs-analysis-${new Date().getTime()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleExportHTML = () => {
    if (!results && comparisonResults.length === 0) return

    const data = comparisonMode ? comparisonResults : [results]
    const html = generateHTMLReport(data)
    const dataBlob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cssjs-report-${new Date().getTime()}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleAIDiagnosis = async () => {
    if (!results) return

    setAiLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/cssjs-analysis/ai-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ analysisData: results })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'AI診断に失敗しました')
      }

      const data = await response.json()
      setAiDiagnosis(data.diagnosis)
    } catch (err) {
      console.error('AI Diagnosis Error:', err)
      setError(`AI診断エラー: ${err.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const toggleSuggestion = (index) => {
    setExpandedSuggestions(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(prev => ({ ...prev, [index]: true }))
    setTimeout(() => {
      setCopiedCode(prev => ({ ...prev, [index]: false }))
    }, 2000)
  }

  const showUnusedCode = (file) => {
    setSelectedFile(file)
    setShowUnusedModal(true)
  }

  const closeUnusedModal = () => {
    setShowUnusedModal(false)
    setSelectedFile(null)
  }

  const copyUnusedCode = () => {
    if (selectedFile?.unusedCode) {
      navigator.clipboard.writeText(selectedFile.unusedCode)
    }
  }

  const generateHTMLReport = (data) => {
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
    }

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS/JavaScript解析レポート</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f3f4f6; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #1f2937; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .stat { background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #6366f1; }
    .stat-label { font-size: 14px; color: #6b7280; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
    .good { color: #10b981; }
    .warning { color: #f59e0b; }
    .bad { color: #ef4444; }
    .file-list { margin: 20px 0; }
    .file-item { background: #f9fafb; padding: 12px; margin: 8px 0; border-radius: 6px; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; background: #10b981; }
    .critical-css { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
    .comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
    .device-card { background: #f9fafb; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 CSS/JavaScript解析レポート</h1>
    <p><strong>生成日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>

    ${data.map((result, idx) => `
      <div class="device-card">
        <h2>🖥️ ${result.viewport.type.toUpperCase()} (${result.viewport.width}x${result.viewport.height})</h2>
        <p><strong>URL:</strong> ${result.url}</p>
        <p><strong>分析日時:</strong> ${new Date(result.timestamp).toLocaleString('ja-JP')}</p>

        ${result.css ? `
          <h3>CSS解析結果</h3>
          <div class="stat">
            <div class="stat-label">総CSSサイズ</div>
            <div class="stat-value">${formatBytes(result.css.totalBytes)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">使用率</div>
            <div class="stat-value ${result.css.usagePercentage >= 70 ? 'good' : result.css.usagePercentage >= 40 ? 'warning' : 'bad'}">
              ${result.css.usagePercentage.toFixed(1)}%
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">未使用コード</div>
            <div class="stat-value bad">${formatBytes(result.css.unusedBytes)}</div>
          </div>

          ${result.css.critical ? `
            <div class="critical-css">
              <h4>⚡ クリティカルCSS</h4>
              <p><strong>ルール数:</strong> ${result.css.critical.rules}</p>
              <p><strong>サイズ:</strong> ${formatBytes(result.css.critical.size)}</p>
              <p><strong>主要セレクタ:</strong> ${result.css.critical.preview.join(', ')}</p>
            </div>
          ` : ''}

          <h4>ファイル別詳細</h4>
          <div class="file-list">
            ${result.css.files.map(file => `
              <div class="file-item">
                <div><strong>${file.type === 'external' ? '📄' : '📝'} ${file.url.substring(0, 100)}</strong></div>
                <div>サイズ: ${formatBytes(file.totalBytes)} | 使用率: ${file.usagePercentage.toFixed(1)}%</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${file.usagePercentage}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${result.js ? `
          <h3>JavaScript解析結果</h3>
          <div class="stat">
            <div class="stat-label">総JavaScriptサイズ</div>
            <div class="stat-value">${formatBytes(result.js.totalBytes)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">使用率</div>
            <div class="stat-value ${result.js.usagePercentage >= 70 ? 'good' : result.js.usagePercentage >= 40 ? 'warning' : 'bad'}">
              ${result.js.usagePercentage.toFixed(1)}%
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">未使用コード</div>
            <div class="stat-value bad">${formatBytes(result.js.unusedBytes)}</div>
          </div>
        ` : ''}
      </div>
    `).join('')}

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
      <p>AISEO Analyze - CSS/JavaScript解析ツール</p>
    </footer>
  </div>
</body>
</html>`
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getUsageColor = (percentage) => {
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const COLORS = {
    used: '#10b981',
    unused: '#ef4444',
    external: '#3b82f6',
    inline: '#8b5cf6'
  }

  const getPriorityColor = (priority) => {
    if (priority === '高') return 'bg-red-100 text-red-700 border-red-300'
    if (priority === '中') return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty === '易') return 'bg-green-100 text-green-700'
    if (difficulty === '中') return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const getCategoryColor = (category) => {
    const colors = {
      '遅延読み込み': 'bg-purple-100 text-purple-700',
      '非同期化': 'bg-indigo-100 text-indigo-700',
      'コード分割': 'bg-blue-100 text-blue-700',
      'クリティカルCSS': 'bg-yellow-100 text-yellow-700',
      'Tree-shaking': 'bg-green-100 text-green-700',
      '圧縮': 'bg-cyan-100 text-cyan-700',
      '削除': 'bg-red-100 text-red-700'
    }
    return colors[category] || 'bg-gray-100 text-gray-700'
  }

  const renderAIDiagnosis = () => {
    if (!aiDiagnosis) return null

    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🤖 AI深堀診断</h2>
            <p className="text-sm text-gray-600">AIによる詳細な改善提案と実装ガイド</p>
          </div>
        </div>

        {/* Summary */}
        {aiDiagnosis.summary && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl mb-6 border-l-4 border-purple-500">
            <h3 className="text-lg font-bold text-purple-900 mb-3">総合サマリー</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-purple-700">合計削減見込み</div>
                <div className="text-2xl font-bold text-purple-900">{aiDiagnosis.summary.totalEstimatedReduction}</div>
              </div>
              <div>
                <div className="text-sm text-purple-700">パフォーマンス改善</div>
                <div className="text-2xl font-bold text-purple-900">{aiDiagnosis.summary.expectedPerformanceGain}</div>
              </div>
              <div>
                <div className="text-sm text-purple-700">提案数</div>
                <div className="text-2xl font-bold text-purple-900">{aiDiagnosis.suggestions?.length || 0}件</div>
              </div>
            </div>
            <div className="text-sm text-purple-800">
              <strong>推奨実装順序:</strong> {aiDiagnosis.summary.recommendedOrder}
            </div>
          </div>
        )}

        {/* Suggestions */}
        <div className="space-y-4">
          {aiDiagnosis.suggestions?.map((suggestion, index) => (
            <div key={index} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Suggestion Header */}
              <div
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleSuggestion(index)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(suggestion.priority)}`}>
                        優先度: {suggestion.priority}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getDifficultyColor(suggestion.difficulty)}`}>
                        難易度: {suggestion.difficulty}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getCategoryColor(suggestion.category)}`}>
                        {suggestion.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{suggestion.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                  </div>
                  <div>
                    {expandedSuggestions[index] ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Impact Preview */}
                <div className="flex gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">影響度:</span>
                    <span className="font-semibold text-gray-800">{suggestion.impact?.performance}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">削減見込み:</span>
                    <span className="font-semibold text-gray-800">{suggestion.impact?.estimatedReduction}</span>
                  </div>
                  {suggestion.impact?.metrics && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">改善指標:</span>
                      <span className="font-semibold text-gray-800">{suggestion.impact.metrics.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedSuggestions[index] && (
                <div className="p-6 bg-white border-t border-gray-200">
                  {/* Before/After */}
                  {suggestion.beforeAfter && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="text-sm font-bold text-red-900 mb-2">改善前</h4>
                        <p className="text-sm text-red-800">{suggestion.beforeAfter.before}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="text-sm font-bold text-green-900 mb-2">改善後</h4>
                        <p className="text-sm text-green-800">{suggestion.beforeAfter.after}</p>
                      </div>
                    </div>
                  )}

                  {/* Implementation Steps */}
                  {suggestion.implementation?.steps && (
                    <div className="mb-6">
                      <h4 className="text-sm font-bold text-gray-800 mb-3">実装手順</h4>
                      <ol className="list-decimal list-inside space-y-2">
                        {suggestion.implementation.steps.map((step, stepIndex) => (
                          <li key={stepIndex} className="text-sm text-gray-700">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Code Example */}
                  {suggestion.implementation?.codeExample && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-800">実装コード例</h4>
                        <button
                          onClick={() => copyCode(suggestion.implementation.codeExample, index)}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition-colors"
                        >
                          {copiedCode[index] ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              コピー済み
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              コピー
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{suggestion.implementation.codeExample}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderDeviceComparison = () => {
    if (comparisonResults.length === 0) return null

    const comparisonData = comparisonResults.map(result => ({
      device: result.viewport.type,
      cssUsage: result.css?.usagePercentage || 0,
      jsUsage: result.js?.usagePercentage || 0,
      cssSize: result.css?.totalBytes || 0,
      jsSize: result.js?.totalBytes || 0
    }))

    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <GitCompare className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">デバイス別比較</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-gray-700 mb-3">使用率比較</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={comparisonData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="device" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name="CSS使用率" dataKey="cssUsage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Radar name="JS使用率" dataKey="jsUsage" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-gray-700 mb-3">ファイルサイズ比較</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="device" />
                <YAxis tickFormatter={(value) => formatBytes(value)} />
                <Tooltip formatter={(value) => formatBytes(value)} />
                <Bar dataKey="cssSize" fill={COLORS.external} name="CSS" />
                <Bar dataKey="jsSize" fill={COLORS.inline} name="JavaScript" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {comparisonResults.map((result, idx) => (
            <div key={idx} className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                {result.viewport.type === 'mobile' && <Smartphone className="w-5 h-5 text-purple-600" />}
                {result.viewport.type === 'tablet' && <Tablet className="w-5 h-5 text-purple-600" />}
                {result.viewport.type === 'desktop' && <Monitor className="w-5 h-5 text-purple-600" />}
                <h3 className="font-bold text-gray-800">{result.viewport.type.toUpperCase()}</h3>
              </div>
              <div className="text-xs text-gray-600 mb-2">{result.viewport.width}x{result.viewport.height}</div>
              {result.css && (
                <div className="mb-2">
                  <div className="text-sm text-gray-600">CSS使用率</div>
                  <div className={`text-2xl font-bold ${getUsageColor(result.css.usagePercentage)}`}>
                    {result.css.usagePercentage.toFixed(1)}%
                  </div>
                </div>
              )}
              {result.js && (
                <div>
                  <div className="text-sm text-gray-600">JS使用率</div>
                  <div className={`text-2xl font-bold ${getUsageColor(result.js.usagePercentage)}`}>
                    {result.js.usagePercentage.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderCoverageSection = (data, title, Icon) => {
    if (!data) return null

    const fileTypeData = [
      { name: '外部ファイル', value: data.external.totalBytes, used: data.external.usedBytes },
      { name: 'インライン', value: data.inline.totalBytes, used: data.inline.usedBytes }
    ].filter(item => item.value > 0)

    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Icon className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          </div>
        </div>

        {/* Critical CSS Section */}
        {data.critical && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-xl mb-6 border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-bold text-yellow-900">クリティカルCSS（Above the Fold）</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-yellow-700">ルール数</div>
                <div className="text-2xl font-bold text-yellow-900">{data.critical.rules}</div>
              </div>
              <div>
                <div className="text-sm text-yellow-700">サイズ</div>
                <div className="text-2xl font-bold text-yellow-900">{formatBytes(data.critical.size)}</div>
              </div>
            </div>
            <div className="text-sm text-yellow-800">
              <strong>主要セレクタ:</strong> {data.critical.preview.join(', ')}
            </div>
            <button
              onClick={() => {
                const blob = new Blob([data.critical.text], { type: 'text/css' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = 'critical.css'
                link.click()
                URL.revokeObjectURL(url)
              }}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-700 transition-colors"
            >
              critical.cssをダウンロード
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">総サイズ</div>
              <div className="text-3xl font-bold text-gray-800">
                {formatBytes(data.totalBytes)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">使用済み</div>
              <div className="text-3xl font-bold text-green-600">
                {formatBytes(data.usedBytes)}
              </div>
              <div className={`text-2xl font-bold mt-2 ${getUsageColor(data.usagePercentage)}`}>
                {data.usagePercentage.toFixed(1)}%
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">未使用</div>
              <div className="text-3xl font-bold text-red-600">
                {formatBytes(data.unusedBytes)}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {data.files.length} ファイル
              </div>
            </div>

            {/* External vs Inline Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">外部ファイル</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatBytes(data.external.totalBytes)}
                </div>
                <div className={`text-sm font-semibold ${getUsageColor(data.external.usagePercentage)}`}>
                  {data.external.usagePercentage.toFixed(1)}%
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">インライン</div>
                <div className="text-lg font-bold text-purple-600">
                  {formatBytes(data.inline.totalBytes)}
                </div>
                <div className={`text-sm font-semibold ${getUsageColor(data.inline.usagePercentage)}`}>
                  {data.inline.usagePercentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-6">
            {/* Pie Chart - Used vs Unused */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <h3 className="text-sm font-bold text-gray-700 mb-3">使用状況</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: '使用済み', value: data.usedBytes },
                      { name: '未使用', value: data.unusedBytes }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill={COLORS.used} />
                    <Cell fill={COLORS.unused} />
                  </Pie>
                  <Tooltip formatter={(value) => formatBytes(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart - External vs Inline */}
            {fileTypeData.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-gray-700 mb-3">ファイルタイプ別</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={fileTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatBytes(value)} />
                    <Tooltip formatter={(value) => formatBytes(value)} />
                    <Bar dataKey="value" fill={COLORS.external} name="総サイズ" />
                    <Bar dataKey="used" fill={COLORS.used} name="使用済み" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* File Details */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">ファイル別詳細</h3>
          <div className="space-y-3">
            {data.files.map((file, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        file.type === 'external' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {file.type === 'external' ? '外部' : 'インライン'}
                      </span>
                      <div className="font-mono text-sm text-gray-800 truncate" title={file.url}>
                        {file.url.length > 80 ? '...' + file.url.slice(-80) : file.url}
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${getUsageColor(file.usagePercentage)}`}>
                    {file.usagePercentage.toFixed(1)}%
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-gray-600 mb-2">
                  <span>総サイズ: {formatBytes(file.totalBytes)}</span>
                  <span>使用済み: {formatBytes(file.usedBytes)}</span>
                  <span>未使用: {formatBytes(file.unusedBytes)}</span>
                </div>
                {/* Progress Bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${file.usagePercentage}%` }}
                  />
                </div>
                {/* Show Unused Code Button */}
                {file.unusedBytes > 0 && file.unusedCode && (
                  <div className="mt-3">
                    <button
                      onClick={() => showUnusedCode(file)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      <FileCode className="w-4 h-4" />
                      未使用コードを表示（削除推奨箇所）
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {data.usagePercentage < 70 && (
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-yellow-900 mb-2">改善の余地があります</h3>
                <p className="text-yellow-800 mb-3">
                  使用率が{data.usagePercentage.toFixed(1)}%と低めです。
                  約{formatBytes(data.unusedBytes)}の未使用コードが含まれています。
                </p>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
                  <li>未使用のコードを削除することでファイルサイズを削減できます</li>
                  <li>使用率の低いファイルは分割や最適化を検討してください</li>
                  {data.external.unusedBytes > data.external.totalBytes * 0.5 && (
                    <li>外部ファイルに大量の未使用コードがあります。Tree-shakingやコード分割を検討してください</li>
                  )}
                  {data.inline.unusedBytes > data.inline.totalBytes * 0.5 && (
                    <li>インラインコードに未使用部分が多く含まれています。最適化を検討してください</li>
                  )}
                  {data.critical && (
                    <li>クリティカルCSSをインライン化し、残りを遅延読み込みすることでFCPを改善できます</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {data.usagePercentage >= 70 && (
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-green-900 mb-2">良好な状態です</h3>
                <p className="text-green-800">
                  使用率が{data.usagePercentage.toFixed(1)}%と高く、効率的に最適化されています。
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
              <Code className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">CSS/JavaScript解析</h1>
              <p className="text-gray-600 mt-1">不要なコードを検出してパフォーマンスを改善</p>
            </div>
          </div>

          {/* Analysis Mode Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              分析モード
            </label>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setMode('both')}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  mode === 'both'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                CSS + JavaScript
              </button>
              <button
                onClick={() => setMode('css')}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  mode === 'css'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                CSSのみ
              </button>
              <button
                onClick={() => setMode('js')}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  mode === 'js'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                JavaScriptのみ
              </button>
            </div>
          </div>

          {/* Viewport Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ビューポート
            </label>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setViewport('mobile')}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  viewport === 'mobile'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                モバイル (375x667)
              </button>
              <button
                onClick={() => setViewport('tablet')}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  viewport === 'tablet'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Tablet className="w-4 h-4" />
                タブレット (768x1024)
              </button>
              <button
                onClick={() => setViewport('desktop')}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  viewport === 'desktop'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Monitor className="w-4 h-4" />
                デスクトップ (1920x1080)
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              詳細オプション
            </label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractCritical}
                  onChange={(e) => setExtractCritical(e.target.checked)}
                  disabled={loading || mode === 'js'}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">クリティカルCSS抽出</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateInteraction}
                  onChange={(e) => setSimulateInteraction(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">インタラクションシミュレーション</span>
              </label>
            </div>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              分析対象URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? '分析中...' : '分析開始'}
              </button>
              <button
                onClick={handleComparisonAnalyze}
                disabled={loading || !url}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <GitCompare className="w-4 h-4" />
                {loading ? '比較中...' : 'デバイス比較'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-red-800">{error}</div>
            </div>
          )}
        </div>

        {/* Results */}
        {(results || comparisonResults.length > 0) && (
          <div className="space-y-6">
            {/* Export Buttons */}
            <div className="flex justify-end gap-3">
              {results && !comparisonMode && (
                <button
                  onClick={handleAIDiagnosis}
                  disabled={aiLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  {aiLoading ? 'AI診断中...' : '🤖 AIで深堀診断'}
                </button>
              )}
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <Download className="w-4 h-4" />
                JSON出力
              </button>
              <button
                onClick={handleExportHTML}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <FileText className="w-4 h-4" />
                HTMLレポート出力
              </button>
            </div>

            {/* AI Diagnosis */}
            {renderAIDiagnosis()}

            {/* Device Comparison */}
            {comparisonMode && renderDeviceComparison()}

            {/* CSS Coverage */}
            {results?.css && renderCoverageSection(results.css, 'CSS使用状況', FileCode)}

            {/* JavaScript Coverage */}
            {results?.js && renderCoverageSection(results.js, 'JavaScript使用状況', Code)}
          </div>
        )}

        {/* Unused Code Modal */}
        {showUnusedModal && selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeUnusedModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">未使用コード（削除推奨箇所）</h3>
                  <div className="font-mono text-sm text-gray-600 break-all">{selectedFile.url}</div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-gray-600">
                      未使用: <span className="font-bold text-red-600">{formatBytes(selectedFile.unusedBytes)}</span>
                    </span>
                    <span className="text-gray-600">
                      使用率: <span className={`font-bold ${getUsageColor(selectedFile.usagePercentage)}`}>
                        {selectedFile.usagePercentage.toFixed(1)}%
                      </span>
                    </span>
                    <span className="text-gray-600">
                      未使用範囲: <span className="font-bold">{selectedFile.unusedRanges?.length || 0}箇所</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeUnusedModal}
                  className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>削除方法:</strong> 以下のコードは現在のページで使用されていません。これらのコードをファイルから削除することで、ファイルサイズを削減し、パフォーマンスを改善できます。ただし、他のページで使用されている可能性があるため、削除前に十分な確認を行ってください。
                    </div>
                  </div>
                </div>

                {selectedFile.unusedCode ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-800">未使用コード一覧</h4>
                      <button
                        onClick={copyUnusedCode}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        コードをコピー
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed">
                      <code>{selectedFile.unusedCode}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    未使用コードの詳細情報がありません
                  </div>
                )}

                {/* Usage Instructions */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">削除手順の推奨事項</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>該当ファイルのバックアップを作成してください</li>
                    <li>上記の未使用コードをファイルから検索して特定してください</li>
                    <li>他のページでも使用されていないことを確認してください</li>
                    <li>テスト環境で削除後の動作を確認してください</li>
                    <li>問題がなければ本番環境に適用してください</li>
                  </ol>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={copyUnusedCode}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  コードをコピー
                </button>
                <button
                  onClick={closeUnusedModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CSSJSAnalysis
