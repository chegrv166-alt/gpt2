import Phaser from 'phaser';
import type { GameScene } from './GameScene';

/** An independent screen-space camera keeps the map stable as the world zooms. */
export class MapScene extends Phaser.Scene {
  private world!: GameScene;
  private panel!: Phaser.GameObjects.Container;
  private playerDot!: Phaser.GameObjects.Graphics;
  private shown = true;

  public constructor() {
    super('MapScene');
  }

  public create(): void {
    this.world = this.scene.get('GameScene') as GameScene;
    this.panel = this.add.container();
    const background = this.add.graphics();
    background.fillStyle(0x111914, 0.86).fillRect(0, 0, 220, 154);
    background.lineStyle(1, 0x5e6346, 0.65).strokeRect(0, 0, 220, 154);
    background.lineStyle(1, 0x3a4532, 0.8).lineBetween(14, 31, 206, 31);
    this.panel.add(background);
    this.panel.add(this.add.text(14, 12, 'ПЕПЕЛЬНЫЕ ПРЕДЕЛЫ', {
      fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#b4b599', letterSpacing: 1.2,
    }));
    this.panel.add(this.add.text(14, 136, 'СЕВЕРНЫЕ ВРАТА', {
      fontFamily: 'Arial, sans-serif', fontSize: '7px', color: '#9d926a', letterSpacing: 1,
    }));
    const map = this.add.graphics();
    const grid = this.world.layout.grid;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const point = this.mapPoint(x, y);
        map.fillStyle(grid.isBlocked(x, y) ? 0x7d8166 : 0x303e2e, 0.95);
        map.fillPoints([
          { x: point.x, y: point.y - 1.7 }, { x: point.x + 3.4, y: point.y },
          { x: point.x, y: point.y + 1.7 }, { x: point.x - 3.4, y: point.y },
        ], true);
      }
    }
    const gate = this.mapPoint(this.world.layout.gate.x, this.world.layout.gate.y);
    map.lineStyle(1, 0xe0b96a).strokeCircle(gate.x, gate.y, 4);
    this.panel.add(map);
    this.playerDot = this.add.graphics();
    this.panel.add(this.playerDot);
    const hitArea = this.add.zone(110, 77, 220, 154).setInteractive();
    hitArea.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.panel.add(hitArea);
    this.shown = true;
    this.resize();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    const cleanup = (): void => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.resize, this);
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  public override update(): void {
    if (!this.playerDot || !this.world.player) return;
    const position = this.world.player.motor.position;
    const point = this.mapPoint(position.x, position.y);
    this.playerDot.clear();
    for (const drop of this.world.adventure.loot.drops) {
      const mark = this.mapPoint(drop.position.x, drop.position.y);
      this.playerDot.fillStyle(drop.item.rarity === 'legendary' ? 0xf2bc61 : drop.item.rarity === 'rare' ? 0x73aef5 : 0xc7c7b8)
        .fillRect(mark.x - 1, mark.y - 1, 2, 2);
    }
    for (const enemy of this.world.battle.enemies) {
      if (!enemy.stats.alive) continue;
      const mark = this.mapPoint(enemy.motor.position.x, enemy.motor.position.y);
      this.playerDot.fillStyle(enemy.kind === 'boss' ? 0xe4a15f : enemy.kind === 'caster' ? 0xa38ec6 : 0xb17460)
        .fillCircle(mark.x, mark.y, enemy.kind === 'boss' ? 3.2 : 1.8);
    }
    this.playerDot.fillStyle(0xd9c99e, 0.18).fillCircle(point.x, point.y, 7)
      .fillStyle(0xf2dfaf).fillCircle(point.x, point.y, 2.7);
  }

  public toggle(): boolean {
    this.shown = !this.shown;
    this.panel.setVisible(this.shown);
    return this.shown;
  }

  private mapPoint(x: number, y: number): { x: number; y: number } {
    return { x: 110 + (x - y) * 3.4, y: 47 + (x + y) * 1.7 };
  }

  private resize(): void {
    const scale = this.scale.width < 600 ? 0.7 : 1;
    this.panel.setScale(scale).setPosition(this.scale.width - 220 * scale - 18, 18);
  }
}
