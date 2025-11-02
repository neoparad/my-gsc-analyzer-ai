import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, Trash2, RefreshCw } from 'lucide-react'

function DirectoryQueryAnalysis() {
  const [siteUrl, setSiteUrl] = useState(() => sessionStorage.getItem('dirQueryAnalysis_siteUrl') || 'https://www.tabirai.net/')
  const [startMonth, setStartMonth] = useState(() => sessionStorage.getItem('dirQueryAnalysis_startMonth') || '')
  const [endMonth, setEndMonth] = useState(() => sessionStorage.getItem('dirQueryAnalysis_endMonth') || '')
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('dirQueryAnalysis_viewMode') || 'monthly')
  const [granularity, setGranularity] = useState(() => sessionStorage.getItem('dirQueryAnalysis_granularity') || 'monthly')
  const [searchType, setSearchType] = useState(() => sessionStorage.getItem('dirQueryAnalysis_searchType') || 'web')
  const [directories, setDirectories] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_directories')
    return saved ? JSON.parse(saved) : ['hotel/', 'car/', 'sightseeing/']
  })
  const [showOthers, setShowOthers] = useState(() => sessionStorage.getItem('dirQueryAnalysis_showOthers') === 'true')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ディレクトリアクセス分析のデータ
  const [dirChartData, setDirChartData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_dirChartData')
    return saved ? JSON.parse(saved) : []
  })
  const [dirTableData, setDirTableData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_dirTableData')
    return saved ? JSON.parse(saved) : []
  })
  const [directoryTimeSeriesData, setDirectoryTimeSeriesData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_directoryTimeSeriesData')
    return saved ? JSON.parse(saved) : {}
  })

  // クエリ順位シェア分析のデータ
  const [rankChartData, setRankChartData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_rankChartData')
    return saved ? JSON.parse(saved) : []
  })
  const [rankTableData, setRankTableData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_rankTableData')
    return saved ? JSON.parse(saved) : []
  })
  const [directoryRankData, setDirectoryRankData] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_directoryRankData')
    return saved ? JSON.parse(saved) : {}
  })

  const [visibleMetrics, setVisibleMetrics] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_visibleMetrics')
    return saved ? JSON.parse(saved) : {
      clicks: true,
      impressions: true,
      ctr: true,
      position: true,
      queryCount: true
    }
  })

  // 各グラフのディレクトリ選択状態
  const [selectedClicksDirectories, setSelectedClicksDirectories] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_selectedClicksDirectories')
    return saved ? JSON.parse(saved) : []
  })

  const [selectedQueryCountDirectories, setSelectedQueryCountDirectories] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_selectedQueryCountDirectories')
    return saved ? JSON.parse(saved) : []
  })

  const [selectedRankDirectories, setSelectedRankDirectories] = useState(() => {
    const saved = sessionStorage.getItem('dirQueryAnalysis_selectedRankDirectories')
    return saved ? JSON.parse(saved) : []
  })

  // AbortController for canceling requests
  const abortControllerRef = useRef(null)

  // 状態変更時にセッションストレージに保存
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_siteUrl', siteUrl) }, [siteUrl])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_startMonth', startMonth) }, [startMonth])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_endMonth', endMonth) }, [endMonth])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_viewMode', viewMode) }, [viewMode])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_granularity', granularity) }, [granularity])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_searchType', searchType) }, [searchType])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_directories', JSON.stringify(directories)) }, [directories])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_showOthers', showOthers) }, [showOthers])
  useEffect(() => { if (dirChartData.length > 0) sessionStorage.setItem('dirQueryAnalysis_dirChartData', JSON.stringify(dirChartData)) }, [dirChartData])
  useEffect(() => { if (dirTableData.length > 0) sessionStorage.setItem('dirQueryAnalysis_dirTableData', JSON.stringify(dirTableData)) }, [dirTableData])
  useEffect(() => { if (Object.keys(directoryTimeSeriesData).length > 0) sessionStorage.setItem('dirQueryAnalysis_directoryTimeSeriesData', JSON.stringify(directoryTimeSeriesData)) }, [directoryTimeSeriesData])
  useEffect(() => { if (rankChartData.length > 0) sessionStorage.setItem('dirQueryAnalysis_rankChartData', JSON.stringify(rankChartData)) }, [rankChartData])
  useEffect(() => { if (rankTableData.length > 0) sessionStorage.setItem('dirQueryAnalysis_rankTableData', JSON.stringify(rankTableData)) }, [rankTableData])
  useEffect(() => { if (Object.keys(directoryRankData).length > 0) sessionStorage.setItem('dirQueryAnalysis_directoryRankData', JSON.stringify(directoryRankData)) }, [directoryRankData])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_visibleMetrics', JSON.stringify(visibleMetrics)) }, [visibleMetrics])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_selectedClicksDirectories', JSON.stringify(selectedClicksDirectories)) }, [selectedClicksDirectories])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_selectedQueryCountDirectories', JSON.stringify(selectedQueryCountDirectories)) }, [selectedQueryCountDirectories])
  useEffect(() => { sessionStorage.setItem('dirQueryAnalysis_selectedRankDirectories', JSON.stringify(selectedRankDirectories)) }, [selectedRankDirectories])

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
    setDirChartData([])
    setDirTableData([])
    setDirectoryTimeSeriesData({})
    setRankChartData([])
    setRankTableData([])
    setDirectoryRankData({})

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    try {
      // 両方のAPIを並列呼び出し
      const [dirResponse, rankResponse] = await Promise.all([
        fetch('/api/directory-analysis', {
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
        }),
        fetch('/api/query-rank-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl,
            startMonth,
            endMonth,
            directories: directories.filter(d => d.trim() !== ''),
            viewMode
          }),
          signal: abortControllerRef.current.signal
        })
      ])

      // ディレクトリアクセス分析の結果
      if (!dirResponse.ok) {
        const errorData = await dirResponse.json().catch(() => ({}))
        throw new Error(`ディレクトリアクセス分析エラー: ${errorData.error || 'データ取得に失敗しました'}`)
      }

      const dirData = await dirResponse.json()
      if (!dirData.chartData || !dirData.tableData) {
        throw new Error('ディレクトリアクセス分析のデータ形式が正しくありません')
      }

      setDirChartData(dirData.chartData)
      setDirTableData(dirData.tableData)
      setDirectoryTimeSeriesData(dirData.directoryTimeSeriesData || {})

      // クエリ順位シェア分析の結果
      if (!rankResponse.ok) {
        const errorData = await rankResponse.json().catch(() => ({}))
        throw new Error(`クエリ順位シェア分析エラー: ${errorData.error || 'データ取得に失敗しました'}`)
      }

      const rankData = await rankResponse.json()
      if (!rankData.chartData || !rankData.tableData || !rankData.directoryRankData) {
        throw new Error('クエリ順位シェア分析のデータ形式が正しくありません')
      }

      setRankChartData(rankData.chartData)
      setRankTableData(rankData.tableData)
      setDirectoryRankData(rankData.directoryRankData)

      // データ取得成功後、全ディレクトリを選択状態にする
      const validDirectories = directories.filter(d => d.trim() !== '')
      setSelectedClicksDirectories(validDirectories)
      setSelectedQueryCountDirectories(validDirectories)
      setSelectedRankDirectories(validDirectories)

      console.log('取得したデータ（ディレクトリアクセス）:', dirData)
      console.log('取得したデータ（クエリ順位シェア）:', rankData)
    } catch (err) {
      console.error('データ取得エラー:', err)
      if (err.name === 'AbortError') {
        setError('分析が停止されました')
      } else {
        setError(err.message)
      }
      setDirChartData([])
      setDirTableData([])
      setDirectoryTimeSeriesData({})
      setRankChartData([])
      setRankTableData([])
      setDirectoryRankData({})
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

  // チェックボックストグル関数
  const toggleClicksDirectory = (dir) => {
    setSelectedClicksDirectories(prev =>
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    )
  }

  const toggleQueryCountDirectory = (dir) => {
    setSelectedQueryCountDirectories(prev =>
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    )
  }

  const toggleRankDirectory = (dir) => {
    setSelectedRankDirectories(prev =>
      prev.includes(dir) ? prev.filter(d => d !== dir) : [...prev, dir]
    )
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

  // 順位シェアの色定義
  const rankColors = {
    '1～3位未満': '#10b981',
    '3～5位未満': '#3b82f6',
    '6～10位未満': '#f59e0b',
    '10～20位未満': '#ef4444',
    '20位以上～圏外': '#9ca3af'
  }

  const rankRanges = ['1～3位未満', '3～5位未満', '6～10位未満', '10～20位未満', '20位以上～圏外']

  // 獲得クエリ数推移グラフ用のデータを作成
  const queryCountChartData = dirChartData.length > 0 ? dirChartData.map(item => {
    const result = { period: item.period }
    // 各ディレクトリのクエリ数を取得
    directories.filter(d => d.trim()).forEach(dir => {
      const data = dirTableData.find(d => d.period === item.period && d.directory === dir)
      result[dir] = data ? data.queryCount : 0
    })
    if (showOthers) {
      const othersData = dirTableData.find(d => d.period === item.period && d.directory === 'その他')
      result['その他'] = othersData ? othersData.queryCount : 0
    }
    return result
  }) : []

  // クリック数・クエリ数グラフに平均順位データを追加する関数
  const addPositionData = (chartData, tableData) => {
    return chartData.map(item => {
      const result = { ...item }
      directories.filter(d => d.trim()).forEach(dir => {
        const data = tableData.find(d => d.period === item.period && d.directory === dir)
        result[`${dir}_position`] = data ? data.position : null
      })
      return result
    })
  }

  const clicksChartDataWithPosition = addPositionData(dirChartData, dirTableData)
  const queryCountChartDataWithPosition = addPositionData(queryCountChartData, dirTableData)

  // 平均順位のdomainを計算する関数（Googleサーチコンソール風）
  const calculatePositionDomain = (data, selectedDirs) => {
    if (!data || data.length === 0 || selectedDirs.length === 0) {
      return [1, 100] // デフォルト
    }

    const positions = []
    data.forEach(item => {
      selectedDirs.forEach(dir => {
        const pos = item[`${dir}_position`]
        if (pos !== null && pos !== undefined && !isNaN(pos)) {
          positions.push(pos)
        }
      })
    })

    if (positions.length === 0) {
      return [1, 100]
    }

    const minPos = Math.min(...positions)
    const maxPos = Math.max(...positions)
    const range = maxPos - minPos

    // 20%のパディングを追加
    const padding = Math.max(range * 0.2, 2) // 最小2の余白
    const domainMin = Math.max(1, Math.floor(minPos - padding))
    const domainMax = Math.ceil(maxPos + padding)

    return [domainMin, domainMax]
  }

  const clicksPositionDomain = calculatePositionDomain(clicksChartDataWithPosition, selectedClicksDirectories)
  const queryCountPositionDomain = calculatePositionDomain(queryCountChartDataWithPosition, selectedQueryCountDirectories)

  // 選択されたディレクトリのクエリ順位シェアデータを結合する関数
  const combineRankShareData = () => {
    if (selectedRankDirectories.length === 0 || Object.keys(directoryRankData).length === 0) {
      return { chartData: [], tableData: [] }
    }

    // 期間ごとにクエリを集計
    const combinedData = {}

    selectedRankDirectories.forEach(dir => {
      if (!directoryRankData[dir]) return

      const dirTableData = directoryRankData[dir].tableData
      dirTableData.forEach(row => {
        const key = `${row.period}:${row.rankRange}`
        if (!combinedData[key]) {
          combinedData[key] = {
            period: row.period,
            rankRange: row.rankRange,
            queries: new Set()
          }
        }
        // クエリ数から実際のクエリは復元できないが、複数ディレクトリのクエリ数を合算
        // より正確にするには、APIでクエリ自体を返す必要があるが、今回は簡易的に数を合算
        // 注: この方法は重複クエリをカウントしてしまう可能性がある
      })
    })

    // チャートデータを生成（パーセンテージ計算）
    const periods = [...new Set(Object.keys(combinedData).map(k => k.split(':')[0]))].sort()
    const chartData = []
    const tableData = []

    periods.forEach(period => {
      const chartPoint = { period }
      let totalQueries = 0
      const queryCounts = {}

      rankRanges.forEach(range => {
        let count = 0
        selectedRankDirectories.forEach(dir => {
          if (directoryRankData[dir]) {
            const row = directoryRankData[dir].tableData.find(
              r => r.period === period && r.rankRange === range
            )
            if (row) {
              count += row.queryCount
            }
          }
        })
        queryCounts[range] = count
        totalQueries += count
      })

      // パーセンテージに変換
      rankRanges.forEach(range => {
        chartPoint[range] = totalQueries > 0 ? (queryCounts[range] / totalQueries) * 100 : 0
      })
      chartData.push(chartPoint)

      // テーブルデータを生成
      rankRanges.forEach(range => {
        const queryCount = queryCounts[range]
        const shareRate = totalQueries > 0 ? (queryCount / totalQueries) * 100 : 0
        tableData.push({
          period,
          rankRange: range,
          queryCount,
          shareRate
        })
      })
    })

    return { chartData, tableData }
  }

  const filteredRankData = combineRankShareData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">ディレクトリ × クエリ順位シェア分析</h1>

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
              {loading ? 'データ取得中...' : '統合分析を実行'}
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

        {/* ディレクトリアクセス分析結果 */}
        {dirChartData.length > 0 && (
          <>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-4 mb-4">
              <h2 className="text-2xl font-bold">📊 ディレクトリアクセス分析</h2>
            </div>

            {/* クリック数推移グラフ */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">クリック数推移（積み上げ棒グラフ + 平均順位）</h2>

              {/* ディレクトリチェックボックス */}
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded">
                {directories.filter(d => d.trim()).map((dir, index) => (
                  <button
                    key={dir}
                    onClick={() => toggleClicksDirectory(dir)}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                      selectedClicksDirectories.includes(dir)
                        ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                        : 'bg-gray-100 border-2 border-gray-300 text-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClicksDirectories.includes(dir)}
                      onChange={() => {}}
                      className="w-4 h-4"
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <span className="text-sm font-medium">{dir}</span>
                  </button>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={clicksChartDataWithPosition}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" reversed domain={clicksPositionDomain} hide />
                  <Tooltip />
                  <Legend />
                  {selectedClicksDirectories.map((dir, index) => (
                    <Bar
                      key={dir}
                      yAxisId="left"
                      dataKey={dir}
                      stackId="a"
                      fill={`hsl(${index * 360 / selectedClicksDirectories.length}, 70%, 50%)`}
                      name={`${dir} (クリック数)`}
                    />
                  ))}
                  {showOthers && selectedClicksDirectories.length > 0 && (
                    <Bar yAxisId="left" dataKey="その他" stackId="a" fill="#9CA3AF" name="その他 (クリック数)" />
                  )}
                  {selectedClicksDirectories.map((dir, index) => (
                    <Line
                      key={`${dir}_position`}
                      yAxisId="right"
                      type="monotone"
                      dataKey={`${dir}_position`}
                      stroke={`hsl(${index * 360 / selectedClicksDirectories.length}, 70%, 40%)`}
                      strokeWidth={2}
                      name={`${dir} (平均順位)`}
                      dot={{ r: 4 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 獲得クエリ数推移グラフ */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">獲得クエリ数推移（積み上げ棒グラフ + 平均順位）</h2>

              {/* ディレクトリチェックボックス */}
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded">
                {directories.filter(d => d.trim()).map((dir, index) => (
                  <button
                    key={dir}
                    onClick={() => toggleQueryCountDirectory(dir)}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                      selectedQueryCountDirectories.includes(dir)
                        ? 'bg-purple-100 border-2 border-purple-500 text-purple-700'
                        : 'bg-gray-100 border-2 border-gray-300 text-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQueryCountDirectories.includes(dir)}
                      onChange={() => {}}
                      className="w-4 h-4"
                      style={{ accentColor: '#a855f7' }}
                    />
                    <span className="text-sm font-medium">{dir}</span>
                  </button>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={queryCountChartDataWithPosition}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" reversed domain={queryCountPositionDomain} hide />
                  <Tooltip />
                  <Legend />
                  {selectedQueryCountDirectories.map((dir, index) => (
                    <Bar
                      key={dir}
                      yAxisId="left"
                      dataKey={dir}
                      stackId="a"
                      fill={`hsl(${index * 360 / selectedQueryCountDirectories.length}, 70%, 60%)`}
                      name={`${dir} (クエリ数)`}
                    />
                  ))}
                  {showOthers && selectedQueryCountDirectories.length > 0 && (
                    <Bar yAxisId="left" dataKey="その他" stackId="a" fill="#9CA3AF" name="その他 (クエリ数)" />
                  )}
                  {selectedQueryCountDirectories.map((dir, index) => (
                    <Line
                      key={`${dir}_position`}
                      yAxisId="right"
                      type="monotone"
                      dataKey={`${dir}_position`}
                      stroke={`hsl(${index * 360 / selectedQueryCountDirectories.length}, 70%, 40%)`}
                      strokeWidth={2}
                      name={`${dir} (平均順位)`}
                      dot={{ r: 4 }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Directory Time Series Charts */}
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
            {dirTableData.length > 0 && (() => {
              // ピボットテーブルデータを作成
              const periods = [...new Set(dirTableData.map(row => row.period))].sort()
              const directoriesInData = [...new Set(dirTableData.map(row => row.directory))]
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
                    const data = dirTableData.find(d => d.directory === dir && d.period === period)
                    row[period] = data ? metric.format(data[metric.key]) : '-'
                  })
                  pivotRows.push(row)
                })
              })

              return (
                <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
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
          </>
        )}

        {/* クエリ順位シェア分析結果 */}
        {rankChartData.length > 0 && (
          <>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-4 mb-4 mt-12">
              <h2 className="text-2xl font-bold">🎯 クエリ順位シェア分析</h2>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">クエリ順位シェア推移（100%積み上げ棒グラフ）</h2>

              {/* ディレクトリチェックボックス */}
              <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded">
                {directories.filter(d => d.trim()).map((dir, index) => (
                  <button
                    key={dir}
                    onClick={() => toggleRankDirectory(dir)}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
                      selectedRankDirectories.includes(dir)
                        ? 'bg-green-100 border-2 border-green-500 text-green-700'
                        : 'bg-gray-100 border-2 border-gray-300 text-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRankDirectories.includes(dir)}
                      onChange={() => {}}
                      className="w-4 h-4"
                      style={{ accentColor: '#10b981' }}
                    />
                    <span className="text-sm font-medium">{dir}</span>
                  </button>
                ))}
              </div>

              {selectedRankDirectories.length > 0 && <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredRankData.chartData}>
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
              </ResponsiveContainer>}
              {selectedRankDirectories.length === 0 && (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  ディレクトリを選択してください
                </div>
              )}
            </div>

            {/* Pivot Table */}
            {filteredRankData.tableData.length > 0 && selectedRankDirectories.length > 0 && (() => {
              const periods = [...new Set(filteredRankData.tableData.map(row => row.period))].sort()

              const pivotData = rankRanges.map(range => {
                const row = { rankRange: range }
                periods.forEach(period => {
                  const data = filteredRankData.tableData.find(d => d.rankRange === range && d.period === period)
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
          </>
        )}
      </div>
    </div>
  )
}

export default DirectoryQueryAnalysis
