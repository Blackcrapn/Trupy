/**
 * Dynamic lighting and the day/night cycle.
 *
 * A top-down pixel game can't afford per-pixel lighting, so this fakes it
 * convincingly and cheaply: a full-screen tint rectangle establishes the time of
 * day, and each light source is a radial-gradient sprite drawn additively on top.
 * Because the tint is a screen-space overlay and the lights are world-space, a
 * lantern genuinely carves a warm hole in the night as you walk past it.
 *
 * The cycle is also gameplay: night raises enemy aggression and spawns, so the
 * lighting isn't just decoration — it tells you when to be somewhere safe.
 */

// Imported as a value, not just a type: BlendModes constants are needed at runtime.
import Phaser from 'phaser';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night' | 'deepNight';

export interface DaylightState {
  phase: TimeOfDay;
  /** 0 = pitch dark, 1 = full daylight. */
  brightness: number;
  /** Screen tint colour and alpha for this moment. */
  tint: number;
  tintAlpha: number;
  /** Multiplier on enemy aggression and spawn density. */
  danger: number;
  /** Human-readable label for the HUD clock. */
  label: string;
}

/**
 * Key frames of the cycle. Values are interpolated between them so the
 * transition is continuous rather than stepping between five presets.
 */
interface Keyframe {
  at: number;
  tint: number;
  tintAlpha: number;
  brightness: number;
  danger: number;
  phase: TimeOfDay;
  label: string;
}

const CYCLE: Keyframe[] = [
  // Cold blue pre-dawn, lifting into warm low sun.
  { at: 0.00, tint: 0x121a33, tintAlpha: 0.62, brightness: 0.18, danger: 1.55, phase: 'deepNight', label: 'ГЛУХАЯ НОЧЬ' },
  { at: 0.16, tint: 0x2a2947, tintAlpha: 0.46, brightness: 0.34, danger: 1.3, phase: 'night', label: 'НОЧЬ' },
  { at: 0.26, tint: 0x6b4a5c, tintAlpha: 0.3, brightness: 0.62, danger: 1.1, phase: 'dawn', label: 'РАССВЕТ' },
  { at: 0.36, tint: 0x8a6a54, tintAlpha: 0.14, brightness: 0.88, danger: 0.95, phase: 'dawn', label: 'УТРО' },
  { at: 0.5, tint: 0x9aa2b0, tintAlpha: 0.05, brightness: 1, danger: 0.85, phase: 'day', label: 'ДЕНЬ' },
  { at: 0.66, tint: 0x8f7c62, tintAlpha: 0.12, brightness: 0.9, danger: 0.9, phase: 'day', label: 'ПОСЛЕ ПОЛУДНЯ' },
  { at: 0.76, tint: 0x7a4a45, tintAlpha: 0.28, brightness: 0.6, danger: 1.05, phase: 'dusk', label: 'ЗАКАТ' },
  { at: 0.86, tint: 0x2f2b4a, tintAlpha: 0.46, brightness: 0.32, danger: 1.3, phase: 'night', label: 'СУМЕРКИ' },
  { at: 1.00, tint: 0x121a33, tintAlpha: 0.62, brightness: 0.18, danger: 1.55, phase: 'deepNight', label: 'ГЛУХАЯ НОЧЬ' },
];

/** Blend two packed RGB colours. */
function blendColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Sample the cycle at a normalised time (0..1 = one full day). */
export function sampleDaylight(dayProgress: number): DaylightState {
  const t = ((dayProgress % 1) + 1) % 1;
  let previous = CYCLE[0];
  let next = CYCLE[CYCLE.length - 1];
  for (let i = 0; i < CYCLE.length - 1; i += 1) {
    if (t >= CYCLE[i].at && t <= CYCLE[i + 1].at) {
      previous = CYCLE[i];
      next = CYCLE[i + 1];
      break;
    }
  }
  const span = next.at - previous.at || 1;
  const local = (t - previous.at) / span;
  // Smoothstep so the light eases rather than ramping linearly.
  const eased = local * local * (3 - 2 * local);
  return {
    phase: eased < 0.5 ? previous.phase : next.phase,
    brightness: previous.brightness + (next.brightness - previous.brightness) * eased,
    tint: blendColor(previous.tint, next.tint, eased),
    tintAlpha: previous.tintAlpha + (next.tintAlpha - previous.tintAlpha) * eased,
    danger: previous.danger + (next.danger - previous.danger) * eased,
    label: eased < 0.5 ? previous.label : next.label,
  };
}

export interface LightSource {
  x: number;
  y: number;
  /** Radius in world pixels. */
  radius: number;
  color: number;
  /** Peak alpha at the centre. */
  intensity: number;
  /** Flicker amplitude, 0 = steady. Torches want ~0.16. */
  flicker?: number;
  /** Only visible when it's dark enough. */
  nightOnly?: boolean;
}

interface ActiveLight {
  source: LightSource;
  image: Phaser.GameObjects.Image;
  seed: number;
}

/**
 * Manages the night overlay and the additive light sprites.
 *
 * Lights are pooled Image objects using one shared radial-gradient texture and
 * tinted per source, so a hundred lanterns cost one texture and no per-frame
 * allocation.
 */
