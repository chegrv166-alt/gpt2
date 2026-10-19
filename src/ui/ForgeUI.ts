import {
  ACTORS, ACTOR_IDS, DIRECTIONS, EFFECT_SPECS, ITEM_SPECS, PROJECTILE_SPECS,
  TERRAIN_SPECS, UI_SPECS, actorAnimationKey, actorTextureKey,
} from '../assets/catalog';
import type { ActorId, ActorState, Direction, TextureSpec } from '../assets/catalog';
import { viewHref } from './viewHref';

export interface PreviewSelection {
  actor: ActorId;
  state: ActorState;
  direction: Direction;
  zoom: number;
  paused: boolean;
}

const DIRECTION_NAMES: Readonly<Record<Direction, string>> = {
  e: 'Восток', se: 'Юго-восток', s: 'Юг', sw: 'Юго-запад',
  w: 'Запад', nw: 'Северо-запад', n: 'Север', ne: 'Северо-восток',
};

export class ForgeUI {
  private selection: PreviewSelection = { actor: 'hero', state: 'idle', direction: 'se', zoom: 160, paused: false };
  private source: ((key: string) => CanvasImageSource) | undefined;
  private catalog = 'terrain';

  public constructor(private readonly onChange: (selection: Readonly<PreviewSelection>) => void) {
    this.element<HTMLElement>('#app').innerHTML = `
      <header class="masthead">
        <a class="brand" href="${viewHref('game')}" aria-label="Ashen Covenant"><span class="brand-mark">A</span><span>ASHEN<span class="brand-subtitle">COVENANT</span></span></a>
        <div class="chapter"><span class="chapter-number">I</span> КУЗНИЦА <span class="chapter-line"></span><span class="muted">VERTICAL SLICE</span></div>
        <div class="forge-links"><a class="forge-return" href="${viewHref('game')}">В святилище →</a><span class="connection"><span class="status-dot"></span> Все ассеты включены в игру</span></div>
      </header>
      <main>
        <section class="page-heading">
          <div><p class="eyebrow">ИЗ ПЕПЛА РОЖДАЕТСЯ МИР</p><h1>Кузница ассетов<span class="title-dot">.</span></h1><p class="intro">Камень, сталь и запретное пламя. Нарисованные атласы и живой свет святилища.</p></div>
          <div class="step-seal"><span>ЭТАП</span><strong>01<span> / 04</span></strong><span>ОСНОВА МИРА</span></div>
        </section>
        <div class="workspace">
          <section class="preview-panel" aria-label="Предпросмотр ассетов">
            <div class="panel-heading"><span><i class="small-diamond"></i> СВЯТИЛИЩЕ</span><span class="muted">ИЗОМЕТРИЯ 2:1</span></div>
            <div class="stage-wrap"><div id="game-stage"></div><div class="stage-caption"><span class="tiny-rule"></span> МАСТЕРСКАЯ СПРАЙТОВ</div><span class="stage-coordinate">X 00 · Y 00</span><div class="stage-vignette"></div></div>
            <div class="preview-toolbar"><div class="live-label"><span class="status-dot"></span><span data-testid="boot-status">Создание текстур</span></div><div class="zoom-control"><label for="zoom">МАСШТАБ</label><input id="zoom" type="range" min="100" max="220" step="10" value="160"/><output id="zoom-value">160%</output></div><button id="pause" class="icon-button" aria-label="Приостановить анимацию" title="Приостановить анимацию"><span class="pause-glyph" aria-hidden="true"></span></button></div>
          </section>
          <aside class="inspector">
            <div class="inspector-top"><p class="eyebrow">ПЕРСОНАЖ / <span id="actor-number">01</span></p><span class="inspector-sigil">✧</span></div>
            <h2 data-testid="selected-actor">Странник</h2><p class="actor-role" id="actor-role"></p><p class="actor-description" id="actor-description"></p>
            <div class="section-label"><span>ВЫБРАТЬ ПЕРСОНАЖА</span><span>04</span></div>
            <div class="actor-grid">${ACTOR_IDS.map((id, index) => `<button class="actor-card${id === 'hero' ? ' selected' : ''}" data-actor="${id}" aria-pressed="${id === 'hero'}" aria-label="${ACTORS[id].name}"><span class="actor-emblem ${id}">${['♜', '♟', '✧', '♛'][index]}</span><span>${ACTORS[id].name}</span></button>`).join('')}</div>
            <div class="section-label"><span>СОСТОЯНИЕ</span><span>6 КАДРОВ ХОДЬБЫ</span></div>
            <div class="state-buttons">${([['idle', 'Покой'], ['walk', 'Бег'], ['attack', 'Атака'], ['hurt', 'Урон']] as const).map(([state, label]) => `<button data-state="${state}" class="${state === 'idle' ? 'selected' : ''}" aria-pressed="${state === 'idle'}">${label}</button>`).join('')}</div>
            <div class="section-label"><span>НАПРАВЛЕНИЕ ВЗГЛЯДА</span><span>8 СТОРОН</span></div>
            <div class="direction-control"><button id="rotate-left" aria-label="Повернуть влево">←</button><span><i class="direction-arrow" id="direction-arrow" aria-hidden="true"></i><span id="direction-name">Юго-восток</span></span><button id="rotate-right" aria-label="Повернуть вправо">→</button></div>
            <div class="texture-reference"><span>КЛЮЧ АНИМАЦИИ</span><code data-testid="current-animation">hero-idle-se</code></div>
          </aside>
        </div>
        <section class="catalog-section" aria-label="Каталог текстур">
          <div class="catalog-heading"><div><p class="eyebrow">БИБЛИОТЕКА СВЯТИЛИЩА</p><h2>Из чего соткан мир <span id="texture-count">541</span></h2></div><div class="catalog-tabs" role="group" aria-label="Категории текстур"><button data-catalog="terrain" class="selected" aria-pressed="true">Окружение <span>13</span></button><button data-catalog="actors" aria-pressed="false">Персонажи <span>512</span></button><button data-catalog="items" aria-pressed="false">Предметы <span>6</span></button><button data-catalog="effects" aria-pressed="false">Эффекты <span>16</span></button></div></div>
          <div class="asset-grid" id="asset-grid"></div>
        </section>
        <footer><span><i class="small-diamond"></i> ASHEN COVENANT <span class="footer-divider">/</span> ШАГ 1 · ПРОЦЕДУРНЫЕ АССЕТЫ</span><span id="generation-info">PHASER 3 · TYPESCRIPT · VITE</span></footer>
      </main>`;
    this.bindControls();
    this.element('[data-catalog="effects"] span').textContent = String(PROJECTILE_SPECS.length + EFFECT_SPECS.length + UI_SPECS.length);
    this.refresh();
  }

