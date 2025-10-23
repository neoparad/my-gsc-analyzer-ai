import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, RefreshCw, FileText, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
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
  const [expandedGraphs, setExpandedGraphs] = useState({})

  // Supabaseからページを読み込む
  useEffect(() => {
    if (!user?.username) return

    const loadPages = async () => {
      try {
        const response = await fetch(`/api/page-tracker-pages?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)
        const data = await response.json()

        if (response.ok && data.pages) {
          // dailyDataも含めて復元
          setPages(data.pages)
        }
      } catch (e) {
        console.error('Failed to load pages from database:', e)
        // 初回読み込み時のエラーは表示しない（データがない場合がある）
      }
    }

    loadPages()
  }, [user, siteUrl])

  const addPage = async () => {
    if (!newPageUrl.trim()) return
    if (pages.length >= 100) {
      setError('ページは100件まで登録できます')
      return
    }

    if (pages.some(p => p.pageUrl === newPageUrl.trim())) {
      setError('このページは既に登録されています')
      return
    }

    setError('')
    console.log('[addPage] Starting, userId:', user.username, 'siteUrl:', siteUrl, 'pageUrl:', newPageUrl.trim())

    try {
      // データベースに保存
      console.log('[addPage] Sending POST request...')
      const response = await fetch('/api/page-tracker-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.username,
          siteUrl,
          pages: [{
            pageUrl: newPageUrl.trim(),
            pageTitle: '',
            dailyData: []
          }]
        })
      })

      console.log('[addPage] POST response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[addPage] POST error:', errorData)
        throw new Error(errorData.error || 'ページの保存に失敗しました')
      }

      const saveData = await response.json()
      console.log('[addPage] POST success:', saveData)

      // データベースから最新のページリストを取得
      console.log('[addPage] Fetching updated page list...')
      const loadResponse = await fetch(`/api/page-tracker-pages?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)

      console.log('[addPage] GET response status:', loadResponse.status)

      if (!loadResponse.ok) {
        const errorData = await loadResponse.json()
        console.error('[addPage] GET error:', errorData)
        throw new Error('ページの読み込みに失敗しました')
      }

      const data = await loadResponse.json()
      console.log('[addPage] GET success, pages:', data.pages)
      setPages(data.pages || [])
      setNewPageUrl('')
      console.log('[addPage] Complete!')
    } catch (e) {
      console.error('[addPage] Error:', e)
      setError(e.message || 'ページの追加に失敗しました')
    }
  }

  const deletePage = async (id) => {
    setError('')

    try {
      const response = await fetch('/api/page-tracker-pages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: id })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'ページの削除に失敗しました')
      }

      // データベースから最新のページリストを取得
      const loadResponse = await fetch(`/api/page-tracker-pages?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)

      if (!loadResponse.ok) {
        throw new Error('ページの読み込みに失敗しました')
      }

      const data = await loadResponse.json()
      setPages(data.pages || [])
    } catch (e) {
      console.error('Failed to delete page:', e)
      setError(e.message || 'ページの削除に失敗しました')
    }
  }

  const fetchLatestData = async () => {
    setLoading(true)
    setError('')

    try {
      // GSCからデータ取得
      const response = await fetch('/api/page-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          pageUrls: pages.map(p => p.pageUrl),
          period
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'データ取得に失敗しました')
      }

      const data = await response.json()

      // 既存データと新規データをマージ
      const updatedPages = pages.map(p => {
        const pageData = data.results.find(r => r.pageUrl === p.pageUrl)
        if (pageData) {
          const existingDataMap = new Map((p.dailyData || []).map(d => [d.date, d]))
          pageData.dailyData.forEach(d => {
            existingDataMap.set(d.date, d)
          })
          const mergedData = Array.from(existingDataMap.values()).sort((a, b) =>
            new Date(a.date) - new Date(b.date)
          )

          return {
            ...p,
            dailyData: mergedData,
            latestDate: pageData.latestDate || null,
            pageTitle: pageData.pageTitle || p.pageTitle || ''
          }
        }
        return p
      })

      // データベースに保存
      const saveResponse = await fetch('/api/page-tracker-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.username,
          siteUrl,
          pages: updatedPages.map(p => ({
            pageUrl: p.pageUrl,
            pageTitle: p.pageTitle,
            latestDate: p.latestDate,
            dailyData: p.dailyData || []
          }))
        })
      })

      if (!saveResponse.ok) {
        console.warn('Failed to save to database, but showing data')
      }

      // データベースから最新データを取得
      const loadResponse = await fetch(`/api/page-tracker-pages?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)

      if (loadResponse.ok) {
        const loadData = await loadResponse.json()
        setPages(loadData.pages || [])
      } else {
        // 保存または読み込みに失敗した場合は、マージしたデータを表示
        setPages(updatedPages)
      }

    } catch (e) {
      console.error('Failed to fetch data:', e)
      setError(e.message || 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 日付リストを生成（最新が左、過去が右）
  const dateList = useMemo(() => {
    if (pages.length === 0 || pages.every(p => !p.dailyData || p.dailyData.length === 0)) {
      return []
    }

    const allDates = new Set()
    pages.forEach(page => {
      if (page.dailyData) {
        page.dailyData.forEach(day => {
          allDates.add(day.date)
        })
      }
    })

    // ソートして最新period日分を取得し、逆順にする（最新が左）
    return Array.from(allDates).sort().slice(-period).reverse()
  }, [pages, period])

  // 全体サマリーデータを計算
  const summaryData = useMemo(() => {
    if (dateList.length === 0) return { totalUniqueQueries: 0, dailyData: [] }

    // 期間全体のユニーククエリを集計（サマリーカードの表示用）
    const allUniqueQueries = new Set()
    pages.forEach(page => {
      page.dailyData?.forEach(dayData => {
        // topQueriesからクエリを抽出（期間全体の集計用）
        dayData.topQueries?.forEach(q => {
          allUniqueQueries.add(q.query)
        })
      })
    })

    // 逆順（古い順）にしてグラフ表示用
    const sortedDates = [...dateList].reverse()

    return {
      totalUniqueQueries: allUniqueQueries.size,
      dailyData: sortedDates.map(date => {
        let totalClicks = 0
        let positionSum = 0
        let positionCount = 0
        let totalUniqueQueries = 0

        pages.forEach(page => {
          const dayData = page.dailyData?.find(d => d.date === date)
          if (dayData) {
            totalClicks += dayData.clicks || 0
            if (dayData.position > 0) {
              positionSum += dayData.position
              positionCount++
            }
            // 各ページのuniqueQueryCountを合計（実際のユニーククエリ数）
            totalUniqueQueries += dayData.uniqueQueryCount || 0
          }
        })

        return {
          date,
          clicks: totalClicks,
          queries: totalUniqueQueries, // 全ページの実際のユニーククエリ数の合計
          avgPosition: positionCount > 0 ? positionSum / positionCount : 0
        }
      })
    }
  }, [pages, dateList])

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // 平均値と中央値を計算する関数
  const calculateStats = (data) => {
    const validData = data.filter(v => v > 0)
    if (validData.length === 0) return { avg: 0, median: 0 }

    const avg = validData.reduce((sum, v) => sum + v, 0) / validData.length
    const sorted = [...validData].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]

    return { avg, median }
  }

  // グラフの展開/折りたたみを切り替え
  const toggleGraph = (pageId) => {
    setExpandedGraphs(prev => ({
      ...prev,
      [pageId]: !prev[pageId]
    }))
  }

  return (
    <div className="p-8 max-w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">GSCページトラッカー</h1>
        <p className="text-gray-600">ページURLを登録して、日次のパフォーマンスを追跡します</p>
      </div>

      {/* 設定エリア - GSCランクトラッカーと同じレイアウト */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-12 gap-4 items-end">
          {/* サイトURL */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">サイトURL</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/"
            />
          </div>

          {/* ページURLを追加 */}
          <div className="col-span-4">
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          </div>

          {/* 期間選択 */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">取得期間</label>
            <div className="flex gap-2">
              {[30, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setPeriod(days)}
                  className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    period === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days}日
                </button>
              ))}
            </div>
          </div>

          {/* 取得ボタン */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">取得</label>
            <button
              onClick={fetchLatestData}
              disabled={loading || pages.length === 0}
              className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 ${
                loading || pages.length === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '取得中' : '最新データ取得'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 全体サマリーグラフ */}
      {summaryData.dailyData && summaryData.dailyData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-bold mb-4">全ページ集計サマリー</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">総クリック数</div>
              <div className="text-2xl font-bold text-blue-600">
                {summaryData.dailyData.reduce((sum, d) => sum + d.clicks, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">獲得クエリ数</div>
              <div className="text-2xl font-bold text-green-600">
                {summaryData.totalUniqueQueries.toLocaleString()}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">平均順位</div>
              <div className="text-2xl font-bold text-orange-600">
                {(summaryData.dailyData.reduce((sum, d) => sum + d.avgPosition, 0) / summaryData.dailyData.filter(d => d.avgPosition > 0).length).toFixed(1)}
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={summaryData.dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" reversed />
              <Tooltip
                labelFormatter={formatDate}
                formatter={(value, name) => {
                  if (name === 'クリック数' || name === '獲得クエリ数') return [value.toLocaleString(), name]
                  if (name === '平均順位') return [value.toFixed(1), name]
                  return [value, name]
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#3b82f6" name="クリック数" strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="queries" stroke="#10b981" name="獲得クエリ数" strokeWidth={2} />
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase min-w-[80px] bg-blue-50">
                    平均値
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase min-w-[80px] bg-blue-50">
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
                  // 各指標のデータを収集（最新が左なので順序はdateListのまま）
                  const clicksData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.clicks || 0
                  })

                  const queriesData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.uniqueQueryCount || 0
                  })

                  const positionData = dateList.map(date => {
                    const dayData = page.dailyData?.find(d => d.date === date)
                    return dayData?.position || 0
                  })

                  // latestDateフィールドを優先、なければdailyDataから最新日を取得
                  const lastUpdate = page.latestDate || (
                    page.dailyData && page.dailyData.length > 0
                      ? page.dailyData[page.dailyData.length - 1].date
                      : null
                  )

                  // 各指標の統計値を計算
                  const clicksStats = calculateStats(clicksData)
                  const queriesStats = calculateStats(queriesData)
                  const positionStats = calculateStats(positionData)

                  return (
                    <React.Fragment key={page.id}>
                      {/* URL/ページ情報行 */}
                      <tr className="bg-blue-50">
                        <td className="px-4 py-3 sticky left-0 bg-blue-50 z-10" rowSpan={4}>
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 break-all">
                                {page.pageUrl}
                              </div>
                              {lastUpdate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  最終更新: {formatDate(lastUpdate)}
                                </div>
                              )}
                              <button
                                onClick={() => toggleGraph(page.id)}
                                className="mt-2 px-3 py-1 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                              >
                                <BarChart3 className="w-3 h-3" />
                                {expandedGraphs[page.id] ? 'グラフを閉じる' : 'グラフで見る'}
                                {expandedGraphs[page.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
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
                        <td className="px-4 py-2 text-center font-semibold text-blue-700 bg-blue-50">
                          {clicksStats.avg > 0 ? clicksStats.avg.toFixed(1) : '0'}
                        </td>
                        <td className="px-4 py-2 text-center font-semibold text-blue-700 bg-blue-50">
                          {clicksStats.median > 0 ? clicksStats.median.toFixed(1) : '0'}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-blue-600">
                          {clicksData[0]?.toLocaleString() || 0}
                        </td>
                        {clicksData.map((clicks, idx) => (
                          <td key={idx} className="px-4 py-2 text-center text-gray-700">
                            {clicks.toLocaleString()}
                          </td>
                        ))}
                      </tr>

                      {/* クエリ数行 */}
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-center font-semibold text-green-700 bg-blue-50">
                          {queriesStats.avg > 0 ? queriesStats.avg.toFixed(1) : '0'}
                        </td>
                        <td className="px-4 py-2 text-center font-semibold text-green-700 bg-blue-50">
                          {queriesStats.median > 0 ? queriesStats.median.toFixed(0) : '0'}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-green-600">
                          {queriesData[0] || 0}
                        </td>
                        {queriesData.map((queries, idx) => (
                          <td key={idx} className="px-4 py-2 text-center text-gray-700">
                            {queries}
                          </td>
                        ))}
                      </tr>

                      {/* 平均順位行 */}
                      <tr className="hover:bg-gray-50 border-b-2 border-gray-300">
                        <td className="px-4 py-2 text-center font-semibold text-orange-700 bg-blue-50">
                          {positionStats.avg > 0 ? positionStats.avg.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-2 text-center font-semibold text-orange-700 bg-blue-50">
                          {positionStats.median > 0 ? positionStats.median.toFixed(1) : '-'}
                        </td>
                        <td className="px-4 py-2 text-center font-medium text-orange-600">
                          {positionData[0] > 0 ? positionData[0].toFixed(1) : '-'}
                        </td>
                        {positionData.map((position, idx) => (
                          <td key={idx} className="px-4 py-2 text-center text-gray-700">
                            {position > 0 ? position.toFixed(1) : '-'}
                          </td>
                        ))}
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

      {/* 個別ページグラフ - テーブルの外側に配置 */}
      {pages.length > 0 && dateList.length > 0 && pages.map((page, pageIndex) => (
        expandedGraphs[page.id] && (
          <div key={`graph-${page.id}`} className="bg-white rounded-lg shadow-sm overflow-hidden mt-6 p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-800">
              ページ #{pageIndex + 1} のパフォーマンス推移
            </h3>
            <p className="text-sm text-gray-600 mb-4 break-all">
              {page.pageUrl}
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...dateList].reverse().map(date => {
                const dayData = page.dailyData?.find(d => d.date === date)
                return {
                  date,
                  clicks: dayData?.clicks || 0,
                  queries: dayData?.uniqueQueryCount || 0,
                  position: dayData?.position || 0
                }
              })}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" reversed />
                <Tooltip
                  labelFormatter={formatDate}
                  formatter={(value, name) => {
                    if (name === 'クリック数' || name === '獲得クエリ数') return [value.toLocaleString(), name]
                    if (name === '平均順位') return [value > 0 ? value.toFixed(1) : '-', name]
                    return [value, name]
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#3b82f6" name="クリック数" strokeWidth={2} />
                <Line yAxisId="left" type="monotone" dataKey="queries" stroke="#10b981" name="獲得クエリ数" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="position" stroke="#f59e0b" name="平均順位" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      ))}

      {pages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>ページURLを追加してください</p>
        </div>
      )}

      {pages.length > 0 && dateList.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>「最新データ取得」ボタンをクリックしてデータを取得してください</p>
        </div>
      )}
    </div>
  )
}

export default PageTracker
