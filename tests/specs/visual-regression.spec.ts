import { test, expect } from '@playwright/test';

test.describe('ビジュアル回帰テスト', () => {
  const testPages = [
    '/',
    '/login',
    '/analysis',
    '/rank-tracker',
    '/page-tracker'
  ];

  test('デスクトップビジュアルテスト', async ({ page }) => {
    for (const path of testPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      const pageName = path === '/' ? 'home' : path.replace('/', '');
      await expect(page).toHaveScreenshot(`${pageName}-desktop.png`, {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('モバイルビジュアルテスト', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    for (const path of testPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      const pageName = path === '/' ? 'home' : path.replace('/', '');
      await expect(page).toHaveScreenshot(`${pageName}-mobile.png`, {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('タブレットビジュアルテスト', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    for (const path of testPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      const pageName = path === '/' ? 'home' : path.replace('/', '');
      await expect(page).toHaveScreenshot(`${pageName}-tablet.png`, {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });
});
