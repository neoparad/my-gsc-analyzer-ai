import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function UserProfile() {
  const { user: currentUser, login } = useAuth()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('プロフィール情報の取得に失敗しました')
      }

      const data = await response.json()
      setUser(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('新しいパスワードが一致しません')
      return
    }

    if (passwordData.newPassword.length < 8) {
      setError('パスワードは8文字以上である必要があります')
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/users/${user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'パスワードの変更に失敗しました')
      }

      setSuccess('パスワードを変更しました')
      setShowPasswordForm(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
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

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-red-600">ユーザー情報を取得できませんでした</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">プロフィール</h1>

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

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">基本情報</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">ユーザー名</dt>
            <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">表示名</dt>
            <dd className="mt-1 text-sm text-gray-900">{user.displayName || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
            <dd className="mt-1 text-sm text-gray-900">{user.email || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">ロール</dt>
            <dd className="mt-1">
              <span className={`px-2 py-1 rounded-full text-xs ${
                user.role === 'admin' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {user.role === 'admin' ? '管理者' : '一般ユーザー'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">アカウント作成日</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(user.createdAt).toLocaleString('ja-JP')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">最終ログイン</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {user.lastLoginAt 
                ? new Date(user.lastLoginAt).toLocaleString('ja-JP')
                : '-'
              }
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">パスワード変更</h2>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="text-blue-600 hover:text-blue-800"
          >
            {showPasswordForm ? 'キャンセル' : 'パスワードを変更'}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現在のパスワード *
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード *
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                minLength={8}
              />
              <p className="mt-1 text-xs text-gray-500">8文字以上である必要があります</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                新しいパスワード（確認） *
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              パスワードを変更
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

