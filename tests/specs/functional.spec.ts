import { test, expect } from '@playwright/test';

test.describe('機能テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ログイン機能', async ({ page }) => {
    // ログインページに移動
    await page.click('text=ログイン');
    await expect(page).toHaveURL(/.*login/);
    
    // ログインフォームの存在確認
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('ナビゲーション機能', async ({ page }) => {
    // サイドバーのナビゲーションリンクをテスト
    const navLinks = [
      'text=分析',
      'text=ランクトラッカー',
      'text=ページトラッカー',
      'text=ブランド分析',
      'text=引用分析'
    ];

    for (const link of navLinks) {
      await page.click(link);
      await page.waitForLoadState('networkidle');
      
      // ページが正常に読み込まれることを確認
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('フォーム送信機能', async ({ page }) => {
    // 分析ページに移動
    await page.click('text=分析');
    await page.waitForLoadState('networkidle');
    
    // フォーム要素の存在確認
    const formElements = [
      'input[placeholder*="URL"]',
      'input[placeholder*="キーワード"]',
      'button[type="submit"]'
    ];

    for (const selector of formElements) {
      await expect(page.locator(selector)).toBeVisible();
    }
  });

  test('レスポンシブメニュー', async ({ page }) => {
    // モバイルビューに切り替え
    await page.setViewportSize({ width: 375, height: 667 });
    
    // ハンバーガーメニューボタンの存在確認
    const menuButton = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]');
    if (await menuButton.count() > 0) {
      await menuButton.click();
      
      // メニューが開くことを確認
      await expect(page.locator('nav, .sidebar, .menu')).toBeVisible();
    }
  });

  test('エラーハンドリング', async ({ page }) => {
    // 存在しないページにアクセス
    const response = await page.goto('/non-existent-page');
    
    // 404エラーページまたは適切なエラーハンドリングを確認
    if (response && response.status() === 404) {
      await expect(page.locator('text=404, text=Not Found, text=ページが見つかりません')).toBeVisible();
    }
  });
});
