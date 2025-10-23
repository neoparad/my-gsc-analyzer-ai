# GSC Ranking Analyzer

> Google Search Consoleデータを活用したオールインワンSEO分析プラットフォーム

## 🚀 クイックスタート

```bash
# セットアップ
npm install

# 開発サーバー起動
npm run dev

# テスト実行
npm run test:audit
```

詳細は [📖 クイックスタートガイド](docs/getting-started/quick-start.md) を参照

## ✨ 主な機能

- **引用分析** - 学術論文や記事の引用データを収集・分析
- **インデックス分析** - 検索インデックスの最適化と監視
- **ページトラッキング** - ユーザー行動とページビューの追跡
- **製品分析** - 製品データの収集と洞察の抽出
- **AI分析** - Gemini AIによる自動分析と改善提案

## 📚 ドキュメント

全てのドキュメントは [`docs/`](docs/) フォルダに整理されています：

| カテゴリ | 説明 |
|---------|------|
| [🚀 はじめに](docs/getting-started/) | 環境構築とクイックスタート |
| [✨ 機能](docs/features/) | 各機能の詳細仕様 |
| [🧪 テスト](docs/testing/) | テスト戦略とガイド |
| [🏗️ インフラ](docs/infrastructure/) | データベースとデプロイ設定 |
| [🏛️ アーキテクチャ](docs/architecture/) | システム設計と構成 |

**👉 まずは [docs/README.md](docs/README.md) をご覧ください**

## 🛠️ 技術スタック

- **フロントエンド**: React 18 + Vite + Tailwind CSS
- **バックエンド**: Vercel Serverless Functions
- **データベース**: Supabase (PostgreSQL)
- **テスト**: Playwright
- **AI**: Google Gemini API
- **その他**: Google Search Console API, Google Sheets API

## 🤝 コントリビューション

[CONTRIBUTING.md](docs/development/contributing.md) をご確認ください

## 📄 ライセンス

MIT License