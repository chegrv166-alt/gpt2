import { expect, test } from '@playwright/test';
import { StatsComponent } from '../src/components/StatsComponent';
import { InventoryComponent } from '../src/components/InventoryComponent';
import { HERO_STATS } from '../src/combat/definitions';
import type { CombatEvent } from '../src/combat/definitions';
import { createItem } from '../src/items/definitions';
import { LootSystem } from '../src/loot/LootSystem';
import { AdventureSystem } from '../src/systems/AdventureSystem';
import { CollisionGrid } from '../src/world/CollisionGrid';

const death = (id: number, kind: 'grunt' | 'caster' | 'boss' = 'grunt', x = 5): CombatEvent =>
  ({ type: 'death', targetId: id, kind, position: { x, y: 5 } });

test('a full ten-slot bag swaps equipment atomically and does not accumulate damage bonuses', () => {
  const stats = new StatsComponent(HERO_STATS);
  const inventory = new InventoryComponent(stats);
  expect(inventory.add(createItem('old', 'weapon', 'common'))).toBe(true);
  expect(inventory.equip(0)).toBe(true);
  const oldDamage = stats.values.attackDamage;
  for (let i = 0; i < 10; i += 1) expect(inventory.add(createItem(`new-${i}`, 'weapon', 'rare'))).toBe(true);
  expect(inventory.add(createItem('overflow', 'armor', 'common'))).toBe(false);
  expect(inventory.equip(0)).toBe(true);
  expect(inventory.count).toBe(10);
  expect(inventory.slots[0]?.id).toBe('old');
  expect(inventory.equipment.weapon?.id).toBe('new-0');
  expect(stats.values.attackDamage).toBeGreaterThan(oldDamage);
  expect(inventory.equip(0)).toBe(true);
  expect(stats.values.attackDamage).toBe(oldDamage);
  expect(inventory.unequip('weapon')).toBe(false);
  expect(inventory.equipment.weapon?.id).toBe('old');
});

test('equipping and removing armor clamps resources without healing or duplicating items', () => {
  const stats = new StatsComponent(HERO_STATS);
  const inventory = new InventoryComponent(stats);
  const armor = createItem('armor', 'armor', 'legendary');
  stats.applyDamage(20);
  expect(inventory.add(armor)).toBe(true);
  expect(inventory.add(armor)).toBe(false);
  expect(inventory.equip(0)).toBe(true);
  expect(inventory.add(armor)).toBe(false);
  expect(stats.hp).toBe(140);
  expect(stats.values.maxHp).toBeGreaterThan(160);
  stats.heal(100);
  expect(inventory.unequip('armor')).toBe(true);
  expect(stats.values.maxHp).toBe(160);
  expect(stats.hp).toBe(160);
  expect(inventory.slots[0]?.id).toBe('armor');
  expect(inventory.remove(0)?.id).toBe('armor');
  expect(inventory.remove(0)).toBeNull();
});

test('loot uses distinct item IDs, deduplicates deaths and guarantees a legendary boss reward', () => {
  const loot = new LootSystem(new CollisionGrid(12, 12, []), () => 0.1);
  loot.consume([death(1), death(1), death(2, 'boss')]);
  expect(loot.drops).toHaveLength(2);
  expect(loot.drops.find((drop) => drop.item.rarity === 'legendary')).toBeDefined();
  expect(new Set(loot.drops.map((drop) => drop.item.id)).size).toBe(2);
  const firstId = loot.drops[0]!.item.id;
  loot.clear();
  loot.consume([death(1)]);
  expect(loot.drops).toHaveLength(1);
  expect(loot.drops[0]?.item.id).not.toBe(firstId);
});

test('full bags and dead heroes leave ground loot intact; freeing a slot allows one pickup', () => {
  const stats = new StatsComponent(HERO_STATS);
  const inventory = new InventoryComponent(stats);
  for (let i = 0; i < 10; i += 1) inventory.add(createItem(`bag-${i}`, 'weapon', 'common'));
  const loot = new LootSystem(new CollisionGrid(12, 12, []), () => 0.1);
  loot.consume([death(1)]);
  const id = loot.drops[0]!.id;
  expect(loot.collect(id, { x: 5, y: 5 }, inventory, false)).toBe('dead');
  expect(loot.collect(id, { x: 5, y: 5 }, inventory, true)).toBe('full');
  expect(loot.drops).toHaveLength(1);
  inventory.remove(3);
  expect(loot.collect(id, { x: 5, y: 5 }, inventory, true)).toBe('picked');
  expect(loot.collect(id, { x: 5, y: 5 }, inventory, true)).toBe('missing');
  expect(inventory.count).toBe(10);
  expect(loot.drops).toHaveLength(0);
});

test('nearby loot cannot be picked through a wall or beyond the pickup radius', () => {
  const grid = new CollisionGrid(12, 12, [{ x: 6, y: 5 }]);
  const inventory = new InventoryComponent(new StatsComponent(HERO_STATS));
  const loot = new LootSystem(grid);
  const drop = loot.add(createItem('wall', 'armor', 'rare'), { x: 5.9, y: 5.65 });
  expect(loot.collect(drop.id, { x: 5.25, y: 5.3 }, inventory, true)).toBe('far');
  expect(loot.collectNearby({ x: 5.25, y: 5.3 }, inventory, true)).toHaveLength(0);
  expect(loot.collect(drop.id, { x: 4, y: 5.75 }, inventory, true)).toBe('far');
  expect(loot.collectNearby({ x: 5.9, y: 6.25 }, inventory, true)[0]?.result).toBe('picked');
  expect(inventory.count).toBe(1);
});

test('inventory pauses pickup, boss victory happens once and death has priority', () => {
  const adventure = new AdventureSystem(new StatsComponent(HERO_STATS), new CollisionGrid(12, 12, []), () => 0.1);
  expect(adventure.toggleInventory()).toBe(true);
  adventure.loot.consume([death(1)]);
  adventure.update([], { x: 5, y: 5 }, true);
  expect(adventure.inventory.count).toBe(0);
  expect(adventure.paused).toBe(true);
  expect(adventure.toggleInventory()).toBe(false);
  adventure.update([], { x: 5, y: 5 }, true);
  expect(adventure.inventory.count).toBe(1);
  adventure.update([death(2, 'boss', 8)], { x: 5, y: 5 }, true);
  expect(adventure.outcome).toBe('victory');
  adventure.continueAfterVictory();
  adventure.update([death(2, 'boss')], { x: 5, y: 5 }, true);
  expect(adventure.outcome).toBe('playing');
  adventure.reset(false);
  expect(adventure.inventory.count).toBe(1);
  adventure.update([death(2, 'boss')], { x: 5, y: 5 }, false);
  expect(adventure.outcome).toBe('dead');
  expect(adventure.toggleInventory()).toBe(false);
  adventure.reset(true);
  expect(adventure.inventory.count).toBe(0);
  expect(adventure.outcome).toBe('playing');
});
