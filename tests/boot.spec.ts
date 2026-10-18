import { expect, test } from '@playwright/test';
import type Phaser from 'phaser';

test('boot generates visible cached textures without requesting external assets', async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') {
      externalRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  const report = await page.evaluate(async () => {
    const mainPath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!mainPath) throw new Error('Missing application entry module');
    const catalogPath = '/src/assets/catalog.ts';
    const { game }: { game: Phaser.Game } = await import(mainPath);
    const { TEXTURE_SPECS }: {
      TEXTURE_SPECS: ReadonlyArray<{ key: string; width: number; height: number; category: string }>;
    } = await import(catalogPath);
    const invalid: string[] = [];
    const signatures: number[] = [];
    for (const spec of TEXTURE_SPECS) {
      if (!game.textures.exists(spec.key)) {
        invalid.push(`${spec.key}: missing`);
        continue;
      }
      const source = game.textures.get(spec.key).getSourceImage() as HTMLCanvasElement;
      const context = source.getContext('2d');
      if (source.width !== spec.width || source.height !== spec.height || !context) {
        invalid.push(`${spec.key}: invalid dimensions or canvas`);
        continue;
      }
      const pixels = context.getImageData(0, 0, source.width, source.height).data;
      let opaque = 0;
      let transparent = 0;
      let signature = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if ((pixels[i + 3] ?? 0) > 0) opaque += 1;
        else transparent += 1;
        signature = (Math.imul(signature, 31) + (pixels[i] ?? 0) + (pixels[i + 1] ?? 0)) | 0;
      }
      if (opaque < 20 || transparent === 0) invalid.push(`${spec.key}: blank or no transparent padding`);
      if (spec.category === 'actors') {
        let touchesEdge = false;
        for (let x = 0; x < source.width; x += 1) {
          if ((pixels[x * 4 + 3] ?? 0) > 0
            || (pixels[((source.height - 1) * source.width + x) * 4 + 3] ?? 0) > 0) touchesEdge = true;
        }
        for (let y = 0; y < source.height; y += 1) {
          if ((pixels[(y * source.width) * 4 + 3] ?? 0) > 0
            || (pixels[(y * source.width + source.width - 1) * 4 + 3] ?? 0) > 0) touchesEdge = true;
        }
        if (touchesEdge) invalid.push(`${spec.key}: actor art clipped at texture edge`);
      }
      signatures.push(signature);
    }
    return { count: TEXTURE_SPECS.length, invalid, unique: new Set(signatures).size };
  });
  expect(report.count).toBe(544);
  expect(report.invalid).toEqual([]);
  expect(report.unique).toBeGreaterThan(250);
  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('actor controls change the actual animation and selection', async ({ page }) => {
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  await page.getByRole('button', { name: 'Пепельный страж', exact: true }).click();
  await page.getByRole('button', { name: 'Атака', exact: true }).click();
  await expect(page.getByTestId('current-animation')).toHaveText('boss-attack-se');
  await page.getByRole('button', { name: 'Повернуть вправо' }).click();
  await expect(page.getByTestId('current-animation')).toHaveText('boss-attack-s');
  await expect(page.getByTestId('selected-actor')).toHaveText('Пепельный страж');
  const runningAnimation = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!modulePath) throw new Error('Missing application entry module');
    const { game }: { game: Phaser.Game } = await import(modulePath);
    const scene = game.scene.getScene('AssetGalleryScene');
    const actor = scene.children.list.find((object) => object.type === 'Sprite') as Phaser.GameObjects.Sprite;
    return actor.anims.currentAnim?.key;
  });
  expect(runningAnimation).toBe('boss-attack-s');
  await page.getByRole('button', { name: 'Приостановить анимацию' }).click();
  const paused = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!modulePath) throw new Error('Missing application entry module');
    const { game }: { game: Phaser.Game } = await import(modulePath);
    const scene = game.scene.getScene('AssetGalleryScene');
    const actor = scene.children.list.find((object) => object.type === 'Sprite') as Phaser.GameObjects.Sprite;
    return actor.anims.isPaused;
  });
  expect(paused).toBe(true);
});

test('paused preview retains its frame through zoom and resume', async ({ page }) => {
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  await page.getByRole('button', { name: 'Приостановить анимацию' }).click();
  const frames = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!modulePath) throw new Error('Missing application entry module');
    const { game }: { game: Phaser.Game } = await import(modulePath);
    const scene = game.scene.getScene('AssetGalleryScene');
    const actor = scene.children.list.find((object) => object.type === 'Sprite') as Phaser.GameObjects.Sprite;
    const frozen = actor.anims.currentAnim?.frames[2];
    if (!frozen) throw new Error('Missing animation frame');
    actor.anims.setCurrentFrame(frozen);
    const before = actor.anims.currentFrame?.index;
    const zoom = document.querySelector<HTMLInputElement>('#zoom');
    if (!zoom) throw new Error('Missing zoom control');
    zoom.value = '200';
    zoom.dispatchEvent(new Event('input', { bubbles: true }));
    const afterZoom = actor.anims.currentFrame?.index;
    document.querySelector<HTMLButtonElement>('#pause')?.click();
    return { before, afterZoom, afterResume: actor.anims.currentFrame?.index, paused: actor.anims.isPaused };
  });
  expect(frames.before).toBe(3);
  expect(frames.afterZoom).toBe(3);
  expect(frames.afterResume).toBe(3);
  expect(frames.paused).toBe(false);
});

test('catalog tabs display the generated item and effect canvases', async ({ page }) => {
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  await page.getByRole('button', { name: 'Предметы 6', exact: true }).click();
  await expect(page.locator('#asset-grid canvas')).toHaveCount(6);
  await expect(page.locator('#asset-grid code').first()).toHaveText('icon-sword');
  await page.getByRole('button', { name: 'Эффекты 13', exact: true }).click();
  await expect(page.locator('#asset-grid canvas')).toHaveCount(13);
  await expect(page.locator('#asset-grid code').filter({ hasText: 'fx-loot-legendary' })).toBeVisible();
});

test('boot re-entry preserves cached texture instances and animations', async ({ page }) => {
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  const preserved = await page.evaluate(async () => {
    const modulePath = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/src/main.ts"]')?.src;
    if (!modulePath) throw new Error('Missing application entry module');
    const { game }: { game: Phaser.Game } = await import(modulePath);
    const before = game.textures.get('tile-ground-0');
    const countBefore = game.textures.getTextureKeys().length;
    game.scene.stop('AssetGalleryScene');
    game.scene.start('BootScene');
    await new Promise<void>((resolve) => {
      const waitForGallery = (): void => {
        if (game.scene.isActive('AssetGalleryScene')) resolve();
        else requestAnimationFrame(waitForGallery);
      };
      requestAnimationFrame(waitForGallery);
    });
    return before === game.textures.get('tile-ground-0')
      && countBefore === game.textures.getTextureKeys().length
      && game.anims.exists('hero-walk-se');
  });
  expect(preserved).toBe(true);
});

test('mobile layout keeps the atlas controls accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=forge');
  await expect(page.getByTestId('boot-status')).toHaveText('Текстуры готовы');
  await page.getByRole('button', { name: 'Культист', exact: true }).click();
  await page.getByRole('button', { name: 'Бег', exact: true }).click();
  await expect(page.getByTestId('current-animation')).toHaveText('caster-walk-se');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
