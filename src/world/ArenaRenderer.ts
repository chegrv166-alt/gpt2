import Phaser from 'phaser';
import { isoToScreen, screenToIso } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { ArenaLayout } from './ArenaLayout';
import { nextRoom } from './rooms';
import { getRoomLights } from '../lighting/lighting';
import { FloorLayer } from './FloorLayer';

/** Converts ground data into render objects; no movement or navigation logic. */
export class ArenaRenderer {
  public readonly origin: Vec2;
  public readonly bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  private readonly solids: Phaser.GameObjects.Image[] = [];
  private gateRing!: Phaser.GameObjects.Image;
  private gateLight!: Phaser.GameObjects.Image;
  private gateLabel!: Phaser.GameObjects.Text;

  public updateGate(unlocked: boolean, cleared: boolean): void {
    const finalRoom = this.layout.room === 3;
    this.gateRing.setTint(unlocked || cleared ? 0xffffff : 0x666666).setAlpha(unlocked || cleared ? 0.8 : 0.3);
    this.gateLight.setVisible(unlocked || (finalRoom && cleared));
    this.gateLabel.setText(finalRoom ? cleared ? 'ЗАЛ ОЧИЩЕН' : 'ЗАЛ ПОГРЕБАЛЬНОГО ОГНЯ'
      : unlocked ? `УРОВЕНЬ ${nextRoom(this.layout.room)} · КЛИК / E РЯДОМ` : 'ВРАТА ЗАПЕЧАТАНЫ · ПОБЕДИТЕ ВСЕХ');
    this.gateLabel.setColor(unlocked || cleared ? '#e8ce91' : '#a6a18f');
  }

  public constructor(private readonly scene: Phaser.Scene, public readonly layout: ArenaLayout) {
    this.origin = { x: layout.height * 64 + 96, y: 160 };
    this.bounds = { x: 0, y: 0, width: (layout.width + layout.height) * 64 + 192, height: (layout.width + layout.height) * 32 + 320 };
    this.drawFloor();
    this.drawObstacles();
    this.drawSconces();
    this.drawAtmosphere();
    this.drawGate();
  }

  public toScreen(point: Vec2): Vec2 {
    return isoToScreen(point, this.origin);
  }

  public toGround(point: Vec2): Vec2 {
    return screenToIso(point, this.origin);
  }

  public updateOcclusion(foot: Vec2): void {
    for (const image of this.solids) {
      const coversHero = image.depth > foot.y && image.depth < foot.y + 105
        && Math.abs(image.x - foot.x) < 52;
      image.setAlpha(coversHero ? 0.35 : 1);
    }
  }

  private drawFloor(): void {
    new FloorLayer(this.scene, this.layout, this.origin);
    const seals: readonly Vec2[] = this.layout.room === 1 ? [this.layout.spawn, this.layout.gate] : [this.layout.spawn, { x: 7, y: 11 }, { x: 17, y: 11 }, this.layout.gate];
    for (const { x, y } of seals) {
      const point = this.toScreen({ x, y });
      this.scene.add.image(point.x, point.y, 'fx-target').setDepth(-9999).setScale(1.05).setAlpha(0.22);
    }
  }

  private drawObstacles(): void {
    for (const obstacle of this.layout.obstacles) {
      const point = this.toScreen(obstacle.tile);
      const texture = this.layout.room === 3 && obstacle.kind === 'wall'
        ? obstacle.texture.replace('wall-', 'wall-crypt-') : obstacle.texture;
      const image = this.scene.add.image(point.x, point.y, texture)
        .setOrigin(0.5, 114 / 144).setDepth(point.y);
      this.solids.push(image);
      if (obstacle.kind === 'brazier') {
        this.scene.add.image(point.x, point.y - 40, 'projectile-ember')
          .setScale(2.8, 1.8).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.09).setDepth(point.y + 1);
        const sparks = this.scene.add.particles(point.x, point.y - 62, 'fx-spark', {
          speedX: { min: -8, max: 8 }, speedY: { min: -14, max: -32 },
          lifespan: { min: 500, max: 1100 }, frequency: 240,
          alpha: { start: 0.45, end: 0 }, scale: { start: 0.12, end: 0 },
          quantity: 1, blendMode: Phaser.BlendModes.ADD,
        }).setDepth(point.y + 2);
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sparks.destroy());
        this.flame(point.x, point.y - 68);
      }
    }
  }

  private drawSconces(): void {
    for (const light of getRoomLights(this.layout)) {
      if (light.kind !== 'sconce') continue;
      const mount = { x: light.fixture.x + (light.position.x - light.fixture.x) * 0.36,
        y: light.fixture.y + (light.position.y - light.fixture.y) * 0.36 };
      const point = this.toScreen(mount);
      this.scene.add.image(point.x, point.y - 26, 'prop-sconce').setOrigin(0.5, 114 / 144)
        .setScale(0.74).setDepth(this.toScreen(light.fixture).y + 2);
      this.flame(point.x, point.y - 85);
    }
  }

  private flame(x: number, y: number): void {
    const glow = this.scene.add.image(x, y, 'projectile-ember').setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.62, 0.85).setAlpha(0.48).setDepth(8002);
    this.scene.tweens.add({ targets: glow, alpha: 0.24, scaleX: 0.52, duration: 320 + (Math.abs(x) % 170), yoyo: true, repeat: -1 });
  }

  private drawAtmosphere(): void {
    const dust = this.scene.add.particles(0, 0, 'fx-spark', {
      x: { min: 160, max: this.bounds.width - 160 },
      y: { min: 200, max: this.bounds.height - 180 },
      lifespan: { min: 3000, max: 6000 }, frequency: 130,
      speedY: { min: -6, max: -13 }, speedX: { min: -2, max: 5 },
      alpha: { start: 0.16, end: 0 }, scale: { start: 0.06, end: 0 },
    }).setDepth(9000);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => dust.destroy());
  }

  private drawGate(): void {
    const point = this.toScreen(this.layout.gate);
    this.gateRing = this.scene.add.image(point.x, point.y, 'fx-target').setScale(1.4).setDepth(-9998).setAlpha(0.65);
    this.gateLight = this.scene.add.image(point.x, point.y, 'fx-loot-legendary')
      .setOrigin(0.5, 144 / 160).setScale(1.6).setDepth(point.y - 1).setAlpha(0.7);
    this.scene.tweens.add({ targets: this.gateLight, alpha: 0.35, duration: 1600, yoyo: true, repeat: -1 });
    this.gateLabel = this.scene.add.text(point.x, point.y - 125, '', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#c7b88a', letterSpacing: 2,
      backgroundColor: '#141b18aa', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(point.y + 3);
  }
}
