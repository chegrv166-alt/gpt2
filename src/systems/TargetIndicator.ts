import Phaser from 'phaser';
import type { Vec2 } from '../math/isometric';
import type { ArenaRenderer } from '../world/ArenaRenderer';

export class TargetIndicator {
  private readonly ring: Phaser.GameObjects.Image;
  private readonly route: Phaser.GameObjects.Graphics;
  private remaining = 0;

  public constructor(scene: Phaser.Scene, private readonly arena: ArenaRenderer) {
    this.ring = scene.add.image(0, 0, 'fx-target').setDepth(-9996).setVisible(false);
    this.route = scene.add.graphics().setDepth(-9997);
  }

  public show(target: Vec2, path: readonly Vec2[], accepted: boolean): void {
    const point = this.arena.toScreen(target);
    this.ring.setPosition(point.x, point.y).setTint(accepted ? 0xe6c38a : 0xe07556).setVisible(true).setAlpha(0.9);
    this.remaining = accepted ? -1 : 0.6;
    this.drawPath(path);
  }

  public update(seconds: number, walking: boolean, position: Vec2, path: readonly Vec2[]): void {
    if (this.remaining === -1 && !walking) this.remaining = 0.25;
    if (this.remaining > 0) {
      this.remaining -= seconds;
      this.ring.setAlpha(Math.max(0, Math.min(0.9, this.remaining * 3)));
      if (this.remaining <= 0) this.clear();
    }
    if (walking) this.drawPath([position, ...path]);
  }

  public clear(): void {
    this.remaining = 0;
    this.ring.setVisible(false);
    this.route.clear();
  }

  private drawPath(points: readonly Vec2[]): void {
    this.route.clear();
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const next = points[i];
      if (!previous || !next) continue;
      const from = this.arena.toScreen(previous);
      const to = this.arena.toScreen(next);
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 13);
      for (let step = 0; step < steps; step += 1) {
        const amount = step / steps;
        this.route.fillStyle(0xc0a567, 0.4).fillCircle(from.x + (to.x - from.x) * amount, from.y + (to.y - from.y) * amount, 1.2);
      }
    }
  }
}
