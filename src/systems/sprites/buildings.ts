/**
 * Building sprites for Trupy — sculpted pseudo-3D architecture.
 *
 * A top-down action-RPG reads as flat the instant its houses are rectangles.
 * These builders rebuild the nine world buildings as *volumes*: every structure
 * shows a lit front face and a shadowed receding side face, a roof with genuine
 * thickness (pitched roofs have two slopes meeting at a ridge, flat roofs a
 * parapet with a visible top and a shadowed inner face), an eave overhang that
 * casts a shadow band down onto the wall, recessed windows and doors with jamb
 * thickness, and a soft cast shadow anchoring the whole thing to the ground.
 *
 * Lighting convention matches the rest of the game: the key light comes from the
 * upper-left (see DEFAULT_SHADE / PROP_SHADE). So throughout this file:
 *   - the FRONT face (normal toward camera) reads at full light,
 *   - the RIGHT side face recedes into shadow (it faces away from the light),
 *   - roof LEFT/UPPER slopes are lit, RIGHT/LOWER slopes are shadowed,
 *   - the ground shadow is thrown DOWN and slightly RIGHT.
 * Keeping that single rule everywhere is what makes the buildings feel lit by
 * the same sun as the trees and the hero.
 *
 * COORDINATE CONTRACT (important for integration):
 * The renderer works in world units (1 canvas pixel = 1 world unit, matching the
 * old flat WorldScene.drawBuildings). The wall body is exactly `w × h` world
 * units, and it is placed CENTRED in the canvas both axes — so the finished
 * texture can be dropped with `add.image(building.x, building.y, key)` at the
 * default origin (0.5, 0.5) and the wall body lands precisely on the collision
 * box WorldScene builds from `w`, `h` and `doorX`. Roof volume, spires, side
 * faces, eaves and the cast shadow all live inside the surrounding margin, so
 * they overhang the collision box visually without shifting the anchor. The
 * door opening is centred on `doorX` at the wall's bottom edge, matching
 * `getBuildingDoor()`.
 */

import { PixelCanvas } from '../render/PixelCanvas';
import { intToHex, mix, shift } from '../render/Palette';

export interface BuildingRenderSpec {
  w: number;
  h: number;
  /** Wall base colour as a 24-bit int (matches world.ts BUILDINGS). */
  wall: number;
  /** Roof base colour as a 24-bit int. */
  roof: number;
  /** Door offset from the building centre, in world units (matches doorX). */
  doorX: number;
  style: string;
  name: string;
}

/**
 * Shading for buildings. Close to PROP_SHADE so a house is lit like everything
 * around it, but with a little more directional intensity and a touch less rim:
 * big flat faces want a clear light/shadow split across the two visible sides,
 * and a strong rim on a large silhouette would just look like a glowing outline.
 */
export const BUILDING_SHADE = {
  lightX: -0.55,
  lightY: -0.72,
  lightZ: 0.44,
  intensity: 0.66,
  ambient: 0.5,
  ambientColor: '#4f5f8c',
  occlusion: 0.4,
  rim: 0.16,
  rimColor: '#9fb0dc',
  bands: 5,
  dither: 0.42,
};

const OUTLINE = '#111019';
const RIM = '#8b97bf';

/** Shared keyline pass: dark silhouette line with a faint cool lit edge up-left. */
function finish(c: PixelCanvas): void {
  c.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.9 });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Per-style canvas margins around the `w × h` wall body, in world units.
 * `top` must clear the tallest roof/spire the style draws; `side` clears the
 * eave overhang plus the revealed side face; `bottom` clears the cast shadow.
 * We then pad the canvas symmetrically (max of top/bottom, and `side` each way)
 * so the wall body stays dead-centre and the sprite anchors at origin (0.5,0.5).
 */
interface Margins { top: number; side: number; bottom: number; }

function marginsFor(style: string, w: number, h: number): Margins {
  // Depth of the receding side face — scales gently with size so big buildings
  // don't look shallow and small ones don't look like they're toppling over.
  const depth = Math.round(Math.min(30, Math.max(16, w * 0.11)));
  const eave = 10; // roof overhang past the wall, both sides
  const shadow = Math.round(Math.max(20, h * 0.16));
  switch (style) {
    case 'chapel':
      // Tall pitched roof + bell tower/spire well above the wall top.
      return { top: Math.round(h * 0.95 + 30), side: depth + eave + 6, bottom: shadow };
    case 'inn':
      // Two-storey pitch + a hanging sign bracket sticking out the side.
      return { top: Math.round(h * 0.5 + 22), side: depth + eave + 18, bottom: shadow };
    case 'forge':
      // Tall chimney with a smoke plume above it.
      return { top: Math.round(h * 0.62 + 26), side: depth + eave + 6, bottom: shadow };
    case 'citadel':
      // Crenellated parapet + banners; not very tall but wide-shouldered.
      return { top: Math.round(h * 0.34 + 26), side: depth + eave + 10, bottom: shadow };
    case 'warehouse':
      return { top: Math.round(h * 0.34 + 18), side: depth + eave + 6, bottom: shadow };
    case 'marsh':
      // Stilts raise the hut; shadow falls under the raised floor.
      return { top: Math.round(h * 0.42 + 20), side: depth + eave + 8, bottom: Math.round(shadow + h * 0.12) };
    case 'cottage':
      return { top: Math.round(h * 0.5 + 18), side: depth + eave + 4, bottom: shadow };
    case 'home':
    default:
      return { top: Math.round(h * 0.55 + 18), side: depth + eave + 4, bottom: shadow };
  }
}

/** Geometry resolved once per building and threaded through the builders. */
interface Frame {
  c: PixelCanvas;
  /** Wall body rectangle within the canvas (top-left + size). */
  wx: number;
  wy: number;
  w: number;
  h: number;
  /** Convenience edges. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  /** Door centre X within the canvas. */
  doorCx: number;
  /** Depth of the receding right side face, in px. */
  depth: number;
  /** Palette. */
  wall: string;
  roof: string;
}

function makeFrame(spec: BuildingRenderSpec): Frame {
  const { w, h, style } = spec;
  const m = marginsFor(style, w, h);
  const vert = Math.max(m.top, m.bottom);
  const cw = w + m.side * 2;
  const ch = h + vert * 2;
  const c = new PixelCanvas(cw, ch);
  const wx = m.side;
  const wy = vert;
  const depth = Math.round(Math.min(30, Math.max(16, w * 0.11)));
  return {
    c,
    wx, wy, w, h,
    left: wx, right: wx + w, top: wy, bottom: wy + h,
    cx: wx + w / 2,
    doorCx: wx + w / 2 + spec.doorX,
    depth,
    wall: intToHex(spec.wall),
    roof: intToHex(spec.roof),
  };
}

// ---------------------------------------------------------------------------
// Shared volume primitives
// ---------------------------------------------------------------------------

/**
 * The two-face body: a lit flat front and a shadowed side receding up-and-right.
 * This is the single most important trick — a parallelogram side face pinned to
 * the front's right edge instantly reads as "a box seen in 3/4" instead of a
 * flat panel. Height is set so occlusion/depth-sort treats it as a tall object.
 */
