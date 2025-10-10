# Supabase セットアップ手順

このドキュメントでは、GSCランクトラッカーでSupabaseを使用してキーワードデータを永続化するためのセットアップ手順を説明します。

## 前提条件

- Supabaseアカウント（https://supabase.com/ で無料登録可能）
- Vercelにデプロイ済みのプロジェクト（またはローカル開発環境）

## セットアップ手順

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/) にアクセスしてログイン
2. 「New Project」をクリック
3. プロジェクト名を入力（例: `gsc-analyzer`）
4. データベースパスワードを設定（強力なパスワードを使用）
5. リージョンを選択（日本の場合は `Northeast Asia (Tokyo)` を推奨）
6. 「Create new project」をクリック

### 2. データベーステーブルの作成

1. Supabaseダッシュボードで左メニューの「SQL Editor」をクリック
2. 「New query」をクリック
3. プロジェクトルートの `supabase-schema.sql` ファイルの内容をコピー&ペースト
4. 「Run」ボタンをクリックしてSQLを実行

実行されるテーブル:
- `rank_tracker_queries` - クエリ情報を保存
- `rank_tracker_history` - 順位履歴を保存

### 3. Supabase APIキーの取得

1. Supabaseダッシュボードで左メニューの「Project Settings」（歯車アイコン）をクリック
2. 「API」タブをクリック
3. 以下の情報をコピー:
   - **Project URL**: `https://xxxxx.supabase.co` の形式
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` の形式の長い文字列

### 4. 環境変数の設定

#### ローカル開発環境の場合

プロジェクトルートに `.env` ファイルを作成し、以下を記述:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

#### Vercelデプロイの場合

1. Vercelダッシュボードでプロジェクトを選択
2. 「Settings」タブをクリック
3. 左メニューの「Environment Variables」をクリック
4. 以下の環境変数を追加:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

5. 「Save」をクリック
6. プロジェクトを再デプロイ

### 5. 動作確認

1. アプリケーションを起動（ローカル: `npm run dev` / Vercel: デプロイ済みURL）
2. GSCランクトラッカーページにアクセス
3. クエリを追加
4. ブラウザを閉じて再度開く、または別のブラウザでアクセス
5. 登録したクエリが表示されることを確認

### 6. Supabaseダッシュボードでデータを確認

1. Supabaseダッシュボードで「Table Editor」をクリック
2. `rank_tracker_queries` テーブルを選択
3. 登録したクエリが表示されることを確認

## トラブルシューティング

### エラー: "Supabase credentials are not set"

**原因**: 環境変数 `SUPABASE_URL` または `SUPABASE_ANON_KEY` が設定されていません。

**解決策**:
- `.env` ファイルが正しく作成されているか確認
- Vercelの環境変数が正しく設定されているか確認
- Vercelで環境変数を追加した後、再デプロイが必要

### エラー: "Failed to load queries from database"

**原因**: テーブルが作成されていないか、APIキーが間違っています。

**解決策**:
- `supabase-schema.sql` を実行してテーブルが作成されているか確認
- `SUPABASE_ANON_KEY` が正しいか確認
- Supabaseダッシュボードの「API」タブで正しいキーをコピーしているか確認

### クエリが保存されない

**原因**: Row Level Security (RLS) ポリシーが正しく設定されていない可能性があります。

**解決策**:
1. Supabaseダッシュボードで「Authentication」→「Policies」を確認
2. `rank_tracker_queries` と `rank_tracker_history` テーブルのポリシーが有効になっているか確認
3. 必要に応じて `supabase-schema.sql` を再実行

## データ移行（localStorage → Supabase）

既にlocalStorageにデータがある場合、以下の手順でSupabaseに移行できます:

1. ブラウザのデベロッパーツールを開く（F12キー）
2. 「Console」タブを開く
3. 以下のコードを実行:

```javascript
// localStorageからデータを取得
const storageKey = `rankTrackerQueries_${username}`; // usernameは実際のユーザー名に置き換え
const data = localStorage.getItem(storageKey);
const queries = JSON.parse(data);

// Supabaseに保存
fetch('/api/rank-tracker-queries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: username,
    siteUrl: 'https://www.tabirai.net/', // 実際のサイトURLに置き換え
    queries: queries
  })
}).then(res => res.json()).then(data => console.log('Migration completed:', data));
```

## セキュリティに関する注意事項

- `SUPABASE_ANON_KEY` は公開しても安全です（Row Level Securityで保護されています）
- 本番環境では、より厳密な認証（Supabase Auth等）の実装を推奨します
- 現在のRLSポリシーは全てのアクセスを許可していますが、必要に応じて制限を追加できます

## サポート

問題が解決しない場合は、以下を確認してください:
- Supabaseダッシュボードの「Logs」タブでエラーログを確認
- ブラウザのコンソールでエラーメッセージを確認
- Vercelのデプロイログでエラーを確認
