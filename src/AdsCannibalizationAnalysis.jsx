import React, { useState, useRef } from 'react'
import { Download, Upload, Filter, X, Plus, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

function AdsCannibalizationAnalysis() {
  const [formData, setFormData] = useState({
    site_url: 'https://www.tabirai.net/',
    start_date: '',
    end_date: ''
  })

  const [adsFile, setAdsFile] = useState(null)
  const [adsData, setAdsData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)

  // フィルター状態
  const [filters, setFilters] = useState({
    position_range: { min: 1.0, max: 2.0, preset: '2位未満' },
    keywords: {
      include: { terms: [], operator: 'AND' },
      exclude: { terms: [] }
    },
    directories: { paths: [] },
    performance: {
      min_ad_spend: 0,
      min_organic_clicks: 0,
      has_conversion: false
    }
  })

  const [showFilters, setShowFilters] = useState(false)
  const [activePositionPreset, setActivePositionPreset] = useState('2位未満')

  const fileInputRef = useRef(null)
  const abortControllerRef = useRef(null)

  // CSVアップロード処理
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setAdsFile(file)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const csvText = event.target.result
        const lines = csvText.split('\n')
        const headers = lines[0].split(',').map(h => h.trim())

        const parsedData = []
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue

          const values = lines[i].split(',').map(v => v.trim())
          const row = {
            query: values[0] || '',
            ad_clicks: parseInt(values[1]) || 0,
            ad_impressions: parseInt(values[2]) || 0,
            cost: parseFloat(values[3]) || 0,
            cpc: parseFloat(values[4]) || 0,
            conversions: parseFloat(values[5]) || 0
          }
          parsedData.push(row)
        }

        setAdsData(parsedData)
        setError('')
      } catch (err) {
        setError('CSVファイルの解析に失敗しました: ' + err.message)
      }
    }

    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました')
    }

    reader.readAsText(file)
  }

  // 分析実行
  const handleAnalyze = async () => {
    if (!adsData.length) {
      setError('Google AdsのCSVファイルをアップロードしてください')
      return
    }

    setLoading(true)
    setError('')
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/ads-cannibalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ads_data: adsData,
          filters
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '分析に失敗しました')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('分析が停止されました')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  // フィルタープリセット変更
  const handlePositionPresetChange = (preset) => {
    setActivePositionPreset(preset)
    let range = { min: 1.0, max: 2.0 }

    if (preset === '2位未満') {
      range = { min: 1.0, max: 2.0 }
    } else if (preset === '3位未満') {
      range = { min: 1.0, max: 3.0 }
    }

    setFilters({
      ...filters,
      position_range: { ...range, preset }
    })
  }

  // キーワード追加
  const addIncludeKeyword = (keyword) => {
    if (!keyword.trim()) return
    setFilters({
      ...filters,
      keywords: {
        ...filters.keywords,
        include: {
          ...filters.keywords.include,
          terms: [...filters.keywords.include.terms, keyword]
        }
      }
    })
  }

  const removeIncludeKeyword = (index) => {
    setFilters({
      ...filters,
      keywords: {
        ...filters.keywords,
        include: {
          ...filters.keywords.include,
          terms: filters.keywords.include.terms.filter((_, i) => i !== index)
        }
      }
    })
  }

  // CSV エクスポート
  const downloadCSV = () => {
    if (!results?.queries) return

    const headers = ['クエリ', 'URL', 'ディレクトリ', 'Org順位', 'Orgクリック', '広告クリック', '広告費', '削減可能額', 'カニバリスコア', '信頼度']
    const csvContent = [
      headers.join(','),
      ...results.queries.map(row => [
        `"${row.query}"`,
        `"${row.url}"`,
        `"${row.directory}"`,
        row.organic_position.toFixed(2),
        row.organic_clicks,
        row.ad_clicks,
        row.ad_cost,
        row.estimated_savings,
        row.canibalization_score,
        row.savings_confidence
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ads_cannibalization_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🎯 広告カニバリゼーション分析
        </h1>
        <p className="text-gray-600 mb-8">
          オーガニック上位表示中のクエリで広告費を削減できる候補を特定
        </p>

        {/* 入力フォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">データ入力</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">サイトURL</label>
              <input
                type="text"
                value={formData.site_url}
                onChange={(e) => setFormData({ ...formData, site_url: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md"
                placeholder="https://example.com/"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Ads データ（CSV）
            </label>
            <div className="flex gap-4 items-center">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                CSVアップロード
              </button>
              {adsFile && (
                <span className="text-sm text-green-600">
                  ✓ {adsFile.name} ({adsData.length}件)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              必須列: クエリ, クリック数, 表示回数, 費用, 平均CPC（, コンバージョン数）
            </p>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !adsData.length}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 font-semibold"
          >
            {loading ? '分析中...' : '分析を開始'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* フィルター */}
        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">順位条件選択</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                <Filter className="w-4 h-4" />
                {showFilters ? '高度なフィルターを閉じる' : '高度なフィルターを開く'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <button
                onClick={() => handlePositionPresetChange('2位未満')}
                className={`p-4 border-2 rounded-lg text-left ${
                  activePositionPreset === '2位未満'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold">2位未満（1.0 〜 2.0未満）</div>
                <div className="text-sm text-gray-600 mt-1">最も確実な削減候補</div>
              </button>

              <button
                onClick={() => handlePositionPresetChange('3位未満')}
                className={`p-4 border-2 rounded-lg text-left ${
                  activePositionPreset === '3位未満'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-semibold">3位未満（1.0 〜 3.0未満）</div>
                <div className="text-sm text-gray-600 mt-1">バランス型</div>
              </button>

              <div className={`p-4 border-2 rounded-lg ${
                activePositionPreset === 'カスタム'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}>
                <div className="font-semibold mb-2">カスタム範囲</div>
                <div className="flex gap-2 items-center text-sm">
                  <input
                    type="number"
                    step="0.1"
                    value={filters.position_range.min}
                    onChange={(e) => {
                      setActivePositionPreset('カスタム')
                      setFilters({
                        ...filters,
                        position_range: {
                          ...filters.position_range,
                          min: parseFloat(e.target.value),
                          preset: 'カスタム'
                        }
                      })
                    }}
                    className="w-20 p-1 border rounded"
                  />
                  <span>〜 順位 〜</span>
                  <input
                    type="number"
                    step="0.1"
                    value={filters.position_range.max}
                    onChange={(e) => {
                      setActivePositionPreset('カスタム')
                      setFilters({
                        ...filters,
                        position_range: {
                          ...filters.position_range,
                          max: parseFloat(e.target.value),
                          preset: 'カスタム'
                        }
                      })
                    }}
                    className="w-20 p-1 border rounded"
                  />
                </div>
              </div>
            </div>

            {/* 高度なフィルター */}
            {showFilters && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">📍 キーワードフィルター</h3>
                <div className="space-y-2 mb-4">
                  {filters.keywords.include.terms.map((term, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <span className="text-sm">含む:</span>
                      <input
                        type="text"
                        value={term}
                        readOnly
                        className="flex-1 p-2 border rounded bg-gray-50"
                      />
                      <button
                        onClick={() => removeIncludeKeyword(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="キーワードを入力"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addIncludeKeyword(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="flex-1 p-2 border rounded"
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousSibling
                        addIncludeKeyword(input.value)
                        input.value = ''
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold mb-3">📊 パフォーマンス条件</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">最低広告費 (円/月)</label>
                    <input
                      type="number"
                      value={filters.performance.min_ad_spend}
                      onChange={(e) => setFilters({
                        ...filters,
                        performance: {
                          ...filters.performance,
                          min_ad_spend: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">最低オーガニッククリック (回/月)</label>
                    <input
                      type="number"
                      value={filters.performance.min_organic_clicks}
                      onChange={(e) => setFilters({
                        ...filters,
                        performance: {
                          ...filters.performance,
                          min_organic_clicks: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* サマリー */}
        {results && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              サマリー（{filters.position_range.preset}）
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-lg text-white">
                <h3 className="text-sm opacity-80">該当クエリ数</h3>
                <p className="text-3xl font-bold">{results.summary.total_queries.toLocaleString()}</p>
                <p className="text-xs opacity-70 mt-1">
                  全体の{((results.summary.total_queries / results.metadata.gsc_queries) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 rounded-lg text-white">
                <h3 className="text-sm opacity-80">現在の月間広告費</h3>
                <p className="text-3xl font-bold">¥{(results.summary.total_ad_spend / 1000).toFixed(0)}k</p>
                <p className="text-xs opacity-70 mt-1">
                  平均CPC: ¥{(results.summary.total_ad_spend / results.queries.reduce((sum, q) => sum + q.ad_clicks, 0)).toFixed(0)}
                </p>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
                <h3 className="text-sm opacity-80">推定削減可能額</h3>
                <p className="text-3xl font-bold">¥{(results.summary.total_estimated_savings / 1000).toFixed(0)}k</p>
                <p className="text-xs opacity-70 mt-1">
                  削減率: {((results.summary.total_estimated_savings / results.summary.total_ad_spend) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <AlertCircle className="w-5 h-5" />
                <div className="text-sm">
                  条件: {filters.position_range.min} 〜 {filters.position_range.max}未満 &amp; 広告費 &gt; ¥0
                </div>
              </div>
            </div>
          </div>
        )}

        {/* クエリリスト */}
        {results && results.queries.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">クエリリスト</h2>
              <button
                onClick={downloadCSV}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                CSVエクスポート
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org順位</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ディレクトリ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orgクリック</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">広告クリック</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">月間広告費</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">削減可能額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">信頼度</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.queries.slice(0, 100).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={item.query}>
                        {item.query}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-medium ${
                          item.organic_position < 2 ? 'text-green-600' :
                          item.organic_position < 3 ? 'text-blue-600' :
                          'text-gray-600'
                        }`}>
                          {item.organic_position.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.directory}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.organic_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.ad_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        ¥{(item.ad_cost / 1000).toFixed(1)}k
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        ¥{(item.estimated_savings / 1000).toFixed(1)}k
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          item.savings_confidence === 'high' ? 'bg-green-100 text-green-800' :
                          item.savings_confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.savings_confidence === 'high' ? '高' :
                           item.savings_confidence === 'medium' ? '中' : '低'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {results.queries.length > 100 && (
              <div className="mt-4 text-center text-sm text-gray-600">
                上位100件を表示中（全{results.queries.length.toLocaleString()}件）
              </div>
            )}
          </div>
        )}

        {/* ディレクトリ別内訳 */}
        {results && results.directory_breakdown && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
            <h2 className="text-xl font-bold mb-4">📁 ディレクトリ別内訳</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ディレクトリ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orgクリック</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">広告クリック</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">広告費</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">削減可能額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">削減率</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.directory_breakdown.slice(0, 10).map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.directory}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.count}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.total_organic_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.total_ad_clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">¥{(item.total_ad_cost / 1000).toFixed(0)}k</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        ¥{(item.total_estimated_savings / 1000).toFixed(0)}k
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.savings_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdsCannibalizationAnalysis
