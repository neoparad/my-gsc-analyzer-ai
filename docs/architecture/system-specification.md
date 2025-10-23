# システム仕様書

## 📋 プロジェクト概要

**GSC Ranking Analyzer** は、Google Search Consoleデータを活用したオールインワンSEO分析プラットフォームです。

### プロジェクト名
- **正式名称**: GSC Ranking Analyzer
- **コード名**: AISEO Analyze
- **バージョン**: 1.0.0
- **最終更新**: 2025年10月23日

---

## 🏗️ システムアーキテクチャ

### 技術スタック

#### フロントエンド
- **フレームワーク**: React 18
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS
- **ルーティング**: React Router v7
- **状態管理**: React Context API
- **データ可視化**: Recharts
- **アイコン**: Lucide React

#### バックエンド
- **プラットフォーム**: Vercel Serverless Functions
- **ランタイム**: Node.js
- **認証**: JWT + bcryptjs
- **データベース**: Supabase (PostgreSQL)
- **AI**: Google Gemini API

#### 外部API連携
- **Google Search Console API**
- **Google Sheets API**
- **Google Ads API**
- **PageSpeed Insights API**
- **Common Crawl API**

#### インフラ
- **ホスティング**: Vercel
- **リージョン**: Tokyo (hnd1)
- **認証**: Basic認証 + JWT
- **キャッシング**: Vercel Edge Cache

---

## ✨ 実装済み機能

### 1. 🤖 サーチコンソールAI（AIチャット分析）
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/ChatAI.jsx`
- **バックエンド**: `api/chat.js`
- **機能**: Gemini AIによる自然言語でのデータ分析

### 2. 📊 GSCランクトラッカー
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/RankTracker.jsx`
- **バックエンド**: `api/rank-tracker.js`, `api/rank-tracker-queries.js`, `api/rank-tracker-ai.js`
- **データベース**: Supabase（`rank_tracker_queries`, `rank_tracker_history`）
- **機能**: キーワード順位追跡、AI分析、統計分析

### 3. 📄 GSCページトラッカー
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/PageTracker.jsx`
- **バックエンド**: `api/page-tracker.js`, `api/page-tracker-pages.js`
- **データベース**: Supabase（`page_tracker_pages`, `page_tracker_daily`）
- **機能**: ページ別パフォーマンス追跡

### 4. 🔍 比較分析（順位変化分析）
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/ComparisonPage.jsx`
- **バックエンド**: `api/analyze.js`
- **機能**: 2期間比較、散布図可視化、CSVエクスポート

### 5. 📁 ディレクトリアクセス分析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/DirectoryAnalysis.jsx`
- **バックエンド**: `api/directory-analysis.js`
- **機能**: URLパス別アクセス分析

### 6. 🥧 クエリ順位シェア分析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/QueryRankShare.jsx`
- **バックエンド**: `api/query-rank-share.js`
- **機能**: 順位帯別クエリ分析

### 7. 🏷️ ブランドキーワード分析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/BrandAnalysis.jsx`
- **バックエンド**: `api/brand-analysis.js`
- **機能**: ブランド/非ブランドキーワード分析

### 8. 🔗 サイテーション分析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/CitationAnalysis.jsx`
- **バックエンド**: `api/citation-analysis.js`, `api/citation-stats.js`, `api/citation-status.js`, `api/citation-competitor.js`
- **データベース**: Supabase（`citations`, `analysis_jobs`, `citation_scores`, `monthly_citations`, `crawl_cache`）
- **機能**: Common Crawlデータ活用、被リンク分析、AI分析

### 9. 🎯 SEO VS 広告比較（カニバリゼーション分析）
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/AdsCannibalizationAnalysis.jsx`
- **バックエンド**: `api/ads-cannibalization.js`, `api/fetch-google-ads.js`, `api/fetch-campaigns.js`
- **機能**: Google Ads API連携、SEOと広告の競合分析

### 10. ⚡ ページスピード分析AI
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/PageSpeedAnalysisV2.jsx`
- **バックエンド**: `api/pagespeed-analysis.js`
- **機能**: PageSpeed Insights API、Puppeteerクロール、AI改善提案

### 11. 💻 CSS/JavaScript解析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/CSSJSAnalysis.jsx`
- **バックエンド**: `api/cssjs-analysis/analyze.js`, `api/cssjs-analysis/ai-diagnosis.js`
- **機能**: CSS/JSファイル解析、AI診断

