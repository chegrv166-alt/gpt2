import type { WorldStatus } from '../scenes/GameScene';

interface ExpeditionActions {
  readonly reset: () => void;
  readonly zoom: (amount: number) => number;
  readonly map: () => void;
  readonly cast: () => void;
  readonly attack: () => void;
  readonly inventory: () => void;
}

/** Screen controls consume world events; they never modify player coordinates. */
export class ExpeditionUI {
  public constructor(actions: ExpeditionActions) {
    document.title = 'Ashen Covenant · Забытое святилище';
    this.element('#app').innerHTML = `
      <header class="masthead expedition-masthead">
        <a class="brand" href="/" aria-label="Ashen Covenant"><span class="brand-mark">A</span><span>ASHEN<span class="brand-subtitle">COVENANT</span></span></a>
        <nav class="expedition-nav" aria-label="Разделы"><span class="active"><i class="small-diamond"></i> Святилище</span><a href="/?view=forge">Кузница ассетов</a></nav>
        <span class="connection"><span class="status-dot"></span><span data-testid="world-status">Открываем врата</span></span>
      </header>
      <main class="expedition-main">
        <section class="expedition-heading"><div><p class="eyebrow">ГЛАВА I · ПЕПЕЛЬНЫЕ ПРЕДЕЛЫ</p><h1>Забытое святилище<span class="title-dot">.</span></h1></div><p>Тьма у врат обрела плоть.<br/><span>Меч и огонь укажут дорогу.</span></p></section>
        <section class="expedition-frame" aria-label="Игровая арена">
          <div class="play-stage"><div id="game-stage"></div><div class="play-vignette"></div><div class="location-tag"><i class="small-diamond"></i><span>ДРЕВНИЕ РУИНЫ<span>Тишина перед бурей</span></span></div>
            <div class="expedition-objective"><span class="objective-symbol">I</span><div><p id="objective-heading">СТРАЖ СВЯТИЛИЩА</p><span id="objective-description">Найдите и победите хранителя</span><small id="gate-distance">Путь начинается здесь</small></div></div>
          </div>
          <div class="expedition-toolbar"><div class="traveler-state"><span class="traveler-symbol">♜</span><span>СТРАННИК<small data-testid="player-state">Покой</small></span></div><div class="movement-help"><span class="keycaps"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>движение</span><span class="help-divider"></span><span class="mouse-glyph"></span><span>выбрать путь</span></div><div class="world-controls"><button id="map-toggle" aria-label="Показать или скрыть карту" aria-pressed="true"><kbd>M</kbd> Карта</button><button id="world-reset" aria-label="Вернуться к началу"><kbd>R</kbd> К началу</button></div></div>
          <div class="combat-hud" aria-label="Бой и характеристики">
            <div class="combat-resources"><label class="resource health"><span>ЗДОРОВЬЕ <b data-testid="hero-health">160 / 160</b></span><progress id="hero-hp-bar" value="160" max="160" aria-label="Здоровье героя"></progress></label><label class="resource mana"><span>МАНА <b data-testid="hero-mana">80 / 80</b></span><progress id="hero-mana-bar" value="80" max="80" aria-label="Мана героя"></progress></label></div>
            <div class="combat-skills"><button id="melee-action" class="ability-button" aria-label="Удар мечом" title="ЛКМ по врагу — сблизиться и атаковать. Shift+ЛКМ — удар на месте."><canvas data-skill-icon="icon-sword" width="42" height="42"></canvas><span>Клинок<small>ЛКМ · УДАР</small></span></button><button id="skill-action" class="ability-button ember" aria-label="Пепельный импульс" title="Q / ПКМ · 18 маны · взрывной снаряд · перезарядка 1.4 с"><canvas data-skill-icon="projectile-ember" width="42" height="42"></canvas><span>Пепельный импульс<small><kbd>Q</kbd> <span data-testid="skill-cooldown">Готов</span></small></span></button></div>
            <div class="combat-summary"><span id="target-summary">Святилище ждёт</span><span>Противники <b data-testid="enemy-count">6</b><i></i><span id="hero-offense">Урон 26 · Броня 15</span></span></div>
          </div>
        </section>
        <div class="expedition-footnote"><p><i class="small-diamond"></i><span data-testid="destination-status" aria-live="polite">Нажмите на свободную землю, чтобы отправиться в путь.</span></p><div class="world-zoom"><span>МАСШТАБ</span><button id="zoom-out" aria-label="Отдалить">−</button><output id="world-zoom-value">100%</output><button id="zoom-in" aria-label="Приблизить">+</button></div></div>
        <div class="journey-notes"><span>МЕЧ И ПЕПЕЛ<span>ЛКМ по врагу — атака. Shift+ЛКМ — удар на месте. Q / ПКМ — взрывной снаряд.<br/>Красный круг предупреждает об ударе стража. Покиньте его, пока не стало поздно.</span></span><span class="escape-hint"><kbd>ESC</kbd> остановиться</span></div>
        <footer><span><i class="small-diamond"></i> ASHEN COVENANT <span class="footer-divider">/</span> ПУТЬ СТРАННИКА</span><span>ЗЕМЛЯ ПОМНИТ КАЖДЫЙ ШАГ</span></footer>
      </main>`;
    const inventory = document.createElement('button');
    inventory.id = 'inventory-toggle';
    inventory.setAttribute('aria-label', 'Открыть инвентарь');
    inventory.setAttribute('aria-expanded', 'false');
    inventory.innerHTML = '<kbd>I</kbd> Рюкзак <span data-testid="inventory-count">0/10</span>';
    inventory.addEventListener('click', actions.inventory);
    this.element('.world-controls').prepend(inventory);
    this.element('#world-reset').addEventListener('click', actions.reset);
    this.element('#map-toggle').addEventListener('click', actions.map);
    this.element('#zoom-in').addEventListener('click', () => this.setZoom(actions.zoom(0.1)));
    this.element('#zoom-out').addEventListener('click', () => this.setZoom(actions.zoom(-0.1)));
    this.element('#skill-action').addEventListener('click', actions.cast);
    this.element('#melee-action').addEventListener('click', actions.attack);
  }

