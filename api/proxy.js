import { checkBasicAuth } from './_auth.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function handler(req, res) {
  // OPTIONSリクエストは認証不要
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(200).end()
    return
  }

  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  try {
    // リクエストされたパスを取得（クエリパラメータを除去）
    let requestPath = req.url.split('?')[0]
    if (requestPath === '/' || requestPath === '') {
      requestPath = '/index.html'
    }

    // 静的ファイルのパスを構築
    const distPath = path.join(__dirname, '..', 'dist')

    // distフォルダが存在しない場合（開発中）は404を返す
    if (!fs.existsSync(distPath)) {
      res.status(404).json({
        error: 'Not found in production mode. Use Vite dev server for development.',
        path: requestPath
      })
      return
    }

    const filePath = path.join(distPath, requestPath.replace(/^\//, ''))

    // ファイルが存在するか確認
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPAの場合、存在しないパスはindex.htmlを返す
      const indexPath = path.join(distPath, 'index.html')
      if (!fs.existsSync(indexPath)) {
        res.status(404).json({ error: 'Index file not found' })
        return
      }
      const html = fs.readFileSync(indexPath, 'utf-8')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.status(200).send(html)
      return
    }

    // ファイルを読み込む
    const fileContent = fs.readFileSync(filePath)

    // Content-Typeを設定
    const ext = path.extname(filePath).toLowerCase()
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    }

    const contentType = contentTypes[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.status(200).send(fileContent)

  } catch (error) {
    console.error('Error serving file:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}
