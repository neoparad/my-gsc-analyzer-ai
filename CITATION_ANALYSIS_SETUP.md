# サイテーション分析機能 セットアップガイド

## 概要

Common Crawlデータを活用した被リンク・言及（サイテーション）分析機能を実装しました。

### 主要機能

1. **Common Crawl統合**: 大規模Webクロールデータから自社ドメインへの被リンク・言及を抽出
2. **AI分析**: Gemini APIを使用したトピック抽出とセンチメント分析
3. **月次トレンド**: 時系列でのサイテーション推移の可視化
4. **競合比較**: 複数ドメインとの比較分析
5. **スコアリング**: 総合的なサイテーションスコアの算出

## データベースセットアップ

### 1. Supabaseでスキーマを実行

`supabase-schema.sql` を実行して以下のテーブルを作成:

- `citations`: 被リンク・言及データ
- `analysis_jobs`: 分析ジョブ管理
- `citation_scores`: 月次スコア集計
- `monthly_citations`: 月次推移データ
- `crawl_cache`: Common Crawlキャッシュ

```bash
# Supabase SQLエディタで実行
# または psql経由で実行
psql -h [SUPABASE_HOST] -U postgres -d postgres -f supabase-schema.sql
```

### 2. 環境変数の設定

`.env` または Vercelの環境変数に以下を追加:

```env
# Supabase（既存）
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini AI（既存）
GEMINI_API_KEY=your_gemini_api_key

# Google Cloud（既存）
GOOGLE_CREDENTIALS={"type":"service_account",...}

# Basic認証（既存）
BASIC_AUTH_USER=your_username
BASIC_AUTH_PASSWORD=your_password
```

## 実装ファイル

### バックエンド

1. **lib/commoncrawl.js**: Common Crawl API統合
   - ドメイン検索
   - WARCファイル取得
   - サイテーション抽出

2. **lib/citation-ai.js**: AI分析機能
   - トピック抽出
   - センチメント分析
   - サマリー生成
   - スコア計算

3. **API エンドポイント**:
   - `api/citation-analysis.js`: 分析開始（POST）
   - `api/citation-status.js`: ジョブ状態確認（GET）
   - `api/citation-stats.js`: 統計情報取得（GET/POST）
   - `api/citation-competitor.js`: 競合比較（POST）

### フロントエンド

1. **src/CitationAnalysis.jsx**: メインコンポーネント
   - フォーム入力
   - ジョブステータスポーリング
   - 結果表示（グラフ、統計、AI分析）

2. **src/App.jsx**: ルート追加
   - `/citation-analysis` パス

3. **src/Sidebar.jsx**: メニュー追加
   - 「サイテーション分析」項目

## 使い方

### 1. 基本的な使用フロー

1. **ドメイン入力**: 分析対象のドメイン（例: `tabirai.net`）
2. **月を選択**: 分析対象月を選択（例: `2024-12`, `2025-01`）
3. **分析開始**: ボタンクリックで非同期ジョブ開始
4. **進捗確認**: プログレスバーで進捗を確認（クロール50%、AI分析50%）
5. **結果表示**: 完了後、統計・グラフ・AI分析が表示

### 2. 競合比較

1. 基本分析を実行後、「競合比較」セクションで競合ドメインを追加
2. 「競合比較を実行」ボタンをクリック
3. 比較テーブルとAIレポートが表示

## API使用方法

### サイテーション分析開始

```javascript
POST /api/citation-analysis

{
  "user_id": "username",
  "domain": "example.com",
  "months": ["2024-12", "2025-01"]
}

// Response
{
  "job_id": "uuid",
  "status": "processing"
}
```

### ジョブステータス確認

```javascript
GET /api/citation-status?job_id=uuid&user_id=username

// Response
{
  "job": {
    "status": "completed",
    "progress": 100,
    "total_citations": 150
  },
  "citations": [...],
  "citation_scores": [...],
  "monthly_citations": [...]
}
```

### 統計情報取得

