/**
 * Weather.
 *
 * Weather is deliberately not cosmetic here. Rain damps visibility and makes
 * stone slippery-sounding; fog shrinks how far you can see trouble coming; an ash
 * storm near the citadel both obscures and burns. Each state drives a visibility
 * multiplier that the enemy AI reads, so a storm genuinely changes how the game
 * plays rather than just how it looks.
 *
 * Everything is screen-space particles on a fixed budget, so weather costs the
 * same whether you're in a clearing or a forest, and the whole system can be
 * turned down on low-end devices.
 */

import Phaser from 'phaser';

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'storm' | 'fog' | 'ashfall';

export interface WeatherProfile {
  /** Screen tint applied on top of the daylight tint. */
  tint: number;
  tintAlpha: number;
  /** How far the player can see trouble, as a multiplier on enemy aggro range. */
  visibility: number;
  /** Rain bed volume for the audio manager, 0..1. */
  rainVolume: number;
  /** Chance per second of a thunder crack. */
  thunderChance: number;
  label: string;
}

export const WEATHER: Record<WeatherKind, WeatherProfile> = {
  clear: { tint: 0x000000, tintAlpha: 0, visibility: 1, rainVolume: 0, thunderChance: 0, label: 'ЯСНО' },
  overcast: { tint: 0x3a4050, tintAlpha: 0.14, visibility: 0.94, rainVolume: 0, thunderChance: 0, label: 'ПАСМУРНО' },
  rain: { tint: 0x2c3a4a, tintAlpha: 0.24, visibility: 0.82, rainVolume: 0.6, thunderChance: 0.004, label: 'ДОЖДЬ' },
  storm: { tint: 0x1e2636, tintAlpha: 0.4, visibility: 0.64, rainVolume: 1, thunderChance: 0.05, label: 'ГРОЗА' },
  fog: { tint: 0x59606c, tintAlpha: 0.34, visibility: 0.52, rainVolume: 0, thunderChance: 0, label: 'ТУМАН' },
  ashfall: { tint: 0x4a3630, tintAlpha: 0.3, visibility: 0.7, rainVolume: 0, thunderChance: 0.008, label: 'ПЕПЕЛЬНАЯ БУРЯ' },
};

/** Which weather each region can produce, and how likely. */
const REGION_WEATHER: Record<string, Array<{ kind: WeatherKind; weight: number }>> = {
  home: [{ kind: 'clear', weight: 5 }, { kind: 'overcast', weight: 3 }, { kind: 'rain', weight: 2 }],
  village: [{ kind: 'clear', weight: 5 }, { kind: 'overcast', weight: 3 }, { kind: 'rain', weight: 2 }],
  cemetery: [{ kind: 'fog', weight: 5 }, { kind: 'overcast', weight: 4 }, { kind: 'rain', weight: 2 }],
  forest: [{ kind: 'overcast', weight: 4 }, { kind: 'clear', weight: 3 }, { kind: 'rain', weight: 3 }, { kind: 'fog', weight: 2 }],
  ruins: [{ kind: 'fog', weight: 4 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 3 }],
  marsh: [{ kind: 'fog', weight: 6 }, { kind: 'rain', weight: 4 }, { kind: 'storm', weight: 2 }],
  mine: [{ kind: 'overcast', weight: 6 }, { kind: 'fog', weight: 2 }],
  docks: [{ kind: 'rain', weight: 4 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 3 }, { kind: 'fog', weight: 2 }],
  citadel: [{ kind: 'ashfall', weight: 6 }, { kind: 'storm', weight: 3 }, { kind: 'overcast', weight: 2 }],
  interior: [{ kind: 'clear', weight: 1 }],
};

interface Particle {
  object: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  /** Sway phase for drifting particles. */
  phase: number;
  swayAmount: number;
}

export class WeatherSystem {
  private overlay?: Phaser.GameObjects.Rectangle;
  private fogLayers: Phaser.GameObjects.Image[] = [];
  private particles: Particle[] = [];
  private current: WeatherKind = 'clear';
  private target: WeatherKind = 'clear';
  /** 0..1 crossfade toward the target profile. */
  private blend = 1;
  private nextChangeAt = 0;
  private elapsed = 0;
  private quality: 'high' | 'low' = 'high';
  private onThunder?: () => void;
  private lightningFlash = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  create(depth = 885, quality: 'high' | 'low' = 'high'): void {
    this.quality = quality;
    const { width, height } = this.scene.scale;
    this.overlay = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth);