  public ready(zoom: number, source: (key: string) => CanvasImageSource): void {
    this.element('[data-testid="world-status"]').textContent = 'Святилище открыто';
    this.setZoom(zoom);
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-skill-icon]')) {
      const key = canvas.dataset['skillIcon'];
      const context = canvas.getContext('2d');
      if (key && context) context.drawImage(source(key), 0, 0, canvas.width, canvas.height);
    }
  }

  public update(status: WorldStatus): void {
    this.element('.play-stage').classList.toggle('is-modal', status.inventoryOpen || status.outcome !== 'playing');
    this.element('#inventory-toggle').setAttribute('aria-expanded', String(status.inventoryOpen));
    this.element('[data-testid="inventory-count"]').textContent = `${status.inventoryCount}/10`;
    this.element('[data-testid="player-state"]').textContent = status.action === 'dead' ? 'Пал в бою'
      : status.action === 'attack' ? 'Атака' : status.action === 'hurt' ? 'Ранен' : status.state === 'walk' ? 'В пути' : 'Покой';
    this.element('#gate-distance').textContent = status.gateReached ? 'Вы у северных врат' : `${status.gateDistance} м до врат`;
    const combat = status.combat;
    this.element('#objective-heading').textContent = !combat.alive ? 'СТРАННИК ПАЛ' : combat.bossDefeated ? 'СТРАЖ ПОВЕРЖЕН' : 'СТРАЖ СВЯТИЛИЩА';
    this.element('#objective-description').textContent = !combat.alive ? 'Нажмите R, чтобы начать заново.'
      : combat.bossDefeated ? 'Тьма отступила. Исследуйте руины.' : 'Найдите и победите хранителя';
    this.element('[data-testid="hero-health"]').textContent = `${combat.hp} / ${combat.maxHp}`;
    this.element('[data-testid="hero-mana"]').textContent = `${combat.mana} / ${combat.maxMana}`;
    const health = this.element<HTMLProgressElement>('#hero-hp-bar');
    const mana = this.element<HTMLProgressElement>('#hero-mana-bar');
    health.max = combat.maxHp; health.value = combat.hp;
    mana.max = combat.maxMana; mana.value = combat.mana;
    this.element('[data-testid="skill-cooldown"]').textContent = combat.skillCooldown > 0 ? `${combat.skillCooldown.toFixed(1)} с` : 'Готов';
    this.element<HTMLButtonElement>('#skill-action').disabled = !combat.skillAvailable;
    this.element<HTMLButtonElement>('#melee-action').disabled = !combat.alive;
    this.element('[data-testid="enemy-count"]').textContent = String(combat.remaining);
    this.element('#hero-offense').textContent = `Урон ${combat.damage} · Броня ${combat.armor}`;
    this.element('#target-summary').textContent = combat.targetName ? `${combat.targetName} · ${combat.targetHp} / ${combat.targetMaxHp}`
      : !combat.alive ? 'R — вернуться в святилище' : combat.bossDefeated ? 'Пепельный страж повержен' : 'Меч готов. Выберите противника.';
  }

  public destination(message: string): void {
    this.element('[data-testid="destination-status"]').textContent = message;
  }

  public mapVisibility(visible: boolean): void {
    this.element('#map-toggle').setAttribute('aria-pressed', String(visible));
  }

  private setZoom(zoom: number): void {
    this.element('#world-zoom-value').textContent = `${Math.round(zoom * 100)}%`;
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing expedition UI element: ${selector}`);
    return element;
  }
}
