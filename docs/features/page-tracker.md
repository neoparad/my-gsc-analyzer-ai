# GSCページトラッカー セットアップガイド

## 概要

GSCページトラッカーは、ページURLごとの日次パフォーマンスを追跡する機能です。

### 主な機能

✅ **ページベースの追跡**: URLを登録して日次データを自動取得
✅ **日次データ保存**: クリック数、表示回数、CTR、平均順位を記録
✅ **トップクエリ表示**: 各ページで流入したクエリをランキング表示
✅ **トレンド分析**: 7日間の移動平均で上昇/下降トレンドを可視化
✅ **Supabase永続化**: 一度取得したデータは自動保存され履歴として蓄積

---

## データベースセットアップ

### 1. Supabaseでスキーマを実行

`page-tracker-schema.sql` をSupabaseのSQLエディタで実行:

```bash
# Supabase SQLエディタにコピー&ペーストして実行
# または psql経由で実行
psql -h [SUPABASE_HOST] -U postgres -d postgres -f page-tracker-schema.sql
```

実行すると以下のテーブルが作成されます:

- `page_tracker_pages` - 登録ページ一覧
- `page_tracker_daily` - 日次パフォーマンスデータ

### 2. テーブル構造

#### page_tracker_pages
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | プライマリキー |
| user_id | TEXT | ユーザーID |
| site_url | TEXT | サイトURL |
| page_url | TEXT | ページURL |
| page_title | TEXT | ページタイトル（オプション） |
| created_at | TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | 更新日時 |

#### page_tracker_daily
| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | プライマリキー |
| page_id | UUID | ページID（外部キー） |
| date | DATE | 日付 |
| clicks | INTEGER | クリック数 |
| impressions | INTEGER | 表示回数 |
| ctr | FLOAT | クリック率 |
| position | FLOAT | 平均順位 |
| top_queries | JSONB | トップクエリ（JSON配列） |
| created_at | TIMESTAMP | 作成日時 |

---

## 環境変数の設定

`.env`ファイルに以下が設定されていることを確認:

```env
# Supabase (Server-side)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase (Client-side for IndexAnalysis)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 実装ファイル

### バックエンド

1. **lib/supabase.js**: ページトラッカー用関数
   - `savePage()` - ページ登録・更新
   - `saveDailyData()` - 日次データ保存
   - `getPages()` - ページ一覧取得
   - `deletePage()` - ページ削除
   - `savePages()` - 一括保存

2. **api/page-tracker.js**: GSCからページデータ取得
   - ページごとの日次データを取得
   - クエリ別の集計
   - トップクエリの抽出

3. **api/page-tracker-pages.js**: Supabase連携API
   - GET: ページ一覧取得
   - POST: ページ保存
   - DELETE: ページ削除

### フロントエンド

1. **src/PageTracker.jsx**: メインコンポーネント
   - ページURL登録フォーム
   - ページ一覧テーブル
   - 詳細表示モーダル
   - グラフ表示（Recharts）

2. **src/App.jsx**: ルーティング追加
   - `/page-tracker` パス

3. **src/Sidebar.jsx**: メニュー追加
   - 「GSCページトラッカー」項目

---

## 使い方

### 1. 基本的な使用フロー

1. **サイトURL入力**: Search Console登録済みサイトURL
2. **ページURL追加**: 追跡したいページのURLを入力（最大100件）
3. **取得期間選択**: 7日/14日/30日/60日/90日から選択
4. **データ取得**: 「最新データを取得」ボタンをクリック
5. **結果確認**: ページ一覧でサマリーを確認
6. **詳細表示**: 行をクリックして詳細データとグラフを表示

### 2. データの見方

#### ページ一覧テーブル
- **ページURL**: 登録したページのURL
- **最終更新**: データ取得日（最新）
- **クリック数**: 全期間のクリック数合計と表示回数
- **平均順位**: 全期間の平均順位
- **トレンド**:
  - 🟢 上昇: 最近7日間が前7日間より10%以上増加
  - 🔴 下降: 最近7日間が前7日間より10%以上減少
  - ➖ 横ばい: 変化なし

#### 詳細表示
- **サマリーカード**: 総クリック数、総表示回数、平均CTR、平均順位
- **グラフ**: クリック数と順位の日次推移（2軸）
- **トップクエリ**: ページに流入したクエリのランキング

---

## API仕様

### ページデータ取得

```javascript
POST /api/page-tracker

{
  "siteUrl": "https://example.com/",
  "pageUrls": [
    "https://example.com/page1/",
    "https://example.com/page2/"
  ],
  "period": 30
}