function boxBody(f: Frame, x: number, y: number, w: number, h: number, base: string, opts: { sideShade?: number; height?: number } = {}): void {
  const depth = f.depth;
  const height = opts.height ?? 40;
  const side = shift(base, -0.14, 8); // receding face drifts cooler + darker
  // Side face first (behind the front), as a parallelogram sheared up-right.
  f.c.polygon([
    [x + w, y],
    [x + w + depth, y - depth * 0.62],
    [x + w + depth, y + h - depth * 0.62],
    [x + w, y + h],
  ], side, { shape: 'flat', height, shade: opts.sideShade ?? 0.82 });
  // Front face, flat and lit.
  f.c.rect(x, y, w, h, base, { shape: 'flat', height });
}

/**
 * A roof cap that sits over the top edge of the (already-drawn) side face, so the
 * box reads as capped rather than open. A thin lit sliver along the top-front
 * edge sells the eave thickness.
 */
function boxTopCap(f: Frame, x: number, y: number, w: number, base: string): void {
  const depth = f.depth;
  f.c.polygon([
    [x, y],
    [x + w, y],
    [x + w + depth, y - depth * 0.62],
    [x + depth, y - depth * 0.62],
  ], shift(base, 0.06), { shape: 'flat', height: 44 });
}

/**
 * Eave shadow: a dark band painted onto the top of the wall just under the roof
 * overhang. Alpha-composited so it darkens whatever wall/timbering is beneath.
 * This one detail does more for perceived depth than anything else — it says the
 * roof physically projects out over the wall and blocks the sky light.
 */
function eaveShadow(f: Frame, x: number, y: number, w: number, band = 6): void {
  f.c.rect(x, y, w, band, '#0c0b12', { shape: 'flat', height: 39, emissive: true, alpha: 0.34 });
  f.c.rect(x, y, w, Math.max(1, Math.round(band / 3)), '#0c0b12', { shape: 'flat', height: 39, emissive: true, alpha: 0.28 });
}

/**
 * A pitched (gable) roof shown in 3/4: an upper-left lit slope and a lower-right
 * shadowed slope meeting at a ridge, plus a shadowed right gable-end so the roof
 * has thickness on the side that matches the body's side face. `overL/overR`
 * push the eaves out past the wall to create the overhang.
 */
function gableRoof(
  f: Frame,
  left: number,
  right: number,
  eaveY: number,
  ridgeY: number,
  base: string,
  opts: { overL?: number; overR?: number; ridgeShift?: number } = {},
): void {
  const overL = opts.overL ?? 10;
  const overR = opts.overR ?? 10;
  const depth = f.depth;
  const midX = (left + right) / 2 + (opts.ridgeShift ?? 0);
  const el = left - overL;
  const er = right + overR;
  // World roof colours are near-black; a plain lightness shift barely moves such
  // a dark base, so the lit slope is MIXED toward a warm moon-grey to guarantee
  // a readable fold, while the shadow slope only lifts a touch off the base.
  // This is the difference between "one dark mass" and "two planes meeting".
  const lit = mix(shift(base, 0.06, -6), '#8f8496', 0.42);
  const dark = shift(base, 0.03, 12);
  const ridgeBack = ridgeY - depth * 0.62;

  // Lower-right shadowed slope (draw first; the lit slope overlaps its ridge).
  f.c.polygon([
    [midX, ridgeY],
    [er, eaveY],
    [er + depth, eaveY - depth * 0.62],
    [midX + depth, ridgeBack],
  ], dark, { shape: 'flat', height: 48, shade: 0.9 });
  // Right gable end (the triangular thickness of the roof on the receding side)
  // — the darkest roof plane since it faces away from the light entirely.
  f.c.polygon([
    [er, eaveY],
    [er + depth, eaveY - depth * 0.62],
    [midX + depth, ridgeBack],
    [midX, ridgeY],
  ], shift(base, -0.04, 12), { shape: 'flat', height: 47, shade: 0.72 });
  // Upper-left lit slope.
  f.c.polygon([
    [el, eaveY],
    [midX, ridgeY],
    [midX + depth, ridgeBack],
    [el + depth, eaveY - depth * 0.62],
  ], lit, { shape: 'flat', height: 49 });
  // Ridge cap: a bright crest where the slopes meet, plus the shadowed hip line
  // down the right so the two planes read as genuinely folded.
  f.c.line(el + 1, eaveY - 1, midX, ridgeY - 1, shift(lit, 0.14), 2, { height: 50, emissive: true, alpha: 0.5 });
  f.c.line(midX, ridgeY, midX + depth, ridgeBack, shift(lit, 0.2), 2, { height: 51, emissive: true, alpha: 0.6 });
  f.c.line(er - 1, eaveY - 1, midX, ridgeY, '#0d0c12', 1, { height: 49, emissive: true, alpha: 0.4 });
}

/**
 * Combing / tiling / corrugation lines that run PARALLEL to a roof slope. Given
 * the eave endpoint and the ridge apex of a slope, we walk points along the eave
 * and draw short strokes toward the ridge — so texture follows the pitch instead
 * of fanning from a point (which is what read as scratches in the first pass).
 */
function slopeTexture(
  f: Frame,
  eaveA: [number, number],
  eaveB: [number, number],
  apex: [number, number],
  color: string,
  opts: { step?: number; frac?: number; alpha?: number } = {},
): void {
  const step = opts.step ?? 9;
  const frac = opts.frac ?? 0.72;
  const alpha = opts.alpha ?? 0.42;
  const span = Math.hypot(eaveB[0] - eaveA[0], eaveB[1] - eaveA[1]);
  const n = Math.max(2, Math.round(span / step));
  for (let i = 1; i < n; i += 1) {
    const t = i / n;
    const sx = eaveA[0] + (eaveB[0] - eaveA[0]) * t;
    const sy = eaveA[1] + (eaveB[1] - eaveA[1]) * t;
    // Toward the apex, but only part-way, so strokes don't collide at the ridge.
    const ex = sx + (apex[0] - sx) * frac;
    const ey = sy + (apex[1] - sy) * frac;
    f.c.line(sx, sy, ex, ey, color, 1, { height: 49, shade: 0.9, alpha });
  }
}

/**
 * A flat/battlemented roof: a parapet ring with a lit top surface, a shadowed
 * inner face (the wall-walk drops away from the light), and — for citadels — a
 * row of merlons. Reads as a solid mass with a walkable top, not a lid.
 */
function parapetRoof(f: Frame, left: number, right: number, topY: number, base: string, opts: { crenellate?: boolean; over?: number } = {}): void {
  const over = opts.over ?? 10;
  const depth = f.depth;
  const el = left - over;
  const er = right + over;
  const wallTop = shift(base, 0.08, -4);
  const inner = shift(base, -0.2, 10);
  const parapetH = Math.round(depth * 0.9);

  // Top surface of the parapet (lit), seen as a receding band.
  f.c.polygon([
    [el, topY],
    [er, topY],
    [er + depth, topY - depth * 0.62],
    [el + depth, topY - depth * 0.62],
  ], wallTop, { shape: 'flat', height: 46 });
  // Inner face dropping into the roof court (shadow).
  f.c.polygon([
    [el, topY],
    [er, topY],
    [er, topY + parapetH],
    [el, topY + parapetH],
  ], inner, { shape: 'flat', height: 44, shade: 0.72 });
  // Front lip of the parapet catching light.
  f.c.rect(el, topY + parapetH - 2, er - el, 2, shift(wallTop, 0.06), { shape: 'flat', height: 45 });

  if (opts.crenellate) {
    // Merlons standing up off the top band; each shows a lit cap and a shadowed
    // right cheek so the battlement itself has little volumes.
    const step = Math.max(20, Math.round((er - el) / 7));
    const merlonW = Math.round(step * 0.55);
    const merlonH = Math.round(depth * 0.8);
    for (let mx = el; mx <= er - merlonW; mx += step) {
      f.c.rect(mx, topY - merlonH, merlonW, merlonH, base, { shape: 'flat', height: 50 });
      f.c.polygon([
        [mx + merlonW, topY - merlonH],
        [mx + merlonW + depth * 0.5, topY - merlonH - depth * 0.31],
        [mx + merlonW + depth * 0.5, topY - depth * 0.31],
        [mx + merlonW, topY],
      ], shift(base, -0.16, 8), { shape: 'flat', height: 50, shade: 0.8 });
      f.c.polygon([
        [mx, topY - merlonH],
        [mx + merlonW, topY - merlonH],
        [mx + merlonW + depth * 0.5, topY - merlonH - depth * 0.31],
        [mx + depth * 0.5, topY - merlonH - depth * 0.31],
      ], wallTop, { shape: 'flat', height: 51 });
    }
  }
}

