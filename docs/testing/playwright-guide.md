# Playwright自動テストエージェント 使用ガイド

## 概要
このガイドでは、Webアプリケーションの包括的な自動テストシステムの使用方法を説明します。

## セットアップ（初回のみ）

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Playwrightブラウザのインストール
```bash
npx playwright install
```

## 基本的な使用方法

### 1. 開発サーバーの起動
テストを実行する前に、開発サーバーを起動してください：
```bash
npm run dev
```

### 2. テストの実行方法

#### A. 対話的テスト（推奨）
```bash
npm run test:audit:ui
```
- Playwright UI Modeが起動します
- ブラウザでテストを視覚的に確認できます
- テストの実行状況をリアルタイムで監視できます
- デバッグに最適です

#### B. 完全テスト（CI/CD用）
```bash
npm run test:audit
```
- 全テストを自動実行します
- レポートが自動生成されます
- バックグラウンドで実行されます

#### C. レポートの確認
```bash
npm run test:audit:report
```
- HTML形式のレポートをブラウザで表示します
- テスト結果の詳細を確認できます

## テストの種類

### 1. 包括的監査テスト
- **目的**: サイト全体を自動巡回してエラーを検出
- **内容**: 
  - 全ページのエラーチェック
  - ビジュアル回帰テスト
  - レスポンシブデザインチェック
  - パフォーマンスチェック

### 2. ビジュアル回帰テスト
- **目的**: UIの意図しない変更を検出
- **内容**:
  - デスクトップ、モバイル、タブレットでのビジュアルテスト
  - スクリーンショット比較による変更検出

### 3. 機能テスト
- **目的**: アプリケーションの基本機能を確認
- **内容**:
  - ログイン機能
  - ナビゲーション機能
  - フォーム送信機能
  - レスポンシブメニュー
  - エラーハンドリング

### 4. アクセシビリティテスト
- **目的**: アクセシビリティの確保
- **内容**:
  - キーボードナビゲーション
  - ARIA属性の確認
  - 色のコントラスト
  - フォーカス表示
  - 画像のalt属性
  - セマンティックHTML

### 5. パフォーマンステスト
- **目的**: アプリケーションの性能を確認
- **内容**:
  - ページ読み込み時間
  - Core Web Vitals
  - リソースサイズ
  - 画像最適化
  - JavaScript最適化
  - ネットワークリクエスト最適化
  - キャッシュ設定

## 実用的な使用シナリオ

### 開発中の日常的な使用
```bash
# 1. 開発サーバーを起動
npm run dev

# 2. 別のターミナルで対話的テストを実行
npm run test:audit:ui
```

### デプロイ前の最終チェック
```bash
# 完全テストを実行
npm run test:audit

# レポートを確認
npm run test:audit:report
```

### 特定の機能をテストしたい場合
```bash
# 特定のテストファイルのみ実行
npx playwright test tests/specs/functional.spec.ts --config=tests/config/playwright.config.ts
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. テストが失敗する場合
- 開発サーバーが起動しているか確認
- ブラウザが正しくインストールされているか確認
- ネットワーク接続を確認

#### 2. ビジュアル回帰テストで意図しない変更が検出された場合
```bash
# ベースラインスクリーンショットを更新
npx playwright test --update-snapshots --config=tests/config/playwright.config.ts
```

#### 3. テストが遅い場合
- `tests/specs/comprehensive-audit.spec.ts`の`maxPages`を調整
- 不要なテストを無効化

### ログの確認
```bash
# 詳細なログを表示
npx playwright test --config=tests/config/playwright.config.ts --reporter=list
```

## カスタマイズ

### テスト対象ページの調整
`tests/specs/comprehensive-audit.spec.ts`を編集：
```typescript
// 巡回するページ数を調整
discoveredPages = await crawler.discoverPages(page, 20); // 20を変更
```

### ビジュアル回帰テストの調整
`tests/specs/visual-regression.spec.ts`を編集：
```typescript
// 許容範囲を調整
await expect(page).toHaveScreenshot(`${pageName}.png`, {
  maxDiffPixels: 100, // この値を調整
  threshold: 0.2,     // この値を調整
});
```

### レスポンシブテストの調整
`tests/specs/visual-regression.spec.ts`を編集：
```typescript
// 対応デバイスを追加
const viewports = [
  { width: 375, height: 667, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1920, height: 1080, name: 'desktop' },
  // 新しいデバイスを追加
];
```

## レポートの理解

### 生成されるファイル
- `tests/reports/html/` - HTML形式のレポート
- `tests/reports/results.json` - JSON形式の結果
- `tests/screenshots/` - エラー時のスクリーンショット
- `tests/reports/error-report.json` - エラーレポート

### レポートの見方
1. **HTMLレポート**: ブラウザで開いて視覚的に確認
2. **エラーレポート**: JSON形式で詳細なエラー情報を確認
3. **スクリーンショット**: エラー発生時の画面を確認

## ベストプラクティス

### 1. 定期的な実行
- 開発中は対話的テストを頻繁に実行
- デプロイ前は完全テストを実行

### 2. チームでの使用
- レポートを共有して品質を管理
- エラーが発生した場合はスクリーンショットを確認

### 3. 継続的改善
- テスト結果を分析してアプリケーションを改善
- 新しい機能追加時はテストを更新

## サポート

問題が発生した場合は、以下を確認してください：
1. 開発サーバーが起動しているか
2. ブラウザが正しくインストールされているか
3. ネットワーク接続が正常か
4. テスト設定ファイルが正しいか

詳細な情報は `tests/README.md` を参照してください。