```javascript
GET /api/citation-stats?user_id=username&domain=example.com

// または AI分析付き
POST /api/citation-stats
{
  "user_id": "username",
  "domain": "example.com"
}
```

### 競合比較

```javascript
POST /api/citation-competitor

{
  "user_id": "username",
  "my_domain": "example.com",
  "competitor_domains": ["competitor1.com", "competitor2.com"],
  "months": ["2024-12", "2025-01"]
}
```

## Common Crawlについて

### データソース

- Common Crawl: 毎月更新される大規模Webクロールデータ
- 公開データセット（無料）
- Index API: 検索可能なインデックス
- WARC: 実際のHTMLコンテンツ

### 制限事項

1. **データ遅延**: 最新データは2-3ヶ月前まで
2. **クロール範囲**: すべてのWebサイトが含まれるわけではない
3. **レート制限**: API呼び出しに制限あり（実装では100ms間隔で制御）
4. **データサイズ**: 大規模ドメインは処理時間が長い（最大50件/月に制限）

### インデックスマッピング

`lib/commoncrawl.js` の `getIndexIdFromYearMonth()` 関数で月次マッピングを管理:

```javascript
const indexMap = {
  '2024-01': 'CC-MAIN-2024-10',
  '2024-02': 'CC-MAIN-2024-10',
  // ...
}
```

最新のインデックスは [Common Crawl Index](https://index.commoncrawl.org/) で確認可能。

## パフォーマンス最適化

### 1. キャッシング

- `crawl_cache` テーブルで既処理データを管理
- 同じドメイン・月の再分析時はキャッシュ利用

### 2. バッチ処理

- 最大50件のWARCレコード/月で制限
- API呼び出し間に200msの待機時間
- センチメント分析は1秒間隔

### 3. バックグラウンド処理

- 分析はバックグラウンドで非同期実行
- フロントエンドはポーリングでステータス確認（3秒間隔）

## トラブルシューティング

### Common Crawl接続エラー

```
Error: Common Crawl API error: 404
```

**原因**: 指定月のインデックスが存在しない
**解決**: `lib/commoncrawl.js` の `indexMap` を更新

### Gemini API制限エラー

```
Error: 429 Too Many Requests
```

**原因**: API呼び出し回数制限
**解決**: `lib/citation-ai.js` の待機時間を増やす（1000ms→2000ms）

### ジョブが完了しない

**原因**: バックグラウンド処理でエラー発生
**解決**:
1. `analysis_jobs` テーブルで `error_message` を確認
2. サーバーログを確認
3. 必要に応じて手動でステータスを `failed` に更新

### データが取得できない

**原因**: 対象ドメインがCommon Crawlに存在しない
**解決**:
1. より一般的なドメイン（www付きなど）を試す
2. 別の月を試す
3. 小規模サイトの場合はデータが少ない可能性あり

## デプロイメント

### Vercelへのデプロイ

```bash
# 全ファイルをコミット
git add .
git commit -m "Add citation analysis feature"

# 本番環境にデプロイ
vercel --prod
```

### 環境変数の確認

Vercel Dashboardで以下が設定されているか確認:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_CREDENTIALS`
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`

## 今後の拡張案

1. **定期実行**: 月次で自動分析を実行
2. **通知機能**: 新しいサイテーション発見時にメール通知
3. **詳細フィルタ**: ドメイン権威性、トピック別フィルタリング
4. **エクスポート**: CSV/PDFレポート出力
5. **リアルタイム**: Webスクレイピングによる最新データ取得

## ライセンスと利用規約

- Common Crawl: [CC BY 4.0](https://commoncrawl.org/terms-of-use)
- 取得データの利用は利用規約に従ってください
- 過度なAPI呼び出しは避けてください

## サポート

問題が発生した場合:
1. `analysis_jobs` テーブルでエラーログを確認
2. ブラウザのコンソールでフロントエンドエラーを確認
3. サーバーログで詳細なエラー情報を確認

---

**実装完了日**: 2025-01-XX
**バージョン**: 1.0.0
