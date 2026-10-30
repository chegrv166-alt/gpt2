import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

async function act(page: Page, action: 'state' | 'gate' | 'clear' | 'kill' | 'gear' | 'overview') {
  return page.evaluate(async (command) => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    if (command === 'gate') {
      world.player.motor.reset({ x: world.layout.gate.x, y: world.layout.gate.y + 1.1 });
      world.player.render('idle');
    }
    if (command === 'clear') {
      const events = world.battle.enemies.map((enemy) => {
        enemy.takeDamage(10000);
        return { type: 'death' as const, targetId: enemy.id, kind: enemy.kind, position: { ...enemy.motor.position }, direction: enemy.motor.direction };
      });
      world.adventure.update(events, world.player.motor.position, true, 0);
    }
    if (command === 'kill') world.player.stats.applyDamage(10000);
    if (command === 'overview') {
      world.cameras.main.stopFollow().setZoom(0.55).centerOn(world.arena.bounds.width / 2, world.arena.bounds.height / 2);
      world.cameras.main.preRender();
    }
    if (command === 'gear') {
      const modulePath = '/src/items/definitions.ts';
      const { createItem } = await import(modulePath);
      world.adventure.inventory.add(createItem('travel-sword', 'weapon', 'rare'));
      world.adventure.inventory.equip(0);
      world.adventure.inventory.add(createItem('travel-armor', 'armor', 'rare'));
      world.player.stats.applyDamage(30);
    }
    const point = world.arena.toScreen(world.layout.gate);
    const camera = world.cameras.main;
    const canvas = game.canvas.getBoundingClientRect();
    return { room: world.layout.room, unlocked: world.adventure.exitUnlocked, outcome: world.adventure.outcome,
      enemies: world.battle.status.remaining, position: { ...world.player.motor.position }, hp: world.player.stats.hp,
      bag: world.adventure.inventory.slots.map((item) => item?.id ?? null), weapon: world.adventure.inventory.equipment.weapon?.id,
      clickX: canvas.left + ((point.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      clickY: canvas.top + ((point.y - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height,
    };
  }, action);
}

test('locked exit rejects interaction; clearing first room allows E transition with the same hero and gear', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.keyboard.press('e');
  expect((await act(page, 'state')).room).toBe(2);
  await act(page, 'gear');
  await act(page, 'clear');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await act(page, 'state')).unlocked).toBe(true);
  // The gate still requires physical proximity, even after unlocking.
  await page.keyboard.press('e');
  expect((await act(page, 'state')).room).toBe(2);
  await act(page, 'gate');
  const before = await act(page, 'state');
  await page.keyboard.press('e');
  await expect.poll(async () => (await act(page, 'state')).room).toBe(3);
  await expect(page.locator('#room-name')).toHaveText('Зал погребального огня');
  const after = await act(page, 'state');
  expect(after.position).toEqual({ x: 5, y: 19 });
  expect(after.enemies).toBe(6);
  expect(after.hp).toBe(before.hp);
  expect(after.weapon).toBe('travel-sword');
  expect(after.bag).toEqual(before.bag);
  await page.screenshot({ path: testInfo.outputPath('second-room.png') });
  await page.keyboard.press('i');
  await expect(page.locator('#inventory-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await act(page, 'kill');
  await expect.poll(async () => (await act(page, 'state')).outcome).toBe('dead');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await act(page, 'state')).outcome).toBe('playing');
  expect((await act(page, 'state')).room).toBe(3);
  expect((await act(page, 'state')).weapon).toBe('travel-sword');
  await act(page, 'clear');
  await expect.poll(async () => (await act(page, 'state')).outcome).toBe('victory');
  await page.keyboard.press('Enter');
  await page.keyboard.press('e');
  expect((await act(page, 'state')).room).toBe(3);
  await page.keyboard.press('r');
  await expect.poll(async () => (await act(page, 'state')).room).toBe(1);
  expect((await act(page, 'state')).weapon).toBeUndefined();
  expect((await act(page, 'state')).enemies).toBe(12);
  expect((await act(page, 'state')).unlocked).toBe(false);
  expect(errors).toEqual([]);
});

test('clicking the open gate from afar routes around walls and enters the second room once', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await act(page, 'clear');
  await page.keyboard.press('Enter');
  await act(page, 'overview');
  const point = await act(page, 'state');
  await page.mouse.click(point.clickX, point.clickY);
  await expect.poll(async () => (await act(page, 'state')).room, { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(250);
  expect((await act(page, 'state')).enemies).toBe(6);
});
