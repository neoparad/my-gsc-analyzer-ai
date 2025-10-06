import { google } from 'googleapis'
import { checkBasicAuth } from './_auth.js'

export default async function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { data, title } = req.body

    // 環境変数から認証情報を取得
    let credentials
    if (process.env.GOOGLE_CREDENTIALS) {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    } else {
      // ローカル開発環境用
      const fs = await import('fs')
      const path = await import('path')
      const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
      credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    }

    // Google API認証
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // スプレッドシートを作成
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title || 'Search Console Analysis'
        },
        sheets: [{
          properties: {
            title: 'データ'
          }
        }]
      }
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId

    // データを書き込み
    if (data && data.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'データ!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: data
        }
      })
    }

    // レスポンスを返す
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    res.status(200).json({
      url: spreadsheetUrl,
      spreadsheet_id: spreadsheetId
    })

  } catch (error) {
    console.error('Spreadsheet API Error:', error)
    res.status(500).json({ error: error.message })
  }
}
