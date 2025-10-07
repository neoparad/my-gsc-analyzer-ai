import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, BarChart3, PieChart, TrendingUp, FolderKanban, Activity, Zap, Target, LogOut } from 'lucide-react'
import { useAuth } from './AuthContext'

function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const menuItems = [
    { path: '/', icon: MessageSquare, label: 'サーチコンソールAI' },
    { path: '/rank-tracker', icon: TrendingUp, label: 'GSCランクトラッカー' },
    { path: '/comparison', icon: BarChart3, label: '比較分析' },
    { path: '/ads-cannibalization', icon: Target, label: '広告カニバリゼーション分析' },
    { path: '/directory-analysis', icon: FolderKanban, label: 'ディレクトリアクセス分析' },
    { path: '/query-rank-share', icon: PieChart, label: 'クエリ順位シェア分析' },
    { path: '/brand-analysis', icon: Activity, label: 'ブランドキーワード統計分析' },
    { path: '/pagespeed-analysis', icon: Zap, label: 'ページスピード分析AI' }
  ]

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">GSC AI Tool</h1>
        {user && <p className="text-xs text-gray-400 mt-2">{user.username}</p>}
      </div>
      <nav className="flex-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-700 space-y-2">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>ログアウト</span>
        </button>
        <p className="text-xs text-gray-400">Powered by Gemini AI</p>
      </div>
    </div>
  )
}

export default Sidebar
