import Phaser from 'phaser';
import { ACTORS, actorAnimationKey, actorTextureKey } from '../assets/catalog';
import type { PreviewSelection } from '../ui/ForgeUI';

/** A texture inspection scene; movement, collisions and combat belong to the next steps. */
export class AssetGalleryScene extends Phaser.Scene {
  private actor!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Image;

  public constructor() {
    super('AssetGalleryScene');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#141b18');
    const backdrop = this.add.graphics();
    for (let radius = 500; radius > 30; radius -= 20) {
      backdrop.fillStyle(0x525841, 0.015).fillEllipse(480, 315, radius * 2, radius);
    }
    // This fixed display mosaic showcases the generated tiles, without gameplay state.
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const x = 480 + (column - row) * 48;
        const y = 155 + (column + row) * 24;
        const stone = column >= 2 && column <= 4 && row >= 2 && row <= 4;
        const variant = (column * 7 + row * 3) % 4;
        this.add.image(x, y, `tile-${stone ? 'stone' : 'ground'}-${variant}`)
          .setScale(0.75).setOrigin(0.5, 34 / 80).setDepth(y);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      this.add.image(480 + (i - 1) * 48, 131 + (i + 1) * 24, 'wall-ne')
        .setScale(0.75).setOrigin(0.5, 110 / 144).setDepth(150 + i * 24);
      this.add.image(480 - (i - 1) * 48, 131 + (i + 1) * 24, 'wall-nw')
        .setScale(0.75).setOrigin(0.5, 110 / 144).setDepth(150 + i * 24);
    }
    const props: ReadonlyArray<readonly [number, number, string]> = [
      [270, 323, 'prop-rock'], [682, 324, 'prop-rock'],
      [388, 240, 'prop-pillar'], [574, 240, 'prop-pillar'],
      [345, 326, 'prop-brazier'], [615, 326, 'prop-brazier'],
    ];
    for (const [x, y, key] of props) {
      const prop = this.add.image(x, y, key).setOrigin(0.5, 114 / 144).setScale(0.85).setDepth(y);
      if (key === 'prop-brazier') {
        this.tweens.add({ targets: prop, alpha: 0.8, duration: 350 + x % 120, yoyo: true, repeat: -1 });
      }
    }
    this.glow = this.add.image(480, 328, 'fx-target').setScale(1.1).setAlpha(0.65).setDepth(327);
    this.actor = this.add.sprite(480, 328, actorTextureKey('hero', 'idle', 'se', 0)).setDepth(329);
    const dust = this.add.particles(0, 0, 'fx-spark', {
      x: { min: 240, max: 720 }, y: { min: 170, max: 450 },
      lifespan: { min: 2000, max: 4000 }, frequency: 250,
      speedY: { min: -10, max: -20 }, speedX: { min: -3, max: 3 },
      scale: { start: 0.09, end: 0 }, alpha: { start: 0.3, end: 0 },
      quantity: 1, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(1000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => dust.destroy());
    this.setSelection({ actor: 'hero', state: 'idle', direction: 'se', zoom: 160, paused: false });
    this.game.events.emit('gallery-ready', this.registry.get('asset-report'));
  }

  public setSelection(selection: Readonly<PreviewSelection>): void {
    if (!this.actor?.active) return;
    const definition = ACTORS[selection.actor];
    this.actor.setOrigin(0.5, definition.footY / definition.height).setScale(selection.zoom / 100);
    this.glow.setTint(definition.color);
    const key = actorAnimationKey(selection.actor, selection.state, selection.direction);
    // Combat clips remain one-shot in the cache; the gallery explicitly loops its preview.
    if (this.actor.anims.currentAnim?.key !== key) {
      this.actor.play({ key, repeat: -1 });
    }
    if (selection.paused) this.actor.anims.pause();
    else this.actor.anims.resume();
  }
}
