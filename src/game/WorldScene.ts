import Phaser from 'phaser';
import { BATTLE_PASS, ENEMIES, LOCATIONS, NPCS, QUESTS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { GameUI } from '../ui/GameUI';
import { QuestSystem } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { SoundFX } from '../systems/SoundFX';
import type { DialogueAction, DialoguePayload, HudSnapshot, ObjectiveType, QuestDefinition, WeaponDefinition } from './types';
import { GameEvents } from './events';

const WORLD_WIDTH = 2800;
const WORLD_HEIGHT = 1800;
const PLAYER_START = { x: 430, y: 585 };

type InteractiveKind = 'npc' | 'collect' | 'lantern' | 'altar';

interface InteractiveEntity {
  kind: InteractiveKind;
  id: string;
  uniqueId: string;
  label: string;
  object: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  objectiveType?: ObjectiveType;
  target?: string;
}

interface EnemySpawn {
  type: keyof typeof ENEMIES;
  x: number;
  y: number;
}

export class WorldScene extends Phaser.Scene {
  private saves!: SaveSystem;
  private quests!: QuestSystem;
  private sfx!: SoundFX;
  private ui!: GameUI;
  private player!: Phaser.Physics.Arcade.Sprite;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mobileMove = new Phaser.Math.Vector2();
  private facing = new Phaser.Math.Vector2(0, 1);
  private interactables: InteractiveEntity[] = [];
  private npcMarkers = new Map<string, Phaser.GameObjects.Text>();
  private uiLocked = false;
  private attackReadyAt = 0;
  private hurtReadyAt = 0;
  private movedDistance = 0;
  private nearest?: InteractiveEntity;
  private lastLocation = '';
  private objectiveMarker?: Phaser.GameObjects.Container;
  private lastHudSignature = '';
  private eventDisposers: Array<() => void> = [];
  private boss?: Phaser.Physics.Arcade.Sprite;
  private playtimeAccumulator = 0;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.saves = new SaveSystem();
    this.quests = new QuestSystem(this.saves);
    this.sfx = new SoundFX();
    this.sfx.setEnabled(this.saves.get().settings.sound);
    document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
    this.solids = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group({ maxSize: 40 });

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawWorld();
    this.createPlayer();
    this.createNpcs();
    this.createInteractables();
    this.createEnemies();
    this.createAtmosphere();
    this.createObjectiveMarker();
    this.setupPhysics();
    this.setupInput();
    this.setupUi();
    this.setupEvents();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setDeadzone(this.scale.width < 700 ? 55 : 110, this.scale.width < 700 ? 85 : 70);
    this.cameras.main.setZoom(this.scale.width < 700 ? 1.05 : 1.22);
    this.cameras.main.fadeIn(500, 9, 11, 18);

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.uiLocked) this.saves.mutate((save) => { save.playtime += 1; });
      },
    });

    this.emitTutorial();
    this.emitHud(true);
    GameEvents.emit('toast', 'Прогресс сохраняется автоматически');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(time: number, delta: number): void {
    this.updatePlayer(time, delta);
    this.updateEnemies(time, delta);
    this.updateProjectiles(delta);
    this.updateInteractions();
    this.updateLocation();
    this.updateObjectiveMarker();
    this.updateEnemyBars();
    this.syncBoss();
    this.player.setDepth(this.player.y / 10 + 20);
    this.ui.updateWorldPosition(this.player.x, this.player.y);
    this.playtimeAccumulator += delta;
    if (this.playtimeAccumulator > 450) {
      this.playtimeAccumulator = 0;
      this.emitHud();
    }
  }

  private drawWorld(): void {
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x1c2927, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (const location of LOCATIONS) {
      ground.fillStyle(location.color, 1).fillRoundedRect(location.x, location.y, location.w, location.h, 24);
      ground.lineStyle(4, Phaser.Display.Color.IntegerToColor(location.color).brighten(12).color, 0.45)
        .strokeRoundedRect(location.x, location.y, location.w, location.h, 24);
    }

    ground.lineStyle(72, 0x554f45, 1);
    ground.beginPath();
    ground.moveTo(410, 620); ground.lineTo(860, 660); ground.lineTo(1320, 610); ground.lineTo(1790, 700); ground.lineTo(2280, 1040); ground.strokePath();
    ground.lineStyle(36, 0x675f50, 0.75);
    ground.beginPath();
    ground.moveTo(860, 650); ground.lineTo(1050, 1010); ground.lineTo(1430, 1260); ground.lineTo(2070, 1320); ground.strokePath();
    ground.lineStyle(10, 0x393c3b, 0.75);
    ground.beginPath(); ground.moveTo(420, 620); ground.lineTo(2280, 1040); ground.strokePath();

    ground.fillStyle(0x243e4b, 1).fillRect(2570, 0, 230, WORLD_HEIGHT);
    ground.fillStyle(0x365766, 0.7);
    for (let y = 30; y < WORLD_HEIGHT; y += 80) ground.fillRect(2585 + (y % 160) / 8, y, 160, 5);
    ground.lineStyle(5, 0x5d5e59, 1).strokeRect(2620, 1160, 180, 120);

    this.drawBuildings();
    this.drawCemetery();
    this.drawRuins();
    this.scatterDecorations();

    LOCATIONS.forEach((location) => {
      this.add.text(location.x + location.w / 2, location.y + 26, location.name.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#c9c5cd',
        stroke: '#11131a', strokeThickness: 5, letterSpacing: 4,
      }).setOrigin(0.5).setAlpha(0.24).setDepth(2);
    });
  }

  private drawBuildings(): void {
    const drawBuilding = (x: number, y: number, w: number, h: number, wall: number, roof: number, name: string, doorX = 0) => {
      const graphics = this.add.graphics().setDepth((y + h / 2) / 10 + 5);
      graphics.fillStyle(0x11131a, 0.6).fillRect(x - w / 2 + 10, y - h / 2 + 13, w, h);
      graphics.fillStyle(wall, 1).fillRect(x - w / 2, y - h / 2, w, h);
      graphics.fillStyle(roof, 1).fillRect(x - w / 2 - 12, y - h / 2 - 16, w + 24, 46);
      graphics.lineStyle(4, 0x171821, 1).strokeRect(x - w / 2, y - h / 2, w, h);
      for (let tx = x - w / 2; tx < x + w / 2; tx += 28) graphics.lineBetween(tx, y - h / 2 + 28, tx + 20, y - h / 2 - 12);
      graphics.fillStyle(0x211a1d, 1).fillRect(x + doorX - 18, y + h / 2 - 48, 36, 48);
      graphics.fillStyle(0xd39b4b, 1).fillCircle(x + doorX + 10, y + h / 2 - 26, 3);
      graphics.fillStyle(0x9b744d, 1).fillRect(x - w / 2 + 22, y - 8, 34, 28);
      graphics.fillStyle(0x718d91, 1).fillRect(x - w / 2 + 27, y - 3, 24, 18);
      this.add.text(x, y - h / 2 - 25, name, { fontFamily: 'monospace', fontSize: '10px', color: '#d6d0da', backgroundColor: '#11131acc', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth((y + h / 2) / 10 + 7);
      this.addSolidRect(x, y - 5, w, h - 6);
    };

    drawBuilding(430, 420, 240, 170, 0x4c4651, 0x342d3b, 'ДОМ ИЗГНАННИКА');
    drawBuilding(930, 465, 190, 135, 0x5c5545, 0x40382f, 'ПОСТОЯЛЫЙ ДВОР', -28);
    drawBuilding(1155, 520, 210, 150, 0x5a493c, 0x522e2b, 'КУЗНИЦА РУНЫ', 28);
    drawBuilding(780, 780, 155, 110, 0x504c43, 0x35332f, 'ДОМ ЭЛИРЫ');
    drawBuilding(1070, 790, 170, 120, 0x4b513f, 0x313a2f, 'ТРАВНИЦА');

    const well = this.add.graphics().setDepth(74);
    well.fillStyle(0x171821, 1).fillEllipse(920, 690, 84, 46);
    well.fillStyle(0x66626a, 1).fillEllipse(920, 680, 78, 42);
    well.fillStyle(0x1d2930, 1).fillEllipse(920, 678, 54, 27);
    well.lineStyle(4, 0x262733, 1).strokeEllipse(920, 680, 78, 42);
    this.addSolidRect(920, 683, 66, 34);
  }

  private drawCemetery(): void {
    const graphics = this.add.graphics().setDepth(4);
    graphics.lineStyle(8, 0x4c4f55, 1);
    graphics.lineBetween(1495, 295, 2180, 295);
    graphics.lineBetween(1495, 295, 1495, 870);
    graphics.lineBetween(2180, 295, 2180, 870);
    graphics.lineBetween(1495, 870, 1740, 870);
    graphics.lineBetween(1880, 870, 2180, 870);
    for (let x = 1510; x < 2180; x += 36) { graphics.lineBetween(x, 285, x, 310); graphics.lineBetween(x, 855, x, 880); }
    this.addSolidRect(1838, 295, 686, 12);
    this.addSolidRect(1495, 582, 12, 575);
    this.addSolidRect(2180, 582, 12, 575);
    this.addSolidRect(1615, 870, 240, 12);
    this.addSolidRect(2030, 870, 300, 12);
    const graves = [
      [1600,410],[1720,390],[1880,420],[2040,400],[1640,535],[1780,560],[1940,520],[2080,570],[1590,700],[1760,720],[1920,690],[2070,735],
    ];
    graves.forEach(([x, y], index) => this.add.image(x, y, 'grave').setScale(index % 3 === 0 ? 2.2 : 1.9).setDepth(y / 10 + 3));
  }

  private drawRuins(): void {
    const graphics = this.add.graphics().setDepth(4);
    graphics.fillStyle(0x3e3445, 1);
    graphics.fillRect(2110, 1030, 340, 34);
    graphics.fillRect(2110, 1030, 34, 240);
    graphics.fillRect(2416, 1030, 34, 240);
    graphics.fillRect(2000, 1430, 520, 38);
    graphics.fillRect(2000, 1290, 34, 178);
    graphics.fillRect(2486, 1290, 34, 178);
    graphics.lineStyle(5, 0x796180, .8).strokeRect(2110, 1030, 340, 34).strokeRect(2000, 1430, 520, 38);
    this.addSolidRect(2280, 1047, 340, 34);
    this.addSolidRect(2127, 1130, 34, 200);
    this.addSolidRect(2433, 1130, 34, 200);
    this.addSolidRect(2255, 1449, 520, 38);
    this.addSolidRect(2017, 1375, 34, 150);
    this.addSolidRect(2503, 1375, 34, 150);
    const sigil = graphics;
    sigil.lineStyle(5, 0x9e6db4, .6).strokeCircle(2270, 1330, 86);
    sigil.lineBetween(2210, 1390, 2330, 1270); sigil.lineBetween(2210, 1270, 2330, 1390);
    for (const [x, y] of [[2050,1120],[2530,1080],[2070,1510],[2480,1540],[2320,980]]) {
      this.add.image(x, y, 'rock').setScale(2.5).setTint(0x6c5972).setDepth(y / 10 + 2);
    }
  }

  private scatterDecorations(): void {
    let seed = 918273;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const addTree = (x: number, y: number, scale = 2.1) => {
      const tree = this.add.image(x, y, 'tree').setScale(scale).setDepth(y / 10 + 8);
      tree.setTint(Phaser.Display.Color.GetColor(210 + Math.floor(random() * 30), 220 + Math.floor(random() * 20), 215 + Math.floor(random() * 30)));
      this.addSolidRect(x, y + 34 * scale / 2, 18 * scale, 15 * scale);
    };
    for (let index = 0; index < 50; index += 1) {
      const x = 790 + random() * 1020;
      const y = 950 + random() * 720;
      if (Math.abs(y - (1000 + (x - 800) * .4)) < 90) continue;
      addTree(x, y, 1.8 + random() * .55);
    }
    for (let index = 0; index < 22; index += 1) {
      const x = 90 + random() * 2500;
      const y = 80 + random() * 1650;
      const inLocation = LOCATIONS.some((location) => x > location.x - 50 && x < location.x + location.w + 50 && y > location.y - 50 && y < location.y + location.h + 50);
      if (!inLocation) addTree(x, y, 1.7 + random() * .5);
    }
    for (let index = 0; index < 22; index += 1) {
      const x = 100 + random() * 2450;
      const y = 100 + random() * 1600;
      this.add.image(x, y, 'rock').setScale(1.3 + random() * .8).setAlpha(.82).setDepth(y / 10 + 1);
    }
  }

  private addSolidRect(x: number, y: number, width: number, height: number): void {
    const zone = this.add.zone(x, y, width, height);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  private createPlayer(): void {
    this.player = this.physics.add.sprite(PLAYER_START.x, PLAYER_START.y, 'hero-down-0').setScale(2.25);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(11, 10).setOffset(4.5, 13);
    this.add.image(PLAYER_START.x, PLAYER_START.y + 21, 'shadow').setScale(2.2).setAlpha(0);
  }

  private createNpcs(): void {
    NPCS.forEach((npc, index) => {
      const sprite = this.add.sprite(npc.x, npc.y, `npc-${index}`).setScale(2.35).setDepth(npc.y / 10 + 10);
      sprite.setData('npcId', npc.id);
      const name = this.add.text(npc.x, npc.y - 42, npc.name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ded9e2', stroke: '#11131a', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(npc.y / 10 + 20);
      name.setData('labelFor', npc.id);
      const marker = this.add.text(npc.x, npc.y - 72, '', {
        fontFamily: 'monospace', fontSize: '25px', fontStyle: 'bold', color: '#f0c36d', stroke: '#12131a', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(npc.y / 10 + 22);
      this.tweens.add({ targets: marker, y: marker.y - 7, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.npcMarkers.set(npc.id, marker);
      this.interactables.push({ kind: 'npc', id: npc.id, uniqueId: `npc:${npc.id}`, label: `Говорить: ${npc.name}`, object: sprite });
    });
  }

  private createInteractables(): void {
    const addItem = (kind: InteractiveKind, id: string, target: string, label: string, texture: string, x: number, y: number, index: number, objectiveType: ObjectiveType) => {
      const uniqueId = `${kind}:${target}:${index}`;
      const used = Boolean(this.saves.get().flags[uniqueId]);
      const image = this.add.image(x, y, used && kind === 'lantern' ? 'lantern-on' : texture).setScale(kind === 'lantern' ? 2.3 : 2).setDepth(y / 10 + 4);
      if (used && kind !== 'lantern') image.setVisible(false);
      if (!used && kind !== 'lantern') this.tweens.add({ targets: image, y: y - 5, duration: 900 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.interactables.push({ kind, id, uniqueId, label, object: image, objectiveType, target });
    };

    [[660,735],[760,665],[620,850]].forEach(([x,y], index) => addItem('collect','moonwort','moonwort','Собрать лунную полынь','herb-moonwort',x,y,index,'collect'));
    [[1120,1190],[1260,1410],[1510,1110],[1630,1450]].forEach(([x,y], index) => addItem('collect','shadebloom','shadebloom','Собрать цветок тени','herb-shadebloom',x,y,index,'collect'));
    addItem('collect','charm','charm','Поднять медальон Элиры','charm',2030,520,0,'collect');
    [[1330,670],[1590,820],[1930,930]].forEach(([x,y], index) => addItem('lantern','lantern','lantern','Зажечь фонарь','lantern-off',x,y,index,'interact'));
    addItem('altar','forest_altar','forest_altar','Провести ритуал','altar',1660,1580,0,'interact');
    this.syncInteractables();
  }

  private createEnemies(): void {
    const spawns: EnemySpawn[] = [
      { type: 'husk', x: 1630, y: 450 }, { type: 'husk', x: 1810, y: 520 }, { type: 'husk', x: 1980, y: 650 }, { type: 'husk', x: 1720, y: 760 }, { type: 'husk', x: 2070, y: 780 },
      { type: 'direwolf', x: 1180, y: 1160 }, { type: 'direwolf', x: 1390, y: 1370 }, { type: 'direwolf', x: 1610, y: 1210 }, { type: 'direwolf', x: 1050, y: 1510 },
      { type: 'boneguard', x: 2040, y: 1100 }, { type: 'boneguard', x: 2240, y: 1110 }, { type: 'boneguard', x: 2440, y: 1210 },
      { type: 'wraith', x: 2140, y: 1380 }, { type: 'wraith', x: 2410, y: 1520 },
      { type: 'nameless', x: 2280, y: 1330 },
    ];
    spawns.forEach((spawn) => this.spawnEnemy(spawn));
  }

  private spawnEnemy(spawn: EnemySpawn): Phaser.Physics.Arcade.Sprite {
    const definition = ENEMIES[spawn.type];
    const enemy = this.physics.add.sprite(spawn.x, spawn.y, `enemy-${spawn.type}`).setScale((definition.scale ?? 1) * 2.05);
    enemy.setDepth(enemy.y / 10 + 12);
    enemy.setDataEnabled();
    enemy.setData({
      type: spawn.type,
      name: definition.name,
      health: definition.health,
      maxHealth: definition.health,
      damage: definition.damage,
      speed: definition.speed,
      aggro: definition.aggro,
      rewardCoins: definition.rewardCoins,
      homeX: spawn.x,
      homeY: spawn.y,
      lastAttack: 0,
      spawn,
    });
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(enemy.width * .55, enemy.height * .52).setOffset(enemy.width * .22, enemy.height * .42);
    const bar = this.add.graphics().setDepth(enemy.depth + 2).setVisible(false);
    enemy.setData('healthBar', bar);
    this.enemies.add(enemy);
    if (spawn.type === 'nameless') {
      this.boss = enemy;
      enemy.setVisible(false).setActive(false);
      body.enable = false;
    }
    return enemy;
  }

  private createAtmosphere(): void {
    const overlay = this.add.graphics().setScrollFactor(0).setDepth(900);
    const { width, height } = this.scale;
    overlay.fillStyle(0x19142d, .13).fillRect(0, 0, width, height);
    overlay.fillStyle(0x06080e, .22).fillRect(0, 0, width, 55);
    overlay.fillStyle(0x06080e, .18).fillRect(0, height - 70, width, 70);
    for (let index = 0; index < 38; index += 1) {
      const mote = this.add.image(Phaser.Math.Between(200, 2600), Phaser.Math.Between(200, 1650), 'pixel')
        .setTint(index % 3 === 0 ? 0xb57ac9 : 0x91b69e).setAlpha(Phaser.Math.FloatBetween(.18, .55)).setScale(Phaser.Math.FloatBetween(1, 2.4)).setDepth(3);
      this.tweens.add({ targets: mote, y: mote.y - Phaser.Math.Between(18, 55), x: mote.x + Phaser.Math.Between(-22, 22), alpha: { from: mote.alpha, to: .04 }, duration: Phaser.Math.Between(1800, 4200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1500) });
    }
  }

  private createObjectiveMarker(): void {
    const ring = this.add.ellipse(0, 0, 46, 22, 0xc26d90, .16).setStrokeStyle(3, 0xd79bb4, .8);
    const glyph = this.add.text(0, -34, '⌄', { fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color: '#f0b7ce', stroke: '#14151c', strokeThickness: 5 }).setOrigin(.5);
    this.objectiveMarker = this.add.container(0, 0, [ring, glyph]).setDepth(850).setVisible(false);
    this.tweens.add({ targets: glyph, y: -42, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: ring, scaleX: 1.3, scaleY: 1.3, alpha: .03, duration: 1000, repeat: -1 });
  }

  private setupPhysics(): void {
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.projectiles, this.solids, (object) => object.destroy());
    this.physics.add.overlap(this.projectiles, this.enemies, (projectileObject, enemyObject) => {
      const projectile = projectileObject as Phaser.Physics.Arcade.Sprite;
      const enemy = enemyObject as Phaser.Physics.Arcade.Sprite;
      if (!projectile.active || !enemy.active) return;
      this.damageEnemy(enemy, Number(projectile.getData('damage') ?? 0));
      projectile.destroy();
    });
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,Q,I,M,B,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.uiLocked && pointer.leftButtonDown()) this.attack(pointer);
    });
  }

  private setupUi(): void {
    this.ui = new GameUI();
    this.ui.mount();
  }

  private listen<T>(event: string, callback: (payload: T) => void): void {
    GameEvents.on(event, callback);
    this.eventDisposers.push(() => GameEvents.off(event, callback));
  }

  private setupEvents(): void {
    this.listen<boolean>('ui-lock', (locked) => {
      this.uiLocked = locked;
      if (locked) this.player.setVelocity(0);
    });
    this.listen<{ x: number; y: number }>('ui-move', (vector) => this.mobileMove.set(vector.x, vector.y));
    this.listen<void>('ui-attack', () => { if (!this.uiLocked) this.attack(); });
    this.listen<void>('ui-interact', () => { if (!this.uiLocked) this.interact(); });
    this.listen<void>('ui-heal', () => this.usePotion());
    this.listen<string>('equip', (weaponId) => this.equipWeapon(weaponId));
    this.listen<string>('buy', (weaponId) => this.buyWeapon(weaponId));
    this.listen<number>('claim-tier', (tier) => this.claimTier(tier));
    this.listen<string>('quest-accept', (questId) => this.acceptQuest(questId));
    this.listen<string>('quest-turnin', (questId) => this.turnInQuest(questId));
    this.listen<void>('open-shop', () => GameEvents.emit('panel-open', 'shop'));
    this.listen<void>('toggle-sound', () => {
      this.saves.mutate((save) => { save.settings.sound = !save.settings.sound; }, true);
      this.sfx.setEnabled(this.saves.get().settings.sound);
      this.emitHud(true);
    });
    this.listen<void>('toggle-motion', () => {
      this.saves.mutate((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; }, true);
      document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
      this.emitHud(true);
    });
    this.listen<void>('fullscreen', () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
    });
    this.listen<void>('reset-game', () => { this.saves.reset(); window.location.reload(); });
    this.listen<void>('respawn', () => this.respawn());
  }

  private updatePlayer(time: number, delta: number): void {
    if (!this.player.active) return;
    if (this.uiLocked) {
      this.player.setVelocity(0);
      this.player.anims.stop();
      return;
    }
    const input = new Phaser.Math.Vector2(
      (this.keys?.D?.isDown || this.cursors?.right?.isDown ? 1 : 0) - (this.keys?.A?.isDown || this.cursors?.left?.isDown ? 1 : 0),
      (this.keys?.S?.isDown || this.cursors?.down?.isDown ? 1 : 0) - (this.keys?.W?.isDown || this.cursors?.up?.isDown ? 1 : 0),
    );
    if (this.mobileMove.lengthSq() > .02) input.copy(this.mobileMove);
    if (input.lengthSq() > 1) input.normalize();
    const speed = 190;
    this.player.setVelocity(input.x * speed, input.y * speed);

    if (input.lengthSq() > .02) {
      this.facing.copy(input).normalize();
      this.movedDistance += speed * delta / 1000;
      if (!this.saves.get().tutorialDone && !this.saves.get().flags.tutorialMoved && this.movedDistance > 95) {
        this.saves.mutate((save) => { save.flags.tutorialMoved = true; }, true);
        this.emitTutorial();
        GameEvents.emit('toast', 'Движение освоено');
      }
      if (Math.abs(input.x) > Math.abs(input.y)) {
        this.player.play('hero-walk-side', true).setFlipX(input.x < 0);
      } else if (input.y < 0) {
        this.player.play('hero-walk-up', true).setFlipX(false);
      } else {
        this.player.play('hero-walk-down', true).setFlipX(false);
      }
    } else {
      this.player.setVelocity(0);
      this.player.anims.stop();
      const direction = Math.abs(this.facing.x) > Math.abs(this.facing.y) ? 'side' : this.facing.y < 0 ? 'up' : 'down';
      this.player.setTexture(`hero-${direction}-0`).setFlipX(direction === 'side' && this.facing.x < 0);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.usePotion();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.attack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) GameEvents.emit('panel-open', 'journal');
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) GameEvents.emit('panel-open', 'inventory');
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) GameEvents.emit('panel-open', 'map');
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) GameEvents.emit('panel-open', 'pass');
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) GameEvents.emit('panel-open', 'pause');
    const weaponKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX'];
    weaponKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) {
        const weapon = this.saves.get().ownedWeapons[index];
        if (weapon) this.equipWeapon(weapon);
      }
    });
  }

  private attack(pointer?: Phaser.Input.Pointer): void {
    const save = this.saves.get();
    const weapon = WEAPONS.find((item) => item.id === save.equippedWeapon) ?? WEAPONS[0];
    if (this.time.now < this.attackReadyAt) return;
    this.attackReadyAt = this.time.now + weapon.cooldown;
    let direction = this.facing.clone();
    if (pointer) {
      direction = new Phaser.Math.Vector2(pointer.worldX - this.player.x, pointer.worldY - this.player.y);
      if (direction.lengthSq() > 16) direction.normalize(); else direction.copy(this.facing);
      this.facing.copy(direction);
    }
    this.sfx.attack(weapon.kind);
    if (weapon.kind === 'melee') this.meleeAttack(weapon, direction);
    else this.projectileAttack(weapon, direction);
    this.cameras.main.shake(55, weapon.kind === 'melee' ? .0018 : .001);
    if (!save.tutorialDone && save.flags.tutorialMoved && !save.flags.tutorialAttacked) {
      this.saves.mutate((state) => { state.flags.tutorialAttacked = true; }, true);
      this.emitTutorial();
      GameEvents.emit('toast', 'Бой освоен — найдите Сестру Мору');
    }
  }

  private meleeAttack(weapon: WeaponDefinition, direction: Phaser.Math.Vector2): void {
    const x = this.player.x + direction.x * 42;
    const y = this.player.y + direction.y * 42;
    const slash = this.add.rectangle(x, y, 46, 11, Phaser.Display.Color.HexStringToColor(weapon.accent).color, .8)
      .setRotation(direction.angle()).setDepth(this.player.depth + 2);
    this.tweens.add({ targets: slash, scaleX: 1.6, scaleY: .35, alpha: 0, duration: 130, onComplete: () => slash.destroy() });
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return null;
      const toEnemy = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
      const distance = toEnemy.length();
      if (distance > weapon.range + 26 || distance < 1) return null;
      toEnemy.normalize();
      if (toEnemy.dot(direction) > .12) this.damageEnemy(enemy, weapon.damage);
      return null;
    });
  }

  private projectileAttack(weapon: WeaponDefinition, direction: Phaser.Math.Vector2): void {
    const texture = weapon.kind === 'magic' ? 'projectile-magic' : 'projectile-bolt';
    const projectile = this.physics.add.sprite(this.player.x + direction.x * 30, this.player.y + direction.y * 30, texture)
      .setScale(weapon.kind === 'magic' ? 1.7 : 2).setRotation(direction.angle()).setDepth(this.player.depth + 3);
    projectile.setData({ damage: weapon.damage, ttl: weapon.range / (weapon.projectileSpeed ?? 350) * 1000 });
    projectile.setVelocity(direction.x * (weapon.projectileSpeed ?? 350), direction.y * (weapon.projectileSpeed ?? 350));
    this.projectiles.add(projectile);
    if (weapon.kind === 'magic') this.tweens.add({ targets: projectile, angle: projectile.angle + 180, duration: 450, repeat: -1 });
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
    if (!enemy.active) return;
    const health = Math.max(0, Number(enemy.getData('health')) - damage);
    enemy.setData('health', health);
    enemy.setTintFill(0xf5d5df);
    this.time.delayedCall(90, () => { if (enemy.active) enemy.clearTint(); });
    const number = this.add.text(enemy.x, enemy.y - 38, `-${damage}`, { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffd2dc', stroke: '#15161d', strokeThickness: 4 }).setOrigin(.5).setDepth(900);
    this.tweens.add({ targets: number, y: number.y - 28, alpha: 0, duration: 580, onComplete: () => number.destroy() });
    this.sfx.hit();
    if (health <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const type = enemy.getData('type') as keyof typeof ENEMIES;
    const coins = Number(enemy.getData('rewardCoins'));
    const spawn = enemy.getData('spawn') as EnemySpawn;
    const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics | undefined;
    bar?.destroy();
    this.saves.mutate((save) => { save.coins += coins; });
    const update = this.quests.record('kill', type, 1);
    const puff = this.add.image(enemy.x, enemy.y, 'spark').setScale(5).setTint(type === 'nameless' ? 0xd77ac7 : 0xc09a7b).setDepth(enemy.depth + 3);
    this.tweens.add({ targets: puff, scale: 11, alpha: 0, angle: 90, duration: 430, onComplete: () => puff.destroy() });
    enemy.destroy();
    this.sfx.coin();
    GameEvents.emit('toast', `+${coins} золота • ${ENEMIES[type].name} повержен`);
    if (update.readyQuest) this.sfx.quest();
    if (type !== 'nameless') this.time.delayedCall(9000, () => this.spawnEnemy(spawn));
    else this.boss = undefined;
    this.onQuestProgress(update);
    this.emitHud(true);
  }

  private updateEnemies(time: number, delta: number): void {
    if (this.uiLocked || !this.player.active) {
      this.enemies.setVelocity(0, 0);
      return;
    }
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return null;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const aggro = Number(enemy.getData('aggro'));
      const speed = Number(enemy.getData('speed'));
      const homeX = Number(enemy.getData('homeX'));
      const homeY = Number(enemy.getData('homeY'));
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      if (distance < aggro) {
        this.physics.moveToObject(enemy, this.player, speed);
        enemy.setFlipX(body.velocity.x < 0);
        if (distance < 42 + enemy.displayWidth * .18 && time > Number(enemy.getData('lastAttack')) + 850) {
          enemy.setData('lastAttack', time);
          this.hurtPlayer(Number(enemy.getData('damage')));
        }
      } else {
        const homeDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, homeX, homeY);
        if (homeDistance > 55) this.physics.moveTo(enemy, homeX, homeY, speed * .48);
        else {
          body.setVelocity(Math.sin((time + homeX) * .001) * 8, Math.cos((time + homeY) * .0012) * 8);
        }
      }
      enemy.setDepth(enemy.y / 10 + 12);
      return null;
    });
  }

  private hurtPlayer(amount: number): void {
    if (this.time.now < this.hurtReadyAt || !this.player.active) return;
    this.hurtReadyAt = this.time.now + 650;
    this.saves.mutate((save) => { save.health = Math.max(0, save.health - amount); });
    this.player.setTintFill(0xe45d78);
    this.time.delayedCall(110, () => this.player.clearTint());
    this.cameras.main.shake(130, .006);
    this.sfx.hit();
    if (this.saves.get().health <= 0) this.die();
    this.emitHud(true);
  }

  private die(): void {
    this.player.setActive(false).setVelocity(0).setTint(0x6e5a67);
    this.physics.world.pause();
    GameEvents.emit('death');
  }

  private respawn(): void {
    this.physics.world.resume();
    this.saves.mutate((save) => {
      save.health = save.maxHealth;
      save.coins = Math.max(0, save.coins - Math.min(35, Math.floor(save.coins * .1)));
    }, true);
    this.player.setPosition(PLAYER_START.x, PLAYER_START.y).setActive(true).setVisible(true).clearTint().setVelocity(0);
    this.uiLocked = false;
    this.cameras.main.fadeIn(350, 30, 8, 16);
    GameEvents.emit('toast', 'Вы очнулись у дома. Потеряно немного золота.');
    this.emitHud(true);
  }

  private usePotion(): void {
    if (this.uiLocked && this.player.active) return;
    const save = this.saves.get();
    if (save.potions <= 0) { GameEvents.emit('toast', 'Зелья закончились'); return; }
    if (save.health >= save.maxHealth) { GameEvents.emit('toast', 'Здоровье уже полное'); return; }
    this.saves.mutate((state) => {
      state.potions -= 1;
      state.health = Math.min(state.maxHealth, state.health + 48);
    }, true);
    this.sfx.heal();
    const glow = this.add.circle(this.player.x, this.player.y, 22, 0xc95c78, .5).setDepth(this.player.depth - 1);
    this.tweens.add({ targets: glow, radius: 62, alpha: 0, duration: 550, onComplete: () => glow.destroy() });
    GameEvents.emit('toast', 'Здоровье восстановлено');
    this.emitHud(true);
  }

  private updateProjectiles(delta: number): void {
    this.projectiles.children.each((child) => {
      const projectile = child as Phaser.Physics.Arcade.Sprite;
      const ttl = Number(projectile.getData('ttl')) - delta;
      projectile.setData('ttl', ttl);
      if (ttl <= 0) projectile.destroy();
      return null;
    });
  }

  private updateInteractions(): void {
    if (this.uiLocked || !this.player.active) return;
    this.syncInteractables();
    let nearest: InteractiveEntity | undefined;
    let nearestDistance = 82;
    for (const entity of this.interactables) {
      if (!entity.object.active || !entity.object.visible || !this.isInteractiveAvailable(entity)) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entity.object.x, entity.object.y);
      if (distance < nearestDistance) { nearest = entity; nearestDistance = distance; }
    }
    if (nearest?.uniqueId !== this.nearest?.uniqueId) {
      this.nearest = nearest;
      GameEvents.emit('prompt', { text: nearest?.label });
    }
  }

  private interact(): void {
    if (!this.nearest || this.uiLocked) return;
    const entity = this.nearest;
    if (entity.kind === 'npc') {
      if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialMoved && this.saves.get().flags.tutorialAttacked && entity.id === 'mora') {
        this.saves.mutate((save) => { save.tutorialDone = true; }, true);
        this.emitTutorial();
        GameEvents.emit('toast', 'Обучение завершено • поговорите с Морой о первой клятве');
      }
      this.openNpcDialogue(entity.id);
      return;
    }
    if (!entity.object.visible || this.saves.get().flags[entity.uniqueId]) return;
    this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
    if (entity.kind === 'lantern') {
      entity.object.setTexture('lantern-on');
      const glow = this.add.circle(entity.object.x, entity.object.y - 12, 38, 0xf2b65d, .22).setDepth(entity.object.depth - 1);
      this.tweens.add({ targets: glow, alpha: .09, scale: 1.15, duration: 1200, yoyo: true, repeat: -1 });
    } else {
      entity.object.setVisible(false);
    }
    const update = this.quests.record(entity.objectiveType!, entity.target!, 1);
    this.sfx.coin();
    GameEvents.emit('toast', entity.kind === 'collect' ? 'Предмет добавлен к цели задания' : entity.kind === 'lantern' ? 'Фонарь зажжён' : 'Ритуал проведён');
    this.onQuestProgress(update);
    this.nearest = undefined;
    GameEvents.emit('prompt', {});
    this.emitHud(true);
  }

  private isInteractiveAvailable(entity: InteractiveEntity): boolean {
    if (entity.kind === 'npc') return true;
    if (this.saves.get().flags[entity.uniqueId]) return false;
    return this.isObjectiveActive(entity.objectiveType!, entity.target!);
  }

  private isObjectiveActive(type: ObjectiveType, target: string): boolean {
    return this.quests.getActive().some(({ quest, progress }) => {
      if (progress.status !== 'active') return false;
      const objective = quest.objectives[progress.objectiveIndex];
      return objective.type === type && objective.target === target;
    });
  }

  private syncInteractables(): void {
    this.interactables.forEach((entity) => {
      if (entity.kind === 'npc') return;
      const used = Boolean(this.saves.get().flags[entity.uniqueId]);
      if (entity.kind === 'lantern') {
        entity.object.setTexture(used ? 'lantern-on' : 'lantern-off').setAlpha(used ? .95 : this.isObjectiveActive('interact', 'lantern') ? 1 : .55);
      } else {
        entity.object.setVisible(!used).setAlpha(this.isObjectiveActive(entity.objectiveType!, entity.target!) ? 1 : .38);
      }
    });
  }

  private openNpcDialogue(npcId: string): void {
    const npc = NPCS.find((item) => item.id === npcId);
    if (!npc) return;
    const related = QUESTS.filter((quest) => quest.giver === npcId && !this.quests.isLocked(quest));
    const ready = related.find((quest) => this.saves.get().questProgress[quest.id]?.status === 'ready');
    const offer = related.find((quest) => this.quests.status(quest) === 'available' && !this.saves.get().questProgress[quest.id]);
    const active = related.find((quest) => this.saves.get().questProgress[quest.id]?.status === 'active');
    let text = this.generalNpcText(npcId);
    const actions: DialogueAction[] = [];
    if (ready) {
      text = `Вы справились с заданием «${ready.title}». Долина помнит такие поступки. Заберите заслуженную награду.`;
      actions.push({ label: `Сдать • ◆ ${ready.reward.coins} • ✦ ${ready.reward.reputation}`, event: 'quest-turnin', payload: ready.id, primary: true });
    } else if (offer) {
      text = `${offer.description} Награда: ${offer.reward.coins} золота, ${offer.reward.xp} опыта и ${offer.reward.reputation} репутации.`;
      actions.push({ label: offer.category === 'main' ? 'Принять клятву' : 'Взять контракт', event: 'quest-accept', payload: offer.id, primary: true });
    } else if (active) {
      const progress = this.saves.get().questProgress[active.id];
      const objective = active.objectives[progress.objectiveIndex];
      text = `Задание «${active.title}» ещё не завершено. ${objective.label}: ${progress.amount}/${objective.amount}.`;
    }
    if (npcId === 'runa') actions.push({ label: 'Открыть магазин', event: 'open-shop', primary: !actions.length });
    actions.push({ label: 'Уйти', event: 'close' });
    const color = `#${npc.accent.toString(16).padStart(6, '0')}`;
    const payload: DialoguePayload = { speaker: npc.name, subtitle: npc.role.toUpperCase(), text, accent: color, actions };
    GameEvents.emit('dialogue', payload);
  }

  private generalNpcText(npcId: string): string {
    const lines: Record<string, string> = {
      mora: 'Ты вернулся. Пепел на сапогах говорит, что Долина ещё не забрала тебя. Значит, клятва продолжается.',
      runa: 'Хорошее оружие не делает героя. Но плохое оружие быстро делает покойника. Выбирай с умом.',
      gran: 'Могилы молчат только днём. Ночью они пересчитывают живых.',
      vesna: 'Каждое растение здесь либо лечит, либо запоминает твой последний вдох. Иногда — и то и другое.',
      elira: 'В Сером Холме все чего-то ждут. Рассвета, смерти или возвращения тех, кто уже не вернётся.',
      orrin: 'Следы в лесу идут в обе стороны. Звери научились охотиться на тех, кто охотится на них.',
      ferryman: 'За рекой пока нет пути. Но вода уже знает твоё имя.',
    };
    return lines[npcId] ?? 'Долина наблюдает.';
  }

  private acceptQuest(questId: string): void {
    if (!this.quests.accept(questId)) return;
    const quest = this.quests.getDefinition(questId)!;
    GameEvents.emit('dialogue-close');
    GameEvents.emit('toast', `${quest.category === 'main' ? 'Новая клятва' : 'Новый контракт'}: ${quest.title}`);
    this.sfx.quest();
    const first = quest.objectives[0];
    if (first.type === 'purchase' && this.saves.get().ownedWeapons.includes(first.target)) this.onQuestProgress(this.quests.record('purchase', first.target));
    this.syncInteractables();
    this.emitHud(true);
  }

  private turnInQuest(questId: string): void {
    const previousLevel = this.saves.get().level;
    const quest = this.quests.turnIn(questId);
    if (!quest) return;
    GameEvents.emit('dialogue-close');
    GameEvents.emit('toast', `Задание завершено: ${quest.title} • +${quest.reward.coins} золота`);
    this.sfx.quest();
    if (this.saves.get().level > previousLevel) GameEvents.emit('toast', `Новый уровень: ${this.saves.get().level}`);
    if (quest.id === 'heart_of_ruin') {
      this.time.delayedCall(450, () => GameEvents.emit('ending', { playtime: this.saves.get().playtime, level: this.saves.get().level, reputation: this.saves.get().reputation }));
    }
    this.emitHud(true);
  }

  private onQuestProgress(update: { changed: boolean; completedObjective?: string; readyQuest?: QuestDefinition }): void {
    if (!update.changed) return;
    if (update.readyQuest) {
      GameEvents.emit('toast', `Цель выполнена • вернитесь к заказчику «${update.readyQuest.title}»`);
      this.sfx.quest();
    } else if (update.completedObjective) {
      GameEvents.emit('toast', `Цель выполнена: ${update.completedObjective}`);
    }
    this.syncInteractables();
  }

  private equipWeapon(weaponId: string): void {
    const weapon = WEAPONS.find((item) => item.id === weaponId);
    if (!weapon || !this.saves.get().ownedWeapons.includes(weaponId)) return;
    this.saves.patch({ equippedWeapon: weaponId }, true);
    this.sfx.ui();
    GameEvents.emit('toast', `Экипировано: ${weapon.name}`);
    this.emitHud(true);
  }

  private buyWeapon(weaponId: string): void {
    const weapon = WEAPONS.find((item) => item.id === weaponId);
    const save = this.saves.get();
    if (!weapon || save.ownedWeapons.includes(weaponId)) return;
    if (save.reputation < weapon.requiredRep) { GameEvents.emit('toast', `Нужна репутация ${weapon.requiredRep}`); return; }
    if (save.coins < weapon.price) { GameEvents.emit('toast', 'Недостаточно золота'); return; }
    this.saves.mutate((state) => {
      state.coins -= weapon.price;
      state.ownedWeapons.push(weaponId);
      state.equippedWeapon = weaponId;
    }, true);
    this.onQuestProgress(this.quests.record('purchase', weaponId));
    this.sfx.coin();
    GameEvents.emit('toast', `Куплено и экипировано: ${weapon.name}`);
    this.emitHud(true);
  }

  private claimTier(tierNumber: number): void {
    const tier = BATTLE_PASS.find((item) => item.tier === tierNumber);
    const save = this.saves.get();
    if (!tier || save.reputation < tier.reputation || save.claimedTiers.includes(tierNumber)) return;
    this.saves.mutate((state) => {
      state.claimedTiers.push(tierNumber);
      state.coins += tier.coins ?? 0;
      state.potions += tier.potions ?? 0;
      if (tier.weapon && !state.ownedWeapons.includes(tier.weapon)) state.ownedWeapons.push(tier.weapon);
    }, true);
    this.sfx.quest();
    GameEvents.emit('toast', `Награда пропуска: ${tier.rewardLabel}`);
    this.emitHud(true);
  }

  private updateLocation(): void {
    const location = LOCATIONS.find((item) => Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(item.x, item.y, item.w, item.h), this.player.x, this.player.y));
    const name = location?.name ?? 'Дороги Долины';
    if (name === this.lastLocation) return;
    this.lastLocation = name;
    GameEvents.emit('location', name);
    if (location?.id === 'ruins') this.onQuestProgress(this.quests.record('visit', 'ruins'));
    this.emitHud(true);
  }

  private updateObjectiveMarker(): void {
    if (!this.objectiveMarker) return;
    const active = this.quests.activeObjective();
    if (!active) return void this.objectiveMarker.setVisible(false);
    if (active.progress.status === 'ready') {
      const npc = NPCS.find((item) => item.id === active.quest.giver);
      if (npc) this.objectiveMarker.setPosition(npc.x, npc.y + 6).setVisible(true);
      return;
    }
    const objective = active.quest.objectives[active.progress.objectiveIndex];
    const positions: Record<string, { x: number; y: number }> = {
      moonwort: { x: 690, y: 740 }, husk: { x: 1820, y: 590 }, witchbow: { x: 1155, y: 610 }, boneguard: { x: 2240, y: 1120 },
      shadebloom: { x: 1370, y: 1320 }, forest_altar: { x: 1660, y: 1580 }, ruins: { x: 2120, y: 1130 }, nameless: { x: 2280, y: 1330 },
      charm: { x: 2030, y: 520 }, direwolf: { x: 1390, y: 1370 }, lantern: { x: 1590, y: 820 },
    };
    const position = positions[objective.target];
    if (position) this.objectiveMarker.setPosition(position.x, position.y).setVisible(true);
    else this.objectiveMarker.setVisible(false);
  }

  private updateEnemyBars(): void {
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return null;
      const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics;
      if (!bar) return null;
      const health = Number(enemy.getData('health'));
      const max = Number(enemy.getData('maxHealth'));
      const close = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 320;
      bar.setVisible(close && health < max);
      if (bar.visible) {
        const width = enemy.getData('type') === 'nameless' ? 82 : 44;
        bar.clear().fillStyle(0x0b0c12, .9).fillRect(enemy.x - width / 2, enemy.y - enemy.displayHeight * .55, width, 7)
          .fillStyle(enemy.getData('type') === 'nameless' ? 0xc85182 : 0xb64d5e, 1).fillRect(enemy.x - width / 2 + 1, enemy.y - enemy.displayHeight * .55 + 1, (width - 2) * health / max, 5);
        bar.setDepth(enemy.depth + 2);
      }
      return null;
    });
  }

  private syncBoss(): void {
    const bossObjective = this.isObjectiveActive('kill', 'nameless');
    if (bossObjective && (!this.boss || !this.boss.scene)) this.boss = this.spawnEnemy({ type: 'nameless', x: 2280, y: 1330 });
    if (!this.boss?.scene) return;
    const body = this.boss.body as Phaser.Physics.Arcade.Body;
    if (bossObjective && !this.boss.active) {
      this.boss.setActive(true).setVisible(true);
      body.enable = true;
      const flash = this.add.circle(this.boss.x, this.boss.y, 110, 0xa65489, .35).setDepth(this.boss.depth - 1);
      this.tweens.add({ targets: flash, scale: 1.7, alpha: 0, duration: 900, onComplete: () => flash.destroy() });
      GameEvents.emit('toast', 'Безымянная пробудилась в сердце руин');
    }
  }

  private emitTutorial(): void {
    const save = this.saves.get();
    if (save.tutorialDone) { GameEvents.emit('tutorial', null); return; }
    if (!save.flags.tutorialMoved) { GameEvents.emit('tutorial', { step: 1, title: 'Начните путь', text: 'Используйте WASD, стрелки или левый стик, чтобы двигаться.' }); return; }
    if (!save.flags.tutorialAttacked) { GameEvents.emit('tutorial', { step: 2, title: 'Обнажите клинок', text: 'Нажмите пробел, левую кнопку мыши или кнопку атаки.' }); return; }
    GameEvents.emit('tutorial', { step: 3, title: 'Найдите клятву', text: 'Подойдите к Сестре Море и нажмите E или кнопку действия.' });
  }

  private emitHud(force = false): void {
    const save = this.saves.get();
    const active = this.quests.activeObjective();
    const objective = active ? active.quest.objectives[active.progress.objectiveIndex] : undefined;
    const snapshot: HudSnapshot = {
      health: save.health,
      maxHealth: save.maxHealth,
      level: save.level,
      xp: save.xp,
      xpNext: XP_FOR_LEVEL(save.level),
      coins: save.coins,
      reputation: save.reputation,
      potions: save.potions,
      equippedWeapon: save.equippedWeapon,
      ownedWeapons: [...save.ownedWeapons],
      activeQuest: active && objective ? {
        title: active.quest.title,
        objective: objective.label,
        amount: active.progress.amount,
        required: objective.amount,
        ready: active.progress.status === 'ready',
      } : undefined,
      quests: this.quests.snapshotQuests(),
      claimedTiers: [...save.claimedTiers],
      tutorialDone: save.tutorialDone,
    };
    const signature = JSON.stringify(snapshot);
    if (!force && signature === this.lastHudSignature) return;
    this.lastHudSignature = signature;
    GameEvents.emit('hud', { snapshot, save: structuredClone(save) });
    this.updateNpcMarkers();
  }

  private updateNpcMarkers(): void {
    NPCS.forEach((npc) => {
      const marker = this.npcMarkers.get(npc.id);
      if (!marker) return;
      const quests = QUESTS.filter((quest) => quest.giver === npc.id && !this.quests.isLocked(quest));
      const ready = quests.some((quest) => this.saves.get().questProgress[quest.id]?.status === 'ready');
      const available = quests.some((quest) => !this.saves.get().questProgress[quest.id] && this.quests.status(quest) === 'available');
      marker.setText(ready ? '?' : available ? '!' : '').setColor(ready ? '#e9c56e' : '#d98ca6');
    });
  }

  private cleanup(): void {
    this.eventDisposers.forEach((dispose) => dispose());
    this.eventDisposers = [];
    this.ui?.destroy();
    this.saves?.flush();
  }
}
