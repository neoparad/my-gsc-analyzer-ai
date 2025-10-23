import { Page } from '@playwright/test';

export class PageCrawler {
  private visitedUrls = new Set<string>();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async discoverPages(page: Page, maxPages = 50): Promise<string[]> {
    const queue = [this.baseUrl];
    const discovered: string[] = [];

    while (queue.length > 0 && discovered.length < maxPages) {
      const url = queue.shift()!;
      
      if (this.visitedUrls.has(url)) continue;
      
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        this.visitedUrls.add(url);
        discovered.push(url);

        // 同じドメインのリンクを収集
        const links = await page.$$eval('a[href]', (elements) =>
          elements
            .map((el) => (el as HTMLAnchorElement).href)
            .filter((href) => href.startsWith(window.location.origin))
        );

        // 新しいURLをキューに追加
        links.forEach((link) => {
          if (!this.visitedUrls.has(link)) {
            queue.push(link);
          }
        });
      } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
      }
    }

    return discovered;
  }
}
