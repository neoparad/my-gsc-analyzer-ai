import React from 'react'
import { Brain, TrendingUp, Target, Lightbulb, AlertCircle } from 'lucide-react'

function RankTrackerAIResult({ data }) {
  if (!data) return null

  const { factorAnalysis, intentAnalysis, portfolioAnalysis, insights } = data

  return (
    <div className="space-y-6">
      {/* 順位変動の要因推定 */}
      {factorAnalysis && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            順位変動の要因推定
          </h3>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">🔄 Googleアルゴリズム更新の影響</h4>
              <p className="text-sm text-gray-700">{factorAnalysis.algorithmImpact}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">📅 季節要因・イベント要因</h4>
              <p className="text-sm text-gray-700">{factorAnalysis.seasonalFactors}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">📝 コンテンツ品質の変化</h4>
              <p className="text-sm text-gray-700">{factorAnalysis.contentQuality}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2">⚔️ 競合サイトの動向</h4>
              <p className="text-sm text-gray-700">{factorAnalysis.competitorImpact}</p>
            </div>
          </div>
        </div>
      )}

      {/* 検索意図分析 */}
      {intentAnalysis && intentAnalysis.intentDistribution && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            検索意図の深掘り分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">📚 情報型 (Informational)</h4>
              <p className="text-sm text-gray-700">{intentAnalysis.intentDistribution.informational}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">💰 取引型 (Transactional)</h4>
              <p className="text-sm text-gray-700">{intentAnalysis.intentDistribution.transactional}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-900 mb-2">🧭 ナビゲーション型 (Navigational)</h4>
              <p className="text-sm text-gray-700">{intentAnalysis.intentDistribution.navigational}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-semibold text-orange-900 mb-2">🛒 商業型 (Commercial)</h4>
              <p className="text-sm text-gray-700">{intentAnalysis.intentDistribution.commercial}</p>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">💡 改善提案</h4>
            <p className="text-sm text-gray-700">{intentAnalysis.recommendations}</p>
          </div>
        </div>
      )}

      {/* クエリポートフォリオ分析 */}
      {portfolioAnalysis && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            クエリポートフォリオ分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2">📈 成長株クエリ</h4>
              <ul className="space-y-1">
                {portfolioAnalysis.growthQueries && portfolioAnalysis.growthQueries.length > 0 ? (
                  portfolioAnalysis.growthQueries.map((query, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                      {query}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">該当なし</li>
                )}
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">📊 安定株クエリ</h4>
              <ul className="space-y-1">
                {portfolioAnalysis.stableQueries && portfolioAnalysis.stableQueries.length > 0 ? (
                  portfolioAnalysis.stableQueries.map((query, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      {query}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">該当なし</li>
                )}
              </ul>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-semibold text-red-900 mb-2">📉 低迷株クエリ</h4>
              <ul className="space-y-1">
                {portfolioAnalysis.decliningQueries && portfolioAnalysis.decliningQueries.length > 0 ? (
                  portfolioAnalysis.decliningQueries.map((query, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                      {query}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">該当なし</li>
                )}
              </ul>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">🎯 ポートフォリオ戦略</h4>
            <p className="text-sm text-gray-700">{portfolioAnalysis.strategy}</p>
          </div>
        </div>
      )}

      {/* 自然言語インサイト */}
      {insights && insights.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            自然言語インサイト
          </h3>
          <div className="space-y-3">
            {insights.map((item, idx) => (
              <div key={idx} className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-l-4 border-purple-600">
                <h4 className="font-semibold text-purple-900 mb-2">🔍 {item.query}</h4>
                <p className="text-sm text-gray-700">{item.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RankTrackerAIResult