  public ready(source: (key: string) => CanvasImageSource, count: number, generationMs: number): void {
    this.source = source;
    this.element('[data-testid="boot-status"]').textContent = 'Текстуры готовы';
    this.element('#texture-count').textContent = String(count);
    this.element('#generation-info').textContent = `${count} ТЕКСТУРА · ${generationMs} МС · 0 ЗАГРУЗОК`;
    this.renderCatalog();
    this.onChange(this.selection);
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }

  private bindControls(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-actor]')) {
      button.addEventListener('click', () => {
        const actor = button.dataset['actor'];
        if (ACTOR_IDS.some((id) => id === actor)) {
          this.selection.actor = actor as ActorId;
          this.change();
        }
      });
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-state]')) {
      button.addEventListener('click', () => {
        const state = button.dataset['state'];
        if (state === 'idle' || state === 'walk' || state === 'attack' || state === 'hurt') {
          this.selection.state = state;
          this.change();
        }
      });
    }
    this.element('#rotate-left').addEventListener('click', () => this.rotate(-1));
    this.element('#rotate-right').addEventListener('click', () => this.rotate(1));
    this.element<HTMLInputElement>('#zoom').addEventListener('input', (event) => {
      this.selection.zoom = Number((event.currentTarget as HTMLInputElement).value);
      this.change();
    });
    this.element('#pause').addEventListener('click', () => {
      this.selection.paused = !this.selection.paused;
      this.change();
    });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-catalog]')) {
      button.addEventListener('click', () => {
        this.catalog = button.dataset['catalog'] ?? 'terrain';
        this.renderCatalog();
      });
    }
  }

  private rotate(step: number): void {
    const index = (DIRECTIONS.indexOf(this.selection.direction) + step + DIRECTIONS.length) % DIRECTIONS.length;
    this.selection.direction = DIRECTIONS[index] ?? 'se';
    this.change();
  }

  private change(): void {
    this.refresh();
    this.onChange(this.selection);
  }

  private refresh(): void {
    const { actor, state, direction, zoom, paused } = this.selection;
    const definition = ACTORS[actor];
    this.element('[data-testid="selected-actor"]').textContent = definition.name;
    this.element('#actor-number').textContent = String(ACTOR_IDS.indexOf(actor) + 1).padStart(2, '0');
    this.element('#actor-role').textContent = definition.role;
    this.element('#actor-description').textContent = definition.description;
    this.element('#direction-name').textContent = DIRECTION_NAMES[direction];
    this.element('#direction-arrow').style.transform = `rotate(${DIRECTIONS.indexOf(direction) * 45 + 45}deg)`;
    this.element('#zoom-value').textContent = `${zoom}%`;
    this.element('[data-testid="current-animation"]').textContent = actorAnimationKey(actor, state, direction);
    const pause = this.element<HTMLButtonElement>('#pause');
    pause.classList.toggle('is-paused', paused);
    pause.setAttribute('aria-label', paused ? 'Продолжить анимацию' : 'Приостановить анимацию');
    pause.title = pause.getAttribute('aria-label') ?? '';
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-actor], [data-state]')) {
      const selected = button.dataset['actor'] === actor || button.dataset['state'] === state;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  private renderCatalog(): void {
    if (!this.source) return;
    const source = this.source;
    const actorSpecs: TextureSpec[] = ACTOR_IDS.map((actor) => ({
      key: actorTextureKey(actor, 'idle', 'se', 0), width: ACTORS[actor].width,
      height: ACTORS[actor].height, category: 'actors',
    }));
    const specs = this.catalog === 'terrain' ? TERRAIN_SPECS
      : this.catalog === 'actors' ? actorSpecs
      : this.catalog === 'items' ? ITEM_SPECS : [...PROJECTILE_SPECS, ...EFFECT_SPECS, ...UI_SPECS];
    const grid = this.element('#asset-grid');
    grid.replaceChildren();
    for (const spec of specs) {
      const card = document.createElement('div');
      card.className = 'asset-card';
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 120;
      canvas.setAttribute('aria-label', spec.key);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is required to display the generated textures');
      const scale = Math.min(142 / spec.width, 104 / spec.height);
      context.drawImage(source(spec.key), (180 - spec.width * scale) / 2,
        (120 - spec.height * scale) / 2, spec.width * scale, spec.height * scale);
      const label = document.createElement('code');
      label.textContent = spec.key;
      const dimensions = document.createElement('span');
      dimensions.textContent = `${spec.width} × ${spec.height}`;
      card.append(canvas, label, dimensions);
      grid.append(card);
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-catalog]')) {
      const selected = button.dataset['catalog'] === this.catalog;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }
}
