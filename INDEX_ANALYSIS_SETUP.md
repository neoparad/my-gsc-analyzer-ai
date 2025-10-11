# インデックス分析機能 セットアップガイド

## 概要

ブラウザ版インデックス分析は、最大50,000件のURLのインデックス状態を一括調査できる機能です。

### 主な機能

✅ **最大50,000件まで処理可能**
✅ **ブラウザ内で直接処理**（サーバーレス）
✅ **1,000件ごとに自動保存**（中断→再開可能）
✅ **一時停止/再開/キャンセル**機能
✅ **リアルタイム進捗表示**
✅ **データアナリスト視点のダッシュボード**
  - KPIカード（4つ）
  - ディレクトリ別・階層別・エラー別分析
  - フィルタ・検索機能
✅ **CSVエクスポート**

---

## セットアップ手順

### 1. Google Cloud Consoleでプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）

### 2. Search Console APIを有効化

1. Google Cloud Consoleで「APIとサービス」→「ライブラリ」を開く
2. 「Google Search Console API」を検索
3. 「有効にする」をクリック

### 3. OAuth 2.0クライアントIDを作成

#### 3-1. OAuth同意画面を設定

1. 「APIとサービス」→「OAuth同意画面」を開く
2. User Typeで「外部」を選択（個人利用の場合）
3. アプリ情報を入力：
   - アプリ名: `GSC Ranking Analyzer`
   - ユーザーサポートメール: あなたのメールアドレス
   - デベロッパーの連絡先情報: あなたのメールアドレス
4. スコープは設定不要（次へ）
5. テストユーザーを追加：
   - あなたのGoogleアカウントのメールアドレスを追加
6. 「保存して続行」をクリック

#### 3-2. 認証情報を作成

1. 「APIとサービス」→「認証情報」を開く
2. 「+認証情報を作成」→「OAuth クライアント ID」をクリック
3. アプリケーションの種類: **「ウェブ アプリケーション」**を選択
4. 名前: `GSC Analyzer Web Client`
5. **承認済みのJavaScript生成元**に以下を追加：
   ```
   http://localhost:5173
   https://gsc-ranking-analyzer.vercel.app
   ```
6. **承認済みのリダイレクトURI**に以下を追加：
   ```
   http://localhost:5173
   https://gsc-ranking-analyzer.vercel.app
   ```
7. 「作成」をクリック
8. **クライアントID**と**クライアントシークレット**が表示される（クライアントIDのみ使用）

### 4. APIキーを作成

1. 「認証情報」ページで「+認証情報を作成」→「APIキー」をクリック
2. APIキーが作成される
3. **APIキーを制限**（推奨）：
   - 「キーを制限」をクリック
   - アプリケーションの制限: **HTTPリファラー**
   - ウェブサイトの制限を追加:
     ```
     http://localhost:5173/*
     https://gsc-ranking-analyzer.vercel.app/*
     ```
   - API の制限: **キーを制限**
   - 「Google Search Console API」のみ選択
4. 「保存」をクリック

### 5. 環境変数を設定

#### ローカル開発環境（`.env`）

```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルを編集：

```env
# Google OAuth (Client-side for Index Analysis)
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=YOUR_API_KEY_HERE

# Supabase (Client-side) - オプション
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### Vercel本番環境

1. Vercelダッシュボードを開く
2. プロジェクト設定 → Environment Variables
3. 以下の変数を追加：

| Key                      | Value                                  |
|--------------------------|----------------------------------------|
| `VITE_GOOGLE_CLIENT_ID`  | YOUR_CLIENT_ID.apps.googleusercontent.com |
| `VITE_GOOGLE_API_KEY`    | YOUR_API_KEY                           |
| `VITE_SUPABASE_URL`      | https://your-project.supabase.co       |
| `VITE_SUPABASE_ANON_KEY` | your_supabase_anon_key                 |

4. 「Save」をクリック
5. プロジェクトを再デプロイ

---

## 使い方

### 1. Googleアカウントでサインイン

1. `/index-analysis`ページを開く
2. 「Googleアカウントでサインイン」ボタンをクリック
3. Google Search Consoleへのアクセスを許可

### 2. URLを収集

以下のいずれかの方法でURLを収集：

#### CSV アップロード
- URL列を含むCSVファイルをアップロード
- URL列は自動検出されます

#### 直接入力
- 1行に1つのURLを入力
- 最大50,000件

### 3. 検査を開始

1. 「URL検査を開始」ボタンをクリック
2. 進捗がリアルタイムで表示されます
3. 処理中は：
   - **一時停止**: ブラウザを閉じる前に一時停止
   - **再開**: 一時停止から再開
   - **キャンセル**: 処理を中止

