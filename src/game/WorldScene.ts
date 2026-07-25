import Phaser from 'phaser';
import { BATTLE_PASS, ENEMIES, NPCS, QUESTS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { getItem } from '../data/items';
import { BUILDINGS, LOCATIONS, WORLD_HEIGHT, WORLD_WIDTH, getBuildingDoor } from '../data/world';
import { GameUI } from '../ui/GameUI';
import { AudioManager, audio } from '../systems/AudioManager';
import { InventorySystem } from '../systems/InventorySystem';
import { QuestSystem } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import type { DialogueAction, DialoguePayload, HudSnapshot, ObjectiveType, PlayerSave, QuestDefinition, WeaponDefinition } from './types';
import { GameEvents } from './events';

const PLAYER_START = { x: 430, y: 585 };

type InteractiveKind = 'npc' | 'collect' | 'lantern' | 'altar' | 'door' | 'chest' | 'shrine' | 'lift';

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
  private inventory!: InventorySystem;
  private readonly sfx: AudioManager = audio;
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
  private cinderBoss?: Phaser.Physics.Arcade.Sprite;
  private playtimeAccumulator = 0;
  private lastStepAt = 0;
  private currentCombat = false;
  private comboHits = 0;
  private comboExpires = 0;
  private lastSlowTickAt = 0;
  private requestedSpawn?: { x: number; y: number };

  constructor() {
    super('WorldScene');
  }

  init(data?: { spawnX?: number; spawnY?: number; fromInterior?: boolean }): void {
    this.requestedSpawn = data?.spawnX !== undefined && data?.spawnY !== undefined ? { x: data.spawnX, y: data.spawnY } : undefined;
  }

  create(): void {
    this.saves = new SaveSystem();
    this.quests = new QuestSystem(this.saves);
    this.inventory = new InventorySystem(this.saves);
    this.saves.mutate((save) => { save.currentScene = 'world'; }, true);
    this.sfx.setMix(this.audioMix(this.saves.get()));
    if (!this.sfx.isUnlocked()) void this.sfx.unlock();
    document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
    document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
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
    if (this.comboHits > 0 && time > this.comboExpires) { this.comboHits = 0; GameEvents.emit('combo', { hits: 0, multiplier: 1 }); }
    this.updatePlayer(time, delta);
    this.updateProjectiles(delta);
    if (time > this.lastSlowTickAt + 72) {
      this.updateEnemies(time, time - this.lastSlowTickAt);
      this.updateInteractions();
      this.updateLocation();
      this.updateObjectiveMarker();
      this.updateEnemyBars();
      this.syncBoss();
      this.ui.updateWorldPosition(this.player.x, this.player.y);
      this.lastSlowTickAt = time;
    }
    this.player.setDepth(this.player.y / 10 + 20);
    this.playtimeAccumulator += delta;
    if (this.playtimeAccumulator > 450) {
      this.playtimeAccumulator = 0;
      this.saves.mutate((save) => { save.playerPosition = { x: Math.round(this.player.x), y: Math.round(this.player.y) }; });
      this.emitHud();
    }
  }

  private drawWorld(): void {
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x172421, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (let y = 0; y < WORLD_HEIGHT; y += 48) {
      ground.lineStyle(1, 0x567064, .045).lineBetween(0, y, WORLD_WIDTH, y);
    }

    for (const location of LOCATIONS) {
      ground.fillStyle(location.color, 1).fillRoundedRect(location.x, location.y, location.w, location.h, 28);
      ground.lineStyle(location.danger >= 2 ? 5 : 3, Phaser.Display.Color.IntegerToColor(location.color).brighten(18).color, 0.5)
        .strokeRoundedRect(location.x, location.y, location.w, location.h, 28);
    }

    const road = (points: Array<[number, number]>, width = 74, color = 0x574f43) => {
      ground.lineStyle(width, color, 1).beginPath().moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
      ground.strokePath();
      ground.lineStyle(8, 0x383937, .7).beginPath().moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
      ground.strokePath();
    };
    road([[410,620],[900,670],[1350,620],[1820,720],[2350,1120],[3250,1450],[4120,1860]], 78);
    road([[900,670],[1080,1100],[1500,1380],[2140,1460],[3050,2350]], 42, 0x665d4d);
    road([[2330,1100],[3030,650],[3470,620]], 48, 0x4d5045);
    road([[3300,1450],[3180,2240],[3050,2350]], 46, 0x4f514b);

    ground.fillStyle(0x213c49, 1).fillRect(2520, 0, 240, WORLD_HEIGHT);
    ground.fillStyle(0x345968, .75);
    for (let y = 35; y < WORLD_HEIGHT; y += 74) ground.fillRect(2540 + (y % 140) / 9, y, 170, 5);
    ground.fillStyle(0x4b4036, 1).fillRect(2500, 930, 280, 70);
    ground.fillStyle(0x6b5b48, 1);
    for (let x = 2510; x < 2770; x += 28) ground.fillRect(x, 935, 18, 60);

    this.drawBuildings();
    this.drawCemetery();
    this.drawRuins();
    this.drawMarsh();
    this.drawMines();
    this.drawDocks();
    this.drawCitadel();
    this.scatterDecorations();

    LOCATIONS.forEach((location) => {
      this.add.text(location.x + location.w / 2, location.y + 30, location.name.toUpperCase(), {
        fontFamily: 'monospace', fontSize: location.id === 'citadel' ? '20px' : '18px', fontStyle: 'bold', color: '#d3cdd6',
        stroke: '#11131a', strokeThickness: 6, letterSpacing: 4,
      }).setOrigin(0.5).setAlpha(location.danger >= 2 ? .34 : .24).setDepth(2);
    });
  }

  private drawBuildings(): void {
    BUILDINGS.forEach((building, index) => {
      const { x, y, w, h, wall, roof, name, doorX } = building;
      const graphics = this.add.graphics().setDepth((y + h / 2) / 10 + 5);
      graphics.fillStyle(0x080a10, .62).fillRect(x - w / 2 + 12, y - h / 2 + 16, w, h);
      graphics.fillStyle(wall, 1).fillRect(x - w / 2, y - h / 2, w, h);
      graphics.fillStyle(Phaser.Display.Color.IntegerToColor(wall).brighten(10).color, .32).fillRect(x - w / 2 + 8, y - h / 2 + 38, w - 16, 8);
      graphics.fillStyle(roof, 1).fillRect(x - w / 2 - 13, y - h / 2 - 17, w + 26, 49);
      graphics.lineStyle(4, 0x171821, 1).strokeRect(x - w / 2, y - h / 2, w, h);
      for (let tx = x - w / 2; tx < x + w / 2; tx += 29) {
        graphics.lineStyle(4, 0x171821, .9).lineBetween(tx, y - h / 2 + 29, tx + 21, y - h / 2 - 13);
      }
      graphics.fillStyle(0x211a1d, 1).fillRect(x + doorX - 19, y + h / 2 - 50, 38, 50);
      graphics.fillStyle(building.interior ? 0xd9a75c : 0x756b61, 1).fillCircle(x + doorX + 11, y + h / 2 - 27, 3);
      const windowCount = w > 220 ? 2 : 1;
      for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
        const wx = x - w / 2 + 25 + windowIndex * (w - 70);
        graphics.fillStyle(0x9b744d, 1).fillRect(wx, y - 10, 36, 30);
        graphics.fillStyle(index % 3 === 0 ? 0x8f7899 : 0x7ea0a2, 1).fillRect(wx + 5, y - 5, 26, 20);
        graphics.lineStyle(2, 0x30313b, 1).lineBetween(wx + 18, y - 5, wx + 18, y + 15);
      }
      this.add.text(x, y - h / 2 - 27, name, { fontFamily: 'monospace', fontSize: '10px', color: '#ded8e1', backgroundColor: '#11131acc', padding: { x: 6, y: 3 } }).setOrigin(.5).setDepth((y + h / 2) / 10 + 7);
      this.addSolidRect(x, y - 5, w, h - 6);
    });

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

  private drawMarsh(): void {
    const graphics = this.add.graphics().setDepth(3);
    for (let index = 0; index < 18; index += 1) {
      const x = 2870 + (index * 173) % 820;
      const y = 300 + (index * 241) % 650;
      const w = 90 + (index % 4) * 28;
      const h = 42 + (index % 3) * 17;
      graphics.fillStyle(0x183c3c, .9).fillEllipse(x, y, w, h);
      graphics.lineStyle(3, 0x477a68, .38).strokeEllipse(x, y, w, h);
      graphics.fillStyle(0x78a76d, .45).fillCircle(x - w * .18, y, 5 + index % 4);
    }
    for (let index = 0; index < 22; index += 1) {
      const x = 2830 + (index * 113) % 930;
      const y = 240 + (index * 197) % 780;
      this.add.image(x, y, 'tree').setScale(1.6 + index % 3 * .18).setTint(0x718f7b).setAlpha(.78).setDepth(y / 10 + 7);
    }
  }

  private drawMines(): void {
    const graphics = this.add.graphics().setDepth(4);
    graphics.fillStyle(0x211e1c, 1).fillRoundedRect(3400, 1260, 390, 330, 30);
    graphics.lineStyle(18, 0x615343, 1).strokeRoundedRect(3400, 1260, 390, 330, 30);
    graphics.fillStyle(0x0b0c10, 1).fillEllipse(3595, 1435, 190, 165);
    graphics.lineStyle(7, 0x9a754d, .8).strokeEllipse(3595, 1435, 190, 165);
    for (let rail = 0; rail < 7; rail += 1) {
      graphics.fillStyle(0x7d6245, 1).fillRect(3450 + rail * 46, 1570 + rail * 28, 34, 12);
    }
    graphics.lineStyle(5, 0x42434a, 1).lineBetween(3450, 1580, 3790, 1790).lineBetween(3480, 1550, 3820, 1760);
    this.addSolidRect(3400, 1275, 360, 28);
  }

  private drawDocks(): void {
    const graphics = this.add.graphics().setDepth(4);
    graphics.fillStyle(0x1f3945, 1).fillRect(2740, 2460, 910, 210);
    graphics.fillStyle(0x6b513b, 1);
    for (let pier = 0; pier < 4; pier += 1) {
      const x = 2840 + pier * 210;
      graphics.fillRect(x, 2240, 74, 330);
      for (let plank = 0; plank < 11; plank += 1) graphics.fillStyle(plank % 2 ? 0x745941 : 0x654b38, 1).fillRect(x + 4, 2248 + plank * 28, 66, 22);
    }
    graphics.fillStyle(0x826346, 1).fillRect(2780, 2360, 820, 92);
    for (let x = 2790; x < 3590; x += 52) graphics.lineStyle(3, 0x3a3029, .8).lineBetween(x, 2365, x, 2445);
    graphics.fillStyle(0x332c27, 1).fillEllipse(3270, 2585, 125, 45);
    graphics.lineStyle(4, 0xa17950, .8).strokeEllipse(3270, 2585, 125, 45);
  }

  private drawCitadel(): void {
    const graphics = this.add.graphics().setDepth(5);
    graphics.fillStyle(0x2a1d22, 1).fillRect(3880, 1570, 570, 1030);
    graphics.lineStyle(24, 0x73444a, 1).strokeRect(3880, 1570, 570, 1030);
    for (let y = 1640; y < 2550; y += 145) {
      graphics.fillStyle(0x4b3035, 1).fillRect(3894, y, 542, 22);
    }
    for (const x of [3940, 4380]) {
      graphics.fillStyle(0x171217, 1).fillCircle(x, 1740, 54);
      graphics.fillStyle(0xd84f37, .85).fillCircle(x, 1752, 34);
      graphics.fillStyle(0xffc55e, .9).fillCircle(x, 1760, 17);
    }
    graphics.fillStyle(0x171217, 1).fillRoundedRect(4060, 2350, 210, 230, 24);
    graphics.lineStyle(8, 0xc35a43, .7).strokeRoundedRect(4060, 2350, 210, 230, 24);
    this.addSolidRect(3880, 2090, 24, 1000);
    this.addSolidRect(4450, 2090, 24, 1000);
    this.addSolidRect(4165, 1570, 570, 24);
    this.addSolidRect(3980, 2600, 200, 24);
    this.addSolidRect(4350, 2600, 200, 24);
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
    for (let index = 0; index < 55; index += 1) {
      const x = 90 + random() * (WORLD_WIDTH - 180);
      const y = 80 + random() * (WORLD_HEIGHT - 160);
      const inLocation = LOCATIONS.some((location) => x > location.x - 50 && x < location.x + location.w + 50 && y > location.y - 50 && y < location.y + location.h + 50);
      if (!inLocation) addTree(x, y, 1.7 + random() * .5);
    }
    for (let index = 0; index < 65; index += 1) {
      const x = 100 + random() * (WORLD_WIDTH - 200);
      const y = 100 + random() * (WORLD_HEIGHT - 200);
      this.add.image(x, y, 'rock').setScale(1.3 + random() * .8).setAlpha(.82).setDepth(y / 10 + 1);
    }
  }

  private addSolidRect(x: number, y: number, width: number, height: number): void {
    const zone = this.add.zone(x, y, width, height);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  private createPlayer(): void {
    const saved = this.requestedSpawn ?? this.saves.get().playerPosition ?? PLAYER_START;
    this.player = this.physics.add.sprite(saved.x, saved.y, 'hero-down-0').setScale(2.05);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(13, 11).setOffset(5.5, 17);
  }

  private createNpcs(): void {
    NPCS.forEach((npc, index) => {
      const sprite = this.add.sprite(npc.x, npc.y, `npc-${index}`).setScale(2.05).setDepth(npc.y / 10 + 10);
      sprite.setData('npcId', npc.id);
      const name = this.add.text(npc.x, npc.y - 48, npc.name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ded9e2', stroke: '#11131a', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(npc.y / 10 + 20);
      name.setData('labelFor', npc.id);
      const marker = this.add.text(npc.x, npc.y - 78, '', {
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
      const activeTexture = used && kind === 'lantern' ? 'lantern-on' : texture;
      const image = this.add.image(x, y, activeTexture).setScale(kind === 'lantern' ? 2.3 : kind === 'lift' ? 2.4 : 2).setDepth(y / 10 + 4);
      if (used && kind !== 'lantern' && kind !== 'lift') image.setVisible(false);
      if (!used && kind !== 'lantern' && kind !== 'lift') this.tweens.add({ targets: image, y: y - 5, duration: 900 + index * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.interactables.push({ kind, id, uniqueId, label, object: image, objectiveType, target });
    };

    [[660,735],[760,665],[620,850]].forEach(([x,y], index) => addItem('collect','moonwort','moonwort','Собрать лунную полынь','herb-moonwort',x,y,index,'collect'));
    [[1120,1190],[1260,1410],[1510,1110],[1630,1450]].forEach(([x,y], index) => addItem('collect','shadebloom','shadebloom','Собрать цветок тени','herb-shadebloom',x,y,index,'collect'));
    addItem('collect','charm','charm','Поднять медальон Элиры','charm',2030,520,0,'collect');
    [[2940,420],[3150,870],[3440,340],[3650,760]].forEach(([x,y], index) => addItem('collect','bog_reed','bog_reed','Собрать болотный тростник','herb-bog-reed',x,y,index,'collect'));
    [[2870,640],[3050,310],[3280,930],[3540,520],[3710,870]].forEach(([x,y], index) => addItem('collect','glowcap','glowcap','Собрать светогриб','glowcap',x,y,index,'collect'));
    [[2840,2500],[3290,2430],[3590,2520]].forEach(([x,y], index) => addItem('collect','cargo','ferryman_cargo','Поднять запечатанный груз','cargo',x,y,index,'collect'));
    addItem('collect','miner_tools','miner_tools','Забрать инструменты Брама','miner-tools',3810,1640,0,'collect');
    [[1330,670],[1590,820],[1930,930]].forEach(([x,y], index) => addItem('lantern','lantern','lantern','Зажечь фонарь','lantern-off',x,y,index,'interact'));
    addItem('altar','forest_altar','forest_altar','Провести ритуал','altar',1660,1580,0,'interact');
    addItem('lift','mine_lift','mine_lift','Запустить подъёмник','mine-lift',3595,1450,0,'interact');

    BUILDINGS.filter((building) => building.interior).forEach((building, index) => {
      const door = getBuildingDoor(building);
      const image = this.add.image(door.x, door.y, 'door-glow').setScale(1.8).setDepth(door.y / 10 + 6).setAlpha(.7);
      this.tweens.add({ targets: image, alpha: { from: .28, to: .92 }, duration: 1050 + index * 80, yoyo: true, repeat: -1 });
      this.interactables.push({ kind: 'door', id: building.id, uniqueId: `door:${building.id}`, label: `Войти: ${building.name.toLowerCase()}`, object: image, target: building.interior });
    });

    const chestPoints = [[2080,1740],[3010,960],[3460,1740],[2890,2600],[4300,2450]];
    chestPoints.forEach(([x,y], index) => {
      const uniqueId = `world-chest:${index}`;
      const opened = Boolean(this.saves.get().flags[uniqueId]);
      const image = this.add.image(x, y, opened ? 'chest-open' : 'chest-closed').setScale(2).setDepth(y / 10 + 7);
      this.interactables.push({ kind: 'chest', id: String(index), uniqueId, label: opened ? 'Сундук пуст' : 'Открыть сундук', object: image });
    });

    [[850,1960],[2880,760],[3990,2240]].forEach(([x,y], index) => {
      const uniqueId = `shrine:${index}`;
      const used = Boolean(this.saves.get().flags[uniqueId]);
      const image = this.add.image(x, y, 'altar').setScale(2.2).setTint(used ? 0x666570 : 0x9e76c2).setDepth(y / 10 + 6);
      this.interactables.push({ kind: 'shrine', id: String(index), uniqueId, label: used ? 'Святилище молчит' : 'Коснуться святилища', object: image });
    });
    this.syncInteractables();
  }

  private createEnemies(): void {
    const spawns: EnemySpawn[] = [
      { type: 'husk', x: 1630, y: 450 }, { type: 'husk', x: 1810, y: 520 }, { type: 'husk', x: 1980, y: 650 }, { type: 'husk', x: 1720, y: 760 }, { type: 'husk', x: 2070, y: 780 },
      { type: 'direwolf', x: 1180, y: 1160 }, { type: 'direwolf', x: 1390, y: 1370 }, { type: 'direwolf', x: 1610, y: 1210 }, { type: 'direwolf', x: 1050, y: 1510 },
      { type: 'boneguard', x: 2040, y: 1100 }, { type: 'boneguard', x: 2240, y: 1110 }, { type: 'boneguard', x: 2440, y: 1210 },
      { type: 'wraith', x: 2140, y: 1380 }, { type: 'wraith', x: 2410, y: 1520 },
      { type: 'bogling', x: 2950, y: 380 }, { type: 'bogling', x: 3240, y: 430 }, { type: 'bogling', x: 3460, y: 760 }, { type: 'bogling', x: 3660, y: 890 }, { type: 'bogling', x: 3040, y: 880 },
      { type: 'cavecrawler', x: 3380, y: 1280 }, { type: 'cavecrawler', x: 3720, y: 1380 }, { type: 'cavecrawler', x: 3500, y: 1710 }, { type: 'cavecrawler', x: 3850, y: 1740 },
      { type: 'ashborn', x: 3950, y: 1650 }, { type: 'ashborn', x: 4310, y: 1780 }, { type: 'ashborn', x: 4020, y: 2110 }, { type: 'ashborn', x: 4380, y: 2320 }, { type: 'ashborn', x: 4080, y: 2510 },
      { type: 'nameless', x: 2280, y: 1330 }, { type: 'cinderlord', x: 4200, y: 2420 },
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
    if (spawn.type === 'nameless' || spawn.type === 'cinderlord') {
      if (spawn.type === 'nameless') this.boss = enemy;
      else this.cinderBoss = enemy;
      enemy.setVisible(false).setActive(false);
      body.enable = false;
    }
    return enemy;
  }

  private createAtmosphere(): void {
    const overlay = this.add.graphics().setScrollFactor(0).setDepth(900);
    const { width, height } = this.scale;
    overlay.fillStyle(0x17132b, .1).fillRect(0, 0, width, height);
    overlay.fillStyle(0x05070d, .22).fillRect(0, 0, width, 55);
    overlay.fillStyle(0x05070d, .18).fillRect(0, height - 70, width, 70);
    const low = this.saves.get().settings.quality === 'low' || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700);
    const moteCount = low ? 28 : 86;
    for (let index = 0; index < moteCount; index += 1) {
      const x = Phaser.Math.Between(160, WORLD_WIDTH - 160);
      const y = Phaser.Math.Between(180, WORLD_HEIGHT - 150);
      const inMarsh = x > 2780 && x < 3830 && y < 1100;
      const inCitadel = x > 3820 && y > 1420;
      const texture = inMarsh ? 'firefly' : inCitadel ? 'ember' : 'pixel';
      const tint = inMarsh ? 0xbaffb0 : inCitadel ? 0xff7c48 : index % 3 === 0 ? 0xb57ac9 : 0x91b69e;
      const mote = this.add.image(x, y, texture).setTint(tint).setAlpha(Phaser.Math.FloatBetween(.12, .5)).setScale(Phaser.Math.FloatBetween(.8, 2.1)).setDepth(3);
      this.tweens.add({ targets: mote, y: mote.y - Phaser.Math.Between(inCitadel ? 60 : 18, inCitadel ? 140 : 65), x: mote.x + Phaser.Math.Between(-28, 28), alpha: { from: mote.alpha, to: .03 }, duration: Phaser.Math.Between(1500, 4300), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1600) });
    }
    if (!low) {
      for (let index = 0; index < 28; index += 1) {
        const drop = this.add.rectangle(Phaser.Math.Between(2800, 3780), Phaser.Math.Between(180, 1050), 2, 18, 0x8eb2bd, .22).setRotation(-.2).setDepth(6);
        this.tweens.add({ targets: drop, y: drop.y + 260, x: drop.x - 55, duration: Phaser.Math.Between(650, 1000), repeat: -1, delay: index * 65 });
      }
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
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,Q,I,M,B,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
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
    this.listen<string>('equip-item', (itemId) => { if (this.inventory.equip(itemId)) { this.sfx.ui(); this.emitHud(true); } });
    this.listen<string>('use-item', (itemId) => this.useInventoryItem(itemId));
    this.listen<{ itemId?: string; direction?: 'toChest' | 'toInventory' }>('transfer-item', ({ itemId, direction }) => {
      if (itemId && direction && this.inventory.transfer(itemId, 1, direction)) { this.sfx.pickup(); this.emitHud(true); }
    });
    this.listen<string>('buy', (weaponId) => this.buyWeapon(weaponId));
    this.listen<number>('claim-tier', (tier) => this.claimTier(tier));
    this.listen<string>('quest-accept', (questId) => this.acceptQuest(questId));
    this.listen<string>('quest-turnin', (questId) => this.turnInQuest(questId));
    this.listen<void>('open-shop', () => GameEvents.emit('panel-open', 'shop'));
    this.listen<void>('toggle-sound', () => {
      this.saves.mutate((save) => { save.settings.sound = !save.settings.sound; }, true);
      this.sfx.setMix(this.audioMix(this.saves.get()));
      if (this.saves.get().settings.sound) void this.sfx.unlock();
      this.emitHud(true);
    });
    this.listen<{ key?: keyof PlayerSave['settings']; value?: number }>('set-volume', ({ key, value }) => {
      if (!key || typeof value !== 'number' || !key.endsWith('Volume')) return;
      this.saves.mutate((save) => { (save.settings[key] as number) = value; }, true);
      this.sfx.setMix(this.audioMix(this.saves.get()));
    });
    this.listen<void>('toggle-motion', () => {
      this.saves.mutate((save) => { save.settings.reducedMotion = !save.settings.reducedMotion; }, true);
      document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
      this.emitHud(true);
    });
    this.listen<void>('toggle-quality', () => {
      const order: PlayerSave['settings']['quality'][] = ['auto', 'high', 'low'];
      this.saves.mutate((save) => { save.settings.quality = order[(order.indexOf(save.settings.quality) + 1) % order.length]; }, true);
      document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
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
    const speed = 190 + this.inventory.speedBonus();
    this.player.setVelocity(input.x * speed, input.y * speed);

    if (input.lengthSq() > .02) {
      this.facing.copy(input).normalize();
      this.movedDistance += speed * delta / 1000;
      if (time > this.lastStepAt + 330) {
        const surface = this.lastLocation.includes('Пристан') || this.lastLocation.includes('Болото') ? 'water' : this.lastLocation.includes('Цитад') || this.lastLocation.includes('Кладбищ') ? 'stone' : 'grass';
        this.sfx.step(surface);
        this.lastStepAt = time;
      }
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
    const weaponKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT'];
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
      if (toEnemy.dot(direction) > .12) this.damageEnemy(enemy, weapon.damage + this.inventory.damageBonus());
      return null;
    });
  }

  private projectileAttack(weapon: WeaponDefinition, direction: Phaser.Math.Vector2): void {
    const texture = weapon.kind === 'magic' ? 'projectile-magic' : 'projectile-bolt';
    const projectile = this.physics.add.sprite(this.player.x + direction.x * 30, this.player.y + direction.y * 30, texture)
      .setScale(weapon.kind === 'magic' ? 1.7 : 2).setRotation(direction.angle()).setDepth(this.player.depth + 3);
    projectile.setData({ damage: weapon.damage + this.inventory.damageBonus(), ttl: weapon.range / (weapon.projectileSpeed ?? 350) * 1000 });
    projectile.setVelocity(direction.x * (weapon.projectileSpeed ?? 350), direction.y * (weapon.projectileSpeed ?? 350));
    this.projectiles.add(projectile);
    if (weapon.kind === 'magic') this.tweens.add({ targets: projectile, angle: projectile.angle + 180, duration: 450, repeat: -1 });
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
    if (!enemy.active) return;
    if (this.time.now > this.comboExpires) this.comboHits = 0;
    this.comboHits += 1;
    this.comboExpires = this.time.now + 1900;
    const comboMultiplier = 1 + Math.min(10, this.comboHits - 1) * .025;
    const finalDamage = Math.round(damage * comboMultiplier);
    const health = Math.max(0, Number(enemy.getData('health')) - finalDamage);
    enemy.setData('health', health);
    GameEvents.emit('combo', { hits: this.comboHits, multiplier: comboMultiplier });
    enemy.setTintFill(0xf5d5df);
    this.time.delayedCall(90, () => { if (enemy.active) enemy.clearTint(); });
    const number = this.add.text(enemy.x, enemy.y - 38, `-${finalDamage}`, { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#ffd2dc', stroke: '#15161d', strokeThickness: 4 }).setOrigin(.5).setDepth(900);
    this.tweens.add({ targets: number, y: number.y - 28, alpha: 0, duration: 580, onComplete: () => number.destroy() });
    this.sfx.hit();
    if (health <= 0) this.killEnemy(enemy);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const type = enemy.getData('type') as keyof typeof ENEMIES;
    const definition = ENEMIES[type];
    const coins = Number(enemy.getData('rewardCoins'));
    const spawn = enemy.getData('spawn') as EnemySpawn;
    const deathX = enemy.x;
    const deathY = enemy.y;
    const depth = enemy.depth;
    const bar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics | undefined;
    bar?.destroy();
    this.saves.mutate((save) => { save.coins += coins; });
    const update = this.quests.record('kill', type, 1);
    const color = type === 'nameless' ? 0xd77ac7 : type === 'cinderlord' || type === 'ashborn' ? 0xff7549 : type === 'bogling' ? 0x7bdaa7 : 0xc09a7b;
    for (let index = 0; index < 7; index += 1) {
      const puff = this.add.image(deathX + Phaser.Math.Between(-18, 18), deathY + Phaser.Math.Between(-12, 12), index % 2 ? 'spark' : 'pixel').setScale(Phaser.Math.FloatBetween(2, 5)).setTint(color).setDepth(depth + 3);
      this.tweens.add({ targets: puff, x: puff.x + Phaser.Math.Between(-55, 55), y: puff.y + Phaser.Math.Between(-65, 15), scale: Phaser.Math.FloatBetween(5, 10), alpha: 0, angle: Phaser.Math.Between(-120, 120), duration: Phaser.Math.Between(380, 720), onComplete: () => puff.destroy() });
    }
    enemy.destroy();
    for (const drop of definition.drops ?? []) {
      if (Math.random() > drop.chance) continue;
      const quantity = Phaser.Math.Between(drop.min, drop.max);
      this.inventory.add(drop.itemId, quantity, true);
      this.sfx.pickup();
      GameEvents.emit('loot', { itemId: drop.itemId, quantity });
    }
    this.sfx.coin();
    GameEvents.emit('toast', `+${coins} золота • ${definition.name} повержен`);
    if (update.readyQuest) this.sfx.quest();
    if (type !== 'nameless' && type !== 'cinderlord') this.time.delayedCall(11000, () => this.spawnEnemy(spawn));
    else if (type === 'nameless') this.boss = undefined;
    else this.cinderBoss = undefined;
    this.onQuestProgress(update);
    this.emitHud(true);
  }

  private updateEnemies(time: number, _delta: number): void {
    if (this.uiLocked || !this.player.active) {
      this.enemies.setVelocity(0, 0);
      this.sfx.setCombat(false);
      return;
    }
    let combat = false;
    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return null;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const aggro = Number(enemy.getData('aggro'));
      const speed = Number(enemy.getData('speed'));
      const homeX = Number(enemy.getData('homeX'));
      const homeY = Number(enemy.getData('homeY'));
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const renderDistance = this.saves.get().settings.quality === 'low' ? 900 : 1450;
      enemy.setVisible(distance < renderDistance);
      const healthBar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics | undefined;
      if (distance >= renderDistance) {
        body.setVelocity(0);
        healthBar?.setVisible(false);
        return null;
      }
      if (distance < aggro) {
        combat = true;
        this.physics.moveToObject(enemy, this.player, speed);
        enemy.setFlipX(body.velocity.x < 0);
        if (distance < 42 + enemy.displayWidth * .18 && time > Number(enemy.getData('lastAttack')) + 850) {
          enemy.setData('lastAttack', time);
          this.hurtPlayer(Number(enemy.getData('damage')));
        }
      } else {
        const homeDistance = Phaser.Math.Distance.Between(enemy.x, enemy.y, homeX, homeY);
        if (homeDistance > 55) this.physics.moveTo(enemy, homeX, homeY, speed * .48);
        else body.setVelocity(Math.sin((time + homeX) * .001) * 8, Math.cos((time + homeY) * .0012) * 8);
      }
      enemy.setDepth(enemy.y / 10 + 12);
      return null;
    });
    if (combat !== this.currentCombat) {
      this.currentCombat = combat;
      this.sfx.setCombat(combat);
    }
  }

  private hurtPlayer(amount: number): void {
    if (this.time.now < this.hurtReadyAt || !this.player.active) return;
    this.hurtReadyAt = this.time.now + 650;
    const reduced = Math.max(1, amount - this.inventory.armor());
    this.saves.mutate((save) => { save.health = Math.max(0, save.health - reduced); });
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
      save.health = this.inventory.maxHealth(save);
      save.coins = Math.max(0, save.coins - Math.min(35, Math.floor(save.coins * .1)));
    }, true);
    this.player.setPosition(PLAYER_START.x, PLAYER_START.y).setActive(true).setVisible(true).clearTint().setVelocity(0);
    this.uiLocked = false;
    this.cameras.main.fadeIn(350, 30, 8, 16);
    GameEvents.emit('toast', 'Вы очнулись у дома. Потеряно немного золота.');
    this.emitHud(true);
  }

  private usePotion(): void {
    this.useInventoryItem('blood_vial');
  }

  private useInventoryItem(itemId: string): void {
    if (this.uiLocked && this.player.active && !document.querySelector('#screen-panel[aria-hidden="false"]')) return;
    const result = this.inventory.use(itemId);
    GameEvents.emit('toast', result.message);
    if (!result.used) return;
    if (result.effect === 'heal') {
      this.sfx.heal();
      const glow = this.add.circle(this.player.x, this.player.y, 22, 0xc95c78, .5).setDepth(this.player.depth - 1);
      this.tweens.add({ targets: glow, radius: 70, alpha: 0, duration: 620, onComplete: () => glow.destroy() });
    } else if (result.effect === 'smoke') {
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        if (enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 180) {
          const direction = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
          enemy.setVelocity(direction.x * 260, direction.y * 260);
        }
        return null;
      });
      const smoke = this.add.circle(this.player.x, this.player.y, 35, 0x777184, .55).setDepth(this.player.depth + 2);
      this.tweens.add({ targets: smoke, radius: 150, alpha: 0, duration: 850, onComplete: () => smoke.destroy() });
    }
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
    if (entity.kind === 'door' && entity.target) {
      this.sfx.door();
      const building = BUILDINGS.find((entry) => entry.id === entity.id);
      const door = building ? getBuildingDoor(building) : { x: this.player.x, y: this.player.y };
      this.saves.mutate((save) => { save.currentScene = entity.target!; save.playerPosition = { x: door.x, y: door.y + 45 }; }, true);
      this.cameras.main.fadeOut(300, 7, 8, 14);
      this.time.delayedCall(310, () => this.scene.start('InteriorScene', { interiorId: entity.target, returnX: door.x, returnY: door.y + 45 }));
      return;
    }
    if (entity.kind === 'chest') {
      if (this.saves.get().flags[entity.uniqueId]) { GameEvents.emit('toast', 'Сундук уже пуст'); return; }
      this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
      entity.object.setTexture('chest-open');
      const rewards = ['bone_shard','greater_vial','mine_ore','smoke_bomb','ash_crystal'];
      const itemId = rewards[Number(entity.id) % rewards.length];
      const quantity = itemId === 'bone_shard' || itemId === 'mine_ore' ? 3 : 1;
      this.inventory.add(itemId, quantity, true);
      this.sfx.chest();
      GameEvents.emit('loot', { itemId, quantity });
      this.emitHud(true);
      return;
    }
    if (entity.kind === 'shrine') {
      if (this.saves.get().flags[entity.uniqueId]) { GameEvents.emit('toast', 'Святилище уже отдало силу'); return; }
      this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; save.maxHealth += 10; save.health = this.inventory.maxHealth(save); }, true);
      entity.object.setTint(0x666570);
      this.sfx.quest();
      const ring = this.add.circle(entity.object.x, entity.object.y, 28, 0xb57ad1, .45).setDepth(entity.object.depth + 1);
      this.tweens.add({ targets: ring, radius: 130, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
      GameEvents.emit('toast', 'Святилище усилило жизненную силу +10');
      this.emitHud(true);
      return;
    }
    if (!entity.object.visible || this.saves.get().flags[entity.uniqueId]) return;
    this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
    if (entity.kind === 'lantern') {
      entity.object.setTexture('lantern-on');
      const glow = this.add.circle(entity.object.x, entity.object.y - 12, 38, 0xf2b65d, .22).setDepth(entity.object.depth - 1);
      this.tweens.add({ targets: glow, alpha: .09, scale: 1.15, duration: 1200, yoyo: true, repeat: -1 });
    } else if (entity.kind !== 'lift') entity.object.setVisible(false);
    const update = this.quests.record(entity.objectiveType!, entity.target!, 1);
    if (entity.kind === 'collect' && entity.target) {
      const itemMap: Record<string, string> = { charm: 'widow_charm', moonwort: 'moonwort', shadebloom: 'shadebloom', bog_reed: 'bog_reed', glowcap: 'glowcap', ferryman_cargo: 'ferryman_cargo', miner_tools: 'miner_tools' };
      const itemId = itemMap[entity.target];
      if (itemId) { this.inventory.add(itemId, 1, true); this.sfx.pickup(); GameEvents.emit('loot', { itemId, quantity: 1 }); }
    } else this.sfx.ui();
    GameEvents.emit('toast', entity.kind === 'collect' ? 'Предмет добавлен в инвентарь' : entity.kind === 'lantern' ? 'Фонарь зажжён' : entity.kind === 'lift' ? 'Подъёмник пробудился' : 'Ритуал проведён');
    this.onQuestProgress(update);
    this.nearest = undefined;
    GameEvents.emit('prompt', {});
    this.emitHud(true);
  }

  private isInteractiveAvailable(entity: InteractiveEntity): boolean {
    if (entity.kind === 'npc' || entity.kind === 'door' || entity.kind === 'chest' || entity.kind === 'shrine') return true;
    if (entity.kind === 'lift' && this.saves.get().flags[entity.uniqueId]) return true;
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
      if (entity.kind === 'npc' || entity.kind === 'door') return;
      const used = Boolean(this.saves.get().flags[entity.uniqueId]);
      if (entity.kind === 'lantern') {
        entity.object.setTexture(used ? 'lantern-on' : 'lantern-off').setAlpha(used ? .95 : this.isObjectiveActive('interact', 'lantern') ? 1 : .55);
      } else if (entity.kind === 'chest') {
        entity.object.setTexture(used ? 'chest-open' : 'chest-closed').setVisible(true).setAlpha(used ? .7 : 1);
        entity.label = used ? 'Сундук пуст' : 'Открыть сундук';
      } else if (entity.kind === 'shrine') {
        entity.object.setVisible(true).setTint(used ? 0x666570 : 0x9e76c2).setAlpha(used ? .65 : 1);
        entity.label = used ? 'Святилище молчит' : 'Коснуться святилища';
      } else if (entity.kind === 'lift') {
        entity.object.setVisible(true).setAlpha(used ? 1 : this.isObjectiveActive('interact', 'mine_lift') ? 1 : .45);
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
      ferryman: 'Чёрная вода открыла путь на восток. Я перевезу любого, но обратно возвращаются не все.',
      iva: 'Топь не злая. Она просто хранит всё, что люди пытались забыть.',
      bram: 'Шахта стучит изнутри, будто под камнем бьётся огромное сердце.',
      serah: 'Я служила цитадели, пока не поняла: её огонь питается людьми, а не углём.',
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
    for (const reward of quest.reward.items ?? []) {
      this.sfx.pickup();
      GameEvents.emit('loot', { itemId: reward.itemId, quantity: reward.quantity });
    }
    if (quest.id === 'ash_crown') {
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
    if (!weapon || !this.inventory.equip(weaponId)) return;
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
      state.equipment.weapon = weaponId;
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
      if (tier.weapon && !state.ownedWeapons.includes(tier.weapon)) state.ownedWeapons.push(tier.weapon);
    }, true);
    if (tier.potions) this.inventory.add('blood_vial', tier.potions, true);
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
    if (location) {
      this.sfx.setRegion(location.ambience, this.currentCombat);
      const newlyDiscovered = !this.saves.get().discoveredLocations.includes(location.id);
      if (newlyDiscovered) {
        this.saves.mutate((save) => { save.discoveredLocations.push(location.id); }, true);
        GameEvents.emit('toast', `Открыт новый район: ${location.name}`);
        this.sfx.quest();
      }
      this.onQuestProgress(this.quests.record('visit', location.id));
    } else this.sfx.setRegion('forest', this.currentCombat);
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
      bog_reed: { x: 3250, y: 620 }, bogling: { x: 3280, y: 600 }, ferryman_cargo: { x: 3260, y: 2480 }, glowcap: { x: 3280, y: 700 },
      mines: { x: 3500, y: 1420 }, cavecrawler: { x: 3570, y: 1500 }, miner_tools: { x: 3810, y: 1640 }, mine_lift: { x: 3595, y: 1450 },
      citadel: { x: 4050, y: 1700 }, cinderlord: { x: 4200, y: 2420 },
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
        const boss = enemy.getData('type') === 'nameless' || enemy.getData('type') === 'cinderlord';
        const width = boss ? 92 : 46;
        bar.clear().fillStyle(0x0b0c12, .9).fillRect(enemy.x - width / 2, enemy.y - enemy.displayHeight * .55, width, 7)
          .fillStyle(enemy.getData('type') === 'cinderlord' ? 0xe46643 : enemy.getData('type') === 'nameless' ? 0xc85182 : 0xb64d5e, 1).fillRect(enemy.x - width / 2 + 1, enemy.y - enemy.displayHeight * .55 + 1, (width - 2) * health / max, 5);
        bar.setDepth(enemy.depth + 2);
      }
      return null;
    });
  }

  private syncBoss(): void {
    const activate = (type: 'nameless' | 'cinderlord', current: Phaser.Physics.Arcade.Sprite | undefined, x: number, y: number, message: string, color: number) => {
      const objective = this.isObjectiveActive('kill', type);
      let enemy = current;
      if (objective && (!enemy || !enemy.scene)) enemy = this.spawnEnemy({ type, x, y });
      if (enemy?.scene && objective && !enemy.active) {
        enemy.setActive(true).setVisible(true);
        (enemy.body as Phaser.Physics.Arcade.Body).enable = true;
        const flash = this.add.circle(enemy.x, enemy.y, 110, color, .4).setDepth(enemy.depth - 1);
        this.tweens.add({ targets: flash, scale: 2.1, alpha: 0, duration: 1050, onComplete: () => flash.destroy() });
        this.cameras.main.shake(500, .009);
        GameEvents.emit('toast', message);
        this.sfx.setCombat(true);
      }
      return enemy;
    };
    this.boss = activate('nameless', this.boss, 2280, 1330, 'Безымянная пробудилась в сердце руин', 0xa65489);
    this.cinderBoss = activate('cinderlord', this.cinderBoss, 4200, 2420, 'Владыка углей выходит из Пепельного трона', 0xe25d3d);
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
      maxHealth: this.inventory.maxHealth(),
      level: save.level,
      xp: save.xp,
      xpNext: XP_FOR_LEVEL(save.level),
      coins: save.coins,
      reputation: save.reputation,
      potions: this.inventory.quantity('blood_vial'),
      equippedWeapon: save.equippedWeapon,
      ownedWeapons: [...save.ownedWeapons],
      inventory: save.inventory.map((stack) => ({ ...stack })),
      chest: save.chest.map((stack) => ({ ...stack })),
      equipment: structuredClone(save.equipment),
      discoveredLocations: [...save.discoveredLocations],
      currentScene: 'world',
      settings: { ...save.settings },
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

  private audioMix(save: PlayerSave) {
    return { enabled: save.settings.sound, master: save.settings.masterVolume, music: save.settings.musicVolume, sfx: save.settings.sfxVolume, ambience: save.settings.ambienceVolume };
  }

  private cleanup(): void {
    this.sfx.setCombat(false);
    this.eventDisposers.forEach((dispose) => dispose());
    this.eventDisposers = [];
    this.ui?.destroy();
    this.saves?.flush();
  }
}
