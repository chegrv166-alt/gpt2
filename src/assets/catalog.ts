export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const FRAME_COUNT = 4;
export const WALK_FRAME_COUNT = 6;
export const DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export const ACTOR_STATES = ['idle', 'walk', 'attack', 'hurt'] as const;
export const ACTOR_IDS = ['hero', 'grunt', 'caster', 'boss', 'knife', 'spear', 'archer'] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type ActorState = (typeof ACTOR_STATES)[number];
export type ActorId = (typeof ACTOR_IDS)[number];
export type AssetCategory = 'terrain' | 'actors' | 'projectiles' | 'items' | 'effects';

export interface TextureSpec {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly category: AssetCategory;
}

export interface ActorDefinition {
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly footY: number;
  readonly color: number;
}

export const ACTORS: Readonly<Record<ActorId, ActorDefinition>> = {
  knife: { name: 'Разбойник с ножом', role: 'Ближний бой · быстрый налётчик', description: 'Кожаный жилет, красный платок и короткий нож.', width: 128, height: 112, footY: 94, color: 0xb27552 },
  spear: { name: 'Разбойник с копьём', role: 'Ближний бой · длинный выпад', description: 'Лесной дозорный с длинным копьём и зелёным плащом.', width: 128, height: 112, footY: 94, color: 0x899a66 },
  archer: { name: 'Разбойник с луком', role: 'Дальний бой · стрелы и отступление', description: 'Капюшон, колчан и деревянный лук. Держится на расстоянии.', width: 128, height: 112, footY: 94, color: 0xbda56b },
  hero: {
    name: 'Странник', role: 'Герой · меч и щит',
    description: 'Последний из ордена. Потёртая сталь, багровый плащ и клинок, который ещё помнит свет.',
    width: 128, height: 112, footY: 94, color: 0xc5a16a,
  },
  grunt: {
    name: 'Осквернённый', role: 'Ближний бой · обычный противник',
    description: 'Бывший страж святилища. Сгорбленная фигура в ржавой броне с тяжёлым костяным тесаком.',
    width: 128, height: 112, footY: 94, color: 0x88a17d,
  },
  caster: {
    name: 'Культист', role: 'Дальний бой · обычный противник',
    description: 'Под тёмным капюшоном тлеет запретное пламя. Посох выдаёт его прежде, чем проявится силуэт.',
    width: 128, height: 112, footY: 94, color: 0xb798ce,
  },
  boss: {
    name: 'Пепельный страж', role: 'Мини-босс · хранитель врат',
    description: 'Древний исполин в обсидиановых латах. В трещинах его брони ещё горит сердце кузницы.',
    width: 160, height: 144, footY: 124, color: 0xe18b54,
  },
};

export const DIRECTION_VECTORS: Readonly<Record<Direction, readonly [number, number]>> = {
  e: [1, 0], se: [0.7071, 0.7071], s: [0, 1], sw: [-0.7071, 0.7071],
  w: [-1, 0], nw: [-0.7071, -0.7071], n: [0, -1], ne: [0.7071, -0.7071],
};

export function actorTextureKey(actor: ActorId, state: ActorState, direction: Direction, frame: number): string {
  return `${actor}-${state}-${direction}-${frame}`;
}

export function actorAnimationKey(actor: ActorId, state: ActorState, direction: Direction): string {
  return `${actor}-${state}-${direction}`;
}

export const TERRAIN_SPECS: readonly TextureSpec[] = [
  ...(['ground', 'stone', 'forest', 'path'] as const).flatMap((kind) =>
    Array.from({ length: 4 }, (_, variant): TextureSpec => ({
      key: `tile-${kind}-${variant}`, width: 128, height: 80, category: 'terrain',
    }))),
  ...['wall-nw', 'wall-ne', 'prop-rock', 'prop-pillar', 'prop-brazier', 'prop-tree'].map((key): TextureSpec => ({
    key, width: 128, height: 144, category: 'terrain',
  })),
];

export const PROJECTILE_SPECS: readonly TextureSpec[] =
  ['projectile-ember', 'projectile-arcane', 'projectile-slash', 'projectile-arrow'].map((key) => ({
    key, width: 64, height: 64, category: 'projectiles',
  }));

export const ITEM_SPECS: readonly TextureSpec[] =
  ['icon-sword', 'icon-armor', 'icon-potion-health', 'icon-potion-mana', 'icon-ring', 'icon-rune'].map((key) => ({
    key, width: 48, height: 48, category: 'items',
  }));

export const EFFECT_SPECS: readonly TextureSpec[] = [
  { key: 'fx-shadow', width: 96, height: 48, category: 'effects' },
  { key: 'fx-target', width: 96, height: 64, category: 'effects' },
  { key: 'fx-telegraph', width: 192, height: 112, category: 'effects' },
  ...['common', 'rare', 'legendary'].map((rarity): TextureSpec => ({
    key: `fx-loot-${rarity}`, width: 64, height: 160, category: 'effects',
  })),
  { key: 'fx-spark', width: 32, height: 32, category: 'effects' },
  { key: 'fx-blood-spray', width: 96, height: 96, category: 'effects' },
  { key: 'fx-blood-pool', width: 128, height: 80, category: 'effects' },
  { key: 'fx-blood-footprint', width: 28, height: 42, category: 'effects' },
];

export const UI_SPECS: readonly TextureSpec[] = [
  { key: 'ui-orb-frame', width: 160, height: 160, category: 'effects' },
  { key: 'ui-orb-health', width: 128, height: 128, category: 'effects' },
  { key: 'ui-orb-mana', width: 128, height: 128, category: 'effects' },
];

export const ACTOR_SPECS: readonly TextureSpec[] = ACTOR_IDS.flatMap((actor) =>
  ACTOR_STATES.flatMap((state) => DIRECTIONS.flatMap((direction) =>
    Array.from({ length: state === 'walk' ? WALK_FRAME_COUNT : FRAME_COUNT }, (_, frame): TextureSpec => ({
      key: actorTextureKey(actor, state, direction, frame),
      width: ACTORS[actor].width, height: ACTORS[actor].height, category: 'actors',
    })))));

export const TEXTURE_SPECS: readonly TextureSpec[] = [
  ...TERRAIN_SPECS, ...ACTOR_SPECS, ...PROJECTILE_SPECS, ...ITEM_SPECS, ...EFFECT_SPECS, ...UI_SPECS,
];
