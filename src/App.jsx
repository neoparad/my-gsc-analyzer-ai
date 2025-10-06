import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './Sidebar'
import ChatAI from './ChatAI'
import ComparisonPage from './ComparisonPage'
import QueryRankShare from './QueryRankShare'
import RankTracker from './RankTracker'
import DirectoryAnalysis from './DirectoryAnalysis'
import BrandAnalysis from './BrandAnalysis'
import PageSpeedAnalysisV2 from './PageSpeedAnalysisV2'
import Login from './Login'
import ProtectedRoute from './ProtectedRoute'

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
                  <Route path="/comparison" element={<ComparisonPage />} />
                  <Route path="/query-rank-share" element={<QueryRankShare />} />
                  <Route path="/rank-tracker" element={<RankTracker />} />
                  <Route path="/directory-analysis" element={<DirectoryAnalysis />} />
                  <Route path="/brand-analysis" element={<BrandAnalysis />} />
                  <Route path="/pagespeed-analysis" element={<PageSpeedAnalysisV2 />} />
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
