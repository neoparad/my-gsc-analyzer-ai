import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, BarChart3, TrendingUp, Activity, Zap, Target, HelpCircle, Search, LogOut, Code, Link2, FileText, Layers } from 'lucide-react'
import { useAuth } from './AuthContext'

function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const menuItems = [
    { path: '/', icon: MessageSquare, label: 'サーチコンソールAI' },
    { path: '/rank-tracker', icon: TrendingUp, label: 'GSCランクトラッカー' },
    { path: '/page-tracker', icon: FileText, label: 'GSCページトラッカー' },
    { path: '/comparison', icon: BarChart3, label: '比較分析' },
    { path: '/directory-query-analysis', icon: Layers, label: 'ディレクトリ×順位シェア' },
    { path: '/brand-analysis', icon: Activity, label: 'ブランドキーワード分析' },
    { path: '/citation-analysis', icon: Link2, label: 'サイテーション分析' },
    { path: '/ads-cannibalization', icon: Target, label: 'SEO VS 広告比較' },
    { path: '/pagespeed-analysis', icon: Zap, label: 'ページスピード分析AI' },
    { path: '/cssjs-analysis', icon: Code, label: 'CSS/JavaScript解析' },
    { path: '/index-analysis', icon: Search, label: 'インデックス分析' },
    { path: '/faq-maker', icon: HelpCircle, label: 'よくある質問メーカー' }
  ]

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">AISEO Analyze</h1>
        {user && <p className="text-xs text-gray-400 mt-2">{user.username}</p>}
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-gray-300 hover:bg-gray-800 hover:text-white transition-colors mt-4"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">ログアウト</span>
        </button>
        <p className="text-xs text-gray-400 mt-2 px-3">Developed by LINKTH</p>
      </nav>
    </div>
  )
}

export default Sidebar
