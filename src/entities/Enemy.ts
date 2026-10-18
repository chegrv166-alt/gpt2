import { StatsComponent } from '../components/StatsComponent';
import { ENEMY_DEFINITIONS } from '../combat/definitions';
import type { EnemyKind, EnemySpawn, EnemyState } from '../combat/definitions';
import { unitVector } from '../combat/geometry';
import type { HeroCombat } from '../combat/HeroCombat';
import { directionFromScreen, isoToScreen } from '../math/isometric';
import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';
import { PlayerMotor } from './PlayerMotor';

export interface Telegraph {
  readonly center: Vec2;
  readonly radius: number;
  readonly duration: number;
  remaining: number;
}

export interface EnemyActions {
  readonly melee: (source: Enemy, aim: Vec2) => void;
  readonly shoot: (source: Enemy, aim: Vec2) => void;
  readonly blast: (source: Enemy, center: Vec2, radius: number) => void;
}

/** Pure enemy FSM; views and damage resolution live in separate systems. */
export class Enemy {
  public readonly id: number;
  public readonly kind: EnemyKind;
  public readonly team = 'enemy';
  public readonly stats: StatsComponent;
  public readonly motor: PlayerMotor;
  public state: EnemyState = 'IDLE';
  public telegraph: Telegraph | null = null;
  public hitFlash = 0;
  public deadSeconds = 0;
  private cooldown = 0;
  private repath = 0;
  private retreating = false;
  private hurtRemaining = 0;
  private specialCooldown = 0;
  private attackAge = 0;
  private fired = false;
  private special = false;
  private aim: Vec2 = { x: 0, y: 0 };

  public constructor(spawn: EnemySpawn, private readonly grid: CollisionGrid) {
    this.id = spawn.id;
    this.kind = spawn.kind;
    const definition = ENEMY_DEFINITIONS[this.kind];
    this.stats = new StatsComponent(definition.stats);
    this.motor = new PlayerMotor(grid, spawn.position, { speed: definition.stats.moveSpeed, radius: definition.radius });
  }

  public takeDamage(amount: number): number {
    if (!this.stats.alive) return 0;
    const applied = this.stats.applyDamage(amount);
    if (applied <= 0) return 0;
    this.hitFlash = 0.12;
    if (!this.stats.alive) {
      this.state = 'DEAD'; this.telegraph = null; this.motor.stop();
    } else if (!(this.kind === 'boss' && this.state === 'ATTACK')) {
      this.state = 'HURT'; this.hurtRemaining = 0.17; this.telegraph = null; this.motor.stop();
    }
    return applied;
  }

  public update(seconds: number, hero: HeroCombat, actions: EnemyActions): void {
    this.hitFlash = Math.max(0, this.hitFlash - seconds);
    this.cooldown = Math.max(0, this.cooldown - seconds);
    this.specialCooldown = Math.max(0, this.specialCooldown - seconds);
    this.repath -= seconds;
    if (this.state === 'DEAD') { this.deadSeconds += seconds; return; }
    if (!hero.stats.alive) { this.state = 'IDLE'; this.telegraph = null; this.motor.stop(); return; }
    if (this.state === 'HURT') {
      this.hurtRemaining -= seconds;
      if (this.hurtRemaining <= 0) { this.state = 'CHASE'; this.repath = 0; }
      return;
    }
    const definition = ENEMY_DEFINITIONS[this.kind];
    if (this.state === 'ATTACK') {
      this.attackAge += seconds;
      if (this.telegraph) this.telegraph.remaining = Math.max(0, this.telegraph.duration - this.attackAge);
      const windup = this.special ? 1.05 : definition.windup;
      if (!this.fired && this.attackAge >= windup) {
        this.fired = true;
        if (this.special && this.telegraph) actions.blast(this, this.telegraph.center, this.telegraph.radius);
        else if (this.kind === 'caster') actions.shoot(this, this.aim);
        else actions.melee(this, this.aim);
        this.telegraph = null;
      }
      if (this.attackAge >= (this.special ? 1.45 : definition.duration)) {
        this.state = 'CHASE'; this.cooldown = definition.cooldown; this.repath = 0;
      }
      return;
    }
    const target = hero.motor.position;
    const distance = Math.hypot(target.x - this.motor.position.x, target.y - this.motor.position.y);
    if (distance > definition.aggro + (this.state === 'IDLE' ? 0 : 2)) {
      this.state = 'IDLE'; this.motor.stop(); return;
    }
    this.state = 'CHASE';
    const clear = this.grid.isSegmentClear(this.motor.position, target, 0.02);
    const shouldRetreat = this.kind === 'caster' && distance < 2.3;
    if (shouldRetreat !== this.retreating) {
      this.retreating = shouldRetreat;
      this.repath = 0;
      this.motor.stop();
    }
    if (shouldRetreat && this.retreat(target)) {
      this.motor.tick(seconds, { x: 0, y: 0 });
      this.face(target);
      return;
    }
    const specialReady = this.kind === 'boss' && this.specialCooldown <= 0 && distance <= 4.5;
    if (clear && (distance <= definition.range + hero.motor.radius || specialReady)) {
      this.motor.stop();
      this.face(target);
      if (this.cooldown <= 0) this.beginAttack(target, specialReady);
    } else {
      if (this.repath <= 0) {
        this.repath = 0.35;
        if (!this.motor.setDestination(target)) {
          const rounded = { x: Math.round(target.x), y: Math.round(target.y) };
          if (this.grid.canOccupy(rounded, this.motor.radius)) this.motor.setDestination(rounded);
        }
      }
      this.motor.tick(seconds, { x: 0, y: 0 });
    }
  }

  private beginAttack(target: Vec2, special: boolean): void {
    this.state = 'ATTACK'; this.attackAge = 0; this.fired = false; this.special = special;
    this.aim = { ...target };
    if (special) {
      this.specialCooldown = 4.7;
      this.telegraph = { center: { ...target }, radius: 1.7, duration: 1.05, remaining: 1.05 };
    }
  }

  private retreat(target: Vec2): boolean {
    if (this.repath > 0) return this.motor.path.length > 0;
    this.repath = 0.45;
    const away = unitVector(target, this.motor.position);
    for (const angle of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const point = { x: this.motor.position.x + (away.x * cos - away.y * sin) * 1.8,
        y: this.motor.position.y + (away.x * sin + away.y * cos) * 1.8 };
      if (this.grid.canOccupy(point, this.motor.radius) && this.motor.setDestination(point)) return true;
    }
    return false;
  }

  private face(target: Vec2): void {
    const direction = isoToScreen(unitVector(this.motor.position, target));
    this.motor.direction = directionFromScreen(direction, this.motor.direction);
  }
}
