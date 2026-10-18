import type { Vec2 } from '../math/isometric';
import type { ArenaLayout } from '../world/ArenaLayout';
import type { CollisionGrid } from '../world/CollisionGrid';

export interface LightRGB { readonly r: number; readonly g: number; readonly b: number; }
export interface RoomLight { readonly id: string; readonly kind: 'brazier' | 'sconce'; readonly fixture: Vec2;
  readonly position: Vec2; readonly radius: number; readonly intensity: number; }
export const AMBIENT_LIGHT: LightRGB = Object.freeze({ r: 0.34, g: 0.38, b: 0.50 });
export const FLAME_COLOR: LightRGB = Object.freeze({ r: 1, g: 0.59, b: 0.22 });

/** Fixtures stay on their masonry tile; emission starts on its open side. */
export function getRoomLights(layout: ArenaLayout): readonly RoomLight[] {
  const lights: RoomLight[] = [];
  const add = (fixture: Vec2, kind: RoomLight['kind'], directions: readonly Vec2[]): void => {
    const position = directions.map((direction) => ({ x: fixture.x + direction.x * 0.88, y: fixture.y + direction.y * 0.88 }))
      .find((point) => layout.grid.canOccupy(point, 0.05));
    if (!position) return;
    lights.push({ id: `${kind}-${fixture.x}-${fixture.y}`, kind, fixture, position,
      radius: kind === 'brazier' ? 5.1 : 4.8, intensity: kind === 'brazier' ? 0.85 : 0.72 });
  };
  const cardinal = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  for (const obstacle of layout.obstacles) if (obstacle.kind === 'brazier') add(obstacle.tile, 'brazier', cardinal);
  for (const y of [5, 16]) {
    add({ x: 0, y }, 'sconce', [{ x: 1, y: 0 }]);
    add({ x: layout.width - 1, y }, 'sconce', [{ x: -1, y: 0 }]);
  }
  for (const x of [6, 18]) {
    add({ x, y: 0 }, 'sconce', [{ x: 0, y: 1 }]);
    add({ x, y: layout.height - 1 }, 'sconce', [{ x: 0, y: -1 }]);
  }
  return lights;
}

/** Nearest intersection between a ray and a solid tile's exact AABB. */
function rayBox(origin: Vec2, direction: Vec2, tile: Vec2, radius: number): number {
  let near = 0;
  let far = radius;
  for (const [start, delta, center] of [[origin.x, direction.x, tile.x], [origin.y, direction.y, tile.y]] as const) {
    if (Math.abs(delta) < 1e-10) {
      if (start < center - 0.5 || start > center + 0.5) return radius;
    } else {
      const a = (center - 0.5 - start) / delta;
      const b = (center + 0.5 - start) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return radius;
    }
  }
  return near;
}

/** Cast around every nearby tile corner once; no grid raycasts during frames. */
export function visibilityPolygon(source: Vec2, radius: number, blockers: readonly Vec2[]): readonly Vec2[] {
  const nearby = blockers.filter((tile) => Math.hypot(tile.x - source.x, tile.y - source.y) < radius + 0.72);
  const angles = Array.from({ length: 128 }, (_, i) => i * Math.PI * 2 / 128);
  for (const tile of nearby) for (const x of [tile.x - 0.5, tile.x + 0.5]) for (const y of [tile.y - 0.5, tile.y + 0.5]) {
    const angle = Math.atan2(y - source.y, x - source.x);
    angles.push(angle - 0.00001, angle, angle + 0.00001);
  }
  const circle = Math.PI * 2;
  return angles.map((angle) => (angle + circle) % circle).sort((a, b) => a - b).map((angle) => {
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    let distance = radius;
    for (const tile of nearby) distance = Math.min(distance, rayBox(source, direction, tile, radius));
    return { x: source.x + direction.x * distance, y: source.y + direction.y * distance };
  });
}

function contains(polygon: readonly Vec2[], point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface PreparedLight { readonly source: RoomLight; readonly polygon: readonly Vec2[]; }

export class LightField {
  public readonly lights: readonly PreparedLight[];

  public constructor(grid: CollisionGrid, lights: readonly RoomLight[]) {
    const blockers: Vec2[] = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.isBlocked(x, y)) blockers.push({ x, y });
    this.lights = lights.map((source) => ({ source, polygon: visibilityPolygon(source.position, source.radius, blockers) }));
  }

  public sample(point: Vec2): LightRGB {
    let intensity = 0;
    for (const { source, polygon } of this.lights) {
      const distance = Math.hypot(point.x - source.position.x, point.y - source.position.y);
      if (distance < source.radius && contains(polygon, point)) intensity += source.intensity * (1 - distance / source.radius) ** 2;
    }
    return { r: Math.min(1, AMBIENT_LIGHT.r + intensity * FLAME_COLOR.r),
      g: Math.min(1, AMBIENT_LIGHT.g + intensity * FLAME_COLOR.g), b: Math.min(1, AMBIENT_LIGHT.b + intensity * FLAME_COLOR.b) };
  }
}
