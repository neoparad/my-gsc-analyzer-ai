import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts'
import { Download, ExternalLink, TrendingUp, TrendingDown, Plus, Minus, BarChart3, Table } from 'lucide-react'

function App() {
  const [formData, setFormData] = useState({
    site_url: '',
    past_start: '',
    past_end: '',
    current_start: '',
    current_end: '',
    url_filter: '',
    query_filter: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [activeTab, setActiveTab] = useState('improved')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [statusFilter, setStatusFilter] = useState('all')

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

    const allData = [...results.improved_queries, ...results.declined_queries]
    const validData = allData.filter(item =>
      item.past_position &&
      item.current_position &&
      item.past_position <= 50 &&
      item.current_position <= 50 &&
      typeof item.past_position === 'number' &&
      typeof item.current_position === 'number'
    ).slice(0, 500)

    // 改善と悪化に分類
    const improved = validData.filter(item => item.current_position < item.past_position)
    const declined = validData.filter(item => item.current_position > item.past_position)

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

    return {
      data: scatterData,
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

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {/* Scatter Plot */}
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        順位変化散布図
                      </h3>
                      <div className="text-right">
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-sm text-gray-600 mb-1">平均順位変動</div>
                          <div className={`text-2xl font-bold ${
                            parseFloat(getScatterData().stats.avgChange) > 0 ? 'text-green-600' :
                            parseFloat(getScatterData().stats.avgChange) < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {parseFloat(getScatterData().stats.avgChange) > 0 ? '+' : ''}{getScatterData().stats.avgChange}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm">改善: {getScatterData().stats.improvedCount}件</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span className="text-sm">悪化: {getScatterData().stats.declinedCount}件</span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart data={getScatterData().data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={['dataMin', 50]}
                          tickCount={6}
                          label={{ value: '過去順位', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          domain={['dataMin', 50]}
                          tickCount={6}
                          label={{ value: '現在順位', angle: -90, position: 'insideLeft' }}
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

                        {/* 対角線（変化なし） */}
                        <ReferenceLine
                          stroke="#666"
                          strokeDasharray="5 5"
                          segment={[{x: 1, y: 1}, {x: 50, y: 50}]}
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

                  {/* Directory Analysis */}
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      ディレクトリ別クエリ数分析 (Top 10)
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      各ディレクトリが獲得している検索クエリの数を表示
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={getDirectoryData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="directory"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

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
          </>
        )}
      </div>
    </div>
  )
}

export default App