/**
 * A recessed window: a dark inset (the opening in shadow) framed by a jamb, with
 * a lit sill jutting below and a lit top-left jamb — the recess and the sill
 * lip are what read as depth. Optionally emissive (lit from within at night).
 */
function window(f: Frame, x: number, y: number, w: number, h: number, glass: string, opts: { emissive?: boolean; arch?: boolean; mullion?: boolean } = {}): void {
  const frame = shift(f.wall, -0.16, 6);
  const frameLit = shift(f.wall, 0.1);
  // Jamb block behind everything.
  f.c.rect(x - 2, y - 2, w + 4, h + 4, frame, { shape: 'flat', height: 38 });
  // The glass/opening, recessed (pre-darkened via shade unless it's glowing).
  if (opts.emissive) {
    f.c.rect(x, y, w, h, glass, { shape: 'flat', height: 36, emissive: true });
    // Warm spill onto the sill and a soft halo.
    f.c.ellipse(x + w / 2, y + h + 2, w * 0.7, 3, glass, { shape: 'flat', height: 36, emissive: true, alpha: 0.3 });
  } else {
    f.c.rect(x, y, w, h, glass, { shape: 'flat', height: 36, shade: 0.62 });
    // A cool sky glint in the upper-left corner of the pane.
    f.c.rect(x + 1, y + 1, Math.max(1, w - 4), Math.max(1, Math.round(h * 0.35)), shift(glass, 0.14), { shape: 'flat', height: 36, shade: 0.85, alpha: 0.6 });
  }
  if (opts.arch) {
    // Round the top: a dark half-disc opening + a frame arc above.
    f.c.ellipse(x + w / 2, y, w / 2, w / 2, opts.emissive ? glass : shift(glass, -0.06), { shape: 'flat', height: 36, emissive: opts.emissive, shade: opts.emissive ? 1 : 0.6 });
    f.c.ellipse(x + w / 2, y, w / 2 + 2, w / 2 + 2, frame, { shape: 'flat', height: 37, alpha: 0.0 });
  }
  if (opts.mullion) {
    f.c.rect(x + Math.round(w / 2), y, 1, h, frame, { shape: 'flat', height: 37 });
    f.c.rect(x, y + Math.round(h / 2), w, 1, frame, { shape: 'flat', height: 37 });
  }
  // Lit top-left jamb edge (light catches the near side of the reveal).
  f.c.rect(x - 2, y - 2, 1, h + 3, frameLit, { shape: 'flat', height: 39 });
  f.c.rect(x - 2, y - 2, w + 3, 1, frameLit, { shape: 'flat', height: 39 });
  // Sill: a lit lip that projects below the opening.
  f.c.rect(x - 3, y + h + 1, w + 6, 2, shift(f.wall, 0.12), { shape: 'flat', height: 40 });
  f.c.rect(x - 3, y + h + 3, w + 6, 1, shift(f.wall, -0.1), { shape: 'flat', height: 39, shade: 0.8 });
}

/**
 * A doorway: a recessed dark opening with a thick frame (visible jamb on the lit
 * side), a lintel, and a small handle. Sits at the wall's bottom edge, centred
 * on `doorCx`. Returns nothing — purely decorative; collision is WorldScene's.
 */
function doorway(f: Frame, opts: { w?: number; h?: number; arched?: boolean; interiorHint?: boolean } = {}): void {
  const dw = opts.w ?? 42;
  const dh = opts.h ?? 54;
  const x = Math.round(f.doorCx - dw / 2);
  const y = f.bottom - dh;
  const frame = shift(f.wall, -0.2, 6);
  const frameLit = shift(f.wall, 0.12);
  // Frame slab.
  f.c.rect(x - 4, y - 4, dw + 8, dh + 4, frame, { shape: 'flat', height: 41 });
  // Recessed opening — very dark, warm hint if it leads inside.
  const inside = opts.interiorHint ? mix('#191016', '#3a2418', 0.4) : '#141019';
  f.c.rect(x, y, dw, dh, inside, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
  if (opts.arched) {
    f.c.ellipse(x + dw / 2, y, dw / 2, dw / 2, frame, { shape: 'flat', height: 41 });
    f.c.ellipse(x + dw / 2, y + 1, dw / 2 - 3, dw / 2 - 3, inside, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
  }
  // Lit left jamb + lintel top-left (near side of the reveal).
  f.c.rect(x - 4, y - 4, 2, dh + 4, frameLit, { shape: 'flat', height: 42 });
  f.c.rect(x - 4, y - 4, dw + 8, 2, frameLit, { shape: 'flat', height: 42 });
  // Shadowed right jamb.
  f.c.rect(x + dw + 1, y - 4, 2, dh + 4, shift(f.wall, -0.28, 8), { shape: 'flat', height: 41, shade: 0.7 });
  // Handle / ring.
  f.c.circle(x + dw - 6, y + dh * 0.55, 2, opts.interiorHint ? '#e2b45f' : '#8a8189', { shape: 'round', height: 36 });
}

/** Cast shadow on the ground, thrown down and slightly right of the footprint. */
function castShadow(f: Frame, opts: { spread?: number } = {}): void {
  const spread = opts.spread ?? 1;
  const cx = f.cx + f.w * 0.06;
  const cy = f.bottom + Math.round(f.h * 0.06);
  f.c.groundShadow(cx, cy, (f.w / 2 + f.depth) * 0.98 * spread, Math.max(10, f.h * 0.12) * spread, 0.4);
}

/** Faint horizontal courses to break up a large stone/plaster wall. */
function courses(f: Frame, x: number, y: number, w: number, h: number, step: number, tint = -0.08): void {
  for (let cy = y + step; cy < y + h; cy += step) {
    f.c.rect(x, cy, w, 1, shift(f.wall, tint, 4), { shape: 'flat', height: 40, shade: 0.9, alpha: 0.5 });
  }
}

// ---------------------------------------------------------------------------
// Per-style builders
// ---------------------------------------------------------------------------

/** home — modest stone cottage, thatch roof, small chimney. */
function buildHome(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f);
  const wallH = f.h;

  // Chimney on the far (right) side, drawn before the body so the roof overlaps.
  const chimX = f.right - Math.round(f.w * 0.2);
  const roofPeakY = f.top - Math.round(wallH * 0.42);
  f.c.rect(chimX, roofPeakY - 14, 12, 24, shift(f.wall, -0.06, 6), { shape: 'flat', height: 52 });
  boxTopCap(f, chimX, roofPeakY - 14, 12, shift(f.wall, -0.06, 6));
  f.c.rect(chimX - 1, roofPeakY - 15, 14, 2, shift(f.wall, 0.1), { shape: 'flat', height: 53 });

  boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
  courses(f, f.left, f.top, f.w, wallH, 16);

  // Thatch roof: gable with a warm, coarse straw colour derived from the roof int.
  const thatch = mix(f.roof, '#8a7043', 0.35);
  const eaveY = f.top + Math.round(wallH * 0.06);
  gableRoof(f, f.left, f.right, eaveY, roofPeakY, thatch, { overL: 11, overR: 11 });
  // Thatch combing on the lit slope, following the pitch (eave → ridge).
  slopeTexture(f, [f.left - 11, eaveY], [f.cx, roofPeakY], [f.cx, roofPeakY], shift(thatch, -0.12, 4), { step: 8, frac: 0.5, alpha: 0.4 });
  slopeTexture(f, [f.cx, roofPeakY], [f.right + 11, eaveY], [f.cx, roofPeakY], shift(thatch, -0.16, 6), { step: 9, frac: 0.5, alpha: 0.35 });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);

  // One window each side of the door, and the door.
  doorway(f, { interiorHint: true });
  const winY = f.top + Math.round(wallH * 0.42);
  const winW = Math.round(f.w * 0.16);
  window(f, f.left + Math.round(f.w * 0.14), winY, winW, Math.round(winW * 0.9), '#7fa2a8', { mullion: true });
  if (Math.abs(f.right - Math.round(f.w * 0.14) - winW - f.doorCx) > winW + 20) {
    window(f, f.right - Math.round(f.w * 0.14) - winW, winY, winW, Math.round(winW * 0.9), '#7fa2a8', { mullion: true });
  }

  finish(f.c);
  return f.c;
}

