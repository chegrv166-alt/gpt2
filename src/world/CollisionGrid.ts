import type { Vec2 } from '../math/isometric';

function distanceToBoxSquared(point: Vec2, x: number, y: number): number {
  const dx = Math.max(Math.abs(point.x - x) - 0.5, 0);
  const dy = Math.max(Math.abs(point.y - y) - 0.5, 0);
  return dx * dx + dy * dy;
}

/** Exact segment/box distance: intersection, endpoint/edge or corner/segment. */
function segmentDistanceToBoxSquared(from: Vec2, to: Vec2, x: number, y: number): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let exit = 1;
  let intersects = true;
  const axes: ReadonlyArray<readonly [number, number, number, number]> = [
    [from.x, dx, x - 0.5, x + 0.5], [from.y, dy, y - 0.5, y + 0.5],
  ];
  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 0.0000001) {
      if (origin < min || origin > max) intersects = false;
    } else {
      const a = (min - origin) / delta;
      const b = (max - origin) / delta;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (enter > exit) intersects = false;
    }
  }
  if (intersects) return 0;
  let minimum = Math.min(distanceToBoxSquared(from, x, y), distanceToBoxSquared(to, x, y));
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return minimum;
  for (const cornerX of [x - 0.5, x + 0.5]) {
    for (const cornerY of [y - 0.5, y + 0.5]) {
      const t = Math.max(0, Math.min(1, ((cornerX - from.x) * dx + (cornerY - from.y) * dy) / lengthSquared));
      const offsetX = cornerX - (from.x + dx * t);
      const offsetY = cornerY - (from.y + dy * t);
      minimum = Math.min(minimum, offsetX * offsetX + offsetY * offsetY);
    }
  }
  return minimum;
}

/** Circle versus solid tile AABBs in ground space, independent of Phaser. */
export class CollisionGrid {
  private readonly blocked = new Set<number>();

  public constructor(public readonly width: number, public readonly height: number, obstacles: readonly Vec2[]) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new Error('Collision grid dimensions must be positive integers');
    }
    for (const point of obstacles) {
      if (!Number.isInteger(point.x) || !Number.isInteger(point.y)
        || point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
        throw new Error('Obstacle lies outside the collision grid');
      }
      this.blocked.add(point.y * width + point.x);
    }
  }

  public isBlocked(x: number, y: number): boolean {
    return x < 0 || y < 0 || x >= this.width || y >= this.height || this.blocked.has(y * this.width + x);
  }

  public canOccupy(point: Vec2, radius: number): boolean {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(radius) || radius < 0) return false;
    if (point.x - radius < -0.5 || point.y - radius < -0.5
      || point.x + radius > this.width - 0.5 || point.y + radius > this.height - 0.5) return false;
    const minX = Math.floor(point.x - radius + 0.5);
    const maxX = Math.floor(point.x + radius + 0.5);
    const minY = Math.floor(point.y - radius + 0.5);
    const maxY = Math.floor(point.y + radius + 0.5);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!this.isBlocked(x, y)) continue;
        const closestX = Math.max(x - 0.5, Math.min(point.x, x + 0.5));
        const closestY = Math.max(y - 0.5, Math.min(point.y, y + 0.5));
        if (Math.hypot(point.x - closestX, point.y - closestY) < radius + 0.000001) return false;
      }
    }
    return true;
  }

  public move(from: Vec2, delta: Vec2, radius: number): Vec2 {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return from;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / 0.08));
    const stepX = delta.x / steps;
    const stepY = delta.y / steps;
    let point = { ...from };
    for (let i = 0; i < steps; i += 1) {
      const forward = { x: point.x + stepX, y: point.y + stepY };
      if (this.isSegmentClear(point, forward, radius)) {
        point = forward;
        continue;
      }
      const horizontal = { x: point.x + stepX, y: point.y };
      if (this.isSegmentClear(point, horizontal, radius)) point = horizontal;
      const vertical = { x: point.x, y: point.y + stepY };
      if (this.isSegmentClear(point, vertical, radius)) point = vertical;
    }
    return point;
  }

  public isSegmentClear(from: Vec2, to: Vec2, radius: number): boolean {
    if (!this.canOccupy(from, radius) || !this.canOccupy(to, radius)) return false;
    const minX = Math.floor(Math.min(from.x, to.x) - radius + 0.5);
    const maxX = Math.floor(Math.max(from.x, to.x) + radius + 0.5);
    const minY = Math.floor(Math.min(from.y, to.y) - radius + 0.5);
    const maxY = Math.floor(Math.max(from.y, to.y) + radius + 0.5);
    const clearance = (radius + 0.000001) ** 2;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (this.isBlocked(x, y) && segmentDistanceToBoxSquared(from, to, x, y) < clearance) return false;
      }
    }
    return true;
  }
}
