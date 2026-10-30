import { ENEMY_SPAWNS } from '../combat/definitions';
import type { EnemySpawn } from '../combat/definitions';

export type RoomNumber = 1 | 2 | 3;

export const ROOM_NAMES: Readonly<Record<RoomNumber, string>> = {
  1: 'Разбойничья тропа', 2: 'Забытое святилище', 3: 'Зал погребального огня',
};

export const ROOM_ENEMIES: Readonly<Record<RoomNumber, readonly EnemySpawn[]>> = {
  1: [
    { id: 1, kind: 'knife', position: { x: 12, y: 13 } },
    { id: 2, kind: 'spear', position: { x: 17, y: 14 } },
    { id: 3, kind: 'archer', position: { x: 23, y: 12 } },
    { id: 4, kind: 'knife', position: { x: 32, y: 12 } },
    { id: 5, kind: 'archer', position: { x: 38, y: 10 } },
    { id: 6, kind: 'spear', position: { x: 46, y: 9 } },
    { id: 7, kind: 'knife', position: { x: 54, y: 8 } },
    { id: 8, kind: 'archer', position: { x: 61, y: 8 } },
    { id: 9, kind: 'spear', position: { x: 70, y: 9 } },
    { id: 10, kind: 'knife', position: { x: 78, y: 10 } },
    { id: 11, kind: 'spear', position: { x: 82, y: 11 } },
    { id: 12, kind: 'archer', position: { x: 86, y: 12 } },
  ],
  2: ENEMY_SPAWNS,
  3: [
    { id: 1, kind: 'grunt', position: { x: 8, y: 18 } },
    { id: 2, kind: 'caster', position: { x: 5, y: 12 } },
    { id: 3, kind: 'grunt', position: { x: 11, y: 10 } },
    { id: 4, kind: 'caster', position: { x: 18, y: 13 } },
    { id: 5, kind: 'grunt', position: { x: 16, y: 7 } },
    { id: 6, kind: 'boss', position: { x: 18, y: 4 } },
  ],
};

export const ROOM_COUNT = 3;
export function nextRoom(room: RoomNumber): RoomNumber | null {
  return room === 1 ? 2 : room === 2 ? 3 : null;
}