/** inn — two storeys, hanging sign bracket, warm lit windows, larger. */
function buildInn(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f);
  const wallH = f.h;
  const floorY = f.top + Math.round(wallH * 0.46); // storey division

  boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 42 });

  // Upper storey jetty: the top floor oversails the lower by a couple px, a
  // classic timber-frame inn silhouette, with a shadow beneath the overhang.
  f.c.rect(f.left - 3, floorY, f.w + 3, 4, shift(f.wall, 0.06), { shape: 'flat', height: 43 });
  f.c.rect(f.left - 3, floorY + 4, f.w + 3, 3, '#0c0b12', { shape: 'flat', height: 42, emissive: true, alpha: 0.3 });
  // A couple of exposed horizontal beams.
  f.c.rect(f.left, f.top + Math.round(wallH * 0.2), f.w, 2, shift(mix(f.wall, '#4a3324', 0.5), -0.04), { shape: 'flat', height: 41 });

  // Steep pitched roof (inns read tall).
  const ridgeY = f.top - Math.round(wallH * 0.34);
  const eaveY = f.top + Math.round(wallH * 0.04);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);

  // Warm lit windows — this is what makes the inn feel occupied at night.
  const warm = '#f2b45a';
  const lowY = f.top + Math.round(wallH * 0.62);
  const upY = f.top + Math.round(wallH * 0.18);
  const winW = Math.round(f.w * 0.16);
  const winH = Math.round(winW * 1.05);
  const cols = [f.left + Math.round(f.w * 0.13), f.cx - winW / 2, f.right - Math.round(f.w * 0.13) - winW];
  for (const wxp of cols) {
    window(f, Math.round(wxp), upY, winW, winH, warm, { emissive: true, mullion: true });
    // lower-storey windows skip where the door is.
    if (Math.abs(wxp + winW / 2 - f.doorCx) > winW + 16) {
      window(f, Math.round(wxp), lowY, winW, Math.round(winH * 0.8), warm, { emissive: true, mullion: true });
    }
  }

  doorway(f, { w: 46, interiorHint: true });

  // Hanging sign bracket projecting from the front-left, with a swinging board.
  const bx = f.left + 6;
  const by = floorY - 6;
  f.c.rect(bx, by, 20, 2, shift(MATERIAL_IRON, -0.02), { shape: 'cylinder-x', height: 44, curve: 0.8 });
  f.c.rect(bx, by, 2, 8, shift(MATERIAL_IRON, -0.06), { shape: 'cylinder-y', height: 44 });
  f.c.line(bx + 18, by + 2, bx + 18, by + 8, '#2a2530', 1, { height: 43 });
  const sign = mix(f.roof, '#6b4a30', 0.5);
  f.c.rect(bx + 12, by + 8, 16, 12, sign, { shape: 'flat', height: 42 });
  f.c.rect(bx + 12, by + 8, 16, 12, shift(sign, 0.0), { shape: 'flat', height: 42, alpha: 0 });
  f.c.rect(bx + 12, by + 8, 1, 12, shift(sign, 0.14), { shape: 'flat', height: 43 });
  f.c.circle(bx + 20, by + 14, 2, warm, { shape: 'round', height: 43, emissive: true, alpha: 0.9 });

  finish(f.c);
  return f.c;
}

/** forge — stone base, glowing forge-mouth, tall smoke-stained chimney. */
function buildForge(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f);
  const wallH = f.h;

  // Tall chimney on the right, drawn first with a smoke plume rising above it.
  const chimX = f.right - Math.round(f.w * 0.22);
  const chimW = Math.round(f.w * 0.13);
  const chimTop = f.top - Math.round(wallH * 0.5);
  // Smoke: soft grey puffs fading upward (emissive so they don't get lit as solids).
  for (let i = 0; i < 4; i += 1) {
    const t = i / 3;
    f.c.ellipse(chimX + chimW / 2 + i * 3, chimTop - 6 - i * 9, 5 + i * 2, 4 + i * 1.5, mix('#3a363f', '#1c1a22', 0.4), { shape: 'flat', emissive: true, alpha: 0.32 - t * 0.16 });
  }
  const chimStone = shift(f.wall, -0.02, 4);
  f.c.rect(chimX, chimTop, chimW, f.top - chimTop + 18, chimStone, { shape: 'flat', height: 52 });
  boxTopCap(f, chimX, chimTop, chimW, chimStone);
  // Soot staining down the chimney front.
  f.c.rect(chimX + 2, chimTop + 4, chimW - 4, Math.round(wallH * 0.3), '#171319', { shape: 'flat', height: 52, emissive: true, alpha: 0.28 });
  f.c.rect(chimX - 1, chimTop - 1, chimW + 2, 2, shift(chimStone, 0.1), { shape: 'flat', height: 53 });

  boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
  courses(f, f.left, f.top, f.w, wallH, 14, -0.1); // stone coursing

  // Low-pitched roof.
  const ridgeY = f.top - Math.round(wallH * 0.24);
  const eaveY = f.top + Math.round(wallH * 0.06);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12, ridgeShift: -Math.round(f.w * 0.04) });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);

  // The open forge-mouth: a big arched opening glowing orange, off to one side of
  // the door. This is the signature — emissive so it lights the night.
  const mouthW = Math.round(f.w * 0.26);
  const mouthH = Math.round(wallH * 0.34);
  const mouthX = f.left + Math.round(f.w * 0.1);
  const my = f.bottom - mouthH - 4;
  f.c.rect(mouthX - 3, my - 3, mouthW + 6, mouthH + 3, shift(f.wall, -0.22, 6), { shape: 'flat', height: 41 }); // stone surround
  f.c.ellipse(mouthX + mouthW / 2, my, mouthW / 2 + 3, mouthW / 2 + 3, shift(f.wall, -0.22, 6), { shape: 'flat', height: 41 });
  // Glow gradient: deep ember at the edges to hot yellow-white in the throat.
  f.c.rect(mouthX, my, mouthW, mouthH, '#e2582c', { shape: 'flat', height: 34, emissive: true });
  f.c.ellipse(mouthX + mouthW / 2, my, mouthW / 2, mouthW / 2, '#e2582c', { shape: 'flat', height: 34, emissive: true });
  f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.5, mouthW * 0.34, mouthH * 0.4, '#ff8a45', { shape: 'flat', height: 34, emissive: true });
  f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.55, mouthW * 0.18, mouthH * 0.25, '#ffd27a', { shape: 'flat', height: 34, emissive: true, alpha: 0.95 });
  // Warm halo spilling onto the surrounding stone.
  f.c.ellipse(mouthX + mouthW / 2, my + mouthH * 0.4, mouthW * 0.9, mouthH * 0.9, '#ff8a45', { shape: 'flat', height: 35, emissive: true, alpha: 0.14 });

  doorway(f, { w: 44, interiorHint: true });
  // A small lit window high up, catching forge-light.
  const winW = Math.round(f.w * 0.14);
  window(f, f.right - Math.round(f.w * 0.2) - winW, f.top + Math.round(wallH * 0.3), winW, Math.round(winW * 0.8), '#ff9a52', { emissive: true, mullion: true });

  finish(f.c);
  return f.c;
}

