import Phaser from 'phaser';
import { isoToScreen } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { ArenaLayout } from './ArenaLayout';

interface FloorTile { readonly source: CanvasImageSource; readonly x: number; readonly y: number; }
interface FloorChunk { readonly key: string; readonly image: Phaser.GameObjects.Image; }
let floorSequence = 0;

/** Static floor compositing keeps hundreds of tile images out of the display list. */
export class FloorLayer {
  private readonly chunks: FloorChunk[] = [];
  private destroyed = false;

  public constructor(private readonly scene: Phaser.Scene, layout: ArenaLayout, origin: Vec2) {
    const sources = new Map<string, CanvasImageSource>();
    const tiles: FloorTile[] = [];
    for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) {
      const stone = Math.abs(x - 7) < 2 || Math.abs(y - 11) < 2
        || (x > 14 && y < 7) || (x > 3 && x < 10 && y > 14 && y < 20);
      const material = layout.room === 2 ? 'crypt' : stone ? 'stone' : 'ground';
      const key = `tile-${material}-${(x * 13 + y * 7) % 4}`;
      let source = sources.get(key);
      if (!source) {
        if (!scene.textures.exists(key)) throw new Error(`Missing floor texture: ${key}`);
        source = scene.textures.get(key).getSourceImage() as CanvasImageSource;
        sources.set(key, source);
      }
      const point = isoToScreen({ x, y }, origin);
      tiles.push({ source, x: point.x - 64, y: point.y - 34 });
    }
    const width = (layout.width + layout.height) * 64 + 192;
    const height = (layout.width + layout.height) * 32 + 320;
    const splitX = Math.ceil(width / 2); const splitY = Math.ceil(height / 2);
    const sequence = floorSequence++;
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const x = column * splitX; const y = row * splitY;
      const chunkWidth = column === 0 ? splitX : width - splitX;
      const chunkHeight = row === 0 ? splitY : height - splitY;
      const key = `floor-layer-${sequence}-${row * 2 + column}`;
      const texture = scene.textures.createCanvas(key, chunkWidth, chunkHeight);
      if (!texture) throw new Error(`Cannot create floor chunk: ${key}`);
      for (const tile of tiles) {
        if (tile.x + 128 <= x || tile.x >= x + chunkWidth || tile.y + 80 <= y || tile.y >= y + chunkHeight) continue;
        texture.context.drawImage(tile.source, tile.x - x, tile.y - y, 128, 80);
      }
      texture.refresh();
      const image = scene.add.image(x, y, key).setOrigin(0).setDepth(-10_000)
        .setName(`floor-layer-chunk-${row * 2 + column}`);
      this.chunks.push({ key, image });
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    for (const { key, image } of this.chunks) {
      image.destroy();
      this.scene.textures.remove(key);
    }
    this.chunks.length = 0;
  }
}
