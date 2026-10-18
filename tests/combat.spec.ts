import { expect, test } from '@playwright/test';
import { StatsComponent } from '../src/components/StatsComponent';
import { rollDamage, circleIntersectsSector, segmentCircleHitTime } from '../src/combat/geometry';
import { HERO_STATS } from '../src/combat/definitions';
import { CombatWorld } from '../src/combat/CombatWorld';
import { ProjectileSystem } from '../src/combat/ProjectileSystem';
import { PlayerMotor } from '../src/entities/PlayerMotor';
import { CollisionGrid } from '../src/world/CollisionGrid';

test('stats clamp resources, reject overdrafts and recalculate modifiers without healing', () => {
  const stats = new StatsComponent(HERO_STATS);
  expect(stats.applyDamage(30)).toBe(30);
  expect(stats.hp).toBe(130);
  expect(stats.spendMana(90)).toBe(false);
  expect(stats.mana).toBe(80);
  expect(stats.spendMana(18)).toBe(true);
  stats.regenerateMana(2, 6);
  expect(stats.mana).toBe(74);
  stats.setModifiers([{ maxHp: 40, attackDamage: 7, armor: 10 }]);
  expect(stats.values.maxHp).toBe(200);
  expect(stats.values.attackDamage).toBe(33);
  expect(stats.hp).toBe(130);
  expect(stats.applyDamage(500)).toBe(130);
  expect(stats.alive).toBe(false);
  stats.restore();
  expect(stats.hp).toBe(200);
  expect(stats.mana).toBe(80);
});

test('damage applies critical multipliers before armor and remains at least one', () => {
  expect(rollDamage({ attackDamage: 100, critChance: 0.2, critMultiplier: 2 }, 100, 1, () => 0.9)).toEqual({ amount: 50, critical: false });
  expect(rollDamage({ attackDamage: 100, critChance: 0.2, critMultiplier: 2 }, 100, 1, () => 0.1)).toEqual({ amount: 100, critical: true });
  expect(rollDamage({ attackDamage: 1, critChance: 0, critMultiplier: 2 }, 9999, 1, () => 0.9).amount).toBe(1);
});

test('melee sectors include intersecting bodies but exclude the back and out-of-range targets', () => {
  const origin = { x: 0, y: 0 };
  const facing = { x: 1, y: 0 };
  expect(circleIntersectsSector(origin, facing, 1.2, Math.PI / 3, { x: 1.3, y: 0 }, 0.22)).toBe(true);
  expect(circleIntersectsSector(origin, facing, 1.2, Math.PI / 3, { x: -0.8, y: 0 }, 0.22)).toBe(false);
  expect(circleIntersectsSector(origin, facing, 1.2, Math.PI / 3, { x: 2, y: 0 }, 0.22)).toBe(false);
  expect(segmentCircleHitTime({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 4, y: 0 }, 0.5)).toBeCloseTo(0.35);
});

test('projectiles collide with the nearest target and cannot tunnel through walls', () => {
  const grid = new CollisionGrid(12, 12, Array.from({ length: 12 }, (_, y) => ({ x: 6, y })));
  const system = new ProjectileSystem(grid);
  const bodies = [
    { id: 2, team: 'enemy' as const, position: { x: 4, y: 4 }, radius: 0.22, alive: true },
    { id: 3, team: 'enemy' as const, position: { x: 8, y: 4 }, radius: 0.22, alive: true },
  ];
  const request = { sourceId: 0, team: 'hero' as const, from: { x: 1, y: 4 }, aim: { x: 10, y: 4 },
    speed: 30, radius: 0.1, power: 1, splashRadius: 1.2, lifespan: 2, attack: HERO_STATS };
  system.spawn(request);
  const first = system.update(0.3, bodies);
  expect(first).toHaveLength(1);
  expect(first[0]?.targetId).toBe(2);
  system.spawn(request);
  const wall = system.update(0.3, [bodies[1]!]);
  expect(wall).toHaveLength(1);
  expect(wall[0]?.targetId).toBeNull();
  expect(wall[0]?.position.x).toBeLessThan(5.5);
  expect(system.active).toHaveLength(0);
});

function battleAt(heroPosition: { x: number; y: number }, enemies: ConstructorParameters<typeof CombatWorld>[3]) {
  const grid = new CollisionGrid(24, 24, []);
  const motor = new PlayerMotor(grid, heroPosition);
  const stats = new StatsComponent(HERO_STATS);
  return new CombatWorld(grid, motor, stats, enemies, () => 0.99);
}

function advance(world: CombatWorld, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds - 0.000001; elapsed += 1 / 60) world.update(1 / 60, { x: 0, y: 0 });
}

test('enemy FSM chases, attacks, gets hurt and stays dead after a lethal strike', () => {
  const world = battleAt({ x: 5, y: 5 }, [{ id: 1, kind: 'grunt', position: { x: 7.5, y: 5 } }]);
  const enemy = world.enemies[0]!;
  expect(enemy.state).toBe('IDLE');
  advance(world, 0.2);
  expect(enemy.state).toBe('CHASE');
  advance(world, 1.3);
  expect(world.hero.stats.hp).toBeLessThan(160);
  enemy.takeDamage(5);
  expect(enemy.state).toBe('HURT');
  enemy.takeDamage(500);
  expect(enemy.state).toBe('DEAD');
  const hp = world.hero.stats.hp;
  advance(world, 3);
  expect(enemy.state).toBe('DEAD');
  expect(world.hero.stats.hp).toBe(hp);
});