/** cottage — timber-framed Tudor: plaster panels between dark cross-beams. */
function buildCottage(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f);
  const wallH = f.h;

  // Plaster body (lighten the wall toward off-white daub between the timbers).
  const plaster = mix(f.wall, '#d8c9a6', 0.45);
  boxBody(f, f.left, f.top, f.w, wallH, plaster, { height: 38 });

  // Dark oak framing: sill, mid-rail, corner posts, top plate, and the
  // characteristic diagonal braces. Drawn as slightly proud beams (small height
  // bump) so the lighting pass gives them a faint edge over the plaster.
  const beam = mix(f.wall, '#3a2718', 0.66);
  const beamLit = shift(beam, 0.08);
  const post = 4;
  const drawBeamH = (x: number, y: number, w: number, t = post) => {
    f.c.rect(x, y, w, t, beam, { shape: 'flat', height: 41 });
    f.c.rect(x, y, w, 1, beamLit, { shape: 'flat', height: 42 });
  };
  const drawBeamV = (x: number, y: number, h: number, t = post) => {
    f.c.rect(x, y, t, h, beam, { shape: 'flat', height: 41 });
    f.c.rect(x, y, 1, h, beamLit, { shape: 'flat', height: 42 });
  };
  const midY = f.top + Math.round(wallH * 0.5);
  drawBeamH(f.left, f.top, f.w);                       // top plate
  drawBeamH(f.left, midY, f.w);                        // mid rail
  drawBeamH(f.left, f.bottom - post, f.w);             // sill
  drawBeamV(f.left, f.top, wallH);                     // left post
  drawBeamV(f.right - post, f.top, wallH);             // right post
  // A couple of studs + herringbone braces in the upper panels.
  const studs = 3;
  for (let s = 1; s <= studs; s += 1) {
    const sx = f.left + Math.round((f.w * s) / (studs + 1));
    drawBeamV(sx, f.top, midY - f.top, 3);
  }
  // Diagonal braces bottom corners → centre (Tudor look).
  f.c.line(f.left + post, f.bottom - post, f.left + Math.round(f.w * 0.28), midY + post, beam, 3, { height: 41 });
  f.c.line(f.right - post, f.bottom - post, f.right - Math.round(f.w * 0.28), midY + post, beam, 3, { height: 41 });

  // Steep thatch/tile gable.
  const ridgeY = f.top - Math.round(wallH * 0.4);
  const eaveY = f.top + Math.round(wallH * 0.02);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 10, overR: 10 });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);
  // Front gable pediment (plaster triangle with a king-post) above the eaves.
  f.c.polygon([[f.left + 2, eaveY], [f.cx, ridgeY + 3], [f.right - 2, eaveY]], plaster, { shape: 'flat', height: 43 });
  f.c.line(f.cx, ridgeY + 3, f.cx, eaveY, beam, 2, { height: 44 });
  f.c.line(f.left + 4, eaveY, f.cx, ridgeY + 4, beam, 2, { height: 44 });
  f.c.line(f.right - 4, eaveY, f.cx, ridgeY + 4, beam, 2, { height: 44 });

  doorway(f, { w: 38, h: 48, interiorHint: true });
  // Small leaded windows in the panels.
  const winW = Math.round(f.w * 0.17);
  const winY = f.top + Math.round(wallH * 0.62);
  const lx = f.left + Math.round(f.w * 0.12);
  const rx = f.right - Math.round(f.w * 0.12) - winW;
  if (Math.abs(lx + winW / 2 - f.doorCx) > winW + 14) window(f, lx, winY, winW, Math.round(winW * 0.75), '#88a6ab', { mullion: true });
  if (Math.abs(rx + winW / 2 - f.doorCx) > winW + 14) window(f, rx, winY, winW, Math.round(winW * 0.75), '#88a6ab', { mullion: true });

  finish(f.c);
  return f.c;
}