export class LightingSystem {
  private overlay?: Phaser.GameObjects.Rectangle;
  private lights: ActiveLight[] = [];
  private container?: Phaser.GameObjects.Container;
  private dayProgress = 0.42;
  private state: DaylightState = sampleDaylight(0.42);
  /** Real seconds for one in-game day. */
  private dayLength = 600;
  private enabled = true;
  private flickerTime = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly textureKey = 'light-radial',
  ) {}

  /** Build the shared radial gradient texture used by every light. */
  static createLightTexture(scene: Phaser.Scene, key = 'light-radial', size = 256): void {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, size, size);
    if (!texture) return;
    const ctx = texture.context;
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    // A slightly convex falloff reads more like a real lamp than a linear ramp.
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.72)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(0.8, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }

  /**
   * @param depth Render depth for the night overlay.
   * @param lightDepth Render depth for light sprites (below the overlay so the
   *        overlay darkens the world and lights punch back through it).
   */
  create(depth = 880, lightDepth = 879): void {
    LightingSystem.createLightTexture(this.scene, this.textureKey);
    const { width, height } = this.scene.scale;
    this.overlay = this.scene.add
      .rectangle(0, 0, width, height, this.state.tint, this.state.tintAlpha)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.container = this.scene.add.container(0, 0).setDepth(lightDepth);
    this.scene.scale.on('resize', this.handleResize, this);
  }

  private handleResize(): void {
    const { width, height } = this.scene.scale;
    this.overlay?.setSize(width, height);
  }

  /** Fixed starting time, e.g. restoring a save. */
  setDayProgress(progress: number): void {
    this.dayProgress = ((progress % 1) + 1) % 1;
    this.state = sampleDaylight(this.dayProgress);
    this.applyState();
  }

  getDayProgress(): number { return this.dayProgress; }
  getState(): DaylightState { return this.state; }

  /** Seconds of real time per in-game day. */
  setDayLength(seconds: number): void {
    this.dayLength = Math.max(60, seconds);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.overlay?.setVisible(enabled);
    this.container?.setVisible(enabled);
  }

  addLight(source: LightSource): void {
    if (!this.container) return;
    const image = this.scene.add
      .image(source.x, source.y, this.textureKey)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(source.color)
      .setDisplaySize(source.radius * 2, source.radius * 2);
    this.container.add(image);
    this.lights.push({ source, image, seed: Math.random() * 1000 });
  }

  /** Move an existing light — used for the player's own torch. */
  moveLight(index: number, x: number, y: number): void {
    const light = this.lights[index];
    if (!light) return;
    light.source.x = x;
    light.source.y = y;
    light.image.setPosition(x, y);
  }

  clearLights(): void {
    for (const light of this.lights) light.image.destroy();
    this.lights = [];
  }

  /** Advance time and update every light. Call from the scene's update loop. */
  update(deltaMs: number): void {
    if (!this.enabled) return;
    this.dayProgress = (this.dayProgress + deltaMs / 1000 / this.dayLength) % 1;
    this.flickerTime += deltaMs / 1000;
    this.state = sampleDaylight(this.dayProgress);
    this.applyState();
  }

  private applyState(): void {
    if (!this.overlay) return;
    this.overlay.setFillStyle(this.state.tint, this.state.tintAlpha);
    // Lights fade out as daylight rises — a lantern at noon should barely show.
    const darkness = 1 - this.state.brightness;
    for (const light of this.lights) {
      const { source } = light;
      let alpha = source.intensity * (source.nightOnly ? darkness : 0.35 + darkness * 0.65);
      if (source.flicker) {
        // Two incommensurate sines give an irregular flame without randomness
        // that would strobe frame to frame.
        const flick = Math.sin(this.flickerTime * 11 + light.seed) * 0.6
          + Math.sin(this.flickerTime * 23.3 + light.seed * 1.7) * 0.4;
        alpha *= 1 + flick * source.flicker;
        const scale = 1 + flick * source.flicker * 0.14;
        light.image.setDisplaySize(source.radius * 2 * scale, source.radius * 2 * scale);
      }
      light.image.setAlpha(Math.max(0, Math.min(1, alpha)));
    }
  }

  /** A one-off light flash — explosions, spell impacts, lightning. */
  flash(x: number, y: number, radius: number, color: number, duration = 260): void {
    if (!this.container) return;
    const image = this.scene.add
      .image(x, y, this.textureKey)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setDisplaySize(radius * 2, radius * 2);
    this.container.add(image);
    this.scene.tweens.add({
      targets: image,
      alpha: 0,
      displayWidth: radius * 3,
      displayHeight: radius * 3,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => image.destroy(),
    });
  }

  destroy(): void {
    this.scene.scale.off('resize', this.handleResize, this);
    this.clearLights();
    this.overlay?.destroy();
    this.container?.destroy();
  }
}

/** Warm flame preset — lanterns, braziers, campfires. */
export const FLAME_LIGHT = { color: 0xffb257, intensity: 0.78, flicker: 0.16, nightOnly: false };
/** Cold arcane preset — rifts, magic. */
export const ARCANE_LIGHT = { color: 0xb86ce0, intensity: 0.62, flicker: 0.08, nightOnly: false };
/** Forge preset — hotter and steadier than a torch. */
export const FORGE_LIGHT = { color: 0xff7a3c, intensity: 0.85, flicker: 0.1, nightOnly: false };
/** Window light from an inhabited building. */
export const WINDOW_LIGHT = { color: 0xffd08a, intensity: 0.5, flicker: 0.03, nightOnly: true };
