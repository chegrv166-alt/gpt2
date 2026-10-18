import { DIRECTION_VECTORS } from '../assets/catalog';
import type { ActorState } from '../assets/catalog';
import type { StatsComponent } from '../components/StatsComponent';
import type { PlayerMotor } from '../entities/PlayerMotor';
import { directionFromScreen, isoToScreen, screenVectorToIso } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import { MELEE, SKILL } from './definitions';
import { unitVector } from './geometry';

export type CastResult = 'ok' | 'dead' | 'busy' | 'cooldown' | 'mana';
export type HeroVisualState = ActorState | 'dead';

export class HeroCombat {
  public readonly id = 0;
  public readonly team = 'hero';
  public castCooldown = 0;
  public hitFlash = 0;
  public invulnerability = 0;
  private meleeCooldown = 0;
  private attackAge = 0;
  private attackRemaining = 0;
  private attackKind: 'melee' | 'skill' | null = null;
  private swingFired = false;
  private facing: Vec2 = { x: 1, y: 0 };
  private quietTime = 0;

  public constructor(public readonly motor: PlayerMotor, public readonly stats: StatsComponent) {}

  public get canMove(): boolean { return this.stats.alive && this.attackRemaining <= 0 && this.hitFlash <= 0; }
  public get visualState(): HeroVisualState {
    if (!this.stats.alive) return 'dead';
    if (this.attackRemaining > 0) return 'attack';
    if (this.hitFlash > 0) return 'hurt';
    return this.motor.state;
  }

  public get facingVector(): Vec2 {
    const direction = DIRECTION_VECTORS[this.motor.direction];
    return screenVectorToIso({ x: direction[0], y: direction[1] });
  }

  public requestMelee(aim: Vec2): boolean {
    if (!this.stats.alive || this.attackRemaining > 0 || this.hitFlash > 0 || this.meleeCooldown > 0) return false;
    this.face(aim);
    this.motor.stop();
    this.attackKind = 'melee';
    this.attackAge = 0;
    this.attackRemaining = MELEE.duration;
    this.meleeCooldown = MELEE.cooldown;
    this.swingFired = false;
    return true;
  }

  public requestSkill(aim: Vec2): CastResult {
    if (!this.stats.alive) return 'dead';
    if (this.attackRemaining > 0 || this.hitFlash > 0) return 'busy';
    if (this.castCooldown > 0) return 'cooldown';
    if (!this.stats.spendMana(SKILL.cost)) return 'mana';
    this.face(aim);
    this.motor.stop();
    this.attackKind = 'skill';
    this.attackRemaining = 0.28;
    this.attackAge = 0;
    this.castCooldown = SKILL.cooldown;
    return 'ok';
  }

  public update(seconds: number, onSwing: (direction: Vec2) => void): void {
    this.meleeCooldown = Math.max(0, this.meleeCooldown - seconds);
    this.castCooldown = Math.max(0, this.castCooldown - seconds);
    this.hitFlash = Math.max(0, this.hitFlash - seconds);
    this.invulnerability = Math.max(0, this.invulnerability - seconds);
    if (!this.stats.alive) { this.cancel(); return; }
    this.stats.regenerateMana(seconds, 6);
    this.quietTime += seconds;
    if (this.quietTime > 6) this.stats.heal(seconds * 3);
    if (this.attackRemaining > 0) {
      this.attackAge += seconds;
      if (this.attackKind === 'melee' && !this.swingFired && this.attackAge >= MELEE.windup) {
        this.swingFired = true;
        onSwing(this.facing);
      }
      this.attackRemaining = Math.max(0, this.attackRemaining - seconds);
    }
  }

  public onHit(): void {
    this.hitFlash = 0.14;
    this.invulnerability = 0.18;
    this.quietTime = 0;
    if (!this.stats.alive) { this.cancel(); this.motor.stop(); }
  }

  public cancel(): void { this.attackKind = null; this.attackRemaining = 0; }
  public reset(): void {
    this.cancel();
    this.meleeCooldown = 0; this.castCooldown = 0; this.hitFlash = 0;
    this.invulnerability = 0; this.quietTime = 0;
  }

  private face(aim: Vec2): void {
    this.facing = unitVector(this.motor.position, aim, this.facingVector);
    this.motor.direction = directionFromScreen(isoToScreen(this.facing), this.motor.direction);
  }
}
