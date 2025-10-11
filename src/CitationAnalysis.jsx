import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Link2, TrendingUp, Users, Brain, RefreshCw, ExternalLink, Plus, X } from 'lucide-react'

function CitationAnalysis() {
  const [domain, setDomain] = useState(() => sessionStorage.getItem('citationAnalysis_domain') || 'tabirai.net')
  const [months, setMonths] = useState(() => {
    const saved = sessionStorage.getItem('citationAnalysis_months')
    return saved ? JSON.parse(saved) : ['2024-12', '2025-01']
  })
  const [queryInclude, setQueryInclude] = useState(() => sessionStorage.getItem('citationAnalysis_queryInclude') || '')
  const [queryExclude, setQueryExclude] = useState(() => sessionStorage.getItem('citationAnalysis_queryExclude') || '')
  const [competitorDomains, setCompetitorDomains] = useState(() => {
    const saved = sessionStorage.getItem('citationAnalysis_competitors')
    return saved ? JSON.parse(saved) : []
  })
  const [userId] = useState(() => sessionStorage.getItem('username') || 'default_user')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(() => {
    const saved = sessionStorage.getItem('citationAnalysis_results')
    return saved ? JSON.parse(saved) : null
  })
  const [stats, setStats] = useState(null)
  const [competitorComparison, setCompetitorComparison] = useState(null)
  const [polling, setPolling] = useState(false)

  // sessionStorage保存
  useEffect(() => { sessionStorage.setItem('citationAnalysis_domain', domain) }, [domain])
  useEffect(() => { sessionStorage.setItem('citationAnalysis_months', JSON.stringify(months)) }, [months])
  useEffect(() => { sessionStorage.setItem('citationAnalysis_queryInclude', queryInclude) }, [queryInclude])
  useEffect(() => { sessionStorage.setItem('citationAnalysis_queryExclude', queryExclude) }, [queryExclude])
  useEffect(() => { sessionStorage.setItem('citationAnalysis_competitors', JSON.stringify(competitorDomains)) }, [competitorDomains])
  useEffect(() => { if (results) sessionStorage.setItem('citationAnalysis_results', JSON.stringify(results)) }, [results])

  const addMonth = () => {
    const lastMonth = months[months.length - 1]
    const [year, month] = lastMonth.split('-').map(Number)
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`
    setMonths([...months, nextMonthStr])
  }

  const removeMonth = (index) => {
    if (months.length > 1) {
      setMonths(months.filter((_, i) => i !== index))
    }
  }

  const updateMonth = (index, value) => {
    const newMonths = [...months]
    newMonths[index] = value
    setMonths(newMonths)
  }

  const addCompetitor = () => {
    setCompetitorDomains([...competitorDomains, ''])
  }

  const removeCompetitor = (index) => {
    setCompetitorDomains(competitorDomains.filter((_, i) => i !== index))
  }

  const updateCompetitor = (index, value) => {
    const newCompetitors = [...competitorDomains]
    newCompetitors[index] = value
    setCompetitorDomains(newCompetitors)
  }

  const startAnalysis = async () => {
    if (!domain || months.length === 0) {
      setError('ドメインと分析対象月を指定してください')
      return
    }

    setLoading(true)
    setError('')
    setJobStatus(null)
    setProgress(0)

    try {
      const response = await fetch('/api/citation-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          domain,
          months,
          query_include: queryInclude,
          query_exclude: queryExclude
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '分析開始に失敗しました')
      }

      const data = await response.json()
      setJobId(data.job_id)
      setJobStatus('processing')
      setPolling(true)

      // ポーリング開始
      pollJobStatus(data.job_id)

    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const pollJobStatus = async (id) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/citation-status?job_id=${id}&user_id=${userId}`)
        if (!response.ok) throw new Error('ステータス取得失敗')

        const data = await response.json()
        setJobStatus(data.job.status)
        setProgress(data.job.progress || 0)

        if (data.job.status === 'completed') {
          setResults(data)
          setLoading(false)
          setPolling(false)

          // 統計情報も取得
          fetchStats()
        } else if (data.job.status === 'failed') {
          setError(data.job.error_message || '分析に失敗しました')
          setLoading(false)
          setPolling(false)
        } else {
          // 処理中の場合は3秒後に再チェック
          setTimeout(() => checkStatus(), 3000)
        }
      } catch (err) {
        console.error('Status polling error:', err)
        setTimeout(() => checkStatus(), 5000)
      }
    }

    checkStatus()
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/citation-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          domain
        })
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Stats fetch error:', err)
    }
  }

  const fetchCompetitorComparison = async () => {
    if (competitorDomains.length === 0 || !competitorDomains.some(d => d.trim())) {
      setError('競合ドメインを指定してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/citation-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          my_domain: domain,
          competitor_domains: competitorDomains.filter(d => d.trim()),
          months
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '競合比較に失敗しました')
      }

      const data = await response.json()
      setCompetitorComparison(data)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const SENTIMENT_COLORS = {
    positive: '#10b981',
    neutral: '#6b7280',
    negative: '#ef4444'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">🔗 サイテーション分析（被リンク・言及）</h1>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              対象ドメイン
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                クエリ含む（任意）
              </label>
              <input
                type="text"
                value={queryInclude}
                onChange={(e) => setQueryInclude(e.target.value)}
                placeholder="特定のキーワードを含むサイテーションのみ"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                クエリ除外（任意）
              </label>
              <input
                type="text"
                value={queryExclude}
                onChange={(e) => setQueryExclude(e.target.value)}
                placeholder="除外したいキーワード（カンマ区切り）"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                分析対象月（YYYY-MM形式）
              </label>
              <button
                onClick={addMonth}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
            <div className="space-y-2">
              {months.map((month, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => updateMonth(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {months.length > 1 && (
                    <button
                      onClick={() => removeMonth(index)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ Common Crawlのデータを使用します。最新月は2-3ヶ月前までのデータが利用可能です。
            </p>
          </div>

          <button
            onClick={startAnalysis}
            disabled={loading || polling}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${loading || polling ? 'animate-spin' : ''}`} />
            {loading || polling ? '分析中...' : 'サイテーション分析を開始'}
          </button>

          {/* Progress Bar */}
          {polling && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">進捗状況</span>
                <span className="text-sm font-medium text-gray-800">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Results Display */}
        {results && results.citations && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">総サイテーション</p>
                    <p className="text-3xl font-bold text-gray-800">{results.citations.length}</p>
                  </div>
                  <Link2 className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">被リンク</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {results.citations.filter(c => c.citation_type === 'link').length}
                    </p>
                  </div>
                  <ExternalLink className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">言及</p>
                    <p className="text-3xl font-bold text-green-600">
                      {results.citations.filter(c => c.citation_type === 'mention').length}
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">ユニークドメイン</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {new Set(results.citations.map(c => c.source_domain)).size}
                    </p>
                  </div>
                  <Users className="w-10 h-10 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Monthly Trend */}
            {results.monthly_citations && results.monthly_citations.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📈 月次推移</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={results.monthly_citations}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="citation_count" stroke="#3b82f6" strokeWidth={2} name="総サイテーション" />
                    <Line type="monotone" dataKey="link_count" stroke="#10b981" strokeWidth={2} name="被リンク" />
                    <Line type="monotone" dataKey="mention_count" stroke="#f59e0b" strokeWidth={2} name="言及" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sentiment Analysis */}
            {stats && stats.stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">😊 センチメント分布</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'ポジティブ', value: stats.stats.sentiment.positive, color: SENTIMENT_COLORS.positive },
                          { name: 'ニュートラル', value: stats.stats.sentiment.neutral, color: SENTIMENT_COLORS.neutral },
                          { name: 'ネガティブ', value: stats.stats.sentiment.negative, color: SENTIMENT_COLORS.negative }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { color: SENTIMENT_COLORS.positive },
                          { color: SENTIMENT_COLORS.neutral },
                          { color: SENTIMENT_COLORS.negative }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">🏆 トップ参照元ドメイン</h2>
                  <div className="space-y-3">
                    {stats.stats.top_source_domains.slice(0, 8).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate flex-1">{item.domain}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${(item.count / stats.stats.top_source_domains[0].count) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-800 w-8 text-right">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Citation Score Trend */}
            {results.citation_scores && results.citation_scores.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📊 サイテーションスコア推移</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={results.citation_scores}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="citation_score" fill="#8b5cf6" name="スコア" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* AI Summary */}
            {stats && stats.ai_summary && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-600" />
                  AI分析サマリー
                </h2>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">{stats.ai_summary.summary}</p>
                </div>
              </div>
            )}

            {/* Recent Citations */}
            {stats && stats.stats && stats.stats.recent_citations && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📝 最近のサイテーション</h2>
                <div className="space-y-4">
                  {stats.stats.recent_citations.map((citation, idx) => (
                    <div key={idx} className="border-l-4 pl-4 py-2" style={{ borderColor: SENTIMENT_COLORS[citation.sentiment] }}>
                      <div className="flex items-center justify-between mb-1">
                        <a
                          href={citation.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1"
                        >
                          {citation.source_domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className={`text-xs px-2 py-1 rounded ${
                          citation.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                          citation.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {citation.sentiment === 'positive' ? 'ポジティブ' :
                           citation.sentiment === 'negative' ? 'ネガティブ' : 'ニュートラル'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{citation.context}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          citation.citation_type === 'link' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {citation.citation_type === 'link' ? 'リンク' : '言及'}
                        </span>
                        {citation.anchor_text && (
                          <span className="text-xs text-gray-500">
                            アンカー: {citation.anchor_text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Competitor Comparison Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🏆 競合比較</h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                競合ドメイン
              </label>
              <button
                onClick={addCompetitor}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                追加
              </button>
            </div>
            <div className="space-y-2">
              {competitorDomains.map((competitor, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={competitor}
                    onChange={(e) => updateCompetitor(index, e.target.value)}
                    placeholder="competitor.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={() => removeCompetitor(index)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={fetchCompetitorComparison}
            disabled={loading || competitorDomains.length === 0}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            競合比較を実行
          </button>

          {/* Competitor Comparison Results */}
          {competitorComparison && (
            <div className="mt-6 space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ドメイン</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">総サイテーション</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">被リンク</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">言及</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ポジティブ</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">スコア</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{competitorComparison.comparison.my_domain.domain} (自社)</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{competitorComparison.comparison.my_domain.total_citations}</td>
                      <td className="px-4 py-3 text-sm text-right">{competitorComparison.comparison.my_domain.total_links}</td>
                      <td className="px-4 py-3 text-sm text-right">{competitorComparison.comparison.my_domain.total_mentions}</td>
                      <td className="px-4 py-3 text-sm text-right">{competitorComparison.comparison.my_domain.positive_sentiment}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{competitorComparison.comparison.my_domain.recent_score}</td>
                    </tr>
                    {competitorComparison.comparison.competitors.map((comp, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-900">{comp.domain}</td>
                        <td className="px-4 py-3 text-sm text-right">{comp.total_citations}</td>
                        <td className="px-4 py-3 text-sm text-right">{comp.total_links}</td>
                        <td className="px-4 py-3 text-sm text-right">{comp.total_mentions}</td>
                        <td className="px-4 py-3 text-sm text-right">{comp.positive_sentiment}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{comp.recent_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {competitorComparison.ai_report && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">🤖 AI競合分析レポート</h3>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap">{competitorComparison.ai_report}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CitationAnalysis
