import React, { useState } from 'react'
import { Plus, Minus, Zap, Loader2, ChevronRight, CheckCircle } from 'lucide-react'

function PageSpeedAnalysisV2() {
  // フェーズ管理: 1=競合比較, 2=深掘り分析, 3=詳細改善策
  const [phase, setPhase] = useState(1)

  // フェーズ1: 競合比較
  const [myUrl, setMyUrl] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState([''])
  const [device, setDevice] = useState('mobile')
  const [loading, setLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')

  // フェーズ2: 深掘り分析
  const [loadingDeepAnalysis, setLoadingDeepAnalysis] = useState(false)
  const [deepAnalysisProgress, setDeepAnalysisProgress] = useState('')
  const [improvementItems, setImprovementItems] = useState(null)

  // フェーズ3: 詳細改善策
  const [selectedItems, setSelectedItems] = useState([])
  const [detailedPlans, setDetailedPlans] = useState({})
  const [loadingDetailedPlans, setLoadingDetailedPlans] = useState(false)

  // フェーズ1の関数群
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

    try {
      const validCompetitors = competitorUrls.filter(url => url.trim() !== '')

      const response = await fetch('http://localhost:3000/api/analyze-competitive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setPhase(1) // 結果表示はフェーズ1

    } catch (error) {
      console.error('Analysis error:', error)
      alert('競合分析中にエラーが発生しました: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // フェーズ1→2: 深掘り分析開始
  const startDeepAnalysis = async () => {
    if (!analysisData) return

    setLoadingDeepAnalysis(true)
    setPhase(2)

    try {
      // 自社サイトのデータを取得
      const ownSite = analysisData.results.find(r => r.type === 'own')

      // Puppeteerで詳細分析
      setDeepAnalysisProgress('詳細分析中...')

      const deepResponse = await fetch('http://localhost:3000/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: myUrl, device })
      })

      if (!deepResponse.ok) {
        throw new Error('詳細分析APIエラー')
      }

      const deepData = await deepResponse.json()

      // PageSpeed + Puppeteerデータを統合してAI分析
      setDeepAnalysisProgress('AIで改善項目を分析中...')

      const comprehensiveResponse = await fetch('http://localhost:3000/api/comprehensive-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSpeedData: ownSite.rawData,
          deepAnalysisData: deepData
        })
      })

      if (!comprehensiveResponse.ok) {
        throw new Error('総合分析APIエラー')
      }

      const comprehensiveResult = await comprehensiveResponse.json()
      setImprovementItems(comprehensiveResult.improvementItems)

    } catch (error) {
      console.error('Deep analysis error:', error)
      alert('深掘り分析中にエラーが発生しました: ' + error.message)
      setPhase(1)
    } finally {
      setLoadingDeepAnalysis(false)
      setDeepAnalysisProgress('')
    }
  }

  // フェーズ2→3: 選択した項目の詳細改善策を生成
  const generateDetailedPlans = async () => {
    if (selectedItems.length === 0) {
      alert('改善項目を選択してください')
      return
    }

    setLoadingDetailedPlans(true)
    setPhase(3)

    const plans = {}
    const ownSite = analysisData.results.find(r => r.type === 'own')

    try {
      // Puppeteerデータを再取得（または保存しておく）
      const deepResponse = await fetch('http://localhost:3000/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: myUrl, device })
      })
      const deepData = await deepResponse.json()

      for (const itemId of selectedItems) {
        const selectedItem = improvementItems.find(item => item.id === itemId)

        const response = await fetch('http://localhost:3000/api/detailed-improvement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedItem,
            pageSpeedData: ownSite.rawData,
            deepAnalysisData: deepData,
            url: myUrl,
            device
          })
        })

        if (!response.ok) {
          console.error(`Failed to generate plan for ${itemId}`)
          continue
        }

        const result = await response.json()
        plans[itemId] = result.detailedPlan
      }

      setDetailedPlans(plans)

    } catch (error) {
      console.error('Detailed plan generation error:', error)
      alert('詳細プラン生成中にエラーが発生しました: ' + error.message)
    } finally {
      setLoadingDetailedPlans(false)
    }
  }

  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
    } else {
      setSelectedItems([...selectedItems, itemId])
    }
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Zap className="w-8 h-8 text-yellow-500" />
          ページスピード分析AI
        </h1>
        <p className="text-gray-600">
          競合比較 → AI深掘り分析 → 詳細改善提案の3ステップ
        </p>
      </div>

      {/* フェーズインジケーター */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <PhaseIndicator number={1} label="競合比較" active={phase === 1} completed={phase > 1} />
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <PhaseIndicator number={2} label="AI深掘り分析" active={phase === 2} completed={phase > 2} />
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <PhaseIndicator number={3} label="詳細改善策" active={phase === 3} completed={false} />
      </div>

      {/* フェーズ1: 入力フォーム */}
      {phase === 1 && !analysisData && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">分析設定</h2>

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

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              競合サイトURL（任意・最大3つ）
            </label>
            <p className="text-sm text-gray-500 mb-2">※ 空欄の場合は自社サイトのみ分析します</p>
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
                分析する
              </>
            )}
          </button>
        </div>
      )}

      {/* フェーズ1: 競合比較結果 */}
      {phase === 1 && analysisData && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
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
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'summary' && <SummaryTab data={analysisData} />}
              {activeTab === 'heatmap' && <HeatmapTab data={analysisData} />}
            </div>
          </div>

          {/* フェーズ2へ進むボタン */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              🤖 さらに詳しく分析しますか？
            </h3>
            <p className="text-gray-700 mb-4">
              Puppeteer + AIで自社サイトを深掘り分析し、具体的な改善項目を抽出します
            </p>
            <button
              onClick={startDeepAnalysis}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-8 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
            >
              AI深掘り分析を開始
            </button>
          </div>
        </div>
      )}

      {/* フェーズ2: AI深掘り分析中 */}
      {phase === 2 && loadingDeepAnalysis && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">AI深掘り分析中...</h2>
          <p className="text-gray-600">{deepAnalysisProgress}</p>
          <p className="text-sm text-gray-500 mt-4">
            この処理には数分かかる場合があります
          </p>
        </div>
      )}

      {/* フェーズ2: 改善項目選択 */}
      {phase === 2 && !loadingDeepAnalysis && improvementItems && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            AI分析完了：改善項目を選択してください
          </h2>
          <p className="text-gray-600 mb-6">
            詳細な改善プランを生成したい項目にチェックを入れてください
          </p>

          <div className="space-y-3 mb-6">
            {improvementItems.map((item) => (
              <ImprovementItemCard
                key={item.id}
                item={item}
                selected={selectedItems.includes(item.id)}
                onToggle={() => toggleItemSelection(item.id)}
              />
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setPhase(1)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              競合比較に戻る
            </button>
            <button
              onClick={generateDetailedPlans}
              disabled={selectedItems.length === 0}
              className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-green-700 hover:to-teal-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              選択した{selectedItems.length}項目の詳細改善策を生成
            </button>
          </div>
        </div>
      )}

      {/* フェーズ3: 詳細改善策生成中 */}
      {phase === 3 && loadingDetailedPlans && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 className="w-16 h-16 animate-spin text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">詳細改善策を生成中...</h2>
          <p className="text-gray-600">各項目について実装可能な手順を作成しています</p>
        </div>
      )}

      {/* フェーズ3: 詳細改善策表示 */}
      {phase === 3 && !loadingDetailedPlans && Object.keys(detailedPlans).length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              ✅ 詳細改善プラン完成
            </h2>
            <p className="text-gray-600">
              各項目の実装可能な改善手順が生成されました
            </p>
          </div>

          {selectedItems.map((itemId) => {
            const item = improvementItems.find(i => i.id === itemId)
            const plan = detailedPlans[itemId]

            if (!plan) return null

            return (
              <DetailedPlanCard key={itemId} item={item} plan={plan} />
            )
          })}

          <div className="flex gap-4">
            <button
              onClick={() => setPhase(2)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              改善項目選択に戻る
            </button>
            <button
              onClick={() => {
                setPhase(1)
                setAnalysisData(null)
                setImprovementItems(null)
                setSelectedItems([])
                setDetailedPlans({})
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              新しい分析を開始
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// フェーズインジケーター
function PhaseIndicator({ number, label, active, completed }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
        completed ? 'bg-green-500 text-white' :
        active ? 'bg-blue-600 text-white' :
        'bg-gray-300 text-gray-600'
      }`}>
        {completed ? <CheckCircle className="w-6 h-6" /> : number}
      </div>
      <span className={`text-xs mt-1 ${active ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
        {label}
      </span>
    </div>
  )
}

// 以下、既存のコンポーネントを再利用
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

      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">パフォーマンス詳細指標</h3>

        {/* Core Web Vitals */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-700 mb-3">Core Web Vitals</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">指標</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">説明</th>
                  <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border">評価基準</th>
                  {results.map((site, idx) => (
                    <th key={idx} className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border">
                      {site.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border">
                    LCP<br/><span className="text-xs text-gray-500">Largest Contentful Paint</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border">
                    ページの最も大きなコンテンツが表示されるまでの時間
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border text-center">
                    <div className="text-green-700 font-semibold">良好: &lt;2.5s</div>
                    <div className="text-yellow-700">改善: 2.5-4s</div>
                    <div className="text-red-700">不良: &gt;4s</div>
                  </td>
                  {results.map((site, idx) => {
                    const value = site.metrics.lcp / 1000
                    const color = value <= 2.5 ? 'text-green-600' : value <= 4 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <td key={idx} className="px-4 py-2 text-center border">
                        <span className={`font-semibold ${color}`}>{value.toFixed(2)}s</span>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border">
                    FCP<br/><span className="text-xs text-gray-500">First Contentful Paint</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border">
                    最初のコンテンツ（テキストや画像）が表示されるまでの時間
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border text-center">
                    <div className="text-green-700 font-semibold">良好: &lt;1.8s</div>
                    <div className="text-yellow-700">改善: 1.8-3s</div>
                    <div className="text-red-700">不良: &gt;3s</div>
                  </td>
                  {results.map((site, idx) => {
                    const value = site.metrics.fcp / 1000
                    const color = value <= 1.8 ? 'text-green-600' : value <= 3 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <td key={idx} className="px-4 py-2 text-center border">
                        <span className={`font-semibold ${color}`}>{value.toFixed(2)}s</span>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border">
                    CLS<br/><span className="text-xs text-gray-500">Cumulative Layout Shift</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border">
                    ページ読み込み中のレイアウトのズレ量（視覚的安定性）
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border text-center">
                    <div className="text-green-700 font-semibold">良好: &lt;0.1</div>
                    <div className="text-yellow-700">改善: 0.1-0.25</div>
                    <div className="text-red-700">不良: &gt;0.25</div>
                  </td>
                  {results.map((site, idx) => {
                    const value = site.metrics.cls
                    const color = value <= 0.1 ? 'text-green-600' : value <= 0.25 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <td key={idx} className="px-4 py-2 text-center border">
                        <span className={`font-semibold ${color}`}>{value.toFixed(3)}</span>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border">
                    TTI<br/><span className="text-xs text-gray-500">Time to Interactive</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border">
                    ページが完全に操作可能になるまでの時間
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border text-center">
                    <div className="text-green-700 font-semibold">良好: &lt;3.8s</div>
                    <div className="text-yellow-700">改善: 3.8-7.3s</div>
                    <div className="text-red-700">不良: &gt;7.3s</div>
                  </td>
                  {results.map((site, idx) => {
                    const value = site.metrics.tti / 1000
                    const color = value <= 3.8 ? 'text-green-600' : value <= 7.3 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <td key={idx} className="px-4 py-2 text-center border">
                        <span className={`font-semibold ${color}`}>{value.toFixed(2)}s</span>
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 border">
                    FID<br/><span className="text-xs text-gray-500">First Input Delay (Max Potential)</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border">
                    ユーザーの最初の操作に対する応答時間
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 border text-center">
                    <div className="text-green-700 font-semibold">良好: &lt;100ms</div>
                    <div className="text-yellow-700">改善: 100-300ms</div>
                    <div className="text-red-700">不良: &gt;300ms</div>
                  </td>
                  {results.map((site, idx) => {
                    const value = site.metrics.fid
                    const color = value <= 100 ? 'text-green-600' : value <= 300 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <td key={idx} className="px-4 py-2 text-center border">
                        <span className={`font-semibold ${color}`}>{value.toFixed(0)}ms</span>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeatmapTab({ data }) {
  const { heatmapData, results } = data
  const [expandedRows, setExpandedRows] = useState({})

  if (!heatmapData || !heatmapData.matrix) {
    return <p className="text-gray-600">ヒートマップデータがありません</p>
  }

  const toggleRow = (rowIdx) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowIdx]: !prev[rowIdx]
    }))
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
        各サイトがパフォーマンス改善項目をクリアしているかを色で表示しています。項目をクリックすると詳細が表示されます。
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
              <React.Fragment key={rowIdx}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleRow(rowIdx)}
                >
                  <td className="px-4 py-3 text-sm text-gray-900 border">
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${expandedRows[rowIdx] ? 'rotate-90' : ''}`}
                      />
                      {row.title}
                    </div>
                  </td>
                  {row.cells.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3 text-center border">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className={`inline-block w-12 h-6 rounded ${getStatusColor(cell.status)} text-white text-xs font-semibold flex items-center justify-center`}>
                          {getStatusLabel(cell.status)}
                        </span>
                        {cell.displayValue && (
                          <span className="text-xs text-gray-600">{cell.displayValue}</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
                {expandedRows[rowIdx] && (
                  <tr className="bg-blue-50">
                    <td colSpan={results.length + 1} className="px-4 py-4 border">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">{row.title}</h4>
                        {row.description && (
                          <p className="text-sm text-gray-700">{row.description}</p>
                        )}

                        <div className="mt-3 p-3 bg-white rounded">
                          <h5 className="font-semibold text-gray-800 mb-2">サイト別ステータス:</h5>
                          <div className="space-y-2">
                            {row.cells.map((cell, cellIdx) => (
                              <div key={cellIdx} className="flex items-center justify-between text-sm border-b border-gray-200 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full ${getStatusColor(cell.status)}`}></span>
                                  <span className="font-medium">{results[cellIdx].label}:</span>
                                  <span className="text-gray-600">{getStatusLabel(cell.status)}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {cell.displayValue && cell.displayValue !== '-' && (
                                    <span className="text-gray-700 font-semibold">{cell.displayValue}</span>
                                  )}
                                  {cell.score !== null && (
                                    <span className="text-xs text-gray-500">
                                      スコア: {Math.round(cell.score * 100)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
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

function ImprovementItemCard({ item, selected, onToggle }) {
  const getPriorityColor = (priority) => {
    if (priority === '高') return 'bg-red-100 text-red-800 border-red-300'
    if (priority === '中') return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty === '難') return 'bg-red-100 text-red-800'
    if (difficulty === '中') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  return (
    <div
      onClick={onToggle}
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1 w-5 h-5"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-bold text-gray-900">{item.title}</h3>
            <div className="flex gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(item.priority)}`}>
                {item.priority}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(item.difficulty)}`}>
                難易度: {item.difficulty}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-2">{item.summary}</p>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              カテゴリ: <span className="font-semibold text-gray-700">{item.category}</span>
            </span>
            <span className="text-gray-500">
              効果: <span className="font-semibold text-gray-700">{item.estimatedImprovement}</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-gray-500">インパクト:</span>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={star <= item.impact ? 'text-yellow-400' : 'text-gray-300'}>
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailedPlanCard({ item, plan }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{plan.title}</h3>

      {plan.beforeAfter && (
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">改善前</h4>
            <p className="text-sm text-gray-600">{plan.beforeAfter.before}</p>
          </div>
          <div>
            <h4 className="font-semibold text-green-700 mb-1">改善後（予想）</h4>
            <p className="text-sm text-green-600">{plan.beforeAfter.after}</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-lg font-bold text-gray-800 mb-3">実装手順</h4>
        <div className="space-y-4">
          {plan.steps && plan.steps.map((step, idx) => (
            <div key={idx} className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-start gap-2 mb-1">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {step.stepNumber}
                </span>
                <h5 className="font-semibold text-gray-900">{step.title}</h5>
              </div>
              <p className="text-sm text-gray-700 mb-2 ml-8">{step.description}</p>

              {step.codeExample && (
                <details className="ml-8 mt-2">
                  <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700 text-sm">
                    コード例
                  </summary>
                  <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-xs">
                    <code>{step.codeExample}</code>
                  </pre>
                </details>
              )}

              {step.tools && step.tools.length > 0 && (
                <div className="ml-8 mt-2 text-sm">
                  <span className="text-gray-600">使用ツール: </span>
                  <span className="text-gray-800">{step.tools.join(', ')}</span>
                </div>
              )}

              {step.estimatedTime && (
                <div className="ml-8 mt-1 text-sm text-gray-500">
                  所要時間: {step.estimatedTime}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {plan.warnings && plan.warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <h4 className="font-bold text-yellow-800 mb-2">⚠️ 注意点</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
            {plan.warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.testingInstructions && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded">
          <h4 className="font-bold text-green-800 mb-2">✅ 検証方法</h4>
          <p className="text-sm text-green-700">{plan.testingInstructions}</p>
        </div>
      )}

      {plan.references && plan.references.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-800 mb-2">📚 参考資料</h4>
          <ul className="space-y-1">
            {plan.references.map((ref, idx) => (
              <li key={idx}>
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {ref}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PageSpeedAnalysisV2
