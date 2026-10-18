import type { EquipmentSlot, ItemInstance } from '../items/definitions';
import type { StatsComponent } from './StatsComponent';

export const INVENTORY_SIZE = 10;

/** Bag/equipment transactions are atomic; only equipment contributes stat modifiers. */
export class InventoryComponent {
  private readonly bag: (ItemInstance | null)[] = Array.from({ length: INVENTORY_SIZE }, () => null);
  private worn: Readonly<Record<EquipmentSlot, ItemInstance | null>> = Object.freeze({ weapon: null, armor: null });
  public version = 0;

  public constructor(private readonly stats: StatsComponent) {}

  public get slots(): readonly (ItemInstance | null)[] { return this.bag; }
  public get equipment(): Readonly<Record<EquipmentSlot, ItemInstance | null>> { return this.worn; }
  public get count(): number { return this.bag.filter(Boolean).length; }

  public add(item: ItemInstance): boolean {
    if (this.bag.some((entry) => entry?.id === item.id) || Object.values(this.worn).some((entry) => entry?.id === item.id)) return false;
    const index = this.bag.indexOf(null);
    if (index < 0) return false;
    this.bag[index] = item;
    this.version += 1;
    return true;
  }

  public equip(index: number): boolean {
    const item = this.bag[index];
    if (!Number.isInteger(index) || !item) return false;
    this.bag[index] = this.worn[item.slot];
    this.worn = Object.freeze({ ...this.worn, [item.slot]: item });
    this.recalculate();
    return true;
  }

  public unequip(slot: EquipmentSlot): boolean {
    const item = this.worn[slot];
    const index = this.bag.indexOf(null);
    if (!item || index < 0) return false;
    this.bag[index] = item;
    this.worn = Object.freeze({ ...this.worn, [slot]: null });
    this.recalculate();
    return true;
  }

  public remove(index: number): ItemInstance | null {
    if (!Number.isInteger(index)) return null;
    const item = this.bag[index];
    if (!item) return null;
    this.bag[index] = null;
    this.version += 1;
    return item;
  }

  public clear(): void {
    this.bag.fill(null);
    this.worn = Object.freeze({ weapon: null, armor: null });
    this.recalculate();
  }

  private recalculate(): void {
    this.stats.setModifiers(Object.values(this.worn).flatMap((item) => item ? [item.modifiers] : []));
    this.version += 1;
  }
}
