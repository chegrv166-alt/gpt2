import Phaser from 'phaser';
import {
  ACTORS, ACTOR_IDS, ACTOR_STATES, DIRECTIONS, DIRECTION_VECTORS, EFFECT_SPECS,
  FRAME_COUNT, ITEM_SPECS, PROJECTILE_SPECS, TEXTURE_SPECS,
  actorAnimationKey, actorTextureKey,
} from '../assets/catalog';
import type { ActorId, ActorState, Direction } from '../assets/catalog';

type Point = readonly [number, number];
type Graphics = Phaser.GameObjects.Graphics;

interface ActorPalette {
  readonly armor: number;
  readonly edge: number;
  readonly cloth: number;
  readonly skin: number;
  readonly glow: number;
}

const PALETTES: Readonly<Record<ActorId, ActorPalette>> = {
  hero: { armor: 0x6f7c80, edge: 0xb9c5bc, cloth: 0x793e39, skin: 0xc5ab8e, glow: 0xe5c685 },
  grunt: { armor: 0x52594b, edge: 0x99977e, cloth: 0x494438, skin: 0x819076, glow: 0xb8cd7b },
  caster: { armor: 0x514262, edge: 0x9b80a9, cloth: 0x382c4a, skin: 0xa89aab, glow: 0xc796ef },
  boss: { armor: 0x454b51, edge: 0x899087, cloth: 0x73382c, skin: 0x776b63, glow: 0xf6a559 },
};

/** Generates all art locally; the loader never downloads images, atlases or JSON. */
export class BootScene extends Phaser.Scene {
  private brush!: Graphics;
  private generationStarted = 0;

  public constructor() {
    super('BootScene');
  }

  public preload(): void {
    this.generationStarted = performance.now();
    this.brush = this.make.graphics({ x: 0, y: 0 }, false);
    try {
      this.generateTerrain();
      this.generateActors();
      this.generateProjectiles();
      this.generateItems();
      this.generateEffects();
      this.generateInterface();
    } finally {
      this.brush.destroy();
    }
  }

  public create(): void {
    for (const spec of TEXTURE_SPECS) {
      if (!this.textures.exists(spec.key)) throw new Error(`Missing procedural texture: ${spec.key}`);
      const source = this.textures.get(spec.key).getSourceImage();
      if (source.width !== spec.width || source.height !== spec.height) {
        throw new Error(`Incorrect procedural texture dimensions: ${spec.key}`);
      }
    }
    this.generateAnimations();
    this.registry.set('asset-report', {
      count: TEXTURE_SPECS.length,
      generationMs: Math.round(performance.now() - this.generationStarted),
    });
    this.scene.start(this.registry.get('initial-scene') === 'AssetGalleryScene' ? 'AssetGalleryScene' : 'GameScene');
  }

  private bake(key: string, width: number, height: number, draw: (g: Graphics) => void): void {
    if (this.textures.exists(key)) return;
    this.brush.clear().lineStyle(0, 0xffffff, 1).fillStyle(0xffffff, 1);
    draw(this.brush);
    this.brush.generateTexture(key, width, height);
  }

