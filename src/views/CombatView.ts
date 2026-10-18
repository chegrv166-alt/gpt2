import Phaser from 'phaser';
import type { CombatWorld } from '../combat/CombatWorld';
import type { CombatEvent } from '../combat/definitions';
import type { Enemy } from '../entities/Enemy';
import { isoToScreen } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { ArenaRenderer } from '../world/ArenaRenderer';
import { EnemyView } from './EnemyView';
import { FloatingCombatText } from './FloatingCombatText';

/** Synchronizes simulation snapshots with sprites; all textures come from BootScene. */
export class CombatView {
  private enemies: EnemyView[] = [];
  private readonly bolts = new Map<number, Phaser.GameObjects.Image>();
  private readonly effects = new Set<Phaser.GameObjects.Image>();
  private readonly text: FloatingCombatText;

  public constructor(private readonly scene: Phaser.Scene, private readonly arena: ArenaRenderer, private readonly battle: CombatWorld) {
    this.text = new FloatingCombatText(scene, arena);
    this.rebuild();
  }

  public pickEnemy(point: Vec2): Enemy | undefined {
    return this.enemies.filter((view) => view.contains(point)).sort((a, b) => b.sprite.depth - a.sprite.depth)[0]?.enemy;
  }

  public render(events: readonly CombatEvent[]): void {
    for (const enemy of this.enemies) enemy.render(enemy.enemy.id === this.battle.selectedEnemy?.id);
    const alive = new Set<number>();
    for (const projectile of this.battle.projectiles.active) {
      alive.add(projectile.id);
      let sprite = this.bolts.get(projectile.id);
      if (!sprite) {
        sprite = this.scene.add.image(0, 0, projectile.team === 'hero' ? 'projectile-ember' : 'projectile-arcane').setScale(0.8);
        this.bolts.set(projectile.id, sprite);
      }
      const point = this.arena.toScreen(projectile.position);
      const velocity = isoToScreen(projectile.velocity);
      sprite.setPosition(point.x, point.y - 27).setDepth(point.y + 5).setRotation(Math.atan2(velocity.y, velocity.x));
    }
    for (const [id, sprite] of this.bolts) if (!alive.has(id)) { sprite.destroy(); this.bolts.delete(id); }
    for (const event of events) {
      if (event.type === 'damage') this.text.show(event);
      else if (event.type === 'swing') this.swing(event);
      else if (event.type === 'impact') this.impact(event);
    }
  }

  public reset(): void {
    for (const view of this.enemies) view.destroy();
    for (const sprite of this.bolts.values()) sprite.destroy();
    for (const effect of this.effects) { this.scene.tweens.killTweensOf(effect); effect.destroy(); }
    this.bolts.clear(); this.effects.clear(); this.text.clear();
    this.rebuild();
  }

  private rebuild(): void {
    this.enemies = this.battle.enemies.map((enemy) => new EnemyView(this.scene, enemy, this.arena));
    for (const view of this.enemies) view.render(false);
  }

  private swing(event: Extract<CombatEvent, { type: 'swing' }>): void {
    const point = this.arena.toScreen(event.position);
    const direction = isoToScreen(event.direction);
    const sprite = this.scene.add.image(point.x + direction.x * 0.45, point.y - 35 + direction.y * 0.45, 'projectile-slash')
      .setRotation(Math.atan2(direction.y, direction.x)).setScale(event.team === 'hero' ? 1.25 : 1)
      .setTint(event.team === 'hero' ? 0xffd698 : 0xd68d76).setDepth(point.y + 7);
    this.fade(sprite, 190);
  }

  private impact(event: Extract<CombatEvent, { type: 'impact' }>): void {
    const point = this.arena.toScreen(event.position);
    const sprite = this.scene.add.image(point.x, point.y, 'fx-telegraph')
      .setScale(128 * Math.SQRT2 * event.radius / 174, 64 * Math.SQRT2 * event.radius / 88)
      .setTint(event.team === 'hero' ? 0xffd47f : 0xffaa8b).setAlpha(0.8).setDepth(-9993);
    this.fade(sprite, 360);
  }

  private fade(sprite: Phaser.GameObjects.Image, duration: number): void {
    this.effects.add(sprite);
    this.scene.tweens.add({ targets: sprite, alpha: 0, scaleX: sprite.scaleX * 1.2, scaleY: sprite.scaleY * 1.2,
      duration, onComplete: () => { this.effects.delete(sprite); sprite.destroy(); } });
  }
}
