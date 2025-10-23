import React, { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, FileText, BarChart3, Calendar, Eye, MousePointer } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from './AuthContext'

function PageTracker() {
  const { user } = useAuth()
  const [siteUrl, setSiteUrl] = useState('https://www.tabirai.net/')
  const [pages, setPages] = useState([])
  const [newPageUrl, setNewPageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(30)
  const [error, setError] = useState('')
  const [selectedPage, setSelectedPage] = useState(null)

  // Supabaseからページを読み込む
  useEffect(() => {
    if (!user?.username) return

    const loadPages = async () => {
      try {
        const response = await fetch(`/api/page-tracker-pages?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)
        const data = await response.json()

        if (response.ok && data.pages) {
          setPages(data.pages)
        }
      } catch (e) {
        console.error('Failed to load pages from database:', e)
        setError('ページの読み込みに失敗しました')
      }
    }

    loadPages()
  }, [user, siteUrl])

  // Supabaseにページを保存する（デバウンス付き）
  useEffect(() => {
    if (pages.length === 0 || !user?.username) return

    const timeoutId = setTimeout(async () => {
      try {
        await fetch('/api/page-tracker-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.username,
            siteUrl,
            pages: pages.map(p => ({
              pageUrl: p.pageUrl,
              pageTitle: p.pageTitle,
              dailyData: p.dailyData || []
            }))
          })
        })
      } catch (e) {
        console.error('Failed to save pages to database:', e)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [pages, user, siteUrl])

  const addPage = () => {
    if (!newPageUrl.trim()) return
    if (pages.length >= 100) {
      setError('ページは100件まで登録できます')
      return
    }

    // 既に登録済みか確認
    if (pages.some(p => p.pageUrl === newPageUrl.trim())) {
      setError('このページは既に登録されています')
      return
    }

    const page = {
      id: Date.now(),
      pageUrl: newPageUrl.trim(),
      siteUrl,
      pageTitle: '',
      latestDate: null,
      latestClicks: 0,
      latestPosition: 0,
      totalClicks: 0,
      totalImpressions: 0,
      avgCtr: 0,
      avgPosition: 0,
      topQueries: [],
      dailyData: []
    }

    setPages([...pages, page])
    setNewPageUrl('')
    setError('')
  }

  const deletePage = async (id) => {
    try {
      const response = await fetch('/api/page-tracker-pages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: id })
      })

      if (response.ok) {
        setPages(pages.filter(p => p.id !== id))
        if (selectedPage?.id === id) {
          setSelectedPage(null)
        }
      } else {
        throw new Error('Failed to delete page')
      }
    } catch (e) {
      console.error('Failed to delete page:', e)
      setError('ページの削除に失敗しました')
    }
  }

  const fetchLatestData = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/page-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          pageUrls: pages.map(p => p.pageUrl),
          period
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'データ取得に失敗しました')
      }

      const updatedPages = pages.map(p => {
        const pageData = data.results.find(r => r.pageUrl === p.pageUrl)
        if (pageData) {
          return {
            ...p,
            latestDate: pageData.latestDate,
            latestClicks: pageData.latestClicks,
            latestPosition: pageData.latestPosition,
            totalClicks: pageData.totalClicks,
            totalImpressions: pageData.totalImpressions,
            avgCtr: pageData.avgCtr,
            avgPosition: pageData.avgPosition,
            topQueries: pageData.topQueries,
            dailyData: [...(p.dailyData || []), ...pageData.dailyData].sort((a, b) =>
              new Date(a.date) - new Date(b.date)
            )
          }
        }
        return p
      })

      setPages(updatedPages)

    } catch (e) {
      console.error('Failed to fetch data:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const getTrend = (dailyData) => {
    if (!dailyData || dailyData.length < 2) return null
    const recent = dailyData.slice(-7)
    const older = dailyData.slice(-14, -7)
    if (recent.length === 0 || older.length === 0) return null

    const recentAvg = recent.reduce((sum, d) => sum + d.clicks, 0) / recent.length
    const olderAvg = older.reduce((sum, d) => sum + d.clicks, 0) / older.length

    if (recentAvg > olderAvg * 1.1) return 'up'
    if (recentAvg < olderAvg * 0.9) return 'down'
    return 'stable'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">GSCページトラッカー</h1>
        <p className="text-gray-600">ページURLを登録して、日次のパフォーマンスを追跡します</p>
      </div>

      {/* 設定エリア */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">サイトURL</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">ページURLを追加</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPage()}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/page/"
                />
                <button
                  onClick={addPage}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  追加
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">取得期間</label>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7日間</option>
                <option value={14}>14日間</option>
                <option value={30}>30日間</option>
                <option value={60}>60日間</option>
                <option value={90}>90日間</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchLatestData}
            disabled={loading || pages.length === 0}
            className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 ${
              loading || pages.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '取得中...' : '最新データを取得'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* ページ一覧 */}
      {pages.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ページURL</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">最終更新</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">クリック数</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">平均順位</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">トレンド</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pages.map((page) => {
                  const trend = getTrend(page.dailyData)
                  return (
                    <tr
                      key={page.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedPage(page)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-md">
                              {page.pageUrl}
                            </div>
                            {page.latestDate && (
                              <div className="text-xs text-gray-500">
                                最終: {formatDate(page.latestDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {page.latestDate ? formatDate(page.latestDate) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {page.totalClicks.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          表示: {page.totalImpressions.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {page.avgPosition > 0 ? page.avgPosition.toFixed(1) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500 mx-auto" />}
                        {trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500 mx-auto" />}
                        {trend === 'stable' && <div className="text-gray-400 text-sm">-</div>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePage(page.id)
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 詳細表示 */}
      {selectedPage && selectedPage.dailyData && selectedPage.dailyData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold mb-1">ページ詳細</h2>
              <p className="text-sm text-gray-600 truncate max-w-2xl">{selectedPage.pageUrl}</p>
            </div>
            <button
              onClick={() => setSelectedPage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="w-4 h-4 text-blue-600" />
                <div className="text-sm text-gray-600">総クリック数</div>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {selectedPage.totalClicks.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-green-600" />
                <div className="text-sm text-gray-600">総表示回数</div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {selectedPage.totalImpressions.toLocaleString()}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <div className="text-sm text-gray-600">平均CTR</div>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {(selectedPage.avgCtr * 100).toFixed(2)}%
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <div className="text-sm text-gray-600">平均順位</div>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {selectedPage.avgPosition.toFixed(1)}
              </div>
            </div>
          </div>

          {/* 日次推移グラフ */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">クリック数と順位の推移</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={selectedPage.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(value)}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" reversed />
                <Tooltip
                  labelFormatter={(value) => formatDate(value)}
                  formatter={(value, name) => {
                    if (name === 'クリック数') return [value.toLocaleString(), name]
                    if (name === '順位') return [value.toFixed(1), name]
                    return [value, name]
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="clicks"
                  stroke="#3b82f6"
                  name="クリック数"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="position"
                  stroke="#f59e0b"
                  name="順位"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* トップクエリ */}
          {selectedPage.topQueries && selectedPage.topQueries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">トップ検索クエリ</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">クリック数</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">表示回数</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">平均順位</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPage.topQueries.map((q, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{q.query}</td>
                        <td className="px-4 py-2 text-center text-gray-900">{q.clicks.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center text-gray-500">{q.impressions.toLocaleString()}</td>
                        <td className="px-4 py-2 text-center text-gray-900">{q.avgPosition.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {pages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>ページURLを追加してください</p>
        </div>
      )}
    </div>
  )
}

export default PageTracker
