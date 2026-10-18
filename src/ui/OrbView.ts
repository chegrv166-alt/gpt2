import Phaser from 'phaser';
import { label } from './widgets';

/** Screen-space resource sphere; crop changes fill without regenerating textures. */
export class OrbView extends Phaser.GameObjects.Container {
  private readonly liquid: Phaser.GameObjects.Image;
  private readonly valueText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, resource: 'health' | 'mana', x: number, y: number) {
    super(scene, x, y);
    this.setName(`${resource}-orb`);
    this.add(scene.add.circle(0, 0, 59, 0x0c1212));
    this.liquid = scene.add.image(0, 0, `ui-orb-${resource}`).setName('liquid');
    this.add(this.liquid);
    this.add(scene.add.image(0, 0, 'ui-orb-frame'));
    this.valueText = label(scene, this, 0, 3, '', 18, '#f1e2c3').setOrigin(0.5).setStroke('#130e11', 3);
    label(scene, this, 0, 89, resource === 'health' ? 'ЗДОРОВЬЕ' : 'МАНА', 10, '#b6ac85').setOrigin(0.5);
  }

  public updateResource(value: number, maximum: number): void {
    const ratio = Phaser.Math.Clamp(value / Math.max(1, maximum), 0, 1);
    this.liquid.setCrop(0, 128 * (1 - ratio), 128, 128 * ratio).setVisible(ratio > 0);
    this.valueText.setText(`${Math.ceil(value)} / ${Math.ceil(maximum)}`);
  }
}
