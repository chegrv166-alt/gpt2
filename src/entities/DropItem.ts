import type { ItemInstance } from '../items/definitions';
import type { Vec2 } from '../math/isometric';

/** Ground-plane loot model; Phaser presentation is owned by LootView. */
export class DropItem {
  public reportedFull = false;
  public readonly position: Vec2;

  public constructor(public readonly id: number, public readonly item: ItemInstance, position: Vec2) {
    this.position = Object.freeze({ ...position });
  }
}
