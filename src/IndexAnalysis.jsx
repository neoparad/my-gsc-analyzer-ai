import React, { useState, useRef, useEffect } from 'react'
import { Upload, FileText, Link as LinkIcon, Search, Loader2, AlertCircle, CheckCircle, XCircle, BarChart3, PieChart, Globe, Download, Play, Pause, X, TrendingUp, Layers, AlertTriangle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Supabaseクライアント初期化
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

// Google API設定
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly'

function IndexAnalysis() {
  const [inputMethod, setInputMethod] = useState('csv')
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0, estimatedTime: 0 })
  const [results, setResults] = useState(null)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const fileInputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const pauseRef = useRef(false)

  // Google API初期化
  useEffect(() => {
    const initGoogleAPI = () => {
      if (!window.gapi) {
        console.error('Google API not loaded')
        return
      }

      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            clientId: GOOGLE_CLIENT_ID,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest'],
            scope: SCOPES
          })

          const authInstance = window.gapi.auth2.getAuthInstance()
          setIsSignedIn(authInstance.isSignedIn.get())
          authInstance.isSignedIn.listen(setIsSignedIn)
        } catch (err) {
          console.error('Error initializing Google API:', err)
          setError('Google APIの初期化に失敗しました')
        }
      })
    }

    // Google APIスクリプトを動的に読み込み
    if (!document.getElementById('google-api-script')) {
      const script = document.createElement('script')
      script.id = 'google-api-script'
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = initGoogleAPI
      document.body.appendChild(script)
    } else if (window.gapi) {
      initGoogleAPI()
    }
  }, [])

  // Google サインイン
  const handleSignIn = () => {
    if (window.gapi && window.gapi.auth2) {
      window.gapi.auth2.getAuthInstance().signIn()
    }
  }

  // Google サインアウト
  const handleSignOut = () => {
    if (window.gapi && window.gapi.auth2) {
      window.gapi.auth2.getAuthInstance().signOut()
    }
  }

  // CSV アップロード処理
  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setError('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const lines = text.split('\n')

        const urlList = lines
          .map(line => {
            const cells = line.split(',')
            return cells.find(cell =>
              cell.trim().startsWith('http://') ||
              cell.trim().startsWith('https://')
            )
          })
          .filter(url => url && url.trim())
          .map(url => url.trim().replace(/^["']|["']$/g, ''))

        if (urlList.length > 50000) {
          setError('URLは最大50,000件までです')
          setUrls([])
        } else {
          setUrls(urlList)
        }
        setLoading(false)
      } catch (err) {
        setError('CSVの読み込みに失敗しました: ' + err.message)
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました')
      setLoading(false)
    }
    reader.readAsText(file)
  }

  // 直接入力処理
  const handleDirectInput = (text) => {
    const urlList = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('http://') || line.startsWith('https://'))

    if (urlList.length > 50000) {
      setError('URLは最大50,000件までです')
    } else {
      setUrls(urlList)
      setError('')
    }
  }

  // サイトURL抽出
  const extractSiteUrl = (url) => {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}`
    } catch {
      return null
    }
  }

  // URL検査（単一）
  const inspectUrl = async (inspectionUrl, siteUrl) => {
    try {
      const response = await window.gapi.client.searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl,
          siteUrl
        }
      })

      return {
        url: inspectionUrl,
        indexStatus: response.result.inspectionResult?.indexStatusResult,
        error: null
      }
    } catch (error) {
      return {
        url: inspectionUrl,
        indexStatus: null,
        error: error.result?.error?.message || error.message
      }
    }
  }

  // チェックポイント保存
  const saveCheckpoint = async (jobId, data) => {
    if (!supabase) return

    try {
      await supabase
        .from('index_inspection_jobs')
        .upsert({
          job_id: jobId,
          status: data.status || 'running',
          total_urls: data.total,
          completed_urls: data.completed,
          results: data.results,
          updated_at: new Date().toISOString()
        }, { onConflict: 'job_id' })
    } catch (err) {
      console.error('Checkpoint save error:', err)
    }
  }

  // URL検査開始
  const startInspection = async () => {
    if (urls.length === 0) {
      setError('URLを入力してください')
      return
    }

    if (!isSignedIn) {
      setError('Googleアカウントでサインインしてください')
      return
    }

    // サイトURLを自動検出
    const detectedSiteUrl = extractSiteUrl(urls[0])
    if (!detectedSiteUrl) {
      setError('有効なURLを入力してください')
      return
    }
    setSiteUrl(detectedSiteUrl)

    setAnalyzing(true)
    setIsPaused(false)
    setError('')
    setResults(null)
    setProgress({ current: 0, total: urls.length, percentage: 0, estimatedTime: 0 })

    abortControllerRef.current = new AbortController()
    pauseRef.current = false

    const jobId = `job_${Date.now()}`
    const startTime = Date.now()
    const batchSize = 20 // 20リクエスト/秒
    const delayMs = 1000
    const checkpointInterval = 1000 // 1,000件ごとに保存
    const allResults = []

    try {
      for (let i = 0; i < urls.length; i += batchSize) {
        // 一時停止チェック
        while (pauseRef.current && !abortControllerRef.current.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // キャンセルチェック
        if (abortControllerRef.current.signal.aborted) {
          break
        }

        const batch = urls.slice(i, i + batchSize)

        // バッチ処理
        const batchResults = await Promise.all(
          batch.map(url => inspectUrl(url, detectedSiteUrl))
        )

        allResults.push(...batchResults)

        // 進捗更新
        const completed = allResults.length
        const percentage = (completed / urls.length) * 100
        const elapsed = Date.now() - startTime
        const avgTimePerUrl = elapsed / completed
        const remaining = urls.length - completed
        const estimatedTime = Math.ceil((avgTimePerUrl * remaining) / 1000 / 60) // 分単位

        setProgress({
          current: completed,
          total: urls.length,
          percentage,
          estimatedTime
        })

        // チェックポイント保存
        if (completed % checkpointInterval === 0 || completed === urls.length) {
          await saveCheckpoint(jobId, {
            status: completed === urls.length ? 'completed' : 'running',
            total: urls.length,
            completed,
            results: allResults
          })
        }

        // レート制限対策
        if (i + batchSize < urls.length && !abortControllerRef.current.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }

      // 完了
      if (!abortControllerRef.current.signal.aborted) {
        setResults(allResults)
        await saveCheckpoint(jobId, {
          status: 'completed',
          total: urls.length,
          completed: allResults.length,
          results: allResults
        })
      }

      setAnalyzing(false)
      setIsPaused(false)

    } catch (err) {
      console.error('Inspection error:', err)
      setError('検査中にエラーが発生しました: ' + err.message)
      setAnalyzing(false)
      setIsPaused(false)
    }
  }

  // 一時停止
  const handlePause = () => {
    pauseRef.current = true
    setIsPaused(true)
  }

  // 再開
  const handleResume = () => {
    pauseRef.current = false
    setIsPaused(false)
  }

  // キャンセル
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setAnalyzing(false)
    setIsPaused(false)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Search className="w-8 h-8 text-blue-600" />
          インデックス分析（ブラウザ版）
        </h1>
        <p className="text-gray-600">
          最大50,000件のURLのインデックス状態を一括調査
        </p>
      </div>

      {/* Google認証 */}
      {!isSignedIn ? (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Google Search Consoleに接続</h2>
          <p className="text-gray-600 mb-4">
            URL検査を実行するには、Google Search Consoleへのアクセスが必要です。
          </p>
          <button
            onClick={handleSignIn}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
          >
            <Globe className="w-5 h-5" />
            Googleアカウントでサインイン
          </button>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Google Search Consoleに接続済み
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            サインアウト
          </button>
        </div>
      )}

      {/* URL収集 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">URL収集方法</h2>

        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setInputMethod('csv')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              inputMethod === 'csv'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Upload className="w-5 h-5" />
            CSVアップロード
          </button>
          <button
            onClick={() => setInputMethod('direct')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              inputMethod === 'direct'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            直接入力
          </button>
        </div>

        {/* CSV アップロード */}
        {inputMethod === 'csv' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              URL列を含むCSVファイルをアップロード（最大50,000件）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
        )}

        {/* 直接入力 */}
        {inputMethod === 'direct' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              1行に1つのURLを入力してください（最大50,000件）
            </p>
            <textarea
              onChange={(e) => handleDirectInput(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
              rows={12}
              placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
            />
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* URL数表示 */}
        {urls.length > 0 && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {urls.length.toLocaleString()} 件のURLを読み込みました
          </div>
        )}
      </div>

      {/* 検査開始ボタン */}
      {urls.length > 0 && !analyzing && !results && isSignedIn && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <button
            onClick={startInspection}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Search className="w-6 h-6" />
            URL検査を開始 ({urls.length.toLocaleString()} 件)
          </button>
          <p className="text-sm text-gray-500 mt-3 text-center">
            予想処理時間: 約 {Math.ceil(urls.length / 20 / 60)} 分
          </p>
        </div>
      )}

      {/* 進捗表示 */}
      {analyzing && (
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <div className="text-center mb-6">
            {!isPaused ? (
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            ) : (
              <Pause className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            )}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {isPaused ? '一時停止中' : 'URL検査中...'}
            </h2>
            <p className="text-gray-600">
              {progress.current.toLocaleString()} / {progress.total.toLocaleString()} 件完了
            </p>
            {progress.estimatedTime > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                推定残り時間: 約 {progress.estimatedTime} 分
              </p>
            )}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-center text-gray-600 mb-6">{progress.percentage.toFixed(1)}%</p>

          {/* コントロールボタン */}
          <div className="flex gap-4 justify-center">
            {!isPaused ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700"
              >
                <Pause className="w-5 h-5" />
                一時停止
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                <Play className="w-5 h-5" />
                再開
              </button>
            )}
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
            >
              <X className="w-5 h-5" />
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {results && <ResultsDisplay results={results} siteUrl={siteUrl} />}
    </div>
  )
}

// 結果表示コンポーネント
function ResultsDisplay({ results, siteUrl }) {
  const [viewMode, setViewMode] = useState('summary')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDirectory, setFilterDirectory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 統計計算
  const stats = calculateStats(results)

  // CSVエクスポート
  const exportToCSV = () => {
    const headers = ['URL', 'ステータス', '最終クロール日時', 'エラー']
    const rows = results.map(r => [
      r.url,
      r.indexStatus?.coverageState || 'Unknown',
      r.indexStatus?.lastCrawlTime || '',
      r.error || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `index-analysis-${Date.now()}.csv`
    link.click()
  }

  // フィルタリング
  const filteredResults = results.filter(r => {
    // ステータスフィルタ
    if (filterStatus === 'indexed' && r.indexStatus?.coverageState !== 'Submitted and indexed') return false
    if (filterStatus === 'not-indexed' && r.indexStatus?.coverageState === 'Submitted and indexed') return false
    if (filterStatus === 'error' && !r.error) return false

    // ディレクトリフィルタ
    if (filterDirectory !== 'all') {
      try {
        const url = new URL(r.url)
        const pathParts = url.pathname.split('/').filter(p => p)
        const dir = pathParts.length > 0 ? `/${pathParts[0]}/` : '/'
        if (dir !== filterDirectory) return false
      } catch (e) {
        return false
      }
    }

    // 検索クエリ
    if (searchQuery && !r.url.toLowerCase().includes(searchQuery.toLowerCase())) return false

    return true
  })

  return (
    <div className="space-y-6">
      {/* レベル1: KPIサマリー */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">検査結果サマリー</h2>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
          >
            <Download className="w-5 h-5" />
            CSVエクスポート
          </button>
        </div>

        {/* KPIカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard
            icon={<Layers className="w-8 h-8" />}
            value={stats.total.toLocaleString()}
            label="総URL数"
            color="blue"
          />
          <KPICard
            icon={<CheckCircle className="w-8 h-8" />}
            value={stats.indexed.toLocaleString()}
            label="インデックス済み"
            percentage={stats.indexedRate}
            color="green"
          />
          <KPICard
            icon={<AlertCircle className="w-8 h-8" />}
            value={stats.notIndexed.toLocaleString()}
            label="未インデックス"
            percentage={stats.notIndexedRate}
            color="yellow"
          />
          <KPICard
            icon={<XCircle className="w-8 h-8" />}
            value={stats.errors.toLocaleString()}
            label="エラー"
            percentage={stats.errorRate}
            color="red"
          />
        </div>

        {/* 円グラフ */}
        <div className="flex justify-center">
          <PieChartComponent stats={stats} />
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <TabButton
              active={viewMode === 'summary'}
              onClick={() => setViewMode('summary')}
              icon={<TrendingUp className="w-5 h-5" />}
              label="分析グラフ"
            />
            <TabButton
              active={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              icon={<FileText className="w-5 h-5" />}
              label="詳細テーブル"
            />
          </div>
        </div>

        <div className="p-6">
          {viewMode === 'summary' && <AnalysisCharts results={results} stats={stats} />}
          {viewMode === 'table' && (
            <DetailedTable
              results={filteredResults}
              allResults={results}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterDirectory={filterDirectory}
              setFilterDirectory={setFilterDirectory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// KPIカード
function KPICard({ icon, value, label, percentage, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600'
  }

  return (
    <div className={`${colors[color]} p-4 rounded-lg`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        {percentage !== undefined && (
          <span className="text-sm font-semibold">{percentage.toFixed(1)}%</span>
        )}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  )
}

// 円グラフ
function PieChartComponent({ stats }) {
  const total = stats.total || 1
  const indexedPercent = ((stats.indexed / total) * 100).toFixed(1)
  const notIndexedPercent = ((stats.notIndexed / total) * 100).toFixed(1)
  const errorPercent = ((stats.errors / total) * 100).toFixed(1)

  return (
    <div className="text-center py-4">
      <div className="relative inline-block">
        <svg className="w-64 h-64">
          <circle
            cx="128"
            cy="128"
            r="100"
            fill="none"
            stroke="#10b981"
            strokeWidth="40"
            strokeDasharray={`${(stats.indexed / total) * 628} 628`}
            transform="rotate(-90 128 128)"
          />
          <circle
            cx="128"
            cy="128"
            r="100"
            fill="none"
            stroke="#eab308"
            strokeWidth="40"
            strokeDasharray={`${(stats.notIndexed / total) * 628} 628`}
            strokeDashoffset={`-${(stats.indexed / total) * 628}`}
            transform="rotate(-90 128 128)"
          />
          <circle
            cx="128"
            cy="128"
            r="100"
            fill="none"
            stroke="#ef4444"
            strokeWidth="40"
            strokeDasharray={`${(stats.errors / total) * 628} 628`}
            strokeDashoffset={`-${((stats.indexed + stats.notIndexed) / total) * 628}`}
            transform="rotate(-90 128 128)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold text-gray-800">{indexedPercent}%</div>
          <div className="text-sm text-gray-600">インデックス率</div>
        </div>
      </div>
      <div className="mt-6 flex gap-6 justify-center flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-700">インデックス済み ({indexedPercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-sm text-gray-700">未インデックス ({notIndexedPercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-700">エラー ({errorPercent}%)</span>
        </div>
      </div>
    </div>
  )
}

// タブボタン
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
        active
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// レベル2: 分析グラフ
function AnalysisCharts({ results, stats }) {
  const directoryStats = calculateDirectoryStats(results)
  const depthStats = calculateDepthStats(results)
  const errorStats = calculateErrorStats(results)

  return (
    <div className="space-y-8">
      {/* ディレクトリ別 */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">ディレクトリ別インデックス率</h3>
        {directoryStats.slice(0, 10).map(({ dir, total, indexed }) => {
          const percentage = (indexed / total) * 100
          return (
            <div key={dir} className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{dir}</span>
                <span className="text-gray-600">
                  {indexed} / {total} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    percentage >= 90 ? 'bg-green-500' :
                    percentage >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* URL階層別 */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4">URL階層別インデックス率</h3>
        <div className="space-y-3">
          {depthStats.map(({ depth, total, indexed }) => {
            const percentage = (indexed / total) * 100
            return (
              <div key={depth} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-700">階層 {depth}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{total} URLs</span>
                    <span className="text-gray-600">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* エラー種別 */}
      {errorStats.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4">エラー種別ランキング</h3>
          <div className="space-y-2">
            {errorStats.slice(0, 10).map(({ error, count }, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">{error || 'Unknown Error'}</span>
                </div>
                <span className="text-sm font-bold text-red-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// レベル3: 詳細テーブル
function DetailedTable({ results, allResults, filterStatus, setFilterStatus, filterDirectory, setFilterDirectory, searchQuery, setSearchQuery }) {
  const directories = [...new Set(allResults.map(r => {
    try {
      const url = new URL(r.url)
      const pathParts = url.pathname.split('/').filter(p => p)
      return pathParts.length > 0 ? `/${pathParts[0]}/` : '/'
    } catch {
      return '/'
    }
  }))].sort()

  return (
    <div>
      {/* フィルタ */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">すべて</option>
            <option value="indexed">インデックス済み</option>
            <option value="not-indexed">未インデックス</option>
            <option value="error">エラー</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ディレクトリ</label>
          <select
            value={filterDirectory}
            onChange={(e) => setFilterDirectory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">すべて</option>
            {directories.map(dir => (
              <option key={dir} value={dir}>{dir}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">検索</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="URLで検索..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">URL</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ステータス</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">最終クロール</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">エラー</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.slice(0, 100).map((result, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">{result.url}</td>
                <td className="px-4 py-3 text-sm">
                  {result.indexStatus?.coverageState === 'Submitted and indexed' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      インデックス済み
                    </span>
                  ) : result.error ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
                      エラー
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <AlertCircle className="w-4 h-4" />
                      未インデックス
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {result.indexStatus?.lastCrawlTime || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {result.error || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length > 100 && (
          <p className="text-center text-gray-500 mt-4">
            最初の100件を表示 (全{results.length.toLocaleString()}件)
          </p>
        )}
        {results.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            該当するURLがありません
          </p>
        )}
      </div>
    </div>
  )
}

// 統計計算
function calculateStats(results) {
  const total = results.length
  const indexed = results.filter(r => r.indexStatus?.coverageState === 'Submitted and indexed').length
  const notIndexed = results.filter(r => r.indexStatus && r.indexStatus.coverageState !== 'Submitted and indexed').length
  const errors = results.filter(r => r.error).length

  return {
    total,
    indexed,
    notIndexed,
    errors,
    indexedRate: (indexed / total) * 100,
    notIndexedRate: (notIndexed / total) * 100,
    errorRate: (errors / total) * 100
  }
}

// ディレクトリ別統計
function calculateDirectoryStats(results) {
  const dirStats = {}
  results.forEach(r => {
    try {
      const url = new URL(r.url)
      const pathParts = url.pathname.split('/').filter(p => p)
      const dir = pathParts.length > 0 ? `/${pathParts[0]}/` : '/'

      if (!dirStats[dir]) {
        dirStats[dir] = { total: 0, indexed: 0 }
      }
      dirStats[dir].total++
      if (r.indexStatus?.coverageState === 'Submitted and indexed') {
        dirStats[dir].indexed++
      }
    } catch (e) {
      // URL parse error
    }
  })

  return Object.entries(dirStats)
    .map(([dir, stats]) => ({ dir, ...stats }))
    .sort((a, b) => b.total - a.total)
}

// 階層別統計
function calculateDepthStats(results) {
  const depthStats = {}
  results.forEach(r => {
    try {
      const url = new URL(r.url)
      const depth = url.pathname.split('/').filter(p => p).length

      if (!depthStats[depth]) {
        depthStats[depth] = { total: 0, indexed: 0 }
      }
      depthStats[depth].total++
      if (r.indexStatus?.coverageState === 'Submitted and indexed') {
        depthStats[depth].indexed++
      }
    } catch (e) {
      // URL parse error
    }
  })

  return Object.entries(depthStats)
    .map(([depth, stats]) => ({ depth: parseInt(depth), ...stats }))
    .sort((a, b) => a.depth - b.depth)
}

// エラー別統計
function calculateErrorStats(results) {
  const errorStats = {}
  results.forEach(r => {
    if (r.error) {
      const error = r.error
      errorStats[error] = (errorStats[error] || 0) + 1
    }
  })

  return Object.entries(errorStats)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
}

export default IndexAnalysis
