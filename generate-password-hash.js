import bcrypt from 'bcryptjs'

// パスワードをハッシュ化するスクリプト
// 使い方: node generate-password-hash.js <your-password>

const password = process.argv[2]

if (!password) {
  console.error('使用方法: node generate-password-hash.js <password>')
  console.error('例: node generate-password-hash.js mySecurePassword123')
  process.exit(1)
}

const salt = bcrypt.genSaltSync(10)
const hash = bcrypt.hashSync(password, salt)

console.log('\n生成されたパスワードハッシュ:')
console.log(hash)
console.log('\nこのハッシュを.envファイルのAUTH_PASSWORD_HASHに設定してください\n')
