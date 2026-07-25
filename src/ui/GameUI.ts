import { BATTLE_PASS, QUESTS, WEAPONS } from '../data/content';
import { ITEMS, RARITY_COLOR, RARITY_LABEL, getItem } from '../data/items';
import { BUILDINGS, MAP_RIVER, MAP_ROADS, MAP_SHAPES, RIFT_POINTS, WORLD_HEIGHT, WORLD_WIDTH } from '../data/world';
import { GameEvents } from '../game/events';
import type { DialoguePayload, HudSnapshot, ItemCategory, PlayerSave } from '../game/types';

const questStatusLabel: Record<string, string> = {
  available: 'Доступно', active: 'В процессе', ready: 'Можно сдать', completed: 'Завершено',
};

export class GameUI {
  private readonly root: HTMLElement;
  private snapshot?: HudSnapshot;
  private save?: PlayerSave;
  private activePanel?: string;
  private toastTimer?: number;
  private lootTimer?: number;
  private joystickPointer?: number;
  private joystickCenter = { x: 0, y: 0 };
  private worldPosition = { x: 420, y: 520 };
  private reducedMotion = false;
  private listeners: Array<() => void> = [];

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
        </aside>

        <nav class="quick-nav" aria-label="Игровые меню">
          <button data-panel="journal"><span>Q</span>Задания</button>
          <button data-panel="inventory"><span>I</span>Инвентарь</button>
          <button data-panel="map"><span>M</span>Карта</button>
          <button data-panel="pass"><span>B</span>Пропуск</button>
          <button data-panel="pause"><span>Esc</span>Меню</button>
        </nav>

