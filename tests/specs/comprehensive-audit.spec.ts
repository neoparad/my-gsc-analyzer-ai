import { test, expect } from '@playwright/test';
import { ErrorCollector } from '../helpers/error-collector';
import { PageCrawler } from '../helpers/page-crawler';
import fs from 'fs';
import path from 'path';

test.describe('サイト全体の包括的監査', () => {
  let errorCollector: ErrorCollector;
  let discoveredPages: string[];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const crawler = new PageCrawler(process.env.BASE_URL || 'http://localhost:3000');
    discoveredPages = await crawler.discoverPages(page, 20);
    await page.close();
    
    console.log(`発見されたページ数: ${discoveredPages.length}`);
  });

  test.beforeEach(async ({ page }) => {
    errorCollector = new ErrorCollector();
    errorCollector.setupListeners(page);
  });

  test('全ページのエラーチェック', async ({ page }) => {
    const allIssues: any[] = [];

    for (const url of discoveredPages) {
      errorCollector.clear();
      
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const issues = errorCollector.getIssues();
      if (issues.length > 0) {
        allIssues.push({ url, issues });
        
        // スクリーンショット撮影
        const filename = url.replace(/[^a-z0-9]/gi, '_') + '.png';
        await page.screenshot({ 
          path: path.join('tests/screenshots', filename),
          fullPage: true 
        });
      }
    }

    // レポート生成
    if (allIssues.length > 0) {
      fs.writeFileSync(
        'tests/reports/error-report.json',
        JSON.stringify(allIssues, null, 2)
      );
    }

    expect(allIssues, `エラーが見つかりました: ${JSON.stringify(allIssues, null, 2)}`).toHaveLength(0);
  });

  test('ビジュアル回帰テスト', async ({ page }) => {
    for (const url of discoveredPages.slice(0, 5)) { // 主要ページのみ
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const pageName = url.split('/').pop() || 'home';
      await expect(page).toHaveScreenshot(`${pageName}.png`, {
        maxDiffPixels: 100,
      });
    }
  });

  test('レスポンシブデザインチェック', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      for (const url of discoveredPages.slice(0, 3)) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // レイアウト崩れチェック
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        expect(hasOverflow, `${url} で横スクロールが発生 (${viewport.name})`).toBe(false);
      }
    }
  });

  test('パフォーマンスチェック', async ({ page }) => {
    for (const url of discoveredPages.slice(0, 5)) {
      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      expect(loadTime, `${url} の読み込みが遅すぎます: ${loadTime}ms`).toBeLessThan(3000);
    }
  });
});