/** chapel — tall stone nave, steep pitched roof, bell tower with a spire. */
function buildChapel(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f, { spread: 1.05 });
  const wallH = f.h;

  boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 42 });
  courses(f, f.left, f.top, f.w, wallH, 15, -0.09);

  // Steep nave roof.
  const ridgeY = f.top - Math.round(wallH * 0.42);
  const eaveY = f.top + Math.round(wallH * 0.03);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
  // Nave pediment (stone gable) with a round rose window.
  f.c.polygon([[f.left + 2, eaveY], [f.cx, ridgeY + 2], [f.right - 2, eaveY]], f.wall, { shape: 'flat', height: 43 });
  const roseY = eaveY - Math.round((eaveY - ridgeY) * 0.42);
  f.c.circle(f.cx, roseY, 7, shift(f.wall, -0.2, 6), { shape: 'flat', height: 44 });
  f.c.circle(f.cx, roseY, 5, mix('#9b88be', '#2a2436', 0.2), { shape: 'flat', height: 44, emissive: true, alpha: 0.9 });
  f.c.circle(f.cx, roseY, 2, '#d8ccf0', { shape: 'flat', height: 44, emissive: true });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);

  // Bell tower rising off the front-left corner, taller than the nave, capped by
  // a pyramidal spire. Its own two-face body keeps the 3/4 read consistent.
  const towW = Math.round(f.w * 0.3);
  const towX = f.left + Math.round(f.w * 0.04);
  const towTopY = f.top - Math.round(wallH * 0.7);
  boxBody(f, towX, towTopY, towW, f.bottom - towTopY, shift(f.wall, 0.02, -2), { height: 54 });
  courses(f, towX, towTopY, towW, f.bottom - towTopY, 14, -0.09);
  // Belfry: a dark arched opening near the top with a hanging bell.
  const belfryW = Math.round(towW * 0.5);
  const belfryX = towX + Math.round((towW - belfryW) / 2);
  const belfryY = towTopY + Math.round(towW * 0.5);
  f.c.rect(belfryX, belfryY, belfryW, Math.round(towW * 0.6), '#14111a', { shape: 'flat', height: 50, emissive: true, alpha: 0.95 });
  f.c.ellipse(belfryX + belfryW / 2, belfryY, belfryW / 2, belfryW / 2, '#14111a', { shape: 'flat', height: 50, emissive: true, alpha: 0.95 });
  f.c.ellipse(belfryX + belfryW / 2, belfryY + Math.round(towW * 0.28), belfryW * 0.32, belfryW * 0.4, mix(MATERIAL_BRONZE, '#000', 0.1), { shape: 'dome', height: 51, curve: 0.9 });
  f.c.ellipse(belfryX + belfryW / 2 - 1, belfryY + Math.round(towW * 0.22), belfryW * 0.16, belfryW * 0.18, shift(MATERIAL_BRONZE, 0.14), { shape: 'dome', height: 52, curve: 0.9 });
  // Spire: an overhanging pyramidal cap split down the middle into a lit left
  // face and a shadowed right face, so it reads as a true four-sided pyramid
  // seen slightly from the side (not a flat triangle). Same lit/dark scheme as
  // the pitched roofs. A slim finial cross tops it.
  const apexX = towX + towW / 2;
  const spireApexY = towTopY - Math.round(towW * 1.2);
  const sl = towX - 4; // eaves overhang the tower on both sides
  const sr = towX + towW + 4;
  const spireLit = mix(shift(f.roof, 0.06, -6), '#8f8496', 0.4);
  const spireDark = shift(f.roof, -0.02, 12);
  // Right (shadow) face: base right-half up to the apex.
  f.c.polygon([[apexX, towTopY], [sr, towTopY], [apexX, spireApexY]], spireDark, { shape: 'flat', height: 55, shade: 0.82 });
  // Left (lit) face: base left-half up to the apex.
  f.c.polygon([[sl, towTopY], [apexX, towTopY], [apexX, spireApexY]], spireLit, { shape: 'flat', height: 56 });
  // Bright arris (the near vertical edge of the pyramid) + a dark eaves line.
  f.c.line(apexX, towTopY, apexX, spireApexY, shift(spireLit, 0.16), 1, { height: 57, emissive: true, alpha: 0.6 });
  f.c.line(sl, towTopY, sr, towTopY, '#0d0c12', 1, { height: 55, emissive: true, alpha: 0.4 });
  // Finial cross.
  f.c.rect(apexX - 1, spireApexY - 9, 2, 9, MATERIAL_BONE, { shape: 'flat', height: 58 });
  f.c.rect(apexX - 3, spireApexY - 6, 7, 2, MATERIAL_BONE, { shape: 'flat', height: 58 });

  // Arched windows down the nave, cool stained glass.
  const winW = Math.round(f.w * 0.12);
  const winH = Math.round(wallH * 0.4);
  const winY = f.top + Math.round(wallH * 0.4);
  const naveCols = [f.cx + Math.round(f.w * 0.02), f.right - Math.round(f.w * 0.16)];
  for (const wxp of naveCols) {
    if (Math.abs(wxp + winW / 2 - f.doorCx) < winW + 14) continue;
    window(f, Math.round(wxp), winY, winW, winH, mix('#9b88be', '#3a2f52', 0.3), { arch: true, emissive: true, mullion: true });
  }

  // Arched double door at the base of the tower / nave front.
  doorway(f, { w: 44, h: 58, arched: true, interiorHint: true });

  finish(f.c);
  return f.c;
}

/** marsh — stilted plank hut, sagging thatch, hanging nets over black water. */
function buildMarsh(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  const wallH = f.h;
  // The hut is raised on stilts; the visible plank box is the UPPER ~68% of h,
  // the lower band is open piling above the water. Collision still uses full h.
  const floorLift = Math.round(wallH * 0.3);
  const hutTop = f.top;
  const hutH = wallH - floorLift;
  const hutBottom = hutTop + hutH;

  // Cast shadow lands under the raised hut, faint on the water.
  f.c.groundShadow(f.cx + f.w * 0.05, f.bottom + 2, f.w * 0.5, Math.max(8, f.h * 0.1), 0.32);

  // A dark strip of bog water the stilts stand in, so the raised floor reads.
  f.c.ellipse(f.cx, f.bottom, f.w * 0.52, Math.max(5, f.h * 0.06), mix('#1b2b2a', '#0d1613', 0.4), { shape: 'flat', height: 0, emissive: true, alpha: 0.7 });

  // Stilts: legible posts of paler driftwood so they don't melt into the hut,
  // as cylinders (side-lit) with a receding partner behind each front post.
  const wood = mix(f.wall, '#4a3a2a', 0.5);
  const stiltWood = mix(wood, '#9a8763', 0.35); // catches moonlight, stands out
  const stiltXs = [f.left + 10, f.cx - 3, f.right - 18];
  for (const sx of stiltXs) {
    // Receding partner first (behind + up-right, darker).
    f.c.rect(sx + f.depth * 0.5, hutBottom - 2 - f.depth * 0.31, 5, floorLift + 4, shift(stiltWood, -0.18, 8), { shape: 'cylinder-y', height: 26, curve: 0.85, shade: 0.7 });
    // Front post.
    f.c.rect(sx, hutBottom - 2, 7, floorLift + 6, stiltWood, { shape: 'cylinder-y', height: 30, curve: 0.9 });
    // A lashed collar where it meets the deck.
    f.c.rect(sx - 1, hutBottom - 1, 9, 2, shift(MATERIAL_BRONZE, -0.1), { shape: 'cylinder-x', height: 31, curve: 0.8 });
  }
  // Cross-bracing between stilts.
  f.c.line(f.left + 13, hutBottom + 6, f.cx, f.bottom - 3, shift(stiltWood, -0.12), 2, { height: 28 });
  f.c.line(f.right - 15, hutBottom + 6, f.cx + 3, f.bottom - 3, shift(stiltWood, -0.12), 2, { height: 28 });

  // Plank-walled hut body.
  boxBody(f, f.left, hutTop, f.w, hutH, wood, { height: 38 });
  // Deep shadow on the hut underside (the floor overhangs the open piling).
  f.c.rect(f.left, hutBottom, f.w, 4, '#0a0f0e', { shape: 'flat', height: 37, emissive: true, alpha: 0.4 });
  // Vertical plank seams + a couple of warped/leaning planks.
  for (let px = f.left + 6; px < f.right - 2; px += 8) {
    const warp = ((px * 7) % 3) - 1;
    f.c.rect(px + warp, hutTop, 1, hutH, shift(wood, -0.14, 6), { shape: 'flat', height: 38, shade: 0.85, alpha: 0.7 });
  }
  // Ledge/deck lip at the hut floor.
  f.c.rect(f.left - 2, hutBottom - 3, f.w + 4, 3, shift(wood, 0.08), { shape: 'flat', height: 39 });

  // Sagging thatch roof — a shallow gable pulled down at the eaves for a droop.
  const ridgeY = hutTop - Math.round(hutH * 0.34);
  const eaveY = hutTop + Math.round(hutH * 0.02);
  const thatch = mix(f.roof, '#6b5836', 0.4);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, thatch, { overL: 13, overR: 13, ridgeShift: Math.round(f.w * 0.05) });
  // Droop: darker sagging fringe hanging below the eave line.
  for (let dx = f.left - 8; dx < f.right + 8; dx += 6) {
    const sag = 3 + (((dx * 5) % 4));
    f.c.rect(dx, eaveY, 3, sag, shift(thatch, -0.12, 6), { shape: 'flat', height: 47, shade: 0.85 });
  }
  eaveShadow(f, f.left, eaveY + 1, f.w, 5);

  // A hanging fishing net on the front-right, and a small dark window.
  const netX = f.right - Math.round(f.w * 0.26);
  const netY = hutTop + Math.round(hutH * 0.34);
  const netW = Math.round(f.w * 0.2);
  const netH = Math.round(hutH * 0.5);
  for (let gy = 0; gy <= netH; gy += 5) f.c.line(netX, netY + gy, netX + netW, netY + gy + 3, mix(wood, '#c9bd9a', 0.5), 1, { height: 40, alpha: 0.5 });
  for (let gx = 0; gx <= netW; gx += 5) f.c.line(netX + gx, netY, netX + gx + 3, netY + netH, mix(wood, '#c9bd9a', 0.5), 1, { height: 40, alpha: 0.5 });
  // A couple of net floats.
  f.c.circle(netX + 4, netY + netH - 2, 2, mix(MATERIAL_BRONZE, wood, 0.3), { shape: 'round', height: 41 });

  doorway(f, { w: 36, h: Math.round(hutH * 0.7), interiorHint: true });
  const winW = Math.round(f.w * 0.14);
  window(f, f.left + Math.round(f.w * 0.14), netY, winW, Math.round(winW * 0.9), mix('#73c69d', '#1f2b27', 0.3), { emissive: true, mullion: true });

  finish(f.c);
  return f.c;
}

