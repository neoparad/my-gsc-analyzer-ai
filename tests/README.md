# Playwright自動テストエージェント

このディレクトリには、Webアプリケーションの包括的な自動テストシステムが含まれています。

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Playwrightブラウザのインストール
```bash
npx playwright install
```

## テストの実行

### 開発中のリアルタイムチェック
```bash
npm run test:audit:ui
```
→ Playwright UI Modeで対話的にテストを実行・監視

### CI/CD用の完全チェック
```bash
npm run test:audit
```
→ 全テストを実行してレポート生成

### レポート確認
```bash
npm run test:audit:report
```
→ HTML形式のレポートをブラウザで表示

## テスト構成

### テストファイル
- `specs/comprehensive-audit.spec.ts` - サイト全体の包括的監査
- `specs/visual-regression.spec.ts` - ビジュアル回帰テスト
- `specs/functional.spec.ts` - 機能テスト
- `specs/accessibility.spec.ts` - アクセシビリティテスト
- `specs/performance.spec.ts` - パフォーマンステスト

### ヘルパー
- `helpers/error-collector.ts` - エラー収集機能
- `helpers/page-crawler.ts` - ページ巡回機能

### 設定
- `config/playwright.config.ts` - Playwright設定

## テスト内容

### 包括的監査
- 全ページのエラーチェック
- ビジュアル回帰テスト
- レスポンシブデザインチェック
- パフォーマンスチェック

### ビジュアル回帰テスト
- デスクトップ、モバイル、タブレットでのビジュアルテスト
- スクリーンショット比較による変更検出

### 機能テスト
- ログイン機能
- ナビゲーション機能
- フォーム送信機能
- レスポンシブメニュー
- エラーハンドリング

### アクセシビリティテスト
- キーボードナビゲーション
- ARIA属性の確認
- 色のコントラスト
- フォーカス表示
- 画像のalt属性
- セマンティックHTML

### パフォーマンステスト
- ページ読み込み時間
- Core Web Vitals
- リソースサイズ
- 画像最適化
- JavaScript最適化
- ネットワークリクエスト最適化
- キャッシュ設定

## カスタマイズ

### テスト対象ページの調整
`specs/comprehensive-audit.spec.ts`の`discoveredPages`で巡回するページ数を調整できます。

### ビジュアル回帰テストの調整
`specs/visual-regression.spec.ts`の`maxDiffPixels`で許容範囲を調整できます。

### レスポンシブテストの調整
`specs/visual-regression.spec.ts`の`viewports`配列で対応デバイスを追加できます。

## 注意事項

- 初回実行時はベースラインスクリーンショットが作成されます
- ビジュアル回帰テストは意図的なUI変更後に`--update-snapshots`で更新が必要です
- 大規模サイトでは`maxPages`を調整してテスト時間を管理してください

## レポート

テスト実行後、以下のレポートが生成されます：
- `reports/html/` - HTML形式のレポート
- `reports/results.json` - JSON形式の結果
- `screenshots/` - エラー時のスクリーンショット
- `reports/error-report.json` - エラーレポート
