import { Page } from '@playwright/test';

export interface Issue {
  type: 'console' | 'page' | 'network' | 'visual';
  severity: 'error' | 'warning' | 'info';
  message: string;
  url?: string;
  timestamp: string;
  screenshot?: string;
}

export class ErrorCollector {
  private issues: Issue[] = [];

  setupListeners(page: Page) {
    // コンソールエラー
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        this.issues.push({
          type: 'console',
          severity: 'error',
          message: msg.text(),
          url: page.url(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    // ページエラー（未処理の例外）
    page.on('pageerror', async (error) => {
      this.issues.push({
        type: 'page',
        severity: 'error',
        message: error.message,
        url: page.url(),
        timestamp: new Date().toISOString(),
      });
    });

    // ネットワークエラー（失敗したリクエスト）
    page.on('response', async (response) => {
      if (response.status() >= 400) {
        this.issues.push({
          type: 'network',
          severity: response.status() >= 500 ? 'error' : 'warning',
          message: `${response.status()} - ${response.url()}`,
          url: page.url(),
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  getIssues(): Issue[] {
    return this.issues;
  }

  clear() {
    this.issues = [];
  }
}
