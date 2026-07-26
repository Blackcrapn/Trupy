/**
 * PixelCanvas — a tiny software rasteriser that gives flat pixel art volume.
 *
 * Every sprite in Trupy is generated at runtime. Drawing them with plain
 * `fillRect` calls reads flat, so instead we rasterise into a depth-aware buffer:
 * each pixel stores a colour, a surface normal and a height. Once the shapes are
 * down we run a lighting pass that applies a directional light, an ambient sky
 * bounce, contact occlusion and a rim highlight — the same lighting model a 3D
 * renderer uses, quantised back down to a small palette so it still reads as
 * pixel art.
 *
 * The result is "light 3D": sculpted, readable sprites that never stop being pixels.
 */

import { Ramp, hexToRgb, mix, ramp, rgbToHex, shift, type Rgb } from './Palette';

export interface ShadeOptions {
  /** Light direction in sprite space. Default is upper-left, the pixel-art convention. */
  lightX?: number;
  lightY?: number;
  lightZ?: number;
  /** Strength of the directional term. */
  intensity?: number;
  /** Fill light so shadows never go pure black. */
  ambient?: number;
  /** Colour of the ambient bounce. */
  ambientColor?: string;
  /** Contact-shadow strength where surfaces meet. */
  occlusion?: number;
  /** Rim light along the silhouette. */
  rim?: number;
  rimColor?: string;
  /** Quantise the final lighting into N bands. 0 disables banding. */
  bands?: number;
  /** Ordered dithering between bands, 0..1. */
  dither?: number;
}

const DEFAULT_SHADE: Required<ShadeOptions> = {
  lightX: -0.55,
  lightY: -0.72,
  lightZ: 0.42,
  intensity: 0.62,
  ambient: 0.52,
  ambientColor: '#5a6b96',
  occlusion: 0.42,
  rim: 0.3,
  rimColor: '#d6dcf0',
  bands: 5,
  dither: 0.5,
};

/** 4x4 Bayer matrix, normalised to 0..1. Ordered dithering without noise. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16));

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export type Shape = 'flat' | 'round' | 'cylinder-x' | 'cylinder-y' | 'dome' | 'bevel' | 'cone';

export interface DrawOptions {
  /** How the surface curves — drives the generated normals. */
  shape?: Shape;
  /** Height above the ground plane, used for occlusion and depth sorting. */
  height?: number;
  /** Multiply the lighting result (for pre-darkened crevices). */
  shade?: number;
  /** Mark as self-illuminated — skips the lighting pass entirely. */
  emissive?: boolean;
  /** Alpha 0..1. */
  alpha?: number;
  /** Curvature strength for the shaped normals. */
  curve?: number;
}

interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
  nx: number;
  ny: number;
  nz: number;
  height: number;
  shade: number;
  emissive: boolean;
  /** Ground shadow, not part of the sprite body — excluded from outlining. */
  shadowOnly: boolean;
}

