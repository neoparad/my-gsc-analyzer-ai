import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Brain, Tag, Lightbulb } from 'lucide-react'

function AIAnalysisResult({ result }) {
  const [activeTab, setActiveTab] = useState('intent')

  if (!result) return null

  const { intentClassification, categoryClassification, clusterInterpretation } = result

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab('intent')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'intent'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Brain className="w-4 h-4 mr-2" />
            検索意図分析
          </button>
          <button
            onClick={() => setActiveTab('category')}
            className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'category'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Tag className="w-4 h-4 mr-2" />
            カテゴリ分類
          </button>
          {clusterInterpretation && (
            <button
              onClick={() => setActiveTab('cluster')}
              className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'cluster'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              クラスタ解釈
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'intent' && (
          <IntentView intentClassification={intentClassification} />
        )}
        {activeTab === 'category' && (
          <CategoryView categoryClassification={categoryClassification} />
        )}
        {activeTab === 'cluster' && clusterInterpretation && (
          <ClusterInterpretationView clusterInterpretation={clusterInterpretation} />
        )}
      </div>
    </div>
  )
}

// 検索意図分析表示
function IntentView({ intentClassification }) {
  const COLORS = {
    informational: '#3b82f6',
    transactional: '#10b981',
    navigational: '#f59e0b',
    commercial: '#8b5cf6'
  }

  const LABELS = {
    informational: '情報収集型',
    transactional: '購入意図型',
    navigational: 'ナビゲーション型',
    commercial: '比較検討型'
  }

  const chartData = Object.entries(intentClassification).map(([intent, data]) => ({
    name: LABELS[intent],
    count: data.count,
    avgChange: data.avgChange,
    color: COLORS[intent]
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div>
          <h3 className="text-lg font-semibold mb-4">検索意図の分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div>
          <h3 className="text-lg font-semibold mb-4">意図別の平均変動率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} />
              <YAxis label={{ value: '変動率 (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="avgChange">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intent Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(intentClassification).map(([intent, data]) => (
          <div
            key={intent}
            className="border rounded-lg p-4"
            style={{ borderColor: COLORS[intent] }}
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-lg font-semibold" style={{ color: COLORS[intent] }}>
                {LABELS[intent]}
              </h4>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: COLORS[intent] }}>
                  {data.avgChange > 0 ? '+' : ''}{data.avgChange}%
                </div>
                <div className="text-sm text-gray-600">n={data.count}</div>
              </div>
            </div>
            {data.keywords.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">例:</h5>
                <div className="flex flex-wrap gap-2">
                  {data.keywords.slice(0, 5).map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {kw.query}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-purple-800 mb-2">💡 インサイト</h3>
        <ul className="space-y-2 text-sm text-purple-900">
          <li>• <strong>情報収集型</strong>: 情報を探しているユーザー。コンテンツの質が重要</li>
          <li>• <strong>購入意図型</strong>: 購入・予約したいユーザー。CTA最適化が効果的</li>
          <li>• <strong>ナビゲーション型</strong>: 特定サイトに行きたいユーザー。ブランド認知度が影響</li>
          <li>• <strong>比較検討型</strong>: 比較検討しているユーザー。差別化ポイントの訴求が有効</li>
        </ul>
      </div>
    </div>
  )
}

// カテゴリ分類表示
function CategoryView({ categoryClassification }) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  const chartData = categoryClassification.map((cat, idx) => ({
    name: cat.name,
    count: cat.count,
    avgChange: cat.avgChange,
    color: COLORS[idx % COLORS.length]
  }))

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div>
        <h3 className="text-lg font-semibold mb-4">カテゴリ別の平均変動率</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" label={{ value: '変動率 (%)', position: 'insideBottom', offset: -5 }} />
            <YAxis type="category" dataKey="name" width={150} />
            <Tooltip />
            <Bar dataKey="avgChange">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">カテゴリ詳細</h3>
        {categoryClassification.map((category, idx) => (
          <div
            key={idx}
            className="border rounded-lg p-4"
            style={{ borderColor: COLORS[idx % COLORS.length] }}
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-lg font-semibold" style={{ color: COLORS[idx % COLORS.length] }}>
                {category.name}
              </h4>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                  {category.avgChange > 0 ? '+' : ''}{category.avgChange}%
                </div>
                <div className="text-sm text-gray-600">n={category.count}</div>
              </div>
            </div>
            {category.keywords && category.keywords.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">主要キーワード:</h5>
                <div className="flex flex-wrap gap-2">
                  {category.keywords.slice(0, 8).map((kw, kidx) => (
                    <span
                      key={kidx}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {kw.query}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// クラスタ解釈表示
function ClusterInterpretationView({ clusterInterpretation }) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-purple-800 mb-2">🤖 AI によるクラスタ解釈</h3>
        <p className="text-sm text-purple-700">
          統計的に分類されたクラスタに、AIが意味的な解釈と示唆を提供します
        </p>
      </div>

      {/* Cluster Interpretations */}
      <div className="space-y-4">
        {clusterInterpretation.map((cluster, idx) => (
          <div
            key={cluster.clusterId}
            className="border-2 rounded-lg p-6"
            style={{ borderColor: COLORS[idx % COLORS.length] }}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xl font-bold mb-1" style={{ color: COLORS[idx % COLORS.length] }}>
                  {cluster.name}
                </h4>
                <div className="text-sm text-gray-600">
                  クラスタ {cluster.clusterId} • {cluster.clusterSize}件のキーワード
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                  {cluster.avgChangeRate > 0 ? '+' : ''}{cluster.avgChangeRate}%
                </div>
                <div className="text-sm text-gray-600">平均変動率</div>
              </div>
            </div>

            {/* Explanation */}
            {cluster.explanation && (
              <div className="mb-4 bg-gray-50 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">📝 説明</h5>
                <p className="text-sm text-gray-800">{cluster.explanation}</p>
              </div>
            )}

            {/* Business Insight */}
            {cluster.businessInsight && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-purple-700 mb-2">💼 ビジネス上の示唆</h5>
                <p className="text-sm text-purple-900">{cluster.businessInsight}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default AIAnalysisResult
