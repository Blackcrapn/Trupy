/**
 * The exile — Trupy's player character.
 *
 * Built as a sculpted figure rather than a stack of rectangles: the torso is a
 * cylinder, the head a dome, the pauldrons are spheres, and the cloak hangs as a
 * separate shaded plane that lags behind the walk cycle. Eight facing directions,
 * a breathing idle, a three-frame attack swing and a dash pose all come from the
 * same builder so the silhouette stays consistent.
 */

import { PixelCanvas, type DrawOptions } from '../render/PixelCanvas';
import { MATERIAL, mix, shift } from '../render/Palette';

export const HERO_W = 36;
export const HERO_H = 46;

/** Facing keys. Diagonals are real poses, not flipped side frames. */
export type HeroDir = 'down' | 'down-side' | 'side' | 'up-side' | 'up';
export const HERO_DIRS: HeroDir[] = ['down', 'down-side', 'side', 'up-side', 'up'];

export type HeroPose = 'walk' | 'idle' | 'attack' | 'dash' | 'hurt';

const SKIN = MATERIAL.skin;
const SKIN_SHADE = shift(SKIN, -0.1, -6);
const CLOTH = '#7c3b52';
const CLOTH_DEEP = '#5a2b3d';
const LEATHER = MATERIAL.leather;
const STEEL = MATERIAL.steel;
const HAIR = '#3a2b33';
const OUTLINE = '#14151d';
const RIM = '#8f9bc4';

interface HeroFrameSpec {
  dir: HeroDir;
  pose: HeroPose;
  /** Frame index within the pose. */
  frame: number;
}

/** Per-pose limb and body offsets, derived once per frame. */
interface Kinematics {
  /** Leg swing, in pixels. */
  stride: number;
  /** Vertical bob of the whole body. */
  bob: number;
  /** Torso lean along the facing axis. */
  lean: number;
  /** Arm extension for the weapon hand. */
  reach: number;
  /** Cloak trail offset. */
  cloak: number;
  /** Shoulder twist. */
  twist: number;
  /** Squash for impact frames. */
  squash: number;
}

function kinematics(pose: HeroPose, frame: number): Kinematics {
  switch (pose) {
    case 'walk': {
      // 8-frame cycle: two contact poses, two passing poses.
      const phase = (frame / 8) * Math.PI * 2;
      const stride = Math.round(Math.sin(phase) * 3);
      const bob = Math.abs(Math.sin(phase)) > 0.72 ? 0 : 1;
      return { stride, bob, lean: Math.round(Math.abs(Math.sin(phase)) * 0.8), reach: 0, cloak: -Math.round(Math.sin(phase) * 1.6), twist: Math.round(Math.cos(phase) * 1.4), squash: 0 };
    }
    case 'idle': {
      // Slow breathing: chest rises, cloak sways.
      const phase = (frame / 4) * Math.PI * 2;
      return { stride: 0, bob: Math.sin(phase) > 0.4 ? -1 : 0, lean: 0, reach: 0, cloak: Math.round(Math.sin(phase) * 1.2), twist: 0, squash: 0 };
    }
    case 'attack': {
      // 3 frames: wind-up (back), strike (full extension), recover.
      const table: Kinematics[] = [
        { stride: -1, bob: 0, lean: -2, reach: -3, cloak: 2, twist: -2, squash: 0 },
        { stride: 2, bob: -1, lean: 3, reach: 7, cloak: -3, twist: 3, squash: 1 },
        { stride: 1, bob: 0, lean: 1, reach: 3, cloak: -1, twist: 1, squash: 0 },
      ];
      return table[Math.min(2, frame)];
    }
    case 'dash':
      return { stride: 4, bob: -2, lean: 4, reach: -2, cloak: -6, twist: 2, squash: 0 };
    case 'hurt':
      return { stride: -2, bob: 1, lean: -3, reach: -4, cloak: 3, twist: -3, squash: 2 };
    default:
      return { stride: 0, bob: 0, lean: 0, reach: 0, cloak: 0, twist: 0, squash: 0 };
  }
}

