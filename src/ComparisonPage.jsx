import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, Legend, Line, LineChart } from 'recharts'
import { Download, ExternalLink, TrendingUp, TrendingDown, Plus, Minus, BarChart3, Table, Settings, BarChart2, Brain } from 'lucide-react'
import AnalysisSettingModal from './AnalysisSettingModal'
import StatisticalAnalysisResult from './StatisticalAnalysisResult'
import AIAnalysisResult from './AIAnalysisResult'

function ComparisonPage() {
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('comparison_formData')
    return saved ? JSON.parse(saved) : {
      site_url: '',
      past_start: '',
      past_end: '',
      current_start: '',
      current_end: '',
      url_filter: '',
      query_filter: ''
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(() => {
    const saved = sessionStorage.getItem('comparison_results')
    return saved ? JSON.parse(saved) : null
  })
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('comparison_activeTab') || 'improved')
  const [currentPage, setCurrentPage] = useState(1)

  // 状態変更時にセッションストレージに保存
  useEffect(() => { sessionStorage.setItem('comparison_formData', JSON.stringify(formData)) }, [formData])
  useEffect(() => { if (results) sessionStorage.setItem('comparison_results', JSON.stringify(results)) }, [results])
  useEffect(() => { sessionStorage.setItem('comparison_activeTab', activeTab) }, [activeTab])
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [statusFilter, setStatusFilter] = useState('all')

  // 詳細分析関連のstate
  const [showSettingModal, setShowSettingModal] = useState(false)
  const [analysisSettings, setAnalysisSettings] = useState(null)
  const [statisticalLoading, setStatisticalLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [statisticalResult, setStatisticalResult] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [analysisError, setAnalysisError] = useState('')

  // Basic認証ヘッダーを取得する関数
  const getBasicAuthHeader = () => {
    // ブラウザが自動的にBasic認証を処理するため、通常は不要
    // ただし、念のため現在の認証情報があれば使用
    return null
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')

    try {
      // Basic認証ヘッダーを取得
      const authHeader = getBasicAuthHeader()

      // 実際のAPI呼び出し
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader })
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data)
      setCurrentPage(1)
      setStatusFilter('all')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setStatusFilter('all')
  }

  const downloadCSV = () => {
    if (!results) return

    const currentData = activeTab === 'improved' ? results.improved_queries : results.declined_queries
    const headers = ['クエリ', 'URL', 'ディレクトリ', '過去順位', '現在順位', '変化', 'クリック変化', 'ステータス']
    const csvContent = [
      headers.join(','),
      ...currentData.map(row => [
        `"${row.query}"`,
        `"${row.url}"`,
        `"${row.directory}"`,
        row.past_position || 'N/A',
        row.current_position || 'N/A',
        row.change || 'N/A',
        row.clicks_change || 'N/A',
        `"${row.status}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `search_console_analysis_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const createSpreadsheet = async () => {
    if (!results) return

    try {
      // Basic認証ヘッダーを取得
      const authHeader = getBasicAuthHeader()

      const currentData = activeTab === 'improved' ? results.improved_queries : results.declined_queries
      const headers = ['クエリ', 'URL', 'ディレクトリ', '過去順位', '現在順位', '変化', 'クリック変化', 'ステータス']
      const rows = [
        headers,
        ...currentData.map(row => [
          row.query,
          row.url,
          row.directory,
          row.past_position || 'N/A',
          row.current_position || 'N/A',
          row.change || 'N/A',
          row.clicks_change || 'N/A',
          row.status
        ])
      ]

      const response = await fetch('/api/create_sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader })
        },
        body: JSON.stringify({
          data: rows,
          title: `Search Console 順位変化分析 (${activeTab === 'improved' ? '改善' : '悪化'}) - ${new Date().toLocaleDateString('ja-JP')}`
        })
      })

      if (response.ok) {
        const result = await response.json()
        window.open(result.url, '_blank')
      } else {
        throw new Error('スプレッドシートの作成に失敗しました')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const getFilteredData = () => {
    if (!results) return []
    const currentData = activeTab === 'improved' ? results.improved_queries : results.declined_queries

    if (statusFilter === 'all') return currentData

    if (activeTab === 'improved') {
      switch (statusFilter) {
        case 'new': return currentData.filter(item => item.status === 'new')
        case 'improved': return currentData.filter(item => item.status === 'improved')
        default: return currentData
      }
    } else {
      switch (statusFilter) {
        case 'disappeared': return currentData.filter(item => item.status === 'disappeared')
        case 'declined': return currentData.filter(item => item.status === 'declined')
        default: return currentData
      }
    }
  }

  const getCurrentPageData = () => {
    const filteredData = getFilteredData()
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }

  const getTotalPages = () => {
    const filteredData = getFilteredData()
    return Math.ceil(filteredData.length / itemsPerPage)
  }

  const getScatterData = () => {
    if (!results) return { data: [], stats: { improvedCount: 0, declinedCount: 0, avgChange: '0' } }

    // 元の配列を保持しながらマージ
    console.log('Original improved_queries count:', results.improved_queries.length)
    console.log('Original declined_queries count:', results.declined_queries.length)
    console.log('Sample declined_queries:', results.declined_queries.slice(0, 3))

    const improvedWithSource = results.improved_queries.map(item => ({ ...item, _source: 'improved' }))
    const declinedWithSource = results.declined_queries.map(item => ({ ...item, _source: 'declined' }))
    const allData = [...improvedWithSource, ...declinedWithSource]

    // フィルタ条件を緩和して、両方のデータをバランスよく取得
    const improvedFiltered = improvedWithSource.filter(item =>
      item.past_position &&
      item.current_position &&
      typeof item.past_position === 'number' &&
      typeof item.current_position === 'number'
    ).slice(0, 1000)  // 最大1000件

    const declinedFiltered = declinedWithSource.filter(item =>
      item.past_position &&
      item.current_position &&
      typeof item.past_position === 'number' &&
      typeof item.current_position === 'number'
    ).slice(0, 1000)  // 最大1000件

    const validData = [...improvedFiltered, ...declinedFiltered]

    console.log('After filter - Improved:', improvedFiltered.length, 'Declined:', declinedFiltered.length)

    // _sourceプロパティで分類
    const improved = validData.filter(item => item._source === 'improved')
    const declined = validData.filter(item => item._source === 'declined')

    // デバッグ
    console.log('Total validData:', validData.length)
    console.log('Improved:', improved.length, 'Declined:', declined.length)
    console.log('Sample improved:', improved.slice(0, 2))
    console.log('Sample declined:', declined.slice(0, 2))

    // 統計計算
    const allChanges = validData.map(item => item.past_position - item.current_position)
    const avgChange = allChanges.length > 0 ? allChanges.reduce((sum, change) => sum + change, 0) / allChanges.length : 0

    // 全データを一つの配列に統合（色分けのため type を追加）
    const scatterData = [
      ...improved.map(item => ({
        x: item.past_position,
        y: item.current_position,
        query: item.query,
        change: item.past_position - item.current_position,
        type: 'improved'
      })),
      ...declined.map(item => ({
        x: item.past_position,
        y: item.current_position,
        query: item.query,
        change: item.past_position - item.current_position,
        type: 'declined'
      }))
    ]

    // 回帰直線の計算（近似曲線用）
    const calculateTrendline = (data) => {
      if (data.length < 2) return []

      const n = data.length
      const sumX = data.reduce((sum, d) => sum + d.x, 0)
      const sumY = data.reduce((sum, d) => sum + d.y, 0)
      const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0)
      const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0)

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n

      console.log('トレンドライン計算:', { slope, intercept, dataPoints: n })

      // トレンドライン用のポイントを生成
      const minX = Math.min(...data.map(d => d.x))
      const maxX = Math.max(...data.map(d => d.x))

      return [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept }
      ]
    }

    const trendlineData = scatterData.length > 0 ? calculateTrendline(scatterData) : []

    return {
      data: scatterData,
      trendline: trendlineData,
      stats: {
        improvedCount: improved.length,
        declinedCount: declined.length,
        avgChange: avgChange.toFixed(1)
      }
    }
  }

  const getDirectoryData = () => {
    if (!results || !results.directory_analysis) return []
    return Object.entries(results.directory_analysis)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([directory, count]) => ({
        directory: directory || 'その他',
        count
      }))
  }

  // 詳細分析関連の関数
  const handleSettingsSave = (settings) => {
    setAnalysisSettings(settings)
  }

  const runStatisticalAnalysis = async () => {
    if (!results) return

    setStatisticalLoading(true)
    setAnalysisError('')

    try {
      const authHeader = getBasicAuthHeader()
      const allKeywords = [...results.improved_queries, ...results.declined_queries]

      const response = await fetch('/api/detailed-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader })
        },
        body: JSON.stringify({
          keywords: allKeywords,
          settings: analysisSettings || {}
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '統計分析に失敗しました')
      }

      const data = await response.json()
      setStatisticalResult(data)
    } catch (error) {
      setAnalysisError(error.message)
    } finally {
      setStatisticalLoading(false)
    }
  }

  const runAIAnalysis = async () => {
    if (!results) return

    setAiLoading(true)
    setAnalysisError('')

    try {
      const authHeader = getBasicAuthHeader()
      const allKeywords = [...results.improved_queries, ...results.declined_queries]

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader && { 'Authorization': authHeader })
        },
        body: JSON.stringify({
          keywords: allKeywords,
          settings: analysisSettings || {},
          clusteringResult: statisticalResult?.clustering
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'AI分析に失敗しました')
      }

      const data = await response.json()
      setAiResult(data)
    } catch (error) {
      setAnalysisError(error.message)
    } finally {
      setAiLoading(false)
    }
  }

  const runBothAnalyses = async () => {
    await runStatisticalAnalysis()
    await runAIAnalysis()
  }

  // 散布図コンポーネント（両タブで共通使用）
  const RankingScatterPlot = () => (
    <div className="mb-8">
      <div className="bg-gray-50 p-6 rounded-lg">
        <div className="mb-4">
          <h3 className="text-xl font-bold mb-2 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2" />
            Changes in Keyword Rankings with Overall Average Change
          </h3>
          <p className="text-sm text-gray-600">
            このグラフは、キーワードランキングの勝者と敗者を視覚化し、全体的な成績が良いか悪いかを示します。緑色は順位改善、赤色は順位悪化を表します。
          </p>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-6">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm font-medium">Improved (n={getScatterData().stats.improvedCount})</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm font-medium">Worsened (n={getScatterData().stats.declinedCount})</span>
            </div>
          </div>
          <div className="bg-yellow-100 px-4 py-2 rounded-lg border-2 border-yellow-400">
            <span className="text-sm font-bold">Overall Avg. Change: {parseFloat(getScatterData().stats.avgChange) > 0 ? '+' : ''}{getScatterData().stats.avgChange}</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart data={getScatterData().data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 'auto']}
              label={{ value: 'Previous Position', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 'auto']}
              label={{ value: 'Current Position', angle: -90, position: 'insideLeft' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ paddingBottom: '10px' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded shadow">
                      <p className="font-medium">{data.query}</p>
                      <p>過去順位: {Math.round(data.x * 10) / 10}</p>
                      <p>現在順位: {Math.round(data.y * 10) / 10}</p>
                      <p>変化: {data.change > 0 ? '+' : ''}{Math.round(data.change * 10) / 10}</p>
                    </div>
                  )
                }
                return null
              }}
            />

            {/* 対角線（変化なし） - データの最大値に合わせる */}
            <ReferenceLine
              stroke="#3b82f6"
              strokeWidth={2}
              segment={[{x: 0, y: 0}, {x: 200, y: 200}]}
            />

            {/* 近似曲線（トレンドライン） */}
            <ReferenceLine
              stroke="#ff9800"
              strokeWidth={2}
              strokeDasharray="5 5"
              segment={getScatterData().trendline.length === 2 ? [
                {x: getScatterData().trendline[0].x, y: getScatterData().trendline[0].y},
                {x: getScatterData().trendline[1].x, y: getScatterData().trendline[1].y}
              ] : null}
            />

            {/* 改善クエリ（緑色） */}
            <Scatter
              data={getScatterData().data.filter(item => item.type === 'improved')}
              fill="#22c55e"
              fillOpacity={0.7}
              stroke="#15803d"
              strokeWidth={1}
              r={4}
              name="改善"
            />

            {/* 悪化クエリ（赤色） */}
            <Scatter
              data={getScatterData().data.filter(item => item.type === 'declined')}
              fill="#ef4444"
              fillOpacity={0.7}
              stroke="#dc2626"
              strokeWidth={1}
              r={4}
              name="悪化"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Search Console 順位変化分析ツール
        </h1>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">サイトURL</label>
              <input
                type="text"
                name="site_url"
                value={formData.site_url}
                onChange={handleInputChange}
                placeholder="https://example.com/"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">URLフィルタ (含む)</label>
              <input
                type="text"
                name="url_filter"
                value={formData.url_filter}
                onChange={handleInputChange}
                placeholder="/category/"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">クエリフィルタ (含む)</label>
              <input
                type="text"
                name="query_filter"
                value={formData.query_filter}
                onChange={handleInputChange}
                placeholder="検索キーワード"
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">過去期間</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                  <input
                    type="date"
                    name="past_start"
                    value={formData.past_start}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                  <input
                    type="date"
                    name="past_end"
                    value={formData.past_end}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">現在期間</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                  <input
                    type="date"
                    name="current_start"
                    value={formData.current_start}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                  <input
                    type="date"
                    name="current_end"
                    value={formData.current_end}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? '分析中...' : '分析を開始'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <>
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-lg mb-8">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex">
                  <button
                    onClick={() => setActiveTab('improved')}
                    className={`py-4 px-6 border-b-2 font-medium text-sm ${
                      activeTab === 'improved'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <TrendingUp className="inline w-5 h-5 mr-2" />
                    順位上昇・新規獲得 ({results.improved_queries.length.toLocaleString()})
                  </button>
                  <button
                    onClick={() => setActiveTab('declined')}
                    className={`py-4 px-6 border-b-2 font-medium text-sm ${
                      activeTab === 'declined'
                        ? 'border-red-500 text-red-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <TrendingDown className="inline w-5 h-5 mr-2" />
                    順位下落・消失 ({results.declined_queries.length.toLocaleString()})
                  </button>
                </nav>
              </div>

              {/* Summary Cards */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* 基本情報 */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg text-white">
                    <h3 className="text-sm font-medium opacity-80">総クエリ数</h3>
                    <p className="text-2xl font-bold">{results.summary.filtered_queries.toLocaleString()}</p>
                  </div>

                  {/* 順位変動 */}
                  <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 rounded-lg text-white">
                    <h3 className="text-sm font-medium opacity-80">順位上昇 / 下落</h3>
                    <p className="text-2xl font-bold">
                      {(results.summary.improved_total - results.summary.new_queries).toLocaleString()} / {(results.summary.declined_total - results.summary.disappeared_queries).toLocaleString()}
                    </p>
                    <p className="text-xs opacity-70 mt-1">既存クエリの順位変動</p>
                  </div>

                  {/* 新規獲得・消失 */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-lg text-white">
                    <h3 className="text-sm font-medium opacity-80">新規獲得 / 消失</h3>
                    <p className="text-2xl font-bold">
                      +{results.summary.new_queries.toLocaleString()} / -{results.summary.disappeared_queries.toLocaleString()}
                    </p>
                    <p className="text-xs opacity-70 mt-1">クエリの出現・消失</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {/* クリック変化 */}
                  <div className={`p-6 rounded-lg text-white ${
                    results.summary.clicks_change >= 0
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : 'bg-gradient-to-r from-red-500 to-rose-600'
                  }`}>
                    <h3 className="text-sm font-medium opacity-80">クリック変化</h3>
                    <p className="text-2xl font-bold">
                      {results.summary.clicks_change >= 0 ? '+' : ''}{results.summary.clicks_change.toLocaleString()}
                    </p>
                    <p className="text-xs opacity-70 mt-1">
                      {results.summary.clicks_past.toLocaleString()} → {results.summary.clicks_current.toLocaleString()}
                    </p>
                  </div>

                  {/* 表示回数変化 */}
                  <div className={`p-6 rounded-lg text-white ${
                    results.summary.impressions_change >= 0
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                      : 'bg-gradient-to-r from-red-500 to-rose-600'
                  }`}>
                    <h3 className="text-sm font-medium opacity-80">表示回数変化</h3>
                    <p className="text-2xl font-bold">
                      {results.summary.impressions_change >= 0 ? '+' : ''}{results.summary.impressions_change.toLocaleString()}
                    </p>
                    <p className="text-xs opacity-70 mt-1">
                      {results.summary.impressions_past.toLocaleString()} → {results.summary.impressions_current.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* ========== Scatter Plot - Full Width (両タブ共通) ========== */}
                <RankingScatterPlot />
                {/* ========== End of Scatter Plot ========== */}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <button
                    onClick={downloadCSV}
                    className="flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSVダウンロード
                  </button>
                  <button
                    onClick={createSpreadsheet}
                    className="flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    スプレッドシートで開く
                  </button>
                </div>

                {/* Data Table */}
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Table className="w-5 h-5 mr-2" />
                      詳細データ
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">表示件数:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value))
                            setCurrentPage(1)
                          }}
                          className="border border-gray-300 rounded px-3 py-1"
                        >
                          <option value={50}>50件表示</option>
                          <option value={100}>100件表示</option>
                          <option value={200}>200件表示</option>
                          <option value={500}>500件表示</option>
                        </select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">フィルタ:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setCurrentPage(1)
                          }}
                          className="border border-gray-300 rounded px-3 py-1"
                        >
                          {activeTab === 'improved' ? (
                            <>
                              <option value="all">新規・上昇</option>
                              <option value="new">新規のみ</option>
                              <option value="improved">上昇のみ</option>
                            </>
                          ) : (
                            <>
                              <option value="all">消失・下落</option>
                              <option value="disappeared">消失のみ</option>
                              <option value="declined">下落のみ</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">クエリ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ディレクトリ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">過去順位</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">現在順位</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">変化</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">クリック変化</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getCurrentPageData().map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.query}>
                              {item.query}
                            </td>
                            <td className="px-6 py-4 text-sm text-blue-600 max-w-xs truncate" title={item.url}>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {item.url}
                              </a>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{item.directory}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{item.past_position || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{item.current_position || 'N/A'}</td>
                            <td className={`px-6 py-4 text-sm font-medium ${
                              typeof item.change === 'number'
                                ? item.change > 0 ? 'text-green-600' : item.change < 0 ? 'text-red-600' : 'text-gray-900'
                                : 'text-gray-900'
                            }`}>
                              {typeof item.change === 'number' && item.change > 0 ? '+' : ''}{item.change || 'N/A'}
                            </td>
                            <td className={`px-6 py-4 text-sm font-medium ${
                              typeof item.clicks_change === 'number'
                                ? item.clicks_change > 0 ? 'text-green-600' : item.clicks_change < 0 ? 'text-red-600' : 'text-gray-900'
                                : 'text-gray-900'
                            }`}>
                              {typeof item.clicks_change === 'number' && item.clicks_change > 0 ? '+' : ''}{item.clicks_change || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                item.status === 'new' ? 'bg-green-100 text-green-800' :
                                item.status === 'disappeared' ? 'bg-red-100 text-red-800' :
                                item.status === 'improved' ? 'bg-blue-100 text-blue-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {item.status === 'new' ? '新規' :
                                 item.status === 'disappeared' ? '消失' :
                                 item.status === 'improved' ? '改善' : '悪化'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        {getCurrentPageData().length > 0 && (
                          <span>
                            {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, (activeTab === 'improved' ? results.improved_queries : results.declined_queries).length)} 件目
                            / 全 {(activeTab === 'improved' ? results.improved_queries : results.declined_queries).length.toLocaleString()} 件
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          前へ
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          {currentPage} / {getTotalPages()}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                          disabled={currentPage === getTotalPages()}
                          className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          次へ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 詳細分析セクション */}
            <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">さらに詳しく分析する</h2>

              {/* 設定ボタン */}
              <div className="mb-6">
                <button
                  onClick={() => setShowSettingModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  ⚙️ 分析設定
                  {!analysisSettings && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                      初回設定が必要です
                    </span>
                  )}
                </button>
              </div>

              {/* 分析ボタン */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                  onClick={runStatisticalAnalysis}
                  disabled={statisticalLoading}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BarChart2 className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">📊 詳細を統計分析</div>
                    <div className="text-xs opacity-90">即座に表示</div>
                  </div>
                </button>

                <button
                  onClick={runAIAnalysis}
                  disabled={aiLoading}
                  className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Brain className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">🤖 詳細をAI分析</div>
                    <div className="text-xs opacity-90">1-2分程度</div>
                  </div>
                </button>

                <button
                  onClick={runBothAnalyses}
                  disabled={statisticalLoading || aiLoading}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-left">
                    <div className="font-semibold">両方実行</div>
                    <div className="text-xs opacity-90">統計 + AI分析</div>
                  </div>
                </button>
              </div>

              {/* ローディング表示 */}
              {(statisticalLoading || aiLoading) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <div>
                      {statisticalLoading && <p className="text-sm text-blue-800">📊 統計分析中...</p>}
                      {aiLoading && <p className="text-sm text-blue-800">🤖 AI分析中... (1-2分程度かかります)</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* エラー表示 */}
              {analysisError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">⚠️ {analysisError}</p>
                </div>
              )}

              {/* 統計分析結果 */}
              {statisticalResult && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">📊 統計分析結果</h3>
                  <StatisticalAnalysisResult result={statisticalResult} />
                </div>
              )}

              {/* AI分析結果 */}
              {aiResult && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">🤖 AI分析結果</h3>
                  <AIAnalysisResult result={aiResult} />
                </div>
              )}

              {/* 初期状態のヒント */}
              {!statisticalResult && !aiResult && !statisticalLoading && !aiLoading && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">📌 詳細分析でできること</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">統計分析:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• クラスタリング分析</li>
                        <li>• 相関分析</li>
                        <li>• 変動率加速度分析</li>
                        <li>• 基本セグメント比較</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">AI分析:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 検索意図別の変動傾向</li>
                        <li>• 自動カテゴリ分類</li>
                        <li>• クラスタ結果の意味解釈</li>
                        <li>• ビジネス示唆の提供</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 分析設定モーダル */}
      <AnalysisSettingModal
        isOpen={showSettingModal}
        onClose={() => setShowSettingModal(false)}
        onSave={handleSettingsSave}
        keywords={results ? [...results.improved_queries, ...results.declined_queries] : []}
      />
    </div>
  )
}

export default ComparisonPage