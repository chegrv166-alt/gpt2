import type { CombatEvent } from '../combat/definitions';
import { InventoryComponent } from '../components/InventoryComponent';
import type { StatsComponent } from '../components/StatsComponent';
import { LootSystem } from '../loot/LootSystem';
import type { LootNotice } from '../loot/LootSystem';
import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';
import { nextRoom } from '../world/rooms';
import type { RoomNumber } from '../world/rooms';

export type RunOutcome = 'playing' | 'dead' | 'victory';

/** Progression, modal state and end-of-encounter rules, independent from Phaser. */
export class AdventureSystem {
  public readonly inventory: InventoryComponent;
  public readonly loot: LootSystem;
  public outcome: RunOutcome = 'playing';
  public inventoryOpen = false;
  public room: RoomNumber = 1;
  private roomCleared = false;
  private victoryShown = false;

  public constructor(stats: StatsComponent, grid: CollisionGrid, random: () => number = Math.random) {
    this.inventory = new InventoryComponent(stats);
    this.loot = new LootSystem(grid, random);
  }

  public get paused(): boolean { return this.inventoryOpen || this.outcome !== 'playing'; }
  public get exitUnlocked(): boolean { return nextRoom(this.room) !== null && this.roomCleared; }
  public get cleared(): boolean { return this.roomCleared; }

  public update(events: readonly CombatEvent[], position: Vec2, alive: boolean, remainingEnemies = 0): LootNotice[] {
    this.loot.consume(events);
    if (!alive) { this.outcome = 'dead'; this.inventoryOpen = false; }
    else if (this.room !== 1 && !this.victoryShown && events.some((event) => event.type === 'death' && event.kind === 'boss')) {
      this.outcome = 'victory'; this.victoryShown = true; this.inventoryOpen = false;
    }
    this.roomCleared = alive && (this.room === 1 || this.victoryShown) && remainingEnemies === 0;
    return this.paused ? [] : this.loot.collectNearby(position, this.inventory, alive);
  }

  public toggleInventory(): boolean {
    if (this.outcome !== 'playing') return false;
    this.inventoryOpen = !this.inventoryOpen;
    return this.inventoryOpen;
  }

  public continueAfterVictory(): void { if (this.outcome === 'victory') this.outcome = 'playing'; }

  public enterNextRoom(grid: CollisionGrid): boolean {
    if (!this.exitUnlocked || this.paused) return false;
    const next = nextRoom(this.room);
    if (next === null) return false;
    this.room = next;
    this.loot.enterRoom(grid);
    this.roomCleared = false; this.victoryShown = false;
    return true;
  }

  public reset(full: boolean): void {
    if (full) { this.inventory.clear(); this.room = 1; }
    this.roomCleared = false;
    this.loot.clear(); this.inventoryOpen = false; this.outcome = 'playing'; this.victoryShown = false;
  }
}
