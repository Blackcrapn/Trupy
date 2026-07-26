/**
 * Bridges PixelCanvas output into Phaser's texture manager.
 *
 * Sprite factories stay engine-agnostic — they only know how to paint pixels.
 * This module is the single place that talks to Phaser, so the art can be
 * previewed offline (see tools/preview.mjs) without pulling the engine in.
 */

import type Phaser from 'phaser';
import { PixelCanvas, type ShadeOptions } from './PixelCanvas';

export interface TextureSpec {
  key: string;
  canvas: PixelCanvas;
  shade?: ShadeOptions;
}

/** Register a finished PixelCanvas as a Phaser texture. */
export function registerTexture(scene: Phaser.Scene, spec: TextureSpec): void {
  if (scene.textures.exists(spec.key)) return;
  const { canvas, shade } = spec;
  const texture = scene.textures.createCanvas(spec.key, canvas.width, canvas.height);
  if (!texture) return;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  const pixels = canvas.resolve(shade ?? {});
  const image = ctx.createImageData(canvas.width, canvas.height);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  texture.refresh();
}

export function registerAll(scene: Phaser.Scene, specs: TextureSpec[], shade?: ShadeOptions): void {
  for (const spec of specs) {
    registerTexture(scene, { ...spec, shade: spec.shade ?? shade });
  }
}

/**
 * Paint straight into a texture with a draw callback. Used for the few textures
 * that are simpler to express as direct canvas calls (noise, gradients, masks).
 */
export function rawTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  texture.refresh();
}
