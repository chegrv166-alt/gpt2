import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

async function clickUI(page: Page, name: string): Promise<void> {
  const readBounds = () => page.evaluate(async (key) => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('UIScene');
    const find = (objects: readonly Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | undefined => {
      for (const object of objects) {
        if ((object as Phaser.GameObjects.Container).visible === false) continue;
        if (object.name === key) return object;
        if (object.type === 'Container') {
          const match = find((object as Phaser.GameObjects.Container).list);
          if (match) return match;
        }
      }
      return undefined;
    };
    const object = find(scene.children.list) as Phaser.GameObjects.Container | undefined;
    if (!object) return null;
    const rect = object.getBounds();
    const canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.left + rect.centerX * canvas.width / game.scale.width,
      y: canvas.top + rect.centerY * canvas.height / game.scale.height };
  }, name);
  await expect.poll(readBounds, { message: `UI control ${name} should be rendered` }).not.toBeNull();
  // Dynamic Phaser controls enter the input list on the following frame.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const bounds = await readBounds();
  if (!bounds) throw new Error(`Missing UI control ${name}`);
  await page.mouse.click(bounds.x, bounds.y);
}

test('independent HUD uses cached sphere textures and crops health to the real resource', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await expect.poll(async () => page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    return game.scene.isActive('UIScene');
  })).toBe(true);
  const crop = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    world.player.stats.applyDamage(80);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const ui = game.scene.getScene('UIScene');
    const hud = ui.children.getByName('hud') as Phaser.GameObjects.Container;
    const orb = hud.getByName('health-orb') as Phaser.GameObjects.Container;
    const liquid = orb.getByName('liquid') as Phaser.GameObjects.Image & { _crop: { height: number } };
    return { height: liquid._crop.height, texture: liquid.texture.key,
      cached: ['ui-orb-frame', 'ui-orb-health', 'ui-orb-mana'].every((key) => game.textures.exists(key)) };
  });
  expect(crop.cached).toBe(true);
  expect(crop.texture).toBe('ui-orb-health');
  expect(crop.height).toBeCloseTo(64, 0);
});

test('inventory buttons equip items, block the world, and respawn retains gear while a new run clears it', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const itemPath = '/src/items/definitions.ts';
    const { createItem } = await import(itemPath);
    (game.scene.getScene('GameScene') as GameScene).adventure.inventory.add(createItem('fixture', 'weapon', 'rare'));
  });
  await page.getByRole('button', { name: 'Открыть инвентарь' }).click();
  await clickUI(page, 'bag-slot-0');
  await clickUI(page, 'inventory-equip');
  await expect(page.locator('#hero-offense')).toContainText('Урон 39');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    (game.scene.getScene('GameScene') as GameScene).player.stats.applyDamage(1000);
  });
  await expect(page.locator('#objective-heading')).toHaveText('СТРАННИК ПАЛ');
  await clickUI(page, 'end-primary');
  await expect(page.getByTestId('hero-health')).toHaveText('160 / 160');
  await expect(page.locator('#hero-offense')).toContainText('Урон 39');
  await page.keyboard.press('r');
  await expect(page.locator('#hero-offense')).toContainText('Урон 26');
});

test('killing the boss opens victory once and continuing preserves the legendary ground reward', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    const boss = world.battle.enemies.find((enemy) => enemy.kind === 'boss');
    if (!boss) throw new Error('Missing boss');
    boss.takeDamage(300);
    world.player.motor.reset({ x: 17, y: 5.3 });
    world.castSkill(boss.motor.position);
  });
  await expect(page.locator('#objective-heading')).toHaveText('СТРАЖ ПОВЕРЖЕН');
  await clickUI(page, 'end-primary');
  await expect.poll(async () => page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    return { outcome: world.adventure.outcome, legendary: world.adventure.loot.drops.some((drop) => drop.item.rarity === 'legendary') };
  })).toEqual({ outcome: 'playing', legendary: true });
  await page.waitForTimeout(350);
  await page.keyboard.press('i');
  await expect(page.getByRole('button', { name: 'Открыть инвентарь' })).toHaveAttribute('aria-expanded', 'true');
});

test('mobile inventory remains inside the canvas and closes through its own button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.getByRole('button', { name: 'Открыть инвентарь' }).click();
  await expect(page.getByRole('button', { name: 'Открыть инвентарь' })).toHaveAttribute('aria-expanded', 'true');
  await clickUI(page, 'inventory-close');
  await expect(page.getByRole('button', { name: 'Открыть инвентарь' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('dropping beside a wall preserves a reachable item outside automatic pickup range', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const itemPath = '/src/items/definitions.ts';
    const { createItem } = await import(itemPath);
    const world = game.scene.getScene('GameScene') as GameScene;
    world.adventure.inventory.add(createItem('drop-fixture', 'armor', 'rare'));
    world.player.motor.reset({ x: 9.8321067231, y: 14 });
    world.player.motor.direction = 'se';
    world.player.render('idle');
    world.cameras.main.centerOn(world.player.sprite.x, world.player.sprite.y - 45);
    world.cameras.main.preRender();
  });
  await page.keyboard.press('i');
  await clickUI(page, 'bag-slot-0');
  await clickUI(page, 'inventory-drop');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const state = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    const drop = world.adventure.loot.drops[0];
    if (!drop) throw new Error('The dropped item was lost');
    const point = world.arena.toScreen(drop.position);
    const camera = world.cameras.main;
    const canvas = game.canvas.getBoundingClientRect();
    return { bag: world.adventure.inventory.count, id: drop.item.id,
      distance: Math.hypot(drop.position.x - world.player.motor.position.x, drop.position.y - world.player.motor.position.y),
      free: world.layout.grid.canOccupy(drop.position, world.player.motor.radius),
      x: canvas.left + ((point.x - camera.worldView.centerX) * camera.zoom + camera.width / 2) * canvas.width / game.scale.width,
      y: canvas.top + ((point.y - 13 - camera.worldView.centerY) * camera.zoom + camera.height / 2) * canvas.height / game.scale.height };
  });
  expect(state.bag).toBe(0);
  expect(state.id).toBe('drop-fixture');
  expect(state.distance).toBeGreaterThan(0.85);
  expect(state.free).toBe(true);
  await page.mouse.click(state.x, state.y);
  await expect(page.getByTestId('inventory-count')).toHaveText('1/10');
});

test('restarting the world rebuilds one UI and keeps inventory hotkeys and modal input working', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    await new Promise<void>((resolve) => { world.events.once('create', () => resolve()); world.scene.restart(); });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.keyboard.press('i');
  await expect(page.getByRole('button', { name: 'Открыть инвентарь' })).toHaveAttribute('aria-expanded', 'true');
  const canvas = await page.locator('#game-stage canvas').boundingBox();
  if (!canvas) throw new Error('Missing canvas');
  await page.mouse.click(canvas.x + 8, canvas.y + canvas.height / 2);
  await clickUI(page, 'inventory-close');
  await expect(page.getByRole('button', { name: 'Открыть инвентарь' })).toHaveAttribute('aria-expanded', 'false');
  const position = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing application entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    return (game.scene.getScene('GameScene') as GameScene).player.motor.position;
  });
  expect(position).toEqual({ x: 5, y: 17 });
  expect(errors).toEqual([]);
});
