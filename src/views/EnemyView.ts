import Phaser from 'phaser';
import { ACTORS, actorAnimationKey, actorTextureKey } from '../assets/catalog';
import type { ActorState } from '../assets/catalog';
import { ENEMY_DEFINITIONS } from '../combat/definitions';
import type { Enemy } from '../entities/Enemy';
import type { Vec2 } from '../math/isometric';
import type { ArenaRenderer } from '../world/ArenaRenderer';

export class EnemyView {
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly warning: Phaser.GameObjects.Image;
  private readonly selected: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, public readonly enemy: Enemy, private readonly arena: ArenaRenderer) {
    const definition = ACTORS[enemy.kind];
    this.sprite = scene.add.sprite(0, 0, actorTextureKey(enemy.kind, 'idle', 'se', 0))
      .setOrigin(0.5, definition.footY / definition.height).setName(`enemy-${enemy.id}`);
    this.bar = scene.add.graphics();
    this.label = scene.add.text(0, 0, ENEMY_DEFINITIONS[enemy.kind].name, {
      fontFamily: 'Arial, sans-serif', fontSize: enemy.kind === 'boss' ? '12px' : '10px',
      color: enemy.kind === 'boss' ? '#dbac75' : enemy.kind === 'caster' ? '#b7a3cc' : '#9eac8e',
      stroke: '#10180f', strokeThickness: 3,
    }).setOrigin(0.5, 1);
    this.warning = scene.add.image(0, 0, 'fx-telegraph').setDepth(8100).setVisible(false);
    this.selected = scene.add.image(0, 0, 'fx-target').setTint(0xd79362).setAlpha(0.7).setDepth(-9995).setVisible(false);
  }

  public render(selected: boolean): void {
    const enemy = this.enemy;
    const point = this.arena.toScreen(enemy.motor.position);
    const dead = enemy.state === 'DEAD';
    const state: ActorState = dead || enemy.state === 'HURT' ? 'hurt'
      : enemy.state === 'ATTACK' ? 'attack' : enemy.motor.state;
    const key = actorAnimationKey(enemy.kind, state, enemy.motor.direction);
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
    this.sprite.anims.timeScale = enemy.telegraph ? 0.3 : 1;
    this.sprite.setPosition(point.x, point.y).setDepth(point.y + 0.5);
    this.sprite.setTint(dead ? 0x686d61 : enemy.hitFlash > 0 ? 0xffd0ad : 0xffffff);
    this.sprite.setAngle(dead ? -65 : 0).setAlpha(dead ? Math.max(0, 0.8 - enemy.deadSeconds / 1.4) : 1);
    this.selected.setPosition(point.x, point.y).setScale(enemy.kind === 'boss' ? 1.35 : 0.85).setVisible(selected && !dead);
    this.bar.clear();
    this.label.setVisible(!dead);
    if (!dead) {
      const width = enemy.kind === 'boss' ? 96 : 44;
      const height = enemy.kind === 'boss' ? 125 : 83;
      this.bar.setPosition(point.x - width / 2, point.y - height).setDepth(point.y + 3);
      this.bar.fillStyle(0x101711, 0.95).fillRect(-1, -1, width + 2, 6);
      this.bar.fillStyle(0x4b3a31).fillRect(0, 0, width, 4);
      this.bar.fillStyle(enemy.kind === 'boss' ? 0xc27b45 : 0x9d6254).fillRect(0, 0, width * enemy.stats.hp / enemy.stats.values.maxHp, 4);
      this.label.setPosition(point.x, point.y - height - 4).setDepth(point.y + 4);
    }
    const telegraph = enemy.telegraph;
    this.warning.setVisible(telegraph !== null && !dead);
    if (telegraph) {
      const center = this.arena.toScreen(telegraph.center);
      const progress = 1 - telegraph.remaining / telegraph.duration;
      this.warning.setPosition(center.x, center.y)
        .setScale(128 * Math.SQRT2 * telegraph.radius / 174, 64 * Math.SQRT2 * telegraph.radius / 88)
        .setAlpha(0.35 + progress * 0.55);
    }
  }

  public contains(point: Vec2): boolean {
    if (!this.enemy.stats.alive) return false;
    const halfWidth = this.enemy.kind === 'boss' ? 42 : 27;
    const height = this.enemy.kind === 'boss' ? 116 : 80;
    return Math.abs(point.x - this.sprite.x) <= halfWidth && point.y >= this.sprite.y - height && point.y <= this.sprite.y + 10;
  }

  public destroy(): void {
    this.sprite.destroy(); this.bar.destroy(); this.label.destroy(); this.warning.destroy(); this.selected.destroy();
  }
}
