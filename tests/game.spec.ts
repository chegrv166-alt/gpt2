import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Application entry is missing');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return {
      position: { ...scene.player.motor.position },
      mode: scene.player.motor.mode,
      state: scene.player.motor.state,
      direction: scene.player.motor.direction,
      path: scene.player.motor.path.map((point) => ({ ...point })),
      animation: scene.player.sprite.anims.currentAnim?.key,
      scrollX: scene.cameras.main.scrollX,
      scrollY: scene.cameras.main.scrollY,
      zoom: scene.cameras.main.zoom,
      canOccupy: scene.layout.grid.canOccupy(scene.player.motor.position, scene.player.motor.radius),
    };
  });
}

async function clickGround(page: Page, target: { x: number; y: number }, touch = false): Promise<void> {
  const point = await page.evaluate(async (destination) => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Application entry is missing');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    const world = scene.arena.toScreen(destination);
    const camera = scene.cameras.main;
    const canvas = game.canvas.getBoundingClientRect();
    return {
      x: canvas.left + ((world.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      y: canvas.top + ((world.y - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height,
    };
  }, target);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

test('arena starts with procedural art and no external runtime requests', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await expect(page.locator('#game-stage canvas')).toBeVisible();
  expect((await snapshot(page)).position).toEqual({ x: 5, y: 17 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('WASD moves in screen directions, animates the hero and advances the follow camera', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const start = await snapshot(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await snapshot(page)).position.x, { timeout: 5000 }).toBeGreaterThan(start.position.x + 1);
  const moving = await snapshot(page);
  await page.keyboard.up('d');
  expect(moving.position.y).toBeLessThan(start.position.y - 0.8);
  expect(moving.direction).toBe('e');
  expect(moving.animation).toBe('hero-walk-e');
  await expect.poll(async () => (await snapshot(page)).state).toBe('idle');
  await expect.poll(async () => (await snapshot(page)).scrollX).toBeGreaterThan(start.scrollX + 35);
  expect((await snapshot(page)).canOccupy).toBe(true);
});

test('ground click shows a target and follows a route around the broken wall', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await clickGround(page, { x: 5, y: 11 });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('path');
  const route = await snapshot(page);
  expect(route.path.some((point) => Math.abs(point.x - 5) > 0.5)).toBe(true);
  await expect(page.getByTestId('destination-status')).toContainText('проложен');
  await expect.poll(async () => {
    const { position } = await snapshot(page);
    return Math.hypot(position.x - 5, position.y - 11);
  }, { timeout: 12_000 }).toBeLessThan(0.08);
  expect((await snapshot(page)).canOccupy).toBe(true);
  await expect.poll(async () => (await snapshot(page)).state).toBe('idle');
});

test('blocked clicks are rejected and keyboard input cancels click movement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await clickGround(page, { x: 5, y: 13 });
  await expect(page.getByTestId('destination-status')).toContainText('пройти');
  expect((await snapshot(page)).position).toEqual({ x: 5, y: 17 });
  await clickGround(page, { x: 5, y: 11 });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('path');
  await page.keyboard.down('a');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('keyboard');
  expect((await snapshot(page)).path).toEqual([]);
  await page.keyboard.up('a');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('idle');
});

test('zoom preserves ground picking and restart returns the hero to the spawn', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.getByRole('button', { name: 'Приблизить' }).click();
  await expect.poll(async () => (await snapshot(page)).zoom).toBeGreaterThan(1);
  await clickGround(page, { x: 7, y: 17 });
  await expect.poll(async () => (await snapshot(page)).position.x, { timeout: 6000 }).toBeGreaterThan(6.8);
  await page.getByRole('button', { name: 'Вернуться к началу' }).click();
  expect((await snapshot(page)).position).toEqual({ x: 5, y: 17 });
  expect((await snapshot(page)).state).toBe('idle');
});

test('Escape cancels the route and focus loss releases held movement keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await clickGround(page, { x: 5, y: 11 });
  await expect.poll(async () => (await snapshot(page)).mode).toBe('path');
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByTestId('destination-status')).toContainText('Остановлено');
  await page.keyboard.down('d');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('keyboard');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(async () => (await snapshot(page)).mode).toBe('idle');
  await page.keyboard.up('d');
});

test.describe('mobile arena', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('touch movement works and the asset forge remains available', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
    await clickGround(page, { x: 7, y: 17 }, true);
    await expect.poll(async () => (await snapshot(page)).position.x, { timeout: 6000 }).toBeGreaterThan(6.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Кузница ассетов', exact: true }).click();
    await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  });
});

test('destroying the game releases window-level input listeners', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Application entry is missing');
    const { game }: { game: Phaser.Game } = await import(entry);
    await new Promise<void>((resolve) => {
      game.events.once('destroy', () => requestAnimationFrame(() => resolve()));
      game.destroy(true);
    });
  });
  await page.keyboard.press('r');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(errors).toEqual([]);
});
