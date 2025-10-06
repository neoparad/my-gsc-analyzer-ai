import React, { useState, useEffect } from 'react'
import { X, Info } from 'lucide-react'

function AnalysisSettingModal({ isOpen, onClose, onSave, keywords }) {
  const [brandKeywords, setBrandKeywords] = useState('')
  const [autoExcludeEnabled, setAutoExcludeEnabled] = useState(true)
  const [autoExcludePercent, setAutoExcludePercent] = useState(5)
  const [detectedWords, setDetectedWords] = useState([])
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [manualKeywords, setManualKeywords] = useState([])
  const [manualInput, setManualInput] = useState('')

  // ローカルストレージから設定を読み込み
  useEffect(() => {
    const savedSettings = localStorage.getItem('analysisSettings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setBrandKeywords(settings.brandKeywords?.join(', ') || '')
      setAutoExcludeEnabled(settings.autoExcludeEnabled ?? true)
      setAutoExcludePercent(settings.autoExcludePercent || 5)
      setManualKeywords(settings.manualKeywords || [])
    }
  }, [])

  // キーワードから単語を抽出して頻度分析
  useEffect(() => {
    if (!keywords || keywords.length === 0) return

    const wordFreq = new Map()
    const totalQueries = keywords.length

    keywords.forEach(kw => {
      // 簡易的な単語分割（スペース、記号で分割）
      const words = kw.query
        .toLowerCase()
        .split(/[\s\u3000・、。！？]+/)
        .filter(w => w.length > 1) // 1文字除外

      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
      })
    })

    // 出現頻度でソート
    const sorted = Array.from(wordFreq.entries())
      .map(([word, count]) => ({
        word,
        count,
        percentage: Math.round((count / totalQueries) * 100)
      }))
      .sort((a, b) => b.count - a.count)

    // 上位N%を抽出
    const threshold = Math.ceil(sorted.length * (autoExcludePercent / 100))
    const topWords = sorted.slice(0, Math.max(threshold, 5))

    setDetectedWords(topWords)

    // デフォルトで全て選択
    setSelectedWords(new Set(topWords.map(w => w.word)))
  }, [keywords, autoExcludePercent])

  const handleSave = () => {
    const brandKeywordsArray = brandKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0)

    const businessKeywords = autoExcludeEnabled
      ? [...Array.from(selectedWords), ...manualKeywords]
      : manualKeywords

    const settings = {
      brandKeywords: brandKeywordsArray,
      businessKeywords,
      autoExcludeEnabled,
      autoExcludePercent,
      manualKeywords
    }

    localStorage.setItem('analysisSettings', JSON.stringify(settings))
    onSave(settings)
    onClose()
  }

  const toggleWord = (word) => {
    const newSet = new Set(selectedWords)
    if (newSet.has(word)) {
      newSet.delete(word)
    } else {
      newSet.add(word)
    }
    setSelectedWords(newSet)
  }

  const addManualKeyword = () => {
    if (manualInput.trim() && !manualKeywords.includes(manualInput.trim())) {
      setManualKeywords([...manualKeywords, manualInput.trim()])
      setManualInput('')
    }
  }

  const removeManualKeyword = (keyword) => {
    setManualKeywords(manualKeywords.filter(k => k !== keyword))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">分析設定</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* ブランドキーワード設定 */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">ブランドキーワード設定</h3>
            <p className="text-sm text-gray-600 mb-3">
              あなたのブランド名・サービス名を入力してください（カンマ区切り）
            </p>
            <input
              type="text"
              value={brandKeywords}
              onChange={(e) => setBrandKeywords(e.target.value)}
              placeholder="会社名, サービス名, 略称, 英語表記"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex items-start text-sm text-gray-500">
              <Info className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
              <span>これらを含むクエリを「ブランドクエリ」として分類します</span>
            </div>
          </div>

          {/* 事業キーワード設定 */}
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">事業キーワード設定（分析時に除外）</h3>

            {/* 自動検出 */}
            <div className="mb-4">
              <label className="flex items-center mb-3">
                <input
                  type="checkbox"
                  checked={autoExcludeEnabled}
                  onChange={(e) => setAutoExcludeEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  出現頻度上位のキーワードを自動除外
                </span>
              </label>

              {autoExcludeEnabled && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-700">上位</span>
                    <select
                      value={autoExcludePercent}
                      onChange={(e) => setAutoExcludePercent(Number(e.target.value))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                    </select>
                    <span className="text-sm text-gray-700">% を除外</span>
                  </div>

                  {/* 除外候補プレビュー */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">📊 除外候補プレビュー:</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {detectedWords.map((item) => (
                        <label key={item.word} className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={selectedWords.has(item.word)}
                            onChange={() => toggleWord(item.word)}
                            className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-gray-700">
                            {item.word} ({item.percentage}% - {item.count}回出現)
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">※チェックを外すと除外されません</p>
                  </div>
                </>
              )}
            </div>

            {/* 手動追加 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">または手動で追加:</h4>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addManualKeyword()}
                  placeholder="キーワードを入力"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={addManualKeyword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  追加
                </button>
              </div>

              {/* 現在の除外リスト */}
              {manualKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">現在の除外リスト:</h4>
                  <div className="flex flex-wrap gap-2">
                    {manualKeywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => removeManualKeyword(keyword)}
                          className="ml-2 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start text-sm text-gray-500">
              <Info className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
              <span>これらのキーワードは分析時にノイズとして除外されます</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnalysisSettingModal
