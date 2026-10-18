import type { Vec2 } from '../math/isometric';
import type { StatValues } from '../components/StatsComponent';

export type AttackProfile = Pick<StatValues, 'attackDamage' | 'critChance' | 'critMultiplier'>;
export interface DamageRoll { readonly amount: number; readonly critical: boolean; }

export function rollDamage(attack: AttackProfile, armor: number, power = 1, random: () => number = Math.random): DamageRoll {
  const critical = random() < attack.critChance;
  const raw = attack.attackDamage * power * (critical ? attack.critMultiplier : 1);
  return { amount: Math.max(1, Math.round(raw * 100 / (100 + Math.max(0, armor)))), critical };
}

export function unitVector(from: Vec2, to: Vec2, fallback: Vec2 = { x: 1, y: 0 }): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > 0.000001 ? { x: dx / length, y: dy / length } : fallback;
}

function pointSegmentDistance(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length)) : 0;
  return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
}

/** Exact circle/filled-sector overlap, including both radial edges and the arc. */
export function circleIntersectsSector(origin: Vec2, facing: Vec2, range: number, halfAngle: number, target: Vec2, radius: number): boolean {
  const delta = { x: target.x - origin.x, y: target.y - origin.y };
  const distance = Math.hypot(delta.x, delta.y);
  if (distance <= radius) return true;
  if (distance > range + radius) return false;
  const direction = unitVector({ x: 0, y: 0 }, facing);
  const angle = Math.acos(Math.max(-1, Math.min(1, (delta.x * direction.x + delta.y * direction.y) / distance)));
  if (angle <= halfAngle) return Math.max(0, distance - range) <= radius;
  for (const sign of [-1, 1]) {
    const cos = Math.cos(halfAngle * sign);
    const sin = Math.sin(halfAngle * sign);
    const edge = { x: origin.x + (direction.x * cos - direction.y * sin) * range,
      y: origin.y + (direction.x * sin + direction.y * cos) * range };
    if (pointSegmentDistance(target, origin, edge) <= radius) return true;
  }
  return false;
}

export function segmentCircleHitTime(from: Vec2, to: Vec2, center: Vec2, radius: number): number | null {
  const ox = from.x - center.x;
  const oy = from.y - center.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 0.00000001) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
