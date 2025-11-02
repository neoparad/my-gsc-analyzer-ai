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
                  <Route path="/rank-tracker" element={<RankTracker />} />
                  <Route path="/page-tracker" element={<PageTracker />} />
                  <Route path="/directory-query-analysis" element={<DirectoryQueryAnalysis />} />
                  <Route path="/brand-analysis" element={<BrandAnalysis />} />
                  <Route path="/pagespeed-analysis" element={<PageSpeedAnalysisV2 />} />
                  <Route path="/cssjs-analysis" element={<CSSJSAnalysis />} />
                  <Route path="/ads-cannibalization" element={<AdsCannibalizationAnalysis />} />
                  <Route path="/index-analysis" element={<IndexAnalysis />} />
                  <Route path="/faq-maker" element={<FAQMaker />} />
                  <Route path="/citation-analysis" element={<CitationAnalysis />} />
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