/** warehouse — long low store, big double doors, planked roof, loading bay. */
function buildWarehouse(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f);
  const wallH = f.h;

  boxBody(f, f.left, f.top, f.w, wallH, f.wall, { height: 40 });
  // Horizontal plank siding.
  for (let py = f.top + 8; py < f.bottom - 2; py += 9) {
    f.c.rect(f.left, py, f.w, 1, shift(f.wall, -0.1, 4), { shape: 'flat', height: 40, shade: 0.9, alpha: 0.6 });
  }
  // Corner posts + a mid post for a timber-store look.
  for (const px of [f.left, f.cx - 2, f.right - 4]) {
    f.c.rect(px, f.top, 4, wallH, mix(f.wall, '#3a2b1e', 0.5), { shape: 'flat', height: 41 });
    f.c.rect(px, f.top, 1, wallH, shift(mix(f.wall, '#3a2b1e', 0.5), 0.08), { shape: 'flat', height: 42 });
  }

  // Shallow planked roof with a slight pitch (low, wide building).
  const ridgeY = f.top - Math.round(wallH * 0.2);
  const eaveY = f.top + Math.round(wallH * 0.02);
  gableRoof(f, f.left, f.right, eaveY, ridgeY, f.roof, { overL: 12, overR: 12 });
  // Corrugation: ribs running up-slope, lit ribs on the left, faint on the right.
  slopeTexture(f, [f.left - 12, eaveY], [f.cx, ridgeY], [f.cx, ridgeY], shift(f.roof, 0.1, -4), { step: 7, frac: 0.85, alpha: 0.45 });
  slopeTexture(f, [f.cx, ridgeY], [f.right + 12, eaveY], [f.cx, ridgeY], shift(f.roof, -0.12, 6), { step: 7, frac: 0.85, alpha: 0.4 });
  eaveShadow(f, f.left, eaveY - 1, f.w, 6);

  // Big double loading doors centred on doorCx, with plank battens + a beam over.
  const dw = Math.round(Math.min(f.w * 0.42, 90));
  const dh = Math.round(wallH * 0.66);
  const dx = Math.round(f.doorCx - dw / 2);
  const dy = f.bottom - dh;
  f.c.rect(dx - 4, dy - 6, dw + 8, dh + 6, mix(f.wall, '#3a2b1e', 0.55), { shape: 'flat', height: 41 }); // frame
  f.c.rect(dx - 6, dy - 8, dw + 12, 5, mix(f.wall, '#2f2216', 0.6), { shape: 'flat', height: 44 });       // lintel beam
  const doorWood = mix(f.roof, '#5a4126', 0.5);
  f.c.rect(dx, dy, dw, dh, doorWood, { shape: 'flat', height: 37 });
  // Split down the middle + Z-braces on each leaf.
  f.c.rect(dx + Math.round(dw / 2) - 1, dy, 2, dh, '#161119', { shape: 'flat', height: 37, emissive: true, alpha: 0.8 });
  const brace = shift(doorWood, -0.12);
  f.c.line(dx + 3, dy + dh - 3, dx + dw / 2 - 3, dy + 3, brace, 2, { height: 38 });
  f.c.line(dx + dw / 2 + 3, dy + dh - 3, dx + dw - 3, dy + 3, brace, 2, { height: 38 });
  for (let by = dy + 6; by < dy + dh; by += 10) f.c.rect(dx, by, dw, 1, brace, { shape: 'flat', height: 38, alpha: 0.5 });
  // Loading-bay platform lip at the base.
  f.c.rect(dx - 8, f.bottom - 4, dw + 16, 5, shift(f.wall, 0.06), { shape: 'flat', height: 30 });
  f.c.rect(dx - 8, f.bottom + 1, dw + 16, 2, '#0c0b12', { shape: 'flat', height: 29, emissive: true, alpha: 0.3 });
  // A hoist beam + pulley projecting from the gable peak.
  f.c.rect(f.cx - 2, ridgeY - 2, Math.round(f.w * 0.14), 3, mix(f.wall, '#2f2216', 0.6), { shape: 'cylinder-x', height: 50, curve: 0.8 });
  f.c.circle(f.cx + Math.round(f.w * 0.12), ridgeY + 2, 3, MATERIAL_IRON, { shape: 'round', height: 50 });
  f.c.line(f.cx + Math.round(f.w * 0.12), ridgeY + 4, f.cx + Math.round(f.w * 0.12), ridgeY + 14, '#2a2530', 1, { height: 49 });

  // A couple of small dark windows high on the gable.
  const winW = Math.round(f.w * 0.1);
  window(f, f.left + Math.round(f.w * 0.1), f.top + Math.round(wallH * 0.2), winW, Math.round(winW * 0.8), '#7c9ba5', { mullion: true });
  window(f, f.right - Math.round(f.w * 0.1) - winW, f.top + Math.round(wallH * 0.2), winW, Math.round(winW * 0.8), '#7c9ba5', { mullion: true });

  finish(f.c);
  return f.c;
}

