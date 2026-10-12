import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'llm.spec.ts', outputDir: '../test-results-llm', workers: 1, forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://127.0.0.1:5174', locale: 'ja-JP', screenshot: 'only-on-failure' },
  projects: [
    { name: 'llm-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'llm-mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174/oitoma-dev/', reuseExistingServer: !process.env.CI, timeout: 30_000,
    env: { OITOMA_API_KEY: '', OITOMA_MODEL: '' } },
});
