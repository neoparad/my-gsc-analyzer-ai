import React, { useState, useRef } from 'react'
import { Search, Loader, AlertCircle, HelpCircle, Copy, Check, List, FileText, Upload, Download } from 'lucide-react'

function FAQMaker() {
  const [keyword, setKeyword] = useState('')
  const [keywords, setKeywords] = useState('')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [batchResults, setBatchResults] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const fileInputRef = useRef(null)

  const handleAnalyze = async () => {
    if (!keyword.trim()) {
      setError('キーワードを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch('/api/faq-maker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'FAQ生成に失敗しました')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchAnalyze = async () => {
    const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k)

    if (keywordList.length === 0) {
      setError('キーワードを入力してください')
      return
    }

    if (keywordList.length > 50) {
      setError('一度に処理できるキーワードは最大50個までです')
      return
    }

    setLoading(true)
    setError('')
    setBatchResults(null)

    try {
      const response = await fetch('/api/faq-maker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordList,
          isBatch: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'FAQ生成に失敗しました')
      }

      const data = await response.json()
      setBatchResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split('\n')
      const keywordList = lines
        .map(line => line.split(',')[0].trim())
        .filter(k => k)

      setKeywords(keywordList.join('\n'))
    }
    reader.readAsText(file)
  }

  const downloadCSV = () => {
    if (!batchResults || !batchResults.results) return

    let csvContent = '\uFEFF' // UTF-8 BOM for Excel
    csvContent += 'クエリ,質問,回答\n'

    batchResults.results.forEach(result => {
      if (result.error) {
        csvContent += `"${result.keyword}","エラー","${result.error}"\n`
      } else {
        result.questions.forEach(q => {
          const query = `"${result.keyword.replace(/"/g, '""')}"`
          const question = `"${q.question.replace(/"/g, '""')}"`
          const answer = `"${q.answer.replace(/"/g, '""')}"`
          csvContent += `${query},${question},${answer}\n`
        })
      }
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `faq_batch_${new Date().toISOString().slice(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const copyAllFAQ = async () => {
    if (!results || !results.questions) return

    const allText = results.questions
      .map((item, index) => `Q${index + 1}: ${item.question}\n\nA: ${item.answer}\n\n`)
      .join('\n')

    await copyToClipboard(allText, 'all')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ❓ よくある質問メーカー
        </h1>
        <p className="text-gray-600 mb-8">
          SEOキーワードから関連する質問を自動生成
        </p>

        {/* 入力フォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">キーワード分析</h2>
            <button
              onClick={() => {
                setIsBatchMode(!isBatchMode)
                setError('')
                setResults(null)
                setBatchResults(null)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition-colors ${
                isBatchMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <List className="w-5 h-5" />
              一括処理モード
            </button>
          </div>

          {!isBatchMode ? (
            // 通常モード
            <>
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                  className="flex-1 p-3 border border-gray-300 rounded-md"
                  placeholder="例: 沖縄 レンタカー"
                  disabled={loading}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !keyword.trim()}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      分析開始
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            // 一括処理モード
            <>
              <div className="mb-4">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    CSVアップロード
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <span className="text-sm text-gray-500 self-center">
                    ※最大50キーワードまで
                  </span>
                </div>
                <textarea
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="キーワードを1行に1つずつ入力してください&#10;例:&#10;沖縄 レンタカー&#10;東京 ホテル&#10;京都 観光"
                  rows={8}
                  disabled={loading}
                />
              </div>
              <button
                onClick={handleBatchAnalyze}
                disabled={loading || !keywords.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 font-semibold"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    一括分析中... （数分かかる場合があります）
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    一括分析開始
                  </>
                )}
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {/* 分析結果 */}
        {results && results.questions && (
          <div className="space-y-6">
            {/* メタデータ */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    分析結果: {results.keyword}
                  </h2>
                </div>
                <button
                  onClick={copyAllFAQ}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {copiedIndex === 'all' ? (
                    <>
                      <Check className="w-4 h-4" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      全てコピー
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 質問と回答リスト */}
            {results.questions.map((item, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <HelpCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="text-lg font-bold text-gray-800">
                        Q{index + 1}: {item.question}
                      </h3>
                      <button
                        onClick={() => copyToClipboard(`Q: ${item.question}\n\nA: ${item.answer}`, index)}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="text-sm font-medium text-gray-700 mb-2">回答</div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {item.answer}
                  </p>

                  {/* 表データ */}
                  {item.has_table && item.table && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                        <thead className="bg-gray-100">
                          <tr>
                            {item.table.headers.map((header, idx) => (
                              <th
                                key={idx}
                                className="px-4 py-2 text-left text-xs font-medium text-gray-700 border-r border-gray-300 last:border-r-0"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {item.table.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-gray-50">
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300 last:border-r-0"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  文字数: {item.answer.length}文字
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 一括処理結果 */}
        {batchResults && batchResults.results && (
          <div className="space-y-6">
            {/* サマリー */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">
                    一括処理結果
                  </h2>
                  <div className="text-sm text-gray-600">
                    処理件数: {batchResults.total_keywords}件 |
                    成功: {batchResults.successful}件 |
                    失敗: {batchResults.failed}件
                  </div>
                </div>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  CSVダウンロード
                </button>
              </div>
            </div>

            {/* 各キーワードの結果 */}
            {batchResults.results.map((result, resultIndex) => (
              <div key={resultIndex} className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {resultIndex + 1}. {result.keyword}
                </h3>

                {result.error ? (
                  <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    エラー: {result.error}
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-gray-500 mb-4">
                      {result.metadata.total_questions}件の質問を生成
                    </div>
                    <div className="space-y-4">
                      {result.questions.map((item, qIndex) => (
                        <div key={qIndex} className="border-l-4 border-blue-500 pl-4">
                          <div className="font-semibold text-gray-800 mb-1">
                            Q: {item.question}
                          </div>
                          <div className="text-sm text-gray-700">
                            A: {item.answer}
                          </div>
                          {item.has_table && item.table && (
                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full text-xs border border-gray-300">
                                <thead className="bg-gray-100">
                                  <tr>
                                    {item.table.headers.map((header, idx) => (
                                      <th key={idx} className="px-2 py-1 border-r border-gray-300 last:border-r-0">
                                        {header}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.table.rows.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                      {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-2 py-1 border-r border-gray-300 last:border-r-0">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ローディング中 */}
        {loading && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">
              {isBatchMode
                ? 'AI分析中... 複数キーワードの処理には数分かかる場合があります'
                : 'AI分析中... 質問の生成と回答作成には1～2分かかります'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FAQMaker
