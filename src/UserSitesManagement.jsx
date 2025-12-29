import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function UserSitesManagement() {
  const { user: currentUser } = useAuth()
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const [formData, setFormData] = useState({
    siteUrl: '',
    displayName: '',
    accountId: 'link-th'
  })

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/user-sites', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('サイト一覧の取得に失敗しました')
      }

      const data = await response.json()
      setSites(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSite = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/user-sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'サイトの追加に失敗しました')
      }

      setSuccess('サイトを追加しました')
      setShowAddForm(false)
      setFormData({ siteUrl: '', displayName: '', accountId: 'link-th' })
      fetchSites()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteSite = async (siteId) => {
    if (!confirm('このサイトを削除してもよろしいですか？')) {
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/user-sites/${siteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('サイトの削除に失敗しました')
      }

      setSuccess('サイトを削除しました')
      fetchSites()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (siteId, currentStatus) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/user-sites/${siteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (!response.ok) {
        throw new Error('サイトの更新に失敗しました')
      }

      fetchSites()
    } catch (err) {
      setError(err.message)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">サイト管理</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'キャンセル' : 'サイトを追加'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md mb-4">
          {success}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">新規サイト追加</h2>
          <form onSubmit={handleAddSite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                サイトURL *
              </label>
              <input
                type="text"
                value={formData.siteUrl}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                placeholder="https://example.com/ または sc-domain:example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                表示名
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="サイトの表示名（オプション）"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            {currentUser?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サービスアカウント
                </label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="link-th">link-th</option>
                  <option value="tabirai">tabirai</option>
                </select>
              </div>
            )}
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              追加
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {sites.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            登録されているサイトがありません。サイトを追加してください。
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">サイトURL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">表示名</th>
                {currentUser?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">サービスアカウント</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成日</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sites.map((site) => (
                <tr key={site.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {site.site_url}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.display_name || '-'}
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        site.account_id === 'tabirai'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {site.account_id === 'tabirai' ? 'tabirai' : 'link-th'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleToggleActive(site.id, site.is_active)}
                      className={`px-2 py-1 rounded-full text-xs ${
                        site.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {site.is_active ? '有効' : '無効'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(site.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {currentUser?.role === 'admin' || site.user_id === currentUser?.id ? (
                      <button
                        onClick={() => handleDeleteSite(site.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