### 12. 🔎 インデックス分析
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/IndexAnalysis.jsx`
- **バックエンド**: `api/index-inspection/start.js`, `api/index-inspection/status/[jobId].js`, `api/index-inspection/results/[jobId].js`
- **機能**: 最大50,000件のURLインデックス状態一括調査

### 13. ❓ よくある質問メーカー
- **実装状況**: ✅ 完了
- **フロントエンド**: `src/FAQMaker.jsx`
- **バックエンド**: `api/faq-maker.js`
- **機能**: AI FAQ生成、構造化データマークアップ

### 14. 📊 包括的分析
- **実装状況**: ✅ 完了
- **バックエンド**: `api/comprehensive-analysis.js`
- **機能**: 複数分析の統合実行

---

## 🚧 実装途中・未実装機能

### 実装途中の機能
現在、実装途中の機能はありません。全ての主要機能が完了しています。

### 未実装機能（将来の拡張案）

#### 短期（1-3ヶ月）
- **ダッシュボード機能**: 全分析を1画面で表示
- **スケジュール実行**: 毎週月曜9時に自動分析
- **Slackボット**: 順位変動をSlackに通知
- **モバイルアプリ**: PWA対応

#### 中期（3-6ヶ月）
- **競合分析**: 他サイトとの比較機能
- **キーワード提案**: 獲得すべきキーワードをAI提案
- **コンテンツ最適化**: ページ内容の改善提案
- **被リンク分析**: GSCデータから被リンク分析

#### 長期（6-12ヶ月）
- **マルチユーザー**: チーム機能
- **レポート自動生成**: PDFレポートを自動作成
- **A/Bテスト**: タイトル変更の効果測定
- **音声分析**: 音声でAIに質問

---

## 📊 データベーススキーマ

### Supabaseテーブル構成

#### ランクトラッカー関連
- `rank_tracker_queries`: クエリ情報
- `rank_tracker_history`: 順位履歴

#### ページトラッカー関連
- `page_tracker_pages`: ページ情報
- `page_tracker_daily`: 日次パフォーマンスデータ

#### サイテーション分析関連
- `citations`: 被リンク・言及データ
- `analysis_jobs`: 分析ジョブ管理
- `citation_scores`: 月次スコア集計
- `monthly_citations`: 月次推移データ
- `crawl_cache`: Common Crawlキャッシュ

#### インデックス分析関連
- `index_inspection_jobs`: インデックス検査ジョブ

---

## 🔌 API仕様

### 主要エンドポイント

#### 認証
- `POST /api/login` - ログイン認証

#### 分析機能
- `POST /api/analyze` - 順位変化分析
- `POST /api/detailed-analysis` - 詳細統計分析
- `POST /api/ai-analysis` - AI分析
- `POST /api/comprehensive-analysis` - 包括的分析

#### ランクトラッカー
- `GET /api/rank-tracker-queries` - クエリ一覧取得
- `POST /api/rank-tracker-queries` - クエリ保存
- `DELETE /api/rank-tracker-queries` - クエリ削除
- `POST /api/rank-tracker-ai` - AI分析

#### ページトラッカー
- `GET /api/page-tracker-pages` - ページ一覧取得
- `POST /api/page-tracker-pages` - ページ保存
- `DELETE /api/page-tracker-pages` - ページ削除
- `POST /api/page-tracker` - ページデータ取得

#### サイテーション分析
- `POST /api/citation-analysis` - 分析開始
- `GET /api/citation-status` - ジョブ状態確認
- `GET /api/citation-stats` - 統計情報取得
- `POST /api/citation-competitor` - 競合比較

#### その他
- `POST /api/create_sheet` - Googleスプレッドシート作成
- `POST /api/faq-maker` - FAQ生成
- `POST /api/cssjs-analysis/analyze` - CSS/JS解析
- `POST /api/cssjs-analysis/ai-diagnosis` - AI診断

---

## 🧪 テスト戦略

### 実装済みテスト
- **Playwright E2Eテスト**: 包括的監査、ビジュアル回帰、機能、アクセシビリティ、パフォーマンステスト
- **テストファイル**: `tests/specs/` 配下
- **ヘルパー**: `tests/helpers/` 配下

### テスト実行方法
```bash
# 対話的テスト
npm run test:audit:ui

# 完全テスト
npm run test:audit

# レポート確認
npm run test:audit:report
```

---

## 📈 パフォーマンス指標

### 処理能力
- **ランクトラッカー**: 最大1,000クエリ
- **ページトラッカー**: 最大100ページ
- **インデックス分析**: 最大50,000URL
- **サイテーション分析**: 最大50件/月

### 制限事項
- **API呼び出し**: Google API制限に準拠
- **処理時間**: 大規模データは非同期処理
- **ブラウザ要件**: モダンブラウザ対応

---

## 🔒 セキュリティ

### 認証・認可
- **Basic認証**: 全APIエンドポイント
- **JWT**: セッション管理
- **環境変数**: 機密情報の管理

### データ保護
- **HTTPS**: 全通信の暗号化
- **CORS**: 適切なオリジン制限
- **入力検証**: 全APIでバリデーション

---

## 📚 ドキュメント構成

### 実装済みドキュメント
- **機能仕様**: `docs/features/` 配下
- **セットアップ**: `docs/getting-started/` 配下
- **インフラ**: `docs/infrastructure/` 配下
- **テスト**: `docs/testing/` 配下

### 不足しているドキュメント
- **API仕様書**: `docs/api/` 配下（未作成）
- **アーキテクチャ図**: `docs/architecture/` 配下（未作成）
- **開発ガイドライン**: `docs/development/` 配下（未作成）

---

## 🎯 今後の開発計画

### 優先度：高
1. **API仕様書の作成**
2. **アーキテクチャ図の作成**
3. **開発ガイドラインの整備**

### 優先度：中
1. **ダッシュボード機能の実装**
2. **スケジュール実行機能の実装**
3. **モバイル対応の強化**

### 優先度：低
1. **競合分析機能の実装**
2. **マルチユーザー機能の実装**
3. **音声分析機能の実装**

---

**最終更新**: 2025年10月23日  
**作成者**: Claude (Anthropic)  
**プロジェクト**: GSC Ranking Analyzer System Specification
