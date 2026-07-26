import { BATTLE_PASS, ENEMIES, QUESTS, WEAPONS } from '../data/content';
import { ITEMS, RARITY_COLOR, RARITY_LABEL, getItem } from '../data/items';
import { getWeaponVisual } from '../data/weaponVisuals';
import { getBestiaryLore } from '../data/bestiary';
import { ACHIEVEMENTS } from '../data/achievements';
import { MAX_WEAPON_UPGRADE, RECIPES, WEAPON_UPGRADE_TIERS, upgradeDamagePct } from '../data/crafting';
import { BUILDINGS, HIDDEN_FORD, MAP_RIVER, MAP_ROADS, MAP_SHAPES, RIFT_POINTS, RIVER_BRIDGES, SECRET_POINTS, SHORTCUT_PORTALS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/world';
import { GameEvents } from '../game/events';
import type { AchievementCategory, DialoguePayload, HudSnapshot, ItemCategory, PlayerSave } from '../game/types';

const questStatusLabel: Record<string, string> = {
  available: 'Доступно', active: 'В процессе', ready: 'Можно сдать', completed: 'Завершено',
};

// Key hints for the three quick-item slots. These MUST match the physical keys
// the scenes bind (Z / X / V) — see InteriorScene.setupInput and the WorldScene
// integration note in this file's footer. Kept here so the HUD labels and the
// binding stay in one place conceptually.
const QUICK_SLOT_KEYS = ['Z', 'X', 'V'] as const;

// Progressive-reveal thresholds for the bestiary. Mirror BestiarySystem's
// constants (kept in sync by hand — the UI derives its view straight from the
// persisted kill map so it never needs a system instance).
const BESTIARY_APPEARANCE_AT = 1; // name + appearance
const BESTIARY_STATS_AT = 5; // health/damage numbers
const BESTIARY_WEAKNESS_AT = 15; // weakness hint

const achievementCategoryLabel: Record<AchievementCategory, string> = {
  kills: 'Сражения', exploration: 'Странствия', crafting: 'Ремесло', quests: 'Клятвы',
  economy: 'Богатство', skill: 'Мастерство', secret: 'Тайны',
};
const achievementCategoryOrder: AchievementCategory[] = ['kills', 'exploration', 'crafting', 'quests', 'economy', 'skill', 'secret'];

export class GameUI {
  private readonly root: HTMLElement;
  private snapshot?: HudSnapshot;
  private save?: PlayerSave;
  private activePanel?: string;
  private toastTimer?: number;
  private lootTimer?: number;
  private hurtTimer?: number;
  private joystickPointer?: number;
  private joystickCenter = { x: 0, y: 0 };
  private worldPosition = { x: 420, y: 520 };
  private reducedMotion = false;
  private listeners: Array<() => void> = [];
  // Boss fight state, retained so a `boss-health` update can redraw the same bar
  // without another `boss-engage` payload.
  private bossPhases = 1;
  private bossMaxHealth = 1;
  // Latest environment labels, surfaced in the clock/weather widget.
  private timeLabel = '';
  private weatherLabel = '';
  // Pending in-panel confirmation (e.g. reset). Rendered by renderPanel so it
  // survives HUD-driven re-renders while a panel is open.
  private pendingConfirm?: { message: string; event: string; confirmLabel: string };

  constructor() {
    const root = document.querySelector<HTMLElement>('#ui-root');
    if (!root) throw new Error('UI root not found');
    this.root = root;
  }

  mount(): void {
    this.root.innerHTML = `
      <div class="game-ui">
        <header class="hud-card player-card" aria-label="Состояние героя">
          <div class="portrait"><span>†</span></div>
          <div class="player-stats">
            <div class="stat-heading"><strong>ИЗГНАННИК</strong><span id="level-label">УР. 1</span></div>
            <div class="bar health-bar"><i id="health-fill"></i><span id="health-label">100 / 100</span></div>
            <div class="bar xp-bar"><i id="xp-fill"></i></div>
          </div>
        </header>

        <div class="currency-stack">
          <div class="currency"><span class="coin-glyph">◆</span><strong id="coins-label">0</strong></div>
          <div class="currency rep"><span>✦</span><strong id="rep-label">0</strong></div>
        </div>

        <section class="hud-card quest-tracker" id="quest-tracker" aria-live="polite">
          <span class="eyebrow">ТЕКУЩАЯ ЦЕЛЬ</span>
          <strong id="quest-title">Найдите свою клятву</strong>
          <p id="quest-objective">Поговорите с Сестрой Морой у дома.</p>
          <div class="quest-progress"><i id="quest-progress-fill"></i></div>
        </section>

        <aside class="minimap-wrap" aria-label="Мини-карта">
          <div class="minimap">
            ${this.mapSvg(true)}
            <span class="mini-player" id="mini-player"></span>
          </div>
          <span class="location-name" id="location-label">ДОМ ИЗГНАННИКА</span>
          <div class="env-widget" id="env-widget" aria-label="Время суток и погода" title="Время суток и погода">
            <span class="env-icon" id="env-icon">☾</span>
            <span class="env-labels"><b id="env-time">—</b><small id="env-weather">—</small></span>
          </div>
        </aside>

        <div class="boss-bar" id="boss-bar" aria-hidden="true" role="status">
          <div class="boss-heading"><span class="boss-eyebrow">ВЛАДЫКА ДОЛИНЫ</span><strong id="boss-name">Босс</strong></div>
          <div class="boss-track"><i id="boss-fill"></i><span class="boss-segments" id="boss-segments"></span></div>
        </div>

        <nav class="quick-nav" aria-label="Игровые меню">
          <button data-panel="journal"><span>Q</span>Задания</button>
          <button data-panel="inventory"><span>I</span>Инвентарь</button>
          <button data-panel="craft"><span>C</span>Ремесло</button>
          <button data-panel="bestiary"><span>K</span>Бестиарий</button>
          <button data-panel="achievements"><span>J</span>Награды</button>
          <button data-panel="map"><span>M</span>Карта</button>
          <button data-panel="pass"><span>B</span>Пропуск</button>
          <button data-panel="shop"><span>◆</span>Магазин</button>
          <button data-panel="pause"><span>Esc</span>Меню</button>
        </nav>

        <div class="weapon-slot" id="weapon-slot">
          <span id="weapon-icon">⚔</span>
          <div><small id="weapon-meta">MELEE • УРОН 24</small><strong id="weapon-name">Ржавый клинок</strong></div>
          <kbd id="weapon-key">1</kbd>
        </div>
        <div class="weapon-hotbar" id="weapon-hotbar" aria-label="Быстрый выбор оружия"></div>
        <button class="potion-slot" id="potion-button" aria-label="Использовать зелье"><span>♥</span><strong id="potion-count">2</strong><kbd>F</kbd></button>
        <div class="quick-slots" id="quick-slots" aria-label="Быстрые предметы"></div>
        <div class="ability-bar">
          <button class="ability-slot dash ready" data-ui-ability="dash" aria-label="Рывок"><span>➤</span><small>РЫВОК</small><kbd>SHIFT</kbd><b id="dash-cooldown"></b></button>
          <button class="ability-slot special ready" data-ui-ability="special" aria-label="Особая способность"><span>✦</span><small>ОСОБАЯ</small><kbd>R</kbd><b id="special-cooldown"></b></button>
        </div>

        <div class="interaction-prompt" id="interaction-prompt"><kbd>E</kbd><span id="interaction-text">Говорить</span></div>
        <div class="tutorial-tip" id="tutorial-tip"><span class="tutorial-step">ОБУЧЕНИЕ 1/5</span><strong>Начните путь</strong><p>Используйте WASD или левый стик, чтобы двигаться.</p></div>
        <div class="toast" id="toast" role="status"></div>
        <div class="loot-banner" id="loot-banner" role="status"><span id="loot-icon">◆</span><div><small>ПОЛУЧЕНО</small><strong id="loot-name">Предмет</strong></div><b id="loot-quantity">+1</b></div>
        <div class="combo-banner" id="combo-banner"><strong id="combo-hits">2</strong><div><span>СЕРИЯ</span><b id="combo-multiplier">×1.03</b></div></div>
        <div class="rift-banner" id="rift-banner"><span>✦</span><div><small>РАЗЛОМ ДОЛИНЫ</small><strong id="rift-name">Разлом</strong><p id="rift-progress">Волна 1 • осталось 3</p></div></div>

        <div class="mobile-controls" aria-label="Сенсорное управление">
          <div class="joystick" id="joystick"><span id="joystick-stick"></span></div>
          <div class="mobile-actions">
            <button class="mobile-button heal" data-mobile-action="heal" aria-label="Зелье">♥</button>
            <button class="mobile-button dash" data-mobile-action="dash" aria-label="Рывок">➤</button>
            <button class="mobile-button special" data-mobile-action="special" aria-label="Особая способность">✦</button>
            <button class="mobile-button interact" data-mobile-action="interact" aria-label="Взаимодействие">E</button>
            <button class="mobile-button attack" data-mobile-action="attack" aria-label="Атака">⚔</button>
          </div>
        </div>

        <div class="screen-panel" id="screen-panel" aria-hidden="true">
          <button class="panel-backdrop" data-close-panel aria-label="Закрыть меню"></button>
          <section class="panel-shell" role="dialog" aria-modal="true">
            <header><div><span class="eyebrow" id="panel-eyebrow">TRUPY</span><h2 id="panel-title">Меню</h2></div><button class="close-button" data-close-panel aria-label="Закрыть">×</button></header>
            <div class="panel-content" id="panel-content"></div>
          </section>
        </div>

        <div class="dialogue-layer" id="dialogue-layer" aria-hidden="true">
          <section class="dialogue-card">
            <div class="dialogue-portrait" id="dialogue-portrait">†</div>
            <div class="dialogue-copy"><span class="eyebrow" id="dialogue-subtitle">ЖИТЕЛЬ ДОЛИНЫ</span><h3 id="dialogue-speaker">Сестра Мора</h3><p id="dialogue-text"></p><div class="dialogue-actions" id="dialogue-actions"></div></div>
          </section>
        </div>

        <div class="hurt-vignette" id="hurt-vignette" aria-hidden="true"></div>
        <div class="death-screen" id="death-screen" aria-hidden="true"><div><span>ПОГИБЕЛЬ — НЕ КОНЕЦ</span><h2>Долина вернула вас домой</h2><p>Часть золота потеряна, но клятва остаётся.</p><button id="respawn-button">ВОЗРОДИТЬСЯ</button></div></div>
        <div class="ending-screen" id="ending-screen" aria-hidden="true"><div class="ending-sigil">✺</div><span>ГЛАВА II ЗАВЕРШЕНА</span><h2>Пепельная корона разбита</h2><p>Безымянная пала, Чёрная топь открыла свои тайны, а огонь цитадели больше не пожирает Долину.</p><div class="ending-stats" id="ending-stats"></div><button data-ending-close>ПРОДОЛЖИТЬ ИССЛЕДОВАНИЕ</button></div>
      </div>
    `;
    this.bindDomEvents();
    this.bindGameEvents();
  }

  destroy(): void {
    this.listeners.forEach((dispose) => dispose());
    this.listeners = [];
    this.root.innerHTML = '';
  }

  updateWorldPosition(x: number, y: number): void {
    this.worldPosition = { x, y };
    const marker = this.root.querySelector<HTMLElement>('#mini-player');
    if (marker) {
      marker.style.left = `${Math.max(3, Math.min(97, x / WORLD_WIDTH * 100))}%`;
      marker.style.top = `${Math.max(4, Math.min(96, y / WORLD_HEIGHT * 100))}%`;
    }
    const mapMarker = this.root.querySelector<HTMLElement>('#map-player');
    if (mapMarker) {
      mapMarker.style.left = `${x / WORLD_WIDTH * 100}%`;
      mapMarker.style.top = `${y / WORLD_HEIGHT * 100}%`;
    }
  }

  setPrompt(text?: string): void {
    const prompt = this.root.querySelector<HTMLElement>('#interaction-prompt');
    const label = this.root.querySelector<HTMLElement>('#interaction-text');
    if (!prompt || !label) return;
    if (text) {
      label.textContent = text;
      this.positionPrompt();
      prompt.classList.add('visible');
    } else prompt.classList.remove('visible');
  }

  // Anchor the interaction prompt just above the actual weapon hotbar instead of
  // a hardcoded offset, so it tracks the hotbar across breakpoints and safe-area
  // insets. Falls back to the CSS default if the hotbar isn't laid out yet.
  private positionPrompt(): void {
    const prompt = this.root.querySelector<HTMLElement>('#interaction-prompt');
    const hotbar = this.root.querySelector<HTMLElement>('#weapon-hotbar');
    if (!prompt || !hotbar) return;
    const hotbarRect = hotbar.getBoundingClientRect();
    if (hotbarRect.height === 0) { prompt.style.removeProperty('bottom'); return; }
    const gap = 14;
    prompt.style.bottom = `${Math.round(window.innerHeight - hotbarRect.top + gap)}px`;
  }

  private on<T>(event: string, callback: (payload: T) => void): void {
    GameEvents.on(event, callback);
    this.listeners.push(() => GameEvents.off(event, callback));
  }

  private bindGameEvents(): void {
    this.on<{ snapshot: HudSnapshot; save: PlayerSave }>('hud', ({ snapshot, save }) => {
      this.snapshot = snapshot;
      this.save = save;
      this.renderHud();
      if (this.activePanel) this.renderPanel(this.activePanel);
    });
    this.on<string>('toast', (message) => this.showToast(message));
    this.on<{ itemId: string; quantity: number }>('loot', (loot) => this.showLoot(loot.itemId, loot.quantity));
    this.on<{ hits: number; multiplier: number }>('combo', ({ hits, multiplier }) => this.showCombo(hits, multiplier));
    this.on<{ dash: number; dashMax?: number; special: number; specialMax?: number }>('ability-cooldown', (cd) => this.showAbilityCooldown(cd.dash, cd.special, cd.dashMax, cd.specialMax));
    this.on<{ name: string; wave: number; remaining: number } | null>('rift-status', (status) => this.showRiftStatus(status));
    this.on<{ name: string; maxHealth: number; phases?: number }>('boss-engage', (payload) => this.showBossEngage(payload));
    this.on<{ health: number; phase?: number }>('boss-health', (payload) => this.showBossHealth(payload));
    this.on<void>('boss-defeated', () => this.hideBoss());
    this.on<{ time?: string; weather?: string }>('environment', (env) => this.showEnvironment(env));
    this.on<{ severity?: number }>('player-hurt', ({ severity }) => this.showHurt(severity ?? 1));
    this.on<string>('location', (location) => {
      const label = this.root.querySelector('#location-label');
      if (label) label.textContent = location.toUpperCase();
    });
    this.on<{ step: number; title: string; text: string } | null>('tutorial', (tip) => this.showTutorial(tip));
    this.on<DialoguePayload>('dialogue', (payload) => this.showDialogue(payload));
    this.on<void>('dialogue-close', () => this.closeDialogue());
    this.on<string>('panel-open', (panel) => this.openPanel(panel));
    this.on<void>('death', () => this.showDeath());
    this.on<{ playtime: number; level: number; reputation: number }>('ending', (data) => this.showEnding(data));
    this.on<{ text?: string }>('prompt', ({ text }) => this.setPrompt(text));
  }

  private bindDomEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-panel]').forEach((button) => {
      button.addEventListener('click', () => this.openPanel(button.dataset.panel!));
    });
    this.root.querySelectorAll<HTMLElement>('[data-close-panel]').forEach((button) => button.addEventListener('click', () => this.closePanel()));
    this.root.querySelector('#potion-button')?.addEventListener('click', () => GameEvents.emit('ui-heal'));
    this.root.querySelectorAll<HTMLElement>('[data-ui-ability]').forEach((button) => button.addEventListener('click', () => GameEvents.emit(button.dataset.uiAbility === 'dash' ? 'ui-dash' : 'ui-special')));
    this.root.querySelector('#respawn-button')?.addEventListener('click', () => {
      this.root.querySelector('#death-screen')?.setAttribute('aria-hidden', 'true');
      GameEvents.emit('respawn');
    });
    this.root.querySelector('[data-ending-close]')?.addEventListener('click', () => {
      this.root.querySelector('#ending-screen')?.setAttribute('aria-hidden', 'true');
      GameEvents.emit('ui-lock', false);
    });
    this.root.querySelectorAll<HTMLElement>('[data-mobile-action]').forEach((button) => {
      const event = button.dataset.mobileAction;
      button.addEventListener('pointerdown', (pointer) => {
        pointer.preventDefault();
        if (event === 'attack') GameEvents.emit('ui-attack');
        if (event === 'interact') GameEvents.emit('ui-interact');
        if (event === 'heal') GameEvents.emit('ui-heal');
        if (event === 'dash') GameEvents.emit('ui-dash');
        if (event === 'special') GameEvents.emit('ui-special');
      });
    });
    this.bindJoystick();
    // Keep the interaction prompt anchored to the hotbar across resizes and
    // orientation changes. Disposed on destroy alongside the game listeners.
    const onResize = () => { if (this.root.querySelector('#interaction-prompt')?.classList.contains('visible')) this.positionPrompt(); };
    window.addEventListener('resize', onResize);
    this.listeners.push(() => window.removeEventListener('resize', onResize));
  }

  private bindJoystick(): void {
    const joystick = this.root.querySelector<HTMLElement>('#joystick');
    const stick = this.root.querySelector<HTMLElement>('#joystick-stick');
    if (!joystick || !stick) return;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointer) return;
      const dx = event.clientX - this.joystickCenter.x;
      const dy = event.clientY - this.joystickCenter.y;
      const length = Math.hypot(dx, dy);
      const max = 38;
      const scale = length > max ? max / length : 1;
      const x = dx * scale;
      const y = dy * scale;
      stick.style.transform = `translate(${x}px, ${y}px)`;
      GameEvents.emit('ui-move', { x: x / max, y: y / max });
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = undefined;
      stick.style.transform = 'translate(0, 0)';
      GameEvents.emit('ui-move', { x: 0, y: 0 });
    };
    joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const rect = joystick.getBoundingClientRect();
      this.joystickPointer = event.pointerId;
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      joystick.setPointerCapture(event.pointerId);
      move(event);
    });
    joystick.addEventListener('pointermove', move);
    joystick.addEventListener('pointerup', end);
    joystick.addEventListener('pointercancel', end);
  }

  private renderHud(): void {
    if (!this.snapshot || !this.save) return;
    const { snapshot } = this;
    this.text('#level-label', `УР. ${snapshot.level}`);
    this.text('#health-label', `${Math.ceil(snapshot.health)} / ${snapshot.maxHealth}`);
    this.width('#health-fill', snapshot.health / snapshot.maxHealth * 100);
    this.width('#xp-fill', snapshot.xp / snapshot.xpNext * 100);
    this.text('#coins-label', snapshot.coins.toString());
    this.text('#rep-label', snapshot.reputation.toString());
    this.text('#potion-count', snapshot.potions.toString());
    const weapon = WEAPONS.find((item) => item.id === snapshot.equippedWeapon) ?? WEAPONS[0];
    this.text('#weapon-icon', weapon.icon);
    this.text('#weapon-name', weapon.name);
    this.text('#weapon-meta', `${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}`);
    this.text('#weapon-key', String(Math.max(1, WEAPONS.findIndex((entry) => entry.id === weapon.id) + 1)));
    this.renderWeaponHotbar(snapshot);
    this.renderQuickSlots(snapshot);
    const weaponSlot = this.root.querySelector<HTMLElement>('#weapon-slot');
    if (weaponSlot) weaponSlot.style.setProperty('--weapon-accent', weapon.accent);
    const tracker = this.root.querySelector<HTMLElement>('#quest-tracker');
    if (snapshot.activeQuest) {
      this.text('#quest-title', snapshot.activeQuest.title);
      this.text('#quest-objective', snapshot.activeQuest.ready ? 'Вернитесь к заказчику за наградой' : `${snapshot.activeQuest.objective} — ${snapshot.activeQuest.amount}/${snapshot.activeQuest.required}`);
      this.width('#quest-progress-fill', snapshot.activeQuest.ready ? 100 : snapshot.activeQuest.amount / snapshot.activeQuest.required * 100);
      tracker?.classList.toggle('ready', snapshot.activeQuest.ready);
    } else {
      this.text('#quest-title', snapshot.tutorialDone ? 'Свободное исследование' : 'Найдите свою клятву');
      this.text('#quest-objective', snapshot.tutorialDone ? 'Поговорите с жителями Долины.' : 'Завершите короткое обучение у дома.');
      this.width('#quest-progress-fill', 0);
      tracker?.classList.remove('ready');
    }
  }

  private renderWeaponHotbar(snapshot: HudSnapshot): void {
    const hotbar = this.root.querySelector<HTMLElement>('#weapon-hotbar');
    if (!hotbar) return;
    hotbar.innerHTML = WEAPONS.map((weapon, index) => {
      const owned = snapshot.ownedWeapons.includes(weapon.id);
      const active = snapshot.equippedWeapon === weapon.id;
      const visual = getWeaponVisual(weapon.id);
      return `<button class="hotbar-weapon ${owned ? 'owned' : 'locked'} ${active ? 'active' : ''}" data-hotbar-weapon="${owned ? weapon.id : ''}" style="--weapon-color:${weapon.accent}" ${owned ? '' : 'disabled'} title="${weapon.name} • ${visual.bonusLabel}"><kbd>${index + 1}</kbd><span>${weapon.icon}</span><small>${owned ? weapon.damage : `◆${weapon.price}`}</small></button>`;
    }).join('');
    hotbar.querySelectorAll<HTMLElement>('[data-hotbar-weapon]').forEach((button) => {
      if (button.dataset.hotbarWeapon) button.addEventListener('click', () => GameEvents.emit('equip', button.dataset.hotbarWeapon));
    });
    hotbar.querySelector('.hotbar-weapon.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /**
   * The quick-item bar: 3 slots bound to consumables via the inventory panel and
   * fired with Z / X / V (or a tap). Each slot shows the item's icon and how many
   * remain (from the live inventory), greys out when the item is exhausted, and
   * reads "empty" when nothing is bound. Clicking a filled slot uses it; clicking
   * an empty one opens the inventory so the player can assign something.
   */
  private renderQuickSlots(snapshot: HudSnapshot): void {
    const container = this.root.querySelector<HTMLElement>('#quick-slots');
    if (!container) return;
    const quick = snapshot.equipment.quick ?? [];
    container.innerHTML = QUICK_SLOT_KEYS.map((key, index) => {
      const itemId = quick[index] ?? null;
      const item = itemId ? getItem(itemId) : undefined;
      const count = item ? snapshot.inventory.filter((stack) => stack.itemId === item.id).reduce((sum, stack) => sum + stack.quantity, 0) : 0;
      const empty = !item;
      const exhausted = Boolean(item) && count <= 0;
      return `<button class="quick-slot ${empty ? 'empty' : ''} ${exhausted ? 'exhausted' : ''}" data-quick-slot="${index}" style="--rarity:${item ? RARITY_COLOR[item.rarity] : '#4a4d5a'}" title="${item ? `${item.name} • Z/X/V` : 'Пустая ячейка — назначьте расходник в инвентаре'}" aria-label="${item ? item.name : 'Пустая ячейка'}"><kbd>${key}</kbd><span>${item ? item.icon : '+'}</span><small>${empty ? '' : count}</small></button>`;
    }).join('');
    container.querySelectorAll<HTMLElement>('[data-quick-slot]').forEach((button) => {
      const index = Number(button.dataset.quickSlot);
      button.addEventListener('click', () => {
        const bound = (snapshot.equipment.quick ?? [])[index] ?? null;
        if (bound) GameEvents.emit('use-quick-slot', index);
        else this.openPanel('inventory');
      });
    });
  }

  private openPanel(panel: string): void {
    if (this.activePanel === panel) return this.closePanel();
    this.closeDialogue();
    this.activePanel = panel;
    const layer = this.root.querySelector<HTMLElement>('#screen-panel');
    layer?.setAttribute('aria-hidden', 'false');
    this.renderPanel(panel);
    GameEvents.emit('ui-lock', true);
  }

  private closePanel(): void {
    this.activePanel = undefined;
    this.pendingConfirm = undefined;
    this.root.querySelector('#screen-panel')?.setAttribute('aria-hidden', 'true');
    GameEvents.emit('ui-lock', false);
  }

  private renderPanel(panel: string): void {
    const title = this.root.querySelector('#panel-title');
    const eyebrow = this.root.querySelector('#panel-eyebrow');
    const content = this.root.querySelector<HTMLElement>('#panel-content');
    if (!title || !eyebrow || !content) return;
    const renderers: Record<string, () => string> = {
      journal: () => this.journalHtml(),
      inventory: () => this.inventoryHtml(),
      map: () => this.mapHtml(),
      pass: () => this.passHtml(),
      pause: () => this.pauseHtml(),
      shop: () => this.shopHtml(),
      chest: () => this.chestHtml(),
      craft: () => this.craftHtml(),
      bestiary: () => this.bestiaryHtml(),
      achievements: () => this.achievementsHtml(),
    };
    const labels: Record<string, [string, string]> = {
      journal: ['ЖУРНАЛ', 'Задания'], inventory: ['СУМКА ИЗГНАННИКА', 'Инвентарь'], map: ['ДОЛИНА МЁРТВЫХ', 'Карта'],
      pass: ['СЕЗОН II • БЕСПЛАТНО', 'Путь изгнанника'], pause: ['TRUPY', 'Пауза'], shop: ['КУЗНИЦА РУНЫ', 'Магазин оружия'], chest: ['ДОМ ИЗГНАННИКА', 'Домашний сундук'],
      craft: ['МАСТЕРСКАЯ И КУЗНИЦА', 'Ремесло'], bestiary: ['ЛЕТОПИСЬ ДОЛИНЫ', 'Бестиарий'], achievements: ['ПУТЬ ИЗГНАННИКА', 'Награды'],
    };
    [eyebrow.textContent, title.textContent] = labels[panel] ?? ['TRUPY', 'Меню'];
    content.innerHTML = (renderers[panel] ?? renderers.pause)() + this.confirmHtml();
    this.bindPanelActions();
    this.updateWorldPosition(this.worldPosition.x, this.worldPosition.y);
  }

  private journalHtml(): string {
    const quests = this.snapshot?.quests ?? [];
    return `<div class="panel-intro"><p>Контракты меняют Долину. Основная цепочка отмечена алым, побочные поручения — серебром.</p></div><div class="quest-list">${quests.map((quest) => `
      <article class="quest-row ${quest.category} ${quest.status}">
        <div class="quest-emblem">${quest.category === 'main' ? '†' : '•'}</div><div><span>${quest.category === 'main' ? 'КЛЯТВА' : 'КОНТРАКТ'} • ${questStatusLabel[quest.status]}</span><h3>${quest.title}</h3>
        ${quest.objective ? `<p>${quest.objective}${quest.required ? ` — ${quest.amount ?? 0}/${quest.required}` : ''}</p>` : '<p>Поговорите с заказчиком, чтобы узнать подробности.</p>'}</div>
      </article>`).join('') || '<div class="empty-state">Новые контракты появятся после обучения.</div>'}</div>`;
  }

  private inventoryHtml(): string {
    const snapshot = this.snapshot;
    if (!snapshot) return '<div class="empty-state">Инвентарь загружается…</div>';
    const equippedArmor = getItem(snapshot.equipment.armor ?? '');
    const equippedAmulet = getItem(snapshot.equipment.amulet ?? '');
    const equippedWeapon = WEAPONS.find((weapon) => weapon.id === snapshot.equippedWeapon) ?? WEAPONS[0];
    const itemStacks = snapshot.inventory
      .map((stack) => ({ stack, item: getItem(stack.itemId) }))
      .filter((entry): entry is { stack: { itemId: string; quantity: number }; item: NonNullable<ReturnType<typeof getItem>> } => Boolean(entry.item));
    return `<div class="inventory-layout">
      <aside class="equipment-paperdoll">
        <span class="eyebrow">ЭКИПИРОВКА</span><div class="paperdoll-silhouette">†</div>
        <div class="equipment-slot weapon"><small>ОРУЖИЕ</small><b>${equippedWeapon.icon} ${equippedWeapon.name}</b></div>
        <div class="equipment-slot armor"><small>БРОНЯ</small><b>${equippedArmor ? `${equippedArmor.icon} ${equippedArmor.name}` : '— Пусто —'}</b></div>
        <div class="equipment-slot amulet"><small>АМУЛЕТ</small><b>${equippedAmulet ? `${equippedAmulet.icon} ${equippedAmulet.name}` : '— Пусто —'}</b></div>
        <div class="equipment-stats"><span>Защита <b>+${equippedArmor?.armor ?? 0}</b></span><span>Урон <b>+${equippedAmulet?.damageBonus ?? 0}</b></span><span>Скорость <b>+${equippedAmulet?.speedBonus ?? 0}</b></span></div>
      </aside>
      <section class="inventory-bag">
        <div class="panel-intro split"><p>Экипируйте броню и амулеты, используйте расходники и собирайте материалы для будущих улучшений.</p><div class="bag-meta"><span>◆ ${snapshot.coins}</span><span>${snapshot.inventory.reduce((sum, stack) => sum + stack.quantity, 0)} предметов</span></div></div>
        <h3 class="inventory-section-title">Оружие</h3><div class="inventory-grid weapons">${WEAPONS.filter((weapon) => snapshot.ownedWeapons.includes(weapon.id)).map((weapon) => this.weaponInventoryCard(weapon.id)).join('')}</div>
        <h3 class="inventory-section-title">Содержимое сумки</h3><div class="inventory-grid">${itemStacks.map(({ stack, item }) => this.itemInventoryCard(item.id, stack.quantity)).join('') || '<div class="empty-state">Сумка пуста</div>'}</div>
      </section>
    </div>`;
  }

  private weaponInventoryCard(weaponId: string): string {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId)!;
    const equipped = this.snapshot?.equippedWeapon === weapon.id;
    return `<article class="inventory-item weapon-item ${equipped ? 'equipped' : ''}" style="--rarity:${weapon.accent}"><div class="item-icon">${weapon.icon}</div><div class="item-copy"><small>${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}</small><b>${weapon.name}</b><p>${weapon.description}</p></div><button data-equip="${weapon.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'НАДЕТО' : 'ЭКИПИРОВАТЬ'}</button></article>`;
  }

  private itemInventoryCard(itemId: string, quantity: number, chest = false, allowStore = false): string {
    const item = getItem(itemId);
    if (!item) return '';
    const equipped = this.snapshot?.equipment.armor === itemId || this.snapshot?.equipment.amulet === itemId;
    const primary = chest ? '' : item.category === 'consumable'
      ? `<button data-use-item="${itemId}">ИСПОЛЬЗОВАТЬ</button>`
      : item.category === 'armor' || item.category === 'amulet'
        ? `<button data-equip-item="${itemId}" ${equipped ? 'disabled' : ''}>${equipped ? 'НАДЕТО' : 'ЭКИПИРОВАТЬ'}</button>`
        : '';
    const transfer = chest
      ? `<button class="subtle" data-transfer-item="${itemId}" data-direction="toInventory">В СУМКУ</button>`
      : allowStore && item.category !== 'quest' ? `<button class="subtle" data-transfer-item="${itemId}" data-direction="toChest">В СУНДУК</button>` : '';
    // Consumables can be bound to the 3 quick slots (Z/X/V). A compact assign row
    // shows which slot (if any) currently holds this item and lets the player bind
    // it to any of the three. Only shown in the bag, not the chest view.
    const assign = !chest && item.category === 'consumable' ? this.quickAssignRow(itemId) : '';
    return `<article class="inventory-item ${equipped ? 'equipped' : ''}" style="--rarity:${RARITY_COLOR[item.rarity]}"><div class="item-icon">${item.icon}<em>${quantity > 1 ? quantity : ''}</em></div><div class="item-copy"><small>${RARITY_LABEL[item.rarity]} • ${this.categoryLabel(item.category)}</small><b>${item.name}</b><p>${item.description}</p>${assign}</div><div class="item-actions">${primary}${transfer}</div></article>`;
  }

  /**
   * The "bind to quick slot" control shown under a consumable in the bag. Renders
   * three tiny toggles (Z/X/V); the one currently holding this item is marked
   * active and, when clicked, clears the binding — so it doubles as unbind.
   */
  private quickAssignRow(itemId: string): string {
    const quick = this.snapshot?.equipment.quick ?? [];
    const buttons = QUICK_SLOT_KEYS.map((key, index) => {
      const active = quick[index] === itemId;
      return `<button class="quick-assign-btn ${active ? 'active' : ''}" data-quick-assign="${itemId}" data-slot="${index}" title="${active ? 'Убрать из ячейки' : `Назначить на ячейку ${key}`}" aria-pressed="${active}">${key}</button>`;
    }).join('');
    return `<div class="quick-assign"><small>Быстрая ячейка</small><div class="quick-assign-row">${buttons}</div></div>`;
  }

  private chestHtml(): string {
    const inventory = this.snapshot?.inventory ?? [];
    const chest = this.snapshot?.chest ?? [];
    return `<div class="chest-layout"><section><span class="eyebrow">ВАША СУМКА</span><h3>Перенести в сундук</h3><div class="inventory-grid compact">${inventory.map((stack) => this.itemInventoryCard(stack.itemId, stack.quantity, false, true)).join('') || '<div class="empty-state">Сумка пуста</div>'}</div></section><div class="chest-divider">⇄</div><section><span class="eyebrow">ХРАНИЛИЩЕ</span><h3>Домашний сундук</h3><div class="inventory-grid compact">${chest.map((stack) => this.itemInventoryCard(stack.itemId, stack.quantity, true)).join('') || '<div class="empty-state">Сундук пуст</div>'}</div></section></div>`;
  }

  private categoryLabel(category: Exclude<ItemCategory, 'weapon'>): string {
    return { armor: 'Броня', amulet: 'Амулет', consumable: 'Расходник', material: 'Материал', quest: 'Задание' }[category];
  }

  private shopHtml(): string {
    const owned = this.snapshot?.ownedWeapons ?? [];
    const current = WEAPONS.find((weapon) => weapon.id === this.snapshot?.equippedWeapon) ?? WEAPONS[0];
    return `<div class="shop-header"><div><span class="eyebrow">ОРУЖЕЙНАЯ РУНЫ</span><h3>Золото решает. Репутация открывает редкости.</h3><p>Сравните урон, скорость, дистанцию и преимущество против разных врагов.</p></div><div class="shop-wallet"><small>ВАШЕ ЗОЛОТО</small><strong>◆ ${this.snapshot?.coins ?? 0}</strong></div></div><div class="weapon-grid shop-grid">${WEAPONS.filter((weapon) => weapon.price > 0).map((weapon) => {
      const isOwned = owned.includes(weapon.id);
      const locked = (this.snapshot?.reputation ?? 0) < weapon.requiredRep;
      const affordable = (this.snapshot?.coins ?? 0) >= weapon.price;
      const visual = getWeaponVisual(weapon.id);
      const delta = weapon.damage - current.damage;
      return `<article class="weapon-card shop-weapon ${isOwned ? 'owned' : ''}" style="--accent:${weapon.accent}"><div class="weapon-art">${weapon.icon}</div><span>${weapon.kind.toUpperCase()} • ${visual.bonusLabel}</span><h3>${weapon.name}</h3><p>${weapon.description}</p><div class="compare-grid"><span>Урон <b>${weapon.damage}</b><em class="${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${delta}</em></span><span>Скорость <b>${(1000 / weapon.cooldown).toFixed(1)}/с</b></span><span>Дистанция <b>${weapon.range}</b></span><span>Требование <b>Реп. ${weapon.requiredRep}</b></span></div><div class="weapon-meta"><b>◆ ${weapon.price}</b><small>${isOwned ? 'В КОЛЛЕКЦИИ' : locked ? 'НЕДОСТАТОЧНО РЕПУТАЦИИ' : affordable ? 'ДОСТУПНО' : 'НЕ ХВАТАЕТ ЗОЛОТА'}</small></div><button data-buy="${weapon.id}" ${isOwned || locked || !affordable ? 'disabled' : ''}>${isOwned ? 'КУПЛЕНО' : locked ? `НУЖНА РЕП. ${weapon.requiredRep}` : !affordable ? `НУЖНО ◆ ${weapon.price}` : `КУПИТЬ ЗА ◆ ${weapon.price}`}</button>${isOwned ? `<button class="subtle-equip" data-equip="${weapon.id}" ${this.snapshot?.equippedWeapon === weapon.id ? 'disabled' : ''}>${this.snapshot?.equippedWeapon === weapon.id ? 'ЭКИПИРОВАНО' : 'ЭКИПИРОВАТЬ'}</button>` : ''}</article>`;
    }).join('')}</div>`;
  }

  private passHtml(): string {
    const reputation = this.snapshot?.reputation ?? 0;
    const claimed = this.snapshot?.claimedTiers ?? [];
    return `<div class="pass-hero"><div><span>СЕЗОН I</span><h3>Путь изгнанника</h3><p>Все награды бесплатны. Выполняйте задания и повышайте репутацию.</p></div><div class="rep-orb"><strong>${reputation}</strong><small>РЕПУТАЦИЯ</small></div></div><div class="pass-track">${BATTLE_PASS.map((tier) => {
      const unlocked = reputation >= tier.reputation;
      const isClaimed = claimed.includes(tier.tier);
      return `<article class="pass-tier ${unlocked ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''}"><div class="tier-number">${tier.tier}</div><div class="tier-reward">${tier.weapon ? '✺' : tier.potions ? '♥' : '◆'}</div><h4>${tier.rewardLabel}</h4><small>${isClaimed ? 'ПОЛУЧЕНО' : `НУЖНО ${tier.reputation} РЕП.`}</small><button data-claim="${tier.tier}" ${!unlocked || isClaimed ? 'disabled' : ''}>${isClaimed ? '✓' : 'ЗАБРАТЬ'}</button></article>`;
    }).join('')}</div>`;
  }

  private mapHtml(): string {
    const env = [this.timeLabel, this.weatherLabel].filter(Boolean).join(' • ') || '—';
    return `<div class="map-toolbar"><span class="eyebrow">КАРТА ДОЛИНЫ</span><span class="map-env" id="map-env">${env}</span></div><div class="world-map vector-map">${this.mapSvg(false)}<span class="map-player" id="map-player"><i></i>ВЫ</span></div><div class="map-legend"><span><i class="safe"></i> Безопасная зона</span><span><i class="danger"></i> Опасная зона</span><span><b>▤</b> Интерьер</span><span><b>✦</b> Разлом</span><span><b>╫</b> Мост</span><span><b>◈</b> Тайна</span><span><b>†</b> Цель</span></div>`;
  }

  /** Radial-gradient + texture defs, keyed by danger, so regions aren't flat. */
  private mapDefs(): string {
    // One soft radial per danger tier (lit centre, darker rim) plus a faint
    // fractal-noise turbulence used as a ground-texture overlay on each region.
    const grads = [
      { id: 'mapg0', a: '#61684f', b: '#3f4436' },
      { id: 'mapg1', a: '#3f5f52', b: '#25382f' },
      { id: 'mapg2', a: '#5b4a62', b: '#332a3c' },
      { id: 'mapg3', a: '#74434b', b: '#3c2329' },
    ].map((g) => `<radialGradient id="${g.id}" cx="38%" cy="32%" r="80%"><stop offset="0%" stop-color="${g.a}"></stop><stop offset="100%" stop-color="${g.b}"></stop></radialGradient>`).join('');
    const texture = `<filter id="map-grain" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n"></feTurbulence><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"></feColorMatrix><feComposite operator="in" in2="SourceGraphic"></feComposite></filter>`;
    return `<defs>${grads}${texture}</defs>`;
  }

  private mapSvg(mini: boolean): string {
    const discovered = new Set(this.snapshot?.discoveredLocations ?? ['home', 'village']);
    const foundSecrets = new Set(this.snapshot?.discoveredSecrets ?? []);
    const defs = mini ? '' : this.mapDefs();
    const river = `<polygon class="map-vector-river" points="${MAP_RIVER}"></polygon>`;
    const roads = MAP_ROADS.map((road) => `<polyline class="map-vector-road" points="${road.map(([x,y]) => `${x},${y}`).join(' ')}"></polyline>`).join('');
    const regions = MAP_SHAPES.map((shape) => {
      const known = discovered.has(shape.id);
      const classes = `map-zone map-region danger-${shape.danger} ${known ? 'discovered' : 'undiscovered'}`;
      // Discovered regions get a gradient fill + a grain texture overlay so the
      // terrain reads as shaded ground; undiscovered stay dark and flat.
      const fill = !mini && known ? ` style="fill:url(#mapg${shape.danger})"` : '';
      const grain = !mini && known ? `<polygon class="map-grain-layer" points="${shape.points}" filter="url(#map-grain)"></polygon>` : '';
      const label = mini ? '' : `<text x="${shape.labelX}" y="${shape.labelY}" class="map-label">${known ? shape.label : 'НЕИЗВЕДАННО'}</text>${known ? `<text x="${shape.labelX}" y="${shape.labelY + 78}" class="map-danger-label">${shape.danger ? `ОПАСНОСТЬ ${'◆'.repeat(shape.danger)}` : 'БЕЗОПАСНАЯ ЗОНА'}</text>` : ''}`;
      return `<g><polygon class="${classes}" data-region="${shape.id}" points="${shape.points}"${fill}></polygon>${grain}${label}</g>`;
    }).join('');
    // Bridges (and the ford, once found) drawn as short decks straddling the river.
    const crossings = mini ? '' : [
      ...RIVER_BRIDGES.map((bridge) => ({ x: bridge.x, y: bridge.y, glyph: '╫', shown: true, label: bridge.name })),
      { x: HIDDEN_FORD.x, y: HIDDEN_FORD.y, glyph: '≈', shown: foundSecrets.has('reed_ford'), label: HIDDEN_FORD.name },
    ].filter((c) => c.shown).map((c) => `<g class="map-bridge"><rect x="${c.x - 150}" y="${c.y - 34}" width="300" height="68" rx="8"></rect><text x="${c.x}" y="${c.y + 20}">${c.glyph}</text></g>`).join('');
    const interiors = mini ? '' : BUILDINGS.filter((building) => building.interior).map((building) => `<g class="map-poi"><rect x="${building.x - 28}" y="${building.y - 28}" width="56" height="56"></rect><text x="${building.x}" y="${building.y + 12}">▤</text><text x="${building.x}" y="${building.y - 40}" class="map-poi-name">${building.name}</text></g>`).join('');
    const rifts = RIFT_POINTS.map((rift) => `<g class="map-rift"><circle cx="${rift.x}" cy="${rift.y}" r="${mini ? 42 : 58}"></circle>${mini ? '' : `<text x="${rift.x}" y="${rift.y + 15}">✦</text>`}</g>`).join('');
    // Secrets only appear once discovered.
    const secrets = mini ? '' : SECRET_POINTS.filter((secret) => foundSecrets.has(secret.id)).map((secret) => `<g class="map-secret"><circle cx="${secret.x}" cy="${secret.y}" r="34"></circle><text x="${secret.x}" y="${secret.y + 14}">◈</text><text x="${secret.x}" y="${secret.y - 44}" class="map-secret-name">${secret.name}</text></g>`).join('');
    // Discovered shortcut mouths, with a dotted link between the two ends.
    const shortcuts = mini ? '' : SHORTCUT_PORTALS.map((shortcut) => {
      const aFound = foundSecrets.has(`${shortcut.id}_a`);
      const bFound = foundSecrets.has(`${shortcut.id}_b`);
      const link = aFound && bFound ? `<line class="map-shortcut-link" x1="${shortcut.a.x}" y1="${shortcut.a.y}" x2="${shortcut.b.x}" y2="${shortcut.b.y}"></line>` : '';
      const mouths = ([['a', shortcut.a] as const, ['b', shortcut.b] as const]).filter(([side]) => foundSecrets.has(`${shortcut.id}_${side}`)).map(([, point]) => `<g class="map-secret"><circle cx="${point.x}" cy="${point.y}" r="32"></circle><text x="${point.x}" y="${point.y + 13}">⇲</text></g>`).join('');
      return `${link}${mouths}`;
    }).join('');
    // The current objective, pinned on the full map.
    const objective = this.snapshot?.objectivePoint;
    const objectivePin = !mini && objective ? `<g class="map-objective"><circle cx="${objective.x}" cy="${objective.y}" r="46"></circle><text x="${objective.x}" y="${objective.y + 22}">†</text></g>` : '';
    // Minimap keeps `none` (its wrapper is fixed-size and the player marker is
    // positioned by container-percentage, which assumes an edge-to-edge fill).
    // The full world map preserves aspect ratio; its container is given the
    // world's 4600:3000 ratio in CSS so `meet` fills it exactly with no
    // letterboxing, keeping the #map-player percentage placement correct.
    const aspect = mini ? 'none' : 'xMidYMid meet';
    return `<svg class="${mini ? 'minimap-svg' : 'world-map-svg'}" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" preserveAspectRatio="${aspect}" aria-hidden="true">${defs}<rect class="map-vector-bg" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></rect>${river}${roads}${regions}${crossings}${interiors}${rifts}${secrets}${shortcuts}${objectivePin}</svg>`;
  }

  private pauseHtml(): string {
    const settings = this.save?.settings;
    const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume', label: string) => `<label class="volume-row"><span>${label}<b>${Math.round((settings?.[key] ?? 0) * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${settings?.[key] ?? 0}" data-volume="${key}"></label>`;
    return `<div class="pause-layout v2"><div class="pause-copy"><span class="eyebrow">ВЕРСИЯ 4 • ОРУЖЕЙНЫЙ РЫВОК</span><p>Прогресс сохраняется автоматически, включая инвентарь, экипировку, открытые районы и текущую сцену.</p><dl><div><dt>Уровень</dt><dd>${this.snapshot?.level ?? 1}</dd></div><div><dt>Репутация</dt><dd>${this.snapshot?.reputation ?? 0}</dd></div><div><dt>Открыто районов</dt><dd>${this.snapshot?.discoveredLocations.length ?? 0}/9</dd></div><div><dt>Заданий завершено</dt><dd>${this.snapshot?.quests.filter((q) => q.status === 'completed').length ?? 0}</dd></div></dl></div><div class="audio-settings"><h3>Звук</h3>${slider('masterVolume','Общая громкость')}${slider('musicVolume','Музыка')}${slider('sfxVolume','Эффекты')}${slider('ambienceVolume','Окружение')}<button data-toggle-sound>${settings?.sound ? 'ВЫКЛЮЧИТЬ ВЕСЬ ЗВУК' : 'ВКЛЮЧИТЬ ЗВУК'}</button></div><div class="pause-actions"><button data-resume>ПРОДОЛЖИТЬ</button><button data-toggle-motion>${settings?.reducedMotion ? 'АНИМАЦИИ: МИНИМУМ' : 'АНИМАЦИИ: ПОЛНЫЕ'}</button><button data-toggle-quality>КАЧЕСТВО: ${(settings?.quality ?? 'auto').toUpperCase()}</button><button data-fullscreen>ПОЛНЫЙ ЭКРАН</button><button class="danger" data-reset>НАЧАТЬ ЗАНОВО</button></div><div class="controls-card"><h3>Управление</h3><p><kbd>WASD</kbd> Движение</p><p><kbd>E</kbd> Действие / дверь</p><p><kbd>ЛКМ</kbd> / <kbd>Space</kbd> Атака</p><p><kbd>F</kbd> Быстрое зелье</p><p><kbd>Q I M B</kbd> Меню</p></div></div>`;
  }

  // --- Crafting + weapon reinforcement -----------------------------------

  private materialCount(itemId: string): number {
    return this.snapshot?.inventory.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
  }

  private craftHtml(): string {
    const snapshot = this.snapshot;
    if (!snapshot || !this.save) return '<div class="empty-state">Мастерская загружается…</div>';
    const coins = snapshot.coins;
    const reputation = snapshot.reputation;
    const recipes = RECIPES.map((recipe) => {
      const item = getItem(recipe.output.itemId);
      const repLocked = Boolean(recipe.requiredRep && reputation < recipe.requiredRep);
      const coinsShort = Boolean(recipe.coins && coins < recipe.coins);
      const mats = recipe.materials.map((mat) => {
        const material = getItem(mat.itemId);
        const have = this.materialCount(mat.itemId);
        const enough = have >= mat.quantity;
        return `<span class="ingredient ${enough ? '' : 'short'}"><em>${material?.icon ?? '◆'}</em>${material?.name ?? mat.itemId}<b>${have}/${mat.quantity}</b></span>`;
      }).join('');
      const canCraft = !repLocked && !coinsShort && recipe.materials.every((mat) => this.materialCount(mat.itemId) >= mat.quantity);
      const status = repLocked ? `НУЖНА РЕП. ${recipe.requiredRep}` : coinsShort ? `НУЖНО ◆ ${recipe.coins}` : canCraft ? 'ГОТОВО К СОЗДАНИЮ' : 'НЕ ХВАТАЕТ МАТЕРИАЛОВ';
      return `<article class="craft-recipe ${canCraft ? 'ready' : 'blocked'}" style="--rarity:${item ? RARITY_COLOR[item.rarity] : '#a9adb8'}">
        <div class="craft-icon">${item?.icon ?? '⚗'}${recipe.output.quantity > 1 ? `<em>${recipe.output.quantity}</em>` : ''}</div>
        <div class="craft-copy"><small>${recipe.kind === 'consumable' ? 'РАСХОДНИК' : 'ЭКИПИРОВКА'} • ${status}</small><b>${recipe.name}</b><p>${recipe.description}</p>
          <div class="ingredient-row">${mats}${recipe.coins ? `<span class="ingredient ${coinsShort ? 'short' : ''}"><em>◆</em>Золото<b>${coins}/${recipe.coins}</b></span>` : ''}</div>
        </div>
        <button data-craft="${recipe.id}" ${canCraft ? '' : 'disabled'}>${canCraft ? 'СОЗДАТЬ' : '—'}</button>
      </article>`;
    }).join('');
    return `<div class="craft-layout">
      <section class="craft-section">
        <div class="panel-intro split"><p>Материалы, что копятся в сумке, превращаются в зелья и снаряжение. Красным отмечено то, чего не хватает.</p><div class="bag-meta"><span>◆ ${coins}</span><span>Реп. ${reputation}</span></div></div>
        <h3 class="inventory-section-title">Рецепты</h3>
        <div class="craft-list">${recipes || '<div class="empty-state">Рецепты недоступны.</div>'}</div>
      </section>
      <section class="upgrade-section">
        <span class="eyebrow">УСИЛЕНИЕ ОРУЖИЯ</span><h3 class="upgrade-title">Кузница Руны</h3>
        <p class="upgrade-hint">Реликтовые материалы усиливают клинки. Максимум +${MAX_WEAPON_UPGRADE}.</p>
        <div class="upgrade-list">${this.weaponUpgradeCards()}</div>
      </section>
    </div>`;
  }

  private weaponUpgradeCards(): string {
    const owned = this.snapshot?.ownedWeapons ?? [];
    const coins = this.snapshot?.coins ?? 0;
    const list = WEAPONS.filter((weapon) => owned.includes(weapon.id));
    if (!list.length) return '<div class="empty-state">Сначала получите оружие.</div>';
    return list.map((weapon) => {
      const level = this.save?.weaponUpgrades[weapon.id] ?? 0;
      const currentDamage = Math.round(weapon.damage * (1 + upgradeDamagePct(level) / 100));
      const pips = Array.from({ length: MAX_WEAPON_UPGRADE }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
      const nextTier = level < MAX_WEAPON_UPGRADE ? WEAPON_UPGRADE_TIERS.find((tier) => tier.level === level + 1) : undefined;
      let footer: string;
      let canUpgrade = false;
      if (!nextTier) {
        footer = '<div class="upgrade-max">УСИЛЕНО ДО ПРЕДЕЛА</div>';
      } else {
        const nextDamage = Math.round(weapon.damage * (1 + nextTier.damageBonusPct / 100));
        const delta = nextDamage - currentDamage;
        const coinsShort = coins < nextTier.coins;
        const mats = nextTier.materials.map((mat) => {
          const material = getItem(mat.itemId);
          const have = this.materialCount(mat.itemId);
          const enough = have >= mat.quantity;
          return `<span class="ingredient ${enough ? '' : 'short'}"><em>${material?.icon ?? '◆'}</em>${material?.name ?? mat.itemId}<b>${have}/${mat.quantity}</b></span>`;
        }).join('');
        canUpgrade = !coinsShort && nextTier.materials.every((mat) => this.materialCount(mat.itemId) >= mat.quantity);
        footer = `<div class="upgrade-cost">
            <div class="upgrade-delta">До +${nextTier.level}<b class="positive">Урон ${currentDamage} → ${nextDamage} (+${delta})</b></div>
            <div class="ingredient-row">${mats}<span class="ingredient ${coinsShort ? 'short' : ''}"><em>◆</em>Золото<b>${coins}/${nextTier.coins}</b></span></div>
          </div>`;
      }
      return `<article class="upgrade-card" style="--accent:${weapon.accent}">
        <div class="upgrade-head"><div class="upgrade-art">${weapon.icon}</div><div><small>${weapon.kind.toUpperCase()} • УРОН ${currentDamage}</small><b>${weapon.name} ${level > 0 ? `<span class="upgrade-level">+${level}</span>` : ''}</b><div class="upgrade-pips">${pips}</div></div></div>
        ${footer}
        ${nextTier ? `<button data-upgrade="${weapon.id}" ${canUpgrade ? '' : 'disabled'}>${canUpgrade ? `УСИЛИТЬ ЗА ◆ ${nextTier.coins}` : 'НЕ ХВАТАЕТ РЕСУРСОВ'}</button>` : ''}
      </article>`;
    }).join('');
  }

  // --- Bestiary ----------------------------------------------------------

  private bestiaryHtml(): string {
    if (!this.save) return '<div class="empty-state">Бестиарий загружается…</div>';
    const ids = Object.keys(ENEMIES);
    const discovered = ids.filter((id) => (this.save?.bestiary[id] ?? 0) >= BESTIARY_APPEARANCE_AT).length;
    const totalKills = Object.values(this.save.bestiary).reduce((sum, n) => sum + n, 0);
    const cards = ids.map((id) => this.bestiaryCard(id)).join('');
    return `<div class="bestiary-summary">
        <div><span class="eyebrow">ИЗУЧЕНО СУЩЕСТВ</span><strong>${discovered}<em>/${ids.length}</em></strong></div>
        <div class="discovery-meter" aria-label="Прогресс изучения"><i style="width:${discovered / ids.length * 100}%"></i></div>
        <div class="bestiary-kills"><small>ВСЕГО УБИТО</small><b>${totalKills}</b></div>
      </div>
      <div class="bestiary-grid">${cards}</div>`;
  }

  private bestiaryCard(enemyId: string): string {
    const enemy = ENEMIES[enemyId];
    const kills = this.save?.bestiary[enemyId] ?? 0;
    const appearance = kills >= BESTIARY_APPEARANCE_AT;
    const statsKnown = kills >= BESTIARY_STATS_AT;
    const weaknessKnown = kills >= BESTIARY_WEAKNESS_AT;
    const lore = getBestiaryLore(enemyId);
    const isBoss = (enemy.scale ?? 1) >= 1.4;
    const accent = `#${enemy.tint.toString(16).padStart(6, '0')}`;
    if (!appearance) {
      // Undiscovered: silhouette + "?" and the next threshold as a nudge.
      return `<article class="beast-card locked ${isBoss ? 'boss' : ''}">
        <div class="beast-portrait"><span class="beast-silhouette" style="--tint:${accent}">?</span></div>
        <div class="beast-body"><small>НЕ ИЗУЧЕНО</small><b>???</b><p>Сразите это существо, чтобы занести его в летопись.</p></div>
        <div class="beast-progress"><span class="reveal-step">Открытие при 1 победе</span></div>
      </article>`;
    }
    const stats = statsKnown
      ? `<div class="beast-stats"><span>❤ <b>${enemy.health}</b></span><span>⚔ <b>${enemy.damage}</b></span><span>➤ <b>${enemy.speed}</b></span></div>`
      : `<div class="beast-stats locked-stats"><span class="reveal-step">Характеристики при ${BESTIARY_STATS_AT} победах</span></div>`;
    const weakness = weaknessKnown
      ? `<div class="beast-weakness"><small>СЛАБОСТЬ</small><p>${lore?.weakness ?? '—'}</p></div>`
      : `<div class="beast-weakness locked-weakness"><span class="reveal-step">Слабость при ${BESTIARY_WEAKNESS_AT} победах</span></div>`;
    return `<article class="beast-card ${isBoss ? 'boss' : ''}" style="--tint:${accent}">
      <div class="beast-portrait"><span class="beast-glyph">${isBoss ? '☠' : '◈'}</span><b class="beast-kills">×${kills}</b></div>
      <div class="beast-body"><small>${isBoss ? 'ВЛАДЫКА' : 'СУЩЕСТВО'}</small><b>${enemy.name}</b><p>${lore?.lore ?? ''}</p></div>
      ${stats}
      ${weakness}
    </article>`;
  }

  // --- Achievements ------------------------------------------------------

  private achievementsHtml(): string {
    if (!this.save) return '<div class="empty-state">Награды загружаются…</div>';
    const owned = new Set(this.save.achievements);
    const total = ACHIEVEMENTS.length;
    const unlocked = ACHIEVEMENTS.filter((achievement) => owned.has(achievement.id)).length;
    const groups = achievementCategoryOrder.map((category) => {
      const list = ACHIEVEMENTS.filter((achievement) => achievement.category === category);
      if (!list.length) return '';
      const gotInGroup = list.filter((achievement) => owned.has(achievement.id)).length;
      const cards = list.map((achievement) => {
        const isUnlocked = owned.has(achievement.id);
        const masked = Boolean(achievement.hidden) && !isUnlocked;
        const name = masked ? '???' : achievement.name;
        const description = masked ? 'Тайное свершение — раскроется, когда будет достигнуто.' : achievement.description;
        return `<article class="achievement ${isUnlocked ? 'unlocked' : 'locked'} ${masked ? 'masked' : ''}">
          <div class="achievement-icon">${masked ? '?' : achievement.icon}</div>
          <div class="achievement-copy"><b>${name}</b><p>${description}</p></div>
          <span class="achievement-state">${isUnlocked ? '✓' : masked ? '?' : '🔒'}</span>
        </article>`;
      }).join('');
      return `<section class="achievement-group"><header class="achievement-group-head"><h3>${achievementCategoryLabel[category]}</h3><span>${gotInGroup}/${list.length}</span></header><div class="achievement-grid">${cards}</div></section>`;
    }).join('');
    return `<div class="achievement-summary">
        <div><span class="eyebrow">СВЕРШЕНИЯ</span><strong>${unlocked}<em>/${total}</em></strong></div>
        <div class="discovery-meter" aria-label="Общий прогресс наград"><i style="width:${unlocked / total * 100}%"></i></div>
        <div class="bestiary-kills"><small>ЗАВЕРШЕНО</small><b>${Math.round(unlocked / total * 100)}%</b></div>
      </div>
      ${groups}`;
  }

  // --- Styled confirmation (replaces window.confirm) ---------------------

  private confirmHtml(): string {
    if (!this.pendingConfirm) return '';
    const { message, confirmLabel } = this.pendingConfirm;
    return `<div class="confirm-overlay" role="alertdialog" aria-modal="true"><div class="confirm-box"><span class="eyebrow">ПОДТВЕРЖДЕНИЕ</span><p>${message}</p><div class="confirm-actions"><button class="subtle" data-confirm-cancel>ОТМЕНА</button><button class="danger" data-confirm-accept>${confirmLabel}</button></div></div></div>`;
  }

  private bindPanelActions(): void {
    this.root.querySelectorAll<HTMLElement>('[data-equip]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('equip', button.dataset.equip)));
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('buy', button.dataset.buy)));
    this.root.querySelectorAll<HTMLElement>('[data-claim]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('claim-tier', Number(button.dataset.claim))));
    this.root.querySelectorAll<HTMLElement>('[data-equip-item]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('equip-item', button.dataset.equipItem)));
    this.root.querySelectorAll<HTMLElement>('[data-use-item]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('use-item', button.dataset.useItem)));
    this.root.querySelectorAll<HTMLElement>('[data-quick-assign]').forEach((button) => button.addEventListener('click', () => {
      const itemId = button.dataset.quickAssign!;
      const slot = Number(button.dataset.slot);
      // Clicking the slot this item already occupies clears it; otherwise bind.
      const current = (this.snapshot?.equipment.quick ?? [])[slot] ?? null;
      if (current === itemId) GameEvents.emit('clear-quick-slot', slot);
      else GameEvents.emit('assign-quick-slot', { itemId, slot });
    }));
    this.root.querySelectorAll<HTMLElement>('[data-transfer-item]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('transfer-item', { itemId: button.dataset.transferItem, direction: button.dataset.direction })));
    this.root.querySelectorAll<HTMLInputElement>('[data-volume]').forEach((input) => input.addEventListener('input', () => {
      const value = Number(input.value);
      const label = input.parentElement?.querySelector('b');
      if (label) label.textContent = `${Math.round(value * 100)}%`;
      GameEvents.emit('set-volume', { key: input.dataset.volume, value });
    }));
    this.root.querySelector('[data-resume]')?.addEventListener('click', () => this.closePanel());
    this.root.querySelector('[data-toggle-sound]')?.addEventListener('click', () => GameEvents.emit('toggle-sound'));
    this.root.querySelector('[data-toggle-motion]')?.addEventListener('click', () => GameEvents.emit('toggle-motion'));
    this.root.querySelector('[data-toggle-quality]')?.addEventListener('click', () => GameEvents.emit('toggle-quality'));
    this.root.querySelector('[data-fullscreen]')?.addEventListener('click', () => GameEvents.emit('fullscreen'));
    this.root.querySelectorAll<HTMLElement>('[data-craft]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('craft-recipe', button.dataset.craft)));
    this.root.querySelectorAll<HTMLElement>('[data-upgrade]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('upgrade-weapon', button.dataset.upgrade)));
    this.root.querySelector('[data-reset]')?.addEventListener('click', () => this.requestConfirm('Удалить весь прогресс Trupy и начать заново? Это действие необратимо.', 'reset-game', 'НАЧАТЬ ЗАНОВО'));
    this.root.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => this.dismissConfirm());
    this.root.querySelector('[data-confirm-accept]')?.addEventListener('click', () => {
      const confirm = this.pendingConfirm;
      this.pendingConfirm = undefined;
      // Drop the overlay before the action runs (harmless if the action, e.g.
      // reset-game, reloads the page immediately afterwards).
      if (this.activePanel) this.renderPanel(this.activePanel);
      if (confirm) GameEvents.emit(confirm.event);
    });
  }

  private requestConfirm(message: string, event: string, confirmLabel: string): void {
    this.pendingConfirm = { message, event, confirmLabel };
    if (this.activePanel) this.renderPanel(this.activePanel);
  }

  private dismissConfirm(): void {
    this.pendingConfirm = undefined;
    if (this.activePanel) this.renderPanel(this.activePanel);
  }

  private showDialogue(payload: DialoguePayload): void {
    this.closePanel();
    const layer = this.root.querySelector<HTMLElement>('#dialogue-layer');
    layer?.setAttribute('aria-hidden', 'false');
    this.text('#dialogue-speaker', payload.speaker);
    this.text('#dialogue-subtitle', payload.subtitle ?? 'ЖИТЕЛЬ ДОЛИНЫ');
    this.text('#dialogue-text', payload.text);
    const portrait = this.root.querySelector<HTMLElement>('#dialogue-portrait');
    if (portrait) { portrait.textContent = payload.speaker.charAt(0); portrait.style.setProperty('--dialogue-accent', payload.accent ?? '#b78cff'); }
    const actions = this.root.querySelector<HTMLElement>('#dialogue-actions');
    if (actions) {
      actions.innerHTML = payload.actions.map((action, index) => `<button data-dialogue-index="${index}" class="${action.primary ? 'primary' : ''}">${action.label}</button>`).join('');
      actions.querySelectorAll<HTMLElement>('[data-dialogue-index]').forEach((button) => button.addEventListener('click', () => {
        const action = payload.actions[Number(button.dataset.dialogueIndex)];
        if (action.event === 'close') this.closeDialogue();
        else GameEvents.emit(action.event, action.payload);
      }));
    }
    GameEvents.emit('ui-lock', true);
  }

  private closeDialogue(): void {
    const layer = this.root.querySelector<HTMLElement>('#dialogue-layer');
    if (layer?.getAttribute('aria-hidden') === 'false') {
      layer.setAttribute('aria-hidden', 'true');
      GameEvents.emit('ui-lock', false);
    }
  }

  private showTutorial(tip: { step: number; title: string; text: string } | null): void {
    const element = this.root.querySelector<HTMLElement>('#tutorial-tip');
    if (!element) return;
    if (!tip) return element.classList.add('hidden');
    element.classList.remove('hidden');
    const step = element.querySelector('.tutorial-step');
    const title = element.querySelector('strong');
    const text = element.querySelector('p');
    if (step) step.textContent = `ОБУЧЕНИЕ ${tip.step}/5`;
    if (title) title.textContent = tip.title;
    if (text) text.textContent = tip.text;
  }

  private showRiftStatus(status: { name: string; wave: number; remaining: number } | null): void {
    const banner = this.root.querySelector<HTMLElement>('#rift-banner');
    if (!banner) return;
    if (!status) { banner.classList.remove('visible'); return; }
    this.text('#rift-name', status.name);
    this.text('#rift-progress', `Волна ${status.wave}/3 • осталось ${status.remaining}`);
    banner.classList.add('visible');
  }

  // Track the largest cooldown seen per ability so the radial sweep has a stable
  // "full" reference even when the scene only sends the remaining seconds.
  private dashCooldownMax = 0;
  private specialCooldownMax = 0;

  private showAbilityCooldown(dash: number, special: number, dashMax?: number, specialMax?: number): void {
    const dashButton = this.root.querySelector<HTMLElement>('.ability-slot.dash');
    const specialButton = this.root.querySelector<HTMLElement>('.ability-slot.special');
    const mobileDash = this.root.querySelector<HTMLElement>('.mobile-button.dash');
    const mobileSpecial = this.root.querySelector<HTMLElement>('.mobile-button.special');
    // Remember the cooldown span so the sweep can read a fraction. If the scene
    // supplies a max use it; otherwise infer it from the highest remaining value.
    if (dashMax && dashMax > 0) this.dashCooldownMax = dashMax; else if (dash > this.dashCooldownMax) this.dashCooldownMax = dash;
    if (specialMax && specialMax > 0) this.specialCooldownMax = specialMax; else if (special > this.specialCooldownMax) this.specialCooldownMax = special;
    const dashFraction = dash > 0 && this.dashCooldownMax > 0 ? Math.max(0, Math.min(1, dash / this.dashCooldownMax)) : 0;
    const specialFraction = special > 0 && this.specialCooldownMax > 0 ? Math.max(0, Math.min(1, special / this.specialCooldownMax)) : 0;
    this.text('#dash-cooldown', dash > 0 ? dash.toFixed(1) : '');
    this.text('#special-cooldown', special > 0 ? special.toFixed(1) : '');
    [dashButton, mobileDash].forEach((button) => {
      button?.classList.toggle('ready', dash <= 0);
      // The sweep angle: 0 when ready, 360deg worth of "used" wiping away as it recovers.
      button?.style.setProperty('--cooldown', `${(1 - dashFraction) * 360}deg`);
      button?.classList.toggle('cooling', dashFraction > 0);
    });
    [specialButton, mobileSpecial].forEach((button) => {
      button?.classList.toggle('ready', special <= 0);
      button?.style.setProperty('--cooldown', `${(1 - specialFraction) * 360}deg`);
      button?.classList.toggle('cooling', specialFraction > 0);
    });
  }

  private showCombo(hits: number, multiplier: number): void {
    const banner = this.root.querySelector<HTMLElement>('#combo-banner');
    if (!banner) return;
    if (hits <= 0) { banner.classList.remove('visible'); banner.removeAttribute('data-tier'); return; }
    this.text('#combo-hits', hits.toString());
    this.text('#combo-multiplier', `×${multiplier.toFixed(2)}`);
    // Escalation tiers drive scale + colour heat via CSS. Tier grows with the
    // streak so a 12-hit run reads very differently from a 2-hit one. A capped
    // --combo-scale gives the number visible growth without breaking layout.
    const tier = hits >= 12 ? 4 : hits >= 9 ? 3 : hits >= 6 ? 2 : hits >= 3 ? 1 : 0;
    banner.dataset.tier = String(tier);
    banner.style.setProperty('--combo-scale', (1 + Math.min(hits, 15) * 0.035).toFixed(3));
    banner.classList.toggle('hot', hits >= 6);
    banner.classList.add('visible');
    // Re-trigger the shake at 6+ by toggling the animation class on each hit.
    if (hits >= 6 && !this.reducedMotion) {
      banner.classList.remove('shake');
      // Force reflow so the animation restarts even on consecutive hits.
      void banner.offsetWidth;
      banner.classList.add('shake');
    }
  }

  // --- Boss health bar ---------------------------------------------------

  private showBossEngage(payload: { name: string; maxHealth: number; phases?: number }): void {
    const bar = this.root.querySelector<HTMLElement>('#boss-bar');
    if (!bar) return;
    this.bossMaxHealth = Math.max(1, payload.maxHealth);
    this.bossPhases = Math.max(1, Math.floor(payload.phases ?? 1));
    this.text('#boss-name', payload.name);
    this.width('#boss-fill', 100);
    // Phase dividers: N phases means N-1 internal separators laid over the track.
    const segments = this.root.querySelector<HTMLElement>('#boss-segments');
    if (segments) {
      segments.innerHTML = this.bossPhases > 1
        ? Array.from({ length: this.bossPhases - 1 }, (_, i) => `<span style="left:${(i + 1) / this.bossPhases * 100}%"></span>`).join('')
        : '';
    }
    bar.classList.remove('phase-shift');
    bar.setAttribute('aria-hidden', 'false');
    bar.classList.add('engaged');
  }

  private showBossHealth(payload: { health: number; phase?: number }): void {
    const bar = this.root.querySelector<HTMLElement>('#boss-bar');
    if (!bar || bar.getAttribute('aria-hidden') === 'true') return;
    const fraction = Math.max(0, Math.min(1, payload.health / this.bossMaxHealth));
    this.width('#boss-fill', fraction * 100);
    if (typeof payload.phase === 'number') {
      bar.dataset.phase = String(payload.phase);
      // Brief flare when a phase boundary is crossed.
      bar.classList.remove('phase-shift');
      void bar.offsetWidth;
      bar.classList.add('phase-shift');
    }
  }

  private hideBoss(): void {
    const bar = this.root.querySelector<HTMLElement>('#boss-bar');
    if (!bar) return;
    bar.classList.add('defeated');
    bar.classList.remove('engaged');
    window.setTimeout(() => {
      bar.setAttribute('aria-hidden', 'true');
      bar.classList.remove('defeated', 'phase-shift');
    }, this.reducedMotion ? 0 : 900);
  }

  // --- Environment (clock + weather) -------------------------------------

  private showEnvironment(env: { time?: string; weather?: string }): void {
    if (typeof env.time === 'string') this.timeLabel = env.time;
    if (typeof env.weather === 'string') this.weatherLabel = env.weather;
    this.text('#env-time', this.timeLabel || '—');
    this.text('#env-weather', this.weatherLabel || '—');
    // Pick a glanceable glyph from the time-of-day label (server sends the
    // localized string from Lighting/Weather; match on its known keywords).
    const time = this.timeLabel.toUpperCase();
    const weather = this.weatherLabel.toUpperCase();
    let icon = '☾';
    if (weather.includes('ГРОЗА')) icon = '⚡';
    else if (weather.includes('ДОЖДЬ')) icon = '☔';
    else if (weather.includes('ТУМАН')) icon = '≋';
    else if (weather.includes('ПЕПЕЛ')) icon = '❄';
    else if (weather.includes('ПАСМУРНО')) icon = '☁';
    else if (time.includes('ДЕНЬ') || time.includes('ПОЛУДН') || time.includes('УТРО')) icon = '☀';
    else if (time.includes('РАССВЕТ') || time.includes('ЗАКАТ') || time.includes('СУМЕРК')) icon = '☼';
    else icon = '☾';
    this.text('#env-icon', icon);
    // Tint the widget by day/night for an at-a-glance read.
    const widget = this.root.querySelector<HTMLElement>('#env-widget');
    const isNight = time.includes('НОЧЬ') || time.includes('СУМЕРК');
    widget?.classList.toggle('night', isNight);
    widget?.classList.toggle('day', !isNight);
    // Keep the open map's time/weather line in sync.
    const mapEnv = this.root.querySelector<HTMLElement>('#map-env');
    if (mapEnv) mapEnv.textContent = [this.timeLabel, this.weatherLabel].filter(Boolean).join(' • ') || '—';
  }

  // --- Damage-flash vignette ---------------------------------------------

  private showHurt(severity: number): void {
    const vignette = this.root.querySelector<HTMLElement>('#hurt-vignette');
    if (!vignette) return;
    // Severity scales the flash strength; clamp so a big hit is intense but the
    // screen never goes fully opaque red.
    const intensity = Math.max(0.25, Math.min(1, severity));
    vignette.style.setProperty('--hurt-alpha', intensity.toFixed(2));
    window.clearTimeout(this.hurtTimer);
    vignette.classList.remove('flash');
    void vignette.offsetWidth;
    vignette.classList.add('flash');
    this.hurtTimer = window.setTimeout(() => vignette.classList.remove('flash'), 620);
  }

  private showLoot(itemId: string, quantity: number): void {
    const item = getItem(itemId);
    const banner = this.root.querySelector<HTMLElement>('#loot-banner');
    if (!item || !banner) return;
    window.clearTimeout(this.lootTimer);
    this.text('#loot-icon', item.icon);
    this.text('#loot-name', item.name);
    this.text('#loot-quantity', `+${quantity}`);
    banner.style.setProperty('--loot-color', RARITY_COLOR[item.rarity]);
    banner.classList.remove('visible');
    requestAnimationFrame(() => banner.classList.add('visible'));
    this.lootTimer = window.setTimeout(() => banner.classList.remove('visible'), 2300);
  }

  private showToast(message: string): void {
    const toast = this.root.querySelector<HTMLElement>('#toast');
    if (!toast) return;
    window.clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.classList.remove('visible');
    requestAnimationFrame(() => toast.classList.add('visible'));
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  private showDeath(): void {
    const screen = this.root.querySelector<HTMLElement>('#death-screen');
    if (screen) {
      screen.setAttribute('aria-hidden', 'false');
      // Restart the fade-in animation each death (re-death after respawn).
      screen.classList.remove('appear');
      void screen.offsetWidth;
      screen.classList.add('appear');
    }
    GameEvents.emit('ui-lock', true);
  }

  private showEnding(data: { playtime: number; level: number; reputation: number }): void {
    const layer = this.root.querySelector<HTMLElement>('#ending-screen');
    const stats = this.root.querySelector<HTMLElement>('#ending-stats');
    if (stats) stats.innerHTML = `<span><b>${Math.max(1, Math.round(data.playtime / 60))}</b> мин.</span><span><b>${data.level}</b> уровень</span><span><b>${data.reputation}</b> репутация</span>`;
    layer?.setAttribute('aria-hidden', 'false');
    GameEvents.emit('ui-lock', true);
  }

  private text(selector: string, value: string): void {
    const element = this.root.querySelector(selector);
    if (element) element.textContent = value;
  }

  private width(selector: string, value: number): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
  }
}

/* ===========================================================================
 * GameEvents contract for GameUI (scene integration reference)
 * ---------------------------------------------------------------------------
 * All communication with the scene goes through the shared GameEvents emitter.
 * Below is the complete list this UI depends on. Events marked NEW were added in
 * this UI pass and need a scene-side counterpart; the rest predate it.
 *
 * ── CONSUMED (GameUI listens; the scene emits) ─────────────────────────────
 *   'hud'              { snapshot: HudSnapshot; save: PlayerSave }
 *                        Drives the whole HUD. `save` now also feeds the new
 *                        panels via its v3 fields (weaponUpgrades, bestiary,
 *                        achievements, stats) — no extra HudSnapshot fields are
 *                        required, the UI reads them straight off the save.
 *   'toast'            string
 *   'loot'             { itemId: string; quantity: number }
 *   'combo'            { hits: number; multiplier: number }
 *   'ability-cooldown' { dash: number; special: number; dashMax?: number; specialMax?: number }
 *                        NEW optional fields dashMax/specialMax: the ability's
 *                        full cooldown in seconds. Supplying them makes the
 *                        radial conic sweep exact; if omitted the UI infers the
 *                        max from the largest remaining value it has seen.
 *   'rift-status'      { name: string; wave: number; remaining: number } | null
 *   'location'         string
 *   'tutorial'         { step: number; title: string; text: string } | null
 *   'dialogue'         DialoguePayload
 *   'dialogue-close'   void
 *   'panel-open'       string   (now also accepts 'craft' | 'bestiary' | 'achievements')
 *   'death'            void
 *   'ending'           { playtime: number; level: number; reputation: number }
 *   'prompt'           { text?: string }
 *   'boss-engage'      { name: string; maxHealth: number; phases?: number }   NEW
 *   'boss-health'      { health: number; phase?: number }                     NEW
 *   'boss-defeated'    void                                                    NEW
 *   'environment'      { time?: string; weather?: string }                    NEW
 *                        Localized labels — pass DaylightState.label and
 *                        WeatherProfile.label. Either field may be sent alone.
 *   'player-hurt'      { severity?: number }   NEW   (0..1; scales the vignette)
 *
 * ── EMITTED (GameUI fires; the scene handles) ──────────────────────────────
 *   'ui-heal' | 'ui-dash' | 'ui-special' | 'ui-attack' | 'ui-interact'  void
 *   'ui-move'          { x: number; y: number }   (normalized -1..1)
 *   'ui-lock'          boolean
 *   'equip'            weaponId: string
 *   'buy'              weaponId: string
 *   'claim-tier'       tier: number
 *   'equip-item'       itemId: string
 *   'use-item'         itemId: string
 *   'use-quick-slot'   index: number   NEW   (scene calls InventorySystem.useQuickSlot;
 *                        result shape matches use-item, so reuse that handler)
 *   'assign-quick-slot'{ itemId: string; slot: number }   NEW
 *                        (scene calls InventorySystem.setQuickSlot, then re-emits 'hud')
 *   'clear-quick-slot' slot: number   NEW
 *                        (scene calls InventorySystem.clearQuickSlot, then re-emits 'hud')
 *   'transfer-item'    { itemId: string; direction: 'toInventory' | 'toChest' }
 *   'set-volume'       { key: string; value: number }
 *   'toggle-sound' | 'toggle-motion' | 'toggle-quality' | 'fullscreen'  void
 *   'respawn'          void
 *   'reset-game'       void   (now fired only after the styled in-panel confirm)
 *   dialogue action events: emitted verbatim from DialoguePayload.actions[].event
 *   'craft-recipe'     recipeId: string   NEW   (scene calls CraftingSystem.craft)
 *   'upgrade-weapon'   weaponId: string   NEW   (scene calls CraftingSystem.upgradeWeapon)
 *
 * After handling 'craft-recipe' / 'upgrade-weapon' the scene should re-emit
 * 'hud' so the panel (open at the time) re-renders with the new material counts,
 * coins and upgrade levels. A 'toast' with CraftResult.message is a nice touch.
 * =========================================================================== */