// Response
{
  "results": [
    {
      "pageUrl": "https://example.com/page1/",
      "latestDate": "2025-01-20",
      "latestClicks": 150,
      "latestPosition": 3.5,
      "totalClicks": 4500,
      "totalImpressions": 45000,
      "avgCtr": 0.1,
      "avgPosition": 4.2,
      "topQueries": [
        {
          "query": "検索ワード",
          "clicks": 300,
          "impressions": 3000,
          "avgPosition": 3.1
        }
      ],
      "dailyData": [
        {
          "date": "2025-01-20",
          "clicks": 150,
          "impressions": 1500,
          "ctr": 0.1,
          "position": 3.5,
          "topQueries": [...]
        }
      ]
    }
  ]
}
```

### ページ一覧取得

```javascript
GET /api/page-tracker-pages?userId=username&siteUrl=https://example.com/

// Response
{
  "pages": [
    {
      "id": "uuid",
      "pageUrl": "https://example.com/page1/",
      "pageTitle": "ページタイトル",
      "siteUrl": "https://example.com/",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-20T15:30:00Z",
      "dailyData": [...]
    }
  ]
}
```

### ページ保存

```javascript
POST /api/page-tracker-pages

{
  "userId": "username",
  "siteUrl": "https://example.com/",
  "pages": [
    {
      "pageUrl": "https://example.com/page1/",
      "pageTitle": "ページタイトル",
      "dailyData": [...]
    }
  ]
}
```

### ページ削除

```javascript
DELETE /api/page-tracker-pages

{
  "pageId": "uuid"
}
```

---

## データの蓄積方法

### 自動保存
- ページ追加/削除: 即座にSupabaseに保存
- データ取得: 取得した日次データを自動的にSupabaseに追加
- 重複排除: 同じページ・同じ日付のデータは上書き（upsert）

### 履歴の蓄積
1. 初回: 30日分のデータを一括取得
2. 2回目以降: 新しいデータのみ追加
3. 長期蓄積: 取得期間を変えても過去データは保持

例:
```
初回（30日間）: 1/1 ～ 1/30
2回目（7日間）: 1/24 ～ 1/31 → 1/1 ～ 1/31
3回目（30日間）: 2/1 ～ 3/2 → 1/1 ～ 3/2
```

---

## GSCランクトラッカーとの違い

| 項目 | GSCランクトラッカー | GSCページトラッカー |
|------|-------------------|-------------------|
| **追跡単位** | クエリ（検索キーワード） | ページ（URL） |
| **主要指標** | 順位履歴 | クリック数、順位、CTR |
| **関連データ** | トップページURL | トップクエリ一覧 |
| **用途** | キーワード順位監視 | ページパフォーマンス監視 |
| **登録数上限** | 1,000件 | 100件 |

### 使い分け

**GSCランクトラッカー**:
- 重要キーワードの順位を追跡
- SEO施策の効果測定
- 順位変動アラート

**GSCページトラッカー**:
- 重要ページのトラフィック監視
- コンテンツリライト効果測定
- ページごとのクエリ分析

---

## トラブルシューティング

### データが取得できない

**原因**: Search Consoleにページデータが存在しない

**解決策**:
1. URLが正確か確認（最後のスラッシュ含む）
2. 別の期間（60日、90日）で試す
3. Search Consoleで該当ページにデータがあるか確認

### Supabaseエラー

**原因**: テーブルが存在しない、または環境変数未設定

**解決策**:
1. `page-tracker-schema.sql` を実行
2. `.env` ファイルで `SUPABASE_URL` と `SUPABASE_ANON_KEY` を確認
3. サーバーを再起動: `npm run dev`

### ページが保存されない

**原因**: デバウンス機能により1秒後に保存

**解決策**:
- ページ追加後、1秒待つ
- ブラウザのコンソールでエラーを確認

---

## パフォーマンス

### API呼び出し回数
- 1ページあたり1リクエスト
- 10ページ登録の場合: 10リクエスト
- 処理時間: 約1～2秒/ページ

### データ量
- 1ページ・1日あたり: 約1KB
- 100ページ・90日間: 約9MB（JSON形式）

---

## 今後の拡張案

1. **アラート機能**: クリック数が前日比50%以上減少時に通知
2. **自動取得**: 毎日定時に自動実行（Vercel Cron）
3. **比較機能**: 複数ページの比較グラフ
4. **エクスポート**: CSV/PDF形式でレポート出力
5. **AI分析**: Gemini APIでトレンド分析と改善提案

---

## デプロイメント

### Vercelへのデプロイ

```bash
# 全ファイルをコミット
git add .
git commit -m "Add GSC Page Tracker feature"

# 本番環境にデプロイ
vercel --prod
```

### 環境変数の確認

Vercel Dashboardで以下が設定されているか確認:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GOOGLE_CREDENTIALS`

---

## ライセンス

MIT License

---

**実装完了日**: 2025-01-XX
**バージョン**: 1.0.0
