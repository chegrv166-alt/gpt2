import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { RunOutcome } from '../systems/AdventureSystem';
import { button, label, panelBackground } from './widgets';

export class EndOverlay extends Phaser.GameObjects.Container {
  private outcome: RunOutcome = 'playing';

  public constructor(scene: Phaser.Scene, private readonly world: GameScene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setName('end-overlay').setVisible(false);
  }

  public refresh(): void {
    const outcome = this.world.adventure.outcome;
    this.setVisible(outcome !== 'playing');
    if (outcome === this.outcome) return;
    this.outcome = outcome;
    this.removeAll(true);
    if (outcome === 'playing') return;
    const dead = outcome === 'dead';
    panelBackground(this.scene, this, 520, 310);
    label(this.scene, this, 260, 30, dead ? 'ПЕПЕЛ ПОМНИТ' : 'КЛЯТВА ИСПОЛНЕНА', 11, '#b4a171').setOrigin(0.5);
    label(this.scene, this, 260, 65, dead ? 'Странник пал' : 'Страж повержен', 31, dead ? '#e0a28e' : '#e8ce91').setOrigin(0.5);
    label(this.scene, this, 260, 113, dead
      ? 'Путь не окончен. Снаряжение и собранные вещи\nостанутся с вами после возвращения.'
      : 'Пламя святилища снова принадлежит живым.\nУ врат вас ждёт легендарная награда.', 14, '#b6c0a5').setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    const defeated = this.world.battle.enemies.filter((enemy) => !enemy.stats.alive).length;
    label(this.scene, this, 260, 179, `Противников повержено: ${defeated} / 6  ·  Вещей в рюкзаке: ${this.world.adventure.inventory.count}`, 12, '#969d80').setOrigin(0.5);
    button(this.scene, this, 35, 214, 220, 41, dead ? 'Возродиться' : 'Забрать награду', 'end-primary', () => dead ? this.world.respawn() : this.world.continueAfterVictory());
    button(this.scene, this, 268, 214, 216, 41, 'Новый поход', 'end-restart', () => this.world.resetPlayer());
    label(this.scene, this, 260, 277, 'Enter — продолжить  ·  R — новый поход', 11, '#8b987d').setOrigin(0.5);
  }
}
