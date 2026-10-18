import Phaser from 'phaser';
import { describeModifiers, itemIcon, RARITIES } from '../items/definitions';
import type { EquipmentSlot, ItemInstance } from '../items/definitions';
import type { GameScene } from '../scenes/GameScene';
import { button, label, panelBackground } from './widgets';

type Selection = { readonly kind: 'bag'; readonly index: number } | { readonly kind: 'equipment'; readonly slot: EquipmentSlot };

/** Inventory presentation issues transactions through GameScene; it owns no items. */
export class InventoryPanel extends Phaser.GameObjects.Container {
  private selection: Selection | null = null;
  private revision = -1;
  private compact = false;

  public constructor(scene: Phaser.Scene, private readonly world: GameScene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setName('inventory-panel').setVisible(false);
  }

  public fit(width: number, height: number): void {
    const compact = width < 600;
    const changed = compact !== this.compact;
    this.compact = compact;
    const logicalWidth = compact ? 360 : 600;
    const logicalHeight = compact ? 448 : 548;
    const scale = Math.min(1, (width - 24) / logicalWidth, (height - 24) / logicalHeight);
    this.setScale(scale).setPosition((width - logicalWidth * scale) / 2, (height - logicalHeight * scale) / 2);
    if (changed && this.visible) this.refresh(true);
  }

  public refresh(force = false): void {
    const inventory = this.world.adventure.inventory;
    if (!force && this.revision === inventory.version) return;
    this.revision = inventory.version;
    this.removeAll(true);
    const compact = this.compact;
    panelBackground(this.scene, this, compact ? 360 : 600, compact ? 448 : 548);
    label(this.scene, this, compact ? 18 : 27, 22, 'СНАРЯЖЕНИЕ СТРАННИКА', compact ? 15 : 20, '#e0d0a9');
    button(this.scene, this, compact ? 315 : 548, 15, 30, 29, '×', 'inventory-close', () => this.world.toggleInventory());
    label(this.scene, this, compact ? 18 : 28, compact ? 48 : 57, 'Бой приостановлен · I / Esc — вернуться', 11, '#8d9c7f');
    this.itemSlot(compact ? 18 : 32, compact ? 78 : 92, inventory.equipment.weapon, 'Оружие', 'equipment-weapon', () => this.select({ kind: 'equipment', slot: 'weapon' }));
    this.itemSlot(compact ? 95 : 148, compact ? 78 : 92, inventory.equipment.armor, 'Доспех', 'equipment-armor', () => this.select({ kind: 'equipment', slot: 'armor' }));
    const stats = this.world.player.stats;
    const values = stats.values;
    const lines = [`HP  ${Math.ceil(stats.hp)} / ${values.maxHp}`, `Мана  ${Math.floor(stats.mana)} / ${values.maxMana}`,
      `Урон  ${values.attackDamage}     Броня  ${values.armor}`, `Скорость  ${values.moveSpeed.toFixed(2)}`, `Крит  ${Math.round(values.critChance * 100)}% × ${values.critMultiplier.toFixed(1)}`];
    label(this.scene, this, compact ? 180 : 310, compact ? 78 : 92, lines.join('\n'), compact ? 12 : 14, '#c3c8ac').setLineSpacing(compact ? 5 : 7);
    label(this.scene, this, compact ? 18 : 30, compact ? 178 : 229, `РЮКЗАК · ${inventory.count} / 10`, 13, '#bcac7f');
    for (let index = 0; index < 10; index += 1) {
      this.itemSlot((compact ? 18 : 32) + (index % 5) * (compact ? 66 : 113), (compact ? 205 : 259) + Math.floor(index / 5) * (compact ? 58 : 72),
        inventory.slots[index] ?? null, '', `bag-slot-${index}`, () => this.select({ kind: 'bag', index }));
    }
    const selected = this.selectedItem();
    if (selected) {
      const rarity = RARITIES[selected.rarity];
      label(this.scene, this, compact ? 18 : 30, compact ? 331 : 418, selected.name, compact ? 16 : 18, rarity.css);
      label(this.scene, this, compact ? 18 : 30, compact ? 356 : 446, `${rarity.name} · ${selected.slot === 'weapon' ? 'Оружие' : 'Доспех'}`, 11, rarity.css);
      label(this.scene, this, compact ? 18 : 30, compact ? 382 : 472, describeModifiers(selected).join('\n'), compact ? 11 : 12, '#c5c9b2').setLineSpacing(3);
      const selection = this.selection;
      button(this.scene, this, compact ? 218 : 387, compact ? 373 : 447, compact ? 124 : 180, compact ? 29 : 34, selection?.kind === 'bag' ? 'Надеть' : 'Снять', 'inventory-equip', () => {
        if (selection?.kind === 'bag') this.world.equipItem(selection.index);
        else if (selection?.kind === 'equipment') this.world.unequipItem(selection.slot);
        this.refresh(true);
      });
      if (selection?.kind === 'bag') button(this.scene, this, compact ? 218 : 387, compact ? 409 : 489, compact ? 124 : 180, compact ? 27 : 30, 'На землю', 'inventory-drop', () => {
        this.world.dropItem(selection.index); this.refresh(true);
      });
    } else label(this.scene, this, compact ? 18 : 30, compact ? 339 : 425, 'Выберите предмет, чтобы увидеть свойства.\nНаденьте оружие или доспех для усиления героя.', compact ? 12 : 13, '#8f9d80')
      .setWordWrapWidth(compact ? 321 : 535).setLineSpacing(10);
  }

  private select(selection: Selection): void { this.selection = selection; this.refresh(true); }

  private selectedItem(): ItemInstance | null {
    if (!this.selection) return null;
    const inventory = this.world.adventure.inventory;
    return this.selection.kind === 'bag' ? inventory.slots[this.selection.index] ?? null : inventory.equipment[this.selection.slot];
  }

  private itemSlot(x: number, y: number, item: ItemInstance | null, caption: string, name: string, select: () => void): void {
    const width = this.compact ? 57 : 85;
    const height = this.compact ? 49 : 59;
    const slot = button(this.scene, this, x, y, width, height, '', name, select);
    const color = item ? RARITIES[item.rarity].color : 0x49533c;
    const background = slot.list[0] as Phaser.GameObjects.Rectangle;
    background.setStrokeStyle(item ? 2 : 1, color);
    if (item) slot.add(this.scene.add.image(width / 2, height / 2, itemIcon(item)).setDisplaySize(43, 43));
    else label(this.scene, slot, width / 2, height / 2, '·', 24, '#56634b').setOrigin(0.5);
    if (caption) label(this.scene, this, x + width / 2, y + height + 9, caption, 11, '#aba989').setOrigin(0.5);
  }
}
