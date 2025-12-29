import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './Sidebar'
import ChatAI from './ChatAI'
import ComparisonPage from './ComparisonPage'
import RankTracker from './RankTracker'
import PageTracker from './PageTracker'
import DirectoryQueryAnalysis from './DirectoryQueryAnalysis'
import BrandAnalysis from './BrandAnalysis'
import PageSpeedAnalysisV2 from './PageSpeedAnalysisV2'
import AdsCannibalizationAnalysis from './AdsCannibalizationAnalysis'
import IndexAnalysis from './IndexAnalysis'
import FAQMaker from './FAQMaker'
import CSSJSAnalysis from './CSSJSAnalysis'
import CitationAnalysis from './CitationAnalysis'
import Login from './Login'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import UserManagement from './UserManagement'
import UserProfile from './UserProfile'
import UserSitesManagement from './UserSitesManagement'
import GscDataSyncDashboard from './GscDataSyncDashboard'
import Dashboard from './Dashboard'
import InternalLinkAnalysis from './InternalLinkAnalysis'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="flex h-screen">
              <Sidebar />
              <div className="flex-1 overflow-auto">
                <Routes>
                  <Route path="/" element={<ChatAI />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/comparison" element={<ComparisonPage />} />
                  <Route path="/rank-tracker" element={<RankTracker />} />
                  <Route path="/page-tracker" element={<PageTracker />} />
                  <Route path="/directory-query-analysis" element={<DirectoryQueryAnalysis />} />
                  <Route path="/brand-analysis" element={<BrandAnalysis />} />
                  <Route path="/pagespeed-analysis" element={<PageSpeedAnalysisV2 />} />
                  <Route path="/cssjs-analysis" element={<CSSJSAnalysis />} />
                  <Route path="/ads-cannibalization" element={<AdsCannibalizationAnalysis />} />
                  <Route path="/index-analysis" element={<IndexAnalysis />} />
                  <Route path="/internal-link-analysis" element={<InternalLinkAnalysis />} />
                  <Route path="/faq-maker" element={<FAQMaker />} />
                  <Route path="/citation-analysis" element={<CitationAnalysis />} />
                  <Route path="/profile" element={<UserProfile />} />
                  <Route path="/sites" element={<UserSitesManagement />} />
                  <Route 
                    path="/admin/users" 
                    element={
                      <AdminRoute>
                        <UserManagement />
                      </AdminRoute>
                    } 
                  />
                  <Route 
                    path="/admin/gsc-data-sync" 
                    element={
                      <AdminRoute>
                        <GscDataSyncDashboard />
                      </AdminRoute>
                    } 
                  />
                </Routes>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
