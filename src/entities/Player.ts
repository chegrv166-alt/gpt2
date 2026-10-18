import Phaser from 'phaser';
import { ACTORS, actorAnimationKey, actorTextureKey } from '../assets/catalog';
import { StatsComponent } from '../components/StatsComponent';
import { HERO_STATS } from '../combat/definitions';
import type { HeroVisualState } from '../combat/HeroCombat';
import type { ArenaRenderer } from '../world/ArenaRenderer';
import { PlayerMotor } from './PlayerMotor';

/** Presentation and motor composition; collision and routing stay in ground space. */
export class Player {
  public readonly motor: PlayerMotor;
  public readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, private readonly arena: ArenaRenderer,
    public readonly stats: StatsComponent = new StatsComponent(HERO_STATS)) {
    this.motor = new PlayerMotor(arena.layout.grid, arena.layout.spawn);
    const point = arena.toScreen(this.motor.position);
    this.shadow = scene.add.image(point.x, point.y, 'fx-shadow').setScale(0.65).setAlpha(0.55);
    this.sprite = scene.add.sprite(point.x, point.y, actorTextureKey('hero', 'idle', 'se', 0))
      .setOrigin(0.5, ACTORS.hero.footY / ACTORS.hero.height).setName('player');
    this.render('idle');
  }

  public reset(): void {
    this.motor.reset(this.arena.layout.spawn);
    this.stats.restore();
    this.render('idle');
  }

  public render(state: HeroVisualState, hitFlash = 0): void {
    const point = this.arena.toScreen(this.motor.position);
    this.sprite.setPosition(point.x, point.y).setDepth(point.y + 0.5);
    this.shadow.setPosition(point.x, point.y + 1).setDepth(point.y - 0.5);
    this.sprite.setTint(state === 'dead' ? 0x777b69 : hitFlash > 0 ? 0xf3ac91 : 0xffffff)
      .setAngle(state === 'dead' ? -65 : 0).setAlpha(state === 'dead' ? 0.55 : 1);
    const animation = actorAnimationKey('hero', state === 'dead' ? 'hurt' : state, this.motor.direction);
    if (this.sprite.anims.currentAnim?.key !== animation) this.sprite.play(animation);
  }
}
