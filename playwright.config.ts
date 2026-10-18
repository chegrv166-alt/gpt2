import { defineConfig } from '@playwright/test';

const executablePath = process.env['CHROMIUM_PATH'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--disable-dev-shm-usage', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env['CI'],
  },
});
