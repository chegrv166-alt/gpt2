import { ENEMY_SPAWNS } from '../combat/definitions';
import type { EnemySpawn } from '../combat/definitions';

export type RoomNumber = 1 | 2;

export const ROOM_NAMES: Readonly<Record<RoomNumber, string>> = {
  1: 'Забытое святилище', 2: 'Зал погребального огня',
};

export const ROOM_ENEMIES: Readonly<Record<RoomNumber, readonly EnemySpawn[]>> = {
  1: ENEMY_SPAWNS,
  2: [
    { id: 1, kind: 'grunt', position: { x: 8, y: 18 } },
    { id: 2, kind: 'caster', position: { x: 5, y: 12 } },
    { id: 3, kind: 'grunt', position: { x: 11, y: 10 } },
    { id: 4, kind: 'caster', position: { x: 18, y: 13 } },
    { id: 5, kind: 'grunt', position: { x: 16, y: 7 } },
    { id: 6, kind: 'boss', position: { x: 18, y: 4 } },
  ],
};
