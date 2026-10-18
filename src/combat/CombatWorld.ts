import type { StatsComponent } from '../components/StatsComponent';
import { Enemy } from '../entities/Enemy';
import type { PlayerMotor } from '../entities/PlayerMotor';
import type { Vec2 } from '../math/isometric';
import type { CollisionGrid } from '../world/CollisionGrid';
import { ENEMY_SPAWNS, ENEMY_DEFINITIONS, MELEE, SKILL } from './definitions';
import type { CombatEvent, EnemySpawn, Team } from './definitions';
import { circleIntersectsSector, rollDamage, unitVector } from './geometry';
import type { AttackProfile } from './geometry';
import { HeroCombat } from './HeroCombat';
import type { CastResult } from './HeroCombat';
import { ProjectileSystem } from './ProjectileSystem';

export interface CombatStatus {
  readonly hp: number; readonly maxHp: number; readonly mana: number; readonly maxMana: number;
  readonly damage: number; readonly armor: number; readonly alive: boolean; readonly remaining: number;
  readonly skillCooldown: number; readonly skillAvailable: boolean; readonly bossDefeated: boolean;
  readonly targetName: string; readonly targetHp: number; readonly targetMaxHp: number;
}

/** Simulation coordinator: actor models, ordered combat steps and emitted events. */
export class CombatWorld {
  public readonly hero: HeroCombat;
  public readonly projectiles: ProjectileSystem;
  public enemies: readonly Enemy[];
  private targetId: number | null = null;
  private approachTimer = 0;
  private events: CombatEvent[] = [];
  private readonly spawn: Vec2;

  public constructor(private readonly grid: CollisionGrid, motor: PlayerMotor, stats: StatsComponent,
    private readonly spawns: readonly EnemySpawn[] = ENEMY_SPAWNS, private readonly random: () => number = Math.random) {
    if (new Set(spawns.map((spawn) => spawn.id)).size !== spawns.length || spawns.some((spawn) => spawn.id <= 0)) throw new Error('Enemy IDs must be positive and unique');
    this.hero = new HeroCombat(motor, stats);
    this.spawn = { ...motor.position };
    this.projectiles = new ProjectileSystem(grid);
    this.enemies = spawns.map((spawn) => new Enemy(spawn, grid));
  }

  public get selectedEnemy(): Enemy | undefined {
    return this.enemies.find((enemy) => enemy.id === this.targetId && enemy.stats.alive);
  }

  public commandAttack(id: number): boolean {
    const target = this.enemies.find((enemy) => enemy.id === id && enemy.stats.alive);
    if (!target || !this.hero.stats.alive) return false;
    this.targetId = id; this.approachTimer = 0;
    return true;
  }

  public forceAttack(aim: Vec2): boolean {
    this.targetId = null;
    return this.hero.requestMelee(aim);
  }

  public castSkill(aim: Vec2 | null = null): CastResult {
    const position = this.hero.motor.position;
    const nearest = this.selectedEnemy ?? this.enemies.filter((enemy) => enemy.stats.alive
      && this.grid.isSegmentClear(position, enemy.motor.position, 0.02))
      .sort((a, b) => Math.hypot(a.motor.position.x - position.x, a.motor.position.y - position.y)
        - Math.hypot(b.motor.position.x - position.x, b.motor.position.y - position.y))[0];
    const facing = this.hero.facingVector;
    const target = aim ?? nearest?.motor.position ?? { x: position.x + facing.x * 8, y: position.y + facing.y * 8 };
    const result = this.hero.requestSkill(target);
    if (result === 'ok') {
      this.projectiles.spawn({ sourceId: 0, team: 'hero', from: position, aim: target, speed: SKILL.speed,
        radius: 0.1, power: SKILL.power, splashRadius: SKILL.radius, lifespan: SKILL.lifespan, attack: this.hero.stats.values });
    }
    return result;
  }

  public cancel(): void {
    this.targetId = null;
    this.hero.cancel();
    this.hero.motor.stop();
  }

