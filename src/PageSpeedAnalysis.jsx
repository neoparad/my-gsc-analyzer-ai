import React, { useState } from 'react'
import { Plus, Minus, Zap, Loader2 } from 'lucide-react'

function PageSpeedAnalysis() {
  const [myUrl, setMyUrl] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState([''])
  const [device, setDevice] = useState('mobile')
  const [loading, setLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [improvementPlan, setImprovementPlan] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  const addCompetitorField = () => {
    if (competitorUrls.length < 3) {
      setCompetitorUrls([...competitorUrls, ''])
    }
  }

  const removeCompetitorField = (index) => {
    setCompetitorUrls(competitorUrls.filter((_, i) => i !== index))
  }

  const updateCompetitorUrl = (index, value) => {
    const updated = [...competitorUrls]
    updated[index] = value
    setCompetitorUrls(updated)
  }

  const analyzeCompetitive = async () => {
    if (!myUrl) {
      alert('自社サイトURLを入力してください')
      return
    }

    setLoading(true)
    setAnalysisData(null)
    setImprovementPlan(null)

    try {
      const validCompetitors = competitorUrls.filter(url => url.trim() !== '')

      const response = await fetch('http://localhost:3000/api/analyze-competitive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          myUrl,
          competitorUrls: validCompetitors,
          device
        })
      })

      if (!response.ok) {
        throw new Error('分析に失敗しました')
      }

      const data = await response.json()
      setAnalysisData(data)
      setActiveTab('summary')

    } catch (error) {
      console.error('Analysis error:', error)
      alert('競合分析中にエラーが発生しました: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const generateImprovementPlan = async () => {
    if (!analysisData || !analysisData.results || analysisData.results.length === 0) {
      alert('まず分析を実行してください')
      return
    }

    const ownSite = analysisData.results.find(r => r.type === 'own')
    if (!ownSite) {
      alert('自社サイトのデータが見つかりません')
      return
    }

    setLoadingPlan(true)

    try {
      const response = await fetch('http://localhost:3000/api/generate-improvement-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteData: ownSite
        })
      })

      if (!response.ok) {
        throw new Error('改善プランの生成に失敗しました')
      }

      const data = await response.json()
      setImprovementPlan(data.improvementPlan)

    } catch (error) {
      console.error('Plan generation error:', error)
      alert('改善プラン生成中にエラーが発生しました: ' + error.message)
    } finally {
      setLoadingPlan(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Zap className="w-8 h-8 text-yellow-500" />
          ページスピード分析
        </h1>
        <p className="text-gray-600">
          競合サイトとのパフォーマンス比較とAI改善提案
        </p>
      </div>

      {/* 入力フォーム */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">分析設定</h2>

        {/* 自社サイトURL */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            自社サイトURL *
          </label>
          <input
            type="url"
            value={myUrl}
            onChange={(e) => setMyUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 競合サイトURL */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            競合サイトURL（最大3つ）
          </label>
          {competitorUrls.map((url, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="url"
                value={url}
                onChange={(e) => updateCompetitorUrl(index, e.target.value)}
                placeholder={`競合${index + 1}: https://competitor${index + 1}.com`}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {competitorUrls.length > 1 && (
                <button
                  onClick={() => removeCompetitorField(index)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
          {competitorUrls.length < 3 && (
            <button
              onClick={addCompetitorField}
              className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              競合URLを追加
            </button>
          )}
        </div>

        {/* デバイス選択 */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            分析デバイス
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="mobile"
                checked={device === 'mobile'}
                onChange={(e) => setDevice(e.target.value)}
                className="mr-2"
              />
              <span className="text-gray-700">モバイル</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="desktop"
                checked={device === 'desktop'}
                onChange={(e) => setDevice(e.target.value)}
                className="mr-2"
              />
              <span className="text-gray-700">デスクトップ</span>
            </label>
          </div>
        </div>

        {/* 分析ボタン */}
        <button
          onClick={analyzeCompetitive}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              競合と比較分析する
            </>
          )}
        </button>
      </div>

      {/* 分析結果 */}
      {analysisData && (
        <div className="bg-white rounded-lg shadow">
          {/* タブナビゲーション */}
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'summary'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                パフォーマンス・サマリー
              </button>
              <button
                onClick={() => setActiveTab('heatmap')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'heatmap'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                改善項目ヒートマップ
              </button>
              <button
                onClick={() => setActiveTab('ai-plan')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'ai-plan'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                AI改善プランナー
              </button>
            </div>
          </div>

          {/* タブコンテンツ */}
          <div className="p-6">
            {activeTab === 'summary' && <SummaryTab data={analysisData} />}
            {activeTab === 'heatmap' && <HeatmapTab data={analysisData} />}
            {activeTab === 'ai-plan' && (
              <AIPlanTab
                data={analysisData}
                improvementPlan={improvementPlan}
                loadingPlan={loadingPlan}
                onGeneratePlan={generateImprovementPlan}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// パフォーマンス・サマリータブ
function SummaryTab({ data }) {
  const { results } = data

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100'
    if (score >= 50) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getBestSite = (metric) => {
    let best = results[0]
    results.forEach(site => {
      if (site.scores[metric] > best.scores[metric]) {
        best = site
      }
    })
    return best.label
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">スコア比較</h3>

      {/* スコア比較テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">指標</th>
              {results.map((site, idx) => (
                <th key={idx} className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  {site.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {['performance', 'accessibility', 'bestPractices', 'seo'].map(metric => {
              const labels = {
                performance: 'パフォーマンス',
                accessibility: 'アクセシビリティ',
                bestPractices: 'ベストプラクティス',
                seo: 'SEO'
              }
              const bestSite = getBestSite(metric)

              return (
                <tr key={metric} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {labels[metric]}
                  </td>
                  {results.map((site, idx) => {
                    const score = site.scores[metric]
                    const isBest = site.label === bestSite

                    return (
                      <td key={idx} className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(score)}`}>
                          {isBest && <span>👑</span>}
                          {score}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Core Web Vitals */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {results.map((site, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">{site.label}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">LCP:</span>
                  <span className="font-medium">{(site.metrics.lcp / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CLS:</span>
                  <span className="font-medium">{site.metrics.cls.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">FCP:</span>
                  <span className="font-medium">{(site.metrics.fcp / 1000).toFixed(2)}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ヒートマップタブ
function HeatmapTab({ data }) {
  const { heatmapData, results } = data

  if (!heatmapData || !heatmapData.matrix) {
    return <p className="text-gray-600">ヒートマップデータがありません</p>
  }

  const getStatusColor = (status) => {
    if (status === 'pass') return 'bg-green-500'
    if (status === 'average') return 'bg-yellow-500'
    if (status === 'fail') return 'bg-red-500'
    return 'bg-gray-300'
  }

  const getStatusLabel = (status) => {
    if (status === 'pass') return '優'
    if (status === 'average') return '可'
    if (status === 'fail') return '不可'
    return '-'
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">改善項目ヒートマップ</h3>
      <p className="text-gray-600 mb-4">
        各サイトがパフォーマンス改善項目をクリアしているかを色で表示しています。
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border">
                改善項目
              </th>
              {results.map((site, idx) => (
                <th key={idx} className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border">
                  {site.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmapData.matrix.slice(0, 15).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 border">
                  {row.title}
                </td>
                {row.cells.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-4 py-3 text-center border">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`inline-block w-12 h-6 rounded ${getStatusColor(cell.status)} text-white text-xs font-semibold flex items-center justify-center`}>
                        {getStatusLabel(cell.status)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-green-500 rounded"></span>
          <span className="text-gray-700">優（改善済み）</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-500 rounded"></span>
          <span className="text-gray-700">可（改善の余地あり）</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-red-500 rounded"></span>
          <span className="text-gray-700">不可（要改善）</span>
        </div>
      </div>
    </div>
  )
}

// AI改善プランタブ
function AIPlanTab({ data, improvementPlan, loadingPlan, onGeneratePlan }) {
  const getPriorityColor = (priority) => {
    if (priority === '高') return 'bg-red-100 text-red-800'
    if (priority === '中') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty === '難') return 'bg-red-100 text-red-800'
    if (difficulty === '中') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">AI改善プランナー</h3>

      {!improvementPlan && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">
            AIが自社サイトの改善プランを生成します
          </p>
          <button
            onClick={onGeneratePlan}
            disabled={loadingPlan}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-8 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
          >
            {loadingPlan ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI分析中...
              </>
            ) : (
              '🤖 AIによる改善プランを生成する'
            )}
          </button>
        </div>
      )}

      {improvementPlan && Array.isArray(improvementPlan) && (
        <div className="space-y-4">
          {improvementPlan.map((plan, idx) => (
            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="text-lg font-bold text-gray-900">{plan.title}</h4>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(plan.priority)}`}>
                    優先度: {plan.priority}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(plan.difficulty)}`}>
                    難易度: {plan.difficulty}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600">改善インパクト:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= plan.impact ? 'text-yellow-400' : 'text-gray-300'}>
                      ★
                    </span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <h5 className="font-semibold text-gray-800 mb-2">具体的な改善手順:</h5>
                <p className="text-sm text-gray-700 whitespace-pre-line">{plan.details}</p>
              </div>

              {plan.code_example && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700">
                    コード例を見る
                  </summary>
                  <pre className="mt-2 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{plan.code_example}</code>
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PageSpeedAnalysis
