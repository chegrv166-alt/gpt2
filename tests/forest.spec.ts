import { expect, test } from '@playwright/test';
import { createArenaLayout } from '../src/world/ArenaLayout';
import { ROOM_ENEMIES, ROOM_NAMES } from '../src/world/rooms';
import { findPath } from '../src/world/pathfinding';
import { AdventureSystem } from '../src/systems/AdventureSystem';
import { StatsComponent } from '../src/components/StatsComponent';
import { HERO_STATS, ENEMY_DEFINITIONS } from '../src/combat/definitions';
import type { EnemyKind } from '../src/combat/definitions';
import { CombatWorld } from '../src/combat/CombatWorld';
import { CollisionGrid } from '../src/world/CollisionGrid';
import { PlayerMotor } from '../src/entities/PlayerMotor';
import { createItem } from '../src/items/definitions';

test('forest is a connected 92×23 corridor followed by the original two dungeons', () => {
  const forest = createArenaLayout();
  expect([forest.width, forest.height]).toEqual([92, 23]);
  expect(ROOM_NAMES[2]).toBe('Забытое святилище');
  expect(ROOM_NAMES[3]).toBe('Зал погребального огня');
  expect(forest.gate.x).toBeGreaterThan(85);
  expect(new Set(ROOM_ENEMIES[1].map(s => s.kind))).toEqual(new Set(['knife', 'spear', 'archer']));
  for (const room of [1, 2, 3] as const) {
    const layout = createArenaLayout(room);
    expect(findPath(layout.grid, layout.spawn, layout.gate, 0.22)).not.toBeNull();
    for (const spawn of ROOM_ENEMIES[room]) {
      expect(layout.grid.canOccupy(spawn.position, ENEMY_DEFINITIONS[spawn.kind].radius)).toBe(true);
      expect(findPath(layout.grid, layout.spawn, spawn.position, 0.22)).not.toBeNull();
    }
  }
});

test('forest clear, both transitions, final lock and reset retain gear and resources correctly', () => {
  const stats = new StatsComponent(HERO_STATS);
  const run = new AdventureSystem(stats, createArenaLayout().grid);
  const weapon = createItem('forest-sword', 'weapon', 'rare');
  run.inventory.add(weapon); run.inventory.equip(0);
  run.inventory.add(createItem('forest-armor', 'armor', 'rare'));
  stats.applyDamage(31); stats.spendMana(18);
  const before = { hp: stats.hp, mana: stats.mana, damage: stats.values.attackDamage };
  run.update([], { x: 3, y: 11 }, true, 1);
  expect(run.exitUnlocked).toBe(false);
  run.update([], { x: 3, y: 11 }, true, 0);
  expect(run.exitUnlocked).toBe(true);
  expect(run.outcome).toBe('playing');
  run.toggleInventory();
  expect(run.exitUnlocked).toBe(true); // An open modal blocks travel, not the gate state.
  expect(run.enterNextRoom(createArenaLayout(2).grid)).toBe(false);
  run.toggleInventory();
  expect(run.exitUnlocked).toBe(true); // An open modal blocks travel, not the gate state.
  expect(run.enterNextRoom(createArenaLayout(2).grid)).toBe(true);
  expect(run.room).toBe(2);
  run.update([], { x: 5, y: 17 }, true, 0);
  expect(run.exitUnlocked).toBe(false); // Dungeon still requires its boss.
  run.update([{ type: 'death', targetId: 6, kind: 'boss', position: { x: 18, y: 4 }, direction: 'n' }], { x: 5, y: 17 }, true, 0);
  expect(run.enterNextRoom(createArenaLayout(3).grid)).toBe(false); // Victory modal.
  run.continueAfterVictory();
  expect(run.enterNextRoom(createArenaLayout(3).grid)).toBe(true);
  expect(run.room).toBe(3);
  expect(run.inventory.equipment.weapon).toBe(weapon);
  expect(run.inventory.count).toBe(1);
  expect({ hp: stats.hp, mana: stats.mana, damage: stats.values.attackDamage }).toEqual(before);
  run.update([{ type: 'death', targetId: 6, kind: 'boss', position: { x: 18, y: 4 }, direction: 'n' }], { x: 5, y: 19 }, true, 0);
  run.continueAfterVictory();
  expect(run.cleared).toBe(true);
  expect(run.exitUnlocked).toBe(false);
  expect(run.enterNextRoom(createArenaLayout().grid)).toBe(false);
  run.reset(false);
  expect(run.room).toBe(3);
  expect(run.inventory.equipment.weapon).toBe(weapon);
  run.reset(true);
  expect(run.room).toBe(1);
  expect(run.inventory.count).toBe(0);
});

