import Phaser from 'phaser';
import { isoToScreen } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { ArenaLayout } from '../world/ArenaLayout';
import { AMBIENT_LIGHT, FOREST_AMBIENT, FLAME_COLOR, getRoomLights, LightField } from './lighting';
import type { LightRGB, PreparedLight } from './lighting';

interface LightMask { readonly canvas: HTMLCanvasElement; readonly x: number; readonly y: number; }
let textureSequence = 0;
const RESOLUTION = 0.5;

/** A room-sized multiply map: cool ambient plus cached, occluded amber pools. */
export class RoomLighting {
  public readonly field: LightField;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private readonly masks: readonly LightMask[];
  private readonly animated: boolean;
  private elapsed = 0;
  private redrawTime = 1;
  private destroyed = false;

  public constructor(private readonly scene: Phaser.Scene, layout: ArenaLayout, origin: Vec2) {
    this.field = new LightField(layout.grid, getRoomLights(layout), layout.room === 1 ? FOREST_AMBIENT : AMBIENT_LIGHT);
    this.animated = layout.room !== 1;
    this.masks = this.field.lights.map((light) => this.createMask(light, origin));
    const width = Math.ceil(((layout.width + layout.height) * 64 + 192) * RESOLUTION);
    const height = Math.ceil(((layout.width + layout.height) * 32 + 320) * RESOLUTION);
    const key = `room-lighting-${textureSequence++}`;
    this.texture = scene.textures.createCanvas(key, width, height)!;
    this.image = scene.add.image(0, 0, key).setOrigin(0).setScale(1 / RESOLUTION)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(8000).setName('room-lighting');
    this.update(0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  public sample(point: Vec2): LightRGB { return this.field.sample(point); }

  public update(seconds: number): void {
    if (this.destroyed || (!this.animated && this.redrawTime === 0)) return;
    this.elapsed += seconds;
    this.redrawTime += seconds;
    if (this.redrawTime < 1 / 12) return;
    this.redrawTime = 0;
    const context = this.texture.context;
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.fillStyle = `rgb(${this.field.ambient.r * 255}, ${this.field.ambient.g * 255}, ${this.field.ambient.b * 255})`;
    context.fillRect(0, 0, this.texture.width, this.texture.height);
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.masks.length; i++) {
      const mask = this.masks[i]!;
      // Slow irregular breathing keeps the shadows fixed and avoids strobing.
      context.globalAlpha = 0.92 + Math.sin(this.elapsed * 5.1 + i * 2.3) * 0.045
        + Math.sin(this.elapsed * 9.7 + i * 1.7) * 0.025;
      context.drawImage(mask.canvas, mask.x, mask.y);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    this.texture.refresh();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.image.destroy();
    this.scene.textures.remove(this.texture.key);
  }

  private createMask(light: PreparedLight, origin: Vec2): LightMask {
    const { source, polygon } = light;
    const center = isoToScreen(source.position, origin);
    const halfWidth = Math.ceil(source.radius * Math.SQRT2 * 64 * RESOLUTION) + 2;
    const halfHeight = Math.ceil(source.radius * Math.SQRT2 * 32 * RESOLUTION) + 2;
    const canvas = document.createElement('canvas');
    canvas.width = halfWidth * 2; canvas.height = halfHeight * 2;
    const context = canvas.getContext('2d')!;
    context.setTransform(64 * RESOLUTION, 32 * RESOLUTION, -64 * RESOLUTION, 32 * RESOLUTION,
      halfWidth - (source.position.x - source.position.y) * 64 * RESOLUTION,
      halfHeight - (source.position.x + source.position.y) * 32 * RESOLUTION);
    context.beginPath();
    polygon.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.closePath(); context.clip();
    const gradient = context.createRadialGradient(source.position.x, source.position.y, 0, source.position.x, source.position.y, source.radius);
    for (const fraction of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      gradient.addColorStop(fraction, `rgba(${FLAME_COLOR.r * 255}, ${FLAME_COLOR.g * 255}, ${FLAME_COLOR.b * 255}, ${source.intensity * (1 - fraction) ** 2})`);
    }
    context.fillStyle = gradient;
    context.fillRect(source.position.x - source.radius, source.position.y - source.radius, source.radius * 2, source.radius * 2);
    return { canvas, x: center.x * RESOLUTION - halfWidth, y: center.y * RESOLUTION - halfHeight };
  }
}
