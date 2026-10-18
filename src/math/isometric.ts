import { DIRECTIONS, TILE_HEIGHT, TILE_WIDTH } from '../assets/catalog';
import type { Direction } from '../assets/catalog';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

const ZERO: Vec2 = { x: 0, y: 0 };

/** Ground coordinates stay continuous; one unit equals one square tile. */
export function isoToScreen(point: Vec2, origin: Vec2 = ZERO): Vec2 {
  return {
    x: origin.x + (point.x - point.y) * TILE_WIDTH / 2,
    y: origin.y + (point.x + point.y) * TILE_HEIGHT / 2,
  };
}

export function screenToIso(point: Vec2, origin: Vec2 = ZERO): Vec2 {
  const x = (point.x - origin.x) / (TILE_WIDTH / 2);
  const y = (point.y - origin.y) / (TILE_HEIGHT / 2);
  return { x: (y + x) / 2, y: (y - x) / 2 };
}

export function screenVectorToIso(vector: Vec2): Vec2 {
  const ground = screenToIso(vector);
  const length = Math.hypot(ground.x, ground.y);
  return length > 0 ? { x: ground.x / length, y: ground.y / length } : ZERO;
}

export function directionFromScreen(vector: Vec2, fallback: Direction = 'se'): Direction {
  if (Math.hypot(vector.x, vector.y) < 0.00001) return fallback;
  const octant = Math.round(Math.atan2(vector.y, vector.x) / (Math.PI / 4));
  return DIRECTIONS[(octant + DIRECTIONS.length) % DIRECTIONS.length] ?? fallback;
}
