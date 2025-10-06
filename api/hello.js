import { checkBasicAuth } from './_auth.js'

export default function handler(req, res) {
  // Basic認証チェック
  if (!checkBasicAuth(req, res)) {
    return
  }

  res.status(200).json({ message: 'Hello from API!' })
}