### 4. 結果を確認

#### レベル1: KPIサマリー
- 総URL数
- インデックス済み数/率
- 未インデックス数/率
- エラー数/率
- 円グラフで視覚化

#### レベル2: 分析グラフ
- **ディレクトリ別インデックス率**: 問題のあるディレクトリを特定
- **URL階層別インデックス率**: 深い階層の問題を発見
- **エラー種別ランキング**: 頻出エラーを特定

#### レベル3: 詳細テーブル
- フィルタ機能（ステータス、ディレクトリ）
- 検索機能（URL）
- 個別URLの詳細情報

### 5. データをエクスポート

- 「CSVエクスポート」ボタンでダウンロード
- Excel、Google Sheetsで開いて分析可能

---

## 処理時間の目安

| URL数     | 予想処理時間 |
|-----------|--------------|
| 100件     | 約5秒        |
| 1,000件   | 約50秒       |
| 10,000件  | 約8分        |
| 50,000件  | 約42分       |

※ Google APIの制限（20リクエスト/秒）に基づく

---

## チェックポイント機能

1,000件ごとにSupabaseに自動保存されます。

### メリット
- ブラウザを閉じても続きから再開可能
- ネットワーク切断時も安全
- 処理履歴を保存

### 注意点
- Supabase環境変数が設定されている場合のみ有効
- 未設定の場合は通常通り動作（保存なし）

---

## トラブルシューティング

### エラー: "Google APIの初期化に失敗しました"

**原因**: 環境変数が正しく設定されていない

**解決策**:
1. `.env`ファイルを確認
2. `VITE_GOOGLE_CLIENT_ID`と`VITE_GOOGLE_API_KEY`が設定されているか確認
3. 開発サーバーを再起動: `npm run dev`

### エラー: "Googleアカウントでサインインしてください"

**原因**: OAuth認証が完了していない

**解決策**:
1. 「Googleアカウントでサインイン」ボタンをクリック
2. Google Search Consoleへのアクセスを許可
3. テストユーザーに追加されているか確認（Google Cloud Console）

### エラー: "Origin not allowed"

**原因**: OAuth同意画面の承認済みJavaScript生成元が正しくない

**解決策**:
1. Google Cloud Console → 認証情報 → OAuth 2.0クライアントID
2. 承認済みのJavaScript生成元を確認:
   - `http://localhost:5173`（ローカル）
   - `https://gsc-ranking-analyzer.vercel.app`（本番）
3. 保存して数分待つ

### エラー: "API key not valid"

**原因**: APIキーが制限されている、または無効

**解決策**:
1. Google Cloud Console → 認証情報 → APIキー
2. APIキーの制限を確認:
   - HTTPリファラーが正しく設定されているか
   - Search Console APIが有効になっているか
3. 新しいAPIキーを作成して試す

### 処理が途中で止まる

**原因**: ネットワーク切断、ブラウザのスリープ

**解決策**:
1. ブラウザのスリープ防止設定を確認
2. 一時停止ボタンを使って安全に中断
3. チェックポイントから再開（Supabase設定時）

---

## 制限事項

- **最大URL数**: 50,000件
- **処理速度**: 20リクエスト/秒（Google API制限）
- **ブラウザ要件**: モダンブラウザ（Chrome、Firefox、Safari、Edge）
- **認証**: Google Search Consoleへのアクセス権限が必要

---

## アーキテクチャ

```
┌─────────────┐
│  ブラウザ   │
│             │
│ ┌─────────┐ │
│ │IndexAnalysis│─┐
│ └─────────┘ │ │
│             │ │
│ ┌─────────┐ │ │
│ │Google API│←┘ │ Google Search Console API
│ └─────────┘ │   │ (直接呼び出し)
│             │   │
│ ┌─────────┐ │   │
│ │Supabase │←───┘ チェックポイント保存
│ └─────────┘ │     (オプション)
└─────────────┘
```

### メリット
- ✅ サーバーコスト: $0
- ✅ タイムアウトなし
- ✅ リアルタイム進捗
- ✅ スケーラブル

### デメリット
- ❌ ブラウザを開いたままにする必要がある
- ❌ 10万件以上は現実的でない

---

## 次のステップ

100万件以上を処理したい場合は、Phase 2への移行を検討してください：

- Cloudflare Workers導入
- バックグラウンド処理
- ジョブキュー
- メール通知

詳細は開発チームにお問い合わせください。

---

## サポート

問題が解決しない場合:
1. GitHub Issuesで報告
2. `CURRENT_STATUS.md`を確認
3. ログを確認（ブラウザのDevToolsコンソール）