  private polygon(g: Graphics, color: number, points: readonly Point[], alpha = 1): void {
    g.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => ({ x, y })), true);
  }

  private random(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4_294_967_296;
    };
  }

  private generateTerrain(): void {
    for (const kind of ['ground', 'stone'] as const) {
      for (let variant = 0; variant < 4; variant += 1) {
        this.bake(`tile-${kind}-${variant}`, 128, 80, (g) => {
          const random = this.random(7103 + variant * 97 + (kind === 'stone' ? 500 : 0));
          this.polygon(g, 0x202320, [[2, 35], [64, 66], [126, 35], [126, 43], [64, 74], [2, 43]]);
          this.polygon(g, 0x2a2b27, [[2, 35], [64, 66], [64, 74], [2, 43]]);
          this.polygon(g, kind === 'stone' ? 0x494b43 : 0x393d32,
            [[2, 34], [64, 3], [126, 34], [64, 65]]);
          g.lineStyle(1, 0x83816a, 0.22).lineBetween(3, 34, 64, 4).lineBetween(64, 4, 125, 34);
          if (kind === 'stone') {
            g.lineStyle(2, 0x292d29, 0.9)
              .lineBetween(33, 19, 95, 50).lineBetween(33, 50, 95, 19)
              .lineBetween(64, 4, 64, 34).lineBetween(64, 34, 64, 64);
            g.lineStyle(1, 0xa39d7f, 0.18)
              .lineBetween(36, 19, 96, 49).lineBetween(34, 48, 94, 18);
          }
          for (let i = 0; i < 95; i += 1) {
            const x = 5 + random() * 118;
            const y = 6 + random() * 56;
            if (Math.abs(x - 64) / 59 + Math.abs(y - 34) / 28 > 0.94) continue;
            const color = random() > 0.5 ? 0x9c9672 : 0x171f1b;
            g.fillStyle(color, 0.12 + random() * 0.2).fillRect(x, y, 1 + random() * 3, 1);
          }
          if (variant % 2 === 1) {
            g.lineStyle(1, 0x1c2420, 0.75).beginPath().moveTo(49, 23)
              .lineTo(61, 33).lineTo(54, 39).lineTo(70, 49).strokePath();
          }
          if (kind === 'ground') {
            for (let i = 0; i < 5; i += 1) {
              const x = 43 + random() * 37;
              const y = 26 + random() * 18;
              g.lineStyle(1, 0x73805c, 0.5).lineBetween(x, y, x - 2, y - 3);
            }
          }
        });
      }
    }
    for (const side of ['nw', 'ne'] as const) {
      this.bake(`wall-${side}`, 128, 144, (g) => this.drawWall(g, side));
    }
    this.bake('prop-rock', 128, 144, (g) => {
      g.fillStyle(0x080d0c, 0.4).fillEllipse(64, 114, 80, 25);
      this.polygon(g, 0x444a45, [[25, 106], [34, 75], [61, 61], [90, 76], [104, 108], [65, 122]]);
      this.polygon(g, 0x6a6e60, [[34, 75], [61, 61], [90, 76], [66, 94], [25, 106]]);
      this.polygon(g, 0x333d38, [[66, 94], [90, 76], [104, 108], [65, 122]]);
      g.lineStyle(2, 0x93917a, 0.4).lineBetween(35, 76, 61, 63).lineBetween(61, 63, 89, 77);
    });
    this.bake('prop-pillar', 128, 144, (g) => {
      g.fillStyle(0x080d0c, 0.4).fillEllipse(64, 117, 72, 23);
      this.polygon(g, 0x565b51, [[32, 103], [64, 87], [96, 103], [96, 114], [64, 130], [32, 114]]);
      g.fillStyle(0x555a50).fillRect(45, 31, 38, 76);
      g.fillStyle(0x77786a).fillRect(46, 31, 9, 76);
      g.fillStyle(0x343f39).fillRect(75, 31, 8, 76);
      g.lineStyle(2, 0x292f29).lineBetween(46, 57, 82, 57).lineBetween(46, 82, 82, 82);
      this.polygon(g, 0x62665a, [[32, 27], [64, 11], [96, 27], [96, 39], [64, 55], [32, 39]]);
      this.polygon(g, 0x90907a, [[32, 27], [64, 11], [96, 27], [64, 43]]);
      g.lineStyle(2, 0x323b34).lineBetween(62, 64, 69, 73).lineBetween(69, 73, 61, 87);
    });
    this.bake('prop-brazier', 128, 144, (g) => {
      for (let radius = 42; radius > 5; radius -= 6) {
        g.fillStyle(0xe99238, 0.018).fillEllipse(64, 105, radius * 2, radius);
      }
      g.lineStyle(6, 0x3b3c38).lineBetween(52, 86, 44, 119).lineBetween(76, 86, 84, 119);
      this.polygon(g, 0x747363, [[36, 74], [92, 74], [82, 93], [46, 93]]);
      g.fillStyle(0xf58a38, 0.3).fillEllipse(64, 70, 57, 29);
      this.polygon(g, 0xb94f25, [[43, 76], [48, 49], [56, 60], [64, 28], [70, 54], [82, 45], [84, 76]]);
      this.polygon(g, 0xee9d43, [[51, 76], [58, 53], [65, 65], [71, 46], [77, 76]]);
      this.polygon(g, 0xffdf8e, [[59, 76], [65, 58], [72, 76]]);
    });
  }

  private drawWall(g: Graphics, side: 'nw' | 'ne'): void {
    const project = (x: number, y: number): Point => [side === 'nw' ? x : 128 - x, y];
    const face: Point[] = [project(4, 40), project(64, 10), project(64, 78), project(4, 108)];
    this.polygon(g, side === 'nw' ? 0x4b5047 : 0x383f38, face);
    this.polygon(g, 0x262f29, [project(64, 10), project(72, 14), project(72, 82), project(64, 78)]);
    this.polygon(g, 0x858572, [project(4, 40), project(64, 10), project(72, 14), project(12, 44)]);
    for (let row = 1; row <= 4; row += 1) {
      const y = 40 + row * 14;
      const from = project(4, y);
      const to = project(64, y - 30);
      g.lineStyle(2, 0x222c26, 0.85).lineBetween(from[0], from[1], to[0], to[1]);
      for (let column = 0; column < 2; column += 1) {
        const x = 16 + column * 28 + (row % 2) * 9;
        const top = project(x, y - (x - 4) / 2 - 13);
        const bottom = project(x, y - (x - 4) / 2);
        g.lineBetween(top[0], top[1], bottom[0], bottom[1]);
      }
    }
  }

  private generateActors(): void {
    for (const actor of ACTOR_IDS) {
      for (const state of ACTOR_STATES) {
        for (const direction of DIRECTIONS) {
          for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
            const definition = ACTORS[actor];
            this.bake(actorTextureKey(actor, state, direction, frame), definition.width, definition.height,
              (g) => this.drawActor(g, actor, state, direction, frame));
          }
        }
      }
    }
  }

  private drawActor(g: Graphics, actor: ActorId, state: ActorState, direction: Direction, frame: number): void {
    const definition = ACTORS[actor];
    const palette = PALETTES[actor];
    const [dx, dy] = DIRECTION_VECTORS[direction];
    const scale = actor === 'boss' ? 1.35 : 1;
    const phase = frame / FRAME_COUNT * Math.PI * 2;
    const stride = state === 'walk' ? Math.sin(phase) * 7 : Math.sin(phase) * 0.7;
    const bob = state === 'walk' ? Math.cos(phase * 2) * 1.4 : Math.sin(phase) * 0.8;
    const recoil = state === 'hurt' ? [-3, 2, -1, 0][frame] ?? 0 : 0;
    const originX = definition.width / 2 + recoil;
    const originY = definition.footY;
    const point = (x: number, y: number): Point => [originX + x * scale, originY + (y + bob) * scale];
    const shape = (color: number, points: readonly Point[], alpha = 1): void => {
      this.polygon(g, color, points.map(([x, y]) => point(x, y)), alpha);
    };
    const ellipse = (color: number, x: number, y: number, width: number, height: number, alpha = 1): void => {
      const position = point(x, y);
      g.fillStyle(color, alpha).fillEllipse(position[0], position[1], width * scale, height * scale);
    };
    const line = (color: number, width: number, from: Point, to: Point, alpha = 1): void => {
      const a = point(from[0], from[1]);
      const b = point(to[0], to[1]);
      g.lineStyle(width * scale, color, alpha).lineBetween(a[0], a[1], b[0], b[1]);
    };
    g.fillStyle(0x060d0c, 0.34).fillEllipse(originX, originY + 1, 39 * scale, 14 * scale);
    shape(palette.cloth, [[-13, -52], [13, -52], [21 - dx * 4, -7], [1, -13], [-23 - dx * 4, -6]]);
    line(0x252727, 2, [-10, -43], [-17 - dx * 3, -13]);
    shape(0x282d2c, [[-12, -26], [-1, -24], [-3 + stride, -4], [-14 + stride, -4]]);
    shape(0x353b37, [[1, -25], [12, -26], [14 - stride, -4], [3 - stride, -4]]);
    ellipse(0x181f20, -8 + stride, -3, 17, 8);
    ellipse(0x252b2c, 9 - stride, -3, 17, 8);
    if (actor === 'caster') {
      shape(palette.cloth, [[-12, -50], [13, -50], [21, -5], [4, -1], [-18, -5]]);
      line(palette.edge, 1, [-4, -39], [-5, -8], 0.7);
      line(0x645373, 2, [11, -31], [15, -9]);
    }
    const armor = state === 'hurt' && frame % 2 === 0 ? 0xbc7d72 : palette.armor;
    shape(armor, [[-14, -52], [12, -53], [17, -39], [10, -25], [-11, -25], [-18, -39]]);
    shape(palette.edge, [[-14, -52], [-6, -50], [-9, -30], [-15, -33]], 0.6);
    line(0x28322e, 2, [1, -49], [1, -29]);
    shape(0x7f7357, [[-12, -29], [12, -29], [12, -24], [-12, -24]]);
    ellipse(palette.glow, 1, -26, 5, 5);
    ellipse(palette.armor, -17, -47, 17, 15);
    ellipse(palette.edge, -18, -50, 14, 6, 0.65);
    ellipse(palette.armor, 16, -47, 17, 15);
    const lookX = dx * 4;
    if (actor === 'caster') {
      shape(0x30263e, [[lookX, -77], [13 + lookX, -62], [14, -50], [-13, -50], [-13 + lookX, -62]]);
      ellipse(0x151d21, lookX, -60, 17, 17);
      line(palette.edge, 1, [lookX, -76], [-12 + lookX, -61]);
    } else {
      ellipse(palette.skin, lookX, -60, 21, 24);
      shape(palette.armor, [[-12 + lookX, -64], [-8 + lookX, -74], [9 + lookX, -74], [13 + lookX, -63], [9 + lookX, -59], [-11 + lookX, -59]]);
      line(palette.edge, 2, [-7 + lookX, -72], [7 + lookX, -72], 0.85);
      shape(0x313838, [[lookX - 2, -69], [lookX + 3, -69], [lookX + 4, -50], [lookX, -48]]);
    }
    if (dy >= -0.1) {
      line(actor === 'hero' ? 0xe1ceac : palette.glow, 2,
        [lookX - 6, -60], [lookX - 2, -60]);
      line(actor === 'hero' ? 0xe1ceac : palette.glow, 2,
        [lookX + 3, -60], [lookX + 7, -60]);
    } else {
      shape(palette.cloth, [[-9 + lookX, -65], [10 + lookX, -65], [8, -51], [-8, -51]]);
    }
    if (actor === 'boss') {
      shape(0xa59b7a, [[-9, -69], [-23, -82], [-18, -65], [-9, -60]]);
      shape(0xa59b7a, [[9, -69], [23, -82], [18, -65], [9, -60]]);
      line(palette.glow, 2, [-6, -48], [-2, -41]);
      line(palette.glow, 2, [-2, -41], [-7, -34]);
      shape(0x545958, [[-22, -50], [-23, -62], [-15, -53]]);
      shape(0x545958, [[21, -50], [24, -62], [14, -53]]);
    }
    const swing = state === 'attack' ? [0.1, 0.45, 1, 0.55][frame] ?? 0 : 0;
    const handX = 21 + dx * (swing * 10);
    const handY = -35 + dy * 6 - swing * 7;
    line(palette.armor, 8, [17, -44], [handX, handY]);
    ellipse(palette.skin, handX, handY, 7, 7);
    if (actor === 'caster') {
      line(0x8d7962, 4, [handX + 3, -4], [handX + 3, -67]);
      ellipse(palette.glow, handX + 3, -72, 20 + swing * 5, 20 + swing * 5, 0.12);
      shape(palette.glow, [[handX + 3, -81], [handX + 10, -71], [handX + 3, -62], [handX - 4, -71]]);
      ellipse(0xf3ddfa, handX + 2, -73, 4, 7);
    } else {
      const angle = -1.1 + dx * 0.5 + swing * 2.3;
      const bladeLength = actor === 'grunt' ? 26 : 34;
      const tipX = handX + Math.cos(angle) * bladeLength;
      const tipY = handY + Math.sin(angle) * bladeLength;
      line(0x534334, 4, [handX - Math.cos(angle) * 7, handY - Math.sin(angle) * 7], [handX, handY]);
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);
      shape(palette.edge, [[handX + normalX * 3, handY + normalY * 3], [tipX, tipY],
        [handX - normalX * 3, handY - normalY * 3]]);
      line(0xe2dac4, 1, [handX, handY], [tipX, tipY], 0.8);
      line(0xb49a60, 3, [handX + normalX * 7, handY + normalY * 7], [handX - normalX * 7, handY - normalY * 7]);
      if (actor === 'hero') {
        const shieldX = -21 + dx * 3;
        shape(0x242f2f, [[shieldX - 9, -46], [shieldX + 9, -47], [shieldX + 10, -28], [shieldX, -19], [shieldX - 10, -29]]);
        shape(0x7d7961, [[shieldX - 7, -43], [shieldX + 6, -44], [shieldX + 7, -30], [shieldX, -23], [shieldX - 7, -31]]);
        line(0xc5b37b, 2, [shieldX, -42], [shieldX, -27]);
      }
    }
    if (state === 'attack' && frame === 2) {
      const center = point(3, -34);
      g.lineStyle(3, palette.glow, 0.72).beginPath()
        .arc(center[0], center[1], 36 * scale, -0.8 + dx * 0.3, 1.1 + dx * 0.3).strokePath();
    }
    if (state === 'hurt') {
      line(0xe9ad88, 1, [-25 + frame, -47], [-29 + frame, -53]);
      line(0xe9ad88, 1, [26 - frame, -41], [30 - frame, -43]);
    }
  }

  private generateProjectiles(): void {
    for (const spec of PROJECTILE_SPECS) {
      this.bake(spec.key, spec.width, spec.height, (g) => {
        if (spec.key === 'projectile-slash') {
          g.lineStyle(9, 0xf2d499, 0.13).beginPath().arc(29, 34, 24, -1.3, 1.2).strokePath();
          g.lineStyle(3, 0xffe9bb, 0.9).beginPath().arc(29, 34, 24, -1.3, 1.2).strokePath();
          return;
        }
        const color = spec.key === 'projectile-ember' ? 0xf2a056 : 0xb394f1;
        for (let radius = 23; radius > 4; radius -= 3) {
          g.fillStyle(color, 0.045).fillCircle(32, 32, radius);
        }
        this.polygon(g, color, [[6, 19], [33, 25], [44, 32], [32, 40], [9, 44], [21, 32]]);
        g.fillStyle(color, 0.9).fillCircle(36, 32, 8);
        g.fillStyle(0xfff1ce).fillEllipse(36, 31, 8, 9);
      });
    }
  }

  private generateItems(): void {
    for (const spec of ITEM_SPECS) {
      this.bake(spec.key, spec.width, spec.height, (g) => {
        if (spec.key === 'icon-sword') {
          this.polygon(g, 0xc7c8ae, [[18, 28], [32, 8], [36, 6], [36, 12], [22, 32]]);
          g.lineStyle(2, 0xf0dfb6).lineBetween(22, 27, 34, 10);
          g.lineStyle(5, 0x6c4e38).lineBetween(13, 38, 20, 29);
          g.lineStyle(4, 0xc29a5e).lineBetween(13, 25, 26, 35);
        } else if (spec.key === 'icon-armor') {
          this.polygon(g, 0x7c8c8b, [[11, 12], [19, 8], [24, 13], [29, 8], [38, 12], [35, 24], [31, 21], [33, 38], [15, 38], [17, 21], [12, 24]]);
          this.polygon(g, 0xb6c2ae, [[17, 14], [22, 18], [21, 33], [16, 33]]);
          g.lineStyle(2, 0xc4a269).lineBetween(24, 17, 24, 35).lineBetween(16, 32, 32, 32);
        } else if (spec.key.startsWith('icon-potion')) {
          const color = spec.key === 'icon-potion-health' ? 0xa94b45 : 0x547eae;
          g.fillStyle(0xc1c5b0, 0.5).fillRoundedRect(17, 8, 14, 16, 3).fillCircle(24, 29, 14);
          g.fillStyle(color).fillCircle(24, 30, 11).fillRect(17, 23, 14, 8);
          g.fillStyle(0xe4d9b3, 0.6).fillEllipse(19, 27, 4, 9);
          g.fillStyle(0x967650).fillRoundedRect(17, 6, 14, 7, 2);
          g.lineStyle(2, 0x332c27).lineBetween(17, 13, 31, 13);
        } else if (spec.key === 'icon-ring') {
          g.lineStyle(6, 0x98733e).strokeCircle(24, 28, 11);
          g.lineStyle(2, 0xd6bd7b).strokeCircle(24, 28, 12);
          this.polygon(g, 0xe5a159, [[24, 7], [32, 14], [24, 23], [16, 14]]);
          this.polygon(g, 0xffdc8c, [[24, 8], [24, 20], [18, 14]]);
        } else {
          this.polygon(g, 0x696c68, [[13, 11], [32, 7], [38, 34], [18, 41], [9, 29]]);
          g.lineStyle(2, 0xb5c5cc).lineBetween(18, 16, 29, 29).lineBetween(29, 29, 19, 31)
            .lineBetween(22, 13, 29, 18).lineBetween(29, 18, 17, 25);
        }
      });
    }
  }

  private generateEffects(): void {
    for (const spec of EFFECT_SPECS) {
      this.bake(spec.key, spec.width, spec.height, (g) => {
        if (spec.key === 'fx-shadow') {
          for (let radius = 40; radius > 2; radius -= 4) {
            g.fillStyle(0x000000, 0.04).fillEllipse(48, 24, radius * 2, radius * 0.7);
          }
        } else if (spec.key === 'fx-target') {
          g.lineStyle(2, 0xd7bb7d, 0.9).strokeEllipse(48, 32, 64, 32);
          g.lineStyle(1, 0xd7bb7d, 0.35).strokeEllipse(48, 32, 78, 40);
          g.lineStyle(2, 0xffdf96).lineBetween(48, 10, 48, 20).lineBetween(48, 44, 48, 54)
            .lineBetween(7, 32, 20, 32).lineBetween(76, 32, 89, 32);
        } else if (spec.key === 'fx-telegraph') {
          g.fillStyle(0xb54d36, 0.18).fillEllipse(96, 56, 174, 88);
          g.lineStyle(3, 0xea7951, 0.9).strokeEllipse(96, 56, 174, 88);
          g.lineStyle(1, 0xffac65, 0.5).strokeEllipse(96, 56, 157, 78);
          for (let i = 0; i < 8; i += 1) {
            const angle = i * Math.PI / 4;
            g.lineBetween(96 + Math.cos(angle) * 65, 56 + Math.sin(angle) * 32,
              96 + Math.cos(angle) * 80, 56 + Math.sin(angle) * 40);
          }
        } else if (spec.key.startsWith('fx-loot-')) {
          const color = spec.key.endsWith('legendary') ? 0xe9a34f
            : spec.key.endsWith('rare') ? 0x6c9fe5 : 0xc5c4b5;
          for (let width = 32; width > 0; width -= 3) {
            this.polygon(g, color, [[32 - width / 2, 144], [30, 12], [34, 12], [32 + width / 2, 144]], 0.035);
          }
          g.lineStyle(2, color, 0.75).lineBetween(32, 22, 32, 144);
          g.fillStyle(color, 0.25).fillEllipse(32, 144, 47, 15);
          g.lineStyle(1, color, 0.85).strokeEllipse(32, 144, 37, 11);
        } else {
          this.polygon(g, 0xffdca3, [[16, 2], [19, 13], [30, 16], [19, 19], [16, 30], [13, 19], [2, 16], [13, 13]]);
          g.fillStyle(0xfff7d7).fillCircle(16, 16, 3);
        }
      });
    }
  }

  private generateInterface(): void {
    this.bake('ui-orb-frame', 160, 160, (g) => {
      g.lineStyle(12, 0x121713).strokeCircle(80, 80, 68);
      g.lineStyle(4, 0x5c563d).strokeCircle(80, 80, 70);
      g.lineStyle(1, 0xc2a46c, 0.85).strokeCircle(80, 80, 73);
      g.lineStyle(2, 0x9b8556).strokeCircle(80, 80, 63);
      for (let i = 0; i < 12; i += 1) {
        const angle = i * Math.PI / 6;
        g.lineStyle(i % 3 === 0 ? 3 : 1, 0xc7ab70, 0.8).lineBetween(
          80 + Math.cos(angle) * 66, 80 + Math.sin(angle) * 66,
          80 + Math.cos(angle) * 71, 80 + Math.sin(angle) * 71);
      }
      for (const [x, y] of [[80, 5], [155, 80], [80, 155], [5, 80]] as const) {
        this.polygon(g, 0xa8905c, [[x, y - 3], [x + 3, y], [x, y + 3], [x - 3, y]]);
      }
    });
    for (const resource of ['health', 'mana'] as const) {
      this.bake(`ui-orb-${resource}`, 128, 128, (g) => {
        const dark = resource === 'health' ? 0x380e18 : 0x111d42;
        const bright = resource === 'health' ? 0xc34343 : 0x4e85c7;
        for (let radius = 59; radius > 0; radius -= 1) {
          const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(dark), Phaser.Display.Color.ValueToColor(bright), 59, 59 - radius);
          g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b)).fillCircle(64, 64, radius);
        }
        g.fillStyle(0xf1e6cc, 0.13).fillEllipse(48, 35, 38, 17);
        g.fillStyle(0xffffff, 0.18).fillEllipse(43, 29, 15, 6);
        g.lineStyle(1, bright, 0.4).strokeCircle(64, 64, 56);
        for (const [x, y, radius] of [[80, 89, 5], [42, 77, 3], [82, 52, 2], [58, 99, 2]] as const) {
          g.lineStyle(1, 0xe5dcd2, 0.12).strokeCircle(x, y, radius);
        }
      });
    }
  }

  private generateAnimations(): void {
    for (const actor of ACTOR_IDS) {
      for (const state of ACTOR_STATES) {
        for (const direction of DIRECTIONS) {
          const key = actorAnimationKey(actor, state, direction);
          if (this.anims.exists(key)) continue;
          this.anims.create({
            key,
            frames: Array.from({ length: FRAME_COUNT }, (_, frame) => ({ key: actorTextureKey(actor, state, direction, frame) })),
            frameRate: state === 'idle' ? 4 : state === 'walk' ? 9 : 12,
            repeat: state === 'idle' || state === 'walk' ? -1 : 0,
          });
        }
      }
    }
  }
}
