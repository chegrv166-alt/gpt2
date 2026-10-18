import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45_000,
  outputDir: '../test-results/desktop',
  use: { trace: 'retain-on-failure' },
});
