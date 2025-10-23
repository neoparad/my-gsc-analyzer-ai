import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, RefreshCw, FileText } from 'lucide-react'
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

    if (pages.some(p => p.pageUrl === newPageUrl.trim())) {
      setError('このページは既に登録されています')
      return
    }

    const page = {
      id: Date.now(),
      pageUrl: newPageUrl.trim(),
      siteUrl,
      pageTitle: '',
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
            dailyData: pageData.dailyData
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

  // 日付リストを生成（選択された期間分）
  const dateList = useMemo(() => {
    if (pages.length === 0 || pages.every(p => !p.dailyData || p.dailyData.length === 0)) {
      return []
    }

    // 全ページの全日付を収集
    const allDates = new Set()
    pages.forEach(page => {
      if (page.dailyData) {
        page.dailyData.forEach(day => {
          allDates.add(day.date)
        })
      }
    })

    // ソートして返す
    return Array.from(allDates).sort().slice(-period)
  }, [pages, period])

  // 全体サマリーデータを計算
  const summaryData = useMemo(() => {
    if (dateList.length === 0) return []

    return dateList.map(date => {
      let totalClicks = 0
      let totalQueries = 0
      let positionSum = 0
      let positionCount = 0

      pages.forEach(page => {
        const dayData = page.dailyData?.find(d => d.date === date)
        if (dayData) {
          totalClicks += dayData.clicks || 0
          totalQueries += (dayData.topQueries?.length || 0)
          if (dayData.position > 0) {
            positionSum += dayData.position
            positionCount++
          }
        }
      })

      return {
        date,
        clicks: totalClicks,
        queries: totalQueries,
        avgPosition: positionCount > 0 ? positionSum / positionCount : 0
      }
    })
  }, [pages, dateList])

  // 統計計算関数
  const calculateStats = (values) => {
    if (values.length === 0) return { avg: 0, median: 0, latest: 0 }

    const sortedValues = [...values].sort((a, b) => a - b)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)]
    const latest = values[values.length - 1]

    return { avg, median, latest }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="p-8 max-w-full mx-auto">
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
          </div>

          {/* 期間選択ボタン */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">取得期間</label>
            <div className="flex gap-2">
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setPeriod(days)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    period === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days}日間
                </button>
              ))}
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

      {/* 全体サマリーグラフ */}
      {summaryData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4">全ページ集計サマリー</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総クリック数</div>
              <div className="text-2xl font-bold text-blue-600">
                {summaryData.reduce((sum, d) => sum + d.clicks, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総クエリ数</div>
              <div className="text-2xl font-bold text-green-600">
                {summaryData.reduce((sum, d) => sum + d.queries, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">平均順位</div>
              <div className="text-2xl font-bold text-orange-600">
                {(summaryData.reduce((sum, d) => sum + d.avgPosition, 0) / summaryData.filter(d => d.avgPosition > 0).length).toFixed(1)}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={summaryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" reversed />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value, name) => {
                  if (name === 'クリック数' || name === 'クエリ数') return [value.toLocaleString(), name]
                  if (name === '平均順位') return [value.toFixed(1), name]
                  return [value, name]
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#3b82f6" name="クリック数" strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="queries" stroke="#10b981" name="クエリ数" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="avgPosition" stroke="#f59e0b" name="平均順位" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ページデータテーブル */}
      {pages.length > 0 && dateList.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 min-w-[300px]">
                    URL / 指標
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                    平均値
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                    中央値
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                    最新
                  </th>
                  {dateList.map(date => (
                    <th key={date} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[80px]">
                      {formatDate(date)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase sticky right-0 bg-gray-50 min-w-[60px]">
                    削除
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pages.map((page, pageIndex) => {
                  // 各指標のデータを収集
                  const clicksData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.clicks || 0
                  })

                  const queriesData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.topQueries?.length || 0
                  })

                  const positionData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.position || 0
                  }).filter(p => p > 0)

                  const clicksStats = calculateStats(clicksData)
                  const queriesStats = calculateStats(queriesData)
                  const positionStats = calculateStats(positionData)

                  const lastUpdate = page.dailyData && page.dailyData.length > 0
                    ? page.dailyData[page.dailyData.length - 1].date
                    : null

                  return (
                    <React.Fragment key={page.id}>
                      {/* URL/ページ情報行 */}
                      <tr className="bg-blue-50">
                        <td className="px-4 py-3 sticky left-0 bg-blue-50 z-10" rowSpan={4}>
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 break-all">
                                {page.pageUrl}
                              </div>
                              {lastUpdate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  最終更新: {formatDate(lastUpdate)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td colSpan={3 + dateList.length} className="px-4 py-2 text-center text-xs font-semibold text-gray-600 bg-blue-50">
                          ページ #{pageIndex + 1}
                        </td>
                        <td className="px-4 py-3 text-center sticky right-0 bg-blue-50 z-10" rowSpan={4}>
                          <button
                            onClick={() => deletePage(page.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* クリック数行 */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center font-medium text-blue-600">
                          {clicksStats.avg.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-blue-600">
                          {clicksStats.median.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-blue-600">
                          {clicksStats.latest.toFixed(0)}
                        </td>
                        {dateList.map((date, idx) => (
                          <td key={date} className="px-4 py-2 text-center text-gray-700">
                            {clicksData[idx].toLocaleString()}
                          </td>
                        ))}
                      </tr>

                      {/* クエリ数行 */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center font-medium text-green-600">
                          {queriesStats.avg.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-green-600">
                          {queriesStats.median.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-green-600">
                          {queriesStats.latest.toFixed(0)}
                        </td>
                        {dateList.map((date, idx) => (
                          <td key={date} className="px-4 py-2 text-center text-gray-700">
                            {queriesData[idx]}
                          </td>
                        ))}
                      </tr>

                      {/* 平均順位行 */}
                      <tr className="hover:bg-gray-50 border-b-2 border-gray-300">
                        <td className="px-4 py-2 text-center font-medium text-orange-600">
                          {positionData.length > 0 ? positionStats.avg.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-orange-600">
                          {positionData.length > 0 ? positionStats.median.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-orange-600">
                          {positionData.length > 0 ? positionStats.latest.toFixed(1) : '-'}
                        </td>
                        {dateList.map(date => {
                          const dayData = page.dailyData?.find(d => d.date === date)
                          const position = dayData?.position || 0
                          return (
                            <td key={date} className="px-4 py-2 text-center text-gray-700">
                              {position > 0 ? position.toFixed(1) : '-'}
                            </td>
                          )
                        })}
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 凡例 */}
          <div className="px-6 py-4 bg-gray-50 border-t flex gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>クリック数</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded"></div>
              <span>クエリ数</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-600 rounded"></div>
              <span>平均順位</span>
            </div>
          </div>
        </div>
      )}

      {pages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>ページURLを追加してください</p>
        </div>
      )}

      {pages.length > 0 && dateList.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>「最新データを取得」ボタンをクリックしてデータを取得してください</p>
        </div>
      )}
    </div>
  )
}

export default PageTracker
