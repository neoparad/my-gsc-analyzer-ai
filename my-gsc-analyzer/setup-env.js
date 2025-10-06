import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const credentialsPath = path.join(process.cwd(), 'credentials', 'tabirai-seo-pj-58a84b33b54a.json')
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))

const envVars = [
  ['GOOGLE_TYPE', credentials.type],
  ['GOOGLE_PROJECT_ID', credentials.project_id],
  ['GOOGLE_PRIVATE_KEY_ID', credentials.private_key_id],
  ['GOOGLE_PRIVATE_KEY', credentials.private_key],
  ['GOOGLE_CLIENT_EMAIL', credentials.client_email],
  ['GOOGLE_CLIENT_ID', credentials.client_id],
  ['GOOGLE_AUTH_URI', credentials.auth_uri],
  ['GOOGLE_TOKEN_URI', credentials.token_uri],
  ['GOOGLE_AUTH_PROVIDER_X509_CERT_URL', credentials.auth_provider_x509_cert_url],
  ['GOOGLE_CLIENT_X509_CERT_URL', credentials.client_x509_cert_url]
]

console.log('設定する環境変数:')
envVars.forEach(([key, value]) => {
  console.log(`${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`)
})

console.log('\nVercelコマンドを手動で実行してください:')
envVars.forEach(([key, value]) => {
  console.log(`npx vercel env add ${key} --value="${value.replace(/"/g, '\\"')}" --environment=production`)
})