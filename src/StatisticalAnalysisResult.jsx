import React, { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

function StatisticalAnalysisResult({ result }) {
  const [activeTab, setActiveTab] = useState('clustering')

  if (!result) return null

  const { clustering, correlation, acceleration, segmentComparison } = result

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab('clustering')}
            className={`py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'clustering'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            クラスタリング
          </button>
          <button
            onClick={() => setActiveTab('correlation')}
            className={`py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'correlation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            相関分析
          </button>
          <button
            onClick={() => setActiveTab('acceleration')}
            className={`py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'acceleration'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            加速度分析
          </button>
          <button
            onClick={() => setActiveTab('segment')}
            className={`py-4 px-6 border-b-2 font-medium text-sm ${
              activeTab === 'segment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            セグメント比較
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'clustering' && (
          <ClusteringView clustering={clustering} />
        )}
        {activeTab === 'correlation' && (
          <CorrelationView correlation={correlation} />
        )}
        {activeTab === 'acceleration' && (
          <AccelerationView acceleration={acceleration} />
        )}
        {activeTab === 'segment' && (
          <SegmentView segmentComparison={segmentComparison} />
        )}
      </div>
    </div>
  )
}

// クラスタリング表示
function ClusteringView({ clustering }) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  const chartData = clustering.clusters.map((cluster, idx) => ({
    name: cluster.name,
    value: cluster.size,
    avgChange: cluster.avgChangeRate
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div>
          <h3 className="text-lg font-semibold mb-4">クラスタ分布</h3>
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
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div>
          <h3 className="text-lg font-semibold mb-4">平均変動率</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: '変動率 (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="avgChange" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cluster Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4">クラスタ詳細</h3>
        <div className="space-y-4">
          {clustering.clusters.map((cluster, idx) => (
            <div key={cluster.id} className="border rounded-lg p-4" style={{ borderColor: COLORS[idx % COLORS.length] }}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-lg font-semibold" style={{ color: COLORS[idx % COLORS.length] }}>
                    {cluster.name}
                  </h4>
                  <p className="text-sm text-gray-600">{cluster.characteristics}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                    {cluster.avgChangeRate > 0 ? '+' : ''}{cluster.avgChangeRate}%
                  </div>
                  <div className="text-sm text-gray-600">{cluster.size}件</div>
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">主要キーワード:</h5>
                <div className="flex flex-wrap gap-2">
                  {cluster.topKeywords.slice(0, 15).map((kw, kidx) => (
                    <span
                      key={kidx}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                      title={kw.url}
                    >
                      {kw.query}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 相関分析表示
function CorrelationView({ correlation }) {
  return (
    <div className="space-y-6">
      {/* 正の相関 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-green-700">
          強い正の相関（一緒に上昇/下落）
        </h3>
        {correlation.positivePairs.length > 0 ? (
          <div className="space-y-3">
            {correlation.positivePairs.map((pair, idx) => (
              <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-green-800">「{pair.word1}」</span>
                    <span className="text-green-600">⇔</span>
                    <span className="font-medium text-green-800">「{pair.word2}」</span>
                  </div>
                  <span className="text-sm font-medium text-green-700">
                    相関: {pair.correlation}
                  </span>
                </div>
                <p className="text-sm text-green-700 mt-2">→ 関連ニーズが連動している可能性</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">強い正の相関は検出されませんでした</p>
        )}
      </div>

      {/* 負の相関 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-red-700">
          強い負の相関（逆方向に変動）
        </h3>
        {correlation.negativePairs.length > 0 ? (
          <div className="space-y-3">
            {correlation.negativePairs.map((pair, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-red-800">「{pair.word1}」</span>
                    <span className="text-red-600">⇄</span>
                    <span className="font-medium text-red-800">「{pair.word2}」</span>
                  </div>
                  <span className="text-sm font-medium text-red-700">
                    相関: {pair.correlation}
                  </span>
                </div>
                <p className="text-sm text-red-700 mt-2">→ 対照的なニーズで明暗が分かれている</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">強い負の相関は検出されませんでした</p>
        )}
      </div>
    </div>
  )
}

// 加速度分析表示
function AccelerationView({ acceleration }) {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>判定基準:</strong> 変動率の絶対値が {acceleration.threshold}% を超える急激な変動を検出
        </p>
      </div>

      {/* 急加速（上昇） */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center text-green-700">
          <TrendingUp className="w-5 h-5 mr-2" />
          急加速している上昇キーワード
        </h3>
        {acceleration.topAccelerating.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順位</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">変動率</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順位変化</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {acceleration.topAccelerating.slice(0, 30).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.query}</td>
                    <td className="px-6 py-4 text-sm font-medium text-green-600">
                      +{item.changeRate}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.pastPosition || '圏外'}位 → {item.currentPosition}位
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">急加速している上昇キーワードはありません</p>
        )}
      </div>

      {/* 急減速（下落） */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center text-red-700">
          <TrendingDown className="w-5 h-5 mr-2" />
          急減速している下落キーワード
        </h3>
        {acceleration.topDecelerating.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順位</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">変動率</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順位変化</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {acceleration.topDecelerating.slice(0, 30).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.query}</td>
                    <td className="px-6 py-4 text-sm font-medium text-red-600">
                      {item.changeRate}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.pastPosition}位 → {item.currentPosition || '圏外'}位
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">急減速している下落キーワードはありません</p>
        )}
      </div>
    </div>
  )
}

// セグメント比較表示
function SegmentView({ segmentComparison }) {
  const { brandVsNonBrand, questionType, queryLength } = segmentComparison

  return (
    <div className="space-y-6">
      {/* ブランド vs 非ブランド */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">ブランドクエリ vs 非ブランドクエリ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">ブランドクエリ</h4>
            <div className="text-2xl font-bold text-blue-600">
              {brandVsNonBrand.brand.avgChange > 0 ? '+' : ''}{brandVsNonBrand.brand.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={brandVsNonBrand.brand.count}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">非ブランドクエリ</h4>
            <div className="text-2xl font-bold text-gray-600">
              {brandVsNonBrand.nonBrand.avgChange > 0 ? '+' : ''}{brandVsNonBrand.nonBrand.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={brandVsNonBrand.nonBrand.count}</div>
          </div>
        </div>
        {brandVsNonBrand.significant && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 rounded p-2">
            ✓ 有意な差が認められます
          </div>
        )}
      </div>

      {/* 疑問詞含む vs 含まない */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">疑問詞を含むクエリ vs 含まないクエリ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">疑問詞含む</h4>
            <div className="text-2xl font-bold text-purple-600">
              {questionType.withQuestion.avgChange > 0 ? '+' : ''}{questionType.withQuestion.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={questionType.withQuestion.count}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">疑問詞なし</h4>
            <div className="text-2xl font-bold text-gray-600">
              {questionType.withoutQuestion.avgChange > 0 ? '+' : ''}{questionType.withoutQuestion.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={questionType.withoutQuestion.count}</div>
          </div>
        </div>
        {questionType.significant && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 rounded p-2">
            ✓ 有意な差が認められます
          </div>
        )}
      </div>

      {/* クエリ長別 */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">クエリ長別の変動傾向</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">短文 (1-2語)</h4>
            <div className="text-2xl font-bold text-green-600">
              {queryLength.short.avgChange > 0 ? '+' : ''}{queryLength.short.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={queryLength.short.count}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">中文 (3-4語)</h4>
            <div className="text-2xl font-bold text-yellow-600">
              {queryLength.medium.avgChange > 0 ? '+' : ''}{queryLength.medium.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={queryLength.medium.count}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">長文 (5語以上)</h4>
            <div className="text-2xl font-bold text-orange-600">
              {queryLength.long.avgChange > 0 ? '+' : ''}{queryLength.long.avgChange}%
            </div>
            <div className="text-sm text-gray-600 mt-1">n={queryLength.long.count}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticalAnalysisResult
