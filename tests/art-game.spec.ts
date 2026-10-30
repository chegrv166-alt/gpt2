import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

test('bundled painted atlases produce textured floors, props and readable occluded torch lighting', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url());
  });
  await page.goto('/?desktop=1&room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const report = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    const floor = game.textures.get('tile-stone-0').getSourceImage() as HTMLCanvasElement;
    const pixels = floor.getContext('2d')!.getImageData(0, 0, floor.width, floor.height).data;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]! > 200) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    const overlay = world.children.getByName('room-lighting') as Phaser.GameObjects.Image;
    const texture = overlay.texture as Phaser.Textures.CanvasTexture;
    const points = world.lighting.field.lights.map((light) => light.source.position);
    for (let y = 2; y < 22; y += 3) for (let x = 2; x < 22; x += 3) {
      if (world.layout.grid.canOccupy({ x, y }, 0.1)) points.push({ x, y });
    }
    const samples = points.map((point) => {
      const screen = world.arena.toScreen(point);
      const data = texture.context.getImageData(Math.floor(screen.x / overlay.scaleX), Math.floor(screen.y / overlay.scaleY), 1, 1).data;
      return { r: data[0]!, g: data[1]!, b: data[2]!, alpha: data[3]! };
    }).sort((a, b) => a.r - b.r);
    return { colors: colors.size, lights: world.lighting.field.lights.length, darkest: samples[0]!, brightest: samples.at(-1)!,
      art: ['painted-materials', 'painted-props', 'painted-actors', 'tile-crypt-0', 'prop-sconce'].every((key) => game.textures.exists(key)),
      sconces: world.lighting.field.lights.filter((light) => light.source.kind === 'sconce').length };
  });
  expect(report.art).toBe(true);
  expect(report.colors).toBeGreaterThan(500);
  expect(report.lights).toBeGreaterThan(10);
  expect(report.sconces).toBeGreaterThan(0);
  expect(report.brightest.r).toBeGreaterThan(report.darkest.r + 80);
  expect(report.darkest.b).toBeGreaterThan(report.darkest.r);
  expect(report.brightest.alpha).toBe(255);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('torchlit-sanctuary.png') });
});

test('room restart disposes the old lighting texture and keeps one live light map', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const count = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    for (let index = 0; index < 3; index++) await new Promise<void>((resolve) => {
      game.events.once('world-ready', () => requestAnimationFrame(() => resolve()));
      world.scene.restart();
    });
    return { lights: game.textures.getTextureKeys().filter((key) => key.startsWith('room-lighting-')).length,
      floors: game.textures.getTextureKeys().filter((key) => key.startsWith('floor-layer-')).length };
  });
  expect(count).toEqual({ lights: 1, floors: 4 });
});

test('painted actor extraction preserves the staff and sword tips across uneven atlas rows', async ({ page }) => {
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  const cutouts = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const modulePath = '/src/assets/PaintedTextures.ts';
    const { segmentActorAtlas }: typeof import('../src/assets/PaintedTextures') = await import(modulePath);
    const source = game.textures.get('painted-actors').getSourceImage() as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return segmentActorAtlas(canvas.width, canvas.height, pixels).map((cutout) => {
      let left = Infinity; let top = Infinity; let right = 0; let bottom = 0;
      for (let y = 0; y < cutout.height; y++) for (let x = 0; x < cutout.width; x++) {
        if (cutout.pixels[(y * cutout.width + x) * 4 + 3]! < 12) continue;
        left = Math.min(left, x + cutout.left); top = Math.min(top, y + cutout.top);
        right = Math.max(right, x + cutout.left); bottom = Math.max(bottom, y + cutout.top);
      }
      return { left, top, right, bottom };
    });
  });
  expect(cutouts).toHaveLength(16);
  // These extremities cross the apparent sheet gutters and must belong to their own actor.
  expect(cutouts[8]!.top).toBeLessThanOrEqual(581);
  expect(cutouts[12]!.top).toBeLessThanOrEqual(877);
  expect(cutouts[13]!.left).toBeLessThanOrEqual(305);
  expect(cutouts[4]!.bottom).toBeLessThanOrEqual(587);
});

test('all actors have six distinct authored walk frames and movement plays the walk cycle', async ({ page }) => {
  await page.goto('/?room=2');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  const report = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const world = game.scene.getScene('GameScene') as GameScene;
    const actors = ['hero', 'grunt', 'caster', 'boss'];
    const distinct = actors.map((actor) => {
      const frames = Array.from({ length: 6 }, (_, frame) => {
        const source = game.textures.get(`${actor}-walk-se-${frame}`).getSourceImage() as HTMLCanvasElement;
        return source.getContext('2d')!.getImageData(0, 0, source.width, source.height).data;
      });
      return new Set(frames.map((data) => {
        let value = 0;
        for (let index = 0; index < data.length; index += 37) value = (value * 33 + data[index]!) >>> 0;
        return value;
      })).size;
    });
    world.battle.update(0.12, { x: 1, y: 0 });
    world.player.render(world.battle.hero.visualState);
    return { distinct, animation: world.player.sprite.anims.currentAnim?.key, frameCount: world.player.sprite.anims.currentAnim?.frames.length };
  });
  expect(report.distinct.every((count) => count > 1)).toBe(true);
  expect(report.animation).toMatch(/^hero-walk-/);
  expect(report.frameCount).toBe(6);
});
