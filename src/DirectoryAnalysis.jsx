import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

function DirectoryAnalysis() {
  const [siteUrl, setSiteUrl] = useState(() => sessionStorage.getItem('dirAnalysis_siteUrl') || 'https://www.tabirai.net/')
  const [startMonth, setStartMonth] = useState(() => sessionStorage.getItem('dirAnalysis_startMonth') || '')
  const [endMonth, setEndMonth] = useState(() => sessionStorage.getItem('dirAnalysis_endMonth') || '')
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('dirAnalysis_viewMode') || 'monthly')
  const [granularity, setGranularity] = useState(() => sessionStorage.getItem('dirAnalysis_granularity') || 'monthly')
  const [searchType, setSearchType] = useState(() => sessionStorage.getItem('dirAnalysis_searchType') || 'web')
  const [directories, setDirectories] = useState(() => {
    const saved = sessionStorage.getItem('dirAnalysis_directories')
    return saved ? JSON.parse(saved) : ['hotel/', 'car/', 'sightseeing/']
  })
  const [showOthers, setShowOthers] = useState(() => sessionStorage.getItem('dirAnalysis_showOthers') === 'true')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartData, setChartData] = useState(() => {
    const saved = sessionStorage.getItem('dirAnalysis_chartData')
    return saved ? JSON.parse(saved) : []
  })
  const [tableData, setTableData] = useState(() => {
    const saved = sessionStorage.getItem('dirAnalysis_tableData')
    return saved ? JSON.parse(saved) : []
  })
  const [directoryTimeSeriesData, setDirectoryTimeSeriesData] = useState(() => {
    const saved = sessionStorage.getItem('dirAnalysis_directoryTimeSeriesData')
    return saved ? JSON.parse(saved) : {}
  })
  const [visibleMetrics, setVisibleMetrics] = useState(() => {
    const saved = sessionStorage.getItem('dirAnalysis_visibleMetrics')
    return saved ? JSON.parse(saved) : {
      clicks: true,
      impressions: true,
      ctr: true,
      position: true,
      queryCount: true
    }
  })

  // AbortController for canceling requests
  const abortControllerRef = useRef(null)

  // 状態変更時にセッションストレージに保存
  useEffect(() => { sessionStorage.setItem('dirAnalysis_siteUrl', siteUrl) }, [siteUrl])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_startMonth', startMonth) }, [startMonth])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_endMonth', endMonth) }, [endMonth])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_viewMode', viewMode) }, [viewMode])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_granularity', granularity) }, [granularity])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_searchType', searchType) }, [searchType])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_directories', JSON.stringify(directories)) }, [directories])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_showOthers', showOthers) }, [showOthers])
  useEffect(() => { if (chartData.length > 0) sessionStorage.setItem('dirAnalysis_chartData', JSON.stringify(chartData)) }, [chartData])
  useEffect(() => { if (tableData.length > 0) sessionStorage.setItem('dirAnalysis_tableData', JSON.stringify(tableData)) }, [tableData])
  useEffect(() => { if (Object.keys(directoryTimeSeriesData).length > 0) sessionStorage.setItem('dirAnalysis_directoryTimeSeriesData', JSON.stringify(directoryTimeSeriesData)) }, [directoryTimeSeriesData])
  useEffect(() => { sessionStorage.setItem('dirAnalysis_visibleMetrics', JSON.stringify(visibleMetrics)) }, [visibleMetrics])

  const addDirectory = () => {
    setDirectories([...directories, ''])
  }

  const removeDirectory = (index) => {
    setDirectories(directories.filter((_, i) => i !== index))
  }

  const updateDirectory = (index, value) => {
    const newDirs = [...directories]
    newDirs[index] = value
    setDirectories(newDirs)
  }

  const fetchData = async () => {
    if (!startMonth || !endMonth) {
      setError('開始月と終了月を指定してください')
      return
    }

    setLoading(true)
    setError('')
    // データをリセット
    setChartData([])
    setTableData([])
    setDirectoryTimeSeriesData({})

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/directory-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startMonth,
          endMonth,
          directories: directories.filter(d => d.trim() !== ''),
          viewMode,
          granularity,
          searchType,
          showOthers
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'データ取得に失敗しました')
      }

      const data = await response.json()

      if (!data.chartData || !data.tableData) {
        throw new Error('データ形式が正しくありません')
      }

      setChartData(data.chartData)
      setTableData(data.tableData)
      setDirectoryTimeSeriesData(data.directoryTimeSeriesData || {})

      console.log('取得したデータ:', data)
      console.log('directoryTimeSeriesData:', data.directoryTimeSeriesData)
      console.log('directoryTimeSeriesData keys:', Object.keys(data.directoryTimeSeriesData || {}))
    } catch (err) {
      console.error('データ取得エラー:', err)
      if (err.name === 'AbortError') {
        setError('分析が停止されました')
      } else {
        setError(err.message)
      }
      setChartData([])
      setTableData([])
      setDirectoryTimeSeriesData({})
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const toggleMetric = (metric) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric]
    }))
  }

  const metricConfig = {
    clicks: { label: '合計クリック数', color: '#3b82f6' },
    impressions: { label: '合計表示回数', color: '#8b5cf6' },
    ctr: { label: '平均CTR', color: '#10b981', formatter: (val) => `${val}%` },
    position: { label: '平均掲載順位', color: '#f59e0b' },
    queryCount: { label: 'クエリ数', color: '#ec4899' }
  }

  // Normalize data for each metric with padding (like Google Search Console)
  const normalizeDataForChart = (data) => {
    if (!data || data.length === 0) return data

    const normalized = JSON.parse(JSON.stringify(data)) // Deep clone
    const PADDING_PERCENT = 20 // 上下に20%の余白を追加

    Object.keys(metricConfig).forEach(metric => {
      const values = data.map(d => d[metric]).filter(v => v !== undefined && v !== null)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const range = max - min

      if (range > 0) {
        // パディングを考慮した範囲を計算
        const paddedRange = range * (1 + PADDING_PERCENT / 100 * 2)
        const paddedMin = min - (range * PADDING_PERCENT / 100)

        normalized.forEach((item, idx) => {
          if (data[idx][metric] !== undefined && data[idx][metric] !== null) {
            // 20-80%の範囲に収まるように正規化
            const normalizedValue = ((data[idx][metric] - paddedMin) / paddedRange) * 100
            item[`${metric}_normalized`] = normalizedValue
            item[`${metric}_original`] = data[idx][metric]
          }
        })
      } else {
        // 値が全て同じ場合は中央（50%）に配置
        normalized.forEach((item, idx) => {
          if (data[idx][metric] !== undefined && data[idx][metric] !== null) {
            item[`${metric}_normalized`] = 50
            item[`${metric}_original`] = data[idx][metric]
          }
        })
      }
    })

    return normalized
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">ディレクトリアクセス分析</h1>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">サイトURL</label>
              <input
                type="text"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">開始月</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">終了月</label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">ディレクトリ</label>
              <button
                onClick={addDirectory}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
            <div className="space-y-2">
              {directories.map((dir, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={dir}
                    onChange={(e) => updateDirectory(index, e.target.value)}
                    placeholder="hotel/"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {directories.length > 1 && (
                    <button
                      onClick={() => removeDirectory(index)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">検索タイプ</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="web"
                  checked={searchType === 'web'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">通常検索</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="image"
                  checked={searchType === 'image'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">画像検索</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="video"
                  checked={searchType === 'video'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">動画検索</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="news"
                  checked={searchType === 'news'}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">ニュース検索</span>
              </label>
            </div>
          </div>

          <div className="flex gap-6 mb-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showOthers"
                checked={showOthers}
                onChange={(e) => setShowOthers(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="showOthers" className="text-sm text-gray-700">
                その他ページを表示
              </label>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="monthly"
                  checked={viewMode === 'monthly'}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">月次</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="quarterly"
                  checked={viewMode === 'quarterly'}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">四半期</span>
              </label>
            </div>

            <div className="flex gap-4 border-l pl-6">
              <label className="text-sm font-medium text-gray-700">グラフ粒度:</label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="daily"
                  checked={granularity === 'daily'}
                  onChange={(e) => setGranularity(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">日次</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="monthly"
                  checked={granularity === 'monthly'}
                  onChange={(e) => setGranularity(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">月次</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'データ取得中...' : 'データを取得'}
            </button>

            {loading && (
              <button
                onClick={handleStopAnalysis}
                className="w-full bg-red-600 text-white py-2 px-6 rounded hover:bg-red-700"
              >
                ⏹ 分析を停止
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">クリック数推移（積み上げ棒グラフ）</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                {directories.filter(d => d.trim()).map((dir, index) => (
                  <Bar
                    key={dir}
                    dataKey={dir}
                    stackId="a"
                    fill={`hsl(${index * 360 / directories.length}, 70%, 50%)`}
                    name={dir}
                  />
                ))}
                {showOthers && <Bar dataKey="その他" stackId="a" fill="#9CA3AF" name="その他" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Directory Time Series Charts */}
        {(() => {
          console.log('Rendering check - directoryTimeSeriesData:', directoryTimeSeriesData)
          console.log('Rendering check - keys length:', Object.keys(directoryTimeSeriesData).length)
          return null
        })()}
        {Object.keys(directoryTimeSeriesData).length > 0 && Object.entries(directoryTimeSeriesData).map(([directory, data]) => (
          <div key={directory} className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{directory} - 推移グラフ</h2>

            {/* Metric Toggle Panel */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded">
              {Object.entries(metricConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => toggleMetric(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                    visibleMetrics[key]
                      ? 'bg-white shadow-md border-2'
                      : 'bg-gray-200 opacity-60'
                  }`}
                  style={{
                    borderColor: visibleMetrics[key] ? config.color : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleMetrics[key]}
                    onChange={() => {}}
                    className="w-4 h-4"
                    style={{ accentColor: config.color }}
                  />
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              ))}
            </div>

            {/* Line Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={normalizeDataForChart(data)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  formatter={(value, name, props) => {
                    const metric = Object.keys(metricConfig).find(k => metricConfig[k].label === name)
                    if (metric) {
                      const originalValue = props.payload[`${metric}_original`]
                      if (originalValue !== undefined) {
                        if (metricConfig[metric].formatter) {
                          return metricConfig[metric].formatter(originalValue)
                        }
                        return originalValue.toLocaleString()
                      }
                    }
                    return value
                  }}
                />
                <Legend />
                {Object.entries(metricConfig).map(([key, config]) => (
                  visibleMetrics[key] && (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={`${key}_normalized`}
                      stroke={config.color}
                      strokeWidth={2}
                      name={config.label}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

        {/* Pivot Table */}
        {tableData.length > 0 && (() => {
          // ピボットテーブルデータを作成
          const periods = [...new Set(tableData.map(row => row.period))].sort()
          const directoriesInData = [...new Set(tableData.map(row => row.directory))]
          const metrics = [
            { key: 'clicks', label: 'クリック', format: (val) => val.toLocaleString() },
            { key: 'impressions', label: '表示回数', format: (val) => val.toLocaleString() },
            { key: 'ctr', label: 'CTR', format: (val) => `${val}%` },
            { key: 'position', label: '平均順位', format: (val) => val },
            { key: 'queryCount', label: 'クエリ数', format: (val) => val.toLocaleString() }
          ]

          const pivotRows = []
          directoriesInData.forEach(dir => {
            metrics.forEach(metric => {
              const row = { directory: dir, metric: metric.label }
              periods.forEach(period => {
                const data = tableData.find(d => d.directory === dir && d.period === period)
                row[period] = data ? metric.format(data[metric.key]) : '-'
              })
              pivotRows.push(row)
            })
          })

          return (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <h2 className="text-xl font-bold text-gray-800 p-6 pb-4">詳細データ（ピボットテーブル）</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300">
                        ディレクトリ
                      </th>
                      <th className="sticky left-[120px] z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r-2 border-gray-300">
                        指標
                      </th>
                      {periods.map(period => (
                        <th key={period} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pivotRows.map((row, index) => {
                      const isFirstMetricOfDir = index % 5 === 0
                      const dirRowSpan = isFirstMetricOfDir ? 5 : 0

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          {isFirstMetricOfDir && (
                            <td
                              rowSpan="5"
                              className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-300 align-top"
                            >
                              {row.directory}
                            </td>
                          )}
                          <td className="sticky left-[120px] z-10 bg-white px-4 py-4 whitespace-nowrap text-sm text-gray-700 border-r-2 border-gray-300">
                            {row.metric}
                          </td>
                          {periods.map(period => (
                            <td key={period} className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right border-l border-gray-200">
                              {row[period]}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default DirectoryAnalysis
