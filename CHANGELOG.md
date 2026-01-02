# 変更履歴

## [未リリース] - 2025-01-XX

### バグ修正

#### AdminアカウントのGoogle Search Console APIアクセス権限エラー修正
- **問題**: adminアカウントでツールを使用すると「Google Search Console APIへのアクセス権限がありません」エラーが発生
- **原因**: `getAccountIdForSite`関数の呼び出し時に`userRole`パラメータが渡されていなかったため、adminアカウントでも一般ユーザーと同じロジック（`user_id`で検索）が実行されていた
- **修正内容**:
  - `api/analyze.js`、`api/rank-tracker.js`、`api/page-tracker.js`、`api/chat.js`で`getAccountIdForSite`の呼び出しに`userRole`パラメータを追加
  - `lib/user-sites.js`にデバッグログを追加してトラブルシューティングを容易に
- **影響範囲**: AdminアカウントでのGoogle Search Console APIアクセス
- **破壊的変更**: なし（後方互換性あり）
- **詳細**: `docs/troubleshooting/admin-account-gsc-access-fix.md`を参照

### 追加機能

#### 複数サービスアカウント対応
- **新機能**: 複数のGoogle Search Consoleサービスアカウントを選択して使用できる機能を追加
- **実装内容**:
  - 新しい認証情報管理モジュール `lib/google-credentials.js` を追加
  - サービスアカウントID (`tabirai`, `link-th`) で認証情報を切り替え可能
  - リクエストボディまたはクエリパラメータで `accountId` を指定可能
  - デフォルトは `tabirai` アカウント

#### 対応APIエンドポイント
以下のAPIエンドポイントでサービスアカウント選択に対応：
- `/api/analyze` - 分析API
- `/api/chat` - チャットAI
- `/api/rank-tracker` - ランクトラッカー
- `/api/page-tracker` - ページトラッカー

### 変更内容

#### 新規ファイル
- `lib/google-credentials.js` - 認証情報管理モジュール
- `docs/architecture/multi-service-account.md` - 複数サービスアカウント対応ドキュメント
- `docs/architecture/multi-user-design.md` - マルチユーザー対応設計書（将来実装用）

#### 更新ファイル
- `api/analyze.js` - 認証情報取得を共通関数に変更
- `api/chat.js` - 認証情報取得を共通関数に変更、サービスアカウントID対応
- `api/rank-tracker.js` - 認証情報取得を共通関数に変更
- `api/page-tracker.js` - 認証情報取得を共通関数に変更

#### 認証情報ファイル
- `credentials/link-th-1735646449171-9802ee6af2b8.json` - 新しいサービスアカウントの認証情報を追加

### 使用方法

#### APIリクエストでの指定方法

**リクエストボディで指定:**
```json
{
  "accountId": "link-th",
  "siteUrl": "https://example.com",
  // ... その他のパラメータ
}
```

**クエリパラメータで指定:**
```
GET /api/analyze?accountId=link-th&siteUrl=https://example.com
```

**デフォルト動作:**
- `accountId` が指定されていない場合、`default` (tabirai) が使用されます

### 技術的詳細

#### 認証情報の優先順位
1. `GOOGLE_CREDENTIALS` 環境変数（最優先）
2. ローカル開発環境: `credentials/` フォルダ内のJSONファイル
3. 本番環境: 環境変数が必須

#### サービスアカウントマッピング
```javascript
{
  'tabirai': 'tabirai-seo-pj-58a84b33b54a.json',
  'link-th': 'link-th-1735646449171-9802ee6af2b8.json',
  'default': 'tabirai-seo-pj-58a84b33b54a.json'
}
```

### 注意事項

1. **サーチコンソールへの追加**: 各サービスアカウントのメールアドレスを、対応するサーチコンソールプロパティに「所有者」または「フルアクセス」権限で追加する必要があります。

2. **後方互換性**: 既存のAPIリクエスト（`accountId` 未指定）は引き続き動作し、デフォルトアカウントが使用されます。

3. **環境変数**: 本番環境では `GOOGLE_CREDENTIALS` 環境変数が設定されている場合、ファイルベースの認証情報よりも優先されます。

### 今後の予定

- 他のAPIエンドポイント（`brand-analysis.js`, `directory-analysis.js`, `ads-cannibalization.js` など）への対応
- フロントエンドにサービスアカウント選択UIの追加
- マルチユーザー対応機能の実装（設計書作成済み）

---

## 過去の変更履歴

（過去の変更履歴はここに追加）






