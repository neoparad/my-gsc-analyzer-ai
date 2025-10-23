# 開発環境セットアップ

## ローカル開発サーバーの起動

### 簡単な方法（Windows）
```bash
start-dev.bat
```
このバッチファイルが2つのサーバーを自動的に起動します。

### 手動で起動する場合
このプロジェクトは2つのサーバーを同時に起動する必要があります：

#### 1. Vercel Dev（APIサーバー） - ポート3000
```bash
npm run dev:api
```

#### 2. Vite（フロントエンド） - ポート5173
別のターミナルで：
```bash
npm run dev
```

### アクセス
- フロントエンド: http://localhost:5173
- API: http://localhost:3000/api/*

## 詳細分析機能について

### 使い方
1. 比較分析を実行
2. ページ下部の「さらに詳しく分析する」セクションで「⚙️ 分析設定」をクリック
3. ブランドキーワードと除外キーワードを設定
4. 「📊 詳細を統計分析」または「🤖 詳細をAI分析」を実行

### APIエンドポイント

#### `/api/detailed-analysis` - 統計分析
- クラスタリング分析（k-means）
- 相関分析
- 加速度分析
- セグメント比較

#### `/api/ai-analysis` - AI分析
- 検索意図分類（Gemini API）
- 自動カテゴリ分類
- クラスタ解釈

### 環境変数
`.env`ファイルに以下を設定：
```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CREDENTIALS=your_service_account_json
```

## トラブルシューティング

### "Failed to fetch" または "502 Bad Gateway" エラー

**原因:** Vercel Devサーバーが正しく起動していない、またはproxy.jsがクラッシュしている

**解決方法:**
1. 両方のサーバーを停止（Ctrl+C）
2. `api/proxy.js`を修正済みか確認（distフォルダチェックを追加）
3. サーバーを再起動：
   ```bash
   # ターミナル1
   npm run dev:api

   # ターミナル2
   npm run dev
   ```

### "Failed to fetch" エラー（一般）
1. Vercel Devサーバーが起動しているか確認（ポート3000）
2. vite.config.jsのプロキシ設定を確認（ポート3000になっているか）
3. 両方のサーバーが起動していることを確認

### APIが404を返す
1. `vercel.json`に新しいAPIルートが追加されているか確認
2. Vercel Devを再起動

### Gemini APIエラー
1. GEMINI_API_KEYが設定されているか確認
2. API利用制限を確認

### proxy.jsのクラッシュ（exit code 3221225794）
**原因:** distフォルダが存在しない状態でファイルを読もうとしている

**解決済み:** proxy.jsを修正してdistフォルダの存在チェックを追加しました。開発環境では404を返します。
