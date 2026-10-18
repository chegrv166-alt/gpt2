import { expect, test, _electron as electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import path from 'node:path';

let application: ElectronApplication;

test.beforeEach(async () => {
  const executable = process.env['DESKTOP_EXECUTABLE'];
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) environment[key] = value;
  if (process.platform === 'linux') {
    environment['XDG_CONFIG_HOME'] = '/tmp/ashen-electron-config';
    environment['XDG_CACHE_HOME'] = '/tmp/ashen-electron-cache';
  }
  const extraArgs = process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--ozone-platform=headless'] : [];
  application = await electron.launch({
    ...(executable ? { executablePath: executable } : {}),
    args: [...extraArgs, ...(executable ? [] : [path.resolve('desktop-dist/main.cjs')])],
    timeout: 30_000,
    env: environment,
  });
});

test.afterEach(async () => { if (application) await application.close(); });

test('desktop starts offline from bundled files in a full-window arena', async () => {
  const page = await application.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const state = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-stage canvas');
    const rect = canvas?.getBoundingClientRect();
    return { protocol: location.protocol, desktop: document.body.classList.contains('desktop-mode'),
      width: rect?.width, height: rect?.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(state.protocol).toBe('file:');
  expect(state.desktop).toBe(true);
  expect(state.width).toBeCloseTo(state.viewportWidth, 0);
  expect(state.height).toBeCloseTo(state.viewportHeight, 0);
  const rendererGlobals = await page.evaluate(() => {
    const global = window as Window & { require?: unknown; process?: unknown };
    return { node: typeof global.require, process: typeof global.process };
  });
  expect(rendererGlobals).toEqual({ node: 'undefined', process: 'undefined' });
  expect(errors).toEqual([]);
});

test('packaged keyboard controls cast, open inventory, close it and reset resources', async () => {
  const page = await application.firstWindow();
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.keyboard.press('q');
  await expect.poll(async () => Number((await page.getByTestId('hero-mana').textContent())?.split('/')[0])).toBeLessThan(80);
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#inventory-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('r');
  await expect(page.getByTestId('hero-health')).toHaveText('160 / 160');
  await expect(page.getByTestId('hero-mana')).toHaveText('80 / 80');
});

test('bundled local view routes preserve desktop mode without a server', async () => {
  const page = await application.firstWindow();
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.locator('a[href*="view=forge"]').evaluate((anchor: HTMLAnchorElement) => anchor.click());
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  await page.getByRole('link', { name: 'В святилище →' }).click();
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  expect(new URL(page.url()).protocol).toBe('file:');
  await expect(page.locator('body')).toHaveClass(/desktop-mode/);
});
