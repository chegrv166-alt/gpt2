import type { CombatEvent } from '../combat/definitions';
import type { InventoryComponent } from '../components/InventoryComponent';
import { DropItem } from '../entities/DropItem';
import { createItem } from '../items/definitions';
import type { ItemInstance, Rarity } from '../items/definitions';
import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';

export type CollectResult = 'picked' | 'full' | 'far' | 'missing' | 'dead';
export interface LootNotice { readonly result: 'picked' | 'full'; readonly item: ItemInstance; }
export const PICKUP_RADIUS = 0.85;

/** Owns unique death rewards and checks physical pickup before inventory mutation. */
export class LootSystem {
  private readonly ground = new Map<number, DropItem>();
  private readonly rewarded = new Set<number>();
  private nextId = 1;

  public constructor(private readonly grid: CollisionGrid, private readonly random: () => number = Math.random) {}

  public get drops(): readonly DropItem[] { return [...this.ground.values()]; }

  public consume(events: readonly CombatEvent[]): void {
    for (const event of events) {
      if (event.type !== 'death' || event.kind === 'hero' || this.rewarded.has(event.targetId)) continue;
      this.rewarded.add(event.targetId);
      const roll = this.random();
      const rarity: Rarity = event.kind === 'boss' ? 'legendary'
        : roll < (event.kind === 'caster' ? 0.35 : 0.7) ? 'common' : roll < 0.98 ? 'rare' : 'legendary';
      this.add(createItem(`loot-${this.nextId}`, event.kind === 'boss' || this.random() < 0.5 ? 'weapon' : 'armor', rarity), event.position);
    }
  }

  public add(item: ItemInstance, position: Vec2): DropItem {
    const drop = new DropItem(this.nextId++, item, position);
    this.ground.set(drop.id, drop);
    return drop;
  }

  public collect(id: number, position: Vec2, inventory: InventoryComponent, alive: boolean): CollectResult {
    const drop = this.ground.get(id);
    if (!drop) return 'missing';
    if (!alive) return 'dead';
    if (Math.hypot(position.x - drop.position.x, position.y - drop.position.y) > PICKUP_RADIUS
      || !this.grid.isSegmentClear(position, drop.position, 0.02)) return 'far';
    if (!inventory.add(drop.item)) return 'full';
    this.ground.delete(id);
    return 'picked';
  }

  public collectNearby(position: Vec2, inventory: InventoryComponent, alive: boolean): LootNotice[] {
    const notices: LootNotice[] = [];
    for (const drop of this.ground.values()) {
      const result = this.collect(drop.id, position, inventory, alive);
      if (result === 'picked' || (result === 'full' && !drop.reportedFull)) notices.push({ result, item: drop.item });
      if (result === 'full') drop.reportedFull = true;
      else if (result === 'far') drop.reportedFull = false;
    }
    return notices;
  }

  public clear(): void { this.ground.clear(); this.rewarded.clear(); }
}
