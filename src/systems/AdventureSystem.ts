import type { CombatEvent } from '../combat/definitions';
import { InventoryComponent } from '../components/InventoryComponent';
import type { StatsComponent } from '../components/StatsComponent';
import { LootSystem } from '../loot/LootSystem';
import type { LootNotice } from '../loot/LootSystem';
import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';

export type RunOutcome = 'playing' | 'dead' | 'victory';

/** Progression, modal state and end-of-encounter rules, independent from Phaser. */
export class AdventureSystem {
  public readonly inventory: InventoryComponent;
  public readonly loot: LootSystem;
  public outcome: RunOutcome = 'playing';
  public inventoryOpen = false;
  private victoryShown = false;

  public constructor(stats: StatsComponent, grid: CollisionGrid, random: () => number = Math.random) {
    this.inventory = new InventoryComponent(stats);
    this.loot = new LootSystem(grid, random);
  }

  public get paused(): boolean { return this.inventoryOpen || this.outcome !== 'playing'; }

  public update(events: readonly CombatEvent[], position: Vec2, alive: boolean): LootNotice[] {
    this.loot.consume(events);
    if (!alive) { this.outcome = 'dead'; this.inventoryOpen = false; }
    else if (!this.victoryShown && events.some((event) => event.type === 'death' && event.kind === 'boss')) {
      this.outcome = 'victory'; this.victoryShown = true; this.inventoryOpen = false;
    }
    return this.paused ? [] : this.loot.collectNearby(position, this.inventory, alive);
  }

  public toggleInventory(): boolean {
    if (this.outcome !== 'playing') return false;
    this.inventoryOpen = !this.inventoryOpen;
    return this.inventoryOpen;
  }

  public continueAfterVictory(): void { if (this.outcome === 'victory') this.outcome = 'playing'; }

  public reset(full: boolean): void {
    if (full) this.inventory.clear();
    this.loot.clear(); this.inventoryOpen = false; this.outcome = 'playing'; this.victoryShown = false;
  }
}
