import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

function QueryRankShare() {
  const [siteUrl, setSiteUrl] = useState(() => sessionStorage.getItem('queryRank_siteUrl') || 'https://www.tabirai.net/')
  const [startMonth, setStartMonth] = useState(() => sessionStorage.getItem('queryRank_startMonth') || '')
  const [endMonth, setEndMonth] = useState(() => sessionStorage.getItem('queryRank_endMonth') || '')
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('queryRank_viewMode') || 'monthly')
  const [directories, setDirectories] = useState(() => {
    const saved = sessionStorage.getItem('queryRank_directories')
    return saved ? JSON.parse(saved) : ['hotel/', 'car/', 'sightseeing/']
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [chartData, setChartData] = useState(() => {
    const saved = sessionStorage.getItem('queryRank_chartData')
    return saved ? JSON.parse(saved) : []
  })
  const [tableData, setTableData] = useState(() => {
    const saved = sessionStorage.getItem('queryRank_tableData')
    return saved ? JSON.parse(saved) : []
  })

  // 状態変更時にセッションストレージに保存
  useEffect(() => { sessionStorage.setItem('queryRank_siteUrl', siteUrl) }, [siteUrl])
  useEffect(() => { sessionStorage.setItem('queryRank_startMonth', startMonth) }, [startMonth])
  useEffect(() => { sessionStorage.setItem('queryRank_endMonth', endMonth) }, [endMonth])
  useEffect(() => { sessionStorage.setItem('queryRank_viewMode', viewMode) }, [viewMode])
  useEffect(() => { sessionStorage.setItem('queryRank_directories', JSON.stringify(directories)) }, [directories])
  useEffect(() => { if (chartData.length > 0) sessionStorage.setItem('queryRank_chartData', JSON.stringify(chartData)) }, [chartData])
  useEffect(() => { if (tableData.length > 0) sessionStorage.setItem('queryRank_tableData', JSON.stringify(tableData)) }, [tableData])

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
    setChartData([])
    setTableData([])

    try {
      const response = await fetch('/api/query-rank-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startMonth,
          endMonth,
          directories: directories.filter(d => d.trim() !== ''),
          viewMode
        })
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

      console.log('取得したデータ:', data)
    } catch (err) {
      console.error('データ取得エラー:', err)
      setError(err.message)
      setChartData([])
      setTableData([])
    } finally {
      setLoading(false)
    }
  }

  // 順位シェアの色定義
  const rankColors = {
    '1～3位未満': '#10b981',
    '3～5位未満': '#3b82f6',
    '6～10位未満': '#f59e0b',
    '10～20位未満': '#ef4444',
    '20位以上～圏外': '#9ca3af'
  }

  const rankRanges = ['1～3位未満', '3～5位未満', '6～10位未満', '10～20位未満', '20位以上～圏外']

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">クエリ順位シェア分析</h1>

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

          <div className="flex gap-4 mb-6">
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

          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'データ取得中...' : 'データを取得'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">クエリ順位シェア推移（100%積み上げ棒グラフ）</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
                />
                <Legend />
                {rankRanges.map(range => (
                  <Bar
                    key={range}
                    dataKey={range}
                    stackId="a"
                    fill={rankColors[range]}
                    name={range}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pivot Table */}
        {tableData.length > 0 && (() => {
          const periods = [...new Set(tableData.map(row => row.period))].sort()

          const pivotData = rankRanges.map(range => {
            const row = { rankRange: range }
            periods.forEach(period => {
              const data = tableData.find(d => d.rankRange === range && d.period === period)
              row[period] = data || { queryCount: 0, shareRate: 0 }
            })
            return row
          })

          return (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <h2 className="text-xl font-bold text-gray-800 p-6 pb-4">詳細データ（ピボットテーブル）</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="sticky left-0 z-20 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r-2 border-gray-300">
                        順位シェア
                      </th>
                      <th className="sticky left-[150px] z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r-2 border-gray-300">
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
                    {pivotData.map((row, index) => (
                      <React.Fragment key={index}>
                        <tr className="hover:bg-gray-50">
                          <td
                            rowSpan="2"
                            className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top"
                          >
                            {row.rankRange}
                          </td>
                          <td className="sticky left-[150px] z-10 bg-white px-4 py-4 whitespace-nowrap text-sm text-gray-700 border-r-2 border-gray-300">
                            クエリ数
                          </td>
                          {periods.map(period => (
                            <td key={period} className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right border-l border-gray-200">
                              {row[period].queryCount.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="sticky left-[150px] z-10 bg-white px-4 py-4 whitespace-nowrap text-sm text-gray-700 border-r-2 border-gray-300">
                            シェア率
                          </td>
                          {periods.map(period => (
                            <td key={period} className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right border-l border-gray-200">
                              {row[period].shareRate.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    ))}
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

export default QueryRankShare