    // Fog is three parallax bands of the soft light texture, stretched wide and
    // drifting at different speeds — cheap but reads as real volumetric haze.
    if (!this.scene.textures.exists('weather-fog')) {
      const texture = this.scene.textures.createCanvas('weather-fog', 256, 128);
      if (texture) {
        const ctx = texture.context;
        const gradient = ctx.createRadialGradient(128, 64, 0, 128, 64, 128);
        gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
        gradient.addColorStop(0.6, 'rgba(255,255,255,0.16)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 128);
        texture.refresh();
      }
    }
    const bands = quality === 'low' ? 2 : 3;
    for (let i = 0; i < bands; i += 1) {
      const image = this.scene.add
        .image(width * 0.5, height * (0.3 + i * 0.24), 'weather-fog')
        .setScrollFactor(0)
        .setDepth(depth - 1)
        .setDisplaySize(width * 1.9, height * (0.5 + i * 0.14))
        .setAlpha(0)
        .setTint(0xaebac9);
      this.fogLayers.push(image);
    }

    this.scene.scale.on('resize', this.handleResize, this);
    this.buildParticles();
  }

  private handleResize(): void {
    const { width, height } = this.scene.scale;
    this.overlay?.setSize(width, height);
    this.fogLayers.forEach((layer, i) => {
      layer.setPosition(width * 0.5, height * (0.3 + i * 0.24));
      layer.setDisplaySize(width * 1.9, height * (0.5 + i * 0.14));
    });
  }

  /** Allocate the particle pool once; individual particles are recycled. */
  private buildParticles(): void {
    const count = this.quality === 'low' ? 46 : 130;
    const { width, height } = this.scene.scale;
    for (let i = 0; i < count; i += 1) {
      const object = this.scene.add
        .rectangle(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 2, 12, 0xa8bccd, 0)
        .setScrollFactor(0)
        .setDepth(886);
      this.particles.push({ object, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, swayAmount: 0 });
    }
  }

  setQuality(quality: 'high' | 'low'): void {
    this.quality = quality;
    // Cull half the pool on low quality rather than rebuilding it.
    this.particles.forEach((particle, index) => {
      if (quality === 'low' && index % 3 !== 0) particle.object.setVisible(false);
      else particle.object.setVisible(true);
    });
  }

  onThunderStrike(callback: () => void): void {
    this.onThunder = callback;
  }

  /** Force a specific weather, e.g. for a scripted story beat. */
  setWeather(kind: WeatherKind, immediate = false): void {
    if (kind === this.target && !immediate) return;
    this.target = kind;
    if (immediate) {
      this.current = kind;
      this.blend = 1;
    } else {
      this.current = this.currentKindForBlend();
      this.blend = 0;
    }
    this.configureParticles(kind);
  }

  private currentKindForBlend(): WeatherKind {
    return this.blend >= 0.5 ? this.target : this.current;
  }

