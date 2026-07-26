/**
 * Palette mathematics for the Trupy pixel renderer.
 *
 * Flat pixel art dies on flat fills. Every material colour here expands into a
 * ramp whose highlights drift warm and whose shadows drift cool — the same trick
 * hand-painted pixel art uses to imply a light source and a sky bounce without
 * ever leaving a small palette.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value);
const clamp01 = (value: number): number => clamp(value, 0, 1);

export function hexToRgb(hex: string): Rgb {
  const raw = hex.replace('#', '').trim();
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  const value = parseInt(raw.slice(0, 6), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const byte = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

export function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function hexToInt(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6;
  else h = ((rn - gn) / delta + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp01(s);
  const ln = clamp01(l);
  if (sn === 0) {
    const grey = ln * 255;
    return { r: grey, g: grey, b: grey };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number): number => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return {
    r: channel(hn + 1 / 3) * 255,
    g: channel(hn) * 255,
    b: channel(hn - 1 / 3) * 255,
  };
}

/** Shift a colour in HSL space. Lightness delta is absolute, hue is degrees. */
export function shift(hex: string, lightness: number, hue = 0, saturation = 0): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({
    h: hsl.h + hue,
    s: clamp01(hsl.s + saturation),
    l: clamp01(hsl.l + lightness),
  }));
}

export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = clamp01(amount);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface RampOptions {
  /** Number of shades. Index 0 is the brightest. */
  steps?: number;
  /** Total lightness travelled from brightest to darkest. */
  spread?: number;
  /** Hue of the incoming light — highlights drift toward it. */
  lightHue?: number;
  /** Hue of the ambient bounce — shadows drift toward it. */
  shadowHue?: number;
  /** How strongly hues drift, in degrees. */
  hueBias?: number;
  /** Shadows gain saturation, highlights lose it. Classic pixel-art move. */
  saturationBias?: number;
}

/**
 * A ramp of related shades generated from one base colour.
 *
 * Index 0 is the brightest shade and the last index the deepest shadow; the base
 * colour sits at `baseIndex`, so `at(baseIndex)` round-trips the input.
 */
export class Ramp {
  readonly shades: readonly string[];
  readonly baseIndex: number;

  constructor(readonly base: string, options: RampOptions = {}) {
    const steps = options.steps ?? 5;
    const spread = options.spread ?? 0.34;
    const lightHue = options.lightHue ?? 44;
    const shadowHue = options.shadowHue ?? 258;
    const hueBias = options.hueBias ?? 13;
    const saturationBias = options.saturationBias ?? 0.09;

    this.baseIndex = Math.min(steps - 1, Math.round((steps - 1) * 0.5));
    const hsl = rgbToHsl(hexToRgb(base));
    const shades: string[] = [];

    for (let index = 0; index < steps; index += 1) {
      // t: +1 at the brightest shade, -1 at the deepest.
      const t = this.baseIndex === 0 || steps === 1
        ? 0
        : index < this.baseIndex
          ? (this.baseIndex - index) / this.baseIndex
          : -(index - this.baseIndex) / Math.max(1, steps - 1 - this.baseIndex);

      const targetHue = t >= 0 ? lightHue : shadowHue;
      const hueDelta = shortestHueDelta(hsl.h, targetHue) * (Math.abs(t) * (hueBias / 180));

      shades.push(rgbToHex(hslToRgb({
        h: hsl.h + hueDelta,
        // Highlights desaturate toward the light, shadows deepen in colour.
        s: clamp01(hsl.s - t * saturationBias),
        l: clamp01(hsl.l + t * spread * 0.5),
      })));
    }

    this.shades = shades;
  }

  at(index: number): string {
    const clamped = clamp(Math.round(index), 0, this.shades.length - 1);
    return this.shades[clamped];
  }

  /** Sample the ramp with a continuous 0..1 factor (1 = brightest). */
  sample(factor: number): string {
    return this.at((1 - clamp01(factor)) * (this.shades.length - 1));
  }

  get highlight(): string { return this.shades[0]; }
  get light(): string { return this.at(this.baseIndex - 1); }
  get mid(): string { return this.at(this.baseIndex); }
  get shadow(): string { return this.at(this.baseIndex + 1); }
  get deep(): string { return this.shades[this.shades.length - 1]; }
}

function shortestHueDelta(from: number, to: number): number {
  let delta = ((to - from) % 360 + 540) % 360 - 180;
  if (delta === -180) delta = 180;
  return delta;
}

const rampCache = new Map<string, Ramp>();

/** Cached ramp lookup — texture builders call this thousands of times. */
export function ramp(base: string, options: RampOptions = {}): Ramp {
  const key = `${base}|${options.steps ?? 5}|${options.spread ?? 0.34}|${options.lightHue ?? 44}|${options.shadowHue ?? 258}|${options.hueBias ?? 13}|${options.saturationBias ?? 0.09}`;
  const cached = rampCache.get(key);
  if (cached) return cached;
  const created = new Ramp(base, options);
  rampCache.set(key, created);
  return created;
}

/**
 * The world palette. Materials, not decorations — every sprite in the valley
 * pulls from this so the whole game reads as one place.
 */
export const MATERIAL = {
  skin: '#c9986b',
  skinPale: '#d6b48f',
  skinDead: '#96a08b',
  leather: '#6d4b39',
  leatherDark: '#4a3229',
  cloth: '#7a4356',
  clothCold: '#40506b',
  steel: '#9aa4b4',
  steelDark: '#5d6675',
  iron: '#6b7180',
  gold: '#d3a24f',
  bronze: '#a9743c',
  bone: '#d8cdb0',
  boneOld: '#a99f83',
  wood: '#6b4a30',
  woodPale: '#8c6743',
  stone: '#6a6d78',
  stoneDark: '#484b55',
  granite: '#7b7468',
  slate: '#565a66',
  thatch: '#8a7043',
  moss: '#4c6b4a',
  foliage: '#2f4a38',
  foliageDeep: '#1f3327',
  foliageLit: '#456b4c',
  grass: '#3d5a41',
  soil: '#4a3b2f',
  ash: '#5a5259',
  emberCore: '#ff8a45',
  ember: '#e2582c',
  flame: '#ffb257',
  voidPurple: '#7b3f96',
  voidBright: '#cf7ce8',
  spirit: '#8fa8d8',
  toxic: '#6fae7c',
  water: '#2f5a68',
  waterLit: '#4d8497',
  blood: '#8e2f43',
  rust: '#8a5236',
} as const;

export type MaterialKey = keyof typeof MATERIAL;
