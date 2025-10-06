# Search Console 順位変化分析ツール

Search Console APIを使用して、2つの期間のデータを比較し、順位変化を分析するWebアプリケーションです。

## 機能

- ✅ Search Console APIからデータ取得
- ✅ 2期間の順位変化分析（順位上昇/下落/新規獲得/消失）
- ✅ URLフィルタ・クエリフィルタ機能
- ✅ 散布図での可視化
- ✅ ディレクトリ別分析（棒グラフ）
- ✅ 詳細データテーブル（ページネーション付き）
- ✅ CSVダウンロード
- ✅ Googleスプレッドシート自動作成機能

## 技術スタック

- **フロントエンド**: React + Vite + Tailwind CSS
- **バックエンド**: Python (Vercel Serverless Functions)
- **API**: Google Search Console API, Google Sheets API
- **デプロイ**: Vercel

## セットアップ

### 1. プロジェクトのクローン

```bash
git clone <repository-url>
cd my-gsc-analyzer
```

### 2. 依存関係のインストール

```bash
# Node.js依存関係
npm install

# Python依存関係（ローカル開発用）
pip install -r requirements.txt
```

### 3. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. 以下のAPIを有効化：
   - Google Search Console API
   - Google Sheets API
   - Google Drive API
3. サービスアカウントを作成し、JSONキーをダウンロード
4. Search Consoleで該当サイトにサービスアカウントを追加（表示権限）

### 4. 認証設定

#### ローカル開発の場合：
`credentials/` ディレクトリにサービスアカウントJSONファイルを配置

#### 本番環境の場合：
Vercelの環境変数 `GOOGLE_CREDENTIALS` にJSONファイルの内容を設定

### 5. ローカル開発サーバー起動

```bash
# フロントエンドとバックエンドを同時に起動（推奨）
npm run dev

# または個別に起動する場合
npm run dev:vite  # フロントエンド（Vite）
npm run dev:api   # バックエンド（API）- 別ターミナルで実行
```

**アクセスURL:**
- フロントエンド: http://localhost:5173
- APIサーバー: http://localhost:3001

### 6. Vercelへのデプロイ

```bash
# Vercel CLIでログイン
npx vercel login

# 環境変数を設定（Vercelダッシュボードまたは CLI）
vercel env add GOOGLE_CREDENTIALS

# デプロイ
npx vercel --prod
```

## 使用方法

1. **サイトURL入力**: Search Consoleに登録済みのサイトURLを入力
2. **期間設定**: 過去期間と現在期間を設定
3. **フィルタ設定** (オプション): URLフィルタ、クエリフィルタを設定
4. **分析実行**: 「分析を開始」ボタンをクリック
5. **結果確認**: タブ切り替えで改善/悪化データを確認
6. **データ出力**: CSVダウンロードまたはスプレッドシート作成

## API仕様

### POST /api/analyze

順位変化分析を実行

**リクエストボディ:**
```json
{
  "site_url": "https://example.com/",
  "past_start": "2024-01-01",
  "past_end": "2024-01-31",
  "current_start": "2024-02-01",
  "current_end": "2024-02-28",
  "url_filter": "/category/",
  "query_filter": "検索キーワード"
}
```

### POST /api/create_sheet

Googleスプレッドシートを作成

**リクエストボディ:**
```json
{
  "data": [["列1", "列2"], ["データ1", "データ2"]],
  "title": "スプレッドシートタイトル"
}
```

## 注意事項

- サービスアカウントJSONファイルはGitにコミットしないでください
- Search Console APIには利用制限があります
- 大量データの分析には時間がかかる場合があります

## トラブルシューティング

### 認証エラー
- サービスアカウントがSearch Consoleサイトに追加されているか確認
- 環境変数 `GOOGLE_CREDENTIALS` が正しく設定されているか確認

### データ取得エラー
- サイトURLが正確か確認（最後のスラッシュを含む）
- 指定期間にデータが存在するか確認

### パフォーマンス問題
- フィルタを使用してデータ量を制限
- 散布図表示は最大500点まで

## ライセンス

MIT License