test('bandit weapons have different reach and archers shoot damaging arrows then retreat', () => {
  expect(ENEMY_DEFINITIONS['spear' as EnemyKind]?.range).toBeGreaterThan(ENEMY_DEFINITIONS['knife' as EnemyKind]?.range ?? 0);
  const grid = new CollisionGrid(20, 20, []);
  const motor = new PlayerMotor(grid, { x: 5, y: 5 });
  const world = new CombatWorld(grid, motor, new StatsComponent(HERO_STATS), [
    { id: 1, kind: 'archer' as EnemyKind, position: { x: 9, y: 5 } },
  ], () => 0.9);
  let sawArrow = false;
  for (let i = 0; i < 150; i++) {
    world.update(1 / 60, { x: 0, y: 0 });
    sawArrow ||= world.projectiles.active.some(p => p.visual === 'arrow');
  }
  expect(sawArrow).toBe(true);
  expect(world.hero.stats.hp).toBeLessThan(HERO_STATS.maxHp);
  const archer = world.enemies[0]!;
  motor.reset({ x: archer.motor.position.x - 1, y: archer.motor.position.y });
  const oldX = archer.motor.position.x;
  for (let i = 0; i < 180; i++) world.update(1 / 60, { x: 0, y: 0 });
  expect(archer.motor.position.x).toBeGreaterThan(oldX);
});

test('spears actually hit beyond knife reach and arrows stop at trees', () => {
  const grid = new CollisionGrid(20, 20, []);
  for (const kind of ['knife', 'spear'] as const) {
    const world = new CombatWorld(grid, new PlayerMotor(grid, { x: 5, y: 5 }), new StatsComponent(HERO_STATS), [
      { id: 1, kind, position: { x: 6.7, y: 5 } },
    ], () => 0.9);
    world.enemies[0]!.motor.setSpeed(0.01); // Measure reach without approach movement.
    for (let i = 0; i < 60; i++) world.update(1 / 60, { x: 0, y: 0 });
    expect(world.hero.stats.hp < HERO_STATS.maxHp).toBe(kind === 'spear');
  }
  const trees = new CollisionGrid(20, 20, Array.from({ length: 20 }, (_, y) => ({ x: 7, y })));
  const blocked = new CombatWorld(trees, new PlayerMotor(trees, { x: 5, y: 5 }), new StatsComponent(HERO_STATS), [
    { id: 1, kind: 'archer', position: { x: 9, y: 5 } },
  ], () => 0.9);
  for (let i = 0; i < 120; i++) blocked.update(1 / 60, { x: 0, y: 0 });
  expect(blocked.projectiles.active).toHaveLength(0);
  blocked.projectiles.spawn({ sourceId: 1, team: 'enemy', visual: 'arrow', from: { x: 9, y: 5 }, aim: { x: 5, y: 5 },
    speed: 7, radius: 0.1, power: 1, splashRadius: 0, lifespan: 2.3, attack: ENEMY_DEFINITIONS.archer.stats });
  for (let i = 0; i < 120; i++) blocked.update(1 / 60, { x: 0, y: 0 });
  expect(blocked.projectiles.active).toHaveLength(0);
  expect(blocked.hero.stats.hp).toBe(HERO_STATS.maxHp);
});
