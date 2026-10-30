import type { Vec2 } from '../math/isometric';
import { CollisionGrid } from './CollisionGrid';
import type { RoomNumber } from './rooms';

export type ObstacleKind = 'wall' | 'rock' | 'pillar' | 'brazier' | 'tree';

export interface ArenaObstacle {
  readonly tile: Vec2;
  readonly kind: ObstacleKind;
  readonly texture: string;
}

export interface ArenaLayout {
  readonly room: RoomNumber;
  readonly width: number;
  readonly height: number;
  readonly spawn: Vec2;
  readonly gate: Vec2;
  readonly obstacles: readonly ArenaObstacle[];
  readonly grid: CollisionGrid;
}

/** A single floor layer; every visible solid obstacle shares the navigation grid. */
export function createArenaLayout(room: RoomNumber = 1): ArenaLayout {
  const width = room === 1 ? 92 : 23;
  const height = 23;
  const placed = new Map<string, ArenaObstacle>();
  const add = (kind: ObstacleKind, x: number, y: number, side = 'nw'): void => {
    placed.set(`${x},${y}`, { tile: { x, y }, kind, texture: kind === 'wall' ? `wall-${side}` : `prop-${kind}` });
  };
  for (let index = 0; index < Math.max(width, height); index += 1) {
    if (index < width) {
      add(room === 1 ? 'tree' : 'wall', index, 0, 'ne');
      add(room === 1 ? 'tree' : 'wall', index, height - 1, 'ne');
    }
    if (index < height) {
      add(room === 1 ? 'tree' : 'wall', 0, index, 'nw');
      add(room === 1 ? 'tree' : 'wall', width - 1, index, 'nw');
    }
  }
  if (room === 1) {
    for (let x = 1; x < width - 1; x++) for (let y = 1; y < height - 1; y++) {
      if (Math.abs(y - forestPathY(x)) > 4) add('tree', x, y);
    }
    for (const x of [20, 40, 60, 80]) add('brazier', x, forestPathY(x) + 3);
  } else if (room === 2) {
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
  } else {
    for (let x = 2; x <= 17; x += 1) if (x !== 6 && x !== 7 && x !== 14) add('wall', x, 15, 'ne');
    for (let y = 3; y <= 14; y += 1) if (y !== 6 && y !== 7 && y !== 11) add('wall', 13, y, 'nw');
    for (let x = 14; x <= 20; x += 1) if (x !== 18) add('wall', x, 9, 'ne');
    const props: ReadonlyArray<readonly [ObstacleKind, number, number]> = [
      ['pillar', 3, 18], ['brazier', 4, 18], ['pillar', 10, 18], ['rock', 18, 18],
      ['pillar', 4, 10], ['brazier', 4, 11], ['pillar', 9, 8], ['brazier', 10, 8],
      ['pillar', 16, 12], ['brazier', 20, 12], ['rock', 10, 5], ['rock', 6, 5],
      ['pillar', 16, 3], ['pillar', 20, 3], ['brazier', 17, 4], ['brazier', 19, 4],
    ];
    for (const [kind, x, y] of props) add(kind, x, y);
  }
  const obstacles = Array.from(placed.values());
  return {
    room, width, height, spawn: room === 1 ? { x: 3, y: forestPathY(3) } : room === 2 ? { x: 5, y: 17 } : { x: 5, y: 19 }, gate: room === 1 ? { x: 88, y: forestPathY(88) } : { x: 18, y: 2 }, obstacles,
    grid: new CollisionGrid(width, height, obstacles.map((obstacle) => obstacle.tile)),
  };
}

/** Centerline shared by forest terrain and its collision boundary. */
export function forestPathY(x: number): number { return 11 + Math.round(Math.sin(x / 13) * 3); }
