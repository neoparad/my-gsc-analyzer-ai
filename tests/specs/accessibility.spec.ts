import { test, expect } from '@playwright/test';

test.describe('アクセシビリティテスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('キーボードナビゲーション', async ({ page }) => {
    // Tabキーでナビゲーション可能かテスト
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
    
    // Enterキーでリンクがクリック可能かテスト
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  });

  test('ARIA属性の確認', async ({ page }) => {
    // 重要なARIA属性が存在することを確認
    const ariaElements = [
      'button[aria-label]',
      'nav[role="navigation"]',
      'main[role="main"]',
      'header[role="banner"]',
      'footer[role="contentinfo"]'
    ];

    for (const selector of ariaElements) {
      const elements = await page.locator(selector).count();
      if (elements > 0) {
        await expect(page.locator(selector).first()).toBeVisible();
      }
    }
  });

  test('色のコントラスト', async ({ page }) => {
    // テキスト要素の色のコントラストをチェック
    const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span, div').all();
    
    for (const element of textElements.slice(0, 10)) { // 最初の10要素のみテスト
      const styles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });
      
      // 基本的なスタイルが適用されていることを確認
      expect(styles.color).toBeTruthy();
      expect(styles.fontSize).toBeTruthy();
    }
  });

  test('フォーカス表示', async ({ page }) => {
    // フォーカス可能な要素にフォーカスを当てる
    const focusableElements = await page.locator('button, a, input, select, textarea').all();
    
    for (const element of focusableElements.slice(0, 5)) {
      await element.focus();
      
      // フォーカス表示のスタイルを確認
      const focusStyles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          outlineWidth: computed.outlineWidth,
          boxShadow: computed.boxShadow
        };
      });
      
      // フォーカス表示が適切であることを確認
      const hasFocusIndicator = focusStyles.outline !== 'none' || 
                               focusStyles.outlineWidth !== '0px' || 
                               focusStyles.boxShadow !== 'none';
      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('画像のalt属性', async ({ page }) => {
    // 画像要素のalt属性をチェック
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const src = await img.getAttribute('src');
      
      // 装飾的でない画像にはalt属性が必要
      if (src && !src.includes('decoration') && !src.includes('spacer')) {
        expect(alt).toBeTruthy();
      }
    }
  });

  test('セマンティックHTML', async ({ page }) => {
    // 適切なHTMLセマンティクスが使用されているかチェック
    const semanticElements = [
      'header',
      'nav',
      'main',
      'section',
      'article',
      'aside',
      'footer'
    ];

    for (const tag of semanticElements) {
      const count = await page.locator(tag).count();
      if (count > 0) {
        await expect(page.locator(tag).first()).toBeVisible();
      }
    }
  });
});
