import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { CombatWorld } from '../combat/CombatWorld';
import type { CombatStatus } from '../combat/CombatWorld';
import { ENEMY_DEFINITIONS } from '../combat/definitions';
import type { HeroVisualState } from '../combat/HeroCombat';
import type { Vec2 } from '../math/isometric';
import { PlayerInput } from '../systems/PlayerInput';
import { TargetIndicator } from '../systems/TargetIndicator';
import { createArenaLayout } from '../world/ArenaLayout';
import { ArenaRenderer } from '../world/ArenaRenderer';
import type { MapScene } from './MapScene';
import { CombatView } from '../views/CombatView';
import { LootView } from '../views/LootView';
import { AdventureSystem } from '../systems/AdventureSystem';
import type { EquipmentSlot } from '../items/definitions';
import type { RunOutcome } from '../systems/AdventureSystem';

export interface WorldStatus {
  readonly state: 'idle' | 'walk';
  readonly mode: 'idle' | 'keyboard' | 'path';
  readonly gateDistance: number;
  readonly gateReached: boolean;
  readonly action: HeroVisualState;
  readonly combat: CombatStatus;
  readonly inventoryCount: number;
  readonly inventoryOpen: boolean;
  readonly outcome: RunOutcome;
}

/** Coordinates the independent world, input, motor and presentation services. */
export class GameScene extends Phaser.Scene {
  public readonly layout = createArenaLayout();
  public arena!: ArenaRenderer;
  public player!: Player;
  public battle!: CombatWorld;
  public adventure!: AdventureSystem;
  private combatView!: CombatView;
  private lootView!: LootView;
  private pickupTarget: number | null = null;
  private controls!: PlayerInput;
  private target!: TargetIndicator;
  private lastMode = 'idle';
  private statusTimer = 0;

  public constructor() {
    super('GameScene');
  }

