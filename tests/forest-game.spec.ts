import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

async function act(page: Page, action: 'state' | 'gear' | 'clear' | 'gate' | 'kill') {
  return page.evaluate(async command => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game }: { game: Phaser.Game } = await import(entry);
    const w = game.scene.getScene('GameScene') as GameScene;
    if (command === 'gear') {
      const path = '/src/items/definitions.ts';
      const { createItem } = await import(path);
      w.adventure.inventory.add(createItem('campaign-blade', 'weapon', 'rare'));
      w.adventure.inventory.equip(0);
      w.adventure.inventory.add(createItem('campaign-coat', 'armor', 'rare'));
      w.player.stats.applyDamage(20);
    }
    if (command === 'clear') w.adventure.update(w.battle.enemies.map(e => {
      e.takeDamage(10000);
      return { type: 'death' as const, targetId: e.id, kind: e.kind, position: { ...e.motor.position }, direction: e.motor.direction };
    }), w.player.motor.position, true, 0);
    if (command === 'gate') {
      w.player.motor.reset(w.layout.gate); w.player.render('idle');
      w.cameras.main.centerOn(w.player.sprite.x, w.player.sprite.y - 45); w.cameras.main.preRender();
    }
    if (command === 'kill') w.player.stats.applyDamage(10000);
    const screen = w.arena.toScreen(w.layout.gate);
    const camera = w.cameras.main; const canvas = game.canvas.getBoundingClientRect();
    return { clickX: canvas.left + ((screen.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      clickY: canvas.top + ((screen.y - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height,
      room: w.layout.room, hp: w.player.stats.hp, outcome: w.adventure.outcome,
      unlocked: w.adventure.exitUnlocked, count: w.battle.status.remaining,
      weapon: w.adventure.inventory.equipment.weapon?.id,
      bag: w.adventure.inventory.slots.map(i => i?.id),
      lights: game.textures.getTextureKeys().filter(k => k.startsWith('room-lighting-')).length,
      floors: game.textures.getTextureKeys().filter(k => k.startsWith('floor-layer-')).length };
  }, action);
}

test('forest renders bounded minimap, native bandits, readable lighting and no missing textures', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#room-name')).toHaveText('Разбойничья тропа');
  await expect(page.getByTestId('enemy-count')).toHaveText('12');
  const report = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')!.src;
    const { game }: { game: Phaser.Game } = await import(entry);
    const w = game.scene.getScene('GameScene') as GameScene;
    const map = game.scene.getScene('MapScene') as Phaser.Scene & { mapPoint(x: number, y: number): { x: number; y: number } };
    const corners = [[0, 0], [91, 0], [0, 22], [91, 22]].map(([x,y]) => map.mapPoint(x!,y!));
    return { size: [w.layout.width, w.layout.height], corners, ambient: w.lighting.sample(w.layout.spawn),
      sprites: w.battle.enemies.map(e => (w.children.getByName(`enemy-${e.id}`) as Phaser.GameObjects.Sprite).texture.key),
      tree: game.textures.exists('prop-tree'), arrow: game.textures.exists('projectile-arrow') };
  });
  expect(report.size).toEqual([92, 23]);
  for (const p of report.corners) { expect(p.x).toBeGreaterThanOrEqual(14); expect(p.x).toBeLessThanOrEqual(206); expect(p.y).toBeGreaterThanOrEqual(38); expect(p.y).toBeLessThanOrEqual(128); }
  expect(report.ambient.g).toBeGreaterThan(0.6);
  expect(report.sprites.every(k => /^(knife|spear|archer)-/.test(k))).toBe(true);
  expect(report.tree && report.arrow).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath('forest-entry.png') });
});

test('campaign crosses forest and both dungeons with gear, respawns locally, and resets to forest', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.locator('#room-name')).toHaveText('Разбойничья тропа');
  await page.keyboard.press('e');
  expect((await act(page, 'state')).room).toBe(1);
  await act(page, 'gear');
  for (const room of [1, 2]) {
    await act(page, 'clear');
    if (room === 2) await page.keyboard.press('Enter');
    await expect.poll(async () => (await act(page, 'state')).unlocked).toBe(true);
    await page.keyboard.press('e');
    expect((await act(page, 'state')).room).toBe(room);
    await page.keyboard.press('i');
    await expect(page.locator('#objective-description')).not.toContainText('Поход завершён');
    await page.keyboard.press('Escape');
    await act(page, 'gate');
    const before = await act(page, 'state');
    if (room === 1) await page.mouse.click(before.clickX, before.clickY);
    else await page.keyboard.press('e');
    await expect.poll(async () => (await act(page, 'state')).room, { timeout: 20000 }).toBe(room + 1);
    const after = await act(page, 'state');
    expect(after.weapon).toBe('campaign-blade'); expect(after.bag).toEqual(before.bag); expect(after.hp).toBe(before.hp);
    expect(after.lights).toBe(1); expect(after.floors).toBe(4);
  }
  await act(page, 'kill');
  await expect.poll(async () => (await act(page, 'state')).outcome).toBe('dead');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await act(page, 'state')).outcome).toBe('playing');
  expect((await act(page, 'state')).room).toBe(3);
  expect((await act(page, 'state')).weapon).toBe('campaign-blade');
  await act(page, 'clear'); await page.keyboard.press('Enter'); await act(page, 'gate'); await page.keyboard.press('e');
  expect((await act(page, 'state')).room).toBe(3);
  await page.keyboard.press('r');
  await expect.poll(async () => (await act(page, 'state')).room, { timeout: 20000 }).toBe(1);
  expect((await act(page, 'state')).count).toBe(12);
  expect((await act(page, 'state')).weapon).toBeUndefined();
});
