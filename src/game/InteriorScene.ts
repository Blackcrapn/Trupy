import Phaser from 'phaser';
import { NPCS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { getItem } from '../data/items';
import { getInterior, type InteriorDefinition } from '../data/world';
import { AudioManager, audio } from '../systems/AudioManager';
import { InventorySystem } from '../systems/InventorySystem';
import { QuestSystem } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { WeaponShopSystem } from '../systems/WeaponShopSystem';
import { CraftingSystem } from '../systems/CraftingSystem';
import { detonateSmokeBomb } from '../systems/combat/SmokeBomb';
import { LightingSystem, FLAME_LIGHT, FORGE_LIGHT } from '../systems/world/Lighting';
import { HERO_DIRS, heroKey, type HeroDir, type HeroPose } from '../systems/sprites/hero';
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
  private shop!: WeaponShopSystem;
  private quests!: QuestSystem;
  private crafting!: CraftingSystem;
  private ui!: GameUI;
  private lighting!: LightingSystem;
  private definition!: InteriorDefinition;
  private player!: Phaser.Physics.Arcade.Sprite;
  private heldWeapon!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mobileMove = new Phaser.Math.Vector2();
  private facing = new Phaser.Math.Vector2(0, -1);
  private heroDir: HeroDir = 'down';
  private heroPose: HeroPose = 'idle';
  private heroPoseUntil = 0;
  /** The anvil in Runa's forge, if this interior is the forge. */
  private anvil?: Phaser.GameObjects.Image;
  /** Hearth/candle light sources collected while dressing, lit in createLighting. */
  private lightSources: Array<{ x: number; y: number; radius: number; preset: typeof FLAME_LIGHT | typeof FORGE_LIGHT; intensity?: number }> = [];
  private returnPoint = { x: 430, y: 585 };
  private uiLocked = false;
  private chest?: Phaser.GameObjects.Image;
  private exitDoor!: Phaser.GameObjects.Rectangle;
  private npc?: Phaser.GameObjects.Sprite;
  private prompt: 'exit' | 'chest' | 'npc' | 'anvil' | undefined;
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
    this.shop = new WeaponShopSystem(this.saves);
    this.quests = new QuestSystem(this.saves);
    this.crafting = new CraftingSystem(this.saves, this.inventory);
    this.saves.mutate((save) => { save.currentScene = this.definition.id; }, true);
    audio.setMix(this.audioMix(this.saves.get()));
    audio.setRegion('interior', false);
    this.physics.world.setBounds(0, 0, this.definition.width, this.definition.height);
    this.drawRoom();
    this.createLighting();
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

  update(time: number, delta: number): void {
    this.updatePlayer(time);
    this.updatePrompt();
    GameEvents.emit('ability-cooldown', { dash: Math.max(0, (this.dashReadyAt - time) / 1000), special: Math.max(0, (this.specialReadyAt - time) / 1000) });
    this.player.setDepth(this.player.y / 10 + 20);
    // Drive the hearth/candle flicker. The day length is set enormous in
    // createLighting so the fixed dim tint barely drifts over an interior visit —
    // the room is lit by its light sources, not a day/night cycle.
    this.lighting?.update(delta);
    this.syncHeldWeapon();
  }

  private drawRoom(): void {
    const { width, height, floor, wall, accent } = this.definition;
    this.lightSources = [];
    const room = this.add.graphics();
    room.fillStyle(0x090b11, 1).fillRect(0, 0, width, height);
    room.fillStyle(wall, 1).fillRoundedRect(42, 36, width - 84, height - 72, 12);
    room.fillStyle(floor, 1).fillRect(78, 84, width - 156, height - 156);
    room.lineStyle(5, 0x15161d, 1).strokeRect(78, 84, width - 156, height - 156);
    for (let y = 96; y < height - 80; y += 34) room.lineStyle(2, 0x191a22, .35).lineBetween(80, y, width - 80, y);
    for (let x = 95; x < width - 80; x += 70) room.lineStyle(1, 0x747078, .09).lineBetween(x, 88, x, height - 78);
    // Exit doorway at the bottom-centre.
    room.fillStyle(0x171821, 1).fillRect(width / 2 - 38, height - 100, 76, 25);
    room.fillStyle(accent, .55).fillRect(width / 2 - 29, height - 98, 58, 5);
    this.exitDoor = this.add.rectangle(width / 2, height - 92, 84, 42, accent, .08).setStrokeStyle(2, accent, .7).setDepth(8);

    // Recognisable dressing per interior, built from the sculpted prop sprites.
    this.dressRoom();

    this.add.text(width / 2, 54, this.definition.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: '#d8d3dc', stroke: '#101119', strokeThickness: 5, letterSpacing: 4,
    }).setOrigin(.5).setDepth(15);

    if (this.definition.chest) {
      const opened = Boolean(this.saves.get().flags[`interior-chest:${this.definition.id}`]);
      this.chest = this.add.image(width - 145, height - 145, opened ? 'chest-open' : 'chest-closed').setScale(2.2).setDepth((height - 145) / 10 + 10);
    }
    this.createInteriorParticles();
  }

  /** Depth-sorted prop placement helper. */
  private prop(x: number, y: number, key: string, scale = 2, depthBias = 6): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(scale).setDepth(y / 10 + depthBias);
  }

  /** Register a warm light emitter to be lit in createLighting. */
  private addHearth(x: number, y: number, radius: number, forge = false, intensity?: number): void {
    this.lightSources.push({ x, y, radius, preset: forge ? FORGE_LIGHT : FLAME_LIGHT, intensity });
  }

  /**
   * Dresses the room according to its `ambience`, giving each interior a distinct
   * identity out of the sculpted prop textures. Every branch also seeds the
   * `lightSources` list with its hearth/candles so createLighting can make the
   * room feel lit from within.
   */
  private dressRoom(): void {
    const { width, height, ambience } = this.definition;
    // Wall torches flanking the exit door read as a lit threshold in every room.
    this.prop(width / 2 - 150, height - 96, 'torch-wall', 2, 8);
    this.prop(width / 2 + 150, height - 96, 'torch-wall', 2, 8);
    this.addHearth(width / 2 - 150, height - 104, 92, false, 0.5);
    this.addHearth(width / 2 + 150, height - 104, 92, false, 0.5);

    switch (ambience) {
      case 'home': this.dressHome(); break;
      case 'inn': this.dressInn(); break;
      case 'forge': this.dressForge(); break;
      case 'herbalist': this.dressHerbalist(); break;
      case 'house': this.dressHouse(); break;
      case 'chapel': this.dressChapel(); break;
      case 'marsh': this.dressMarsh(); break;
      case 'warehouse': this.dressWarehouse(); break;
      case 'citadel': this.dressCitadel(); break;
    }
  }

  /** A modest cottage: bed, hearth brazier, a barrel and crate. */
  private dressHome(): void {
    const { width, height } = this.definition;
    this.drawBed(205, height - 200);
    this.prop(width - 170, height - 175, 'barrel', 2.1);
    this.prop(width - 235, height - 165, 'crate', 2);
    this.prop(230, 200, 'brazier-lit', 2.1);
    this.addHearth(230, 190, 150, false, 0.7);
    this.prop(width - 200, 195, 'sack', 2);
  }

  /** The inn: long tables, benches implied by stools, barrels of ale, a hearth. */
  private dressInn(): void {
    const { width, height } = this.definition;
    this.drawBed(200, height - 195);
    this.drawTable(width / 2, 220, 3);
    this.drawTable(width / 2 + 210, height - 205, 2);
    this.prop(width - 175, 200, 'barrel', 2.2);
    this.prop(width - 230, 215, 'barrel', 2);
    this.prop(150, 210, 'brazier-lit', 2.1);
    this.addHearth(150, 200, 155, false, 0.72);
    this.prop(width - 150, height - 200, 'crate', 2);
  }

  /** Runa's forge: the anvil (interactable), roaring forge fire, crates of ore. */
  private dressForge(): void {
    const { width, height } = this.definition;
    // The forge fire against the back wall — the hot heart of the room.
    this.prop(width - 200, 210, 'forge-fire', 2.3);
    this.addHearth(width - 200, 205, 235, true, 0.9);
    this.emberFountain(width - 200, 215);
    // Braziers throwing extra heat.
    this.prop(160, 220, 'brazier-lit', 2.1);
    this.addHearth(160, 210, 150, true, 0.7);
    // The anvil, front-and-centre and interactable to open crafting.
    this.anvil = this.prop(width / 2 - 30, height / 2 + 30, 'anvil', 2.6, 10);
    // Materials around the workspace.
    this.prop(width / 2 + 150, height / 2 + 70, 'crate', 2.1);
    this.prop(width / 2 + 210, height / 2 + 40, 'ore-vein', 2);
    this.prop(width - 150, height - 175, 'barrel', 2.1);
    this.prop(220, height - 175, 'crate', 2);
  }

  /** The herbalist: shelves of bottles, hanging herbs, a glowing cap or two. */
  private dressHerbalist(): void {
    const { width, height } = this.definition;
    this.drawShelf(width - 160, 175);
    this.drawShelf(width - 160, height - 210);
    this.drawTable(280, height / 2, 2);
    this.prop(200, 200, 'mushroom-cluster', 2.2);
    this.prop(width / 2, height - 165, 'glowcap', 2.4);
    this.addHearth(width / 2, height - 168, 120, false, 0.55);
    this.prop(width / 2 + 70, height - 175, 'glowcap', 2);
    this.addHearth(width / 2 + 70, height - 178, 100, false, 0.5);
    this.prop(230, 210, 'sack', 1.9);
    this.prop(width - 250, height / 2 + 40, 'barrel', 2);
  }

  /** Elira's house: a tidy home — bed, table, a candle brazier, a keepsake charm. */
  private dressHouse(): void {
    const { width, height } = this.definition;
    this.drawBed(205, height - 190);
    this.drawTable(width - 230, 210, 2);
    this.prop(200, 205, 'brazier-lit', 2);
    this.addHearth(200, 197, 145, false, 0.68);
    this.prop(width - 175, height - 175, 'crate', 1.9);
    this.prop(width / 2 + 40, height / 2 + 20, 'charm', 2.4, 10);
    this.prop(width - 260, height - 185, 'sack', 1.9);
  }

  /** Chapel + crypt: pews (benches), a shrine altar, cold candle braziers. */
  private dressChapel(): void {
    const { width, height } = this.definition;
    // Pews down the nave.
    for (let row = 0; row < 3; row += 1) {
      const y = 210 + row * 120;
      this.drawBench(width / 2 - 130, y);
      this.drawBench(width / 2 + 130, y);
    }
    // The altar at the head of the chapel.
    this.prop(width / 2, 150, 'altar', 2.2, 12);
    this.addHearth(width / 2, 150, 150, false, 0.55);
    // Candle braziers flanking it.
    this.prop(width / 2 - 150, 165, 'brazier-lit', 1.9);
    this.prop(width / 2 + 150, 165, 'brazier-lit', 1.9);
    this.addHearth(width / 2 - 150, 158, 120, false, 0.6);
    this.addHearth(width / 2 + 150, 158, 120, false, 0.6);
    // A hint of the crypt below: bones and a skull in a corner.
    this.prop(150, height - 165, 'bones', 2);
    this.prop(200, height - 150, 'skull', 2);
  }

  /** Marsh hut (Iva): a still/cauldron feel — barrels, reeds, bog bottles, brew. */
  private dressMarsh(): void {
    const { width, height } = this.definition;
    this.drawShelf(width - 160, height / 2);
    this.drawTable(260, height - 200, 2);
    this.prop(200, 200, 'brazier-lit', 2);
    this.addHearth(200, 192, 150, false, 0.68);
    // Reeds and marsh flora brought indoors.
    for (let index = 0; index < 4; index += 1) {
      this.prop(150 + index * 60, 150, 'reeds', 1.8, 7);
    }
    this.prop(width / 2 + 40, height / 2 + 40, 'mushroom-cluster', 2.1);
    this.prop(width - 250, height - 180, 'barrel', 2);
    this.prop(width / 2 + 150, height - 170, 'glowcap', 2.1);
    this.addHearth(width / 2 + 150, height - 173, 95, false, 0.45);
  }

  /** Dock warehouse: stacked crates, barrels, sacks, coils of chain. */
  private dressWarehouse(): void {
    const { width, height } = this.definition;
    // Rows of stacked crates and barrels.
    const layout: Array<[number, number, string]> = [
      [180, 180, 'crate'], [250, 195, 'barrel'], [320, 180, 'crate'],
      [width - 320, 185, 'barrel'], [width - 250, 175, 'crate'], [width - 180, 195, 'sack'],
      [200, height - 175, 'barrel'], [270, height - 165, 'crate'], [340, height - 178, 'sack'],
      [width - 260, height - 175, 'crate'], [width - 190, height - 165, 'barrel'],
    ];
    for (const [x, y, key] of layout) this.prop(x, y, key, 2.05);
    // A hanging lantern for work light.
    this.prop(width / 2, 150, 'lantern-on', 2.2, 8);
    this.addHearth(width / 2, 158, 165, false, 0.6);
    this.prop(width / 2 + 90, 150, 'chain', 2, 6);
    this.prop(width / 2 - 90, 150, 'chain', 2, 6);
  }

  /** Citadel gatehouse: a war-room — banners, weapon crates, braziers, statue. */
  private dressCitadel(): void {
    const { width, height } = this.definition;
    // Banners flanking the far wall.
    this.prop(150, 165, 'banner', 2.2, 8);
    this.prop(width - 150, 165, 'banner', 2.2, 8);
    // Braziers throwing hot citadel light.
    this.prop(280, 190, 'brazier-lit', 2.2);
    this.prop(width - 280, 190, 'brazier-lit', 2.2);
    this.addHearth(280, 182, 175, true, 0.78);
    this.addHearth(width - 280, 182, 175, true, 0.78);
    // A grim statue watching the gate.
    this.prop(width / 2, 160, 'statue', 2.4, 12);
    // Weapon crates and barrels along the walls.
    this.prop(200, height - 175, 'crate', 2.1);
    this.prop(270, height - 165, 'crate', 2);
    this.prop(width - 210, height - 175, 'barrel', 2.1);
    this.prop(width - 280, height - 165, 'crate', 2);
  }

  // ---- small furniture built from primitives (kept, but sharpened) --------

  private drawBed(x: number, y: number): void {
    const g = this.add.graphics().setDepth(y / 10 + 6);
    g.fillStyle(0x171821, 1).fillRect(x - 46, y - 26, 92, 54);
    g.fillStyle(0x4a3327, 1).fillRect(x - 44, y - 24, 88, 50);
    g.fillStyle(this.definition.accent, .5).fillRect(x - 40, y - 20, 76, 42);
    g.fillStyle(0xc6b9a8, 1).fillRect(x - 36, y - 16, 26, 18);
    g.lineStyle(2, 0x9b7048, .6).strokeRect(x - 44, y - 24, 88, 50);
  }

  private drawTable(x: number, y: number, stools = 0): void {
    const g = this.add.graphics().setDepth(y / 10 + 6);
    g.fillStyle(0x171821, 1).fillRect(x - 66, y - 30, 132, 60);
    g.fillStyle(0x6c4c38, 1).fillRect(x - 62, y - 26, 124, 52);
    g.lineStyle(2, 0x9b7048, .7).strokeRect(x - 62, y - 26, 124, 52);
    for (let index = 0; index < stools; index += 1) {
      const sx = x - 44 + index * 44;
      g.fillStyle(0x4a3327, 1).fillCircle(sx, y + 44, 12);
      g.fillStyle(0x6c4c38, 1).fillCircle(sx, y + 42, 9);
    }
  }

  private drawBench(x: number, y: number): void {
    const g = this.add.graphics().setDepth(y / 10 + 6);
    g.fillStyle(0x171821, 1).fillRect(x - 84, y - 8, 168, 20);
    g.fillStyle(0x514a50, 1).fillRect(x - 80, y - 6, 160, 16);
    g.lineStyle(1, 0x736a78, .5).strokeRect(x - 80, y - 6, 160, 16);
  }

  private drawShelf(x: number, y: number): void {
    const g = this.add.graphics().setDepth(y / 10 + 6);
    g.fillStyle(0x171821, 1).fillRect(x - 66, y - 92, 132, 184);
    g.fillStyle(0x4a3b2c, 1).fillRect(x - 60, y - 86, 120, 172);
    const bottle = [0x79b87a, 0x9c70b5, 0xc58a55, 0x6fa8c0];
    for (let row = -60; row <= 60; row += 60) {
      g.fillStyle(0x2b2620, 1).fillRect(x - 52, y + row, 104, 7);
      for (let b = -38; b <= 38; b += 26) {
        g.fillStyle(bottle[Math.abs(b / 26) % bottle.length], .95).fillRect(x + b - 5, y + row - 20, 11, 19);
        g.fillStyle(0xffffff, .12).fillRect(x + b - 3, y + row - 18, 3, 14);
      }
    }
    g.lineStyle(2, 0x6a5540, .6).strokeRect(x - 60, y - 86, 120, 172);
  }

  /** A rising fountain of embers over a forge/fire, respecting quality. */
  private emberFountain(x: number, y: number): void {
    const count = this.saves.get().settings.quality === 'low' ? 4 : this.saves.get().settings.reducedMotion ? 5 : 9;
    for (let index = 0; index < count; index += 1) {
      const ember = this.add.image(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-6, 20), 'ember').setDepth(40).setScale(1.4);
      this.tweens.add({ targets: ember, y: ember.y - Phaser.Math.Between(45, 95), x: ember.x + Phaser.Math.Between(-16, 16), alpha: 0, duration: Phaser.Math.Between(900, 1800), repeat: -1, delay: index * 130 });
    }
  }

  /**
   * Interiors are lit by their own hearth/candles rather than a day/night cycle.
   * We pin the daylight tint to a fixed dim value and set an enormous day length
   * so it barely drifts during a visit, then punch warm light back through it
   * from every emitter the dressing pass registered.
   */
  private createLighting(): void {
    const save = this.saves.get();
    const low = save.settings.quality === 'low' || (save.settings.quality === 'auto' && this.scale.width < 700);
    this.lighting = new LightingSystem(this);
    this.lighting.create();
    // Effectively freeze the cycle: a day is ~28 hours of real play, so the fixed
    // interior gloom never noticeably brightens or darkens while inside.
    this.lighting.setDayLength(100000);
    // A dim, indoor value — well into evening so the hearths clearly matter.
    this.lighting.setDayProgress(0.8);
    if (low) {
      // On weak hardware keep only the two brightest hearths so night still reads.
      const brightest = [...this.lightSources].sort((a, b) => (b.intensity ?? b.preset.intensity) - (a.intensity ?? a.preset.intensity)).slice(0, 2);
      for (const light of brightest) {
        this.lighting.addLight({ x: light.x, y: light.y, radius: light.radius, ...light.preset, ...(light.intensity !== undefined ? { intensity: light.intensity } : {}) });
      }
      return;
    }
    for (const light of this.lightSources) {
      this.lighting.addLight({ x: light.x, y: light.y, radius: light.radius, ...light.preset, ...(light.intensity !== undefined ? { intensity: light.intensity } : {}) });
    }
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
    this.player = this.physics.add.sprite(this.definition.width / 2, this.definition.height - 145, heroKey('up', 'idle', 0)).setScale(1.65).setCollideWorldBounds(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 12).setOffset(8, 26);
    this.heldWeapon = this.add.image(this.player.x, this.player.y, `held-${this.saves.get().equippedWeapon}`).setScale(1.45).setOrigin(.2, .5).setDepth(25);
    this.syncHeldWeapon();
  }

  private syncHeldWeapon(): void {
    if (!this.heldWeapon?.scene) return;
    const weaponId = this.saves.get().equippedWeapon;
    if (this.heldWeapon.texture.key !== `held-${weaponId}`) this.heldWeapon.setTexture(`held-${weaponId}`);
    document.documentElement.dataset.heldWeapon = weaponId;
    this.heldWeapon.setPosition(this.player.x + this.facing.x * 10, this.player.y + 5 + this.facing.y * 9).setRotation(this.facing.angle()).setAlpha(this.player.alpha);
    this.heldWeapon.setDepth(this.facing.y < -.35 ? this.player.depth - 1 : this.player.depth + 2);
  }

  private createResident(): void {
    const residentByRoom: Record<string, string> = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran', marsh_hut: 'iva', dock_house: 'ferryman', citadel_gatehouse: 'serah' };
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
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,I,R,Z,X,V,SHIFT,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.uiLocked) this.cycleWeapon(deltaY > 0 ? 1 : -1);
    });
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
    this.listen<string>('equip', (id) => this.equipWeapon(id));
    this.listen<string>('buy', (id) => this.buyWeapon(id));
    this.listen<string>('equip-item', (id) => { this.inventory.equip(id); audio.ui(); this.emitHud(); });
    this.listen<string>('use-item', (id) => this.useItem(id));
    this.listen<number>('use-quick-slot', (index) => this.useQuickSlot(index));
    this.listen<{ itemId?: string; slot?: number }>('assign-quick-slot', ({ itemId, slot }) => {
      if (itemId && typeof slot === 'number' && this.inventory.setQuickSlot(slot, itemId)) { audio.ui(); this.emitHud(); }
    });
    this.listen<number>('clear-quick-slot', (slot) => { if (this.inventory.clearQuickSlot(slot)) { audio.ui(); this.emitHud(); } });
    this.listen<{ itemId?: string; direction?: 'toChest' | 'toInventory' }>('transfer-item', ({ itemId, direction }) => {
      if (itemId && direction && this.inventory.transfer(itemId, 1, direction)) { audio.pickup(); this.emitHud(); }
    });
    this.listen<void>('toggle-sound', () => this.toggleSound());
    this.listen<{ key?: keyof PlayerSave['settings']; value?: number }>('set-volume', ({ key, value }) => this.setVolume(key, value));
    this.listen<void>('toggle-motion', () => this.toggleMotion());
    this.listen<void>('toggle-quality', () => this.toggleQuality());
    this.listen<void>('fullscreen', () => { if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen(); });
    this.listen<void>('open-shop', () => GameEvents.emit('panel-open', 'shop'));
    this.listen<string>('craft-recipe', (recipeId) => this.craftRecipe(recipeId));
    this.listen<string>('upgrade-weapon', (weaponId) => this.upgradeWeapon(weaponId));
    this.listen<void>('reset-game', () => { this.saves.reset(); window.location.reload(); });
  }

  /**
   * Craft a recipe at Runa's anvil, then refresh the HUD so the open panel
   * re-renders with new material counts (the GameUI contract). Note: the craft
   * stat is incremented inside CraftingSystem.craft, so it is intentionally NOT
   * bumped again here (WorldScene bumps it a second time — a pre-existing quirk we
   * don't replicate).
   */
  private craftRecipe(recipeId: string): void {
    const result = this.crafting.craft(recipeId);
    if (result.ok) audio.craft(); else audio.ui('error');
    GameEvents.emit('toast', result.message);
    this.emitHud();
  }

  /** Reinforce a weapon at the forge, then refresh the HUD + held-weapon sprite. */
  private upgradeWeapon(weaponId: string): void {
    const result = this.crafting.upgradeWeapon(weaponId);
    if (result.ok) { audio.craft(); this.syncHeldWeapon(); } else audio.ui('error');
    GameEvents.emit('toast', result.message);
    this.emitHud();
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
      this.setHeroAnimation('walk', input.x, input.y);
      if (time > this.lastStepAt + 340) { audio.step('wood'); this.lastStepAt = time; }
    } else {
      this.player.setVelocity(0);
      this.setHeroAnimation('idle', this.facing.x, this.facing.y);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.useItem('blood_vial');
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) GameEvents.emit('panel-open', 'inventory');
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) GameEvents.emit('panel-open', 'pause');
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.interiorAttack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) this.dash();
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.interiorSpecial();
    const weaponKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT'];
    weaponKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) {
        const weapon = WEAPONS[index];
        if (weapon && this.saves.get().ownedWeapons.includes(weapon.id)) this.equipWeapon(weapon.id);
      }
    });
    // Quick-item slots on Z / X / V — the same binding WorldScene should add.
    const quickKeys = ['Z', 'X', 'V'];
    quickKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) this.useQuickSlot(index);
    });
  }

  /**
   * Chooses the hero animation from a movement/facing vector — mirrors
   * WorldScene.setHeroAnimation so the exile animates identically indoors: five
   * sculpted directions (the three facing right are mirrored for left) with a
   * short hold on transient poses.
   */
  private setHeroAnimation(pose: HeroPose, dx: number, dy: number): void {
    if (this.heroPose !== pose && this.time.now < this.heroPoseUntil) return;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let dir: HeroDir;
    if (absX < 0.001 && absY < 0.001) dir = this.heroDir;
    else if (absX > absY * 2.2) dir = 'side';
    else if (absY > absX * 2.2) dir = dy < 0 ? 'up' : 'down';
    else dir = dy < 0 ? 'up-side' : 'down-side';
    this.heroDir = dir;
    this.heroPose = pose;
    const flip = dir !== 'up' && dir !== 'down' && dx < 0;
    const animKey = `hero-${dir}-${pose}`;
    if (this.anims.exists(animKey)) this.player.play(animKey, true);
    else { this.player.anims.stop(); this.player.setTexture(heroKey(dir, pose, 0)); }
    this.player.setFlipX(flip);
  }

  /** Play a one-shot pose (attack/dash/hurt) and lock it for `holdMs`. */
  private playHeroPose(pose: HeroPose, holdMs: number): void {
    this.heroPoseUntil = 0;
    this.setHeroAnimation(pose, this.facing.x, this.facing.y);
    this.heroPoseUntil = this.time.now + holdMs;
  }

  /** Use the consumable bound to quick slot `index`, sharing useItem's feedback. */
  private useQuickSlot(index: number): void {
    const result = this.inventory.useQuickSlot(index);
    GameEvents.emit('toast', result.message);
    if (!result.used) return;
    if (result.effect === 'heal') audio.heal();
    else if (result.effect === 'smoke') this.playSmoke();
    else audio.ui();
    this.emitHud();
  }

  private updatePrompt(): void {
    const candidates: Array<{ type: 'exit' | 'chest' | 'npc' | 'anvil'; x: number; y: number; label: string }> = [
      { type: 'exit', x: this.exitDoor.x, y: this.exitDoor.y, label: 'Выйти наружу' },
    ];
    if (this.chest) candidates.push({ type: 'chest', x: this.chest.x, y: this.chest.y, label: 'Открыть сундук' });
    if (this.npc) candidates.push({ type: 'npc', x: this.npc.x, y: this.npc.y, label: 'Поговорить' });
    if (this.anvil) candidates.push({ type: 'anvil', x: this.anvil.x, y: this.anvil.y, label: 'Работать у наковальни' });
    const nearest = candidates
      .map((candidate) => ({ ...candidate, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y) }))
      .filter((candidate) => candidate.distance < 86)
      .sort((a, b) => a.distance - b.distance)[0];
    const next = nearest?.type;
    if (next !== this.prompt) { this.prompt = next; GameEvents.emit('prompt', { text: nearest?.label }); }
  }

  private interact(): void {
    if (this.prompt === 'exit') return this.exitInterior();
    if (this.prompt === 'anvil') {
      // Runa's anvil is the crafting station: recipes carry a `station: 'runa'`,
      // so interacting here opens the crafting panel where WorldScene wires the
      // craft-recipe / upgrade-weapon events.
      audio.craft();
      GameEvents.emit('panel-open', 'craft');
      return;
    }
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
    const residentByRoom: Record<string, string> = { forge: 'runa', herbalist: 'vesna', elira_house: 'elira', chapel: 'gran', marsh_hut: 'iva', dock_house: 'ferryman', citadel_gatehouse: 'serah' };
    const npcId = residentByRoom[this.definition.id];
    const npc = NPCS.find((entry) => entry.id === npcId);
    if (!npc) return;
    const text: Record<string, string> = {
      runa: 'Внутри кузницы металл говорит громче людей. Если слышишь звон — значит, оружие ещё живо.',
      vesna: 'Здесь безопасно трогать почти всё. Банку с чёрной крышкой лучше не открывай.',
      elira: 'Дом стал тише после твоего возвращения. Иногда тишина — тоже награда.',
      gran: 'Под часовней есть склеп. Пока печати держатся, мёртвые остаются внизу.',
      iva: 'В топи стены ставят не от людей, а от того, что смотрит из воды.',
      ferryman: 'Каждый ящик имеет цену. Иногда золотом, иногда памятью.',
      serah: 'Здесь хранилось оружие стражи. Возьми подходящее, если заслужишь доверие.',
    };
    GameEvents.emit('dialogue', { speaker: npc.name, subtitle: npc.role.toUpperCase(), text: text[npcId] ?? 'Добро пожаловать.', accent: `#${npc.accent.toString(16).padStart(6, '0')}`, actions: [{ label: npcId === 'runa' ? 'Открыть магазин' : 'Продолжить', event: npcId === 'runa' ? 'open-shop' : 'close', primary: true }, { label: 'Уйти', event: 'close' }] });
  }

  private cycleWeapon(direction: 1 | -1): void {
    const owned = WEAPONS.filter((weapon) => this.saves.get().ownedWeapons.includes(weapon.id));
    if (owned.length < 2) return;
    const current = owned.findIndex((weapon) => weapon.id === this.saves.get().equippedWeapon);
    this.equipWeapon(owned[(current + direction + owned.length) % owned.length].id);
  }

  private equipWeapon(weaponId: string): void {
    const weapon = WEAPONS.find((entry) => entry.id === weaponId);
    if (!weapon || !this.inventory.equip(weaponId)) return;
    this.heldWeapon?.setTexture(`held-${weaponId}`).setScale(1.8).setTint(Phaser.Display.Color.HexStringToColor(weapon.accent).color);
    this.time.delayedCall(170, () => this.heldWeapon?.setScale(1.45).clearTint());
    audio.ui();
    GameEvents.emit('toast', `Экипировано: ${weapon.name}`);
    this.emitHud();
  }

  private buyWeapon(weaponId: string): void {
    const result = this.shop.purchase(weaponId);
    GameEvents.emit('toast', result.message);
    if (!result.ok || !result.weapon) return;
    this.heldWeapon?.setTexture(`held-${weaponId}`).setScale(1.95).setTint(Phaser.Display.Color.HexStringToColor(result.weapon.accent).color);
    this.time.delayedCall(220, () => this.heldWeapon?.setScale(1.45).clearTint());
    audio.coin();
    this.emitHud();
  }

  private dash(): void {
    if (this.uiLocked || this.isDashing || this.time.now < this.dashReadyAt) return;
    const direction = this.mobileMove.lengthSq() > .05 ? this.mobileMove.clone().normalize() : this.facing.clone().normalize();
    this.dashReadyAt = this.time.now + 1800;
    this.isDashing = true;
    this.playHeroPose('dash', 200);
    this.player.setVelocity(direction.x * 520, direction.y * 520).setAlpha(.7);
    audio.dash();
    this.time.delayedCall(170, () => { this.isDashing = false; this.player.setAlpha(1).setVelocity(0); });
  }

  private interiorSpecial(): void {
    if (this.uiLocked || this.time.now < this.specialReadyAt) return;
    const weapon = WEAPONS.find((entry) => entry.id === this.saves.get().equippedWeapon) ?? WEAPONS[0];
    this.specialReadyAt = this.time.now + 4500;
    audio.special(weapon.kind);
    this.playHeroPose('attack', 300);
    this.lighting?.flash(this.player.x, this.player.y, 200, Phaser.Display.Color.HexStringToColor(weapon.accent).color, 460);
    const ring = this.add.circle(this.player.x, this.player.y, 26, 0xb46dcc, .4).setStrokeStyle(5, 0xf0ccff, .9).setDepth(90);
    this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
  }

  private interiorAttack(): void {
    if (this.uiLocked) return;
    const weapon = WEAPONS.find((entry) => entry.id === this.saves.get().equippedWeapon) ?? WEAPONS[0];
    if (weapon.cooldown >= 600) audio.heavyAttack(weapon.kind); else audio.attack(weapon.kind);
    this.playHeroPose('attack', 200);
    this.heldWeapon?.setScale(1.8).setTint(Phaser.Display.Color.HexStringToColor(weapon.accent).color);
    this.time.delayedCall(130, () => this.heldWeapon?.setScale(1.45).clearTint());
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
      else if (result.effect === 'smoke') this.playSmoke();
      else audio.ui();
      this.emitHud();
    }
  }

  /**
   * Smoke bomb indoors. Interiors have no persistent enemies, so this is purely
   * the visual "breather" cloud — the shared SmokeBomb module keeps it identical
   * to the world effect (it simply finds no enemies to blind here).
   */
  private playSmoke(): void {
    const settings = this.saves.get().settings;
    const low = settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700);
    detonateSmokeBomb(this, {
      x: this.player.x,
      y: this.player.y,
      enemies: [],
      reducedMotion: settings.reducedMotion,
      lowQuality: low,
    });
    audio.special('magic');
    this.lighting?.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
  }

  private emitHud(): void {
    const save = this.saves.get();
    const active = this.quests.activeObjective();
    const objective = active ? active.quest.objectives[active.progress.objectiveIndex] : undefined;
    const snapshot: HudSnapshot = {
      health: save.health, maxHealth: this.inventory.maxHealth(), level: save.level, xp: save.xp, xpNext: XP_FOR_LEVEL(save.level), coins: save.coins,
      reputation: save.reputation, potions: this.inventory.quantity('blood_vial'), equippedWeapon: save.equippedWeapon, ownedWeapons: [...save.ownedWeapons],
      inventory: save.inventory.map((stack) => ({ ...stack })), chest: save.chest.map((stack) => ({ ...stack })), equipment: structuredClone(save.equipment),
      discoveredLocations: [...save.discoveredLocations],
      discoveredSecrets: Object.keys(save.flags).filter((key) => key.startsWith('secret-found:')).map((key) => key.slice('secret-found:'.length)),
      currentScene: this.definition.id, settings: { ...save.settings },
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
    this.lighting?.destroy();
    this.ui?.destroy(); this.saves?.flush();
  }
}
