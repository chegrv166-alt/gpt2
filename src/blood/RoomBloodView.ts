import Phaser from 'phaser';
import type { CombatWorld } from '../combat/CombatWorld';
import type { CombatEvent } from '../combat/definitions';
import { ACTORS, actorTextureKey } from '../assets/catalog';
import type { ActorId } from '../assets/catalog';
import type { ArenaRenderer } from '../world/ArenaRenderer';
import type { BloodField } from './BloodField';
import type { BloodCorpse, BloodFootprint, BloodImpact, BloodPool } from './BloodField';

/** Scene-owned painterly blood layer. All persistent state ends with the room. */
export class RoomBloodView {
  private readonly corpses = new Map<number, Phaser.GameObjects.Image>();
  private readonly pools = new Map<number, Phaser.GameObjects.Image>();
  private readonly prints = new Map<number, Phaser.GameObjects.Image>();
  private readonly sprays = new Map<number, Phaser.GameObjects.Image>();
  private readonly poolIds = new Set<number>();
  private readonly corpseIds = new Set<number>();
  private readonly printIds = new Set<number>();
  private readonly impactIds = new Set<number>();

  public constructor(private readonly scene: Phaser.Scene, private readonly arena: ArenaRenderer,
    private readonly field: BloodField, private readonly battle: CombatWorld) {}

  public render(seconds: number, events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'damage') this.spawnImpact(event.position, event.amount / 22);
      if (event.type === 'death' && event.kind !== 'hero') {
        this.field.addCorpse(event.targetId, event.kind, event.position, event.direction);
      }
    }
    this.field.sampleActor(0, this.battle.hero.motor.position, seconds);
    for (const enemy of this.battle.enemies) if (enemy.stats.alive) this.field.sampleActor(enemy.id, enemy.motor.position, seconds);
    this.field.update(seconds);
    this.field.corpses.forEach((corpse) => this.showCorpse(corpse));
    this.field.pools.forEach((pool) => this.showPool(pool));
    this.field.footprints.forEach((print) => this.showPrint(print));
    this.field.impacts.forEach((impact) => this.showImpact(impact));
    this.expire(this.prints, new Set(this.field.footprints.map((value) => value.id)));
    this.expire(this.sprays, new Set(this.field.impacts.map((value) => value.id)));
  }

  public clear(): void {
    for (const map of [this.corpses, this.pools, this.prints, this.sprays]) {
      for (const object of map.values()) { this.scene.tweens.killTweensOf(object); object.destroy(); }
      map.clear();
    }
    this.corpseIds.clear(); this.poolIds.clear(); this.printIds.clear(); this.impactIds.clear();
    this.field.clear();
  }

  public destroy(): void { this.clear(); }

  private spawnImpact(position: { x: number; y: number }, intensity: number): void {
    const impact = this.field.addImpact(position, intensity);
    this.showImpact(impact);
  }

  private showCorpse(corpse: BloodCorpse): void {
    if (this.corpseIds.has(corpse.id)) return;
    this.corpseIds.add(corpse.id);
    const point = this.arena.toScreen(corpse.position);
    const actor = corpse.kind as ActorId;
    const spec = ACTORS[actor];
    const image = this.scene.add.image(point.x, point.y, actorTextureKey(actor, 'hurt', corpse.direction, 1))
      .setOrigin(0.5, spec.footY / spec.height).setAngle(82).setAlpha(0.95).setTint(0x67131d)
      .setScale(1.05, 0.63).setDepth(point.y + 0.05).setName(`corpse-${corpse.actorId}`);
    this.corpses.set(corpse.id, image);
  }

  private showPool(pool: BloodPool): void {
    if (this.poolIds.has(pool.id)) return;
    this.poolIds.add(pool.id);
    const point = this.arena.toScreen(pool.position);
    const radius = pool.radius;
    const image = this.scene.add.image(point.x, point.y, 'fx-blood-pool')
      .setScale(radius * 2.2 / 128, radius * 2.2 / 80).setAlpha(pool.source === 'corpse' ? 0.9 : 0.65)
      .setDepth(point.y - 0.3).setName(`blood-pool-${pool.id}`);
    this.pools.set(pool.id, image);
  }

  private showPrint(print: BloodFootprint): void {
    if (this.printIds.has(print.id)) return;
    this.printIds.add(print.id);
    const point = this.arena.toScreen(print.position);
    const [dx, dy] = directionVector(print.direction);
    const image = this.scene.add.image(point.x, point.y, 'fx-blood-footprint').setRotation(Math.atan2(dy, dx) + Math.PI / 2)
      .setScale(0.72).setAlpha(0.8).setDepth(point.y - 0.2).setName(`blood-print-${print.actorId}`);
    this.prints.set(print.id, image);
    this.scene.tweens.add({ targets: image, alpha: 0, duration: 4500, onComplete: () => { image.destroy(); this.prints.delete(print.id); } });
  }

  private showImpact(impact: BloodImpact): void {
    if (this.impactIds.has(impact.id)) return;
    this.impactIds.add(impact.id);
    const point = this.arena.toScreen(impact.position);
    const image = this.scene.add.image(point.x, point.y - 10, 'fx-blood-spray')
      .setScale(0.45 + impact.intensity * 0.18).setDepth(point.y + 8).setName('blood-spray');
    this.sprays.set(impact.id, image);
    this.scene.tweens.add({ targets: image, alpha: 0, scale: image.scale * 1.35, duration: 750,
      onComplete: () => { image.destroy(); this.sprays.delete(impact.id); this.impactIds.delete(impact.id); } });
  }

  private expire(map: Map<number, Phaser.GameObjects.Image>, live: Set<number>): void {
    for (const [id, image] of map) {
      if (live.has(id)) continue;
      this.scene.tweens.killTweensOf(image); image.destroy(); map.delete(id);
      if (map === this.prints) this.printIds.delete(id);
      else this.impactIds.delete(id);
    }
  }
}

function directionVector(direction: string): readonly [number, number] {
  const index = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'].indexOf(direction);
  const angle = index * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
}
