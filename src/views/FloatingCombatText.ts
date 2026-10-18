import Phaser from 'phaser';
import type { CombatEvent } from '../combat/definitions';
import type { ArenaRenderer } from '../world/ArenaRenderer';

export class FloatingCombatText {
  private readonly active = new Set<Phaser.GameObjects.Text>();

  public constructor(private readonly scene: Phaser.Scene, private readonly arena: ArenaRenderer) {}

  public show(event: Extract<CombatEvent, { type: 'damage' }>): void {
    const position = this.arena.toScreen(event.position);
    const text = this.scene.add.text(position.x + Phaser.Math.Between(-10, 10), position.y - 65,
      `${Math.ceil(event.amount)}${event.critical ? '!' : ''}`, {
        fontFamily: 'Georgia, serif', fontSize: event.critical ? '25px' : '19px',
        color: event.team === 'hero' ? '#ed947c' : event.critical ? '#f6d68c' : '#e7dfc7',
        stroke: '#0c130e', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(20_000);
    this.active.add(text);
    this.scene.tweens.add({ targets: text, y: text.y - 48, alpha: 0, duration: 850,
      ease: 'Cubic.Out', onComplete: () => { this.active.delete(text); text.destroy(); } });
  }

  public clear(): void {
    for (const text of this.active) { this.scene.tweens.killTweensOf(text); text.destroy(); }
    this.active.clear();
  }
}
