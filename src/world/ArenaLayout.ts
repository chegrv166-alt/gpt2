import type { Vec2 } from '../math/isometric';
import { CollisionGrid } from './CollisionGrid';

export type ObstacleKind = 'wall' | 'rock' | 'pillar' | 'brazier';

export interface ArenaObstacle {
  readonly tile: Vec2;
  readonly kind: ObstacleKind;
  readonly texture: string;
}

export interface ArenaLayout {
  readonly width: number;
  readonly height: number;
  readonly spawn: Vec2;
  readonly gate: Vec2;
  readonly obstacles: readonly ArenaObstacle[];
  readonly grid: CollisionGrid;
}

/** A single floor layer; every visible solid obstacle shares the navigation grid. */
export function createArenaLayout(): ArenaLayout {
  const width = 23;
  const height = 23;
  const placed = new Map<string, ArenaObstacle>();
  const add = (kind: ObstacleKind, x: number, y: number, side = 'nw'): void => {
    placed.set(`${x},${y}`, { tile: { x, y }, kind, texture: kind === 'wall' ? `wall-${side}` : `prop-${kind}` });
  };
  for (let index = 0; index < width; index += 1) {
    add('wall', index, 0, 'ne');
    add('wall', index, height - 1, 'ne');
    add('wall', 0, index, 'nw');
    add('wall', width - 1, index, 'nw');
  }
  for (let x = 3; x <= 9; x += 1) if (x !== 7) add('wall', x, 13, 'ne');
  for (let y = 4; y <= 18; y += 1) if (y < 10 || y > 12) add('wall', 12, y, 'nw');
  for (let x = 14; x <= 20; x += 1) if (x !== 17) add('wall', x, 7, 'ne');
  const props: ReadonlyArray<readonly [ObstacleKind, number, number]> = [
    ['rock', 3, 16], ['pillar', 8, 18], ['brazier', 10, 17], ['pillar', 3, 12],
    ['brazier', 9, 12], ['pillar', 9, 14], ['rock', 15, 16], ['pillar', 16, 7],
    ['brazier', 18, 6], ['rock', 20, 10], ['pillar', 17, 3], ['pillar', 19, 3],
    ['brazier', 17, 4], ['brazier', 19, 4], ['rock', 15, 19], ['rock', 4, 6],
    ['brazier', 3, 18], ['pillar', 8, 16], ['rock', 19, 18], ['pillar', 5, 8],
  ];
  for (const [kind, x, y] of props) add(kind, x, y);
  const obstacles = Array.from(placed.values());
  return {
    width, height, spawn: { x: 5, y: 17 }, gate: { x: 18, y: 4 }, obstacles,
    grid: new CollisionGrid(width, height, obstacles.map((obstacle) => obstacle.tile)),
  };
}
