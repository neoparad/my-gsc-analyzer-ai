# Adminアカウント修正 - デプロイチェックリスト

## ✅ デプロイ前チェック

- [ ] すべての変更ファイルがコミットされている
  - [ ] `api/analyze.js`
  - [ ] `api/rank-tracker.js`
  - [ ] `api/page-tracker.js`
  - [ ] `api/chat.js`
  - [ ] `lib/user-sites.js`
- [ ] ローカルで動作確認済み
- [ ] テストが正常に完了している

## 🚀 デプロイ手順

### 1. Gitコミット

```bash
git add api/analyze.js api/rank-tracker.js api/page-tracker.js api/chat.js lib/user-sites.js
git add docs/troubleshooting/admin-account-gsc-access-fix.md
git add CHANGELOG.md
git commit -m "fix: adminアカウントでGoogle Search Console APIアクセス権限エラーを修正"
```

### 2. デプロイ

#### Vercelの場合
```bash
git push origin main
# または
vercel --prod
```

#### その他の環境
通常のデプロイ手順に従ってください。

## ✅ デプロイ後チェック

### 1. Adminアカウントでの動作確認

- [ ] adminアカウントでログイン
- [ ] 比較分析機能が正常に動作する
- [ ] ランクトラッカーが正常に動作する
- [ ] ページトラッカーが正常に動作する
- [ ] AIチャットが正常に動作する

### 2. Userアカウントでの動作確認

- [ ] userアカウントでログイン
- [ ] 既存機能が正常に動作する（回帰テスト）

### 3. ログの確認

- [ ] サーバーログで`[getAccountIdForSite]`のログが出力されている
- [ ] 正しい`account_id`が取得されていることを確認

## 🐛 問題が発生した場合

1. ログを確認して、どの`account_id`が使用されているか確認
2. `docs/troubleshooting/admin-account-gsc-access-fix.md`のトラブルシューティングセクションを参照
3. 必要に応じてロールバックを検討

## 📝 関連ドキュメント

- 詳細な修正内容: `docs/troubleshooting/admin-account-gsc-access-fix.md`
- CHANGELOG: `CHANGELOG.md`