        <div class="weapon-slot" id="weapon-slot">
          <span id="weapon-icon">⚔</span>
          <div><small>ОРУЖИЕ</small><strong id="weapon-name">Ржавый клинок</strong></div>
          <kbd>1</kbd>
        </div>
        <button class="potion-slot" id="potion-button" aria-label="Использовать зелье"><span>♥</span><strong id="potion-count">2</strong><kbd>F</kbd></button>
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
      prompt.classList.add('visible');
    } else prompt.classList.remove('visible');
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
    this.on<{ dash: number; special: number }>('ability-cooldown', ({ dash, special }) => this.showAbilityCooldown(dash, special));
    this.on<{ name: string; wave: number; remaining: number } | null>('rift-status', (status) => this.showRiftStatus(status));
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
    };
    const labels: Record<string, [string, string]> = {
      journal: ['ЖУРНАЛ', 'Задания'], inventory: ['СУМКА ИЗГНАННИКА', 'Инвентарь'], map: ['ДОЛИНА МЁРТВЫХ', 'Карта'],
      pass: ['СЕЗОН II • БЕСПЛАТНО', 'Путь изгнанника'], pause: ['TRUPY', 'Пауза'], shop: ['КУЗНИЦА РУНЫ', 'Магазин оружия'], chest: ['ДОМ ИЗГНАННИКА', 'Домашний сундук'],
    };
    [eyebrow.textContent, title.textContent] = labels[panel] ?? ['TRUPY', 'Меню'];
    content.innerHTML = (renderers[panel] ?? renderers.pause)();
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
    return `<article class="inventory-item ${equipped ? 'equipped' : ''}" style="--rarity:${RARITY_COLOR[item.rarity]}"><div class="item-icon">${item.icon}<em>${quantity > 1 ? quantity : ''}</em></div><div class="item-copy"><small>${RARITY_LABEL[item.rarity]} • ${this.categoryLabel(item.category)}</small><b>${item.name}</b><p>${item.description}</p></div><div class="item-actions">${primary}${transfer}</div></article>`;
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
    return `<div class="panel-intro split"><p>Руна торгует только за золото, заработанное в Долине. Репутация открывает редкие образцы.</p><div class="coin-chip">◆ ${this.snapshot?.coins ?? 0}</div></div><div class="weapon-grid shop-grid">${WEAPONS.filter((weapon) => weapon.price > 0).map((weapon) => {
      const isOwned = owned.includes(weapon.id);
      const locked = (this.snapshot?.reputation ?? 0) < weapon.requiredRep;
      return `<article class="weapon-card ${isOwned ? 'owned' : ''}" style="--accent:${weapon.accent}"><div class="weapon-art">${weapon.icon}</div><span>${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}</span><h3>${weapon.name}</h3><p>${weapon.description}</p><div class="weapon-meta"><b>◆ ${weapon.price}</b><small>РЕП. ${weapon.requiredRep}</small></div><button data-buy="${weapon.id}" ${isOwned || locked ? 'disabled' : ''}>${isOwned ? 'КУПЛЕНО' : locked ? `НУЖНА РЕП. ${weapon.requiredRep}` : 'КУПИТЬ'}</button></article>`;
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
    return `<div class="world-map vector-map">${this.mapSvg(false)}<span class="map-player" id="map-player"><i></i>ВЫ</span></div><div class="map-legend"><span><i class="safe"></i> Безопасная зона</span><span><i class="danger"></i> Опасная зона</span><span><b>▤</b> Доступный интерьер</span><span><b>✦</b> Разлом Долины</span><span><b>†</b> Активная цель</span></div>`;
  }

  private mapSvg(mini: boolean): string {
    const discovered = new Set(this.snapshot?.discoveredLocations ?? ['home', 'village']);
    const river = `<polygon class="map-vector-river" points="${MAP_RIVER}"></polygon>`;
    const roads = MAP_ROADS.map((road) => `<polyline class="map-vector-road" points="${road.map(([x,y]) => `${x},${y}`).join(' ')}"></polyline>`).join('');
    const regions = MAP_SHAPES.map((shape) => {
      const known = discovered.has(shape.id);
      const classes = `map-zone map-region danger-${shape.danger} ${known ? 'discovered' : 'undiscovered'}`;
      const label = mini ? '' : `<text x="${shape.labelX}" y="${shape.labelY}" class="map-label">${known ? shape.label : 'НЕИЗВЕДАННО'}</text>${known ? `<text x="${shape.labelX}" y="${shape.labelY + 78}" class="map-danger-label">${shape.danger ? `ОПАСНОСТЬ ${'◆'.repeat(shape.danger)}` : 'БЕЗОПАСНАЯ ЗОНА'}</text>` : ''}`;
      return `<g><polygon class="${classes}" data-region="${shape.id}" points="${shape.points}"></polygon>${label}</g>`;
    }).join('');
    const interiors = mini ? '' : BUILDINGS.filter((building) => building.interior).map((building) => `<g class="map-poi"><rect x="${building.x - 28}" y="${building.y - 28}" width="56" height="56"></rect><text x="${building.x}" y="${building.y + 12}">▤</text></g>`).join('');
    const rifts = RIFT_POINTS.map((rift) => `<g class="map-rift"><circle cx="${rift.x}" cy="${rift.y}" r="${mini ? 42 : 58}"></circle>${mini ? '' : `<text x="${rift.x}" y="${rift.y + 15}">✦</text>`}</g>`).join('');
    return `<svg class="${mini ? 'minimap-svg' : 'world-map-svg'}" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true"><rect class="map-vector-bg" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"></rect>${river}${roads}${regions}${interiors}${rifts}</svg>`;
  }

  private pauseHtml(): string {
    const settings = this.save?.settings;
    const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'ambienceVolume', label: string) => `<label class="volume-row"><span>${label}<b>${Math.round((settings?.[key] ?? 0) * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value="${settings?.[key] ?? 0}" data-volume="${key}"></label>`;
    return `<div class="pause-layout v2"><div class="pause-copy"><span class="eyebrow">ВЕРСИЯ 2 • РАСШИРЕННАЯ ДОЛИНА</span><p>Прогресс сохраняется автоматически, включая инвентарь, экипировку, открытые районы и текущую сцену.</p><dl><div><dt>Уровень</dt><dd>${this.snapshot?.level ?? 1}</dd></div><div><dt>Репутация</dt><dd>${this.snapshot?.reputation ?? 0}</dd></div><div><dt>Открыто районов</dt><dd>${this.snapshot?.discoveredLocations.length ?? 0}/9</dd></div><div><dt>Заданий завершено</dt><dd>${this.snapshot?.quests.filter((q) => q.status === 'completed').length ?? 0}</dd></div></dl></div><div class="audio-settings"><h3>Звук</h3>${slider('masterVolume','Общая громкость')}${slider('musicVolume','Музыка')}${slider('sfxVolume','Эффекты')}${slider('ambienceVolume','Окружение')}<button data-toggle-sound>${settings?.sound ? 'ВЫКЛЮЧИТЬ ВЕСЬ ЗВУК' : 'ВКЛЮЧИТЬ ЗВУК'}</button></div><div class="pause-actions"><button data-resume>ПРОДОЛЖИТЬ</button><button data-toggle-motion>${settings?.reducedMotion ? 'АНИМАЦИИ: МИНИМУМ' : 'АНИМАЦИИ: ПОЛНЫЕ'}</button><button data-toggle-quality>КАЧЕСТВО: ${(settings?.quality ?? 'auto').toUpperCase()}</button><button data-fullscreen>ПОЛНЫЙ ЭКРАН</button><button class="danger" data-reset>НАЧАТЬ ЗАНОВО</button></div><div class="controls-card"><h3>Управление</h3><p><kbd>WASD</kbd> Движение</p><p><kbd>E</kbd> Действие / дверь</p><p><kbd>ЛКМ</kbd> / <kbd>Space</kbd> Атака</p><p><kbd>F</kbd> Быстрое зелье</p><p><kbd>Q I M B</kbd> Меню</p></div></div>`;
  }

  private bindPanelActions(): void {
    this.root.querySelectorAll<HTMLElement>('[data-equip]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('equip', button.dataset.equip)));
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('buy', button.dataset.buy)));
    this.root.querySelectorAll<HTMLElement>('[data-claim]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('claim-tier', Number(button.dataset.claim))));
    this.root.querySelectorAll<HTMLElement>('[data-equip-item]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('equip-item', button.dataset.equipItem)));
    this.root.querySelectorAll<HTMLElement>('[data-use-item]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('use-item', button.dataset.useItem)));
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
    this.root.querySelector('[data-reset]')?.addEventListener('click', () => {
      if (window.confirm('Удалить весь прогресс Trupy и начать заново?')) GameEvents.emit('reset-game');
    });
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

  private showAbilityCooldown(dash: number, special: number): void {
    const dashButton = this.root.querySelector<HTMLElement>('.ability-slot.dash');
    const specialButton = this.root.querySelector<HTMLElement>('.ability-slot.special');
    const mobileDash = this.root.querySelector<HTMLElement>('.mobile-button.dash');
    const mobileSpecial = this.root.querySelector<HTMLElement>('.mobile-button.special');
    this.text('#dash-cooldown', dash > 0 ? dash.toFixed(1) : '');
    this.text('#special-cooldown', special > 0 ? special.toFixed(1) : '');
    [dashButton, mobileDash].forEach((button) => button?.classList.toggle('ready', dash <= 0));
    [specialButton, mobileSpecial].forEach((button) => button?.classList.toggle('ready', special <= 0));
  }

  private showCombo(hits: number, multiplier: number): void {
    const banner = this.root.querySelector<HTMLElement>('#combo-banner');
    if (!banner) return;
    if (hits <= 0) { banner.classList.remove('visible'); return; }
    this.text('#combo-hits', hits.toString());
    this.text('#combo-multiplier', `×${multiplier.toFixed(2)}`);
    banner.classList.add('visible');
    banner.classList.toggle('hot', hits >= 6);
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
    this.root.querySelector('#death-screen')?.setAttribute('aria-hidden', 'false');
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
