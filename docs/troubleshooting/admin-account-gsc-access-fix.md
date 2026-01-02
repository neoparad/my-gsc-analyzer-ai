# AdminアカウントのGoogle Search Console APIアクセス権限エラー修正

## 📋 問題概要

adminアカウントでツールを使用しようとすると、以下のエラーが発生していました：

```
Google Search Console APIへのアクセス権限がありません
サービスアカウントをGoogle Search Consoleのプロパティに追加してください。
```

一方、userアカウントでは正常に動作していました。

## 🔍 原因

adminアカウントで`getAccountIdForSite`関数を呼び出す際、`userRole`パラメータが渡されていませんでした。そのため、adminアカウントでも一般ユーザーと同じロジック（`user_id`で検索）が実行され、以下の問題が発生していました：

1. adminアカウントがアクセスしようとしているサイトが、そのadminアカウントの`user_id`で登録されていない場合
2. 正しい`account_id`が取得できず、デフォルトの`'link-th'`が返される
3. その結果、間違ったサービスアカウントでGoogle Search Console APIにアクセスしようとし、権限エラーが発生

## ✅ 修正内容

### 1. APIエンドポイントの修正

以下の4つのAPIエンドポイントで、`getAccountIdForSite`関数の呼び出しに`userRole`パラメータを追加しました：

#### `api/analyze.js` (44行目)
```javascript
// 修正前
const dbAccountId = await getAccountIdForSite(req.user.userId, site_url)

// 修正後
const dbAccountId = await getAccountIdForSite(req.user.userId, site_url, userRole)
```

#### `api/rank-tracker.js` (43行目)
```javascript
// 修正前
const dbAccountId = await getAccountIdForSite(req.user.userId, siteUrl)

// 修正後
const dbAccountId = await getAccountIdForSite(req.user.userId, siteUrl, userRole)
```

#### `api/page-tracker.js` (43行目)
```javascript
// 修正前
const accountId = await getAccountIdForSite(req.user.userId, siteUrl)

// 修正後
const accountId = await getAccountIdForSite(req.user.userId, siteUrl, userRole)
```

#### `api/chat.js` (104行目、135行目)
```javascript
// 修正前
const accountId = await getAccountIdForSite(req.user.userId, targetSiteUrl)
const analysisAccountId = await getAccountIdForSite(req.user.userId, analysisSiteUrl)

// 修正後
const accountId = await getAccountIdForSite(req.user.userId, targetSiteUrl, userRole)
const analysisAccountId = await getAccountIdForSite(req.user.userId, analysisSiteUrl, userRole)
```

### 2. デバッグログの追加

`lib/user-sites.js`の`getAccountIdForSite`と`getAccountIdForSiteByUrl`関数に、デバッグログを追加しました。これにより、以下の情報がログに出力されます：

- 検索に使用するパラメータ（userId、siteUrl、userRole）
- データベース検索の結果
- 取得された`account_id`の値
- エラー発生時の詳細情報

## 🔄 修正後の動作

### Adminアカウントの場合

1. `getAccountIdForSite`関数内で`userRole === 'admin'`が検出される
2. `getAccountIdForSiteByUrl`関数が呼び出される
3. `user_id`に関係なく、サイトURLから直接`account_id`を取得
4. 正しいサービスアカウントIDが取得され、Google Search Console APIに正常にアクセス可能

### Userアカウントの場合

- 従来通り、自分の`user_id`で登録されたサイトの`account_id`を取得
- 動作に変更なし

## 🧪 テスト方法

### 1. Adminアカウントでのテスト

1. adminアカウントでログイン
2. 任意のサイト（adminアカウントの`user_id`で登録されていないサイトでも可）を選択
3. 以下の機能をテスト：
   - 比較分析（`/api/analyze`）
   - ランクトラッカー（`/api/rank-tracker`）
   - ページトラッカー（`/api/page-tracker`）
   - AIチャット（`/api/chat`）
4. エラーが発生せず、正常にデータが取得できることを確認

### 2. Userアカウントでのテスト

1. userアカウントでログイン
2. 自分のサイトを選択
3. 上記と同じ機能をテスト
4. 従来通り正常に動作することを確認

### 3. ログの確認

サーバーログで以下のようなログが出力されることを確認：

```
[getAccountIdForSite] Getting account for userId: <userId>, siteUrl: <siteUrl>, userRole: admin
[getAccountIdForSite] Admin user detected, using getAccountIdForSiteByUrl
[getAccountIdForSiteByUrl] Looking up account for site: <siteUrl> (normalized: <normalizedUrl>, domain: <domain>)
[getAccountIdForSiteByUrl] Found account_id: <accountId> (normalized: <normalizedAccountId>) for site: <siteUrl>
[Comparison] DB accountId: <dbAccountId>, Request accountId: <requestAccountId>, Using: <accountId>
```

## 📦 デプロイ手順

### 1. 変更ファイルの確認

以下のファイルが修正されています：

- `api/analyze.js`
- `api/rank-tracker.js`
- `api/page-tracker.js`
- `api/chat.js`
- `lib/user-sites.js`

### 2. ローカルでの動作確認

```bash
# サーバーを起動
npm run dev

# または
node server.js
```

### 3. Gitコミット

```bash
git add api/analyze.js api/rank-tracker.js api/page-tracker.js api/chat.js lib/user-sites.js
git commit -m "fix: adminアカウントでGoogle Search Console APIアクセス権限エラーを修正

- getAccountIdForSite関数の呼び出しにuserRoleパラメータを追加
- デバッグログを追加してトラブルシューティングを容易に"
```

### 4. デプロイ

#### Vercelの場合

```bash
# 自動デプロイ（mainブランチにpushした場合）
git push origin main

# または手動デプロイ
vercel --prod
```

#### その他の環境の場合

通常のデプロイ手順に従ってください。

### 5. デプロイ後の確認

1. 本番環境でadminアカウントでログイン
2. 上記のテスト手順を実行
3. ログを確認して、正しい`account_id`が取得されていることを確認

## 🐛 トラブルシューティング

### 問題: まだエラーが発生する

**確認事項：**

1. **データベースにサイトが登録されているか**
   - `user_sites`テーブルに該当サイトが存在するか確認
   - `is_active = true`になっているか確認
   - `account_id`が正しく設定されているか確認

2. **サービスアカウントがGoogle Search Consoleに追加されているか**
   - 該当サイトのGoogle Search Consoleプロパティにサービスアカウントのメールアドレスが追加されているか確認
   - 権限レベルが「所有者」または「フル」になっているか確認

3. **ログの確認**
   - サーバーログで`[getAccountIdForSite]`や`[getAccountIdForSiteByUrl]`のログを確認
   - 取得されている`account_id`が正しいか確認

### 問題: ログが出力されない

- ログレベルが適切に設定されているか確認
- 本番環境では`console.log`が無効化されている可能性があるため、ログサービス（例：Vercel Logs）で確認

## 📝 関連ドキュメント

- [マルチユーザー実装ガイド](../multi-user-implementation.md)
- [管理者の全サイトアクセス機能](../architecture/admin-site-access.md)
- [Google Search Console API権限エラー調査チェックリスト](./gsc-permission-error-checklist.md)

## 🔗 関連Issue/PR

- 修正日: 2025年1月
- 影響範囲: AdminアカウントでのGoogle Search Console APIアクセス
- 破壊的変更: なし（後方互換性あり）

