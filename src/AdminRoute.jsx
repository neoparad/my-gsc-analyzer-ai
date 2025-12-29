import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * 管理者専用ルート保護コンポーネント
 * 管理者のみアクセス可能なページを保護します
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">アクセス権限がありません</h1>
          <p className="text-gray-600 mb-4">このページにアクセスするには管理者権限が必要です。</p>
          <a href="/" className="text-blue-600 hover:underline">ホームに戻る</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

