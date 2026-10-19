import type { Direction } from '../assets/catalog';
import { directionFromScreen, isoToScreen } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { EnemyKind } from '../combat/definitions';

export interface BloodCorpse { readonly id: number; readonly actorId: number; readonly kind: EnemyKind; readonly position: Vec2; readonly direction: Direction; }
export interface BloodPool { readonly id: number; readonly position: Vec2; readonly radius: number; readonly source: 'corpse' | 'impact'; }
export interface BloodImpact { readonly id: number; readonly position: Vec2; readonly intensity: number; seconds: number; }
export interface BloodFootprint { readonly id: number; readonly actorId: number; readonly position: Vec2; readonly direction: Direction; seconds: number; }

/** Room-scoped cosmetic blood state, independent of Phaser and combat rules. */
export class BloodField {
  public readonly corpses: BloodCorpse[] = [];
  public readonly pools: BloodPool[] = [];
  public readonly impacts: BloodImpact[] = [];
  public readonly footprints: BloodFootprint[] = [];
  private readonly corpseIds = new Set<number>();
  private readonly lastPositions = new Map<number, Vec2>();
  private nextId = 1;
  private readonly stride = new Map<number, number>();

  public addCorpse(actorId: number, kind: EnemyKind, position: Vec2, direction: Direction): boolean {
    if (this.corpseIds.has(actorId)) return false;
    this.corpseIds.add(actorId);
    const point = { ...position };
    this.corpses.push({ id: this.nextId++, actorId, kind, position: point, direction });
    this.pools.push({ id: this.nextId++, position: { x: point.x + 0.13, y: point.y - 0.08 }, radius: kind === 'boss' ? 0.64 : 0.46, source: 'corpse' });
    return true;
  }

  public addImpact(position: Vec2, intensity: number): BloodImpact {
    const impact = { id: this.nextId++, position: { ...position }, intensity: Math.max(0.2, Math.min(2, intensity)), seconds: 0 };
    this.impacts.push(impact);
    this.pools.push({ id: this.nextId++, position: { ...position }, radius: 0.28 + impact.intensity * 0.15, source: 'impact' });
    return impact;
  }

  public sampleActor(actorId: number, position: Vec2, _seconds: number): BloodFootprint[] {
    const previous = this.lastPositions.get(actorId);
    this.lastPositions.set(actorId, { ...position });
    if (!previous) return [];
    const dx = position.x - previous.x; const dy = position.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.0001) return [];
    const direction = directionFromVector(dx, dy);
    const result: BloodFootprint[] = [];
    let progress = this.stride.get(actorId) ?? 0;
    const strideLength = 0.52;
    const steps = Math.max(1, Math.ceil(distance / 0.08));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const point = { x: previous.x + dx * t, y: previous.y + dy * t };
      if (!this.pools.some((pool) => Math.hypot(point.x - pool.position.x, point.y - pool.position.y) <= pool.radius)) continue;
      progress += distance / steps;
      if (progress >= strideLength) {
        progress %= strideLength;
        const footprint: BloodFootprint = { id: this.nextId++, actorId, position: point, direction, seconds: 0 };
        this.footprints.push(footprint); result.push(footprint);
      }
    }
    this.stride.set(actorId, progress);
    return result;
  }

  public update(seconds: number): void {
    const dt = Math.max(0, seconds);
    for (const impact of this.impacts) impact.seconds += dt;
    for (const footprint of this.footprints) footprint.seconds += dt;
    this.impacts.splice(0, this.impacts.length, ...this.impacts.filter((impact) => impact.seconds < 0.75));
    this.footprints.splice(0, this.footprints.length, ...this.footprints.filter((print) => print.seconds < 4.5));
  }

  public clear(): void {
    this.corpses.length = 0; this.pools.length = 0; this.impacts.length = 0; this.footprints.length = 0;
    this.corpseIds.clear(); this.lastPositions.clear(); this.stride.clear(); this.nextId = 1;
  }
}

function directionFromVector(x: number, y: number): Direction {
  return directionFromScreen(isoToScreen({ x, y }));
}
