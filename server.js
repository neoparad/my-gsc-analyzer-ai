import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// API handlers
import analyzeHandler from './api/analyze.js'
import chatHandler from './api/chat.js'
import createSheetHandler from './api/create_sheet.js'
import detailedAnalysisHandler from './api/detailed-analysis.js'
import aiAnalysisHandler from './api/ai-analysis.js'
import rankTrackerHandler from './api/rank-tracker.js'
import rankTrackerAiHandler from './api/rank-tracker-ai.js'
import rankTrackerQueriesHandler from './api/rank-tracker-queries.js'
import directoryAnalysisHandler from './api/directory-analysis.js'
import queryRankShareHandler from './api/query-rank-share.js'
import analyzeCompetitiveHandler from './api/analyze-competitive.js'
import deepAnalysisHandler from './api/deep-analysis.js'
import adsCannibalizationHandler from './api/ads-cannibalization.js'
import fetchCampaignsHandler from './api/fetch-campaigns.js'
import faqMakerHandler from './api/faq-maker.js'
import loginHandler from './api/login.js'

dotenv.config()

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Helper to wrap Vercel handlers for Express
const wrapHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('Handler error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: error.message })
    }
  }
}

// API routes
app.post('/api/login', wrapHandler(loginHandler))
app.post('/api/analyze', wrapHandler(analyzeHandler))
app.post('/api/chat', wrapHandler(chatHandler))
app.post('/api/create_sheet', wrapHandler(createSheetHandler))
app.post('/api/detailed-analysis', wrapHandler(detailedAnalysisHandler))
app.post('/api/ai-analysis', wrapHandler(aiAnalysisHandler))
app.post('/api/rank-tracker', wrapHandler(rankTrackerHandler))
app.post('/api/rank-tracker-ai', wrapHandler(rankTrackerAiHandler))
app.get('/api/rank-tracker-queries', wrapHandler(rankTrackerQueriesHandler))
app.post('/api/rank-tracker-queries', wrapHandler(rankTrackerQueriesHandler))
app.delete('/api/rank-tracker-queries', wrapHandler(rankTrackerQueriesHandler))
app.post('/api/directory-analysis', wrapHandler(directoryAnalysisHandler))
app.post('/api/query-rank-share', wrapHandler(queryRankShareHandler))
app.post('/api/analyze-competitive', wrapHandler(analyzeCompetitiveHandler))
app.post('/api/deep-analysis', wrapHandler(deepAnalysisHandler))
app.post('/api/ads-cannibalization', wrapHandler(adsCannibalizationHandler))
app.post('/api/fetch-campaigns', wrapHandler(fetchCampaignsHandler))
app.post('/api/faq-maker', wrapHandler(faqMakerHandler))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`\n✅ API Server running on http://localhost:${PORT}`)
  console.log(`📊 Available endpoints:`)
  console.log(`   POST /api/login`)
  console.log(`   POST /api/analyze`)
  console.log(`   POST /api/chat`)
  console.log(`   POST /api/create_sheet`)
  console.log(`   POST /api/detailed-analysis`)
  console.log(`   POST /api/ai-analysis`)
  console.log(`   POST /api/rank-tracker`)
  console.log(`   POST /api/rank-tracker-ai`)
  console.log(`   POST /api/directory-analysis`)
  console.log(`   POST /api/query-rank-share`)
  console.log(`   POST /api/analyze-competitive`)
  console.log(`   POST /api/deep-analysis`)
  console.log(`   POST /api/ads-cannibalization`)
  console.log(`   GET  /api/health\n`)
})
