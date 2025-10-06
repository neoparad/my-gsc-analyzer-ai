import React, { useState } from 'react'
import { Zap, Loader2, CheckCircle, ChevronRight } from 'lucide-react'

function PageSpeedAnalysisNew() {
  const [url, setUrl] = useState('')
  const [device, setDevice] = useState('mobile')

  // ステップ管理
  const [currentStep, setCurrentStep] = useState(1) // 1: 入力, 2: 分析中, 3: 改善項目選択, 4: 詳細提案

  // データ保存
  const [pageSpeedData, setPageSpeedData] = useState(null)
  const [deepAnalysisData, setDeepAnalysisData] = useState(null)
  const [improvementItems, setImprovementItems] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [detailedPlans, setDetailedPlans] = useState({})

  // ローディング状態
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')

  // ステップ1: 詳細分析を実行
  const startAnalysis = async () => {
    if (!url) {
      alert('URLを入力してください')
      return
    }

    setLoading(true)
    setCurrentStep(2)

    try {
      // PageSpeed Insights APIを呼び出し
      setLoadingMessage('PageSpeed Insightsでスコアを取得中...')

      const pageSpeedResponse = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${device === 'mobile' ? 'MOBILE' : 'DESKTOP'}&key=${import.meta.env.VITE_PAGESPEED_API_KEY || process.env.PAGESPEED_API_KEY}`)

      if (!pageSpeedResponse.ok) {
        throw new Error('PageSpeed Insights APIエラー')
      }

      const pageSpeedResult = await pageSpeedResponse.json()
      setPageSpeedData(pageSpeedResult)

      // Puppeteerで詳細分析
      setLoadingMessage('Puppeteerでブラウザ詳細分析中...')

      const deepResponse = await fetch('http://localhost:3000/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, device })
      })

      if (!deepResponse.ok) {
        throw new Error('詳細分析APIエラー')
      }

      const deepResult = await deepResponse.json()
      setDeepAnalysisData(deepResult)

      // 統合分析してAIで改善項目リストを生成
      setLoadingMessage('AIで改善項目を分析中...')

      const comprehensiveResponse = await fetch('http://localhost:3000/api/comprehensive-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSpeedData: pageSpeedResult,
          deepAnalysisData: deepResult
        })
      })

      if (!comprehensiveResponse.ok) {
        throw new Error('総合分析APIエラー')
      }

      const comprehensiveResult = await comprehensiveResponse.json()
      setImprovementItems(comprehensiveResult.improvementItems)

      // ステップ3へ移行
      setCurrentStep(3)

    } catch (error) {
      console.error('Analysis error:', error)
      alert('分析中にエラーが発生しました: ' + error.message)
      setCurrentStep(1)
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  // ステップ3: 改善項目を選択/解除
  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId))
    } else {
      setSelectedItems([...selectedItems, itemId])
    }
  }

  // ステップ3→4: 選択した項目の詳細提案を生成
  const generateDetailedPlans = async () => {
    if (selectedItems.length === 0) {
      alert('改善項目を選択してください')
      return
    }

    setLoading(true)
    setCurrentStep(4)

    const plans = {}

    try {
      for (const itemId of selectedItems) {
        const selectedItem = improvementItems.find(item => item.id === itemId)

        setLoadingMessage(`"${selectedItem.title}" の詳細プランを生成中...`)

        const response = await fetch('http://localhost:3000/api/detailed-improvement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedItem,
            pageSpeedData,
            deepAnalysisData
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
      setLoading(false)
      setLoadingMessage('')
    }
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Zap className="w-8 h-8 text-yellow-500" />
          AI パフォーマンス改善アシスタント
        </h1>
        <p className="text-gray-600">
          Puppeteer + PageSpeed Insights + Gemini AIによる詳細分析と改善提案
        </p>
      </div>

      {/* ステップインジケーター */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <StepIndicator number={1} label="URL入力" active={currentStep === 1} completed={currentStep > 1} />
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <StepIndicator number={2} label="分析" active={currentStep === 2} completed={currentStep > 2} />
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <StepIndicator number={3} label="項目選択" active={currentStep === 3} completed={currentStep > 3} />
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <StepIndicator number={4} label="詳細提案" active={currentStep === 4} completed={false} />
      </div>

      {/* ステップ1: URL入力 */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-4">分析するサイト</h2>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              サイトURL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              デバイス
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
            onClick={startAnalysis}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            詳細分析を開始
          </button>
        </div>
      )}

      {/* ステップ2: 分析中 */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg shadow p-12 max-w-2xl mx-auto text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">分析中...</h2>
          <p className="text-gray-600">{loadingMessage}</p>
          <p className="text-sm text-gray-500 mt-4">
            この処理には数分かかる場合があります
          </p>
        </div>
      )}

      {/* ステップ3: 改善項目選択 */}
      {currentStep === 3 && improvementItems && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            改善項目を選択してください
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
              onClick={() => setCurrentStep(1)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              戻る
            </button>
            <button
              onClick={generateDetailedPlans}
              disabled={selectedItems.length === 0}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              選択した{selectedItems.length}項目の詳細プランを生成
            </button>
          </div>
        </div>
      )}

      {/* ステップ4: 詳細提案表示 */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {loading && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">詳細プランを生成中...</h2>
              <p className="text-gray-600">{loadingMessage}</p>
            </div>
          )}

          {!loading && Object.keys(detailedPlans).length > 0 && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  詳細改善プラン
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

              <button
                onClick={() => {
                  setCurrentStep(1)
                  setSelectedItems([])
                  setDetailedPlans({})
                  setImprovementItems(null)
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                新しい分析を開始
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ステップインジケーター
function StepIndicator({ number, label, active, completed }) {
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

// 改善項目カード
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

// 詳細プランカード
function DetailedPlanCard({ item, plan }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{plan.title}</h3>

      {/* Before/After */}
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

      {/* 実装手順 */}
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

      {/* 注意点 */}
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

      {/* 検証方法 */}
      {plan.testingInstructions && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded">
          <h4 className="font-bold text-green-800 mb-2">✅ 検証方法</h4>
          <p className="text-sm text-green-700">{plan.testingInstructions}</p>
        </div>
      )}

      {/* 参考リンク */}
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

export default PageSpeedAnalysisNew
