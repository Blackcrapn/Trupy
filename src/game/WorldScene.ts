import Phaser from 'phaser';
import { BATTLE_PASS, ENEMIES, NPCS, QUESTS, WEAPONS, XP_FOR_LEVEL } from '../data/content';
import { getItem } from '../data/items';
import { getWeaponVisual } from '../data/weaponVisuals';
import { BUILDINGS, HIDDEN_FORD, LOCATIONS, MAP_ROADS, MAP_SHAPES, RIFT_POINTS, RIVER_BRIDGES, SECRET_POINTS, SHORTCUT_PORTALS, WORLD_HEIGHT, WORLD_WIDTH, getBuildingDoor } from '../data/world';
import type { LocationDefinition } from '../data/world';
import { GameUI } from '../ui/GameUI';
import { AudioManager, audio } from '../systems/AudioManager';
import { InventorySystem } from '../systems/InventorySystem';
import { QuestSystem } from '../systems/QuestSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { WeaponShopSystem } from '../systems/WeaponShopSystem';
import { CraftingSystem } from '../systems/CraftingSystem';
import { BestiarySystem } from '../systems/BestiarySystem';
import { AchievementSystem } from '../systems/AchievementSystem';
import { ARCANE_LIGHT, FLAME_LIGHT, FORGE_LIGHT, LightingSystem, WINDOW_LIGHT } from '../systems/world/Lighting';
import { WeatherSystem } from '../systems/world/Weather';
import { HERO_DIRS, heroKey, type HeroDir, type HeroPose } from '../systems/sprites/hero';
import { buildingKey } from '../systems/sprites/buildings';
import { EnemyAI, type AIContext, type EnemyProjectileRequest } from '../systems/combat/EnemyAI';
import { BossFight, type BossContext } from '../systems/combat/BossFight';
import { detonateSmokeBomb } from '../systems/combat/SmokeBomb';
import type { DialogueAction, DialoguePayload, HudSnapshot, ObjectiveType, PlayerSave, QuestDefinition, WeaponDefinition } from './types';
import { GameEvents } from './events';

const PLAYER_START = { x: 430, y: 585 };

type InteractiveKind = 'npc' | 'collect' | 'lantern' | 'altar' | 'door' | 'chest' | 'shrine' | 'lift' | 'rift' | 'secret' | 'note' | 'passage';

interface InteractiveEntity {
  kind: InteractiveKind;
  id: string;
  uniqueId: string;
  label: string;
  object: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  objectiveType?: ObjectiveType;
  target?: string;
  /** Hidden-until-approached: revealed by proximity, tracked for the map. */
  secret?: boolean;
  /** Lore/reward text shown on interaction (secrets and notes). */
  lore?: string;
  /** Destination for a `passage` teleport. */
  destination?: { x: number; y: number };
  /** What a secret hands over: loot chest, permanent buff, or lore note. */
  secretKind?: 'chest' | 'shrine' | 'note';
}

interface EnemySpawn {
  type: keyof typeof ENEMIES;
  x: number;
  y: number;
  temporary?: boolean;
  riftId?: string;
}

interface RiftState {
  id: string;
  name: string;
  x: number;
  y: number;
  reward: string;
  wave: number;
  remaining: number;
}

export class WorldScene extends Phaser.Scene {
  private saves!: SaveSystem;
  private quests!: QuestSystem;
  private inventory!: InventorySystem;
  private shop!: WeaponShopSystem;
  private crafting!: CraftingSystem;
  private bestiary!: BestiarySystem;
  private achievements!: AchievementSystem;
  private lighting!: LightingSystem;
  private weather!: WeatherSystem;
  /** Index of the player's own carried light in the lighting system. */
  private playerLightIndex = -1;
  private heroDir: HeroDir = 'down';
  private heroPose: HeroPose = 'idle';
  private heroPoseUntil = 0;
  /** Timestamps used to detect a flawless boss kill. */
  private bossFightStartedAt = 0;
  private lastPlayerHurtAt = -1;
  /** Last labels pushed to the HUD, so the event only fires on change. */
  private lastTimeLabel = '';
  private lastWeatherLabel = '';
  private readonly sfx: AudioManager = audio;
  private ui!: GameUI;
  private player!: Phaser.Physics.Arcade.Sprite;
  private heldWeapon!: Phaser.GameObjects.Image;
  private lastWeaponId = '';
  private tacticalBonusUntil = 0;
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
  private regionTint?: Phaser.GameObjects.Rectangle;
  private lastHudSignature = '';
  private eventDisposers: Array<() => void> = [];
  private boss?: Phaser.Physics.Arcade.Sprite;
  private cinderBoss?: Phaser.Physics.Arcade.Sprite;
  private namelessFight?: BossFight;
  private cinderFight?: BossFight;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private activeRift?: RiftState;
  private playtimeAccumulator = 0;
  private lastStepAt = 0;
  private currentCombat = false;
  private comboHits = 0;
  private comboExpires = 0;
  private dashReadyAt = 0;
  private specialReadyAt = 0;
  private isDashing = false;
  private lastSlowTickAt = 0;
  private requestedSpawn?: { x: number; y: number };

  /** World anchors for each quest-objective target (marker + map objective pin). */
  private static readonly OBJECTIVE_POINTS: Record<string, { x: number; y: number }> = {
    moonwort: { x: 690, y: 740 }, husk: { x: 1820, y: 590 }, witchbow: { x: 1155, y: 610 }, boneguard: { x: 2240, y: 1120 },
    shadebloom: { x: 1370, y: 1320 }, forest_altar: { x: 1660, y: 1580 }, ruins: { x: 2120, y: 1130 }, nameless: { x: 2280, y: 1330 },
    charm: { x: 2030, y: 520 }, direwolf: { x: 1390, y: 1370 }, lantern: { x: 1590, y: 820 },
    bog_reed: { x: 3250, y: 620 }, bogling: { x: 3280, y: 600 }, ferryman_cargo: { x: 3260, y: 2480 }, glowcap: { x: 3280, y: 700 },
    mines: { x: 3500, y: 1420 }, cavecrawler: { x: 3570, y: 1500 }, miner_tools: { x: 3810, y: 1640 }, mine_lift: { x: 3595, y: 1450 },
    citadel: { x: 4050, y: 1700 }, cinderlord: { x: 4200, y: 2420 },
  };

  constructor() {
    super('WorldScene');
  }

  init(data?: { spawnX?: number; spawnY?: number; fromInterior?: boolean }): void {
    this.requestedSpawn = data?.spawnX !== undefined && data?.spawnY !== undefined ? { x: data.spawnX, y: data.spawnY } : undefined;
  }

  create(): void {
    this.interactables = [];
    this.npcMarkers.clear();
    this.nearest = undefined;
    this.objectiveMarker = undefined;
    this.regionTint = undefined;
    this.boss = undefined;
    this.cinderBoss = undefined;
    this.activeRift = undefined;
    this.lastLocation = '';
    this.lastHudSignature = '';
    this.saves = new SaveSystem();
    this.quests = new QuestSystem(this.saves);
    this.inventory = new InventorySystem(this.saves);
    this.shop = new WeaponShopSystem(this.saves);
    this.crafting = new CraftingSystem(this.saves, this.inventory);
    this.bestiary = new BestiarySystem(this.saves);
    this.achievements = new AchievementSystem(this.saves);
    this.saves.mutate((save) => { save.currentScene = 'world'; }, true);
    this.sfx.setMix(this.audioMix(this.saves.get()));
    if (!this.sfx.isUnlocked()) void this.sfx.unlock();
    document.documentElement.classList.toggle('reduce-motion', this.saves.get().settings.reducedMotion);
    document.documentElement.classList.toggle('quality-low', this.saves.get().settings.quality === 'low');
    this.solids = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group({ maxSize: 40 });
    this.enemyProjectiles = this.physics.add.group({ maxSize: 60 });

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawWorld();
    this.createPlayer();
    this.createNpcs();
    this.createInteractables();
    this.createEnemies();
    this.createAtmosphere();
    this.createLighting();
    this.createWeather();
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
      this.updateSecretVisibility();
      this.updateLocation();
      this.updateObjectiveMarker();
      this.updateEnemyBars();
      this.syncBoss();
      GameEvents.emit('ability-cooldown', { dash: Math.max(0, (this.dashReadyAt - time) / 1000), special: Math.max(0, (this.specialReadyAt - time) / 1000) });
      this.ui.updateWorldPosition(this.player.x, this.player.y);
      this.lastSlowTickAt = time;
    }
    this.player.setDepth(this.player.y / 10 + 20);
    this.syncHeldWeapon();

    // Environment. The player's lantern tracks them so night has a moving pool
    // of light rather than a uniformly dark screen.
    this.lighting.update(delta);
    this.lighting.moveLight(this.playerLightIndex, this.player.x, this.player.y);
    this.weather.update(delta, this.currentRegionId());
    this.sfx.setRain(this.weather.profile().rainVolume);
    // Surface time-of-day and weather in the HUD, but only when the label
    // actually changes — this fires every frame otherwise.
    const timeLabel = this.lighting.getState().label;
    const weatherLabel = this.weather.profile().label;
    if (timeLabel !== this.lastTimeLabel || weatherLabel !== this.lastWeatherLabel) {
      this.lastTimeLabel = timeLabel;
      this.lastWeatherLabel = weatherLabel;
      GameEvents.emit('environment', { time: timeLabel, weather: weatherLabel });
    }