  public update(delta: number, input: Vec2): void {
    let remaining = Math.min(0.25, Math.max(0, delta));
    while (remaining > 0.000001) {
      const seconds = Math.min(remaining, 1 / 60);
      this.step(seconds, input);
      remaining -= seconds;
    }
  }

  public drainEvents(): CombatEvent[] { const events = this.events; this.events = []; return events; }

  public reset(): void {
    this.cancel(); this.hero.stats.restore(); this.hero.motor.reset(this.spawn); this.hero.reset();
    this.enemies = this.spawns.map((spawn) => new Enemy(spawn, this.grid));
    this.projectiles.clear(); this.events = []; this.approachTimer = 0;
  }

  public get status(): CombatStatus {
    const stats = this.hero.stats;
    const target = this.selectedEnemy;
    return { hp: Math.ceil(stats.hp), maxHp: stats.values.maxHp, mana: Math.floor(stats.mana), maxMana: stats.values.maxMana,
      damage: stats.values.attackDamage, armor: stats.values.armor, alive: stats.alive,
      remaining: this.enemies.filter((enemy) => enemy.stats.alive).length,
      skillCooldown: this.hero.castCooldown, skillAvailable: stats.alive && this.hero.castCooldown <= 0 && stats.mana >= SKILL.cost,
      bossDefeated: this.enemies.some((enemy) => enemy.kind === 'boss' && !enemy.stats.alive),
      targetName: target ? ENEMY_DEFINITIONS[target.kind].name : '', targetHp: target?.stats.hp ?? 0,
      targetMaxHp: target?.stats.values.maxHp ?? 0 };
  }

  private step(seconds: number, input: Vec2): void {
    this.approachTimer -= seconds;
    this.hero.update(seconds, (direction) => this.melee(this.hero.motor.position, direction, MELEE.range, MELEE.halfAngle, 'hero', this.hero.stats.values));
    if (input.x !== 0 || input.y !== 0) this.targetId = null;
    this.hero.motor.setSpeed(this.hero.stats.values.moveSpeed);
    if (this.hero.canMove) {
      this.approachTarget();
      this.hero.motor.tick(seconds, input);
    } else this.hero.motor.pause();
    for (const enemy of this.enemies) {
      enemy.update(seconds, this.hero, {
        melee: (source, aim) => this.melee(source.motor.position, unitVector(source.motor.position, aim),
          ENEMY_DEFINITIONS[source.kind].range, Math.PI / 3, 'enemy', source.stats.values),
        shoot: (source, aim) => this.projectiles.spawn({ sourceId: source.id, team: 'enemy', from: source.motor.position,
          aim, speed: 4.4, radius: 0.1, power: 1, splashRadius: 0, lifespan: 2.3, attack: source.stats.values }),
        blast: (source, center, radius) => {
          this.events.push({ type: 'impact', position: center, radius, team: 'enemy' });
          const hero = this.hero.motor.position;
          if (Math.hypot(hero.x - center.x, hero.y - center.y) <= radius + this.hero.motor.radius
            && this.grid.isSegmentClear(center, hero, 0.02)) this.damageHero(source.stats.values, 1.8);
        },
      });
    }
    const bodies = [{ id: 0, team: 'hero' as const, position: this.hero.motor.position, radius: this.hero.motor.radius, alive: this.hero.stats.alive },
      ...this.enemies.map((enemy) => ({ id: enemy.id, team: 'enemy' as const, position: enemy.motor.position, radius: enemy.motor.radius, alive: enemy.stats.alive }))];
    for (const impact of this.projectiles.update(seconds, bodies)) {
      const projectile = impact.projectile;
      this.events.push({ type: 'impact', position: impact.position, radius: projectile.splashRadius || 0.3, team: projectile.team });
      if (projectile.team === 'hero') {
        for (const enemy of this.enemies) {
          if (!enemy.stats.alive) continue;
          const point = enemy.motor.position;
          if ((enemy.id === impact.targetId || Math.hypot(point.x - impact.position.x, point.y - impact.position.y) <= projectile.splashRadius + enemy.motor.radius)
            && this.grid.isSegmentClear(impact.position, point, 0.02)) this.damageEnemy(enemy, projectile.attack, projectile.power);
        }
      } else if (impact.targetId === 0) this.damageHero(projectile.attack, projectile.power);
    }
    this.separateBodies();
  }