/** Which way the figure faces, as a 2D unit-ish vector in sprite space. */
function facingVector(dir: HeroDir): { fx: number; fy: number } {
  switch (dir) {
    case 'down': return { fx: 0, fy: 1 };
    case 'down-side': return { fx: 0.72, fy: 0.66 };
    case 'side': return { fx: 1, fy: 0 };
    case 'up-side': return { fx: 0.72, fy: -0.66 };
    case 'up': return { fx: 0, fy: -1 };
  }
}

function drawHero(canvas: PixelCanvas, spec: HeroFrameSpec): void {
  const k = kinematics(spec.pose, spec.frame);
  const { fx, fy } = facingVector(spec.dir);
  const cx = HERO_W / 2;
  const baseY = 6 + k.bob;

  // Ground contact shadow first — anchors the figure to the world.
  canvas.groundShadow(cx, HERO_H - 5, 9 - k.squash, 3.4, 0.42);

  const leanX = Math.round(k.lean * fx);
  const leanY = Math.round(k.lean * fy * 0.5);

  // ----- Cloak. From the front the cloak sits behind the body and only its
  // edges peek out; from behind it fills the silhouette. Drawing it to match
  // the viewing angle is what keeps the front pose from turning into a slab.
  const cloakVisibility = spec.dir === 'up' ? 1 : spec.dir === 'up-side' ? 0.78 : spec.dir === 'side' ? 0.5 : spec.dir === 'down-side' ? 0.3 : 0.22;
  const cloakTop = baseY + 11;
  // Stops above the boots so the legs stay readable in the walk cycle.
  const cloakH = 16 + k.squash;
  const cloakW = Math.round(6 + 11 * cloakVisibility);
  const cloakX = cx - Math.round(fx * k.cloak * 0.7) + (spec.dir === 'side' ? -3 : 0);
  const sway = Math.round(k.cloak * 0.5);
  canvas.polygon([
    [cloakX - cloakW / 2, cloakTop],
    [cloakX + cloakW / 2, cloakTop],
    [cloakX + cloakW / 2 + sway + 2, cloakTop + cloakH],
    [cloakX - cloakW / 2 + sway - 2, cloakTop + cloakH],
  ], CLOTH_DEEP, { shape: 'cylinder-y', height: 2, curve: 0.75 });
  // Centre fold: a darker seam that stops the cloak reading as one flat shape.
  if (cloakVisibility > 0.45) {
    canvas.rect(cloakX - 1 + sway, cloakTop + 3, 3, cloakH - 5, shift(CLOTH_DEEP, -0.08), { shape: 'flat', height: 1, shade: 0.8 });
  }

  // ----- Legs. Rear leg first so the near leg overlaps it.
  const legY = baseY + 25;
  const legs: Array<{ x: number; z: number }> = spec.dir === 'side'
    ? [{ x: cx - 2 - k.stride, z: 3 }, { x: cx - 1 + k.stride, z: 6 }]
    : [{ x: cx - 5 + Math.round(k.stride * 0.5), z: 4 }, { x: cx + 1 - Math.round(k.stride * 0.5), z: 5 }];
  legs.forEach((leg, index) => {
    const shade = index === 0 ? 0.76 : 1;
    canvas.rect(leg.x, legY, 4, 9, LEATHER, { shape: 'cylinder-y', height: leg.z, shade, curve: 0.9 });
    canvas.rect(leg.x - 1, legY + 8, 6, 5, shift(LEATHER, -0.15), { shape: 'bevel', height: leg.z, shade, curve: 0.8 });
    canvas.rect(leg.x, legY + 7, 4, 1, shift(LEATHER, 0.12), { shape: 'flat', height: leg.z, shade });
  });

  // ----- Torso: a cylinder, so it rounds toward the edges.
  const torsoY = baseY + 12;
  const torsoW = spec.dir === 'side' ? 11 : 14;
  const torsoX = cx - torsoW / 2 + leanX;
  // Torso tapers: wider at the chest, narrower at the waist.
  canvas.rect(torsoX, torsoY + leanY, torsoW, 9, CLOTH, { shape: 'cylinder-y', height: 8, curve: 0.95 });
  canvas.rect(torsoX + 1, torsoY + leanY + 9, torsoW - 2, 4, CLOTH, { shape: 'cylinder-y', height: 8, curve: 0.95 });
  // Belt with a buckle: reads as a waist and breaks up the torso mass.
  canvas.rect(torsoX + 1, torsoY + leanY + 10, torsoW - 2, 3, shift(LEATHER, -0.04), { shape: 'cylinder-y', height: 9, curve: 0.8 });
  canvas.rect(cx - 2 + leanX, torsoY + leanY + 10, 3, 3, MATERIAL.bronze, { shape: 'bevel', height: 10, curve: 0.7 });
  if (spec.dir !== 'up') {
    // Tunic V, only visible from the front.
    canvas.polygon([
      [cx + leanX - 3, torsoY + leanY + 1],
      [cx + leanX + 3, torsoY + leanY + 1],
      [cx + leanX, torsoY + leanY + 6],
    ], shift(CLOTH, -0.12), { shape: 'flat', height: 9 });
  }
  // Shoulder pauldrons: spheres, the strongest volume cue on the figure.
  const shoulderY = torsoY + leanY;
  const pauldronOffsets = spec.dir === 'side'
    ? [{ x: cx - 4 + k.twist, z: 11, shade: 0.78 }, { x: cx + 1 + k.twist, z: 13, shade: 1 }]
    : [{ x: cx - torsoW / 2 - 1 + leanX, z: 12, shade: 0.88 }, { x: cx + torsoW / 2 - 3 + leanX, z: 12, shade: 1 }];
  pauldronOffsets.forEach((p) => {
    canvas.ellipse(p.x + 2, shoulderY + 1.5, 3.4, 2.8, STEEL, { shape: 'round', height: p.z, shade: p.shade, curve: 1 });
    canvas.rect(p.x + 0.5, shoulderY + 3, 4, 1, shift(STEEL, -0.18), { shape: 'flat', height: p.z - 1, shade: p.shade });
  });

  // ----- Weapon arm, extended on attack frames.
  const armY = shoulderY + 3;
  const reachX = Math.round(fx * k.reach);
  const reachY = Math.round(fy * k.reach);
  const armSwing = spec.pose === 'walk' ? Math.round(k.stride * 0.5) : 0;
  if (spec.dir === 'side') {
    canvas.rect(cx + 2 + reachX, armY + reachY + armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 10, curve: 0.9 });
    canvas.ellipse(cx + 3.5 + reachX, armY + 7 + reachY + armSwing, 2.2, 2, SKIN, { shape: 'round', height: 11 });
  } else {
    canvas.rect(cx + torsoW / 2 - 2 + reachX + leanX, armY + reachY + armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 10, curve: 0.9 });
    canvas.ellipse(cx + torsoW / 2 - 0.5 + reachX + leanX, armY + 7 + reachY + armSwing, 2.2, 2, SKIN, { shape: 'round', height: 11 });
    // Off hand swings opposite the weapon hand.
    canvas.rect(cx - torsoW / 2 - 1 + leanX, armY - armSwing, 3, 7, CLOTH, { shape: 'cylinder-y', height: 9, shade: 0.84, curve: 0.9 });
    canvas.ellipse(cx - torsoW / 2 + 0.5 + leanX, armY + 7 - armSwing, 2, 1.9, SKIN, { shape: 'round', height: 10, shade: 0.84 });
  }

  // ----- Head: a dome with a jaw, plus hair and hood shading.
  const headY = baseY + 1;
  const headW = spec.dir === 'side' ? 9 : 11;
  const headX = cx - headW / 2 + leanX + (spec.dir === 'side' ? 1 : 0);
  // Neck, tucked so the head sits on the shoulders rather than floating.
  canvas.rect(cx - 1.5 + leanX, headY + 8, 3, 4, SKIN_SHADE, { shape: 'cylinder-y', height: 12, shade: 0.7 });
  canvas.ellipse(headX + headW / 2, headY + 5, headW / 2, 4.8, SKIN, { shape: 'dome', height: 16, curve: 0.92 });
  // Hair over the crown, following the dome.
  canvas.ellipse(headX + headW / 2, headY + 2.6, headW / 2 + 0.4, 3.2, HAIR, { shape: 'dome', height: 17, curve: 0.85 });
  if (spec.dir === 'up') {
    // From behind: all hair, no face.
    canvas.ellipse(headX + headW / 2, headY + 4.6, headW / 2, 4.4, shift(HAIR, 0.03), { shape: 'dome', height: 16, curve: 0.9 });
  } else if (spec.dir === 'side' || spec.dir === 'up-side') {
    canvas.rect(headX + 0.5, headY + 3.5, 3, 5, HAIR, { shape: 'cylinder-y', height: 16, curve: 0.7 });
    if (spec.dir === 'side') {
      canvas.rect(headX + headW - 3.5, headY + 4.5, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
      canvas.rect(headX + headW - 3.5, headY + 5.5, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
    }
  } else {
    // Eyes: bright sclera with a dark pupil, one pixel each.
    const eyeY = headY + 4.5;
    const eyeSpread = spec.dir === 'down-side' ? [-2, 1] : [-2.5, 1.5];
    eyeSpread.forEach((offset) => {
      canvas.rect(headX + headW / 2 + offset, eyeY, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
      canvas.rect(headX + headW / 2 + offset, eyeY + 1, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
    });
    // Brow shadow adds a scowl and reads as depth.
    canvas.rect(headX + 1.5, headY + 3, headW - 3, 1, shift(HAIR, -0.05), { shape: 'flat', height: 17, shade: 0.9 });
    canvas.rect(headX + headW / 2 - 1, headY + 7.5, 2, 1, shift(SKIN, -0.24, -8), { shape: 'flat', height: 16 });
  }
  // Hood collar wraps the neck and ties head to torso.
  canvas.rect(cx - torsoW / 2 + 1 + leanX, headY + 9.5, torsoW - 2, 3, CLOTH_DEEP, { shape: 'cylinder-y', height: 11, curve: 0.85 });

  // Dark keyline everywhere, with a faint lit edge on the upper-left only.
  canvas.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.94 });
}

/** Key for a generated hero frame texture. */
export function heroKey(dir: HeroDir, pose: HeroPose, frame: number): string {
  return `hero-${dir}-${pose}-${frame}`;
}

export const HERO_POSE_FRAMES: Record<HeroPose, number> = {
  walk: 8,
  idle: 4,
  attack: 3,
  dash: 1,
  hurt: 1,
};

/** Render one hero frame into a fresh canvas. */
export function renderHeroFrame(dir: HeroDir, pose: HeroPose, frame: number): PixelCanvas {
  const canvas = new PixelCanvas(HERO_W, HERO_H);
  drawHero(canvas, { dir, pose, frame });
  return canvas;
}

export const HERO_SHADE = {
  lightX: -0.5,
  lightY: -0.76,
  lightZ: 0.4,
  intensity: 0.66,
  ambient: 0.5,
  ambientColor: '#4f5f8c',
  occlusion: 0.4,
  rim: 0.2,
  rimColor: '#9fb0dc',
  bands: 5,
  dither: 0.42,
};

/** Every frame the hero needs, as (key, canvas) pairs. */
export function buildHeroFrames(): Array<{ key: string; canvas: PixelCanvas }> {
  const frames: Array<{ key: string; canvas: PixelCanvas }> = [];
  for (const dir of HERO_DIRS) {
    for (const pose of Object.keys(HERO_POSE_FRAMES) as HeroPose[]) {
      for (let frame = 0; frame < HERO_POSE_FRAMES[pose]; frame += 1) {
        frames.push({ key: heroKey(dir, pose, frame), canvas: renderHeroFrame(dir, pose, frame) });
      }
    }
  }
  return frames;
}

export const HERO_COLORS = { CLOTH, CLOTH_DEEP, LEATHER, STEEL, SKIN, OUTLINE, RIM };
export type { DrawOptions };
export { mix };
