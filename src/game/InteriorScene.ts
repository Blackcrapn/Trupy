import Phaser from 'phaser';
import { NPCS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { getItem } from '../data/items';
import { getInterior, type InteriorDefinition } from '../data/world';
import { AudioManager, audio } from '../systems/AudioManager';
import { InventorySystem } from '../systems/InventorySystem';
import { QuestSystem } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { GameUI } from '../ui/GameUI';
import { GameEvents } from './events';
import type { HudSnapshot, PlayerSave } from './types';

interface InteriorData {
  interiorId: string;
  returnX: number;
  returnY: number;
}

export class InteriorScene extends Phaser.Scene {
  private saves!: SaveSystem;
  private inventory!: InventorySystem;
  private quests!: QuestSystem;
  private ui!: GameUI;
  private definition!: InteriorDefinition;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mobileMove = new Phaser.Math.Vector2();
  private facing = new Phaser.Math.Vector2(0, -1);
  private returnPoint = { x: 430, y: 585 };
  private uiLocked = false;
  private chest?: Phaser.GameObjects.Image;
  private exitDoor!: Phaser.GameObjects.Rectangle;
  private npc?: Phaser.GameObjects.Sprite;
  private prompt: 'exit' | 'chest' | 'npc' | undefined;
  private lastStepAt = 0;
  private dashReadyAt = 0;
  private specialReadyAt = 0;
  private isDashing = false;
  private eventDisposers: Array<() => void> = [];

  constructor() { super('InteriorScene'); }

  init(data: InteriorData): void {
    this.definition = getInterior(data.interiorId) ?? getInterior('player_home')!;
    this.returnPoint = { x: data.returnX ?? 430, y: data.returnY ?? 585 };
  }

  create(): void {
    this.saves = new SaveSystem();
    this.inventory = new InventorySystem(this.saves);
    this.quests = new QuestSystem(this.saves);
    this.saves.mutate((save) => { save.currentScene = this.definition.id; }, true);
    audio.setMix(this.audioMix(this.saves.get()));
    audio.setRegion('interior', false);
    this.physics.world.setBounds(0, 0, this.definition.width, this.definition.height);
    this.drawRoom();
    this.createPlayer();
    this.createResident();
    this.setupInput();
    this.setupUi();
    this.cameras.main.setBounds(0, 0, this.definition.width, this.definition.height);
    this.cameras.main.startFollow(this.player, true, .1, .1);
    this.cameras.main.setZoom(this.scale.width < 700 ? 1.05 : 1.55);
    this.cameras.main.fadeIn(360, 9, 10, 16);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(time: number): void {
    this.updatePlayer(time);
    this.updatePrompt();
    GameEvents.emit('ability-cooldown', { dash: Math.max(0, (this.dashReadyAt - time) / 1000), special: Math.max(0, (this.specialReadyAt - time) / 1000) });
    this.player.setDepth(this.player.y / 10 + 20);
  }

  private drawRoom(): void {
    const { width, height, floor, wall, accent, ambience } = this.definition;
    const room = this.add.graphics();
    room.fillStyle(0x090b11, 1).fillRect(0, 0, width, height);
    room.fillStyle(wall, 1).fillRoundedRect(42, 36, width - 84, height - 72, 12);
    room.fillStyle(floor, 1).fillRect(78, 84, width - 156, height - 156);
    room.lineStyle(5, 0x15161d, 1).strokeRect(78, 84, width - 156, height - 156);
    for (let y = 96; y < height - 80; y += 34) room.lineStyle(2, 0x191a22, .35).lineBetween(80, y, width - 80, y);
    for (let x = 95; x < width - 80; x += 70) room.lineStyle(1, 0x747078, .09).lineBetween(x, 88, x, height - 78);
    room.fillStyle(accent, .18).fillRoundedRect(width / 2 - 150, height / 2 - 90, 300, 180, 8);
    room.lineStyle(3, accent, .35).strokeRoundedRect(width / 2 - 150, height / 2 - 90, 300, 180, 8);
    room.fillStyle(0x171821, 1).fillRect(width / 2 - 38, height - 100, 76, 25);
    room.fillStyle(accent, .55).fillRect(width / 2 - 29, height - 98, 58, 5);
    this.exitDoor = this.add.rectangle(width / 2, height - 92, 84, 42, accent, .08).setStrokeStyle(2, accent, .7).setDepth(8);

    const furniture = this.add.graphics().setDepth(8);
    const table = (x: number, y: number, w: number, h: number) => {
      furniture.fillStyle(0x171821, 1).fillRect(x - w / 2 - 3, y - h / 2 + 5, w + 6, h + 5);
      furniture.fillStyle(0x6c4c38, 1).fillRect(x - w / 2, y - h / 2, w, h);
      furniture.lineStyle(2, 0x9b7048, .7).strokeRect(x - w / 2, y - h / 2, w, h);
    };
    const bed = (x: number, y: number) => {
      furniture.fillStyle(0x171821, 1).fillRect(x - 44, y - 26, 88, 52);
      furniture.fillStyle(0x664458, 1).fillRect(x - 40, y - 22, 80, 44);
      furniture.fillStyle(0xc6b9a8, 1).fillRect(x - 36, y - 18, 25, 16);
      furniture.fillStyle(0x8d5970, 1).fillRect(x - 8, y - 18, 44, 36);
    };
    table(235, 220, 130, 64);
    table(width - 215, 230, 110, 58);
    if (ambience === 'home' || ambience === 'house' || ambience === 'inn') bed(205, height - 205);
    if (ambience === 'inn') { table(width / 2, 210, 150, 70); table(width / 2 + 220, height - 210, 120, 55); }
    if (ambience === 'forge') this.drawForge(furniture, width - 190, height - 210);
    if (ambience === 'herbalist') this.drawShelves(furniture, width - 165, height / 2);
    if (ambience === 'chapel') this.drawChapel(furniture, width, height);

    this.add.text(width / 2, 54, this.definition.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#d8d3dc', stroke: '#101119', strokeThickness: 5, letterSpacing: 4,
    }).setOrigin(.5).setDepth(15);

    if (this.definition.chest) {
      const opened = Boolean(this.saves.get().flags[`interior-chest:${this.definition.id}`]);
      this.chest = this.add.image(width - 145, height - 145, opened ? 'chest-open' : 'chest-closed').setScale(2.2).setDepth((height - 145) / 10 + 10);
    }
    this.createInteriorParticles();
  }

  private drawForge(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x171821, 1).fillRect(x - 70, y - 55, 140, 110);
    graphics.fillStyle(0x4d3430, 1).fillRect(x - 62, y - 47, 124, 94);
    graphics.fillStyle(0xff633d, .85).fillCircle(x, y + 12, 38);
    graphics.fillStyle(0xffcf67, .9).fillCircle(x, y + 18, 20);
    for (let index = 0; index < 9; index += 1) {
      const ember = this.add.image(x + Phaser.Math.Between(-35, 35), y + Phaser.Math.Between(-5, 25), 'ember').setDepth(30).setScale(1.4);
      this.tweens.add({ targets: ember, y: ember.y - Phaser.Math.Between(45, 90), x: ember.x + Phaser.Math.Between(-18, 18), alpha: 0, duration: Phaser.Math.Between(900, 1800), repeat: -1, delay: index * 120 });
    }
  }

  private drawShelves(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x171821, 1).fillRect(x - 75, y - 150, 150, 300);
    graphics.fillStyle(0x594737, 1).fillRect(x - 68, y - 143, 136, 286);
    for (let row = -105; row <= 105; row += 70) {
      graphics.fillStyle(0x2b352c, 1).fillRect(x - 58, y + row, 116, 8);
      for (let bottle = -42; bottle <= 42; bottle += 28) {
        graphics.fillStyle([0x79b87a, 0x9c70b5, 0xc58a55][Math.abs(bottle / 28) % 3], 1).fillRect(x + bottle - 6, y + row - 22, 12, 20);
      }
    }
  }

  private drawChapel(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
    for (let row = 0; row < 3; row += 1) {
      const y = 200 + row * 105;
      graphics.fillStyle(0x171821, 1).fillRect(210, y, width - 420, 25);
      graphics.fillStyle(0x514a50, 1).fillRect(220, y - 5, width - 440, 20);
    }
    graphics.fillStyle(0x171821, 1).fillRect(width / 2 - 55, 105, 110, 80);
    graphics.fillStyle(0x756682, 1).fillRect(width / 2 - 48, 112, 96, 66);
    graphics.fillStyle(0xb59ac4, 1).fillRect(width / 2 - 4, 120, 8, 48);
    graphics.fillRect(width / 2 - 24, 135, 48, 8);
  }

  private createInteriorParticles(): void {
    const count = this.saves.get().settings.quality === 'low' ? 8 : 20;
    for (let index = 0; index < count; index += 1) {
      const mote = this.add.image(Phaser.Math.Between(90, this.definition.width - 90), Phaser.Math.Between(90, this.definition.height - 90), 'pixel')
        .setTint(this.definition.accent).setAlpha(Phaser.Math.FloatBetween(.08, .3)).setDepth(4).setScale(Phaser.Math.FloatBetween(.5, 1.5));
      this.tweens.add({ targets: mote, y: mote.y - Phaser.Math.Between(18, 45), alpha: .02, duration: Phaser.Math.Between(1800, 3600), yoyo: true, repeat: -1 });
    }
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(this.definition.width / 2, this.definition.height - 145, 'hero-up-0').setScale(1.65).setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 12).setOffset(8, 26);
  }

  private createResident(): void {
    const residentByRoom: Record<string, string> = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran' };
    const npcId = residentByRoom[this.definition.id];
    if (!npcId) return;
    const index = NPCS.findIndex((entry) => entry.id === npcId);
    this.npc = this.add.sprite(this.definition.width / 2 + 190, 190, `npc-${Math.max(0, index)}`).setScale(1.72).setDepth(30);
    const npc = NPCS[index];
    this.add.text(this.npc.x, this.npc.y - 46, npc.name, { fontFamily: 'monospace', fontSize: '10px', color: '#e7e0e8', stroke: '#11131a', strokeThickness: 4 }).setOrigin(.5).setDepth(32);
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,I,R,SHIFT,ESC,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  private setupUi(): void {
    this.ui = new GameUI();
    this.ui.mount();
    GameEvents.emit('location', this.definition.name);
    GameEvents.emit('tutorial', null);
    this.emitHud();
    this.listen<boolean>('ui-lock', (locked) => { this.uiLocked = locked; if (locked) this.player.setVelocity(0); });
    this.listen<{ x: number; y: number }>('ui-move', (vector) => this.mobileMove.set(vector.x, vector.y));
    this.listen<void>('ui-interact', () => { if (!this.uiLocked) this.interact(); });
    this.listen<void>('ui-attack', () => this.interiorAttack());
    this.listen<void>('ui-dash', () => this.dash());
    this.listen<void>('ui-special', () => this.interiorSpecial());
    this.listen<void>('ui-heal', () => this.useItem('blood_vial'));
    this.listen<string>('equip', (id) => { this.inventory.equip(id); audio.ui(); this.emitHud(); });
    this.listen<string>('equip-item', (id) => { this.inventory.equip(id); audio.ui(); this.emitHud(); });
    this.listen<string>('use-item', (id) => this.useItem(id));
    this.listen<{ itemId?: string; direction?: 'toChest' | 'toInventory' }>('transfer-item', ({ itemId, direction }) => {
      if (itemId && direction && this.inventory.transfer(itemId, 1, direction)) { audio.pickup(); this.emitHud(); }
    });
    this.listen<void>('toggle-sound', () => this.toggleSound());
    this.listen<{ key?: keyof PlayerSave['settings']; value?: number }>('set-volume', ({ key, value }) => this.setVolume(key, value));
    this.listen<void>('toggle-motion', () => this.toggleMotion());
    this.listen<void>('toggle-quality', () => this.toggleQuality());
    this.listen<void>('fullscreen', () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); });
    this.listen<void>('open-shop', () => GameEvents.emit('panel-open', 'shop'));
    this.listen<void>('reset-game', () => { this.saves.reset(); window.location.reload(); });
  }

  private updatePlayer(time: number): void {
    if (this.uiLocked) { this.player.setVelocity(0); this.player.anims.stop(); return; }
    if (this.isDashing) return;
    const input = new Phaser.Math.Vector2(
      (this.keys.D.isDown || this.cursors.right.isDown ? 1 : 0) - (this.keys.A.isDown || this.cursors.left.isDown ? 1 : 0),
      (this.keys.S.isDown || this.cursors.down.isDown ? 1 : 0) - (this.keys.W.isDown || this.cursors.up.isDown ? 1 : 0),
    );
    if (this.mobileMove.lengthSq() > .02) input.copy(this.mobileMove);
    if (input.lengthSq() > 1) input.normalize();
    const speed = 165 + this.inventory.speedBonus();
    this.player.setVelocity(input.x * speed, input.y * speed);
    if (input.lengthSq() > .02) {
      this.facing.copy(input).normalize();
      const direction = Math.abs(input.x) > Math.abs(input.y) ? 'side' : input.y < 0 ? 'up' : 'down';
      this.player.play(`hero-walk-${direction}`, true).setFlipX(direction === 'side' && input.x < 0);
      if (time > this.lastStepAt + 340) { audio.step('wood'); this.lastStepAt = time; }
    } else {
      this.player.setVelocity(0); this.player.anims.stop();
      const direction = Math.abs(this.facing.x) > Math.abs(this.facing.y) ? 'side' : this.facing.y < 0 ? 'up' : 'down';
      this.player.setTexture(`hero-${direction}-0`).setFlipX(direction === 'side' && this.facing.x < 0);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.useItem('blood_vial');
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) GameEvents.emit('panel-open', 'inventory');
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) GameEvents.emit('panel-open', 'pause');
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.interiorAttack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) this.dash();
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.interiorSpecial();
  }

  private updatePrompt(): void {
    const candidates: Array<{ type: 'exit' | 'chest' | 'npc'; x: number; y: number; label: string }> = [
      { type: 'exit', x: this.exitDoor.x, y: this.exitDoor.y, label: 'Выйти наружу' },
    ];
    if (this.chest) candidates.push({ type: 'chest', x: this.chest.x, y: this.chest.y, label: 'Открыть сундук' });
    if (this.npc) candidates.push({ type: 'npc', x: this.npc.x, y: this.npc.y, label: 'Поговорить' });
    const nearest = candidates
      .map((candidate) => ({ ...candidate, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y) }))
      .filter((candidate) => candidate.distance < 86)
      .sort((a, b) => a.distance - b.distance)[0];
    const next = nearest?.type;
    if (next !== this.prompt) { this.prompt = next; GameEvents.emit('prompt', { text: nearest?.label }); }
  }

  private interact(): void {
    if (this.prompt === 'exit') return this.exitInterior();
    if (this.prompt === 'chest') {
      if (this.chest && !this.saves.get().flags[`interior-chest:${this.definition.id}`]) {
        this.saves.mutate((save) => { save.flags[`interior-chest:${this.definition.id}`] = true; }, true);
        this.chest.setTexture('chest-open');
        const reward = this.definition.id === 'forge' ? 'ash_crystal' : this.definition.id === 'herbalist' ? 'greater_vial' : 'bone_shard';
        this.inventory.add(reward, this.definition.id === 'player_home' ? 3 : 1, true);
        audio.chest();
        GameEvents.emit('loot', { itemId: reward, quantity: this.definition.id === 'player_home' ? 3 : 1 });
      }
      GameEvents.emit('panel-open', 'chest');
      this.emitHud();
      return;
    }
    if (this.prompt === 'npc') this.openResidentDialogue();
  }

  private openResidentDialogue(): void {
    const residentByRoom: Record<string, string> = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran' };
    const npcId = residentByRoom[this.definition.id];
    const npc = NPCS.find((entry) => entry.id === npcId);
    if (!npc) return;
    const text: Record<string, string> = {
      runa: 'Внутри кузницы металл говорит громче людей. Если слышишь звон — значит, оружие ещё живо.',
      vesna: 'Здесь безопасно трогать почти всё. Банку с чёрной крышкой лучше не открывай.',
      elira: 'Дом стал тише после твоего возвращения. Иногда тишина — тоже награда.',
      gran: 'Под часовней есть склеп. Пока печати держатся, мёртвые остаются внизу.',
    };
    GameEvents.emit('dialogue', { speaker: npc.name, subtitle: npc.role.toUpperCase(), text: text[npcId] ?? 'Добро пожаловать.', accent: `#${npc.accent.toString(16).padStart(6, '0')}`, actions: [{ label: npcId === 'runa' ? 'Открыть магазин' : 'Продолжить', event: npcId === 'runa' ? 'open-shop' : 'close', primary: true }, { label: 'Уйти', event: 'close' }] });
  }

  private dash(): void {
    if (this.uiLocked || this.isDashing || this.time.now < this.dashReadyAt) return;
    const direction = this.mobileMove.lengthSq() > .05 ? this.mobileMove.clone().normalize() : this.facing.clone().normalize();
    this.dashReadyAt = this.time.now + 1800;
    this.isDashing = true;
    this.player.setVelocity(direction.x * 520, direction.y * 520).setAlpha(.7);
    audio.attack('ranged');
    this.time.delayedCall(170, () => { this.isDashing = false; this.player.setAlpha(1).setVelocity(0); });
  }

  private interiorSpecial(): void {
    if (this.uiLocked || this.time.now < this.specialReadyAt) return;
    this.specialReadyAt = this.time.now + 4500;
    audio.attack('magic');
    const ring = this.add.circle(this.player.x, this.player.y, 26, 0xb46dcc, .4).setStrokeStyle(5, 0xf0ccff, .9).setDepth(90);
    this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
  }

  private interiorAttack(): void {
    if (this.uiLocked) return;
    const weapon = WEAPONS.find((entry) => entry.id === this.saves.get().equippedWeapon) ?? WEAPONS[0];
    audio.attack(weapon.kind);
    const x = this.player.x + this.facing.x * 38;
    const y = this.player.y + this.facing.y * 38;
    const slash = this.add.rectangle(x, y, 46, 10, Phaser.Display.Color.HexStringToColor(weapon.accent).color, .8).setRotation(this.facing.angle()).setDepth(80);
    this.tweens.add({ targets: slash, scaleX: 1.6, alpha: 0, duration: 150, onComplete: () => slash.destroy() });
  }

  private exitInterior(): void {
    audio.door();
    this.saves.mutate((save) => { save.currentScene = 'world'; save.playerPosition = { ...this.returnPoint }; }, true);
    this.cameras.main.fadeOut(300, 8, 9, 14);
    this.time.delayedCall(310, () => this.scene.start('WorldScene', { spawnX: this.returnPoint.x, spawnY: this.returnPoint.y, fromInterior: true }));
  }

  private useItem(itemId: string): void {
    const result = this.inventory.use(itemId);
    GameEvents.emit('toast', result.message);
    if (result.used) {
      if (result.effect === 'heal') audio.heal();
      else audio.ui();
      this.emitHud();
    }
  }

  private emitHud(): void {
    const save = this.saves.get();
    const active = this.quests.activeObjective();
    const objective = active ? active.quest.objectives[active.progress.objectiveIndex] : undefined;
    const snapshot: HudSnapshot = {
      health: save.health, maxHealth: this.inventory.maxHealth(), level: save.level, xp: save.xp, xpNext: XP_FOR_LEVEL(save.level), coins: save.coins,
      reputation: save.reputation, potions: this.inventory.quantity('blood_vial'), equippedWeapon: save.equippedWeapon, ownedWeapons: [...save.ownedWeapons],
      inventory: save.inventory.map((stack) => ({ ...stack })), chest: save.chest.map((stack) => ({ ...stack })), equipment: structuredClone(save.equipment),
      discoveredLocations: [...save.discoveredLocations], currentScene: this.definition.id, settings: { ...save.settings },
      activeQuest: active && objective ? { title: active.quest.title, objective: objective.label, amount: active.progress.amount, required: objective.amount, ready: active.progress.status === 'ready' } : undefined,
      quests: this.quests.snapshotQuests(), claimedTiers: [...save.claimedTiers], tutorialDone: save.tutorialDone,
    };
    GameEvents.emit('hud', { snapshot, save: structuredClone(save) });
  }

  private toggleSound(): void {
    this.saves.mutate((save) => { save.settings.sound = !save.settings.sound; }, true);
    audio.setMix(this.audioMix(this.saves.get())); this.emitHud();
  }

  private setVolume(key?: keyof PlayerSave['settings'], value?: number): void {
    if (!key || typeof value !== 'number' || !key.endsWith('Volume')) return;
    this.saves.mutate((save) => { (save.settings[key] as number) = value; }, true);
    audio.setMix(this.audioMix(this.saves.get()));
  }

  private toggleMotion(): void {
    this.saves.mutate((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; }, true);
    document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion); this.emitHud();
  }

  private toggleQuality(): void {
    const order: PlayerSave['settings']['quality'][] = ['auto', 'high', 'low'];
    this.saves.mutate((save) => { save.settings.quality = order[(order.indexOf(save.settings.quality) + 1) % order.length]; }, true);
    document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low'); this.emitHud();
  }

  private audioMix(save: PlayerSave) {
    return { enabled: save.settings.sound, master: save.settings.masterVolume, music: save.settings.musicVolume, sfx: save.settings.sfxVolume, ambience: save.settings.ambienceVolume };
  }

  private listen<T>(event: string, callback: (payload: T) => void): void {
    GameEvents.on(event, callback); this.eventDisposers.push(() => GameEvents.off(event, callback));
  }

  private cleanup(): void {
    this.eventDisposers.forEach((dispose) => dispose()); this.eventDisposers = [];
    this.ui?.destroy(); this.saves?.flush();
  }
}
