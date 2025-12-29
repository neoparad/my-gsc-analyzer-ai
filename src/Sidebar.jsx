import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, BarChart3, TrendingUp, Activity, Zap, Target, HelpCircle, Search, LogOut, Code, Link2, FileText, Layers, Building2, User, Users, Database, LayoutDashboard } from 'lucide-react'
import { useAuth } from './AuthContext'
import { useAccount } from './AccountContext'

function Sidebar() {
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()
  const { accountId, selectAccount, availableAccounts } = useAccount()

  const menuItems = [
    { path: '/', icon: MessageSquare, label: 'サーチコンソールAI' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'ダッシュボード' },
    { path: '/rank-tracker', icon: TrendingUp, label: 'GSCランクトラッカー' },
    { path: '/page-tracker', icon: FileText, label: 'GSCページトラッカー' },
    { path: '/comparison', icon: BarChart3, label: '比較分析' },
    { path: '/directory-query-analysis', icon: Layers, label: 'ディレクトリ×順位シェア' },
    // 一時的にメニューから非表示（将来使用する可能性あり）
    // { path: '/brand-analysis', icon: Activity, label: 'ブランドキーワード分析' },
    // { path: '/citation-analysis', icon: Link2, label: 'サイテーション分析' },
    // { path: '/ads-cannibalization', icon: Target, label: 'SEO VS 広告比較' },
    { path: '/pagespeed-analysis', icon: Zap, label: 'ページスピード分析AI' },
    { path: '/cssjs-analysis', icon: Code, label: 'CSS/JavaScript解析' },
    { path: '/index-analysis', icon: Search, label: 'インデックス分析' },
    { path: '/internal-link-analysis', icon: Link2, label: '内部リンク構造分析' },
    { path: '/faq-maker', icon: HelpCircle, label: 'よくある質問メーカー' }
  ]

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">AISEO Analyze</h1>
        {user && <p className="text-xs text-gray-400 mt-2">{user.username}</p>}

        {/* サービスアカウント選択（管理者のみ表示） */}
        {isAdmin && (
          <div className="mt-3">
            <label className="flex items-center gap-1 text-xs text-gray-400 mb-1">
              <Building2 className="w-3 h-3" />
              アカウント
            </label>
            <select
              value={accountId}
              onChange={(e) => selectAccount(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm px-2 py-1.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
        )}
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
        
        {/* ユーザー関連メニュー */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <Link
            to="/profile"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
              location.pathname === '/profile'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-sm">プロフィール</span>
          </Link>
          <Link
            to="/sites"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
              location.pathname === '/sites'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span className="text-sm">サイト管理</span>
          </Link>
          {user?.role === 'admin' && (
            <>
              <Link
                to="/admin/users"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  location.pathname === '/admin/users'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm">ユーザー管理</span>
              </Link>
              <Link
                to="/admin/gsc-data-sync"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  location.pathname === '/admin/gsc-data-sync'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="text-sm">GSCデータ同期</span>
              </Link>
            </>
          )}
        </div>
        
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
