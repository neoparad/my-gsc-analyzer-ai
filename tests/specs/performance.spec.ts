import { test, expect } from '@playwright/test';

test.describe('パフォーマンステスト', () => {
  test('ページ読み込み時間', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // ページの読み込み時間が3秒以内であることを確認
    expect(loadTime).toBeLessThan(3000);
  });

  test('Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Performance APIを使用してCore Web Vitalsを測定
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'LCP') {
              vitals.lcp = entry.startTime;
            } else if (entry.name === 'FID') {
              vitals.fid = entry.startTime;
            } else if (entry.name === 'CLS') {
              vitals.cls = entry.value;
            }
          });
          
          resolve(vitals);
        }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
        
        // タイムアウト設定
        setTimeout(() => resolve({}), 5000);
      });
    });
    
    // Core Web Vitalsの閾値をチェック
    if (metrics.lcp) {
      expect(metrics.lcp).toBeLessThan(2500); // LCP < 2.5s
    }
    
    if (metrics.fid) {
      expect(metrics.fid).toBeLessThan(100); // FID < 100ms
    }
    
    if (metrics.cls) {
      expect(metrics.cls).toBeLessThan(0.1); // CLS < 0.1
    }
  });

  test('リソースサイズ', async ({ page }) => {
    const response = await page.goto('/');
    const contentLength = response?.headers()['content-length'];
    
    if (contentLength) {
      // HTMLサイズが1MB以内であることを確認
      expect(parseInt(contentLength)).toBeLessThan(1024 * 1024);
    }
  });

  test('画像最適化', async ({ page }) => {
    await page.goto('/');
    
    // 画像要素の最適化をチェック
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src) {
        // WebP形式または適切な形式が使用されているかチェック
        const isOptimized = src.includes('.webp') || 
                           src.includes('.jpg') || 
                           src.includes('.jpeg') || 
                           src.includes('.png');
        expect(isOptimized).toBeTruthy();
      }
    }
  });

  test('JavaScript最適化', async ({ page }) => {
    await page.goto('/');
    
    // JavaScriptファイルの読み込み時間をチェック
    const jsFiles = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.map(script => ({
        src: script.src,
        async: script.async,
        defer: script.defer
      }));
    });
    
    // 重要なスクリプトが適切に最適化されているかチェック
    for (const script of jsFiles) {
      if (script.src.includes('main') || script.src.includes('app')) {
        // メインスクリプトは非同期または遅延読み込みが推奨
        const isOptimized = script.async || script.defer;
        expect(isOptimized).toBeTruthy();
      }
    }
  });

  test('ネットワークリクエスト最適化', async ({ page }) => {
    const requests: string[] = [];
    
    page.on('request', (request) => {
      requests.push(request.url());
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 不要なリクエストがないかチェック
    const unnecessaryRequests = requests.filter(url => 
      url.includes('analytics') || 
      url.includes('tracking') || 
      url.includes('ads')
    );
    
    // 不要なリクエストが最小限であることを確認
    expect(unnecessaryRequests.length).toBeLessThan(5);
  });

  test('キャッシュ設定', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    // 適切なキャッシュヘッダーが設定されているかチェック
    const cacheControl = headers?.['cache-control'];
    const etag = headers?.['etag'];
    
    if (cacheControl) {
      // 静的リソースには適切なキャッシュ設定が必要
      expect(cacheControl).toMatch(/max-age|no-cache/);
    }
  });
});
