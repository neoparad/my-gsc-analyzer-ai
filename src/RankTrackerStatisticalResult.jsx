import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react'

function RankTrackerStatisticalResult({ data }) {
  if (!data) return null

  const { trendAnalysis, volatilityAnalysis, correlationAnalysis, predictionAnalysis } = data

  return (
    <div className="space-y-6">
      {/* トレンド分析 */}
      {trendAnalysis && trendAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            時系列トレンド分析
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">7日移動平均</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">14日移動平均</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">30日移動平均</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">トレンド</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">変化点</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trendAnalysis.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.query}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.movingAverages.ma7 !== null ? item.movingAverages.ma7.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.movingAverages.ma14 !== null ? item.movingAverages.ma14.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.movingAverages.ma30 !== null ? item.movingAverages.ma30.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.trend === 'improving' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.trend === 'improving' ? '改善' : '下降'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.changePoints.length}件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ボラティリティ分析 */}
      {volatilityAnalysis && volatilityAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            順位変動ボラティリティ分析
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">最も不安定なクエリ</p>
              <p className="text-lg font-bold text-purple-600">{volatilityAnalysis[0]?.query}</p>
              <p className="text-sm text-gray-500">変動指数: {volatilityAnalysis[0]?.volatilityIndex.toFixed(2)}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">平均ボラティリティ</p>
              <p className="text-lg font-bold text-blue-600">
                {(volatilityAnalysis.reduce((sum, v) => sum + v.volatilityIndex, 0) / volatilityAnalysis.length).toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">分析クエリ数</p>
              <p className="text-lg font-bold text-green-600">{volatilityAnalysis.length}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ボラティリティ指数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">平均速度</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">平均加速度</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {volatilityAnalysis.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.query}</td>
                    <td className="px-4 py-3 text-sm font-medium text-purple-600">{item.volatilityIndex.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.avgVelocity.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.avgAcceleration.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 相関分析 */}
      {correlationAnalysis && correlationAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            クエリ間相関分析
          </h3>
          <p className="text-sm text-gray-600 mb-4">似た順位変動パターンを示すクエリペア（相関係数0.7以上）</p>
          <div className="space-y-2">
            {correlationAnalysis.map((pair, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded flex items-center justify-between">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">{pair.query1}</span>
                  <span className="mx-2 text-gray-400">↔</span>
                  <span className="text-sm font-medium text-gray-900">{pair.query2}</span>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-bold ${
                  parseFloat(pair.correlation) > 0.8 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {pair.correlation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 予測分析 */}
      {predictionAnalysis && predictionAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            7日後順位予測
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">クエリ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">現在順位</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">予測順位</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">信頼区間</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">トレンド</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {predictionAnalysis.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.query}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.currentPosition.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{item.predicted7Days.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.confidenceIntervalLower.toFixed(1)} - {item.confidenceIntervalUpper.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.trend === 'improving' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.trend === 'improving' ? '改善傾向' : '下降傾向'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default RankTrackerStatisticalResult