  public create(): void {
    this.lastMode = 'idle';
    this.pickupTarget = null;
    this.statusTimer = 0;
    this.cameras.main.setBackgroundColor('#121b16');
    this.arena = new ArenaRenderer(this, this.layout);
    this.player = new Player(this, this.arena);
    this.battle = new CombatWorld(this.layout.grid, this.player.motor, this.player.stats);
    this.adventure = new AdventureSystem(this.player.stats, this.layout.grid);
    this.combatView = new CombatView(this, this.arena, this.battle);
    this.lootView = new LootView(this, this.arena, this.adventure.loot);
    this.target = new TargetIndicator(this, this.arena);
    this.controls = new PlayerInput(this, {
      primary: (world, force) => this.primary(world, force),
      skill: (world) => this.castSkill(world ? this.arena.toGround(world) : null),
      cancel: (blur) => this.cancelMovement(blur), reset: () => this.resetPlayer(), map: () => this.toggleMap(),
      inventory: () => this.toggleInventory(),
    });
    const bounds = this.arena.bounds;
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
      .setZoom(this.scale.width < 600 ? 0.7 : 1)
      .startFollow(this.player.sprite, false, 0.09, 0.09, 0, 45);
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y - 45);
    this.scene.launch('MapScene');
    this.scene.launch('UIScene');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('MapScene');
      this.scene.stop('UIScene');
    });
    this.game.events.emit('world-ready');
    this.emitStatus();
  }

  public override update(_time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, 0.25);
    const lerp = 1 - Math.exp(-6 * seconds);
    this.cameras.main.setLerp(lerp, lerp);
    const before = this.player.motor.mode;
    if (this.adventure.paused) this.controls.clear();
    else this.battle.update(seconds, this.controls.axis);
    this.player.render(this.battle.hero.visualState, this.battle.hero.hitFlash);
    const events = this.battle.drainEvents();
    this.combatView.render(events);
    const outcome = this.adventure.outcome;
    const notices = this.adventure.update(events, this.player.motor.position, this.player.stats.alive);
    for (const notice of notices) this.game.events.emit('destination-status', notice.result === 'picked'
      ? `Подобрано: ${notice.item.name}. I — открыть инвентарь.` : 'Рюкзак полон. Наденьте или выложите предмет.');
    if (outcome !== this.adventure.outcome) { this.battle.cancel(); this.controls.clear(); this.target.clear(); }
    this.lootView.render(seconds);
    const motor = this.player.motor;
    if (motor.mode === 'keyboard') this.pickupTarget = null;
    if (this.pickupTarget !== null && (!this.adventure.loot.drops.some((drop) => drop.id === this.pickupTarget)
      || notices.some((notice) => notice.result === 'full'))) {
      motor.stop(); this.target.clear(); this.pickupTarget = null;
    }
    if (motor.mode === 'keyboard' && before === 'path') this.target.clear();
    this.target.update(seconds, motor.mode === 'path', motor.position, motor.path);
    this.arena.updateOcclusion(this.player.sprite);
    if (this.lastMode !== motor.mode && this.player.stats.alive) {
      if (motor.mode === 'keyboard') this.game.events.emit('destination-status', 'Движение по клавишам');
      else if (motor.mode === 'idle' && this.lastMode === 'path' && !this.battle.selectedEnemy) this.game.events.emit('destination-status', 'Вы прибыли. Продолжайте исследование.');
      else if (motor.mode === 'idle' && this.lastMode === 'keyboard') this.game.events.emit('destination-status', 'Вы остановились. Выберите новый путь.');
      this.lastMode = motor.mode;
    }
    for (const event of events) {
      if (event.type === 'death' && event.kind === 'hero') this.game.events.emit('destination-status', 'Странник пал. Нажмите R, чтобы начать заново.');
      else if (event.type === 'death' && event.kind === 'boss') this.game.events.emit('destination-status', 'Пепельный страж повержен. Святилище стало тише.');
    }
    this.statusTimer += seconds;
    if (this.statusTimer >= 0.1) {
      this.emitStatus();
      this.statusTimer = 0;
    }
  }

  public moveTo(destination: Vec2): void {
    if (!this.player.stats.alive || this.adventure.paused) return;
    this.pickupTarget = null;
    this.battle.cancel();
    const accepted = this.player.motor.setDestination(destination);
    this.lastMode = this.player.motor.mode;
    this.target.show(destination, [this.player.motor.position, ...this.player.motor.path], accepted);
    this.game.events.emit('destination-status', accepted ? 'Маршрут проложен' : 'Здесь не пройти. Выберите свободную землю.');
  }

  public cancelMovement(fromBlur = false): void {
    if (this.adventure.inventoryOpen && !fromBlur) { this.toggleInventory(); return; }
    this.battle.cancel();
    this.pickupTarget = null;
    this.lastMode = 'idle';
    this.target.clear();
    if (!this.adventure.paused) this.game.events.emit('destination-status', 'Остановлено. Выберите новый путь.');
    this.emitStatus();
  }

  public resetPlayer(): void {
    this.restartEncounter(true);
  }

  public respawn(): void {
    if (this.adventure.outcome === 'dead') this.restartEncounter(false);
  }

  public continueAfterVictory(): void {
    this.adventure.continueAfterVictory();
    this.controls.clear();
    this.game.events.emit('destination-status', 'Страж повержен. Заберите легендарную награду у врат.');
    this.emitStatus();
  }

  public toggleInventory(): void {
    if (this.adventure.outcome !== 'playing') return;
    this.adventure.toggleInventory();
    this.controls.clear(); this.battle.cancel(); this.target.clear(); this.pickupTarget = null;
    this.game.events.emit('destination-status', this.adventure.inventoryOpen ? 'Инвентарь открыт. Бой приостановлен.' : 'Путь продолжается.');
    this.emitStatus();
  }

  public equipItem(index: number): boolean {
    if (!this.adventure.inventoryOpen) return false;
    const changed = this.adventure.inventory.equip(index);
    this.emitStatus();
    return changed;
  }

  public unequipItem(slot: EquipmentSlot): boolean {
    if (!this.adventure.inventoryOpen) return false;
    const changed = this.adventure.inventory.unequip(slot);
    if (!changed) this.game.events.emit('destination-status', 'Для снятия снаряжения нужен свободный слот.');
    this.emitStatus();
    return changed;
  }

  public dropItem(index: number): boolean {
    if (!this.adventure.inventoryOpen) return false;
    const position = this.player.motor.position;
    const facing = this.battle.hero.facingVector;
    const directions = [facing, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const destination = directions.map((direction) => ({ x: position.x + direction.x * 1.6, y: position.y + direction.y * 1.6 }))
      .find((point) => this.layout.grid.canOccupy(point, this.player.motor.radius)
        && this.layout.grid.isSegmentClear(position, point, this.player.motor.radius));
    if (!destination) { this.game.events.emit('destination-status', 'Рядом нет места для предмета.'); return false; }
    const item = this.adventure.inventory.remove(index);
    if (!item) return false;
    this.adventure.loot.add(item, destination);
    this.game.events.emit('destination-status', `На земле: ${item.name}.`);
    this.emitStatus();
    return true;
  }

  private restartEncounter(full: boolean): void {
    this.controls.clear();
    this.adventure.reset(full);
    this.battle.reset();
    this.pickupTarget = null;
    this.player.render('idle');
    this.combatView.reset();
    this.target.clear();
    this.lastMode = 'idle';
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y - 45);
    this.game.events.emit('destination-status', 'Вы у входа в святилище.');
    this.emitStatus();
  }

  public changeZoom(amount: number): number {
    const zoom = Phaser.Math.Clamp(this.cameras.main.zoom + amount, 0.55, 1.4);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.preRender();
    return zoom;
  }

  public toggleMap(): void {
    if (!this.scene.isActive('MapScene')) return;
    const map = this.scene.get('MapScene') as MapScene;
    this.game.events.emit('map-visibility', map.toggle());
  }

  public castSkill(target: Vec2 | null = null): void {
    if (this.adventure.paused) return;
    const result = this.battle.castSkill(target);
    const messages = { ok: 'Пепельный импульс', dead: 'Странник пал. Нажмите R.', busy: 'Завершите текущее действие.',
      cooldown: 'Умение ещё восстанавливается.', mana: 'Недостаточно маны.' };
    if (result === 'ok') { this.target.clear(); this.lastMode = 'idle'; }
    this.game.events.emit('destination-status', messages[result]);
    this.emitStatus();
  }

  public attackNearest(): void {
    if (this.adventure.paused) return;
    this.pickupTarget = null;
    const position = this.player.motor.position;
    const enemy = this.battle.selectedEnemy ?? this.battle.enemies.filter((target) => target.stats.alive)
      .sort((a, b) => Math.hypot(a.motor.position.x - position.x, a.motor.position.y - position.y)
        - Math.hypot(b.motor.position.x - position.x, b.motor.position.y - position.y))[0];
    if (enemy) this.battle.commandAttack(enemy.id);
    else {
      const facing = this.battle.hero.facingVector;
      this.battle.forceAttack({ x: position.x + facing.x, y: position.y + facing.y });
    }
    this.target.clear();
  }

  private primary(world: Vec2, force: boolean): void {
    if (!this.player.stats.alive || this.adventure.paused) return;
    this.pickupTarget = null;
    if (force) {
      this.battle.forceAttack(this.arena.toGround(world));
      this.target.clear();
      return;
    }
    const drop = this.lootView.pick(world);
    if (drop) {
      this.moveTo(drop.position);
      this.pickupTarget = drop.id;
      this.game.events.emit('destination-status', `Подобрать: ${drop.item.name}`);
      return;
    }
    const enemy = this.combatView.pickEnemy(world);
    if (enemy) {
      this.battle.commandAttack(enemy.id);
      this.target.clear();
      this.game.events.emit('destination-status', `Цель: ${ENEMY_DEFINITIONS[enemy.kind].name}`);
    } else this.moveTo(this.arena.toGround(world));
  }

  private emitStatus(): void {
    const position = this.player.motor.position;
    const distance = Math.hypot(position.x - this.layout.gate.x, position.y - this.layout.gate.y);
    const status: WorldStatus = {
      state: this.player.motor.state, mode: this.player.motor.mode,
      gateDistance: Math.round(distance * 2), gateReached: distance < 1.1,
      action: this.battle.hero.visualState, combat: this.battle.status,
      inventoryCount: this.adventure.inventory.count, inventoryOpen: this.adventure.inventoryOpen, outcome: this.adventure.outcome,
    };
    this.game.events.emit('world-status', status);
  }
}