test('caster retreats at close range and subsequently launches a live projectile', () => {
  const world = battleAt({ x: 8, y: 8 }, [{ id: 1, kind: 'caster', position: { x: 9, y: 8 } }]);
  const enemy = world.enemies[0]!;
  advance(world, 0.7);
  expect(Math.hypot(enemy.motor.position.x - 8, enemy.motor.position.y - 8)).toBeGreaterThan(1.6);
  let launched = false;
  for (let i = 0; i < 180; i += 1) {
    world.update(1 / 60, { x: 0, y: 0 });
    if (world.projectiles.active.length > 0) launched = true;
  }
  expect(launched).toBe(true);
});

test('caster replaces a pursuit route immediately when the hero enters close range', () => {
  const world = battleAt({ x: 6, y: 5 }, [{ id: 1, kind: 'caster', position: { x: 11, y: 5 } }]);
  const enemy = world.enemies[0]!;
  advance(world, 0.05);
  expect(enemy.motor.path.length).toBeGreaterThan(0);
  const closePosition = { x: enemy.motor.position.x - 1, y: enemy.motor.position.y };
  world.hero.motor.reset(closePosition);
  world.update(1 / 60, { x: 0, y: 0 });
  expect(Math.hypot(enemy.motor.position.x - closePosition.x, enemy.motor.position.y - closePosition.y)).toBeGreaterThan(1);
});

test('boss telegraph locks its center, delays damage and lets the player dodge', () => {
  const world = battleAt({ x: 10, y: 8 }, [{ id: 1, kind: 'boss', position: { x: 10, y: 5 } }]);
  advance(world, 0.1);
  const boss = world.enemies[0]!;
  expect(boss.telegraph?.center).toEqual({ x: 10, y: 8 });
  advance(world, 0.6);
  expect(world.hero.stats.hp).toBe(160);
  world.hero.motor.reset({ x: 14, y: 10 });
  advance(world, 0.6);
  expect(world.hero.stats.hp).toBe(160);
  const standing = battleAt({ x: 10, y: 8 }, [{ id: 1, kind: 'boss', position: { x: 10, y: 5 } }]);
  advance(standing, 1.3);
  expect(standing.hero.stats.hp).toBeLessThan(160);
});

test('melee deals damage once per swing, respects walls, and reset restores the encounter', () => {
  const world = battleAt({ x: 5, y: 5 }, [{ id: 1, kind: 'grunt', position: { x: 6, y: 5 } }]);
  expect(world.commandAttack(1)).toBe(true);
  advance(world, 0.3);
  expect(world.enemies[0]?.stats.hp).toBeLessThan(58);
  const damage = world.drainEvents().filter((event) => event.type === 'damage' && event.targetId === 1);
  expect(damage).toHaveLength(1);
  expect(world.castSkill({ x: 7, y: 5 })).toBe('busy');
  advance(world, 0.1);
  expect(world.castSkill({ x: 7, y: 5 })).toBe('ok');
  expect(world.hero.stats.mana).toBeLessThan(80);
  world.reset();
  expect(world.hero.stats.mana).toBe(80);
  expect(world.enemies[0]?.stats.hp).toBe(58);
  expect(world.projectiles.active).toHaveLength(0);
  const grid = new CollisionGrid(12, 12, [{ x: 6, y: 5 }]);
  const blocked = new CombatWorld(grid, new PlayerMotor(grid, { x: 5.25, y: 5 }), new StatsComponent(HERO_STATS),
    [{ id: 1, kind: 'grunt', position: { x: 6, y: 5.76 } }], () => 0.99);
  blocked.forceAttack({ x: 6, y: 5.76 });
  advance(blocked, 0.3);
  expect(blocked.enemies[0]?.stats.hp).toBe(58);
});

test('a single skill explosion kills clustered casters once and interrupts their pending casts', () => {
  const world = battleAt({ x: 5, y: 5 }, [
    { id: 1, kind: 'caster', position: { x: 8, y: 5 } },
    { id: 2, kind: 'caster', position: { x: 8, y: 5.6 } },
  ]);
  expect(world.castSkill({ x: 8, y: 5 })).toBe('ok');
  advance(world, 0.8);
  expect(world.enemies.every((enemy) => enemy.state === 'DEAD')).toBe(true);
  const events = world.drainEvents();
  expect(events.filter((event) => event.type === 'damage' && event.team === 'enemy')).toHaveLength(2);
  expect(events.filter((event) => event.type === 'death')).toHaveLength(2);
  expect(world.hero.stats.hp).toBe(160);
  expect(world.projectiles.active).toHaveLength(0);
  advance(world, 2);
  expect(world.drainEvents().filter((event) => event.type === 'death')).toHaveLength(0);
});

test('explosion splash does not pass through a wall into a nearby enemy', () => {
  const grid = new CollisionGrid(12, 12, [{ x: 7, y: 5 }]);
  const world = new CombatWorld(grid, new PlayerMotor(grid, { x: 5.5, y: 5 }), new StatsComponent(HERO_STATS),
    [{ id: 1, kind: 'grunt', position: { x: 7.75, y: 5 } }], () => 0.99);
  const enemy = world.enemies[0]!;
  enemy.takeDamage(1);
  expect(world.castSkill({ x: 9, y: 5 })).toBe('ok');
  advance(world, 0.16);
  expect(world.projectiles.active).toHaveLength(0);
  expect(enemy.stats.hp).toBe(57);
});
