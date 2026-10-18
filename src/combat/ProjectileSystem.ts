import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';
import type { Team } from './definitions';
import { segmentCircleHitTime, unitVector } from './geometry';
import type { AttackProfile } from './geometry';

export interface ProjectileRequest {
  readonly sourceId: number;
  readonly team: Team;
  readonly from: Vec2;
  readonly aim: Vec2;
  readonly speed: number;
  readonly radius: number;
  readonly power: number;
  readonly splashRadius: number;
  readonly lifespan: number;
  readonly attack: AttackProfile;
}

export interface Projectile {
  readonly id: number;
  readonly sourceId: number;
  readonly team: Team;
  position: Vec2;
  readonly velocity: Vec2;
  readonly radius: number;
  readonly power: number;
  readonly splashRadius: number;
  remaining: number;
  readonly attack: AttackProfile;
}

export interface ProjectileBody {
  readonly id: number;
  readonly team: Team;
  readonly position: Vec2;
  readonly radius: number;
  readonly alive: boolean;
}

export interface ProjectileImpact {
  readonly projectile: Projectile;
  readonly position: Vec2;
  readonly targetId: number | null;
}

/** Swept collisions choose the first actor or wall along each flight segment. */
export class ProjectileSystem {
  private items: Projectile[] = [];
  private nextId = 1;

  public constructor(private readonly grid: CollisionGrid) {}
  public get active(): readonly Projectile[] { return this.items; }

  public spawn(request: ProjectileRequest): void {
    const direction = unitVector(request.from, request.aim);
    if (!this.grid.canOccupy(request.from, request.radius)) return;
    this.items.push({
      id: this.nextId++, sourceId: request.sourceId, team: request.team, position: { ...request.from },
      velocity: { x: direction.x * request.speed, y: direction.y * request.speed },
      radius: request.radius, power: request.power, splashRadius: request.splashRadius,
      remaining: request.lifespan, attack: { ...request.attack },
    });
  }

  public update(seconds: number, bodies: readonly ProjectileBody[]): ProjectileImpact[] {
    const impacts: ProjectileImpact[] = [];
    const survivors: Projectile[] = [];
    for (const projectile of this.items) {
      const travel = Math.min(seconds, projectile.remaining);
      const from = projectile.position;
      const to = { x: from.x + projectile.velocity.x * travel, y: from.y + projectile.velocity.y * travel };
      let first = 1;
      let collision = false;
      let targetId: number | null = null;
      if (!this.grid.isSegmentClear(from, to, projectile.radius)) {
        let low = 0;
        let high = 1;
        for (let i = 0; i < 18; i += 1) {
          const middle = (low + high) / 2;
          const point = { x: from.x + (to.x - from.x) * middle, y: from.y + (to.y - from.y) * middle };
          if (this.grid.isSegmentClear(from, point, projectile.radius)) low = middle;
          else high = middle;
        }
        first = low;
        collision = true;
      }
      for (const body of bodies) {
        if (!body.alive || body.team === projectile.team || body.id === projectile.sourceId) continue;
        const time = segmentCircleHitTime(from, to, body.position, body.radius + projectile.radius);
        if (time !== null && time < first) {
          first = time;
          collision = true;
          targetId = body.id;
        }
      }
      projectile.position = { x: from.x + (to.x - from.x) * first, y: from.y + (to.y - from.y) * first };
      projectile.remaining -= travel;
      if (collision || projectile.remaining <= 0.000001) {
        if (collision || projectile.splashRadius > 0) impacts.push({ projectile, position: projectile.position, targetId });
      } else survivors.push(projectile);
    }
    this.items = survivors;
    return impacts;
  }

  public clear(): void { this.items = []; }
}
