import type { StatValues } from '../components/StatsComponent';

export type Rarity = 'common' | 'rare' | 'legendary';
export type EquipmentSlot = 'weapon' | 'armor';

export interface ItemInstance {
  readonly id: string;
  readonly name: string;
  readonly slot: EquipmentSlot;
  readonly rarity: Rarity;
  readonly modifiers: Readonly<Partial<StatValues>>;
}

export const RARITIES: Readonly<Record<Rarity, { readonly name: string; readonly color: number; readonly css: string }>> = {
  common: { name: 'Обычный', color: 0xc7c7b8, css: '#c7c7b8' },
  rare: { name: 'Редкий', color: 0x73aef5, css: '#73aef5' },
  legendary: { name: 'Легендарный', color: 0xf2bc61, css: '#f2bc61' },
};

const NAMES: Readonly<Record<EquipmentSlot, Readonly<Record<Rarity, string>>>> = {
  weapon: { common: 'Клинок стражника', rare: 'Серебро рассвета', legendary: 'Клятва пепла' },
  armor: { common: 'Походные латы', rare: 'Панцирь изгнанника', legendary: 'Сердце святилища' },
};

export function createItem(id: string, slot: EquipmentSlot, rarity: Rarity): ItemInstance {
  const rank = rarity === 'legendary' ? 2 : rarity === 'rare' ? 1 : 0;
  const modifiers: Partial<StatValues> = slot === 'weapon'
    ? { attackDamage: [6, 13, 24][rank] ?? 6, ...(rank === 2 ? { critChance: 0.08, maxMana: 12 } : {}) }
    : { armor: [5, 12, 22][rank] ?? 5, maxHp: [8, 16, 32][rank] ?? 8, moveSpeed: [0, 0.15, 0.3][rank] ?? 0 };
  return Object.freeze({ id, name: NAMES[slot][rarity], slot, rarity, modifiers: Object.freeze(modifiers) });
}

export function itemIcon(item: ItemInstance): string { return item.slot === 'weapon' ? 'icon-sword' : 'icon-armor'; }

export function describeModifiers(item: ItemInstance): string[] {
  const labels: Readonly<Record<keyof StatValues, string>> = {
    maxHp: 'HP', maxMana: 'маны', attackDamage: 'урона', armor: 'брони', moveSpeed: 'скорости',
    critChance: 'к шансу крита', critMultiplier: 'к множителю крита',
  };
  return (Object.entries(item.modifiers) as [keyof StatValues, number][]).filter(([, value]) => value !== 0)
    .map(([key, value]) => key === 'critChance' ? `+${Math.round(value * 100)}% ${labels[key]}` : `+${value} ${labels[key]}`);
}
