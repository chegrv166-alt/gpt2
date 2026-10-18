import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

test('combat arena exposes health, mana and working skill cooldown', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await expect(page.getByTestId('hero-health')).toHaveText('160 / 160');
  await expect(page.getByTestId('hero-mana')).toHaveText('80 / 80');
  await page.keyboard.press('q');
  await expect.poll(async () => {
    const text = await page.getByTestId('hero-mana').textContent();
    return Number(text?.split('/')[0]?.trim());
  }).toBeLessThan(80);
  await expect(page.getByTestId('skill-cooldown')).not.toHaveText('Готов');
  await expect(page.getByTestId('skill-cooldown')).toHaveText('Готов', { timeout: 6000 });
  expect(errors).toEqual([]);
});

test('clicking an enemy approaches, strikes and reduces its actual health', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const target = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    const enemy = scene.battle.enemies[0];
    if (!enemy) throw new Error('Expected a melee enemy');
    const point = scene.arena.toScreen(enemy.motor.position);
    const camera = scene.cameras.main;
    const canvas = game.canvas.getBoundingClientRect();
    return {
      id: enemy.id, hp: enemy.stats.hp,
      x: canvas.left + ((point.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      y: canvas.top + ((point.y - 38 - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height,
    };
  });
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => page.evaluate(async (id) => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return scene.battle.enemies.find((enemy) => enemy.id === id)?.stats.hp ?? -1;
  }, target.id), { timeout: 10_000 }).toBeLessThan(target.hp);
});

test('right click casts, and reset restores combat resources and enemies', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.mouse.click(canvas.x + canvas.width / 2 + 130, canvas.y + canvas.height / 2, { button: 'right' });
  await expect.poll(async () => {
    const text = await page.getByTestId('hero-mana').textContent();
    return Number(text?.split('/')[0]?.trim());
  }).toBeLessThan(80);
  await page.getByRole('button', { name: 'Вернуться к началу' }).click();
  await expect(page.getByTestId('hero-health')).toHaveText('160 / 160');
  await expect(page.getByTestId('hero-mana')).toHaveText('80 / 80');
  await expect(page.getByTestId('enemy-count')).toHaveText('6');
});

test('Shift-click swings in place and uses the actual attack animation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  if (!canvas) throw new Error('Missing game canvas');
  await page.keyboard.down('Shift');
  await page.mouse.click(canvas.x + canvas.width / 2 + 90, canvas.y + canvas.height / 2 + 45);
  await page.keyboard.up('Shift');
  const report = () => page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return { position: scene.player.motor.position, animation: scene.player.sprite.anims.currentAnim?.key };
  });
  await expect.poll(async () => (await report()).animation).toMatch(/^hero-attack-/);
  const actual = await report();
  expect(actual.position).toEqual({ x: 5, y: 17 });
});

test('boss renders a cached warning before its blast causes real player damage', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    scene.player.motor.reset({ x: 17, y: 5.3 });
    scene.player.render('idle');
    scene.cameras.main.centerOn(scene.player.sprite.x, scene.player.sprite.y - 45);
    scene.cameras.main.preRender();
  });
  await expect.poll(async () => page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return scene.children.list.some((object) => {
      if (object.type !== 'Image') return false;
      const image = object as Phaser.GameObjects.Image;
      return image.texture.key === 'fx-telegraph' && image.depth === -9994 && image.visible;
    });
  })).toBe(true);
  await expect.poll(async () => Number((await page.getByTestId('hero-health').textContent())?.split('/')[0]),
    { timeout: 6000 }).toBeLessThan(160);
});
