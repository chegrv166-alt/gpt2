export interface StatValues {
  readonly maxHp: number;
  readonly maxMana: number;
  readonly attackDamage: number;
  readonly armor: number;
  readonly moveSpeed: number;
  readonly critChance: number;
  readonly critMultiplier: number;
}

const KEYS: readonly (keyof StatValues)[] = ['maxHp', 'maxMana', 'attackDamage', 'armor', 'moveSpeed', 'critChance', 'critMultiplier'];

function normalize(values: StatValues): StatValues {
  for (const key of KEYS) if (!Number.isFinite(values[key])) throw new Error(`Non-finite stat: ${key}`);
  return Object.freeze({
    maxHp: Math.max(1, Math.round(values.maxHp)), maxMana: Math.max(0, values.maxMana),
    attackDamage: Math.max(0, values.attackDamage), armor: Math.max(0, values.armor),
    moveSpeed: Math.max(0.1, values.moveSpeed), critChance: Math.max(0, Math.min(1, values.critChance)),
    critMultiplier: Math.max(1, values.critMultiplier),
  });
}

/** Owns derived stats and clamped resources, without rendering or actor logic. */
export class StatsComponent {
  private readonly base: StatValues;
  private derived: StatValues;
  private health: number;
  private energy: number;

  public constructor(base: StatValues) {
    this.base = normalize(base);
    this.derived = this.base;
    this.health = this.derived.maxHp;
    this.energy = this.derived.maxMana;
  }

  public get values(): StatValues { return this.derived; }
  public get hp(): number { return this.health; }
  public get mana(): number { return this.energy; }
  public get alive(): boolean { return this.health > 0; }

  public setModifiers(modifiers: readonly Partial<StatValues>[]): void {
    const total = { ...this.base };
    for (const modifier of modifiers) for (const key of KEYS) total[key] += modifier[key] ?? 0;
    this.derived = normalize(total);
    this.health = Math.min(this.health, this.derived.maxHp);
    this.energy = Math.min(this.energy, this.derived.maxMana);
  }

  public applyDamage(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Damage must be finite and non-negative');
    const applied = Math.min(this.health, Math.round(amount));
    this.health -= applied;
    return applied;
  }

  public heal(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Healing must be finite and non-negative');
    if (this.alive) this.health = Math.min(this.derived.maxHp, this.health + amount);
  }

  public spendMana(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Mana cost must be finite and non-negative');
    if (this.energy < amount) return false;
    this.energy -= amount;
    return true;
  }

  public regenerateMana(seconds: number, rate: number): void {
    if (!Number.isFinite(seconds) || !Number.isFinite(rate) || seconds < 0 || rate < 0) throw new Error('Invalid regeneration');
    if (this.alive) this.energy = Math.min(this.derived.maxMana, this.energy + seconds * rate);
  }

  public restore(): void {
    this.health = this.derived.maxHp;
    this.energy = this.derived.maxMana;
  }
}