/** citadel — massive fortified gatehouse: crenellations, portcullis, banners. */
function buildCitadel(spec: BuildingRenderSpec): PixelCanvas {
  const f = makeFrame(spec);
  castShadow(f, { spread: 1.08 });
  const wallH = f.h;
  // Red-tinted fortress stone.
  const stone = mix(f.wall, '#5a3e42', 0.35);

  // Two flanking drum-ish towers + a central curtain, all one silhouette. We
  // draw the central block then push the towers slightly proud on each side and
  // a touch taller, each with its own crenellated top.
  const towW = Math.round(f.w * 0.24);
  const centerL = f.left + towW;
  const centerR = f.right - towW;

  // Central curtain body.
  boxBody(f, centerL, f.top + Math.round(wallH * 0.06), centerR - centerL, wallH - Math.round(wallH * 0.06), stone, { height: 44 });
  // Flanking towers (drawn after so they sit in front at the corners).
  const towTopY = f.top - Math.round(wallH * 0.02);
  boxBody(f, f.left, towTopY, towW, f.bottom - towTopY, shift(stone, 0.03, -2), { height: 50 });
  boxBody(f, f.right - towW, towTopY, towW, f.bottom - towTopY, shift(stone, -0.02, 2), { height: 48 });

  // Heavy coursed masonry.
  courses(f, f.left, f.top, f.w, wallH, 13, -0.1);

  // Crenellated tops: central parapet lower, tower parapets higher.
  parapetRoof(f, centerL, centerR, f.top + Math.round(wallH * 0.06), stone, { crenellate: true, over: 6 });
  parapetRoof(f, f.left, f.left + towW, towTopY, shift(stone, 0.03, -2), { crenellate: true, over: 5 });
  parapetRoof(f, f.right - towW, f.right, towTopY, shift(stone, -0.02, 2), { crenellate: true, over: 5 });

  // Machicolation shadow band under the central parapet (projecting battlement).
  eaveShadow(f, centerL - 4, f.top + Math.round(wallH * 0.06) + Math.round(f.depth * 0.9), centerR - centerL + 8, 5);

  // The great arched gate with a portcullis, centred on doorCx.
  const gw = Math.round(Math.min((centerR - centerL) * 0.72, f.w * 0.3));
  const gh = Math.round(wallH * 0.62);
  const gx = Math.round(f.doorCx - gw / 2);
  const gy = f.bottom - gh;
  // Recessed gate arch surround.
  f.c.rect(gx - 5, gy - 4, gw + 10, gh + 4, shift(stone, -0.16, 6), { shape: 'flat', height: 45 });
  f.c.ellipse(gx + gw / 2, gy, gw / 2 + 5, gw / 2 + 5, shift(stone, -0.16, 6), { shape: 'flat', height: 45 });
  // Dark throat.
  const throat = mix('#170f14', '#3a1a1a', 0.3);
  f.c.rect(gx, gy, gw, gh, throat, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
  f.c.ellipse(gx + gw / 2, gy, gw / 2, gw / 2, throat, { shape: 'flat', height: 34, emissive: true, alpha: 0.98 });
  // Portcullis grid (iron bars catching a cold edge), hanging in the arch.
  const bar = MATERIAL_IRON;
  for (let vx = gx + 4; vx < gx + gw; vx += 7) f.c.rect(vx, gy - Math.round(gw * 0.1), 2, Math.round(gh * 0.62), shift(bar, -0.04), { shape: 'cylinder-y', height: 35, curve: 0.8 });
  for (let hy = gy + 6; hy < gy + Math.round(gh * 0.55); hy += 9) f.c.rect(gx + 3, hy, gw - 6, 2, bar, { shape: 'cylinder-x', height: 35, curve: 0.8 });
  // Spiked bottom of the portcullis.
  for (let vx = gx + 4; vx < gx + gw; vx += 7) f.c.polygon([[vx, gy + Math.round(gh * 0.52)], [vx + 2, gy + Math.round(gh * 0.52)], [vx + 1, gy + Math.round(gh * 0.58)]], shift(bar, 0.1), { shape: 'flat', height: 35 });

  // Lit arrow-slit windows on the towers (glowing — the fort is garrisoned).
  const slitW = Math.max(3, Math.round(towW * 0.14));
  const slitGlow = '#e88a52';
  for (const tcx of [f.left + Math.round(towW * 0.5), f.right - Math.round(towW * 0.5)]) {
    for (const sy of [f.top + Math.round(wallH * 0.28), f.top + Math.round(wallH * 0.56)]) {
      f.c.rect(tcx - slitW / 2 - 1, sy - 1, slitW + 2, Math.round(wallH * 0.14) + 2, shift(stone, -0.2, 6), { shape: 'flat', height: 46 });
      f.c.rect(tcx - slitW / 2, sy, slitW, Math.round(wallH * 0.14), slitGlow, { shape: 'flat', height: 34, emissive: true });
    }
  }

  // Twin banners hanging either side of the gate — dark red heraldic cloth with
  // a device, a subtle sag, catching a little light on the near fold.
  const banW = Math.round(f.w * 0.09);
  const banH = Math.round(wallH * 0.4);
  const banCloth = '#8e2f43';
  for (const [bx, dir] of [[centerL + 6, 1], [centerR - 6 - banW, 1]] as Array<[number, number]>) {
    void dir;
    const byTop = f.top + Math.round(wallH * 0.12);
    // Pole/rod.
    f.c.rect(bx - 2, byTop - 3, banW + 4, 2, shift(MATERIAL_IRON, -0.04), { shape: 'cylinder-x', height: 47, curve: 0.8 });
    // Cloth with a swallowtail bottom.
    f.c.rect(bx, byTop, banW, banH, banCloth, { shape: 'flat', height: 43 });
    f.c.polygon([[bx, byTop + banH], [bx + banW, byTop + banH], [bx + banW, byTop + banH - Math.round(banH * 0.16)], [bx + banW / 2, byTop + banH - Math.round(banH * 0.04)], [bx, byTop + banH - Math.round(banH * 0.16)]], mix(banCloth, '#111', 0.5), { shape: 'flat', height: 42 });
    // Lit near fold + shadowed far fold.
    f.c.rect(bx, byTop, 1, banH, shift(banCloth, 0.12), { shape: 'flat', height: 44 });
    f.c.rect(bx + banW - 1, byTop, 1, banH, shift(banCloth, -0.14), { shape: 'flat', height: 42 });
    // Heraldic device (a pale mark).
    f.c.circle(bx + banW / 2, byTop + Math.round(banH * 0.38), Math.max(2, banW * 0.24), mix(MATERIAL_GOLD, banCloth, 0.2), { shape: 'flat', height: 44 });
  }

  finish(f.c);
  return f.c;
}

// A few material constants pulled in without importing the whole MATERIAL map,
// keeping the builders readable. Values mirror Palette.MATERIAL.
const MATERIAL_IRON = '#6b7180';
const MATERIAL_BRONZE = '#a9743c';
const MATERIAL_GOLD = '#d3a24f';
const MATERIAL_BONE = '#d8cdb0';

// ---------------------------------------------------------------------------
// Registry & public API
// ---------------------------------------------------------------------------

type Builder = (spec: BuildingRenderSpec) => PixelCanvas;

const BUILDERS: Record<string, Builder> = {
  home: buildHome,
  inn: buildInn,
  forge: buildForge,
  cottage: buildCottage,
  chapel: buildChapel,
  marsh: buildMarsh,
  warehouse: buildWarehouse,
  citadel: buildCitadel,
};

/** Render one building spec into a finished PixelCanvas. Unknown styles fall
 *  back to the modest `home` cottage so a bad style string still draws. */
export function renderBuilding(spec: BuildingRenderSpec): PixelCanvas {
  const builder = BUILDERS[spec.style] ?? buildHome;
  return builder(spec);
}

/** Texture key for a building id: `building-<id>`. */
export function buildingKey(id: string): string {
  return `building-${id}`;
}

/**
 * Build every building frame as (key, canvas) pairs for baking into the atlas.
 * Pass the BUILDINGS array (each entry carries its own `id`); we read the same
 * fields the flat renderer used. Resolve each canvas with BUILDING_SHADE.
 */
export function buildBuildingFrames(
  buildings: Array<BuildingRenderSpec & { id: string }>,
): Array<{ key: string; canvas: PixelCanvas }> {
  return buildings.map((b) => ({ key: buildingKey(b.id), canvas: renderBuilding(b) }));
}
