import { expect, test } from '@playwright/test';
import { AdventureSystem } from '../src/systems/AdventureSystem';
import { StatsComponent } from '../src/components/StatsComponent';
import { HERO_STATS } from '../src/combat/definitions';
import type { CombatEvent } from '../src/combat/definitions';
import { createArenaLayout } from '../src/world/ArenaLayout';
import { ROOM_ENEMIES } from '../src/world/rooms';
import { findPath } from '../src/world/pathfinding';
import { createItem } from '../src/items/definitions';

const bossDeath: CombatEvent = { type: 'death', targetId: 6, kind: 'boss', position: { x: 18, y: 4 } };

test('the next room requires a living hero, a defeated boss, all enemies cleared and a closed modal', () => {
  const first = createArenaLayout();
  const second = createArenaLayout(2);
  const run = new AdventureSystem(new StatsComponent(HERO_STATS), first.grid);
  expect(run.enterNextRoom(second.grid)).toBe(false);
  run.update([], first.spawn, true, 0);
  expect(run.exitUnlocked).toBe(false);
  run.update([bossDeath], first.spawn, true, 1);
  expect(run.exitUnlocked).toBe(false);
  run.continueAfterVictory();
  run.update([], first.spawn, true, 0);
  expect(run.exitUnlocked).toBe(true);
  run.toggleInventory();
  expect(run.enterNextRoom(second.grid)).toBe(false);
  run.toggleInventory();
  expect(run.enterNextRoom(second.grid)).toBe(true);
  expect(run.room).toBe(2);
  expect(run.exitUnlocked).toBe(false);
  expect(run.enterNextRoom(first.grid)).toBe(false);
  run.update([bossDeath], second.spawn, false, 0);
  expect(run.outcome).toBe('dead');
  expect(run.exitUnlocked).toBe(false);
});

test('room transitions preserve equipment, bag, resource values and distinct loot identities', () => {
  const stats = new StatsComponent(HERO_STATS);
  const first = createArenaLayout();
  const second = createArenaLayout(2);
  const run = new AdventureSystem(stats, first.grid, () => 0.1);
  const sword = createItem('kept-sword', 'weapon', 'rare');
  run.inventory.add(sword); run.inventory.equip(0);
  run.inventory.add(createItem('kept-armor', 'armor', 'rare'));
  stats.applyDamage(25); stats.spendMana(18);
  run.update([bossDeath], first.spawn, true, 0);
  const oldReward = run.loot.drops[0]!.item;
  run.inventory.add(oldReward);
  run.continueAfterVictory();
  const before = { hp: stats.hp, mana: stats.mana, damage: stats.values.attackDamage };
  expect(run.enterNextRoom(second.grid)).toBe(true);
  expect(run.inventory.equipment.weapon).toBe(sword);
  expect(run.inventory.count).toBe(2);
  expect({ hp: stats.hp, mana: stats.mana, damage: stats.values.attackDamage }).toEqual(before);
  expect(run.loot.drops).toHaveLength(0);
  run.update([bossDeath], second.spawn, true, 0);
  expect(run.outcome).toBe('victory');
  expect(run.loot.drops[0]?.item.id).not.toBe(oldReward.id);
  expect(run.inventory.add(run.loot.drops[0]!.item)).toBe(true);
  run.reset(false);
  expect(run.room).toBe(2);
  expect(run.inventory.count).toBe(3);
  run.reset(true);
  expect(run.room).toBe(1);
  expect(run.inventory.count).toBe(0);
});

test('each room has a distinct layout and reachable entry, exit and enemy spawns', () => {
  const first = createArenaLayout();
  const second = createArenaLayout(2);
  expect(second.obstacles).not.toEqual(first.obstacles);
  for (const room of [1, 2] as const) {
    const layout = createArenaLayout(room);
    expect(findPath(layout.grid, layout.spawn, layout.gate, 0.22)).not.toBeNull();
    expect(ROOM_ENEMIES[room].some((spawn) => spawn.kind === 'boss')).toBe(true);
    for (const spawn of ROOM_ENEMIES[room]) {
      expect(layout.grid.canOccupy(spawn.position, spawn.kind === 'boss' ? 0.38 : 0.24)).toBe(true);
      expect(findPath(layout.grid, layout.spawn, spawn.position, 0.22)).not.toBeNull();
    }
  }
});
