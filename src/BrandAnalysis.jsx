import React, { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, Trash2, RefreshCw, TrendingUp, Calendar, Activity } from 'lucide-react'

function BrandAnalysis() {
  const [siteUrl, setSiteUrl] = useState(() => sessionStorage.getItem('brandAnalysis_siteUrl') || 'https://www.tabirai.net/')
  const [startDate, setStartDate] = useState(() => sessionStorage.getItem('brandAnalysis_startDate') || '')
  const [endDate, setEndDate] = useState(() => sessionStorage.getItem('brandAnalysis_endDate') || '')
  const [directories, setDirectories] = useState(() => {
    const saved = sessionStorage.getItem('brandAnalysis_directories')
    return saved ? JSON.parse(saved) : ['']
  })
  const [brandKeywords, setBrandKeywords] = useState(() => {
    const saved = sessionStorage.getItem('brandAnalysis_brandKeywords')
    return saved ? JSON.parse(saved) : ['tabirai', 'たびらい', 'タビライ']
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(() => {
    const saved = sessionStorage.getItem('brandAnalysis_results')
    return saved ? JSON.parse(saved) : null
  })

  // sessionStorage保存
  useEffect(() => { sessionStorage.setItem('brandAnalysis_siteUrl', siteUrl) }, [siteUrl])
  useEffect(() => { sessionStorage.setItem('brandAnalysis_startDate', startDate) }, [startDate])
  useEffect(() => { sessionStorage.setItem('brandAnalysis_endDate', endDate) }, [endDate])
  useEffect(() => { sessionStorage.setItem('brandAnalysis_directories', JSON.stringify(directories)) }, [directories])
  useEffect(() => { sessionStorage.setItem('brandAnalysis_brandKeywords', JSON.stringify(brandKeywords)) }, [brandKeywords])
  useEffect(() => { if (results) sessionStorage.setItem('brandAnalysis_results', JSON.stringify(results)) }, [results])

  const addDirectory = () => setDirectories([...directories, ''])
  const removeDirectory = (index) => setDirectories(directories.filter((_, i) => i !== index))
  const updateDirectory = (index, value) => {
    const newDirs = [...directories]
    newDirs[index] = value
    setDirectories(newDirs)
  }

  const updateBrandKeyword = (index, value) => {
    const newKeywords = [...brandKeywords]
    newKeywords[index] = value
    setBrandKeywords(newKeywords)
  }

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setError('開始日と終了日を指定してください')
      return
    }

    setLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch('/api/brand-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate,
          endDate,
          directories: directories.filter(d => d.trim() !== ''),
          brandKeywords: brandKeywords.filter(k => k.trim() !== '')
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'データ取得に失敗しました')
      }

      const data = await response.json()
      setResults(data)
      console.log('取得したデータ:', data)
    } catch (err) {
      console.error('データ取得エラー:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🔍 ブランドキーワード分析</h1>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">対象ディレクトリ（任意）</label>
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
                    placeholder="hotel/ (空欄=全体)"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">🏷️ ブランドキーワード（表記ゆれ対応）</label>
            <div className="space-y-2">
              {brandKeywords.map((keyword, index) => (
                <input
                  key={index}
                  type="text"
                  value={keyword}
                  onChange={(e) => updateBrandKeyword(index, e.target.value)}
                  placeholder={`ブランド名${index + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'データ取得中...' : '分析を実行'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results Display */}
        {results && results.statistics && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 分析結果サマリー</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <div className="text-sm text-gray-600">分析期間</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {results.statistics.period.days}日間
                  </div>
                  <div className="text-xs text-gray-500">
                    {results.statistics.period.start} ～ {results.statistics.period.end}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-sm text-gray-600">平均クリック数</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Math.round(results.statistics.basic.mean)}
                  </div>
                  <div className="text-xs text-gray-500">
                    標準偏差: {results.statistics.basic.stdDev.toFixed(1)}
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded">
                  <div className="text-sm text-gray-600">変動係数（CV）</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {results.statistics.cv.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {results.statistics.cv < 30 ? '安定' : results.statistics.cv < 50 ? '中程度' : '不安定'}
                  </div>
                </div>
              </div>
            </div>

            {/* Seasonal Analysis */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                🌊 季節性分析
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-2">
                    <div className="p-3 bg-red-50 rounded">
                      <div className="text-sm text-gray-600">ピーク月</div>
                      <div className="text-xl font-bold text-gray-800">
                        {results.statistics.seasonal.peakMonth.month} ({results.statistics.seasonal.peakMonth.avgClicks}クリック)
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="text-sm text-gray-600">低調月</div>
                      <div className="text-xl font-bold text-gray-800">
                        {results.statistics.seasonal.lowMonth.month} ({results.statistics.seasonal.lowMonth.avgClicks}クリック)
                      </div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded">
                      <div className="text-sm text-gray-600">ピーク/低調比</div>
                      <div className="text-xl font-bold text-gray-800">
                        {results.statistics.seasonal.ratio.toFixed(1)}倍
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={results.statistics.seasonal.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avgClicks" fill="#3b82f6" name="平均クリック数" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Weekday Analysis */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                📅 曜日パターン分析
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 rounded">
                    <div className="text-sm text-gray-600">最高曜日</div>
                    <div className="text-xl font-bold text-gray-800">
                      {results.statistics.weekday.bestDow.name} ({results.statistics.weekday.bestDow.avgClicks}クリック)
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">最低曜日</div>
                    <div className="text-xl font-bold text-gray-800">
                      {results.statistics.weekday.worstDow.name} ({results.statistics.weekday.worstDow.avgClicks}クリック)
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded">
                    <div className="text-sm text-gray-600">週末効果</div>
                    <div className="text-xl font-bold text-gray-800">
                      {results.statistics.weekday.weekendEffect}%
                    </div>
                    <div className="text-xs text-gray-500">
                      平日: {results.statistics.weekday.weekdayAvg} / 週末: {results.statistics.weekday.weekendAvg}
                    </div>
                  </div>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={results.statistics.weekday.dowData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avgClicks" fill="#10b981" name="平均クリック数" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                📈 トレンド分析
              </h3>
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded">
                <div className="text-sm text-gray-600">長期トレンド</div>
                <div className="text-2xl font-bold text-gray-800">
                  {results.statistics.trend.direction}トレンド
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  日次変化: {results.statistics.trend.dailyChange}クリック/日
                </div>
              </div>
            </div>

            {/* AI Comment */}
            {results.aiComment && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-3">🤖 AI分析コメント</h3>
                <p className="text-gray-700 leading-relaxed">{results.aiComment}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BrandAnalysis
