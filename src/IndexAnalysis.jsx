import React, { useState, useRef } from 'react'
import { Upload, FileText, Link as LinkIcon, Search, Loader2, AlertCircle, CheckCircle, XCircle, BarChart3, PieChart, Globe } from 'lucide-react'

function IndexAnalysis() {
  const [inputMethod, setInputMethod] = useState('csv') // csv, direct, sitemap, crawler
  const [urls, setUrls] = useState([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 })
  const [results, setResults] = useState(null)
  const fileInputRef = useRef(null)

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

        // URL列を自動検出
        const urlList = lines
          .map(line => {
            const cells = line.split(',')
            // URLらしいものを探す
            return cells.find(cell =>
              cell.trim().startsWith('http://') ||
              cell.trim().startsWith('https://')
            )
          })
          .filter(url => url && url.trim())
          .map(url => url.trim().replace(/^["']|["']$/g, '')) // 引用符削除

        setUrls(urlList)
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

  // サイトマップ読み込み
  const handleSitemapLoad = async (sitemapUrl) => {
    if (!sitemapUrl.trim()) {
      setError('サイトマップURLを入力してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/index-inspection/parse-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitemapUrl: sitemapUrl.trim() })
      })

      if (!response.ok) {
        throw new Error('サイトマップの読み込みに失敗しました')
      }

      const data = await response.json()
      setUrls(data.urls)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // 直接入力処理
  const handleDirectInput = (text) => {
    const urlList = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('http://') || line.startsWith('https://'))

    setUrls(urlList)
  }

  // URL検査開始
  const startInspection = async () => {
    if (urls.length === 0) {
      setError('URLを入力してください')
      return
    }

    if (urls.length > 100000) {
      setError('URLは最大100,000件までです')
      return
    }

    setAnalyzing(true)
    setError('')
    setProgress({ current: 0, total: urls.length, percentage: 0 })

    try {
      const response = await fetch('/api/index-inspection/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })

      if (!response.ok) {
        throw new Error('検査の開始に失敗しました')
      }

      const { jobId } = await response.json()

      // 進捗をポーリング
      pollProgress(jobId)

    } catch (err) {
      setError(err.message)
      setAnalyzing(false)
    }
  }

  // 進捗ポーリング
  const pollProgress = async (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/index-inspection/status/${jobId}`)
        const data = await response.json()

        setProgress({
          current: data.completed,
          total: data.total,
          percentage: data.progress
        })

        if (data.status === 'completed') {
          clearInterval(interval)
          // 結果取得
          const resultsResponse = await fetch(`/api/index-inspection/results/${jobId}`)
          const resultsData = await resultsResponse.json()
          setResults(resultsData)
          setAnalyzing(false)
        } else if (data.status === 'failed') {
          clearInterval(interval)
          setError('検査に失敗しました')
          setAnalyzing(false)
        }
      } catch (err) {
        clearInterval(interval)
        setError('進捗の取得に失敗しました')
        setAnalyzing(false)
      }
    }, 2000) // 2秒ごとにポーリング
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Search className="w-8 h-8 text-blue-600" />
          インデックス分析
        </h1>
        <p className="text-gray-600">
          インデックス状態調査
        </p>
      </div>

      {/* 入力方式選択 */}
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
          <button
            onClick={() => setInputMethod('sitemap')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              inputMethod === 'sitemap'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <LinkIcon className="w-5 h-5" />
            サイトマップ
          </button>
          <button
            onClick={() => setInputMethod('crawler')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
              inputMethod === 'crawler'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Globe className="w-5 h-5" />
            クローラーを使う
          </button>
        </div>

        {/* CSV アップロード */}
        {inputMethod === 'csv' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              URL列を含むCSVファイルをアップロード（URL列は自動検出されます）
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
              1行に1つのURLを入力してください（最大10,000行）
            </p>
            <textarea
              onChange={(e) => handleDirectInput(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
              rows={12}
              placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
            />
          </div>
        )}

        {/* サイトマップ */}
        {inputMethod === 'sitemap' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              サイトマップXML/TXTのURLを入力してください
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                id="sitemapUrl"
                className="flex-1 p-3 border border-gray-300 rounded-lg"
                placeholder="https://example.com/sitemap.xml"
              />
              <button
                onClick={() => {
                  const url = document.getElementById('sitemapUrl').value
                  handleSitemapLoad(url)
                }}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '読み込み'}
              </button>
            </div>
          </div>
        )}

        {/* クローラー */}
        {inputMethod === 'crawler' && (
          <div>
            <p className="text-sm text-gray-600 mb-3">
              クロール開始URLとクロール設定を入力してください
            </p>
            <div className="space-y-3">
              <input
                type="url"
                id="crawlUrl"
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="https://example.com"
              />
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" id="crawlSubdomains" />
                  <span className="text-sm text-gray-700">サブドメインを含む</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="number" id="crawlMaxPages" defaultValue="1000" className="w-20 p-1 border border-gray-300 rounded" />
                  <span className="text-sm text-gray-700">最大ページ数</span>
                </label>
              </div>
              <button
                onClick={() => {
                  setError('クローラー機能は準備中です')
                }}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                クロール開始
              </button>
            </div>
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
      {urls.length > 0 && !analyzing && !results && (
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
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">URL検査中...</h2>
            <p className="text-gray-600">
              {progress.current.toLocaleString()} / {progress.total.toLocaleString()} 件完了
            </p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-center text-gray-600">{progress.percentage.toFixed(1)}%</p>
        </div>
      )}

      {/* 結果表示 */}
      {results && (
        <ResultsDisplay results={results} />
      )}
    </div>
  )
}

function ResultsDisplay({ results }) {
  const [viewMode, setViewMode] = useState('table') // table, chart, distribution

  // 統計計算
  const stats = {
    total: results.length,
    indexed: results.filter(r => r.indexStatus?.coverageState === 'Submitted and indexed').length,
    notIndexed: results.filter(r => r.indexStatus?.coverageState !== 'Submitted and indexed').length,
    errors: results.filter(r => r.error).length
  }

  return (
    <div className="space-y-6">
      {/* サマリー */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">検査結果サマリー</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{stats.total.toLocaleString()}</div>
            <div className="text-sm text-gray-600">総URL数</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{stats.indexed.toLocaleString()}</div>
            <div className="text-sm text-gray-600">インデックス済み</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{stats.notIndexed.toLocaleString()}</div>
            <div className="text-sm text-gray-600">未インデックス</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-3xl font-bold text-red-600">{stats.errors.toLocaleString()}</div>
            <div className="text-sm text-gray-600">エラー</div>
          </div>
        </div>
      </div>

      {/* 表示モード切り替え */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setViewMode('table')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                viewMode === 'table'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-5 h-5" />
              テーブル表示
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                viewMode === 'chart'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="w-5 h-5" />
              グラフ表示
            </button>
            <button
              onClick={() => setViewMode('distribution')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                viewMode === 'distribution'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              分布表示
            </button>
          </div>
        </div>

        <div className="p-6">
          {viewMode === 'table' && <TableView results={results} />}
          {viewMode === 'chart' && <ChartView stats={stats} />}
          {viewMode === 'distribution' && <DistributionView results={results} />}
        </div>
      </div>
    </div>
  )
}

function TableView({ results }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">URL</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ステータス</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">最終クロール</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {results.slice(0, 100).map((result, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">{result.url}</td>
              <td className="px-4 py-3 text-sm">
                {result.indexStatus?.coverageState === 'Submitted and indexed' ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    インデックス済み
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
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 100 && (
        <p className="text-center text-gray-500 mt-4">
          最初の100件を表示 (全{results.length.toLocaleString()}件)
        </p>
      )}
    </div>
  )
}

function ChartView({ stats }) {
  const total = stats.total || 1
  const indexedPercent = ((stats.indexed / total) * 100).toFixed(1)
  const notIndexedPercent = ((stats.notIndexed / total) * 100).toFixed(1)

  return (
    <div className="flex justify-center items-center py-8">
      <div className="text-center">
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
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold text-gray-800">{indexedPercent}%</div>
            <div className="text-sm text-gray-600">インデックス率</div>
          </div>
        </div>
        <div className="mt-6 flex gap-6 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-700">インデックス済み ({indexedPercent}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-sm text-gray-700">未インデックス ({notIndexedPercent}%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DistributionView({ results }) {
  // ディレクトリ別に集計
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800">ディレクトリ別インデックス状況</h3>
      {Object.entries(dirStats).slice(0, 20).map(([dir, stats]) => {
        const percentage = (stats.indexed / stats.total) * 100
        return (
          <div key={dir} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">{dir}</span>
              <span className="text-gray-600">
                {stats.indexed} / {stats.total} ({percentage.toFixed(1)}%)
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
  )
}

export default IndexAnalysis
