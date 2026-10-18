import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { AssetGalleryScene } from './scenes/AssetGalleryScene';
import { GameScene } from './scenes/GameScene';
import type { WorldStatus } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { UIScene } from './scenes/UIScene';
import { ForgeUI } from './ui/ForgeUI';
import { ExpeditionUI } from './ui/ExpeditionUI';
import './style.css';
import './expedition.css';
import './combat.css';
import './desktop.css';

const forge = new URLSearchParams(window.location.search).get('view') === 'forge';
const desktop = new URLSearchParams(window.location.search).get('desktop') === '1';
document.body.classList.toggle('expedition-mode', !forge);
document.body.classList.toggle('desktop-mode', desktop && !forge);
const forgeUI = forge ? new ForgeUI((selection) => {
  if (!game.scene.isActive('AssetGalleryScene')) return;
  (game.scene.getScene('AssetGalleryScene') as AssetGalleryScene).setSelection(selection);
}) : undefined;
const expeditionUI = forge ? undefined : new ExpeditionUI({
  reset: () => activeWorld()?.resetPlayer(),
  zoom: (amount) => activeWorld()?.changeZoom(amount) ?? 1,
  map: () => activeWorld()?.toggleMap(),
  cast: () => activeWorld()?.castSkill(),
  attack: () => activeWorld()?.attackNearest(),
  inventory: () => activeWorld()?.toggleInventory(),
});

function activeWorld(): GameScene | undefined {
  return game.scene.isActive('GameScene') ? game.scene.getScene('GameScene') as GameScene : undefined;
}

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-stage',
  width: forge ? 960 : 1280,
  height: forge ? 560 : 720,
  backgroundColor: '#141b18',
  antialias: true,
  roundPixels: false,
  fps: { target: 60, smoothStep: false },
  scale: { mode: forge ? Phaser.Scale.FIT : Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  audio: { noAudio: true },
  scene: [BootScene, GameScene, MapScene, UIScene, AssetGalleryScene],
  callbacks: {
    preBoot: (instance) => instance.registry.set('initial-scene', forge ? 'AssetGalleryScene' : 'GameScene'),
  },
});

game.events.on('gallery-ready', (report: { count: number; generationMs: number }) => {
  forgeUI?.ready((key) => game.textures.get(key).getSourceImage() as HTMLCanvasElement, report.count, report.generationMs);
});

game.events.on('world-ready', () => expeditionUI?.ready(activeWorld()?.cameras.main.zoom ?? 1,
  (key) => game.textures.get(key).getSourceImage() as HTMLCanvasElement));
game.events.on('world-status', (status: WorldStatus) => expeditionUI?.update(status));
game.events.on('destination-status', (message: string) => expeditionUI?.destination(message));
game.events.on('map-visibility', (visible: boolean) => expeditionUI?.mapVisibility(visible));

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
