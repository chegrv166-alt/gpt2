import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';
import type { GameScene } from '../src/scenes/GameScene';

test('hits paint blood, deaths leave a corpse and pool, and room reset clears them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('world-status')).toHaveText('Святилище открыто');
  await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing game entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    scene.player.stats.setModifiers([{ attackDamage: 1000 }]);
    const enemy = scene.battle.enemies[0];
    if (!enemy) throw new Error('Missing first enemy');
    const resolveHit = scene.battle as unknown as { damageEnemy: (target: typeof enemy, attack: typeof scene.player.stats.values, power: number) => void };
    resolveHit.damageEnemy(enemy, scene.player.stats.values, 1);
  });
  await expect.poll(() => page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) return false;
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    return scene.children.list.some((object) => object.name === 'corpse-1')
      && scene.children.list.some((object) => String(object.name).startsWith('blood-pool-'))
      && scene.children.list.some((object) => object.name === 'blood-spray');
  })).toBe(true);
  const values = await page.evaluate(async () => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!entry) throw new Error('Missing game entry');
    const { game }: { game: Phaser.Game } = await import(entry);
    const scene = game.scene.getScene('GameScene') as GameScene;
    const corpse = scene.children.getByName('corpse-1') as Phaser.GameObjects.Image;
    const blood = scene.children.list.find((object) => String(object.name).startsWith('blood-pool-')) as Phaser.GameObjects.Image;
    const valid = corpse.visible && blood.visible && corpse.texture.key === 'grunt-hurt-se-1'
      && game.textures.exists('fx-blood-footprint');
    const internal = scene as unknown as { bloodField: { sampleActor: (id: number, point: { x: number; y: number }, seconds: number) => unknown[] }; bloodView: { render: (seconds: number, events: readonly never[]) => void } };
    internal.bloodField.sampleActor(55, { x: 8, y: 17 }, 0.1);
    internal.bloodField.sampleActor(55, { x: 10, y: 17 }, 0.1);
    internal.bloodView.render(0.016, []);
    const footprints = scene.children.list.some((object) => object.name === 'blood-print-55');
    scene.resetPlayer();
    const cleared = !scene.children.list.some((object) => String(object.name).startsWith('blood-') || object.name === 'corpse-1');
    await new Promise<void>((resolve) => { game.events.once('world-ready', () => resolve()); scene.scene.restart(); });
    const restarted = game.scene.getScene('GameScene') as GameScene;
    return { valid, footprints, cleared, restarted: !restarted.children.list.some((object) => String(object.name).startsWith('blood-') || object.name === 'corpse-1') };
  });
  expect(values.valid).toBe(true);
  expect(values.footprints).toBe(true);
  expect(values.cleared).toBe(true);
  expect(values.restarted).toBe(true);
  expect(errors).toEqual([]);
});
