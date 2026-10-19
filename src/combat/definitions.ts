import type { StatValues } from '../components/StatsComponent';
import type { Vec2 } from '../math/isometric';
import type { Direction } from '../assets/catalog';

export type Team = 'hero' | 'enemy';
export type EnemyKind = 'grunt' | 'caster' | 'boss';
export type EnemyState = 'IDLE' | 'CHASE' | 'ATTACK' | 'HURT' | 'DEAD';

export const HERO_STATS: StatValues = {
  maxHp: 160, maxMana: 80, attackDamage: 26, armor: 15, moveSpeed: 3.4, critChance: 0.12, critMultiplier: 1.8,
};

export const MELEE = { range: 1.2, halfAngle: Math.PI * 55 / 180, windup: 0.14, duration: 0.36, cooldown: 0.52 } as const;
export const SKILL = { cost: 18, cooldown: 1.4, power: 1.9, radius: 1.25, speed: 7.5, lifespan: 1.35 } as const;

export interface EnemyDefinition {
  readonly name: string;
  readonly stats: StatValues;
  readonly radius: number;
  readonly aggro: number;
  readonly range: number;
  readonly windup: number;
  readonly duration: number;
  readonly cooldown: number;
}

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyKind, EnemyDefinition>> = {
  grunt: { name: 'Осквернённый', radius: 0.24, aggro: 3.8, range: 0.95, windup: 0.32, duration: 0.65, cooldown: 1.05,
    stats: { maxHp: 58, maxMana: 0, attackDamage: 11, armor: 6, moveSpeed: 1.65, critChance: 0.03, critMultiplier: 1.5 } },
  caster: { name: 'Культист', radius: 0.23, aggro: 5.5, range: 4.6, windup: 0.46, duration: 0.82, cooldown: 1.65,
    stats: { maxHp: 48, maxMana: 0, attackDamage: 14, armor: 2, moveSpeed: 1.55, critChance: 0.03, critMultiplier: 1.5 } },
  boss: { name: 'Пепельный страж', radius: 0.38, aggro: 5.7, range: 1.3, windup: 0.48, duration: 0.85, cooldown: 1.2,
    stats: { maxHp: 320, maxMana: 0, attackDamage: 23, armor: 18, moveSpeed: 1.3, critChance: 0.05, critMultiplier: 1.5 } },
};

export interface EnemySpawn { readonly id: number; readonly kind: EnemyKind; readonly position: Vec2; }
export const ENEMY_SPAWNS: readonly EnemySpawn[] = [
  { id: 1, kind: 'grunt', position: { x: 9, y: 17 } },
  { id: 2, kind: 'grunt', position: { x: 6, y: 10 } },
  { id: 3, kind: 'caster', position: { x: 10, y: 11 } },
  { id: 4, kind: 'grunt', position: { x: 16, y: 13 } },
  { id: 5, kind: 'caster', position: { x: 18, y: 10 } },
  { id: 6, kind: 'boss', position: { x: 18, y: 4 } },
];

export type CombatEvent =
  | { readonly type: 'damage'; readonly targetId: number; readonly position: Vec2; readonly amount: number; readonly critical: boolean; readonly team: Team }
  | { readonly type: 'swing'; readonly position: Vec2; readonly direction: Vec2; readonly team: Team }
  | { readonly type: 'impact'; readonly position: Vec2; readonly radius: number; readonly team: Team }
  | { readonly type: 'death'; readonly targetId: number; readonly position: Vec2; readonly kind: EnemyKind | 'hero'; readonly direction: Direction };
