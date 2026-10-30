import { expect, test } from '@playwright/test';
import { LightField, AMBIENT_LIGHT, getRoomLights } from '../src/lighting/lighting';
import type { RoomLight } from '../src/lighting/lighting';
import { CollisionGrid } from '../src/world/CollisionGrid';
import { createArenaLayout } from '../src/world/ArenaLayout';

const flame: RoomLight = { id: 'test', kind: 'sconce', fixture: { x: 2, y: 3 },
  position: { x: 2, y: 3 }, radius: 6, intensity: 0.8 };

test('stationary amber light falls off smoothly into a navigable cold ambient', () => {
  const field = new LightField(new CollisionGrid(12, 12, []), [flame]);
  expect(field.sample({ x: 2.5, y: 3 }).r).toBeGreaterThan(field.sample({ x: 4, y: 3 }).r);
  expect(field.sample({ x: 4, y: 3 }).r).toBeGreaterThan(AMBIENT_LIGHT.r);
  expect(field.sample({ x: 10, y: 3 })).toEqual(AMBIENT_LIGHT);
  const lit = field.sample({ x: 2.5, y: 3 });
  expect(lit.r - AMBIENT_LIGHT.r).toBeGreaterThan(lit.b - AMBIENT_LIGHT.b);
  expect(AMBIENT_LIGHT.b).toBeGreaterThan(AMBIENT_LIGHT.r);
});

test('a solid wall casts a shadow while the adjoining doorway transmits light', () => {
  const wall = Array.from({ length: 12 }, (_, y) => ({ x: 5, y })).filter(({ y }) => y !== 3);
  const field = new LightField(new CollisionGrid(12, 12, wall), [flame]);
  expect(field.sample({ x: 7, y: 3 }).r).toBeGreaterThan(AMBIENT_LIGHT.r);
  expect(field.sample({ x: 7, y: 5 })).toEqual(AMBIENT_LIGHT);
  expect(field.sample({ x: 2, y: 1 }).r).toBeGreaterThan(AMBIENT_LIGHT.r);
});

test('a pillar casts a narrow shadow without extinguishing the light beside it', () => {
  const field = new LightField(new CollisionGrid(12, 12, [{ x: 4, y: 3 }]), [flame]);
  expect(field.sample({ x: 6, y: 3 })).toEqual(AMBIENT_LIGHT);
  expect(field.sample({ x: 6, y: 5 }).r).toBeGreaterThan(AMBIENT_LIGHT.r);
});

test('both rooms have fixed floor and wall fixtures with open emission points', () => {
  for (const room of [2, 3] as const) {
    const layout = createArenaLayout(room);
    const lights = getRoomLights(layout);
    expect(lights.filter((light) => light.kind === 'brazier')).toHaveLength(layout.obstacles.filter((o) => o.kind === 'brazier').length);
    expect(lights.some((light) => light.kind === 'sconce')).toBe(true);
    expect(new Set(lights.map((light) => light.id)).size).toBe(lights.length);
    for (const light of lights) expect(layout.grid.canOccupy(light.position, 0.05)).toBe(true);
  }
});