    this.playtimeAccumulator += delta;
    if (this.playtimeAccumulator > 450) {
      this.playtimeAccumulator = 0;
      this.saves.mutate((save) => {
        save.playerPosition = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
        save.dayProgress = this.lighting.getDayProgress();
      });
      this.emitHud();
    }
  }

  /**
   * Crafting a recipe. The panel gates its buttons on the same rules, but the
   * system is re-checked here because it owns the truth.
   */
  private craftRecipe(recipeId: string): void {
    const result = this.crafting.craft(recipeId);
    if (result.ok) {
      this.sfx.craft();
      // CraftingSystem.craft already increments stats.itemsCrafted — counting it
      // again here would double every craft.
      for (const achievement of this.achievements.check('craft', {})) {
        GameEvents.emit('toast', `Достижение: ${achievement.name}`);
      }
    } else {
      this.sfx.ui('error');
    }
    GameEvents.emit('toast', result.message);
    this.emitHud(true);
  }

  private upgradeWeapon(weaponId: string): void {
    const result = this.crafting.upgradeWeapon(weaponId);
    if (result.ok) {
      this.sfx.craft();
      const level = this.crafting.upgradeLevel(weaponId);
      // Same as crafting: the system already bumped stats.weaponsUpgraded.
      for (const achievement of this.achievements.check('upgrade', { level })) {
        GameEvents.emit('toast', `Достижение: ${achievement.name}`);
      }
      // The held-weapon sprite reflects the equipped weapon, so refresh it.
      this.syncHeldWeapon();
    } else {
      this.sfx.ui('error');
    }
    GameEvents.emit('toast', result.message);
    this.emitHud(true);
  }

  /** Region id under the player, used by weather and ambience. */
  private currentRegionId(): string {
    for (const location of LOCATIONS) {
      if (
        this.player.x >= location.x && this.player.x <= location.x + location.w
        && this.player.y >= location.y && this.player.y <= location.y + location.h
      ) {
        return location.ambience;
      }
    }
    return 'village';
  }

  private drawWorld(): void {
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x172421, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    for (let y = 0; y < WORLD_HEIGHT; y += 48) {
      ground.lineStyle(1, 0x567064, .045).lineBetween(0, y, WORLD_WIDTH, y);
    }

    // Region polygons are cached as Phaser points so both the fill pass and the
    // terrain-detail pass can reuse them without re-parsing the shape strings.
    const regionPolys = new Map<string, Phaser.Geom.Point[]>();
    for (const location of LOCATIONS) {
      const shape = MAP_SHAPES.find((entry) => entry.id === location.id);
      const points = shape?.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return new Phaser.Geom.Point(x, y); }) ?? [
        new Phaser.Geom.Point(location.x, location.y), new Phaser.Geom.Point(location.x + location.w, location.y),
        new Phaser.Geom.Point(location.x + location.w, location.y + location.h), new Phaser.Geom.Point(location.x, location.y + location.h),
      ];
      regionPolys.set(location.id, points);
      ground.fillStyle(location.color, 1).fillPoints(points, true);
    }
    // Soft biome blending: before the crisp borders go down, feather each region's
    // colour a short way past its own outline so neighbours bleed into each other
    // instead of meeting at a hard polygon cut.
    this.blendRegionEdges(ground, regionPolys);
    // Per-region ground texture (patches, mottling, a light directional gradient)
    // so no biome reads as one flat fill.
    for (const location of LOCATIONS) this.drawTerrainDetail(ground, location, regionPolys.get(location.id)!);
    // Crisp lit border on top of the blend, so regions still read as distinct.
    for (const location of LOCATIONS) {
      const points = regionPolys.get(location.id)!;
      ground.lineStyle(location.danger >= 2 ? 6 : 4, Phaser.Display.Color.IntegerToColor(location.color).brighten(18).color, .4).strokePoints(points, true);
    }

    const road = (points: Array<[number, number]>, width = 74, color = 0x574f43) => {
      ground.lineStyle(width, color, 1).beginPath().moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
      ground.strokePath();
      ground.lineStyle(8, 0x383937, .7).beginPath().moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => ground.lineTo(x, y));
      ground.strokePath();
    };
    // The two river-crossing roads are routed through the bridge decks so the
    // path visibly meets each span.
    road([[410,620],[900,670],[1350,620],[1820,720],[2350,1120],[2630,1316],[3250,1450],[4120,1860]], 78);
    road([[900,670],[1080,1100],[1500,1380],[2140,1460],[2630,1698],[3050,2350]], 42, 0x665d4d);
    road([[2330,1100],[3030,650],[3470,620]], 48, 0x4d5045);
    road([[3300,1450],[3180,2240],[3050,2350]], 46, 0x4f514b);

    // Elevation shading for the raised, rocky biomes, drawn under the river so a
    // plateau edge never paints over water.
    this.drawElevation(ground, regionPolys);
    this.drawRiver(ground);
    this.drawBridges();

    this.drawBuildings();
    this.drawCemetery();
    this.drawRuins();
    this.drawMarsh();
    this.drawMines();
    this.drawDocks();
    this.drawCitadel();
    this.scatterDecorations();

    LOCATIONS.forEach((location) => {
      const shape = MAP_SHAPES.find((entry) => entry.id === location.id);
      this.add.text(shape?.labelX ?? location.x + location.w / 2, (shape?.labelY ?? location.y) - Math.min(250, location.h * .28), location.name.toUpperCase(), {
        fontFamily: 'monospace', fontSize: location.id === 'citadel' ? '20px' : '18px', fontStyle: 'bold', color: '#d3cdd6',
        stroke: '#11131a', strokeThickness: 6, letterSpacing: 4,
      }).setOrigin(0.5).setAlpha(location.danger >= 2 ? .34 : .24).setDepth(2);
    });
  }

  /**
   * A tiny deterministic PRNG. Terrain detail must look scattered but be
   * identical every run (it's baked once), so we avoid Math.random here.
   */
  private seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  }

  /** Point-in-polygon test against a cached region outline. */
  private pointInPoly(points: Phaser.Geom.Point[], x: number, y: number): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y, xj = points[j].x, yj = points[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /**
   * Softens biome borders. For each region we scatter translucent blobs of the
   * region's own colour just *outside* its outline, so the transition into the
   * neighbour is a gradient of overlapping patches rather than a knife-edge.
   */
  private blendRegionEdges(ground: Phaser.GameObjects.Graphics, polys: Map<string, Phaser.Geom.Point[]>): void {
    for (const location of LOCATIONS) {
      const points = polys.get(location.id)!;
      const random = this.seededRandom(0x9e37 ^ location.id.length * 2654435761);
      const colour = Phaser.Display.Color.IntegerToColor(location.color);
      const soft = colour.color;
      // Walk each edge and drop feather blobs straddling it.
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const steps = Math.max(3, Math.round(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 120));
        for (let s = 0; s <= steps; s += 1) {
          const t = s / steps;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          const jitterX = (random() - 0.5) * 90;
          const jitterY = (random() - 0.5) * 90;
          const r = 46 + random() * 46;
          ground.fillStyle(soft, 0.16 + random() * 0.12).fillCircle(px + jitterX, py + jitterY, r);
        }
      }
    }
  }

  /**
   * Per-region ground texture: a faint directional light gradient, scattered
   * darker/lighter patches, and a few biome-flavoured accents (moss, scorch,
   * puddles). All clipped to the region polygon so nothing bleeds onto roads or
   * neighbours, and all deterministic so it bakes identically each run.
   */
  private drawTerrainDetail(ground: Phaser.GameObjects.Graphics, location: LocationDefinition, points: Phaser.Geom.Point[]): void {
    const random = this.seededRandom(0x51ed ^ (location.id.charCodeAt(0) * 40503 + location.h));
    const base = Phaser.Display.Color.IntegerToColor(location.color);
    const dark = base.clone().darken(20).color;
    const light = base.clone().brighten(16).color;
    // A soft top-left-to-bottom-right light gradient, faked with a few large,
    // very translucent lit and shadowed lobes.
    ground.fillStyle(light, 0.05).fillEllipse(location.x + location.w * 0.32, location.y + location.h * 0.3, location.w * 0.7, location.h * 0.6);
    ground.fillStyle(dark, 0.06).fillEllipse(location.x + location.w * 0.72, location.y + location.h * 0.74, location.w * 0.6, location.h * 0.55);
    // Mottled patches — try points, keep the ones that fall inside the polygon.
    const accent = this.terrainAccent(location.id);
    const patchCount = Math.round((location.w * location.h) / 26000);
    let placed = 0;
    let attempts = 0;
    while (placed < patchCount && attempts < patchCount * 4) {
      attempts += 1;
      const x = location.x + random() * location.w;
      const y = location.y + random() * location.h;
      if (!this.pointInPoly(points, x, y)) continue;
      placed += 1;
      const roll = random();
      const rx = 22 + random() * 46;
      const ry = rx * (0.5 + random() * 0.35);
      if (roll < 0.4) ground.fillStyle(dark, 0.12 + random() * 0.1).fillEllipse(x, y, rx, ry);
      else if (roll < 0.72) ground.fillStyle(light, 0.08 + random() * 0.08).fillEllipse(x, y, rx * 0.8, ry * 0.8);
      else ground.fillStyle(accent.color, accent.alpha * (0.6 + random() * 0.5)).fillEllipse(x, y, rx * 0.7, ry * 0.7);
    }
  }

  /** Biome-specific ground accent colour used to tint scattered patches. */
  private terrainAccent(id: string): { color: number; alpha: number } {
    switch (id) {
      case 'forest': return { color: 0x3f6b48, alpha: 0.18 };
      case 'marsh': return { color: 0x2f6f5e, alpha: 0.2 };
      case 'cemetery': return { color: 0x4a5560, alpha: 0.16 };
      case 'ruins': return { color: 0x6a4d76, alpha: 0.18 };
      case 'mines': return { color: 0x6b4f36, alpha: 0.2 };
      case 'docks': return { color: 0x38637a, alpha: 0.2 };
      case 'citadel': return { color: 0x7a3b34, alpha: 0.2 };
      case 'village': return { color: 0x6d6142, alpha: 0.16 };
      default: return { color: 0x4a5a48, alpha: 0.14 };
    }
  }

  /**
   * Elevation cues for the two raised, rocky biomes. A dark cast-shadow band
   * hugs the *lower* edges of the mines and the citadel (reading as a cliff face
   * dropping away), while a thin lit rim traces their *upper* edges (a plateau
   * catching the sky). Cheap, but it lifts both regions off the flat plane.
   */
  private drawElevation(ground: Phaser.GameObjects.Graphics, polys: Map<string, Phaser.Geom.Point[]>): void {
    for (const id of ['mines', 'citadel'] as const) {
      const points = polys.get(id);
      if (!points) continue;
      // Draw each polygon edge: south/east-facing edges get a thick dark drop,
      // north/west-facing edges get a lit rim.
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        // Outward normal sign via the edge direction; if the edge trends
        // rightward/downward it's a lit top edge, else a shadowed underside.
        const facingDown = b.x < a.x || (Math.abs(b.x - a.x) < 4 && b.y < a.y);
        if (facingDown) {
          ground.lineStyle(26, 0x0c0d12, 0.5).lineBetween(a.x, a.y + 10, b.x, b.y + 10);
        } else {
          ground.lineStyle(6, id === 'citadel' ? 0x8a4a44 : 0x9a7a50, 0.5).lineBetween(a.x, a.y - 4, b.x, b.y - 4);
        }
      }
      // A couple of internal cliff-shelf lines for the mines to imply terraces.
      if (id === 'mines') {
        ground.lineStyle(10, 0x0c0d12, 0.35).lineBetween(3260, 1600, 3800, 1600);
        ground.lineStyle(4, 0x9a7a50, 0.4).lineBetween(3260, 1592, 3800, 1592);
      }
    }
  }

  /**
   * The river. Rather than a flat rectangle it now has: wet-earth banks, a
   * lighter shallow margin, a darker deep channel, and a set of pale current
   * streaks along the flow so the water reads as moving. Drawn once into the
   * ground graphics.
   */
  private drawRiver(ground: Phaser.GameObjects.Graphics): void {
    const left = 2500;
    const right = 2760;
    const width = right - left;
    // Muddy banks a little wider than the water.
    ground.fillStyle(0x2c3428, 1).fillRect(left - 26, 0, width + 52, WORLD_HEIGHT);
    // Deep channel.
    ground.fillStyle(0x18333f, 1).fillRect(left, 0, width, WORLD_HEIGHT);
    // Shallows: lighter strips hugging each bank.
    ground.fillStyle(0x2c5566, 0.7).fillRect(left, 0, 34, WORLD_HEIGHT);
    ground.fillStyle(0x2c5566, 0.7).fillRect(right - 34, 0, 34, WORLD_HEIGHT);
    // Deepest core line.
    ground.fillStyle(0x102730, 0.6).fillRect(left + width * 0.4, 0, width * 0.2, WORLD_HEIGHT);
    // Current: pale streaks that meander down the channel. Deterministic.
    const random = this.seededRandom(0x1005cafe);
    ground.fillStyle(0x3f6f80, 0.5);
    for (let y = 20; y < WORLD_HEIGHT; y += 46) {
      const x = left + 30 + (Math.sin(y * 0.02) * 0.5 + 0.5) * (width - 90) + (random() - 0.5) * 20;
      ground.fillRect(x, y, 60 + random() * 60, 4);
    }
    // Faint foam glints near the shallows.
    ground.fillStyle(0x8fb6c2, 0.16);
    for (let y = 40; y < WORLD_HEIGHT; y += 120) {
      ground.fillRect(left + 8 + random() * 16, y + random() * 40, 10, 3);
      ground.fillRect(right - 24 + random() * 12, y + 60 + random() * 40, 10, 3);
    }
  }

  /**
   * The bridge decks and their collision. The river carries a solid wall along
   * its whole length *except* the vertical gap each bridge (and the secret ford)
   * leaves, so the only ways across are the crossings — which makes them matter.
   */
  private drawBridges(): void {
    const left = 2492;
    const right = 2768;
    // Build the set of walkable gaps (bridges + the hidden ford).
    const gaps = [
      ...RIVER_BRIDGES.map((bridge) => ({ y: bridge.y, gap: bridge.gap })),
      { y: HIDDEN_FORD.y, gap: HIDDEN_FORD.gap },
    ].sort((a, b) => a.y - b.y);
    // River collision: stack solid segments over the gaps.
    let cursor = 0;
    for (const { y, gap } of gaps) {
      const top = y - gap;
      if (top > cursor) this.addSolidRect((left + right) / 2, (cursor + top) / 2, right - left, top - cursor);
      cursor = y + gap;
    }
    if (cursor < WORLD_HEIGHT) this.addSolidRect((left + right) / 2, (cursor + WORLD_HEIGHT) / 2, right - left, WORLD_HEIGHT - cursor);

    // Bridge decks: sculpted plank tiles across the span, with stone abutments
    // and rope-rail posts. Depth keyed just above the ground so the player walks
    // on top of them.
    for (const bridge of RIVER_BRIDGES) {
      const deck = this.add.graphics().setDepth(bridge.y / 10 + 1);
      // Stone abutments on each bank.
      deck.fillStyle(0x4a4640, 1).fillRect(left - 20, bridge.y - bridge.gap - 6, 44, bridge.gap * 2 + 12);
      deck.fillStyle(0x4a4640, 1).fillRect(right - 24, bridge.y - bridge.gap - 6, 44, bridge.gap * 2 + 12);
      // Deck planks.
      deck.fillStyle(0x6b5137, 1).fillRect(left, bridge.y - bridge.gap + 4, right - left, bridge.gap * 2 - 8);
      for (let x = left + 4; x < right; x += 26) {
        deck.fillStyle((x / 26) % 2 < 1 ? 0x745941 : 0x654b38, 1).fillRect(x, bridge.y - bridge.gap + 6, 20, bridge.gap * 2 - 12);
      }
      // Plank seams and rail shadow.
      deck.lineStyle(3, 0x2c2620, 0.7);
      for (let x = left; x <= right; x += 26) deck.lineBetween(x, bridge.y - bridge.gap + 6, x, bridge.y + bridge.gap - 6);
      // Rope rails.
      deck.fillStyle(0x3a3029, 1).fillRect(left, bridge.y - bridge.gap - 2, right - left, 8).fillRect(left, bridge.y + bridge.gap - 6, right - left, 8);
      const name = this.add.text(bridge.x, bridge.y - bridge.gap - 22, bridge.name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#d9cdbe', backgroundColor: '#11131acc', padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setDepth(bridge.y / 10 + 2).setAlpha(0.8);
      name.setData('bridgeLabel', bridge.id);
    }

    // Stepping stones marking the secret ford (hidden by reeds in scatter pass).
    const fordGraphics = this.add.graphics().setDepth(HIDDEN_FORD.y / 10 + 1);
    for (let x = left + 20; x < right; x += 46) {
      fordGraphics.fillStyle(0x54514a, 1).fillEllipse(x, HIDDEN_FORD.y + (x % 92 === 0 ? 14 : -10), 26, 16);
      fordGraphics.fillStyle(0x6a675e, 1).fillEllipse(x - 3, HIDDEN_FORD.y + (x % 92 === 0 ? 11 : -13), 14, 8);
    }
  }

  /**
   * Places the sculpted building sprites and their collision.
   *
   * The art is baked as one texture per building by the sprites/buildings
   * factory, with the wall body centred in the canvas — so drawing the image at
   * the building's own (x, y) lands the walls exactly on the collision boxes
   * below, while roofs and eaves overhang into the surrounding margin.
   *
   * The collision layout is deliberately unchanged from the previous flat
   * version: an upper solid block plus two lower blocks that leave a walkable
   * doorway gap, so every door stays enterable.
   */
  private drawBuildings(): void {
    BUILDINGS.forEach((building) => {
      const { x, y, w, h, name, doorX } = building;
      const top = y - h / 2;
      const bottom = y + h / 2;
      const left = x - w / 2;
      const doorCenter = x + doorX;

      const key = buildingKey(building.id);
      if (this.textures.exists(key)) {
        // Depth keyed off the building's foot so the player passes in front of
        // the wall but behind the roof overhang.
        this.add.image(x, y, key).setDepth(bottom / 10 + 5);
      }

      this.add.text(x, top - 34, name, {
        fontFamily: 'monospace', fontSize: '10px', color: '#ded8e1',
        backgroundColor: '#11131acc', padding: { x: 6, y: 3 },
      }).setOrigin(.5).setDepth(bottom / 10 + 7);

      const doorwayWidth = 64;
      const lowerHeight = 52;
      const upperHeight = h - lowerHeight;
      this.addSolidRect(x, top + upperHeight / 2, w, upperHeight);
      const leftWidth = Math.max(0, doorCenter - doorwayWidth / 2 - left);
      const rightWidth = Math.max(0, left + w - (doorCenter + doorwayWidth / 2));
      if (leftWidth > 4) this.addSolidRect(left + leftWidth / 2, bottom - lowerHeight / 2, leftWidth, lowerHeight);
      if (rightWidth > 4) this.addSolidRect(doorCenter + doorwayWidth / 2 + rightWidth / 2, bottom - lowerHeight / 2, rightWidth, lowerHeight);
    });

    // The village well, now a sculpted prop rather than stacked ellipses.
    if (this.textures.exists('well')) {
      this.add.image(920, 680, 'well').setScale(1.6).setDepth(74);
    }
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
    graphics.fillStyle(0x30353a, 1).fillRect(1486, 595, 22, 115);
    graphics.fillStyle(0x676b70, 1).fillRect(1488, 580, 14, 24).fillRect(1488, 700, 14, 24);
    this.addSolidRect(1838, 295, 686, 12);
    this.addSolidRect(1495, 442, 12, 294);
    this.addSolidRect(1495, 790, 12, 160);
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
    graphics.fillStyle(0x342a40, 1).fillRect(2215, 1024, 130, 48);
    graphics.fillStyle(0x8d6b92, 1).fillRect(2210, 1026, 12, 42).fillRect(2338, 1026, 12, 42);
    this.addSolidRect(2162, 1047, 104, 34);
    this.addSolidRect(2398, 1047, 104, 34);
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
    graphics.fillStyle(0x0c0d12, 1).fillRect(3868, 1800, 55, 120);
    graphics.lineStyle(5, 0xc45b49, .8).strokeRect(3868, 1800, 55, 120);
    this.addSolidRect(3880, 1685, 24, 190);
    this.addSolidRect(3880, 2260, 24, 680);
    this.addSolidRect(4450, 2090, 24, 1000);
    this.addSolidRect(4165, 1570, 570, 24);
    this.addSolidRect(3980, 2600, 200, 24);
    this.addSolidRect(4350, 2600, 200, 24);
  }

  private scatterDecorations(): void {
    let seed = 918273;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const distanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax; const dy = by - ay;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const nearRoad = (x: number, y: number, margin = 125) => MAP_ROADS.some((road) => road.slice(1).some(([bx, by], index) => {
      const [ax, ay] = road[index];
      return distanceToSegment(x, y, ax, ay, bx, by) < margin;
    }));
    // Variant keys give visible silhouette variety; the sculpted art is already
    // shaded, so it must NOT be tinted — tinting flattens the light and shadow
    // the shading pass produced.
    const pick = (base: string, count: number) => `${base}-${Math.floor(random() * count)}`;
    const addTree = (x: number, y: number, scale = 2.1, kind = 'tree') => {
      const key = pick(kind, 3);
      const texture = this.textures.exists(key) ? key : kind;
      this.add.image(x, y, texture).setScale(scale).setDepth(y / 10 + 8);
      this.addSolidRect(x, y + 34 * scale / 2, 18 * scale, 15 * scale);
    };
    const addProp = (x: number, y: number, key: string, scale = 1.4, depthBias = 1) => {
      if (!this.textures.exists(key)) return;
      this.add.image(x, y, key).setScale(scale).setDepth(y / 10 + depthBias);
    };

    // Whispering Forest: dense broadleaf.
    for (let index = 0; index < 50; index += 1) {
      const x = 790 + random() * 1020;
      const y = 950 + random() * 720;
      if (Math.abs(y - (1000 + (x - 800) * .4)) < 90 || nearRoad(x, y, 145)) continue;
      addTree(x, y, 1.8 + random() * .55);
    }
    // Wilderness fill, with dead trees near the cursed regions so the biome
    // shifts as the player travels east.
    for (let index = 0; index < 60; index += 1) {
      const x = 90 + random() * (WORLD_WIDTH - 180);
      const y = 80 + random() * (WORLD_HEIGHT - 160);
      const inLocation = LOCATIONS.some((location) => x > location.x - 50 && x < location.x + location.w + 50 && y > location.y - 50 && y < location.y + location.h + 50);
      if (inLocation || nearRoad(x, y, 145)) continue;
      const kind = x > 2700 ? 'tree-dead' : x > 1900 ? 'tree-pine' : 'tree';
      addTree(x, y, 1.7 + random() * .5, kind);
    }
    // Rocks and rubble.
    for (let index = 0; index < 70; index += 1) {
      const x = 100 + random() * (WORLD_WIDTH - 200);
      const y = 100 + random() * (WORLD_HEIGHT - 200);
      if (nearRoad(x, y, 105)) continue;
      addProp(x, y, random() > .78 ? pick('rubble', 3) : pick('rock', 3), 1.3 + random() * .8);
    }
    // Ground cover, so open areas aren't bare.
    for (let index = 0; index < 90; index += 1) {
      const x = 120 + random() * (WORLD_WIDTH - 240);
      const y = 120 + random() * (WORLD_HEIGHT - 240);
      if (nearRoad(x, y, 60)) continue;
      const roll = random();
      const key = roll > .72 ? pick('bush', 3) : roll > .5 ? 'fern' : roll > .34 ? 'flower-patch' : 'stump';
      addProp(x, y, key, 1.1 + random() * .5);
    }
    // Region-specific dressing. Each list is placed only inside its own biome so
    // the world tells you where you are without reading a label.
    const marshProps = ['reeds', 'lilypad', 'puddle', 'bog-bubble', 'mushroom-cluster'];
    for (let index = 0; index < 40; index += 1) {
      addProp(2800 + random() * 980, 200 + random() * 760, marshProps[Math.floor(random() * marshProps.length)], 1.2 + random() * .5);
    }
    const citadelProps = ['ash-pile', 'cracked-ground', 'bones', 'skull', 'rubble-1'];
    for (let index = 0; index < 34; index += 1) {
      addProp(3900 + random() * 560, 1460 + random() * 1180, citadelProps[Math.floor(random() * citadelProps.length)], 1.2 + random() * .5);
    }
    const mineProps = ['ore-vein', 'mine-track', 'rubble-2', 'crate', 'bones'];
    for (let index = 0; index < 26; index += 1) {
      addProp(3270 + random() * 560, 1170 + random() * 620, mineProps[Math.floor(random() * mineProps.length)], 1.2 + random() * .4);
    }
    const dockProps = ['crate', 'barrel', 'sack', 'chain', 'bridge-plank'];
    for (let index = 0; index < 28; index += 1) {
      addProp(2740 + random() * 960, 2060 + random() * 620, dockProps[Math.floor(random() * dockProps.length)], 1.2 + random() * .4);
    }
    const ruinProps = ['obelisk', 'statue', 'rubble-0', 'bones', 'cracked-ground'];
    for (let index = 0; index < 24; index += 1) {
      addProp(2160 + random() * 690, 1090 + random() * 820, ruinProps[Math.floor(random() * ruinProps.length)], 1.2 + random() * .4);
    }
    // Village life: fences, hay, a cart, a signpost.
    for (let index = 0; index < 22; index += 1) {
      addProp(720 + random() * 700, 340 + random() * 600, random() > .5 ? 'fence-post' : 'hay-bale', 1.2 + random() * .3);
    }
    addProp(1040, 700, 'cart', 1.5, 3);
    addProp(880, 600, 'signpost', 1.4, 3);
    addProp(1180, 470, 'anvil', 1.3, 3);
    addProp(1240, 470, 'forge-fire', 1.4, 4);
    // Camps along the roads give the world a sense of other travellers.
    for (const [x, y] of [[1500, 1330], [2400, 1290], [3180, 2240]] as const) {
      addProp(x, y, 'campfire', 1.5, 3);
      addProp(x + 42, y + 12, 'tent', 1.6, 2);
    }
  }

  private addSolidRect(x: number, y: number, width: number, height: number): void {
    const zone = this.add.zone(x, y, width, height);
    this.physics.add.existing(zone, true);
    this.solids.add(zone);
  }

  /** Small stable string hash, used to pick a deterministic secret-chest reward. */
  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    return hash;
  }

  /** Ids of hidden places the player has discovered, for the map overlay. */
  private discoveredSecretIds(): string[] {
    const flags = this.saves.get().flags;
    const ids: string[] = [];
    for (const secret of SECRET_POINTS) if (flags[`secret-found:${secret.id}`]) ids.push(secret.id);
    for (const shortcut of SHORTCUT_PORTALS) {
      if (flags[`secret-found:${shortcut.id}_a`]) ids.push(`${shortcut.id}_a`);
      if (flags[`secret-found:${shortcut.id}_b`]) ids.push(`${shortcut.id}_b`);
    }
    if (flags['secret-found:reed_ford']) ids.push('reed_ford');
    return ids;
  }

  private createPlayer(): void {
    const saved = this.requestedSpawn ?? this.saves.get().playerPosition ?? PLAYER_START;
    this.player = this.physics.add.sprite(saved.x, saved.y, 'hero-down-0').setScale(1.65);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 12).setOffset(8, 26);
    this.lastWeaponId = this.saves.get().equippedWeapon;
    this.heldWeapon = this.add.image(saved.x, saved.y, `held-${this.lastWeaponId}`).setScale(1.45).setDepth(this.player.depth + 1);
    this.syncHeldWeapon();
  }

  private syncHeldWeapon(): void {
    if (!this.heldWeapon?.scene || !this.player?.active) return;
    const weaponId = this.saves.get().equippedWeapon;
    if (this.heldWeapon.texture.key !== `held-${weaponId}`) this.heldWeapon.setTexture(`held-${weaponId}`);
    document.documentElement.dataset.heldWeapon = weaponId;
    const angle = this.facing.angle();
    this.heldWeapon.setOrigin(.2, .5).setPosition(this.player.x + this.facing.x * 10, this.player.y + 5 + this.facing.y * 9).setRotation(angle).setAlpha(this.player.alpha);
    this.heldWeapon.setDepth(this.facing.y < -.35 ? this.player.depth - 1 : this.player.depth + 2);
  }

  private createNpcs(): void {
    NPCS.forEach((npc, index) => {
      const sprite = this.add.sprite(npc.x, npc.y, `npc-${index}`).setScale(1.72).setDepth(npc.y / 10 + 10);
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
    RIFT_POINTS.forEach((rift, index) => {
      const complete = Boolean(this.saves.get().flags[`rift-complete:${rift.id}`]);
      const image = this.add.image(rift.x, rift.y, 'rift-core').setScale(2.2).setTint(complete ? 0x555866 : 0xbd6ed8).setAlpha(complete ? .55 : 1).setDepth(rift.y / 10 + 8);
      if (!complete) this.tweens.add({ targets: image, scale: { from: 1.9, to: 2.45 }, angle: 180, alpha: { from: .62, to: 1 }, duration: 1300 + index * 170, yoyo: true, repeat: -1 });
      this.interactables.push({ kind: 'rift', id: rift.id, uniqueId: `rift:${rift.id}`, label: complete ? 'Разлом очищен' : `Активировать: ${rift.name}`, object: image, target: rift.reward });
    });
    this.createSecrets();
    this.syncInteractables();
  }

  /**
   * Off-road discoveries. Each secret and shortcut mouth starts nearly invisible
   * and fades in only when the player is close (see updateSecretVisibility), so
   * they reward wandering off the paths rather than following the roads. Once
   * found, discovery persists in the save so the map can reveal them.
   */
  private createSecrets(): void {
    SECRET_POINTS.forEach((secret) => {
      const uniqueId = `secret:${secret.id}`;
      const looted = Boolean(this.saves.get().flags[uniqueId]);
      const found = Boolean(this.saves.get().flags[`secret-found:${secret.id}`]);
      // Only actual chest props flip to the open texture once looted; a crypt or
      // obelisk keeps its own art (the loot came from "inside" it).
      const isChestProp = secret.texture === 'chest-closed';
      const texture = looted && isChestProp ? 'chest-open' : this.textures.exists(secret.texture) ? secret.texture : 'altar';
      const image = this.add.image(secret.x, secret.y, texture).setScale(secret.kind === 'note' ? 1.9 : 2.1).setDepth(secret.y / 10 + 5);
      image.setAlpha(found ? 1 : 0.05);
      if (secret.kind === 'shrine') image.setTint(looted ? 0x666570 : 0x9e76c2);
      const label = secret.kind === 'chest'
        ? (looted ? 'Тайник пуст' : 'Открыть тайник')
        : secret.kind === 'shrine'
          ? (looted ? 'Святилище молчит' : 'Коснуться святилища')
          : (looted ? 'Осмотрено' : 'Осмотреть');
      this.interactables.push({
        kind: 'secret', id: secret.id, uniqueId, label, object: image,
        secret: true, secretKind: secret.kind, lore: secret.lore,
      });
    });

    SHORTCUT_PORTALS.forEach((shortcut) => {
      const texture = this.textures.exists(shortcut.texture) ? shortcut.texture : 'crypt-entrance';
      (['a', 'b'] as const).forEach((side) => {
        const foundKey = `secret-found:${shortcut.id}_${side}`;
        const found = Boolean(this.saves.get().flags[foundKey]);
        const here = shortcut[side];
        const there = side === 'a' ? shortcut.b : shortcut.a;
        const image = this.add.image(here.x, here.y, texture).setScale(2.1).setDepth(here.y / 10 + 5);
        image.setAlpha(found ? 1 : 0.05);
        this.interactables.push({
          kind: 'passage', id: `${shortcut.id}_${side}`, uniqueId: `passage:${shortcut.id}_${side}`,
          label: shortcut.name, object: image, secret: true, destination: { ...there },
        });
      });
    });
  }

  private startRift(riftId: string): void {
    const definition = RIFT_POINTS.find((rift) => rift.id === riftId);
    if (!definition) return;
    this.activeRift = { ...definition, wave: 0, remaining: 0 };
    this.sfx.quest();
    this.cameras.main.flash(260, 130, 55, 165);
    this.cameras.main.shake(420, .008);
    GameEvents.emit('toast', `${definition.name} пробуждается`);
    this.time.delayedCall(500, () => this.spawnRiftWave());
  }

  private spawnRiftWave(): void {
    const rift = this.activeRift;
    if (!rift) return;
    rift.wave += 1;
    if (rift.wave > 3) { this.completeRift(); return; }
    const pools: Record<string, Array<keyof typeof ENEMIES>> = {
      forest_rift: ['direwolf', 'wraith', 'husk'],
      marsh_rift: ['bogling', 'wraith', 'direwolf'],
      citadel_rift: ['ashborn', 'boneguard', 'wraith'],
    };
    const pool = pools[rift.id] ?? ['husk'];
    const count = 2 + rift.wave;
    rift.remaining = count;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const radius = 105 + rift.wave * 28;
      const type = pool[(index + rift.wave - 1) % pool.length];
      const enemy = this.spawnEnemy({ type, x: rift.x + Math.cos(angle) * radius, y: rift.y + Math.sin(angle) * radius, temporary: true, riftId: rift.id });
      enemy.setAlpha(0).setScale(enemy.scaleX * .35, enemy.scaleY * .35);
      this.tweens.add({ targets: enemy, alpha: 1, scaleX: enemy.scaleX / .35, scaleY: enemy.scaleY / .35, duration: 420 });
    }
    GameEvents.emit('rift-status', { name: rift.name, wave: rift.wave, remaining: rift.remaining });
    GameEvents.emit('toast', `Волна ${rift.wave}/3 • противников: ${count}`);
  }

  private onRiftEnemyKilled(riftId: string): void {
    const rift = this.activeRift;
    if (!rift || rift.id !== riftId) return;
    rift.remaining = Math.max(0, rift.remaining - 1);
    GameEvents.emit('rift-status', { name: rift.name, wave: rift.wave, remaining: rift.remaining });
    if (rift.remaining === 0) this.time.delayedCall(900, () => this.spawnRiftWave());
  }

  private completeRift(): void {
    const rift = this.activeRift;
    if (!rift) return;
    this.saves.mutate((save) => { save.flags[`rift-complete:${rift.id}`] = true; save.coins += 280; save.xp += 160; }, true);
    this.inventory.add(rift.reward, 1, true);
    const item = getItem(rift.reward);
    if (item) GameEvents.emit('loot', { itemId: item.id, quantity: 1 });
    GameEvents.emit('toast', `${rift.name} очищен • +280 золота • редкая награда`);
    GameEvents.emit('rift-status', null);
    this.sfx.quest();
    const wave = this.add.circle(rift.x, rift.y, 45, 0xc56bde, .55).setStrokeStyle(8, 0xf0b8ff, .9).setDepth(900);
    this.tweens.add({ targets: wave, radius: 260, alpha: 0, duration: 1100, onComplete: () => wave.destroy() });
    this.interactables.find((entity) => entity.kind === 'rift' && entity.id === rift.id)?.object.setTint(0x555866).setAlpha(.55);
    this.activeRift = undefined;
    this.emitHud(true);
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
    const enemy = this.physics.add.sprite(spawn.x, spawn.y, `enemy-${spawn.type}`).setScale((definition.scale ?? 1) * 1.62);
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
      lastSpecial: 0,
      spawn,
    });
    // Elite roll happens before the health bar is created so the bar reads the
    // buffed maximum. Night raises the elite rate, which makes darkness matter.
    if (spawn.type !== 'nameless' && spawn.type !== 'cinderlord') {
      EnemyAI.rollElite(enemy, { chanceMult: this.lighting?.getState().danger ?? 1 });
      const marker = EnemyAI.createEliteMarker(this, enemy);
      if (marker) enemy.setData('eliteMarker', marker);
    }
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
    this.regionTint = this.add.rectangle(0, 0, width, height, 0x332342, .06).setOrigin(0).setScrollFactor(0).setDepth(899).setBlendMode(Phaser.BlendModes.ADD);
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

  /**
   * Places every light in the world. Lights are static apart from the player's
   * own lantern, which follows them so night travel has a readable bubble of
   * safety rather than being uniformly dark.
   */
  private createLighting(): void {
    const save = this.saves.get();
    const low = save.settings.quality === 'low'
      || (save.settings.quality === 'auto' && this.scale.width < 700);
    this.lighting = new LightingSystem(this);
    this.lighting.create();
    // A full cycle takes 12 minutes of play — long enough that night feels like
    // an event, short enough that a player sees several in one session.
    this.lighting.setDayLength(720);
    this.lighting.setDayProgress(save.dayProgress ?? 0.34);

    // The player's carried lantern.
    this.lighting.addLight({ x: this.player.x, y: this.player.y, radius: 150, ...FLAME_LIGHT, intensity: 0.6 });
    this.playerLightIndex = 0;

    if (low) {
      // On weak hardware keep only the player light — the tint still sells night.
      return;
    }

    // Windows of inhabited buildings.
    for (const building of BUILDINGS) {
      if (!building.interior) continue;
      this.lighting.addLight({ x: building.x, y: building.y + 6, radius: 170, ...WINDOW_LIGHT });
    }
    // The forge burns hotter and is visible from across the village.
    this.lighting.addLight({ x: 1210, y: 500, radius: 230, ...FORGE_LIGHT });
    // Village lanterns and the well.
    for (const [x, y] of [[920, 690], [1010, 520], [860, 760], [1150, 700]] as const) {
      this.lighting.addLight({ x, y, radius: 130, ...FLAME_LIGHT, intensity: 0.62, nightOnly: true });
    }
    // Rifts bleed arcane light whether or not it's night.
    for (const rift of RIFT_POINTS) {
      this.lighting.addLight({ x: rift.x, y: rift.y, radius: 200, ...ARCANE_LIGHT });
    }
    // Citadel braziers.
    for (const [x, y] of [[4020, 1900], [4240, 1900], [4130, 2300]] as const) {
      this.lighting.addLight({ x, y, radius: 190, ...FORGE_LIGHT, intensity: 0.7 });
    }
    // Cemetery grave candles — sparse and cold.
    for (const [x, y] of [[1600, 410], [1880, 420], [2070, 735]] as const) {
      this.lighting.addLight({ x, y, radius: 96, color: 0x9fb0dc, intensity: 0.4, flicker: 0.2, nightOnly: true });
    }
    // Dock and mine work lights.
    this.lighting.addLight({ x: 3020, y: 2270, radius: 175, ...FLAME_LIGHT, intensity: 0.6 });
    this.lighting.addLight({ x: 3595, y: 1450, radius: 150, ...FLAME_LIGHT, intensity: 0.55 });
  }

  private createWeather(): void {
    const save = this.saves.get();
    const low = save.settings.quality === 'low'
      || (save.settings.quality === 'auto' && this.scale.width < 700);
    this.weather = new WeatherSystem(this);
    this.weather.create(885, low ? 'low' : 'high');
    this.weather.onThunderStrike(() => {
      this.sfx.thunder();
      // Lightning briefly lights the whole scene.
      this.lighting.flash(this.player.x, this.player.y, 520, 0xc8d4ee, 320);
    });
    this.weather.rollForRegion('village');
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
      const weapon = WEAPONS.find((entry) => entry.id === projectile.getData('weaponId')) ?? WEAPONS[0];
      this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Number(projectile.getData('damage') ?? 0)));
      projectile.destroy();
    });

    // Enemy projectiles are their own group: they must not collide with other
    // enemies, and they hit the player instead.
    this.physics.add.collider(this.enemyProjectiles, this.solids, (object) => object.destroy());
    this.physics.add.overlap(this.enemyProjectiles, this.player, (projectileObject) => {
      const projectile = projectileObject as Phaser.Physics.Arcade.Sprite;
      if (!projectile.active || !this.player.active) return;
      this.hurtPlayer(Number(projectile.getData('damage') ?? 10));
      const kind = String(projectile.getData('kind') ?? 'fire');
      this.lighting.flash(projectile.x, projectile.y, 90, kind === 'fire' ? 0xff8a4c : 0xa06ce0, 200);
      projectile.destroy();
    });
  }

  /**
   * Spawns a projectile fired by an enemy. Shared by the ranged archetype and by
   * both boss fights so there is a single code path for enemy ordnance.
   */
  private spawnEnemyProjectile(request: EnemyProjectileRequest): void {
    const texture = request.kind === 'fire' ? 'projectile-magic' : 'projectile-bolt';
    const projectile = this.physics.add.sprite(request.x, request.y, texture);
    const direction = new Phaser.Math.Vector2(request.targetX - request.x, request.targetY - request.y);
    if (direction.lengthSq() < 0.01) direction.set(0, 1);
    direction.normalize();
    projectile
      .setScale(request.kind === 'fire' ? 2 : 1.8)
      .setRotation(direction.angle())
      .setTint(request.kind === 'fire' ? 0xff9a52 : 0xb07ce8)
      .setDepth(projectile.y / 10 + 22);
    // Generous ttl: the projectile should cross the arena, then expire.
    projectile.setData({ damage: request.damage, kind: request.kind, ttl: 2600 });
    projectile.setVelocity(direction.x * request.speed, direction.y * request.speed);
    this.enemyProjectiles.add(projectile);
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;
    this.cursors = this.input.keyboard.createCursorKeys();
    // Z/X/V drive the three consumable quick slots. 4/5/6 would collide with the
    // weapon hotbar, which already owns 1-8.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,F,Q,I,M,B,R,C,K,J,Z,X,V,SHIFT,ESC,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.uiLocked && pointer.leftButtonDown()) this.attack(pointer);
    });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.uiLocked) this.cycleWeapon(deltaY > 0 ? 1 : -1);
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
    this.listen<void>('ui-dash', () => { if (!this.uiLocked) this.dash(); });
    this.listen<void>('ui-special', () => { if (!this.uiLocked) this.specialAbility(); });
    this.listen<void>('ui-interact', () => { if (!this.uiLocked) this.interact(); });
    this.listen<void>('ui-heal', () => this.usePotion());
    this.listen<string>('equip', (weaponId) => this.equipWeapon(weaponId));
    this.listen<string>('craft-recipe', (recipeId) => this.craftRecipe(recipeId));
    this.listen<string>('upgrade-weapon', (weaponId) => this.upgradeWeapon(weaponId));
    this.listen<number>('use-quick-slot', (index) => this.useQuickSlot(index));
    this.listen<{ itemId?: string; slot?: number }>('assign-quick-slot', ({ itemId, slot }) => {
      if (itemId && typeof slot === 'number' && this.inventory.setQuickSlot(slot, itemId)) {
        this.sfx.ui();
        this.emitHud(true);
      }
    });
    this.listen<number>('clear-quick-slot', (slot) => {
      if (this.inventory.clearQuickSlot(slot)) {
        this.sfx.ui();
        this.emitHud(true);
      }
    });
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
    if (this.isDashing) return;
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
      this.setHeroAnimation('walk', input.x, input.y);
    } else {
      this.player.setVelocity(0);
      this.setHeroAnimation('idle', this.facing.x, this.facing.y);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.interact();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.usePotion();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.attack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) this.dash();
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.specialAbility();
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) GameEvents.emit('panel-open', 'journal');
    if (Phaser.Input.Keyboard.JustDown(this.keys.I)) GameEvents.emit('panel-open', 'inventory');
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) GameEvents.emit('panel-open', 'map');
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) GameEvents.emit('panel-open', 'pass');
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) GameEvents.emit('panel-open', 'craft');
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) GameEvents.emit('panel-open', 'bestiary');
    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) GameEvents.emit('panel-open', 'achievements');
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) GameEvents.emit('panel-open', 'pause');
    ['Z', 'X', 'V'].forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) this.useQuickSlot(index);
    });
    const weaponKeys = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT'];
    weaponKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(this.keys[key])) {
        const weapon = WEAPONS[index];
        if (weapon && this.saves.get().ownedWeapons.includes(weapon.id)) this.equipWeapon(weapon.id);
      }
    });
  }

  /**
   * Chooses the hero animation from a movement/facing vector.
   *
   * The art has five sculpted directions; the three that face right are mirrored
   * for left, which is why only x is flipped. Transient poses (attack, dash,
   * hurt) hold for a short window so a single frame isn't immediately overwritten
   * by the walk cycle on the next update.
   */
  private setHeroAnimation(pose: HeroPose, dx: number, dy: number): void {
    if (this.heroPose !== pose && this.time.now < this.heroPoseUntil) return;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let dir: HeroDir;
    if (absX < 0.001 && absY < 0.001) {
      dir = this.heroDir;
    } else if (absX > absY * 2.2) {
      dir = 'side';
    } else if (absY > absX * 2.2) {
      dir = dy < 0 ? 'up' : 'down';
    } else {
      dir = dy < 0 ? 'up-side' : 'down-side';
    }
    this.heroDir = dir;
    this.heroPose = pose;
    const flip = dir !== 'up' && dir !== 'down' && dx < 0;
    const animKey = `hero-${dir}-${pose}`;
    if (this.anims.exists(animKey)) {
      this.player.play(animKey, true);
    } else {
      this.player.anims.stop();
      this.player.setTexture(heroKey(dir, pose, 0));
    }
    this.player.setFlipX(flip);
  }

  /** Play a one-shot pose (attack/dash/hurt) and lock it for `holdMs`. */
  private playHeroPose(pose: HeroPose, holdMs: number): void {
    this.heroPoseUntil = 0;
    this.setHeroAnimation(pose, this.facing.x, this.facing.y);
    this.heroPoseUntil = this.time.now + holdMs;
  }

  private dash(): void {
    if (this.time.now < this.dashReadyAt || this.uiLocked || this.isDashing) return;
    const direction = this.mobileMove.lengthSq() > .05 ? this.mobileMove.clone().normalize() : this.facing.clone().normalize();
    if (direction.lengthSq() < .01) direction.set(0, 1);
    this.dashReadyAt = this.time.now + 1800;
    this.isDashing = true;
    this.hurtReadyAt = this.time.now + 420;
    this.sfx.dash();
    this.playHeroPose('dash', 240);
    if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialMoved && this.saves.get().flags.tutorialAttacked && !this.saves.get().flags.tutorialDashed) {
      this.saves.mutate((save) => { save.flags.tutorialDashed = true; }, true);
      this.emitTutorial();
      GameEvents.emit('toast', 'Рывок освоен');
    }
    this.player.setVelocity(direction.x * 620, direction.y * 620).setAlpha(.7);
    for (let index = 0; index < 5; index += 1) {
      this.time.delayedCall(index * 32, () => {
        const ghost = this.add.image(this.player.x, this.player.y, this.player.texture.key).setScale(this.player.scaleX, this.player.scaleY).setFlipX(this.player.flipX).setTint(0xb98bd1).setAlpha(.34).setDepth(this.player.depth - 1);
        this.tweens.add({ targets: ghost, alpha: 0, scaleX: ghost.scaleX * 1.08, scaleY: ghost.scaleY * 1.08, duration: 260, onComplete: () => ghost.destroy() });
      });
    }
    this.cameras.main.shake(110, .003);
    this.time.delayedCall(190, () => { this.isDashing = false; this.player.setAlpha(1).setVelocity(direction.x * 90, direction.y * 90); });
  }

  private specialAbility(): void {
    if (this.time.now < this.specialReadyAt || this.uiLocked) return;
    const weapon = WEAPONS.find((item) => item.id === this.saves.get().equippedWeapon) ?? WEAPONS[0];
    this.specialReadyAt = this.time.now + (weapon.kind === 'melee' ? 4800 : weapon.kind === 'ranged' ? 5200 : 6200);
    this.sfx.special(weapon.kind);
    this.playHeroPose('attack', 300);
    // The ability lights the area from the player outward.
    this.lighting.flash(
      this.player.x,
      this.player.y,
      weapon.kind === 'melee' ? 200 : 260,
      Phaser.Display.Color.HexStringToColor(weapon.accent).color,
      480,
    );
    if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialDashed && !this.saves.get().flags.tutorialSpecial) {
      this.saves.mutate((save) => { save.flags.tutorialSpecial = true; }, true);
      this.emitTutorial();
      GameEvents.emit('toast', 'Особая способность освоена');
    }
    if (weapon.kind === 'melee') {
      const ring = this.add.circle(this.player.x, this.player.y, 38, 0xb35a78, .22).setStrokeStyle(6, 0xf0a8c0, .9).setDepth(this.player.depth + 3);
      this.tweens.add({ targets: ring, radius: 150, alpha: 0, angle: 180, duration: 420, onComplete: () => ring.destroy() });
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        if (enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 165) this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Math.round((weapon.damage + this.inventory.damageBonus()) * 1.7)));
        return null;
      });
    } else if (weapon.kind === 'ranged') {
      const baseAngle = this.facing.angle();
      [-.34, -.17, 0, .17, .34].forEach((offset) => this.projectileAttack(weapon, new Phaser.Math.Vector2(Math.cos(baseAngle + offset), Math.sin(baseAngle + offset))));
    } else {
      const nova = this.add.circle(this.player.x, this.player.y, 28, Phaser.Display.Color.HexStringToColor(weapon.accent).color, .42).setStrokeStyle(5, 0xf4d7ff, .9).setDepth(this.player.depth + 3);
      this.tweens.add({ targets: nova, radius: 230, alpha: 0, duration: 650, onComplete: () => nova.destroy() });
      this.enemies.children.each((child) => {
        const enemy = child as Phaser.Physics.Arcade.Sprite;
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if (enemy.active && distance < 240) {
          this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, Math.round((weapon.damage + this.inventory.damageBonus()) * 1.35)));
          const push = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
          enemy.setVelocity(push.x * 280, push.y * 280);
        }
        return null;
      });
    }
    this.cameras.main.flash(90, 180, 105, 170);
    this.cameras.main.shake(180, .006);
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
    // Heavy weapons get the weightier swing sound; the threshold matches the
    // cooldown at which a swing reads as a commitment rather than a jab.
    if (weapon.cooldown >= 600) this.sfx.heavyAttack(weapon.kind);
    else this.sfx.attack(weapon.kind);
    this.playHeroPose('attack', Math.min(220, weapon.cooldown * 0.6));
    this.heldWeapon?.setScale(1.8).setTint(Phaser.Display.Color.HexStringToColor(weapon.accent).color);
    this.time.delayedCall(130, () => this.heldWeapon?.setScale(1.45).clearTint());
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
      if (toEnemy.dot(direction) > .12) this.damageEnemy(enemy, this.weaponDamageAgainst(enemy, weapon, weapon.damage + this.inventory.damageBonus()));
      return null;
    });
  }

  private projectileAttack(weapon: WeaponDefinition, direction: Phaser.Math.Vector2): void {
    const texture = weapon.kind === 'magic' ? 'projectile-magic' : 'projectile-bolt';
    const projectile = this.physics.add.sprite(this.player.x + direction.x * 30, this.player.y + direction.y * 30, texture)
      .setScale(weapon.kind === 'magic' ? 1.7 : 2).setRotation(direction.angle()).setDepth(this.player.depth + 3);
    projectile.setData({ damage: weapon.damage + this.inventory.damageBonus(), weaponId: weapon.id, ttl: weapon.range / (weapon.projectileSpeed ?? 350) * 1000 });
    projectile.setVelocity(direction.x * (weapon.projectileSpeed ?? 350), direction.y * (weapon.projectileSpeed ?? 350));
    this.projectiles.add(projectile);
    if (weapon.kind === 'magic') this.tweens.add({ targets: projectile, angle: projectile.angle + 180, duration: 450, repeat: -1 });
  }

  private weaponDamageAgainst(enemy: Phaser.Physics.Arcade.Sprite, weapon: WeaponDefinition, baseDamage: number): number {
    const type = enemy.getData('type') as string;
    const visual = getWeaponVisual(weapon.id);
    let multiplier = visual.bonusVs.includes(type) ? (type === 'nameless' || type === 'cinderlord' ? 1.2 : 1.28) : 1;
    if (this.time.now < this.tacticalBonusUntil) multiplier *= 1.15;
    return Math.round(baseDamage * multiplier);
  }

  private damageEnemy(enemy: Phaser.Physics.Arcade.Sprite, damage: number): void {
    if (!enemy.active) return;
    // A wraith mid-blink and a boss mid-phase-transition cannot be hurt — both
    // are deliberate windows the player has to wait out.
    if (EnemyAI.isIntangible(enemy) || enemy.getData('bossInvulnerable')) return;
    // Shieldbearers soak frontal damage, so the player must flank them.
    damage = EnemyAI.mitigateDamage(enemy, damage, this.player.x, this.player.y);
    if (this.time.now > this.comboExpires) this.comboHits = 0;
    this.comboHits += 1;
    this.comboExpires = this.time.now + 1900;
    const comboMultiplier = 1 + Math.min(10, this.comboHits - 1) * .025;
    // Crits are earned, not random: a long combo raises the chance, which rewards
    // pressing an advantage instead of trading single hits.
    const critChance = 0.06 + Math.min(0.22, this.comboHits * 0.02);
    const critical = Math.random() < critChance;
    const finalDamage = Math.round(damage * comboMultiplier * (critical ? 1.85 : 1));
    const health = Math.max(0, Number(enemy.getData('health')) - finalDamage);
    const type = String(enemy.getData('type'));
    enemy.setData('health', health);
    // Bosses need their own damage feed to drive phase transitions and the bar.
    if (type === 'nameless') {
      this.namelessFight?.onDamaged(health);
      GameEvents.emit('boss-health', { health, phase: Number(enemy.getData('bossPhase')) || 1 });
    } else if (type === 'cinderlord') {
      this.cinderFight?.onDamaged(health);
      GameEvents.emit('boss-health', { health, phase: Number(enemy.getData('bossPhase')) || 1 });
    }
    GameEvents.emit('combo', { hits: this.comboHits, multiplier: comboMultiplier });
    if (this.comboHits > (this.saves.get().stats.bestCombo ?? 0)) {
      this.saves.mutate((save) => { save.stats.bestCombo = this.comboHits; });
      this.achievements.check('combo', { streak: this.comboHits });
    }

    // Hit flash plus a small knock-back nudge: the enemy visibly reacts.
    enemy.setTintFill(critical ? 0xfff0d0 : 0xf5d5df);
    this.time.delayedCall(critical ? 130 : 90, () => { if (enemy.active) enemy.clearTint(); });
    const knock = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y).normalize();
    enemy.setVelocity(knock.x * (critical ? 190 : 110), knock.y * (critical ? 190 : 110));

    const number = this.add.text(enemy.x, enemy.y - 38, critical ? `${finalDamage}!` : `-${finalDamage}`, {
      fontFamily: 'monospace',
      fontSize: critical ? '17px' : '12px',
      fontStyle: 'bold',
      color: critical ? '#ffe9a8' : '#ffd2dc',
      stroke: '#15161d',
      strokeThickness: critical ? 5 : 4,
    }).setOrigin(.5).setDepth(900);
    this.tweens.add({
      targets: number,
      y: number.y - (critical ? 40 : 28),
      alpha: 0,
      scale: critical ? 1.35 : 1,
      duration: critical ? 720 : 580,
      ease: 'Quad.easeOut',
      onComplete: () => number.destroy(),
    });

    if (critical) {
      // Crits get their own light pop and a harder shake so they land.
      this.lighting.flash(enemy.x, enemy.y, 110, 0xffdca0, 220);
      this.cameras.main.shake(95, .004);
    }
    this.sfx.impact(type, critical ? 1.4 : 1, critical);
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
    (enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined)?.destroy();
    // Elites drop more, which is the reward for the harder fight.
    const lootMultiplier = Number(enemy.getData('lootMult')) || 1;
    // Note: BestiarySystem.recordKill already increments totalKills and bossKills,
    // so only the coin counter is tracked here to avoid double-counting.
    this.saves.mutate((save) => {
      save.coins += coins;
      save.stats.coinsEarned += coins;
    });
    const update = this.quests.record('kill', type, 1);
    const isBoss = type === 'nameless' || type === 'cinderlord';

    // Bestiary and achievements. Recording the kill here (rather than in the UI)
    // keeps progression truthful even if a panel is never opened.
    const killCount = this.bestiary.recordKill(type);
    if (killCount === 1) {
      GameEvents.emit('toast', `Бестиарий: ${definition.name} изучен`);
    }
    if (isBoss) {
      // A flawless boss kill means no damage taken since the fight started.
      if (this.bossFightStartedAt > 0 && this.lastPlayerHurtAt < this.bossFightStartedAt) {
        this.saves.mutate((save) => { save.stats.flawlessBossKills += 1; });
        this.achievements.check('boss_flawless', { enemyId: type });
        GameEvents.emit('toast', 'Безупречная победа');
      }
      this.bossFightStartedAt = 0;
      this.sfx.setBossFight(false);
    }
    const unlocked = this.achievements.check('kill', { enemyId: type });
    for (const achievement of unlocked) {
      GameEvents.emit('toast', `Достижение: ${achievement.name}`);
    }
    this.achievements.check('coins', { total: this.saves.get().stats.coinsEarned });
    const color = type === 'nameless' ? 0xd77ac7 : type === 'cinderlord' || type === 'ashborn' ? 0xff7549 : type === 'bogling' ? 0x7bdaa7 : 0xc09a7b;
    for (let index = 0; index < 7; index += 1) {
      const puff = this.add.image(deathX + Phaser.Math.Between(-18, 18), deathY + Phaser.Math.Between(-12, 12), index % 2 ? 'spark' : 'pixel').setScale(Phaser.Math.FloatBetween(2, 5)).setTint(color).setDepth(depth + 3);
      this.tweens.add({ targets: puff, x: puff.x + Phaser.Math.Between(-55, 55), y: puff.y + Phaser.Math.Between(-65, 15), scale: Phaser.Math.FloatBetween(5, 10), alpha: 0, angle: Phaser.Math.Between(-120, 120), duration: Phaser.Math.Between(380, 720), onComplete: () => puff.destroy() });
    }
    enemy.destroy();
    for (const drop of definition.drops ?? []) {
      if (Math.random() > drop.chance) continue;
      const quantity = Phaser.Math.Between(drop.min, drop.max) * lootMultiplier;
      this.inventory.add(drop.itemId, quantity, true);
      this.sfx.pickup();
      GameEvents.emit('loot', { itemId: drop.itemId, quantity });
    }
    this.sfx.coin(isBoss ? 4 : 1);
    this.sfx.enemyDeath(type, isBoss);
    if (isBoss) {
      // A boss death is worth a moment: heavy shake and a big light bloom.
      this.cameras.main.shake(420, .009);
      this.lighting.flash(deathX, deathY, 420, type === 'cinderlord' ? 0xff8a4c : 0xd77ac7, 700);
    }
    GameEvents.emit('toast', `+${coins} золота • ${definition.name} повержен`);
    if (update.readyQuest) this.sfx.quest();
    if (spawn.riftId) this.onRiftEnemyKilled(spawn.riftId);
    else if (!spawn.temporary && type !== 'nameless' && type !== 'cinderlord') this.time.delayedCall(11000, () => this.spawnEnemy(spawn));
    else if (type === 'nameless') this.boss = undefined;
    else if (type === 'cinderlord') this.cinderBoss = undefined;
    if (isBoss) {
      // Tear the choreography down or its timers keep firing after the kill.
      if (type === 'nameless') { this.namelessFight?.destroy(); this.namelessFight = undefined; }
      else { this.cinderFight?.destroy(); this.cinderFight = undefined; }
      GameEvents.emit('boss-defeated');
    }
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
    // Context is built once per tick and reused for every enemy — the AI runs for
    // up to 30 sprites, so allocating per enemy here would be wasteful.
    const settings = this.saves.get().settings;
    const lowQuality = settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700);
    const context: AIContext = {
      playerX: this.player.x,
      playerY: this.player.y,
      playerAlive: this.player.active,
      time,
      delta: _delta,
      // Fog genuinely hides the player, and night makes everything bolder.
      visibility: this.weather.profile().visibility,
      danger: this.lighting.getState().danger,
      reducedMotion: settings.reducedMotion,
      lowQuality,
      hurtPlayer: (amount) => this.hurtPlayer(amount),
      spawnProjectile: (request) => this.spawnEnemyProjectile(request),
      spawnAdd: (type, x, y) => {
        this.spawnEnemy({ type: type as keyof typeof ENEMIES, x, y, temporary: true });
      },
      enemies: this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[],
    };
    const renderDistance = lowQuality ? 900 : 1450;

    this.enemies.children.each((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return null;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      enemy.setVisible(distance < renderDistance);
      const healthBar = enemy.getData('healthBar') as Phaser.GameObjects.Graphics | undefined;
      if (distance >= renderDistance) {
        body.setVelocity(0);
        healthBar?.setVisible(false);
        return null;
      }
      // Archetype behaviour lives in EnemyAI; bosses opt out and are driven by
      // their BossFight instead.
      if (EnemyAI.update(enemy, context)) combat = true;
      enemy.setDepth(enemy.y / 10 + 12);
      const marker = enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined;
      if (marker) marker.setPosition(enemy.x, enemy.y - enemy.displayHeight * 0.62).setDepth(enemy.depth + 3);
      return null;
    });

    // Boss choreography runs on the same cadence as the mook AI.
    this.namelessFight?.update(time, _delta);
    this.cinderFight?.update(time, _delta);

    if (combat !== this.currentCombat) {
      this.currentCombat = combat;
      this.sfx.setCombat(combat);
    }
  }

  private tryEnemySpecial(enemy: Phaser.Physics.Arcade.Sprite, time: number, distance: number): void {
    const type = enemy.getData('type') as keyof typeof ENEMIES;
    const last = Number(enemy.getData('lastSpecial'));
    const boss = type === 'nameless' || type === 'cinderlord';
    const cooldown = boss ? 3600 : type === 'ashborn' ? 3000 : 2600;
    if (time < last + cooldown) return;
    const damage = Number(enemy.getData('damage'));
    if ((type === 'direwolf' || type === 'cavecrawler') && distance > 80 && distance < 280) {
      enemy.setData('lastSpecial', time);
      const line = this.add.line(0, 0, enemy.x, enemy.y, this.player.x, this.player.y, 0xe39a66, .75).setOrigin(0).setLineWidth(5).setDepth(890);
      this.tweens.add({ targets: line, alpha: 0, duration: 380, onComplete: () => line.destroy() });
      this.time.delayedCall(260, () => {
        if (!enemy.active) return;
        this.physics.moveToObject(enemy, this.player, 430);
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 85) this.hurtPlayer(Math.round(damage * 1.35));
      });
      return;
    }
    if ((type === 'bogling' || type === 'wraith') && distance < 340) {
      enemy.setData('lastSpecial', time);
      const target = { x: this.player.x, y: this.player.y };
      const warning = this.add.circle(target.x, target.y, 48, 0x6ec7a4, .12).setStrokeStyle(4, type === 'wraith' ? 0xb88cf0 : 0x83d6ad, .9).setDepth(880);
      this.tweens.add({ targets: warning, radius: 66, alpha: .35, duration: 480, onComplete: () => {
        warning.destroy();
        const burst = this.add.circle(target.x, target.y, 28, type === 'wraith' ? 0x8d63c4 : 0x4fa985, .7).setDepth(885);
        this.tweens.add({ targets: burst, radius: 82, alpha: 0, duration: 350, onComplete: () => burst.destroy() });
        if (Phaser.Math.Distance.Between(target.x, target.y, this.player.x, this.player.y) < 70) this.hurtPlayer(Math.round(damage * 1.25));
      } });
      return;
    }
    if (type === 'ashborn' && distance < 230) {
      enemy.setData('lastSpecial', time);
      const warning = this.add.circle(enemy.x, enemy.y, 45, 0xd95336, .14).setStrokeStyle(5, 0xff9d68, .9).setDepth(880);
      this.tweens.add({ targets: warning, radius: 112, alpha: .38, duration: 560, onComplete: () => {
        warning.destroy();
        if (enemy.active && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < 120) this.hurtPlayer(Math.round(damage * 1.45));
      } });
      return;
    }
    if (boss && distance < 520) {
      enemy.setData('lastSpecial', time);
      const target = { x: this.player.x, y: this.player.y };
      const warning = this.add.circle(target.x, target.y, 75, 0x8b3d60, .1).setStrokeStyle(7, type === 'cinderlord' ? 0xff7247 : 0xd777bd, .95).setDepth(885);
      this.tweens.add({ targets: warning, scale: 1.25, alpha: .4, duration: 720, onComplete: () => {
        warning.destroy();
        const wave = this.add.circle(target.x, target.y, 30, type === 'cinderlord' ? 0xf05b39 : 0xa64d8c, .75).setDepth(890);
        this.tweens.add({ targets: wave, radius: 135, alpha: 0, duration: 500, onComplete: () => wave.destroy() });
        if (Phaser.Math.Distance.Between(target.x, target.y, this.player.x, this.player.y) < 105) this.hurtPlayer(Math.round(damage * 1.6));
      } });
    }
  }

  private hurtPlayer(amount: number): void {
    if (this.time.now < this.hurtReadyAt || !this.player.active) return;
    this.hurtReadyAt = this.time.now + 650;
    const reduced = Math.max(1, amount - this.inventory.armor());
    this.saves.mutate((save) => { save.health = Math.max(0, save.health - reduced); });
    this.lastPlayerHurtAt = this.time.now;
    // Combos break when you get hit — that's the risk that makes them meaningful.
    this.comboHits = 0;
    GameEvents.emit('combo', { hits: 0, multiplier: 1 });
    this.playHeroPose('hurt', 260);
    this.player.setTintFill(0xe45d78);
    this.time.delayedCall(110, () => this.player.clearTint());
    // Feedback scales with how dangerous the hit was relative to max health.
    const severity = reduced / Math.max(1, this.inventory.maxHealth(this.saves.get()));
    this.cameras.main.shake(130 + severity * 320, .006 + severity * 0.012);
    this.cameras.main.flash(70, 120, 16, 38);
    this.sfx.playerHurt(1 + Math.min(0.6, severity * 3));
    // Screen-edge vignette in the DOM layer, scaled by how bad the hit was.
    GameEvents.emit('player-hurt', { severity: Math.min(1, severity * 3.2) });
    if (this.saves.get().health <= 0) this.die();
    this.emitHud(true);
  }

  private die(): void {
    this.player.setActive(false).setVelocity(0).setTint(0x6e5a67);
    this.physics.world.pause();
    this.sfx.playerDeath();
    this.sfx.setBossFight(false);
    this.bossFightStartedAt = 0;
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

  /** Fires whatever consumable sits in a quick slot, if anything does. */
  private useQuickSlot(index: number): void {
    const itemId = this.inventory.quickSlots()[index];
    if (!itemId) {
      this.sfx.ui('error');
      GameEvents.emit('toast', 'Слот пуст');
      return;
    }
    this.useInventoryItem(itemId);
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
      // The bomb now blinds as well as pushes: enemies inside the cloud lose
      // aggro and cannot re-acquire the player until it thins, which makes the
      // item a genuine escape tool rather than a small shove.
      const settings = this.saves.get().settings;
      const lowQuality = settings.quality === 'low'
        || (settings.quality === 'auto' && this.scale.width < 700);
      detonateSmokeBomb(this, {
        x: this.player.x,
        y: this.player.y,
        enemies: this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[],
        reducedMotion: settings.reducedMotion,
        lowQuality,
        depth: this.player.depth + 2,
      });
      this.sfx.special('magic');
      this.lighting.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
    }
    this.emitHud(true);
  }

  private updateProjectiles(delta: number): void {
    const tick = (child: Phaser.GameObjects.GameObject): null => {
      const projectile = child as Phaser.Physics.Arcade.Sprite;
      const ttl = Number(projectile.getData('ttl')) - delta;
      projectile.setData('ttl', ttl);
      if (ttl <= 0) projectile.destroy();
      return null;
    };
    this.projectiles.children.each(tick);
    this.enemyProjectiles.children.each(tick);
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

  /**
   * Fades a hidden secret or shortcut mouth in once the player wanders within
   * reach of it, marking it discovered so it survives reloads and appears on the
   * map. Fog shrinks the reveal radius, so bad weather genuinely hides things.
   */
  private updateSecretVisibility(): void {
    if (!this.player.active) return;
    const reveal = 190 * (this.weather?.profile().visibility ?? 1);
    let discoveredAny = false;
    // The hidden ford has no prop — it's a bare gap in the river — so discovery is
    // a plain proximity check that just flips its map flag.
    if (!this.saves.get().flags['secret-found:reed_ford'] && Phaser.Math.Distance.Between(this.player.x, this.player.y, HIDDEN_FORD.x, HIDDEN_FORD.y) < reveal) {
      this.saves.mutate((save) => { save.flags['secret-found:reed_ford'] = true; }, true);
      this.sfx.quest();
      GameEvents.emit('toast', `Найден ${HIDDEN_FORD.name}: реку можно перейти вброд`);
      discoveredAny = true;
    }
    for (const entity of this.interactables) {
      if (!entity.secret) continue;
      // Secrets and passage mouths are both keyed by their entity id.
      const foundKey = `secret-found:${entity.id}`;
      if (this.saves.get().flags[foundKey]) { entity.object.setAlpha(1); continue; }
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entity.object.x, entity.object.y);
      if (distance < reveal) {
        this.saves.mutate((save) => { save.flags[foundKey] = true; }, true);
        this.tweens.add({ targets: entity.object, alpha: 1, duration: 520, ease: 'Quad.easeOut' });
        const glow = this.add.circle(entity.object.x, entity.object.y, 24, 0xd7c07a, .4).setDepth(entity.object.depth + 1);
        this.tweens.add({ targets: glow, radius: 120, alpha: 0, duration: 900, onComplete: () => glow.destroy() });
        this.sfx.quest();
        const label = entity.kind === 'passage' ? 'Найден тайный проход' : 'Найдено скрытое место';
        GameEvents.emit('toast', `${label}: ${entity.kind === 'passage' ? entity.label : entity.lore?.split('.')[0] ?? entity.label}`);
        discoveredAny = true;
      }
    }
    if (discoveredAny) this.emitHud(true);
  }

  private interact(): void {
    if (!this.nearest || this.uiLocked) return;
    const entity = this.nearest;
    if (entity.kind === 'npc') {
      if (!this.saves.get().tutorialDone && this.saves.get().flags.tutorialMoved && this.saves.get().flags.tutorialAttacked && this.saves.get().flags.tutorialDashed && this.saves.get().flags.tutorialSpecial && entity.id === 'mora') {
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
    if (entity.kind === 'rift') {
      if (this.saves.get().flags[`rift-complete:${entity.id}`]) { GameEvents.emit('toast', 'Этот разлом уже очищен'); return; }
      if (this.activeRift) { GameEvents.emit('toast', 'Сначала завершите активный разлом'); return; }
      this.startRift(entity.id);
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
    if (entity.kind === 'passage') {
      if (!entity.destination) return;
      this.sfx.door();
      this.cameras.main.fadeOut(240, 6, 8, 14);
      const target = entity.destination;
      this.time.delayedCall(250, () => {
        this.player.setPosition(target.x, target.y).setVelocity(0);
        this.cameras.main.fadeIn(260, 6, 8, 14);
        this.lighting.flash(target.x, target.y, 150, 0x8b7bc0, 400);
      });
      GameEvents.emit('toast', `${entity.label}: путь сокращён`);
      this.nearest = undefined;
      GameEvents.emit('prompt', {});
      return;
    }
    if (entity.kind === 'secret') {
      if (this.saves.get().flags[entity.uniqueId]) { GameEvents.emit('toast', entity.secretKind === 'note' ? 'Здесь больше нечего узнать' : 'Здесь уже пусто'); return; }
      this.saves.mutate((save) => { save.flags[entity.uniqueId] = true; }, true);
      if (entity.secretKind === 'chest') {
        if (entity.object.texture.key === 'chest-closed') entity.object.setTexture('chest-open');
        // Hidden caches pay better than roadside chests: a rarer item plus coins.
        const pool = ['ash_crystal', 'greater_vial', 'smoke_bomb', 'mine_ore', 'bone_shard'];
        const itemId = pool[Math.abs(this.hashString(entity.id)) % pool.length];
        const quantity = itemId === 'bone_shard' || itemId === 'mine_ore' ? 4 : 2;
        this.inventory.add(itemId, quantity, true);
        this.saves.mutate((save) => { save.coins += 120; }, true);
        this.sfx.chest();
        GameEvents.emit('loot', { itemId, quantity });
        GameEvents.emit('toast', `${entity.lore ?? 'Тайник найден'} • +120 золота`);
      } else if (entity.secretKind === 'shrine') {
        // A distinct buff from the roadside shrines: a lasting damage blessing.
        entity.object.setTint(0x666570);
        this.saves.mutate((save) => { save.maxHealth += 15; save.health = this.inventory.maxHealth(save); }, true);
        this.sfx.quest();
        const ring = this.add.circle(entity.object.x, entity.object.y, 30, 0x7fd6c0, .5).setDepth(entity.object.depth + 1);
        this.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 950, onComplete: () => ring.destroy() });
        GameEvents.emit('toast', `${entity.lore ?? 'Древнее святилище'} • жизненная сила +15`);
      } else {
        // Lore note: a snippet of story plus a small material reward.
        this.inventory.add('ash_crystal', 1, true);
        this.sfx.ui();
        GameEvents.emit('loot', { itemId: 'ash_crystal', quantity: 1 });
        GameEvents.emit('toast', entity.lore ?? 'Найдена старая запись');
      }
      this.nearest = undefined;
      GameEvents.emit('prompt', {});
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
    if (entity.kind === 'npc' || entity.kind === 'door' || entity.kind === 'chest' || entity.kind === 'shrine' || entity.kind === 'rift') return true;
    // A passage only becomes usable once discovered; then it always is.
    if (entity.kind === 'passage') return Boolean(this.saves.get().flags[`secret-found:${entity.id}`]);
    // A secret is reachable once discovered and until it's been claimed.
    if (entity.kind === 'secret') return Boolean(this.saves.get().flags[`secret-found:${entity.id}`]) && !this.saves.get().flags[entity.uniqueId];
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
      // Secrets and passages own their own reveal/alpha via updateSecretVisibility;
      // only refresh their claimed-state label here.
      if (entity.kind === 'passage') return;
      if (entity.kind === 'secret') {
        const claimed = Boolean(this.saves.get().flags[entity.uniqueId]);
        if (entity.secretKind === 'chest') entity.label = claimed ? 'Тайник пуст' : 'Открыть тайник';
        else if (entity.secretKind === 'shrine') { if (claimed) entity.object.setTint(0x666570); entity.label = claimed ? 'Святилище молчит' : 'Коснуться святилища'; }
        else entity.label = claimed ? 'Осмотрено' : 'Осмотреть';
        return;
      }
      const used = Boolean(this.saves.get().flags[entity.uniqueId]);
      if (entity.kind === 'lantern') {
        entity.object.setTexture(used ? 'lantern-on' : 'lantern-off').setAlpha(used ? .95 : this.isObjectiveActive('interact', 'lantern') ? 1 : .55);
      } else if (entity.kind === 'chest') {
        entity.object.setTexture(used ? 'chest-open' : 'chest-closed').setVisible(true).setAlpha(used ? .7 : 1);
        entity.label = used ? 'Сундук пуст' : 'Открыть сундук';
      } else if (entity.kind === 'shrine') {
        entity.object.setVisible(true).setTint(used ? 0x666570 : 0x9e76c2).setAlpha(used ? .65 : 1);
        entity.label = used ? 'Святилище молчит' : 'Коснуться святилища';
      } else if (entity.kind === 'rift') {
        const complete = Boolean(this.saves.get().flags[`rift-complete:${entity.id}`]);
        entity.object.setVisible(true).setTint(complete ? 0x555866 : 0xbd6ed8).setAlpha(complete ? .55 : 1);
        entity.label = complete ? 'Разлом очищен' : `Активировать разлом`;
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

  private cycleWeapon(direction: 1 | -1): void {
    const owned = WEAPONS.filter((weapon) => this.saves.get().ownedWeapons.includes(weapon.id));
    if (owned.length < 2) return;
    const current = owned.findIndex((weapon) => weapon.id === this.saves.get().equippedWeapon);
    const next = owned[(current + direction + owned.length) % owned.length];
    this.equipWeapon(next.id);
  }

  private equipWeapon(weaponId: string): void {
    const weapon = WEAPONS.find((item) => item.id === weaponId);
    const previous = this.saves.get().equippedWeapon;
    if (!weapon || !this.inventory.equip(weaponId)) return;
    if (previous !== weaponId) {
      this.lastWeaponId = previous;
      this.tacticalBonusUntil = this.time.now + 1800;
      this.heldWeapon?.setTexture(`held-${weaponId}`).setScale(1.9).setTint(Phaser.Display.Color.HexStringToColor(weapon.accent).color);
      this.time.delayedCall(180, () => this.heldWeapon?.setScale(1.45).clearTint());
    }
    this.sfx.ui();
    const visual = getWeaponVisual(weaponId);
    GameEvents.emit('toast', `Экипировано: ${weapon.name}${previous !== weaponId ? ` • тактическая смена +15%` : ''} • ${visual.bonusLabel}`);
    this.emitHud(true);
  }

  private buyWeapon(weaponId: string): void {
    const result = this.shop.purchase(weaponId);
    GameEvents.emit('toast', result.message);
    if (!result.ok || !result.weapon) return;
    this.onQuestProgress(this.quests.record('purchase', weaponId));
    this.heldWeapon?.setTexture(`held-${weaponId}`).setScale(1.95).setTint(Phaser.Display.Color.HexStringToColor(result.weapon.accent).color);
    this.time.delayedCall(220, () => this.heldWeapon?.setScale(1.45).clearTint());
    this.sfx.coin();
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
    const location = LOCATIONS.find((item) => {
      const shape = MAP_SHAPES.find((entry) => entry.id === item.id);
      if (!shape) return Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(item.x, item.y, item.w, item.h), this.player.x, this.player.y);
      const polygon = new Phaser.Geom.Polygon(shape.points.split(' ').map((pair) => { const [x, y] = pair.split(',').map(Number); return { x, y }; }));
      return Phaser.Geom.Polygon.Contains(polygon, this.player.x, this.player.y);
    });
    const name = location?.name ?? 'Дороги Долины';
    if (name === this.lastLocation) return;
    this.lastLocation = name;
    GameEvents.emit('location', name);
    if (location) {
      this.sfx.setRegion(location.ambience, this.currentCombat);
      const tintByRegion: Record<string, number> = { home: 0x4b304f, village: 0x52472f, cemetery: 0x39475a, forest: 0x244f3f, ruins: 0x59345e, marsh: 0x285f58, mines: 0x59402b, docks: 0x2b5265, citadel: 0x762f2a };
      if (this.regionTint) {
        this.regionTint.setFillStyle(tintByRegion[location.id] ?? 0x332342, .04).setAlpha(.03);
        this.tweens.add({ targets: this.regionTint, alpha: location.danger >= 2 ? .11 : .065, duration: 900 });
      }
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
    const position = WorldScene.OBJECTIVE_POINTS[objective.target];
    if (position) this.objectiveMarker.setPosition(position.x, position.y).setVisible(true);
    else this.objectiveMarker.setVisible(false);
  }

  /** World anchor for the current quest objective, shared by the marker + map. */
  private objectivePoint(): { x: number; y: number } | undefined {
    const active = this.quests.activeObjective();
    if (!active) return undefined;
    if (active.progress.status === 'ready') {
      const npc = NPCS.find((item) => item.id === active.quest.giver);
      return npc ? { x: npc.x, y: npc.y } : undefined;
    }
    const objective = active.quest.objectives[active.progress.objectiveIndex];
    return WorldScene.OBJECTIVE_POINTS[objective.target];
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
        this.lighting.flash(enemy.x, enemy.y, 380, color, 900);
        GameEvents.emit('toast', message);
        this.sfx.setCombat(true);
        // Escalate the score to the boss theme and start the flawless-kill timer.
        this.sfx.setBossFight(true);
        this.bossFightStartedAt = this.time.now;

        const settings = this.saves.get().settings;
        const bossContext: BossContext = {
          hurtPlayer: (amount) => this.hurtPlayer(amount),
          spawnAdd: (addType, x, y) => {
            this.spawnEnemy({ type: addType as keyof typeof ENEMIES, x, y, temporary: true });
          },
          spawnProjectile: (request) => this.spawnEnemyProjectile(request),
          playerX: () => this.player.x,
          playerY: () => this.player.y,
          playerAlive: () => this.player.active,
          reducedMotion: settings.reducedMotion,
          lowQuality: settings.quality === 'low' || (settings.quality === 'auto' && this.scale.width < 700),
          onPhase: (phase, total) => {
            GameEvents.emit('boss-health', { health: Number(enemy?.getData('health')) || 0, phase });
            GameEvents.emit('toast', `${ENEMIES[type].name} — фаза ${phase}/${total}`);
          },
          setInvulnerable: (value) => enemy?.setData('bossInvulnerable', value),
        };
        const fight = new BossFight(this, enemy, type, bossContext);
        if (type === 'nameless') this.namelessFight = fight;
        else this.cinderFight = fight;
        // Tell the HUD to raise the boss bar.
        GameEvents.emit('boss-engage', {
          name: ENEMIES[type].name,
          maxHealth: Number(enemy.getData('maxHealth')) || ENEMIES[type].health,
          phases: 3,
        });
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
    if (!save.flags.tutorialDashed) { GameEvents.emit('tutorial', { step: 3, title: 'Ускользните от удара', text: 'Нажмите Shift или голубую кнопку рывка. Во время рывка вы неуязвимы.' }); return; }
    if (!save.flags.tutorialSpecial) { GameEvents.emit('tutorial', { step: 4, title: 'Высвободите силу оружия', text: 'Нажмите R или фиолетовую кнопку. Способность зависит от класса оружия.' }); return; }
    GameEvents.emit('tutorial', { step: 5, title: 'Найдите клятву', text: 'Подойдите к Сестре Море и нажмите E или кнопку действия.' });
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
      discoveredSecrets: this.discoveredSecretIds(),
      objectivePoint: this.objectivePoint(),
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
    this.sfx.setBossFight(false);
    // Stop the rain bed so it doesn't keep playing into the next scene.
    this.sfx.setRain(0);
    this.eventDisposers.forEach((dispose) => dispose());
    this.eventDisposers = [];
    // Both systems register scale-resize listeners, so they must be torn down
    // explicitly or they leak across scene restarts.
    this.lighting?.destroy();
    this.weather?.destroy();
    this.namelessFight?.destroy();
    this.cinderFight?.destroy();
    this.namelessFight = undefined;
    this.cinderFight = undefined;
    this.ui?.destroy();
    // Persist the time of day so re-entering the world doesn't reset the cycle.
    this.saves?.mutate((save) => { save.dayProgress = this.lighting?.getDayProgress() ?? save.dayProgress; });
    this.saves?.flush();
  }
}