  private approachTarget(): void {
    const target = this.selectedEnemy;
    if (!target) { this.targetId = null; return; }
    const position = this.hero.motor.position;
    const distance = Math.hypot(target.motor.position.x - position.x, target.motor.position.y - position.y);
    if (distance < MELEE.range + target.motor.radius - 0.05 && this.grid.isSegmentClear(position, target.motor.position, 0.02)) {
      this.hero.motor.stop();
      this.hero.requestMelee(target.motor.position);
    } else if (this.approachTimer <= 0) {
      this.approachTimer = 0.25;
      this.hero.motor.setDestination(target.motor.position);
    }
  }

  private melee(origin: Vec2, facing: Vec2, range: number, halfAngle: number, team: Team, attack: AttackProfile): void {
    this.events.push({ type: 'swing', position: { ...origin }, direction: facing, team });
    if (team === 'hero') {
      for (const enemy of this.enemies) {
        if (enemy.stats.alive && circleIntersectsSector(origin, facing, range, halfAngle, enemy.motor.position, enemy.motor.radius)
          && this.grid.isSegmentClear(origin, enemy.motor.position, 0.02)) this.damageEnemy(enemy, attack, 1);
      }
    } else if (circleIntersectsSector(origin, facing, range, halfAngle, this.hero.motor.position, this.hero.motor.radius)
      && this.grid.isSegmentClear(origin, this.hero.motor.position, 0.02)) this.damageHero(attack, 1);
  }

  private damageEnemy(enemy: Enemy, attack: AttackProfile, power: number): void {
    const roll = rollDamage(attack, enemy.stats.values.armor, power, this.random);
    const amount = enemy.takeDamage(roll.amount);
    if (amount <= 0) return;
    this.events.push({ type: 'damage', targetId: enemy.id, position: { ...enemy.motor.position }, amount, critical: roll.critical, team: 'enemy' });
    if (!enemy.stats.alive) this.events.push({ type: 'death', targetId: enemy.id, position: { ...enemy.motor.position }, kind: enemy.kind });
  }

  private damageHero(attack: AttackProfile, power: number): void {
    if (!this.hero.stats.alive || this.hero.invulnerability > 0) return;
    const roll = rollDamage(attack, this.hero.stats.values.armor, power, this.random);
    const amount = this.hero.stats.applyDamage(roll.amount);
    this.hero.onHit();
    this.events.push({ type: 'damage', targetId: 0, position: { ...this.hero.motor.position }, amount, critical: roll.critical, team: 'hero' });
    if (!this.hero.stats.alive) {
      this.targetId = null;
      this.events.push({ type: 'death', targetId: 0, position: { ...this.hero.motor.position }, kind: 'hero' });
    }
  }

  private separateBodies(): void {
    const actors = [{ motor: this.hero.motor, stats: this.hero.stats }, ...this.enemies].filter((actor) => actor.stats.alive);
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < actors.length; i += 1) {
        for (let j = i + 1; j < actors.length; j += 1) {
          const a = actors[i]; const b = actors[j];
          if (!a || !b) continue;
          const distance = Math.hypot(a.motor.position.x - b.motor.position.x, a.motor.position.y - b.motor.position.y);
          const overlap = a.motor.radius + b.motor.radius + 0.025 - distance;
          if (overlap <= 0) continue;
          const direction = unitVector(a.motor.position, b.motor.position);
          a.motor.position = this.grid.move(a.motor.position, { x: -direction.x * overlap / 2, y: -direction.y * overlap / 2 }, a.motor.radius);
          b.motor.position = this.grid.move(b.motor.position, { x: direction.x * overlap / 2, y: direction.y * overlap / 2 }, b.motor.radius);
        }
      }
    }
  }
}