  /** Pick a plausible weather for a region and schedule the next change. */
  rollForRegion(region: string): void {
    const table = REGION_WEATHER[region] ?? REGION_WEATHER.village;
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) {
        this.setWeather(entry.kind);
        break;
      }
    }
    // Weather holds for 50-140s so it feels like a system, not a slot machine.
    this.nextChangeAt = this.elapsed + 50 + Math.random() * 90;
  }

  private configureParticles(kind: WeatherKind): void {
    const { width, height } = this.scene.scale;
    for (const particle of this.particles) {
      const object = particle.object as Phaser.GameObjects.Rectangle;
      switch (kind) {
        case 'rain':
        case 'storm': {
          const fast = kind === 'storm';
          object.setSize(2, fast ? 20 : 14).setFillStyle(0xa8c0d4, fast ? 0.5 : 0.36).setRotation(fast ? -0.28 : -0.16);
          particle.vx = fast ? -260 : -130;
          particle.vy = fast ? 1150 : 780;
          particle.swayAmount = 0;
          break;
        }
        case 'ashfall':
          // Ash tumbles and drifts rather than falling straight.
          object.setSize(3, 3).setFillStyle(Math.random() > 0.7 ? 0xff8a52 : 0x8d8079, 0.6).setRotation(0);
          particle.vx = -26;
          particle.vy = 54 + Math.random() * 44;
          particle.swayAmount = 26;
          break;
        case 'fog':
        case 'overcast':
        case 'clear':
        default:
          object.setFillStyle(0x000000, 0);
          particle.vx = 0;
          particle.vy = 0;
          particle.swayAmount = 0;
          break;
      }
      object.setPosition(Phaser.Math.Between(-40, width + 40), Phaser.Math.Between(-height, height));
    }
  }

  /** Blended profile between the outgoing and incoming weather. */
  profile(): WeatherProfile {
    const from = WEATHER[this.current];
    const to = WEATHER[this.target];
    const t = this.blend;
    return {
      tint: t > 0.5 ? to.tint : from.tint,
      tintAlpha: from.tintAlpha + (to.tintAlpha - from.tintAlpha) * t,
      visibility: from.visibility + (to.visibility - from.visibility) * t,
      rainVolume: from.rainVolume + (to.rainVolume - from.rainVolume) * t,
      thunderChance: from.thunderChance + (to.thunderChance - from.thunderChance) * t,
      label: t > 0.5 ? to.label : from.label,
    };
  }

  getKind(): WeatherKind { return this.blend > 0.5 ? this.target : this.current; }

  update(deltaMs: number, region: string): void {
    const delta = deltaMs / 1000;
    this.elapsed += delta;
    if (this.blend < 1) this.blend = Math.min(1, this.blend + delta / 6);
    if (this.elapsed >= this.nextChangeAt) this.rollForRegion(region);

    const profile = this.profile();
    const { width, height } = this.scene.scale;

    // Lightning decays fast; it's added on top of the weather tint.
    if (this.lightningFlash > 0) this.lightningFlash = Math.max(0, this.lightningFlash - delta * 4.5);

    if (this.overlay) {
      const alpha = profile.tintAlpha;
      this.overlay.setFillStyle(profile.tint, alpha);
      if (this.lightningFlash > 0) {
        this.overlay.setFillStyle(0xc8d4ee, this.lightningFlash * 0.5);
      }
    }

    // Fog bands drift at different rates for a parallax read.
    const fogTarget = this.getKind() === 'fog' ? 0.55 : this.getKind() === 'overcast' ? 0.14 : 0;
    this.fogLayers.forEach((layer, index) => {
      const speed = 8 + index * 6;
      layer.x -= speed * delta;
      if (layer.x < -width * 0.45) layer.x = width * 1.45;
      const target = fogTarget * (1 - index * 0.22);
      layer.setAlpha(layer.alpha + (target - layer.alpha) * Math.min(1, delta * 1.2));
    });

    // Precipitation.
    const kind = this.getKind();
    const active = kind === 'rain' || kind === 'storm' || kind === 'ashfall';
    for (const particle of this.particles) {
      if (!active || !particle.object.visible) {
        if (particle.object.alpha !== 0 && !active) particle.object.setAlpha(0);
        continue;
      }
      particle.object.setAlpha(1);
      particle.phase += delta * 2.2;
      const sway = particle.swayAmount > 0 ? Math.sin(particle.phase) * particle.swayAmount * delta : 0;
      particle.object.x += particle.vx * delta + sway;
      particle.object.y += particle.vy * delta;
      if (particle.object.y > height + 30) {
        particle.object.y = -30;
        particle.object.x = Phaser.Math.Between(-40, width + 60);
      }
      if (particle.object.x < -60) particle.object.x = width + 40;
    }

    // Thunder.
    if (profile.thunderChance > 0 && Math.random() < profile.thunderChance * delta * 60) {
      this.lightningFlash = 1;
      this.onThunder?.();
    }
  }

  destroy(): void {
    this.scene.scale.off('resize', this.handleResize, this);
    for (const particle of this.particles) particle.object.destroy();
    this.particles = [];
    for (const layer of this.fogLayers) layer.destroy();
    this.fogLayers = [];
    this.overlay?.destroy();
  }
}
