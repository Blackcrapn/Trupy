import { BATTLE_PASS, QUESTS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { GameEvents } from '../game/events';
import type { DialoguePayload, HudSnapshot, PlayerSave } from '../game/types';

const questStatusLabel: Record<string, string> = {
  available: 'Доступно', active: 'В процессе', ready: 'Можно сдать', completed: 'Завершено',
};

export class GameUI {
  private readonly root: HTMLElement;
  private snapshot?: HudSnapshot;
  private save?: PlayerSave;
  private activePanel?: string;
  private toastTimer?: number;
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
            <span class="mini-zone home"></span><span class="mini-zone village"></span><span class="mini-zone cemetery"></span>
            <span class="mini-zone forest"></span><span class="mini-zone ruins"></span><span class="mini-road r1"></span><span class="mini-road r2"></span>
            <span class="mini-player" id="mini-player"></span>
          </div>
          <span class="location-name" id="location-label">ДОМ ИЗГНАННИКА</span>
        </aside>

        <nav class="quick-nav" aria-label="Игровые меню">
          <button data-panel="journal"><span>Q</span>Задания</button>
          <button data-panel="inventory"><span>I</span>Арсенал</button>
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

        <div class="interaction-prompt" id="interaction-prompt"><kbd>E</kbd><span id="interaction-text">Говорить</span></div>
        <div class="tutorial-tip" id="tutorial-tip"><span class="tutorial-step">ОБУЧЕНИЕ 1/3</span><strong>Начните путь</strong><p>Используйте WASD или левый стик, чтобы двигаться.</p></div>
        <div class="toast" id="toast" role="status"></div>

        <div class="mobile-controls" aria-label="Сенсорное управление">
          <div class="joystick" id="joystick"><span id="joystick-stick"></span></div>
          <div class="mobile-actions">
            <button class="mobile-button heal" data-mobile-action="heal" aria-label="Зелье">♥</button>
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
        <div class="ending-screen" id="ending-screen" aria-hidden="true"><div class="ending-sigil">✺</div><span>ВЕРТИКАЛЬНЫЙ СРЕЗ ЗАВЕРШЁН</span><h2>Проклятие отступило</h2><p>Вы победили Безымянную и доказали, что Долину ещё можно спасти.</p><div class="ending-stats" id="ending-stats"></div><button data-ending-close>ПРОДОЛЖИТЬ ИССЛЕДОВАНИЕ</button></div>
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
      marker.style.left = `${Math.max(3, Math.min(97, x / 2800 * 100))}%`;
      marker.style.top = `${Math.max(4, Math.min(96, y / 1800 * 100))}%`;
    }
    const mapMarker = this.root.querySelector<HTMLElement>('#map-player');
    if (mapMarker) {
      mapMarker.style.left = `${x / 2800 * 100}%`;
      mapMarker.style.top = `${y / 1800 * 100}%`;
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
    };
    const labels: Record<string, [string, string]> = {
      journal: ['ЖУРНАЛ', 'Задания'], inventory: ['АРСЕНАЛ', 'Оружие'], map: ['ДОЛИНА МЁРТВЫХ', 'Карта'],
      pass: ['СЕЗОН I • БЕСПЛАТНО', 'Путь изгнанника'], pause: ['TRUPY', 'Пауза'], shop: ['КУЗНИЦА РУНЫ', 'Магазин оружия'],
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
    const owned = this.snapshot?.ownedWeapons ?? [];
    return `<div class="panel-intro split"><p>Выберите оружие под задачу. Арбалет поражает костяные печати, магия особенно сильна в руинах.</p><div class="coin-chip">◆ ${this.snapshot?.coins ?? 0}</div></div><div class="weapon-grid">${WEAPONS.filter((weapon) => owned.includes(weapon.id)).map((weapon) => `
      <article class="weapon-card ${this.snapshot?.equippedWeapon === weapon.id ? 'equipped' : ''}" style="--accent:${weapon.accent}"><div class="weapon-art">${weapon.icon}</div><span>${weapon.kind.toUpperCase()} • УРОН ${weapon.damage}</span><h3>${weapon.name}</h3><p>${weapon.description}</p><button data-equip="${weapon.id}" ${this.snapshot?.equippedWeapon === weapon.id ? 'disabled' : ''}>${this.snapshot?.equippedWeapon === weapon.id ? 'ЭКИПИРОВАНО' : 'ЭКИПИРОВАТЬ'}</button></article>`).join('')}</div>`;
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
    return `<div class="world-map"><div class="map-zone home"><b>Дом</b></div><div class="map-zone village"><b>Серый Холм</b></div><div class="map-zone cemetery"><b>Кладбище</b></div><div class="map-zone forest"><b>Шепчущий лес</b></div><div class="map-zone ruins"><b>Руины</b></div><span class="map-road road-a"></span><span class="map-road road-b"></span><span class="map-river"></span><span class="map-player" id="map-player"><i></i>ВЫ</span></div><div class="map-legend"><span><i class="safe"></i> Безопасная зона</span><span><i class="danger"></i> Опасная зона</span><span><b>◆</b> Кузница</span><span><b>†</b> Задания</span></div>`;
  }

  private pauseHtml(): string {
    return `<div class="pause-layout"><div class="pause-copy"><p>Прогресс сохраняется автоматически на этом устройстве.</p><dl><div><dt>Уровень</dt><dd>${this.snapshot?.level ?? 1}</dd></div><div><dt>Репутация</dt><dd>${this.snapshot?.reputation ?? 0}</dd></div><div><dt>Заданий завершено</dt><dd>${this.snapshot?.quests.filter((q) => q.status === 'completed').length ?? 0}</dd></div></dl></div><div class="pause-actions"><button data-resume>ПРОДОЛЖИТЬ</button><button data-toggle-sound>${this.save?.settings.sound ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ'}</button><button data-toggle-motion>${this.save?.settings.reducedMotion ? 'АНИМАЦИИ: МИНИМУМ' : 'АНИМАЦИИ: ПОЛНЫЕ'}</button><button data-fullscreen>ПОЛНЫЙ ЭКРАН</button><button class="danger" data-reset>НАЧАТЬ ЗАНОВО</button></div><div class="controls-card"><h3>Управление</h3><p><kbd>WASD</kbd> Движение</p><p><kbd>E</kbd> Действие</p><p><kbd>ЛКМ</kbd> / <kbd>Space</kbd> Атака</p><p><kbd>F</kbd> Зелье</p><p><kbd>Q I M B</kbd> Меню</p></div></div>`;
  }

  private bindPanelActions(): void {
    this.root.querySelectorAll<HTMLElement>('[data-equip]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('equip', button.dataset.equip)));
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('buy', button.dataset.buy)));
    this.root.querySelectorAll<HTMLElement>('[data-claim]').forEach((button) => button.addEventListener('click', () => GameEvents.emit('claim-tier', Number(button.dataset.claim))));
    this.root.querySelector('[data-resume]')?.addEventListener('click', () => this.closePanel());
    this.root.querySelector('[data-toggle-sound]')?.addEventListener('click', () => GameEvents.emit('toggle-sound'));
    this.root.querySelector('[data-toggle-motion]')?.addEventListener('click', () => GameEvents.emit('toggle-motion'));
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
    if (step) step.textContent = `ОБУЧЕНИЕ ${tip.step}/3`;
    if (title) title.textContent = tip.title;
    if (text) text.textContent = tip.text;
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
