import React, { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3, BarChart2, Brain } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import RankTrackerStatisticalResult from './RankTrackerStatisticalResult'
import RankTrackerAIResult from './RankTrackerAIResult'

import { useAuth } from './AuthContext'
function RankTracker() {
  const { user } = useAuth()
  const [siteUrl, setSiteUrl] = useState('https://www.tabirai.net/')
  const [queries, setQueries] = useState([])
  const [newQuery, setNewQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(30)
  const [error, setError] = useState('')
  const [statisticalAnalysis, setStatisticalAnalysis] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [analyzingStats, setAnalyzingStats] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)

  // Supabaseからクエリを読み込む
  useEffect(() => {
    if (!user?.username) return

    const loadQueries = async () => {
      try {
        const response = await fetch(`/api/rank-tracker-queries?userId=${encodeURIComponent(user.username)}&siteUrl=${encodeURIComponent(siteUrl)}`)
        const data = await response.json()

        if (response.ok && data.queries) {
          setQueries(data.queries)
        }
      } catch (e) {
        console.error('Failed to load queries from database:', e)
        setError('クエリの読み込みに失敗しました')
      }
    }

    loadQueries()
  }, [user, siteUrl])

  // Supabaseにクエリを保存する（デバウンス付き）
  useEffect(() => {
    if (queries.length === 0 || !user?.username) return

    const timeoutId = setTimeout(async () => {
      try {
        await fetch('/api/rank-tracker-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.username,
            siteUrl,
            queries: queries.map(q => ({
              query: q.query,
              topPageUrl: q.topPageUrl,
              pageTitle: q.pageTitle,
              currentPosition: q.currentPosition,
              latestDate: q.latestDate,
              history: q.history
            }))
          })
        })
      } catch (e) {
        console.error('Failed to save queries to database:', e)
      }
    }, 1000) // 1秒のデバウンス

    return () => clearTimeout(timeoutId)
  }, [queries, user, siteUrl])

  const addQuery = () => {
    if (!newQuery.trim()) return
    if (queries.length >= 1000) {
      setError('クエリは1000件まで登録できます')
      return
    }

    // 全角スペースを半角スペースに変換
    const normalizedQuery = newQuery.trim().replace(/　/g, ' ')

    const query = {
      id: Date.now(),
      query: normalizedQuery,
      siteUrl,
      topPageUrl: '',
      pageTitle: '',
      currentPosition: null,
      history: {}
    }

    setQueries([...queries, query])
    setNewQuery('')
    setError('')
  }

  const deleteQuery = async (id) => {
    try {
      // Supabaseから削除
      const response = await fetch('/api/rank-tracker-queries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryId: id })
      })

      if (response.ok) {
        // ローカルステートからも削除
        setQueries(queries.filter(q => q.id !== id))
      } else {
        throw new Error('Failed to delete query')
      }
    } catch (e) {
      console.error('Failed to delete query:', e)
      setError('クエリの削除に失敗しました')
    }
  }

  const fetchLatestRanks = async () => {
    setLoading(true)
    setError('')
    console.log('[fetchLatestRanks] Starting...')
    console.log('[fetchLatestRanks] siteUrl:', siteUrl)
    console.log('[fetchLatestRanks] queries:', queries.map(q => q.query))
    console.log('[fetchLatestRanks] period:', period)

    try {
      const response = await fetch('/api/rank-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          queries: queries.map(q => q.query),
          period
        })
      })

      console.log('[fetchLatestRanks] Response status:', response.status)

      const data = await response.json()
      console.log('[fetchLatestRanks] Response data:', data)

      if (!response.ok) {
        console.error('[fetchLatestRanks] Error response:', data)
        throw new Error(data.error || 'データ取得に失敗しました')
      }

      console.log('[fetchLatestRanks] Results count:', data.results?.length)

      const updatedQueries = queries.map(q => {
        const rankData = data.results.find(r => r.query === q.query)
        console.log(`[fetchLatestRanks] Query "${q.query}":`, rankData)
        if (rankData) {
          return {
            ...q,
            topPageUrl: rankData.topPageUrl,
            pageTitle: rankData.pageTitle,
            currentPosition: rankData.currentPosition,
            latestDate: rankData.latestDate,
            history: { ...q.history, ...rankData.history }
          }
        }
        return q
      })

      console.log('[fetchLatestRanks] Updated queries:', updatedQueries)
      setQueries(updatedQueries)
    } catch (err) {
      console.error('[fetchLatestRanks] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      console.log('[fetchLatestRanks] Complete')
    }
  }

  const getDates = () => {
    // 実際に取得できたデータの日付を使用
    const allDates = new Set()
    queries.forEach(query => {
      if (query.history) {
        Object.keys(query.history).forEach(date => allDates.add(date))
      }
    })

    if (allDates.size === 0) {
      // データがない場合は仮の日付を生成
      const dates = []
      for (let i = 0; i < period; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i - 2)
        dates.push(date.toISOString().split('T')[0])
      }
      return dates.reverse()
    }

    // 日付を昇順ソート（古い→新しい）して、最新period日分を取得し、逆順にする（最新が左）
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
    const recentDates = sortedDates.slice(-period)
    return recentDates.reverse() // 最新が左になるように逆順
  }

  const getAveragePosition = (query) => {
    const positions = Object.values(query.history).filter(p => p !== null && p !== undefined)
    if (positions.length === 0) return null
    return positions.reduce((sum, pos) => sum + pos, 0) / positions.length
  }

  const getMedianPosition = (query) => {
    const positions = Object.values(query.history).filter(p => p !== null && p !== undefined).sort((a, b) => a - b)
    if (positions.length === 0) return null
    const mid = Math.floor(positions.length / 2)
    return positions.length % 2 === 0 ? (positions[mid - 1] + positions[mid]) / 2 : positions[mid]
  }

  const getStandardDeviation = (query) => {
    const positions = Object.values(query.history).filter(p => p !== null && p !== undefined)
    if (positions.length < 2) return null
    const avg = positions.reduce((sum, pos) => sum + pos, 0) / positions.length
    const variance = positions.reduce((sum, pos) => sum + Math.pow(pos - avg, 2), 0) / positions.length
    return Math.sqrt(variance)
  }

  const getStabilityScore = (query) => {
    const stdDev = getStandardDeviation(query)
    if (stdDev === null || stdDev === 0) return null
    // 標準偏差が小さいほど安定 → スコアは高い（100 - 正規化した標準偏差）
    // 標準偏差を0-100に正規化（最大100として）
    const normalizedStdDev = Math.min(stdDev, 100)
    return 100 - normalizedStdDev
  }

  const getPreviousDayPosition = (query, dates) => {
    // dates配列から前日を取得（dates[0]が最新、dates[1]が前日）
    if (!dates || dates.length < 2) return null
    const prevDate = dates[1]
    return query.history[prevDate] || null
  }

  const getDayOverDayChange = (query, dates) => {
    // dates配列から最新日と前日を取得
    if (!dates || dates.length < 2) return null
    const currentDate = dates[0]
    const prevDate = dates[1]

    const current = query.history[currentDate]
    const previous = query.history[prevDate]

    if (current == null || previous == null) return null
    return previous - current // 順位が下がる（数値増加）= マイナス, 順位が上がる（数値減少）= プラス
  }

  const getCurrentDate = () => {
    // 実際に取得できた最新日を使用
    if (queries.length > 0 && queries[0].latestDate) {
      return queries[0].latestDate
    }
    // フォールバック: 3日前
    const date = new Date()
    date.setDate(date.getDate() - 3)
    return date.toISOString().split('T')[0]
  }

  const dates = getDates()
  const currentDate = getCurrentDate()

  // サマリ統計の計算
  const getOverallStats = () => {
    if (queries.length === 0) return null

    const allPositions = queries.map(q => ({
      avg: getAveragePosition(q),
      current: q.currentPosition,
      change: getDayOverDayChange(q, dates),
      stability: getStabilityScore(q)
    })).filter(p => p.avg !== null && p.current !== null)

    if (allPositions.length === 0) return null

    const avgChange = allPositions
      .filter(p => p.change !== null)
      .reduce((sum, p) => sum + p.change, 0) / allPositions.filter(p => p.change !== null).length

    const avgStability = allPositions
      .filter(p => p.stability !== null)
      .reduce((sum, p) => sum + p.stability, 0) / allPositions.filter(p => p.stability !== null).length

    return {
      avgChange,
      avgStability,
      totalQueries: queries.length
    }
  }

  // 順位シェア分析データ
  const getRankShareData = () => {
    if (queries.length === 0) return []

    const ranges = {
      '1～3位': 0,
      '3～6位': 0,
      '6～10位': 0,
      '10～20位': 0,
      '20位以上': 0,
      '圏外': 0
    }

    queries.forEach(q => {
      const pos = q.currentPosition
      if (!pos) {
        ranges['圏外']++
      } else if (pos < 3) {
        ranges['1～3位']++
      } else if (pos < 6) {
        ranges['3～6位']++
      } else if (pos < 10) {
        ranges['6～10位']++
      } else if (pos < 20) {
        ranges['10～20位']++
      } else {
        ranges['20位以上']++
      }
    })

    return Object.entries(ranges).map(([name, value]) => ({
      name,
      value,
      percentage: queries.length > 0 ? (value / queries.length * 100).toFixed(1) : 0
    }))
  }

  const overallStats = getOverallStats()
  const rankShareData = getRankShareData()
  const rankColors = {
    '1～3位': '#10b981',
    '3～6位': '#3b82f6',
    '6～10位': '#f59e0b',
    '10～20位': '#ef4444',
    '20位以上': '#9ca3af',
    '圏外': '#6b7280'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">GSCランクトラッカー</h1>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">サイトURL</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">クエリを追加</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addQuery()}
                placeholder="検索クエリを入力..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addQuery}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLatestRanks}
              disabled={loading || queries.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              最新順位を取得
            </button>

            <div className="grid grid-cols-6 gap-1 border border-gray-300 rounded p-1">
              {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1.5 text-xs rounded transition-colors ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}日
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mt-2 text-sm text-gray-600">
          登録クエリ数: {queries.length} / 1000
        </div>
      </div>

      {/* サマリパネル */}
      {overallStats && (
        <div className="bg-white border-b p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">サマリ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 平均変化量 */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                {overallStats.avgChange > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <h3 className="text-sm font-medium text-gray-700">全体平均変化量</h3>
              </div>
              <p className={`text-3xl font-bold ${overallStats.avgChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overallStats.avgChange > 0 ? '+' : ''}{overallStats.avgChange.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600 mt-1">前日比の平均</p>
            </div>

            {/* 安定性スコア */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-700">平均安定性スコア</h3>
              </div>
              <p className={`text-3xl font-bold ${
                overallStats.avgStability >= 70 ? 'text-green-600' :
                overallStats.avgStability >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {overallStats.avgStability.toFixed(1)}
              </p>
              <p className="text-xs text-gray-600 mt-1">全クエリの標準偏差ベース</p>
            </div>

            {/* 総クエリ数 */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-medium text-gray-700">追跡中クエリ</h3>
              </div>
              <p className="text-3xl font-bold text-gray-800">
                {overallStats.totalQueries}
              </p>
              <p className="text-xs text-gray-600 mt-1">データ取得済み</p>
            </div>
          </div>

          {/* クエリ順位シェアグラフ */}
          {rankShareData.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-md font-bold text-gray-800 mb-3">クエリ順位シェア分析</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rankShareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value}件 (${props.payload.percentage}%)`,
                      'クエリ数'
                    ]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {rankShareData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={rankColors[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700 sticky left-0 bg-gray-100 z-20">操作</th>
              <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700 sticky left-[60px] bg-gray-100 z-20 min-w-[200px]">クエリ</th>
              <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700 min-w-[300px]">トップページURL</th>
              <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700 min-w-[200px]">ページタイトル</th>
              <th className="border px-4 py-2 text-center text-sm font-medium text-gray-700 min-w-[90px]">安定性<br/>スコア</th>
              <th className="border px-4 py-2 text-center text-sm font-medium text-gray-700 min-w-[80px]">平均順位</th>
              <th className="border px-4 py-2 text-center text-sm font-medium text-gray-700 min-w-[80px]">中央値</th>
              {dates.map((date, index) => (
                <th key={date} className="border px-2 py-2 text-center text-xs font-medium text-gray-700 min-w-[60px]">
                  {index === 0 ? '最新' : ''}<br/>{date.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queries.length === 0 ? (
              <tr>
                <td colSpan={6 + dates.length} className="border px-4 py-8 text-center text-gray-500">
                  クエリを追加してください
                </td>
              </tr>
            ) : (
              queries.map(q => {
                const stabilityScore = getStabilityScore(q)
                const dayChange = getDayOverDayChange(q, dates)

                return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="border px-2 py-2 sticky left-0 bg-white">
                      <button
                        onClick={() => deleteQuery(q.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="border px-4 py-2 text-sm sticky left-[60px] bg-white">{q.query}</td>
                    <td className="border px-4 py-2 text-sm">
                      {q.topPageUrl ? (
                        <a href={q.topPageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                          {q.topPageUrl}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="border px-4 py-2 text-sm truncate">{q.pageTitle || '-'}</td>
                    <td className={`border px-4 py-2 text-center font-medium ${
                      stabilityScore !== null && stabilityScore >= 70 ? 'text-green-600' :
                      stabilityScore !== null && stabilityScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {stabilityScore !== null ? stabilityScore.toFixed(1) : '-'}
                    </td>
                    <td className="border px-4 py-2 text-center font-medium">
                      {getAveragePosition(q) ? getAveragePosition(q).toFixed(1) : '-'}
                    </td>
                    <td className="border px-4 py-2 text-center font-medium">
                      {getMedianPosition(q) !== null ? getMedianPosition(q).toFixed(1) : '-'}
                    </td>
                    {dates.map((date, index) => (
                      <td key={date} className="border px-2 py-2 text-center text-sm">
                        <div className="flex flex-col items-center">
                          <span>{q.history[date] ? q.history[date].toFixed(1) : '-'}</span>
                          {index === 0 && dayChange !== null && (
                            <span className={`text-xs ${dayChange > 0 ? 'text-green-600' : dayChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {dayChange > 0 ? `↑+${dayChange.toFixed(1)}` : dayChange < 0 ? `↓${dayChange.toFixed(1)}` : '→0'}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 統計分析・AI分析セクション */}
      {queries.length > 0 && queries.some(q => Object.keys(q.history).length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-8 mx-4 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">さらに詳しく分析する</h2>

          {/* 説明文 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              📊 <strong>統計分析:</strong> 移動平均線、ボラティリティ、相関分析、7日後予測など、数理統計に基づく詳細分析を即座に実行します。
            </p>
            <p className="text-sm text-blue-800 mt-2">
              🤖 <strong>AI分析:</strong> Gemini AIが順位変動の要因を推定し、検索意図を分析、クエリをポートフォリオ分類、自然言語インサイトを生成します（1-2分）。
            </p>
          </div>

          {/* 分析ボタン */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => {
                setError('この機能は現在準備中です')
              }}
              disabled={true}
              className="flex items-center justify-center gap-2 bg-gray-400 text-white px-6 py-4 rounded-lg cursor-not-allowed opacity-50"
              title="準備中：統計分析APIが未実装です"
            >
              <BarChart2 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">📊 詳細を統計分析 (準備中)</div>
                <div className="text-xs opacity-90">APIを実装中</div>
              </div>
            </button>

            <button
              onClick={async () => {
                setAnalyzingAI(true)
                setError('')
                try {
                  const response = await fetch('/api/rank-tracker-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ queries, siteUrl })
                  })
                  const data = await response.json()
                  if (!response.ok) throw new Error(data.error)
                  setAiAnalysis(data)
                } catch (err) {
                  setError('AI分析に失敗しました: ' + err.message)
                } finally {
                  setAnalyzingAI(false)
                }
              }}
              disabled={analyzingAI}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Brain className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">🤖 詳細をAI分析</div>
                <div className="text-xs opacity-90">1-2分程度</div>
              </div>
            </button>

            <button
              onClick={() => {
                setError('この機能は現在準備中です（統計分析APIが未実装）')
              }}
              disabled={true}
              className="flex items-center justify-center gap-2 bg-gray-400 text-white px-6 py-4 rounded-lg cursor-not-allowed opacity-50"
              title="準備中：統計分析APIが未実装です"
            >
              <Activity className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">🚀 両方を同時実行 (準備中)</div>
                <div className="text-xs opacity-90">統計分析APIを実装中</div>
              </div>
            </button>
            {/* 旧コード（APIが削除されたためコメントアウト）
            <button
              onClick={async () => {
                setAnalyzingStats(true)
                setAnalyzingAI(true)
                setError('')
                try {
                  const [statsRes, aiRes] = await Promise.all([
                    fetch('/api/rank-tracker-stats', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ queries })
                    }),
                    fetch('/api/rank-tracker-ai', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ queries, siteUrl })
                    })
                  ])
                  const statsData = await statsRes.json()
                  const aiData = await aiRes.json()
                  if (!statsRes.ok) throw new Error(statsData.error)
                  if (!aiRes.ok) throw new Error(aiData.error)
                  setStatisticalAnalysis(statsData)
                  setAiAnalysis(aiData)
                } catch (err) {
                  setError('分析に失敗しました: ' + err.message)
                } finally {
                  setAnalyzingStats(false)
                  setAnalyzingAI(false)
                }
              }}
              disabled={analyzingStats || analyzingAI}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-left">
                <div className="font-semibold">両方実行</div>
                <div className="text-xs opacity-90">統計 + AI分析</div>
              </div>
            </button>
            */}
          </div>

          {/* ローディング表示 */}
          {(analyzingStats || analyzingAI) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  {analyzingStats && <p className="text-sm text-blue-800">📊 統計分析中...</p>}
                  {analyzingAI && <p className="text-sm text-blue-800">🤖 AI分析中... (1-2分程度かかります)</p>}
                </div>
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">⚠️ {error}</p>
            </div>
          )}

          {/* 統計分析結果 */}
          {statisticalAnalysis && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-blue-600" />
                統計分析結果
              </h3>
              <RankTrackerStatisticalResult data={statisticalAnalysis} />
            </div>
          )}

          {/* AI分析結果 */}
          {aiAnalysis && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-600" />
                AI分析結果
              </h3>
              <RankTrackerAIResult data={aiAnalysis} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RankTracker
