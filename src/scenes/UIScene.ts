import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { OrbView } from '../ui/OrbView';
import { InventoryPanel } from '../ui/InventoryPanel';
import { EndOverlay } from '../ui/EndOverlay';
import { button, label } from '../ui/widgets';

/** Independent camera and modal input keep interface coordinates out of world math. */
export class UIScene extends Phaser.Scene {
  private world!: GameScene;
  private hud!: Phaser.GameObjects.Container;
  private health!: OrbView;
  private mana!: OrbView;
  private skill!: Phaser.GameObjects.Container;
  private cooldown!: Phaser.GameObjects.Text;
  private bagCount!: Phaser.GameObjects.Text;
  private shade!: Phaser.GameObjects.Rectangle;
  private inventory!: InventoryPanel;
  private ending!: EndOverlay;

  public constructor() { super('UIScene'); }

  public create(): void {
    this.world = this.scene.get('GameScene') as GameScene;
    this.hud = this.add.container().setName('hud');
    this.hud.add(this.add.rectangle(92, 36, 336, 72, 0x10180f, 0.94).setOrigin(0).setStrokeStyle(1, 0x706241));
    this.health = new OrbView(this, 'health', 80, 61).setScale(0.72);
    this.mana = new OrbView(this, 'mana', 440, 61).setScale(0.72);
    this.hud.add([this.health, this.mana]);
    this.hotbar(168, 'icon-sword', 'ЛКМ', 'hud-melee', () => this.world.attackNearest());
    this.skill = this.hotbar(234, 'projectile-ember', 'Q / ПКМ', 'hud-skill', () => this.world.castSkill());
    const bag = this.hotbar(300, 'icon-rune', '', 'hud-inventory', () => this.world.toggleInventory());
    this.bagCount = label(this, bag, 27, 48, 'I · 0/10', 9, '#b7b28e').setOrigin(0.5);
    this.cooldown = label(this, this.hud, 261, 27, '18 маны', 10, '#baa06f').setOrigin(0.5);
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x050a07, 0.78).setOrigin(0).setInteractive();
    this.shade.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.inventory = new InventoryPanel(this, this.world);
    this.ending = new EndOverlay(this, this.world);
    this.resize();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    window.addEventListener('keydown', this.keyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.update();
  }

  public override update(): void {
    const stats = this.world.player.stats;
    const adventure = this.world.adventure;
    this.health.updateResource(stats.hp, stats.values.maxHp);
    this.mana.updateResource(stats.mana, stats.values.maxMana);
    this.skill.setAlpha(this.world.battle.status.skillAvailable ? 1 : 0.45);
    this.cooldown.setText(this.world.battle.hero.castCooldown > 0 ? `${this.world.battle.hero.castCooldown.toFixed(1)} с` : '18 маны');
    this.bagCount.setText(`I · ${adventure.inventory.count}/10`);
    this.shade.setVisible(adventure.paused);
    const opening = adventure.inventoryOpen && !this.inventory.visible;
    this.inventory.setVisible(adventure.inventoryOpen);
    if (adventure.inventoryOpen) this.inventory.refresh(opening);
    this.ending.refresh();
  }

  private hotbar(x: number, texture: string, key: string, name: string, action: () => void): Phaser.GameObjects.Container {
    const root = button(this, this.hud, x, 44, 54, 58, '', name, action);
    root.add(this.add.image(27, 22, texture).setDisplaySize(34, 34));
    label(this, root, 27, 48, key, 9, '#b7b28e').setOrigin(0.5);
    return root;
  }

  private resize(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const hudScale = Math.min(1, (width - 16) / 520);
    this.hud.setScale(hudScale).setPosition((width - 520 * hudScale) / 2, height - 140 * hudScale);
    this.shade.setSize(width, height).setDisplaySize(width, height);
    this.inventory.fit(width, height);
    const endScale = Math.min(1, (width - 24) / 520, (height - 24) / 310);
    this.ending.setScale(endScale).setPosition((width - 520 * endScale) / 2, (height - 310 * endScale) / 2);
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Enter' || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (this.world.adventure.outcome === 'dead') { event.preventDefault(); this.world.respawn(); }
    else if (this.world.adventure.outcome === 'victory') { event.preventDefault(); this.world.continueAfterVictory(); }
  };

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
    window.removeEventListener('keydown', this.keyDown);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }
}
