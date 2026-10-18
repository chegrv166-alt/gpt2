import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return { bag: scene.adventure?.inventory.count ?? -1, open: scene.adventure?.inventoryOpen ?? false,
      position: { ...scene.player.motor.position }, mana: scene.player.stats.mana,
      values: scene.player.stats.values, outcome: scene.adventure?.outcome,
      equipment: scene.adventure?.inventory.equipment };
  });
}

async function worldTarget(page: Page, kind: 'enemy' | 'drop') {
  return page.evaluate(async (type) => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    const position = type === 'enemy' ? scene.battle.enemies[0]?.motor.position : scene.adventure.loot.drops[0]?.position;
    if (!position) throw new Error(`Missing ${type}`);
    const point = scene.arena.toScreen(position);
    const camera = scene.cameras.main;
    const canvas = game.canvas.getBoundingClientRect();
    return {
      x: canvas.left + ((point.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      y: canvas.top + ((point.y - (type === 'enemy' ? 38 : 13) - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height,
    };
  }, kind);
}

test('a real kill drops loot, clicking collects it, and inventory pauses combat while equipment changes stats', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const enemy = await worldTarget(page, 'enemy');
  await page.mouse.click(enemy.x, enemy.y);
  await expect(page.getByTestId('enemy-count')).toHaveText('5', { timeout: 15000 });
  await expect.poll(async () => (await snapshot(page)).bag).toBe(0);
  const drop = await worldTarget(page, 'drop');
  await page.mouse.click(drop.x, drop.y);
  await expect.poll(async () => (await snapshot(page)).bag).toBe(1);
  await page.keyboard.press('i');
  await expect.poll(async () => (await snapshot(page)).open).toBe(true);
  const before = await snapshot(page);
  await page.keyboard.down('d');
  await page.keyboard.press('q');
  await page.waitForTimeout(350);
  await page.keyboard.up('d');
  const paused = await snapshot(page);
  expect(paused.position).toEqual(before.position);
  expect(paused.mana).toBe(before.mana);
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    (game.scene.getScene('GameScene') as GameScene).equipItem(0);
  });
  const equipped = await snapshot(page);
  expect(equipped.bag).toBe(0);
  expect(equipped.values.attackDamage > before.values.attackDamage || equipped.values.armor > before.values.armor).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).open).toBe(false);
  await page.keyboard.press('r');
  const reset = await snapshot(page);
  expect(reset.bag).toBe(0);
  expect(reset.values.attackDamage).toBe(26);
  expect(reset.values.armor).toBe(15);
});
