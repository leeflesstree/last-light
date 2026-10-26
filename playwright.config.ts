import { defineConfig } from '@playwright/test';
const localUrl = `http://localhost:${process.env.TEST_PORT ?? '3000'}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.PUBLIC_TEST_URL ?? localUrl, browserName: 'chromium', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 30_000 },
  webServer: process.env.PUBLIC_TEST_URL ? undefined : { command: 'node dist/server/index.js --production', env: { PORT: process.env.TEST_PORT ?? '3000' }, url: `${localUrl}/health`, reuseExistingServer: !process.env.CI },
});
