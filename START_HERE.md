# 🚀 開発サーバー起動方法

## 手順

### 1. 全プロセスを停止
PowerShellまたはコマンドプロンプトで：
```powershell
taskkill /F /IM node.exe
```

### 2. APIサーバーを起動（新しいターミナル）
```bash
cd C:\Users\linkth\my-gsc-analyzer-ai
npm run dev:api
```

**以下のメッセージが表示されればOK：**
```
✅ API Server running on http://localhost:3000
📊 Available endpoints:
   POST /api/analyze
   POST /api/chat
   POST /api/create_sheet
   POST /api/detailed-analysis
   POST /api/ai-analysis
   ...
```

### 3. フロントエンドを起動（別の新しいターミナル）
```bash
cd C:\Users\linkth\my-gsc-analyzer-ai
npm run dev
```

**以下のメッセージが表示されればOK：**
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 4. ブラウザでアクセス
http://localhost:5173

---

## トラブルシューティング

### ポート3000が使用中
```bash
# ポート3000を使っているプロセスを確認
netstat -ano | findstr ":3000"

# PIDを確認して停止
taskkill /F /PID <PID番号>
```

### まだ502エラーが出る場合
1. ブラウザのキャッシュをクリア（Ctrl+Shift+Delete）
2. 両方のサーバーを再起動
3. ブラウザのDevToolsを開いてNetworkタブでリクエストを確認

### APIサーバーが起動しない
```bash
# server.jsを直接実行してエラーを確認
cd C:\Users\linkth\my-gsc-analyzer-ai
node server.js
```

---

## 確認方法

### APIが動作しているか確認
別のターミナルで：
```bash
curl http://localhost:3000/api/health
```

**期待される結果：**
```json
{"status":"ok","timestamp":"2025-10-04T..."}
```

### フロントエンドからAPIにアクセスできるか確認
ブラウザのDevTools > Consoleで：
```javascript
fetch('/api/health').then(r => r.json()).then(console.log)
```

**期待される結果：**
```
{status: "ok", timestamp: "..."}
```

---

## 実装済み機能のテスト

1. **比較分析ページ** (http://localhost:5173/comparison)
   - サイトURL、期間を入力して分析実行

2. **詳細分析セクション**（比較分析実行後、ページ下部）
   - ⚙️ 分析設定：ブランド・除外キーワード設定
   - 📊 詳細を統計分析：クラスタリング、相関分析など
   - 🤖 詳細をAI分析：Gemini APIで検索意図分類など