export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  private readonly buffer: Pixel[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = new Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      this.buffer[i] = { r: 0, g: 0, b: 0, a: 0, nx: 0, ny: 0, nz: 1, height: 0, shade: 1, emissive: false, shadowOnly: false };
    }
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  private inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Write one pixel with a normal and height. Alpha-composites over what's there. */
  plot(x: number, y: number, color: string, normal: [number, number, number], options: DrawOptions = {}): void {
    const px = Math.round(x);
    const py = Math.round(y);
    if (!this.inside(px, py)) return;
    const alpha = clamp01(options.alpha ?? 1);
    if (alpha <= 0) return;
    const { r, g, b } = hexToRgb(color);
    const target = this.buffer[this.index(px, py)];
    if (alpha >= 1) {
      target.r = r; target.g = g; target.b = b; target.a = 1;
    } else {
      const inv = 1 - alpha;
      target.r = r * alpha + target.r * inv;
      target.g = g * alpha + target.g * inv;
      target.b = b * alpha + target.b * inv;
      target.a = Math.min(1, alpha + target.a * inv);
    }
    const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    target.nx = normal[0] / len;
    target.ny = normal[1] / len;
    target.nz = normal[2] / len;
    target.height = options.height ?? 0;
    target.shade = options.shade ?? 1;
    target.emissive = options.emissive ?? false;
    target.shadowOnly = false;
  }

  /** True when a pixel belongs to the sprite body (not a cast shadow). */
  private isBody(x: number, y: number): boolean {
    if (!this.inside(x, y)) return false;
    const p = this.buffer[this.index(x, y)];
    return p.a > 0.1 && !p.shadowOnly;
  }

  /** Normal for a point inside a shape, given its 0..1 position within the shape. */
  private shapeNormal(shape: Shape, u: number, v: number, curve: number): [number, number, number] {
    // u,v are -1..1 from the shape centre.
    switch (shape) {
      case 'round': {
        const d = Math.hypot(u, v);
        const z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, d * d)));
        return [u * curve, v * curve, z];
      }
      case 'dome': {
        const d = Math.hypot(u, v);
        const z = Math.sqrt(Math.max(0.04, 1 - Math.min(1, d * d)));
        return [u * curve * 0.8, v * curve * 1.15, z];
      }
      case 'cylinder-x':
        return [0, v * curve, Math.sqrt(Math.max(0.05, 1 - Math.min(1, v * v)))];
      case 'cylinder-y':
        return [u * curve, 0, Math.sqrt(Math.max(0.05, 1 - Math.min(1, u * u)))];
      case 'bevel': {
        const edge = Math.max(Math.abs(u), Math.abs(v));
        if (edge < 0.62) return [0, 0, 1];
        return [Math.abs(u) > Math.abs(v) ? Math.sign(u) * curve : 0, Math.abs(v) >= Math.abs(u) ? Math.sign(v) * curve : 0, 0.72];
      }
      case 'cone': {
        const d = Math.hypot(u, v) || 0.0001;
        return [(u / d) * curve * 0.9, (v / d) * curve * 0.9, 0.62];
      }
      case 'flat':
      default:
        return [0, 0, 1];
    }
  }

  rect(x: number, y: number, w: number, h: number, color: string, options: DrawOptions = {}): void {
    const shape = options.shape ?? 'flat';
    const curve = options.curve ?? 0.85;
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const width = Math.round(w);
    const height = Math.round(h);
    if (width <= 0 || height <= 0) return;
    for (let j = 0; j < height; j += 1) {
      for (let i = 0; i < width; i += 1) {
        const u = width === 1 ? 0 : (i / (width - 1)) * 2 - 1;
        const v = height === 1 ? 0 : (j / (height - 1)) * 2 - 1;
        this.plot(x0 + i, y0 + j, color, this.shapeNormal(shape, u, v, curve), options);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, options: DrawOptions = {}): void {
    const shape = options.shape ?? 'round';
    const curve = options.curve ?? 0.9;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const u = rx === 0 ? 0 : (x + 0.5 - cx) / rx;
        const v = ry === 0 ? 0 : (y + 0.5 - cy) / ry;
        if (u * u + v * v > 1.02) continue;
        this.plot(x, y, color, this.shapeNormal(shape, u, v, curve), options);
      }
    }
  }

  circle(cx: number, cy: number, r: number, color: string, options: DrawOptions = {}): void {
    this.ellipse(cx, cy, r, r, color, options);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, thickness = 1, options: DrawOptions = {}): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const half = (thickness - 1) / 2;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      for (let j = 0; j < thickness; j += 1) {
        for (let i = 0; i < thickness; i += 1) {
          this.plot(px - half + i, py - half + j, color, [0, 0, 1], options);
        }
      }
    }
  }

  /** Filled polygon via scanline. Points are [x,y] pairs. */
  polygon(points: Array<[number, number]>, color: string, options: DrawOptions = {}): void {
    if (points.length < 3) return;
    const shape = options.shape ?? 'flat';
    const curve = options.curve ?? 0.85;
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [px, py] of points) {
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
      const crossings: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          crossings.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      crossings.sort((p, q) => p - q);
      for (let c = 0; c + 1 < crossings.length; c += 2) {
        for (let x = Math.round(crossings[c]); x <= Math.round(crossings[c + 1]); x += 1) {
          const u = ((x - minX) / spanX) * 2 - 1;
          const v = ((y - minY) / spanY) * 2 - 1;
          this.plot(x, y, color, this.shapeNormal(shape, u, v, curve), options);
        }
      }
    }
  }

  /** Vertical gradient band — dithered so it stays in-palette. */
  gradientRect(x: number, y: number, w: number, h: number, top: string, bottom: string, options: DrawOptions = {}): void {
    const steps = Math.max(1, Math.round(h));
    for (let j = 0; j < steps; j += 1) {
      const t = steps === 1 ? 0 : j / (steps - 1);
      const color = mix(top, bottom, t);
      this.rect(x, y + j, w, 1, color, { ...options, shape: 'flat' });
    }
  }

  /**
   * Outline the current silhouette. This is what makes sprites pop against the
   * dark world — a dark keyline plus a subtle lit edge on the light side.
   */
  outline(color: string, options: { lightEdge?: string; alpha?: number } = {}): void {
    const alpha = options.alpha ?? 1;
    const additions: Array<{ x: number; y: number; color: string }> = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        // Only outline outside the body. Cast shadows get overwritten, not traced.
        if (this.isBody(x, y)) continue;
        let touchesBody = false;
        let litSide = false;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            if (!this.isBody(x + dx, y + dy)) continue;
            touchesBody = true;
            // A body pixel below-right means we sit on the upper-left lit edge.
            if (dx >= 0 && dy >= 0) litSide = true;
          }
        }
        if (touchesBody) {
          additions.push({ x, y, color: litSide && options.lightEdge ? options.lightEdge : color });
        }
      }
    }
    for (const add of additions) {
      this.plot(add.x, add.y, add.color, [0, 0, 1], { alpha, shade: 1, emissive: true });
    }
  }

  /** Soft elliptical drop shadow on the ground. Drawn under everything. */
  groundShadow(cx: number, cy: number, rx: number, ry: number, strength = 0.34): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (!this.inside(x, y)) continue;
        const u = rx === 0 ? 0 : (x + 0.5 - cx) / rx;
        const v = ry === 0 ? 0 : (y + 0.5 - cy) / ry;
        const d = u * u + v * v;
        if (d > 1) continue;
        const target = this.buffer[this.index(x, y)];
        if (target.a > 0.1) continue;
        const falloff = (1 - Math.sqrt(d)) ** 1.4;
        const alpha = strength * falloff;
        target.r = 8; target.g = 9; target.b = 14;
        target.a = Math.max(target.a, alpha);
        target.emissive = true;
        target.shadowOnly = true;
      }
    }
  }

  /** Run the lighting pass and return the finished RGBA bytes. */
  resolve(options: ShadeOptions = {}): Uint8ClampedArray {
    const cfg = { ...DEFAULT_SHADE, ...options };
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    const lightLen = Math.hypot(cfg.lightX, cfg.lightY, cfg.lightZ) || 1;
    const lx = cfg.lightX / lightLen;
    const ly = cfg.lightY / lightLen;
    const lz = cfg.lightZ / lightLen;
    const ambient = hexToRgb(cfg.ambientColor);
    const rim = hexToRgb(cfg.rimColor);

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const i = this.index(x, y);
        const p = this.buffer[i];
        const o = i * 4;
        if (p.a <= 0.004) continue;
        if (p.emissive) {
          out[o] = p.r; out[o + 1] = p.g; out[o + 2] = p.b; out[o + 3] = p.a * 255;
          continue;
        }

        // Directional (Lambert, half-shifted so back faces still read).
        const ndotl = p.nx * lx + p.ny * ly + p.nz * lz;
        let light = cfg.ambient + cfg.intensity * Math.max(0, ndotl * 0.5 + 0.5) ** 1.35;

        // Contact occlusion: neighbours that stand taller shade this pixel.
        if (cfg.occlusion > 0) {
          let occ = 0;
          let samples = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const nx2 = x + dx;
              const ny2 = y + dy;
              samples += 1;
              if (!this.inside(nx2, ny2)) continue;
              const n = this.buffer[this.index(nx2, ny2)];
              if (n.a <= 0.1) continue;
              // Taller neighbour toward the light occludes more.
              const towardLight = dx * lx + dy * ly < 0 ? 1.5 : 0.6;
              if (n.height > p.height) occ += Math.min(1, (n.height - p.height) / 6) * towardLight;
            }
          }
          if (samples > 0) light *= 1 - clamp01(occ / samples) * cfg.occlusion;
        }

        // Rim light: the silhouette edge on the far side from the light catches
        // a cool bounce, which is what separates a sprite from a dark background.
        let rimAmount = 0;
        if (cfg.rim > 0) {
          let exposed = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              if (this.isBody(x + dx, y + dy)) continue;
              // Empty toward the shadow side (opposite the light) = rim.
              if (dx * -lx + dy * -ly > 0.35) exposed += 1;
            }
          }
          if (exposed > 0) rimAmount = clamp01(exposed / 3) * cfg.rim;
        }

        light *= p.shade;

        // Quantise into bands, dithering only across a band boundary. Flat faces
        // stay clean; only genuine gradients pick up the checker texture.
        if (cfg.bands > 1) {
          const scaled = clamp01(light / 1.4) * (cfg.bands - 1);
          const floor = Math.floor(scaled);
          const frac = scaled - floor;
          let stepped = floor;
          if (cfg.dither > 0) {
            // Dither band is narrow: only pixels near the midpoint alternate.
            const edge = 0.5 - cfg.dither * 0.34;
            if (frac > 1 - edge) stepped = floor + 1;
            else if (frac > edge) stepped = floor + (frac > BAYER[y & 3][x & 3] ? 1 : 0);
          } else {
            stepped = Math.round(scaled);
          }
          light = (Math.min(cfg.bands - 1, Math.max(0, stepped)) / (cfg.bands - 1)) * 1.4;
        }

        // Ambient bounce tints the shadows cool.
        const shadowMix = clamp01((1 - clamp01(light)) * 0.42);
        let r = p.r * light + ambient.r * shadowMix * 0.55;
        let g = p.g * light + ambient.g * shadowMix * 0.55;
        let b = p.b * light + ambient.b * shadowMix * 0.55;

        if (rimAmount > 0) {
          r += rim.r * rimAmount * 0.55;
          g += rim.g * rimAmount * 0.55;
          b += rim.b * rimAmount * 0.55;
        }

        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = p.a * 255;
      }
    }
    return out;
  }

  /** Raw buffer access for the offline sprite previewer. */
  debugPixels(options: ShadeOptions = {}): Uint8ClampedArray {
    return this.resolve(options);
  }
}

/** Helper: build a material ramp with the world's light/shadow hues baked in. */
export function materialRamp(base: string, steps = 5, spread = 0.36): Ramp {
  return ramp(base, { steps, spread, lightHue: 44, shadowHue: 254, hueBias: 15, saturationBias: 0.1 });
}

/** Slightly randomised colour, for scattering variety across many instances. */
export function vary(base: string, seed: number, amount = 0.05): string {
  const wobble = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return shift(base, (wobble - 0.5) * amount * 2, (wobble - 0.5) * 12);
}

export { hexToRgb, rgbToHex, mix, shift, type Rgb };
