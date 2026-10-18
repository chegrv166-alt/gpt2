import Phaser from 'phaser';
import type { DropItem } from '../entities/DropItem';
import { itemIcon, RARITIES } from '../items/definitions';
import type { LootSystem } from '../loot/LootSystem';
import type { Vec2 } from '../math/isometric';
import type { ArenaRenderer } from '../world/ArenaRenderer';

interface DropView {
  readonly model: DropItem;
  readonly beam: Phaser.GameObjects.Image;
  readonly icon: Phaser.GameObjects.Image;
  readonly name: Phaser.GameObjects.Text;
}

/** Loot stays in ground coordinates; only this view projects and depth-sorts it. */
export class LootView {
  private readonly views = new Map<number, DropView>();
  private elapsed = 0;

  public constructor(private readonly scene: Phaser.Scene, private readonly arena: ArenaRenderer, private readonly loot: LootSystem) {}

  public render(seconds: number): void {
    this.elapsed += seconds;
    const active = new Set<number>();
    for (const drop of this.loot.drops) {
      active.add(drop.id);
      let view = this.views.get(drop.id);
      if (!view) {
        const point = this.arena.toScreen(drop.position);
        const rarity = RARITIES[drop.item.rarity];
        view = {
          model: drop,
          beam: this.scene.add.image(point.x, point.y, `fx-loot-${drop.item.rarity}`)
            .setOrigin(0.5, 144 / 160).setDepth(point.y - 1).setScale(drop.item.rarity === 'legendary' ? 1.1 : 0.8),
          icon: this.scene.add.image(point.x, point.y - 12, itemIcon(drop.item)).setScale(0.65).setDepth(point.y + 8),
          name: this.scene.add.text(point.x, point.y - 50, drop.item.name, {
            fontFamily: 'Georgia, serif', fontSize: '11px', color: rarity.css,
            backgroundColor: '#0b120de8', padding: { x: 7, y: 4 }, stroke: '#0b120d', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(point.y + 12),
        };
        this.views.set(drop.id, view);
      }
      view.beam.setAlpha(0.6 + Math.sin(this.elapsed * 2.8 + drop.id) * 0.18);
      view.icon.setY(this.arena.toScreen(drop.position).y - 12 + Math.sin(this.elapsed * 2.5 + drop.id) * 2);
    }
    for (const [id, view] of this.views) if (!active.has(id)) {
      view.beam.destroy(); view.icon.destroy(); view.name.destroy(); this.views.delete(id);
    }
  }

  public pick(point: Vec2): DropItem | undefined {
    return [...this.views.values()].sort((a, b) => b.icon.depth - a.icon.depth)
      .find((view) => view.icon.getBounds().contains(point.x, point.y) || view.name.getBounds().contains(point.x, point.y))?.model;
  }
}
