import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // フォーム状態
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    displayName: '',
    role: 'user',
    sites: [{ siteUrl: '', displayName: '', accountId: 'link-th' }]
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('ユーザー一覧の取得に失敗しました')
      }

      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')

    try {
      // サイト情報を整理（空のサイトURLは除外）
      const validSites = formData.sites.filter(site => site.siteUrl.trim() !== '')

      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          sites: validSites.length > 0 ? validSites : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'ユーザーの作成に失敗しました'
        const details = data.details ? `\n詳細: ${data.details}` : ''
        const hint = data.hint ? `\nヒント: ${data.hint}` : ''
        throw new Error(`${errorMessage}${details}${hint}`)
      }

      setShowCreateForm(false)
      setFormData({ 
        username: '', 
        password: '', 
        email: '', 
        displayName: '', 
        role: 'user',
        sites: [{ siteUrl: '', displayName: '', accountId: 'link-th' }]
      })
      
      if (data.sites && data.sites.length > 0) {
        setSuccess(`ユーザー「${data.username}」を作成し、${data.sites.length}件のサイトを登録しました`)
      } else {
        setSuccess(`ユーザー「${data.username}」を作成しました`)
      }
      
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdateUser = async (userId, updateData) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ユーザーの更新に失敗しました')
      }

      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('このユーザーを削除してもよろしいですか？')) {
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('ユーザーの削除に失敗しました')
      }

      fetchUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleUserActive = async (userId, currentStatus) => {
    await handleUpdateUser(userId, { isActive: !currentStatus })
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
        <h1 className="text-3xl font-bold text-gray-800">ユーザー管理</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showCreateForm ? 'キャンセル' : '新規ユーザー作成'}
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

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">新規ユーザー作成</h2>
          <form onSubmit={handleCreateUser} className="space-y-6">
            {/* ユーザー情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">ユーザー情報</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ユーザー名 *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ロール
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="user">一般ユーザー</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>

            {/* サイト登録 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-800">アクセス可能なサイト</h3>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      sites: [...formData.sites, { siteUrl: '', displayName: '', accountId: 'link-th' }]
                    })
                  }}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                >
                  + サイトを追加
                </button>
              </div>

              {formData.sites.map((site, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-md space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">サイト {index + 1}</span>
                    {formData.sites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSites = formData.sites.filter((_, i) => i !== index)
                          setFormData({ ...formData, sites: newSites })
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サイトURL *
                    </label>
                    <input
                      type="text"
                      value={site.siteUrl}
                      onChange={(e) => {
                        const newSites = [...formData.sites]
                        newSites[index].siteUrl = e.target.value
                        setFormData({ ...formData, sites: newSites })
                      }}
                      placeholder="https://example.com/ または sc-domain:example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required={index === 0}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      表示名
                    </label>
                    <input
                      type="text"
                      value={site.displayName}
                      onChange={(e) => {
                        const newSites = [...formData.sites]
                        newSites[index].displayName = e.target.value
                        setFormData({ ...formData, sites: newSites })
                      }}
                      placeholder="サイトの表示名（オプション）"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サービスアカウント
                    </label>
                    <select
                      value={site.accountId}
                      onChange={(e) => {
                        const newSites = [...formData.sites]
                        newSites[index].accountId = e.target.value
                        setFormData({ ...formData, sites: newSites })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="link-th">link-th</option>
                      <option value="tabirai">tabirai</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      サービスアカウントは同じでも、ユーザーごとに異なるサイトを登録できます
                    </p>
                  </div>
                </div>
              ))}

              {formData.sites.length === 0 && (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md">
                  サイトは後から追加することもできます
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                ユーザーを作成
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setFormData({ 
                    username: '', 
                    password: '', 
                    email: '', 
                    displayName: '', 
                    role: 'user',
                    sites: [{ siteUrl: '', displayName: '', accountId: 'link-th' }]
                  })
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">メール</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ロール</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成日</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => toggleUserActive(user.id, user.isActive)}
                    className={`px-2 py-1 rounded-full text-xs ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.isActive ? '有効' : '無効'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:text-red-900 mr-3"
                    >
                      削除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

