import { expect, test } from '@playwright/test';
import { directionFromScreen, isoToScreen, screenToIso, screenVectorToIso } from '../src/math/isometric';
import { CollisionGrid } from '../src/world/CollisionGrid';
import { findPath } from '../src/world/pathfinding';
import { PlayerMotor } from '../src/entities/PlayerMotor';
import { createArenaLayout } from '../src/world/ArenaLayout';

test('isometric projection round-trips fractional and negative coordinates with an origin', () => {
  const origin = { x: 1536, y: 160 };
  for (const point of [{ x: 0, y: 0 }, { x: 5.25, y: 17.8 }, { x: -3.4, y: 2.75 }]) {
    const screen = isoToScreen(point, origin);
    const restored = screenToIso(screen, origin);
    expect(restored.x).toBeCloseTo(point.x, 10);
    expect(restored.y).toBeCloseTo(point.y, 10);
  }
  expect(isoToScreen({ x: 1, y: 0 })).toEqual({ x: 64, y: 32 });
  expect(isoToScreen({ x: 0, y: 1 })).toEqual({ x: -64, y: 32 });
});

test('screen controls produce unit ground vectors and eight stable facing directions', () => {
  for (const input of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }]) {
    const vector = screenVectorToIso(input);
    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1, 10);
  }
  const vectors = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
    { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }];
  expect(vectors.map((vector) => directionFromScreen(vector))).toEqual(['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne']);
  expect(directionFromScreen({ x: 0, y: 0 }, 'nw')).toBe('nw');
});

test('circle collision blocks walls, map edges and fast movement without tunneling', () => {
  const grid = new CollisionGrid(8, 8, Array.from({ length: 8 }, (_, y) => ({ x: 3, y })));
  expect(grid.canOccupy({ x: 2.2, y: 3 }, 0.22)).toBe(true);
  expect(grid.canOccupy({ x: 2.4, y: 3 }, 0.22)).toBe(false);
  expect(grid.canOccupy({ x: -0.4, y: 1 }, 0.22)).toBe(false);
  const moved = grid.move({ x: 1, y: 3 }, { x: 6, y: 1 }, 0.22);
  expect(moved.x).toBeLessThanOrEqual(2.28);
  expect(moved.y).toBeCloseTo(4, 6);
  expect(grid.canOccupy(moved, 0.22)).toBe(true);
});

test('A* routes around walls and rejects blocked destinations and sealed corners', () => {
  const grid = new CollisionGrid(9, 9, [
    { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
  ]);
  const start = { x: 2.2, y: 4.1 };
  const destination = { x: 6.25, y: 4.1 };
  expect(grid.isSegmentClear(start, destination, 0.22)).toBe(false);
  const path = findPath(grid, start, destination, 0.22);
  expect(path).not.toBeNull();
  let previous = start;
  for (const point of path ?? []) {
    expect(grid.isSegmentClear(previous, point, 0.22)).toBe(true);
    previous = point;
  }
  expect(previous).toEqual(destination);
  expect(findPath(grid, start, { x: 4, y: 4 }, 0.22)).toBeNull();
  const sealed = new CollisionGrid(4, 4, [{ x: 1, y: 0 }, { x: 0, y: 1 }]);
  expect(findPath(sealed, { x: 0, y: 0 }, { x: 1, y: 1 }, 0.22)).toBeNull();
});

test('swept collision detects a grazing corner between potential sample points', () => {
  const grid = new CollisionGrid(8, 8, [{ x: 3, y: 3 }]);
  const center = (5 - Math.SQRT2 * (0.22 - 0.000001)) / 2;
  const from = { x: center - 0.51, y: center + 0.51 };
  const to = { x: center + 0.42, y: center - 0.42 };
  expect(grid.canOccupy(from, 0.22)).toBe(true);
  expect(grid.canOccupy(to, 0.22)).toBe(true);
  expect(grid.isSegmentClear(from, to, 0.22)).toBe(false);
});

test('player movement is frame-rate independent with no diagonal speed boost', () => {
  const grid = new CollisionGrid(40, 40, []);
  const straight = new PlayerMotor(grid, { x: 15, y: 15 }, { speed: 3, radius: 0.22 });
  const diagonal = new PlayerMotor(grid, { x: 15, y: 15 }, { speed: 3, radius: 0.22 });
  const slowerFrames = new PlayerMotor(grid, { x: 15, y: 15 }, { speed: 3, radius: 0.22 });
  const verySlowFrames = new PlayerMotor(grid, { x: 15, y: 15 }, { speed: 3, radius: 0.22 });
  for (let i = 0; i < 60; i += 1) {
    straight.tick(1 / 60, { x: 1, y: 0 });
    diagonal.tick(1 / 60, { x: 1, y: -1 });
  }
  for (let i = 0; i < 30; i += 1) slowerFrames.tick(1 / 30, { x: 1, y: 0 });
  for (let i = 0; i < 5; i += 1) verySlowFrames.tick(1 / 5, { x: 1, y: 0 });
  for (const motor of [straight, diagonal, slowerFrames, verySlowFrames]) {
    expect(Math.hypot(motor.position.x - 15, motor.position.y - 15)).toBeCloseTo(3, 6);
    expect(motor.state).toBe('walk');
  }
  expect(straight.position.x).toBeCloseTo(slowerFrames.position.x, 6);
  expect(straight.direction).toBe('e');
  expect(diagonal.direction).toBe('ne');
});

test('player arrives at the exact click target and keyboard cancels a route', () => {
  const grid = new CollisionGrid(12, 12, [{ x: 5, y: 5 }]);
  const motor = new PlayerMotor(grid, { x: 3, y: 5 }, { speed: 3.4, radius: 0.22 });
  expect(motor.setDestination({ x: 7.25, y: 5.1 })).toBe(true);
  for (let i = 0; i < 240; i += 1) motor.tick(1 / 60, { x: 0, y: 0 });
  expect(motor.position.x).toBeCloseTo(7.25, 6);
  expect(motor.position.y).toBeCloseTo(5.1, 6);
  expect(motor.mode).toBe('idle');
  expect(motor.setDestination({ x: 3, y: 5 })).toBe(true);
  motor.tick(1 / 60, { x: 0, y: -1 });
  expect(motor.mode).toBe('keyboard');
  expect(motor.path).toEqual([]);
  motor.tick(1 / 60, { x: 0, y: 0 });
  expect(motor.state).toBe('idle');
});

test('the arena spawn and gate are connected and each walking segment respects colliders', () => {
  const arena = createArenaLayout();
  expect(arena.grid.canOccupy(arena.spawn, 0.22)).toBe(true);
  const path = findPath(arena.grid, arena.spawn, arena.gate, 0.22);
  expect(path).not.toBeNull();
  const motor = new PlayerMotor(arena.grid, arena.spawn, { speed: 8, radius: 0.22 });
  expect(motor.setDestination(arena.gate)).toBe(true);
  for (let i = 0; i < 1800 && motor.mode !== 'idle'; i += 1) {
    motor.tick(1 / 60, { x: 0, y: 0 });
    expect(arena.grid.canOccupy(motor.position, motor.radius)).toBe(true);
  }
  expect(Math.hypot(motor.position.x - arena.gate.x, motor.position.y - arena.gate.y)).toBeLessThan(0.01);
});
