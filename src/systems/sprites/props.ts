/**
 * World props and item sprites for Trupy.
 *
 * Every prop is sculpted the same way the hero is: a `groundShadow` goes down
 * first to anchor the object to the world, volume is built from *shaped*
 * primitives (domes for canopies and stone, cylinders for trunks and posts,
 * cones for pines and roofs), light emitters are flagged `emissive` so the
 * lighting pass leaves them glowing, and a dark keyline is traced last so the
 * silhouette reads against the valley's near-black ground.
 *
 * The world is viewed in a top-down-ish 3/4. Tall things (trees, obelisks,
 * statues) show a front face plus a hint of their top; flat things (puddles,
 * ash, cracked ground) lie on the ground plane with almost no height so the
 * light rakes across them instead of lifting them off the floor.
 *
 * Props are keyed by string. `renderProp(key, variant)` returns a fresh canvas;
 * the game references props by the same keys the old flat TextureFactory used,
 * so those all keep working (plus a pile of new ones and per-key variants).
 */

import { PixelCanvas, vary } from '../render/PixelCanvas';
import { MATERIAL, mix, shift } from '../render/Palette';

const OUTLINE = '#14151d';
const RIM = '#8f9bc4';
/** Shared soft keyline pass — dark line, faint cool lit edge upper-left. */
function finish(c: PixelCanvas): void {
  c.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.92 });
}

/**
 * Shading config for props. Slightly stronger occlusion than the hero so
 * clustered geometry (bark ridges, stone facets, chest slats) reads its
 * crevices, and a touch more rim so props separate from the dark ground.
 */
export const PROP_SHADE = {
  lightX: -0.5,
  lightY: -0.76,
  lightZ: 0.42,
  intensity: 0.64,
  ambient: 0.5,
  ambientColor: '#4f5f8c',
  occlusion: 0.46,
  rim: 0.24,
  rimColor: '#9fb0dc',
  bands: 5,
  dither: 0.44,
};

// ---------------------------------------------------------------------------
// Foliage
// ---------------------------------------------------------------------------

/**
 * A broadleaf tree. Canopy is a cluster of overlapping `dome` blobs — lit tops,
 * shadowed undersides — so it reads as a mass of leaves with real volume rather
 * than one flat disc. The trunk is a cylinder with a couple of bark ridges.
 * Variants shift the crown silhouette, lean and colour so a forest of them
 * doesn't look stamped.
 */
function tree(v: number): PixelCanvas {
  const c = new PixelCanvas(44, 60);
  const cx = 22;
  const foliage = vary(MATERIAL.foliage, v + 1, 0.06);
  const deep = shift(foliage, -0.12, 6);
  const lit = shift(foliage, 0.16, -6);

  c.groundShadow(cx, 55, 15, 4.5, 0.4);

  // Trunk: a cylinder so light wraps around it; a root flare at the base.
  // Variant 2 is a windswept tree, so its trunk leans and the crown sits off-axis.
  const trunkLean = v === 2 ? 2 : 0;
  const trunk = MATERIAL.wood;
  c.rect(cx - 3 + trunkLean, 30, 7, 26, trunk, { shape: 'cylinder-y', height: 4, curve: 0.95 });
  c.rect(cx - 5, 52, 11, 4, shift(trunk, -0.06), { shape: 'dome', height: 3, curve: 0.7 });
  c.rect(cx - 2 + trunkLean, 32, 1, 22, shift(trunk, -0.14), { shape: 'flat', height: 5, shade: 0.85 });
  c.rect(cx + 2 + trunkLean, 34, 1, 18, shift(trunk, 0.1), { shape: 'flat', height: 5 });

  // Each variant gets a hand-authored canopy silhouette rather than the same
  // blob cluster nudged sideways — a full round crown, a tall spire, and a
  // broad windswept crown read as genuinely different trees in a forest.
  // Columns: cx-offset, y, rx, ry, tint(0=deep 1=mid 2=lit).
  const crowns: Array<Array<[number, number, number, number, number]>> = [
    // 0 — full, round, generous
    [
      [-9, 21, 9, 8, 0], [9, 20, 9, 8, 0], [0, 27, 11, 8, 0],
      [-7, 14, 9, 8, 1], [7, 13, 9, 8, 1], [0, 16, 9, 8, 1],
      [0, 9, 10, 8, 2], [-4, 12, 6, 5, 2],
    ],
    // 1 — tall, narrow spire
    [
      [-6, 24, 8, 8, 0], [6, 23, 8, 8, 0], [0, 29, 8, 7, 0],
      [-5, 16, 7, 8, 1], [5, 15, 7, 8, 1],
      [0, 11, 8, 9, 1], [0, 5, 6, 8, 2], [-2, 9, 5, 6, 2],
    ],
    // 2 — broad, lopsided, windswept to the right
    [
      [-11, 22, 8, 7, 0], [8, 20, 11, 8, 0], [-2, 27, 11, 7, 0],
      [-8, 16, 8, 7, 1], [9, 13, 10, 8, 1], [2, 15, 9, 7, 1],
      [6, 9, 9, 7, 2], [-3, 13, 6, 5, 2],
    ],
  ];
  const tints = [deep, foliage, lit];
  for (const [dx, y, rx, ry, t] of crowns[v % 3]) {
    c.ellipse(cx + dx, y, rx, ry, tints[t], { shape: 'dome', height: 16 + (y < 16 ? 6 : 0), curve: 0.95 });
  }
  // A couple of brightest clumps catching the top light, placed per silhouette.
  const topLit: Array<[number, number]> = [[-2, 8], [4, 11]];
  if (v === 1) { topLit[0] = [0, 4]; topLit[1] = [-2, 8]; }
  if (v === 2) { topLit[0] = [5, 8]; topLit[1] = [-2, 12]; }
  c.ellipse(cx + topLit[0][0], topLit[0][1], 4, 3, shift(lit, 0.12), { shape: 'dome', height: 24, curve: 0.9 });
  c.ellipse(cx + topLit[1][0], topLit[1][1], 3, 2.5, shift(lit, 0.08), { shape: 'dome', height: 22, curve: 0.9 });

  finish(c);
  return c;
}

/** Dead tree: bare, clawing branches, no canopy. Bleached grey-brown wood. */
function treeDead(v: number): PixelCanvas {
  const c = new PixelCanvas(40, 58);
  const cx = 20;
  const wood = vary(shift(MATERIAL.wood, 0.04, 20, -0.12), v + 3, 0.05);
  c.groundShadow(cx, 53, 11, 4, 0.36);

  c.rect(cx - 2, 24, 5, 30, wood, { shape: 'cylinder-y', height: 4, curve: 0.95 });
  c.rect(cx - 4, 50, 9, 4, shift(wood, -0.06), { shape: 'dome', height: 3, curve: 0.7 });

  // Branches as tapering lines forking upward — mirrored per variant.
  const dir = v % 2 === 0 ? 1 : -1;
  const limbs: Array<[number, number, number, number, number]> = [
    [cx, 30, cx - 11 * dir, 18, 3],
    [cx - 8 * dir, 22, cx - 13 * dir, 12, 2],
    [cx, 24, cx + 9 * dir, 12, 3],
    [cx + 6 * dir, 16, cx + 11 * dir, 8, 2],
    [cx, 20, cx - 3 * dir, 6, 2],
    [cx, 18, cx + 3, 5, 2],
  ];
  for (const [x0, y0, x1, y1, t] of limbs) {
    c.line(x0, y0, x1, y1, wood, t, { height: 5 });
  }
  finish(c);
  return c;
}

/** Conifer: stacked `cone` tiers of dark needles over a short trunk. */
function treePine(v: number): PixelCanvas {
  const c = new PixelCanvas(38, 60);
  const cx = 19;
  const needle = vary(shift(MATERIAL.foliageDeep, 0.02, -4), v + 2, 0.05);
  const lit = shift(needle, 0.14, -8);
  c.groundShadow(cx, 55, 12, 4, 0.38);

  c.rect(cx - 2, 46, 5, 10, shift(MATERIAL.wood, -0.06), { shape: 'cylinder-y', height: 3, curve: 0.9 });

  // Widening cones from top to bottom; each tier lit on its upper-left.
  // Variants differ in tier count and taper: a classic 3-tier fir, a squat
  // broad 3-tier, and a tall skinny 4-tier sapling-spire.
  const tierSets: Array<Array<[number, number, number]>> = [
    // 0 — classic
    [[6, 8, 22], [16, 12, 30], [26, 15, 38]].map(([t, w, b]) => [t, w, b] as [number, number, number]),
    // 1 — squat & broad
    [[12, 10, 26], [22, 14, 34], [30, 17, 42]].map(([t, w, b]) => [t, w, b] as [number, number, number]),
    // 2 — tall skinny spire, 4 tiers
    [[3, 6, 16], [11, 8, 24], [19, 10, 32], [27, 13, 40]].map(([t, w, b]) => [t, w, b] as [number, number, number]),
  ];
  const tiers = tierSets[v % 3];
  for (const [top, halfW, base] of tiers) {
    c.polygon([
      [cx - halfW, base],
      [cx + halfW, base],
      [cx, top],
    ], needle, { shape: 'cone', height: 12, curve: 1 });
    // Lit sliver on the left face of each tier.
    c.polygon([
      [cx - halfW, base],
      [cx - halfW * 0.35, base],
      [cx, top],
    ], lit, { shape: 'cone', height: 13, curve: 1, shade: 1 });
  }
  finish(c);
  return c;
}

/** A cut stump with visible rings on top and a rounded, weathered side. */
function stump(): PixelCanvas {
  const c = new PixelCanvas(24, 20);
  const cx = 12;
  const wood = MATERIAL.woodPale;
  c.groundShadow(cx, 16, 10, 3.5, 0.34);
  // Side: a short cylinder.
  c.rect(cx - 8, 8, 16, 8, shift(wood, -0.08, 8), { shape: 'cylinder-y', height: 5, curve: 0.85 });
  // Top face: an ellipse of pale heartwood, catching the sky.
  c.ellipse(cx, 8, 8, 4, shift(wood, 0.06), { shape: 'flat', height: 8 });
  // Growth rings.
  c.ellipse(cx, 8, 5.5, 2.8, shift(wood, -0.05), { shape: 'flat', height: 8, alpha: 0.5 });
  c.ellipse(cx, 8, 3, 1.5, shift(wood, -0.12), { shape: 'flat', height: 8, alpha: 0.6 });
  finish(c);
  return c;
}

/** Low leafy bush — a cluster of small domes. Variants change bulk and hue. */
function bush(v: number): PixelCanvas {
  const c = new PixelCanvas(30, 22);
  const cx = 15;
  const base = vary(MATERIAL.foliage, v + 5, 0.07);
  const lit = shift(base, 0.15, -6);
  const deep = shift(base, -0.12, 6);
  c.groundShadow(cx, 18, 12, 3.5, 0.32);
  // Distinct massing per variant: a broad low bush, a tall tight bush, and a
  // sparse two-lobe bush — same palette, different silhouette.
  const shapes: Array<Array<[number, number, number, number, number]>> = [
    // 0 — broad, low, five lobes
    [[-8, 14, 6, 5, 0], [8, 14, 6, 5, 0], [0, 13, 7, 6, 1], [-4, 10, 5, 5, 2], [4, 11, 5, 4, 2]],
    // 1 — tall, tight, taller crown
    [[-5, 15, 6, 5, 0], [5, 15, 6, 5, 0], [0, 12, 7, 7, 1], [0, 7, 6, 6, 2], [-3, 10, 4, 4, 2]],
    // 2 — sparse, two main lobes leaning
    [[-6, 14, 7, 5, 0], [6, 13, 6, 5, 1], [-3, 10, 5, 5, 2], [4, 11, 4, 4, 2]],
  ];
  const tints = [deep, base, lit];
  for (const [dx, by, rx, ry, t] of shapes[v % 3]) {
    c.ellipse(cx + dx, by, rx, ry, tints[t], { shape: 'dome', height: 8, curve: 0.9 });
  }
  finish(c);
  return c;
}

/** A fern: fronds fanning out from a central crown, drawn as tapered blades. */
function fern(): PixelCanvas {
  const c = new PixelCanvas(26, 22);
  const cx = 13;
  const base = MATERIAL.grass;
  c.groundShadow(cx, 19, 9, 2.6, 0.28);
  // Blades as thin triangles radiating up and out.
  const blades: Array<[number, number, number]> = [
    [-11, 14, 0.9], [-7, 6, 1], [-3, 3, 1], [3, 3, 1], [7, 6, 1], [11, 14, 0.9],
  ];
  for (const [dx, ty, l] of blades) {
    const col = shift(base, dx === 0 ? 0.1 : 0.02 - Math.abs(dx) * 0.006, 4);
    c.polygon([
      [cx - 1, 19],
      [cx + 1, 19],
      [cx + dx * l, ty],
    ], col, { shape: 'cylinder-y', height: 5, curve: 0.7 });
  }
  finish(c);
  return c;
}

/** Marsh reeds: tall thin blades with seed heads. Cool bog green. */
function reeds(): PixelCanvas {
  const c = new PixelCanvas(24, 30);
  const cx = 12;
  const base = shift(MATERIAL.toxic, -0.06, -6);
  c.groundShadow(cx, 27, 8, 2.4, 0.26);
  const stalks: Array<[number, number]> = [[-6, 12], [-2, 5], [2, 8], [6, 14], [0, 3]];
  for (const [dx, ty] of stalks) {
    const x = cx + dx;
    c.line(x, 27, x, ty, shift(base, -0.02), 2, { shape: 'cylinder-y', height: 4 });
    // Seed head.
    c.ellipse(x, ty, 1.6, 3, shift(MATERIAL.thatch, -0.04), { shape: 'cylinder-y', height: 5, curve: 0.8 });
  }
  finish(c);
  return c;
}

/** A cluster of small brown mushrooms of varied heights. */
function mushroomCluster(): PixelCanvas {
  const c = new PixelCanvas(24, 18);
  const cx = 12;
  const cap = MATERIAL.bronze;
  const stem = MATERIAL.bone;
  c.groundShadow(cx, 15, 9, 2.6, 0.3);
  const caps: Array<[number, number, number]> = [[-6, 11, 3.2], [0, 8, 4], [6, 12, 2.6], [3, 13, 2.2]];
  for (const [dx, cy, r] of caps) {
    const x = cx + dx;
    c.rect(x - 1, cy, 2, 15 - cy, shift(stem, -0.04), { shape: 'cylinder-y', height: 3, curve: 0.85 });
    c.ellipse(x, cy, r, r * 0.7, shift(cap, dx * 0.01, 4), { shape: 'dome', height: 6, curve: 0.95 });
    // Pale gills catching under-light on the cap rim.
    c.ellipse(x, cy + r * 0.4, r * 0.7, 1, shift(stem, 0.08), { shape: 'flat', height: 5, alpha: 0.6 });
  }
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Stone & terrain
// ---------------------------------------------------------------------------

/**
 * A boulder. A big `round` mass gives the core volume, then a couple of bevelled
 * facets and a lit crown plane break the sphere into rock. Variants reshape the
 * silhouette and re-colour between grey stone and warmer granite.
 */
function rock(v: number): PixelCanvas {
  const c = new PixelCanvas(32, 26);
  const cx = 16;
  const stone = vary([MATERIAL.stone, MATERIAL.granite, MATERIAL.slate][v % 3], v + 7, 0.05);
  c.groundShadow(cx, 22, 14, 3.6, 0.36);

  // Core mass.
  const squash = [1, 0.85, 1.15][v % 3];
  c.ellipse(cx, 15, 13 * squash, 9, stone, { shape: 'round', height: 8, curve: 0.95 });
  // Facets: flatter bevelled planes that catch light differently.
  c.polygon([
    [cx - 11 * squash, 15], [cx - 2, 8], [cx + 3, 12], [cx - 4, 20],
  ], shift(stone, 0.1), { shape: 'bevel', height: 9, curve: 0.7 });
  c.polygon([
    [cx + 2, 9], [cx + 11 * squash, 14], [cx + 8, 21], [cx, 16],
  ], shift(stone, -0.1, 6), { shape: 'bevel', height: 8, curve: 0.7 });
  // A crack and a lit top edge.
  c.line(cx - 1, 10, cx + 2, 19, shift(stone, -0.22), 1, { height: 8, shade: 0.7 });
  c.ellipse(cx - 3, 9, 4, 2, shift(stone, 0.16), { shape: 'dome', height: 10, curve: 0.8 });
  finish(c);
  return c;
}

/** Scattered rubble: a few small broken stones. Variants rearrange them. */
function rubble(v: number): PixelCanvas {
  const c = new PixelCanvas(28, 18);
  const cx = 14;
  const stone = vary(MATERIAL.stoneDark, v + 11, 0.06);
  c.groundShadow(cx, 15, 12, 3, 0.3);
  const layouts: Array<Array<[number, number, number, number]>> = [
    [[-8, 11, 4, 3], [-1, 9, 5, 4], [7, 12, 4, 3], [2, 13, 3, 2]],
    [[-7, 12, 3, 3], [0, 11, 6, 4], [8, 10, 3, 3], [-2, 8, 3, 2]],
    [[-9, 10, 4, 3], [-2, 12, 4, 3], [5, 11, 5, 4], [9, 13, 2, 2]],
  ];
  for (const [dx, cy, rx, ry] of layouts[v % 3]) {
    c.ellipse(cx + dx, cy, rx, ry, shift(stone, (dx % 2) * 0.06), { shape: 'round', height: 5, curve: 0.9 });
    c.ellipse(cx + dx - 1, cy - 1, rx * 0.5, ry * 0.5, shift(stone, 0.12), { shape: 'dome', height: 6, curve: 0.8 });
  }
  finish(c);
  return c;
}

/** A pile of fine ash — lies flat, faint warm embers salted through it. */
function ashPile(): PixelCanvas {
  const c = new PixelCanvas(28, 14);
  const cx = 14;
  const ash = MATERIAL.ash;
  // Very low mound: read as ground, not object. No ground shadow (it *is* on the floor).
  c.ellipse(cx, 9, 13, 4.5, shift(ash, -0.05), { shape: 'flat', height: 1 });
  c.ellipse(cx, 8, 9, 3, ash, { shape: 'dome', height: 2, curve: 0.4 });
  c.ellipse(cx - 2, 7, 4, 1.6, shift(ash, 0.1), { shape: 'dome', height: 2, curve: 0.4 });
  // A couple of dull embers, barely glowing.
  c.rect(cx - 4, 9, 1, 1, shift(MATERIAL.ember, -0.1), { emissive: true });
  c.rect(cx + 3, 8, 1, 1, MATERIAL.emberCore, { emissive: true, alpha: 0.8 });
  finish(c);
  return c;
}

/** Cracked, dry ground — a flat decal of dark fissures on a scorched patch. */
function crackedGround(): PixelCanvas {
  const c = new PixelCanvas(30, 24);
  const cx = 15;
  const cy = 12;
  const dirt = shift(MATERIAL.soil, -0.02, 4);
  // Flat scorched disc.
  c.ellipse(cx, cy, 13, 10, dirt, { shape: 'flat', height: 0 });
  c.ellipse(cx, cy, 9, 7, shift(dirt, 0.05), { shape: 'flat', height: 0 });
  // Fissures radiating from centre.
  const crack = shift(dirt, -0.22);
  const rays: Array<[number, number]> = [[-11, -4], [-7, 7], [2, 9], [10, 3], [8, -6], [-2, -9], [12, -2]];
  for (const [dx, dy] of rays) {
    c.line(cx, cy, cx + dx, cy + dy, crack, 1, { height: 0, shade: 0.6 });
  }
  c.line(cx - 5, cy - 2, cx + 4, cy + 3, crack, 1, { height: 0, shade: 0.6 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

/** A shallow puddle: flat reflective water with a lit sky glint. */
function puddle(): PixelCanvas {
  const c = new PixelCanvas(28, 16);
  const cx = 14;
  const cy = 9;
  // Emissive so the water reads as reflecting sky rather than being lit as a solid.
  c.ellipse(cx, cy, 13, 6, mix(MATERIAL.water, '#0e1420', 0.35), { shape: 'flat', height: 0, emissive: true });
  c.ellipse(cx, cy, 10, 4.5, MATERIAL.water, { shape: 'flat', height: 0, emissive: true });
  c.ellipse(cx - 2, cy - 1, 6, 2.4, mix(MATERIAL.waterLit, '#0e1420', 0.15), { shape: 'flat', emissive: true });
  // Bright sky glint.
  c.ellipse(cx - 3, cy - 1, 3, 1, shift(MATERIAL.waterLit, 0.16), { shape: 'flat', emissive: true, alpha: 0.85 });
  return c; // no outline — water edges should stay soft
}

/** A lilypad floating on dark water, with a small bud. */
function lilypad(): PixelCanvas {
  const c = new PixelCanvas(22, 16);
  const cx = 11;
  const cy = 9;
  const pad = shift(MATERIAL.moss, 0.02, -6);
  // Faint water halo around it.
  c.ellipse(cx, cy, 10, 5, mix(MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.7 });
  // The pad, a low dome with the classic wedge notch.
  c.ellipse(cx, cy, 8, 4.5, pad, { shape: 'dome', height: 2, curve: 0.5 });
  c.polygon([[cx, cy], [cx + 8, cy - 2], [cx + 8, cy + 2]], mix(MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true });
  c.ellipse(cx - 1, cy - 1, 4, 2, shift(pad, 0.1), { shape: 'dome', height: 3, curve: 0.5 });
  // Small pink bud.
  c.ellipse(cx - 3, cy, 1.6, 1.8, shift(MATERIAL.cloth, 0.2, 10), { shape: 'dome', height: 4, curve: 0.9 });
  finish(c);
  return c;
}

/** A bog bubble rising off the mire — a glassy dome catching a highlight. */
function bogBubble(): PixelCanvas {
  const c = new PixelCanvas(16, 16);
  const cx = 8;
  const cy = 9;
  const col = mix(MATERIAL.toxic, MATERIAL.water, 0.5);
  c.ellipse(cx, cy + 3, 6, 2, mix(col, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.6 });
  c.circle(cx, cy, 5, mix(col, '#0e1420', 0.2), { shape: 'round', height: 5, emissive: true, alpha: 0.55 });
  c.circle(cx, cy, 3.5, shift(col, 0.05), { shape: 'round', height: 6, emissive: true, alpha: 0.5 });
  // Specular highlight.
  c.ellipse(cx - 1.5, cy - 1.5, 1.4, 1.4, '#e6fff4', { shape: 'flat', emissive: true, alpha: 0.9 });
  return c;
}

// ---------------------------------------------------------------------------
// Bones & graves
// ---------------------------------------------------------------------------

/**
 * A weathered headstone. A rounded-top slab standing in disturbed soil, with a
 * carved cross recessed into the face. Variants change the top shape and lean.
 */
function grave(v: number): PixelCanvas {
  const c = new PixelCanvas(22, 32);
  const cx = 11;
  const stone = vary(MATERIAL.stone, v + 13, 0.05);
  const lean = [0, -2, 2][v % 3];
  c.groundShadow(cx, 28, 10, 3, 0.34);
  // Mound of soil at the base.
  c.ellipse(cx, 27, 9, 3, shift(MATERIAL.soil, -0.02), { shape: 'dome', height: 2, curve: 0.5 });

  const topY = 4;
  const slabX = cx - 5 + Math.round(lean * 0.5);
  // Slab body as a rounded-top cylinder-x so it reads as a domed stele.
  c.rect(slabX, topY + 4, 10, 22, stone, { shape: 'cylinder-x', height: 6, curve: 0.8 });
  // Rounded / peaked cap depending on variant.
  if (v % 3 === 1) {
    c.ellipse(slabX + 5, topY + 4, 5, 4, stone, { shape: 'dome', height: 7, curve: 0.9 });
  } else {
    c.polygon([[slabX, topY + 5], [slabX + 5, topY], [slabX + 10, topY + 5]], stone, { shape: 'dome', height: 7, curve: 0.8 });
  }
  // Recessed cross, pre-shaded dark for a carved look.
  c.rect(slabX + 4, topY + 8, 2, 10, shift(stone, -0.24), { shape: 'flat', height: 5, shade: 0.65 });
  c.rect(slabX + 2, topY + 11, 6, 2, shift(stone, -0.24), { shape: 'flat', height: 5, shade: 0.65 });
  // Lit left edge.
  c.rect(slabX + 1, topY + 6, 1, 18, shift(stone, 0.14), { shape: 'flat', height: 6 });
  finish(c);
  return c;
}

/** A cross-shaped grave marker of lashed wood. */
function tombstoneCross(): PixelCanvas {
  const c = new PixelCanvas(20, 32);
  const cx = 10;
  const wood = shift(MATERIAL.wood, -0.02, 6);
  c.groundShadow(cx, 28, 8, 2.6, 0.32);
  c.ellipse(cx, 27, 7, 2.5, shift(MATERIAL.soil, -0.02), { shape: 'dome', height: 2, curve: 0.5 });
  // Vertical and horizontal beams as cylinders.
  c.rect(cx - 2, 4, 4, 24, wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
  c.rect(cx - 7, 10, 14, 3, wood, { shape: 'cylinder-x', height: 5, curve: 0.9 });
  // Lashing at the joint.
  c.rect(cx - 3, 9, 6, 5, shift(MATERIAL.leatherDark, 0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
  finish(c);
  return c;
}

/** A scatter of old bones on the ground. */
function bones(): PixelCanvas {
  const c = new PixelCanvas(26, 18);
  const cx = 13;
  const bone = MATERIAL.boneOld;
  c.groundShadow(cx, 14, 11, 3, 0.28);
  // Long bones as capsules (cylinder + knobbed ends).
  const draw = (x0: number, y0: number, x1: number, y1: number) => {
    c.line(x0, y0, x1, y1, bone, 2, { shape: 'cylinder-y', height: 3, curve: 0.8 });
    c.circle(x0, y0, 1.6, shift(bone, 0.06), { shape: 'round', height: 4, curve: 0.9 });
    c.circle(x1, y1, 1.6, shift(bone, 0.06), { shape: 'round', height: 4, curve: 0.9 });
  };
  draw(cx - 8, 8, cx + 2, 12);
  draw(cx - 3, 13, cx + 8, 9);
  // A curved rib.
  c.line(cx + 4, 6, cx + 9, 13, shift(bone, -0.05), 1, { height: 3 });
  finish(c);
  return c;
}

/** A single skull resting on the ground, eye sockets pooled with shadow. */
function skull(): PixelCanvas {
  const c = new PixelCanvas(18, 16);
  const cx = 9;
  const bone = MATERIAL.bone;
  c.groundShadow(cx, 13, 7, 2.4, 0.3);
  // Cranium dome + jaw block.
  c.ellipse(cx, 7, 6, 5.5, bone, { shape: 'round', height: 6, curve: 1 });
  c.rect(cx - 4, 10, 8, 3, shift(bone, -0.04), { shape: 'dome', height: 5, curve: 0.7 });
  // Sockets and nasal cavity, pre-darkened.
  c.ellipse(cx - 2.5, 7, 1.8, 2, '#1c1a1f', { shape: 'flat', height: 6, emissive: true });
  c.ellipse(cx + 2.5, 7, 1.8, 2, '#1c1a1f', { shape: 'flat', height: 6, emissive: true });
  c.polygon([[cx, 8], [cx - 1, 11], [cx + 1, 11]], '#1c1a1f', { shape: 'flat', height: 5, emissive: true });
  // Teeth hint.
  c.rect(cx - 3, 12, 6, 1, shift(bone, 0.08), { shape: 'flat', height: 5 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Herbs & fungi (collectibles)
// ---------------------------------------------------------------------------

/** Moonwort: pale spirit-blue leaves around a stem, faint glow at the bud. */
function herbMoonwort(): PixelCanvas {
  const c = new PixelCanvas(16, 18);
  const cx = 8;
  const leaf = MATERIAL.spirit;
  c.groundShadow(cx, 15, 6, 2, 0.24);
  c.rect(cx - 1, 8, 2, 8, shift(MATERIAL.foliageDeep, 0.04), { shape: 'cylinder-y', height: 3, curve: 0.8 });
  const leaves: Array<[number, number, number, number]> = [[-5, 9, 4, 2.4], [4, 6, 4, 2.6], [3, 11, 3.5, 2], [-3, 6, 3.5, 2.2]];
  for (const [dx, cy, rx, ry] of leaves) {
    c.ellipse(cx + dx, cy, rx, ry, shift(leaf, dx * 0.01), { shape: 'dome', height: 5, curve: 0.85 });
  }
  // Luminous bud.
  c.circle(cx + 1, 5, 2, shift(leaf, 0.2), { shape: 'round', height: 6, emissive: true });
  c.circle(cx + 1, 5, 1, '#eafbff', { emissive: true });
  finish(c);
  return c;
}

/** Shadebloom: a violet flower with dark leaves and a glowing core. */
function herbShadebloom(): PixelCanvas {
  const c = new PixelCanvas(16, 18);
  const cx = 8;
  c.groundShadow(cx, 15, 6, 2, 0.24);
  c.rect(cx - 1, 8, 2, 8, MATERIAL.foliageDeep, { shape: 'cylinder-y', height: 3, curve: 0.8 });
  // Dark leaves low, petals up.
  c.ellipse(cx - 4, 11, 4, 2.2, MATERIAL.foliage, { shape: 'dome', height: 4, curve: 0.85 });
  c.ellipse(cx + 4, 11, 4, 2.2, MATERIAL.foliage, { shape: 'dome', height: 4, curve: 0.85 });
  const petals: Array<[number, number]> = [[-3, 5], [3, 5], [-2, 3], [2, 3], [0, 6]];
  for (const [dx, cy] of petals) {
    c.ellipse(cx + dx, cy, 2.4, 2.6, MATERIAL.voidPurple, { shape: 'dome', height: 6, curve: 0.9 });
  }
  c.circle(cx, 5, 1.6, MATERIAL.voidBright, { shape: 'round', height: 7, emissive: true });
  c.circle(cx, 5, 0.8, '#f4d9ff', { emissive: true });
  finish(c);
  return c;
}

/** Bog reed: a tall cattail with a brown seed spike. */
function herbBogReed(): PixelCanvas {
  const c = new PixelCanvas(18, 22);
  const cx = 9;
  const green = shift(MATERIAL.toxic, -0.04, -4);
  c.groundShadow(cx, 19, 6, 2, 0.24);
  // Blades.
  c.line(cx - 4, 19, cx - 6, 6, green, 2, { shape: 'cylinder-y', height: 3 });
  c.line(cx + 3, 19, cx + 6, 8, green, 2, { shape: 'cylinder-y', height: 3 });
  // Central stalk + cattail spike.
  c.rect(cx - 1, 6, 2, 13, shift(green, -0.04), { shape: 'cylinder-y', height: 4, curve: 0.85 });
  c.rect(cx - 1.5, 3, 3, 7, MATERIAL.bronze, { shape: 'cylinder-y', height: 6, curve: 0.95 });
  c.rect(cx - 1, 4, 1, 5, shift(MATERIAL.bronze, 0.12), { shape: 'flat', height: 7 });
  finish(c);
  return c;
}

/** Glowcap: a luminous teal mushroom, cap emissive so it reads as a light. */
function glowcap(): PixelCanvas {
  const c = new PixelCanvas(18, 18);
  const cx = 9;
  const glow = mix(MATERIAL.toxic, MATERIAL.spirit, 0.4);
  c.groundShadow(cx, 15, 7, 2.2, 0.24);
  // Faint pooled light on the ground beneath.
  c.ellipse(cx, 14, 7, 2.4, shift(glow, -0.1), { shape: 'flat', emissive: true, alpha: 0.35 });
  // Stem (lit, not shaded, since the cap illuminates it).
  c.rect(cx - 1.5, 8, 3, 7, shift(glow, 0.05), { shape: 'cylinder-y', height: 3, emissive: true, alpha: 0.85 });
  // Cap: emissive dome with a bright crown.
  c.ellipse(cx, 7, 7, 4, glow, { shape: 'dome', height: 6, emissive: true });
  c.ellipse(cx, 6, 4.5, 2.6, shift(glow, 0.18), { shape: 'dome', height: 7, emissive: true });
  c.ellipse(cx - 1, 5, 2, 1.2, '#dffff6', { shape: 'flat', emissive: true });
  // Under-gills darker.
  c.ellipse(cx, 9, 5, 1, shift(glow, -0.22), { shape: 'flat', height: 5, emissive: true, alpha: 0.7 });
  finish(c);
  return c;
}

/** Flower patch: a low spread of tiny multi-coloured blooms in grass. */
function flowerPatch(): PixelCanvas {
  const c = new PixelCanvas(26, 16);
  const cx = 13;
  c.groundShadow(cx, 13, 11, 2.6, 0.22);
  // Grass tuft base.
  c.ellipse(cx, 11, 11, 3, MATERIAL.grass, { shape: 'dome', height: 2, curve: 0.4 });
  const cols = ['#d8b25a', '#c77a9b', '#8fa8d8', '#e0c4ff'];
  const spots: Array<[number, number, number]> = [[-8, 9, 0], [-3, 7, 1], [2, 9, 2], [7, 8, 3], [0, 11, 0], [5, 11, 1]];
  for (const [dx, cy, ci] of spots) {
    const x = cx + dx;
    c.line(x, 12, x, cy + 1, shift(MATERIAL.grass, 0.06), 1, { height: 3 });
    c.circle(x, cy, 1.6, cols[ci], { shape: 'dome', height: 5, curve: 0.9 });
    c.rect(x, cy, 1, 1, shift(cols[ci], 0.2), { emissive: true, alpha: 0.7 });
  }
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Light sources & shrines
// ---------------------------------------------------------------------------

/** Base for both lantern states: iron cage on a hook post. */
function lanternBody(c: PixelCanvas, cx: number): void {
  const iron = MATERIAL.iron;
  // Hook post.
  c.rect(cx - 1, 0, 2, 6, MATERIAL.steelDark, { shape: 'cylinder-y', height: 4, curve: 0.8 });
  c.rect(cx - 3, 4, 8, 2, iron, { shape: 'cylinder-x', height: 5, curve: 0.8 });
  // Cage top cap + frame.
  c.rect(cx - 4, 6, 10, 2, shift(iron, -0.04), { shape: 'dome', height: 7, curve: 0.7 });
  c.rect(cx - 1, 6, 2, 2, iron, { shape: 'flat', height: 8 });
  // Cage bars.
  c.rect(cx - 4, 8, 1, 9, shift(iron, -0.08), { shape: 'cylinder-y', height: 6 });
  c.rect(cx + 4, 8, 1, 9, shift(iron, -0.08), { shape: 'cylinder-y', height: 6 });
  c.rect(cx - 4, 16, 10, 2, iron, { shape: 'cylinder-x', height: 6, curve: 0.8 });
}

/** Unlit lantern: dark glass, no glow. */
function lanternOff(): PixelCanvas {
  const c = new PixelCanvas(16, 24);
  const cx = 7;
  c.groundShadow(cx, 20, 6, 2, 0.3);
  // Dead glass panel.
  c.rect(cx - 3, 8, 8, 8, shift(MATERIAL.slate, -0.06), { shape: 'round', height: 4, curve: 0.6 });
  lanternBody(c, cx);
  finish(c);
  return c;
}

/** Lit lantern: emissive flame + hot glass so it reads as a light emitter. */
function lanternOn(): PixelCanvas {
  const c = new PixelCanvas(16, 24);
  const cx = 7;
  c.groundShadow(cx, 20, 6, 2, 0.3);
  // Glow halo around the cage.
  c.ellipse(cx, 12, 9, 9, MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
  // Hot glass.
  c.rect(cx - 3, 8, 8, 8, shift(MATERIAL.flame, 0.06), { shape: 'round', height: 4, emissive: true, alpha: 0.9 });
  // Flame core.
  c.ellipse(cx + 1, 12, 2.4, 3.4, MATERIAL.emberCore, { shape: 'flat', emissive: true });
  c.ellipse(cx + 1, 12, 1.2, 2, '#fff0b0', { shape: 'flat', emissive: true });
  lanternBody(c, cx);
  finish(c);
  return c;
}

/** A stone altar with a glowing rune slab set into the top. */
function altar(): PixelCanvas {
  const c = new PixelCanvas(44, 36);
  const cx = 22;
  const stone = MATERIAL.granite;
  c.groundShadow(cx, 32, 20, 4, 0.38);
  // Base plinth (wider, receding) then the pillar body.
  c.rect(cx - 18, 22, 36, 10, shift(stone, -0.06, 6), { shape: 'cylinder-x', height: 6, curve: 0.7 });
  c.rect(cx - 14, 12, 28, 12, stone, { shape: 'cylinder-x', height: 9, curve: 0.75 });
  // Top slab.
  c.rect(cx - 15, 9, 30, 4, shift(stone, 0.08), { shape: 'bevel', height: 12, curve: 0.6 });
  c.ellipse(cx, 10, 13, 2.6, shift(stone, 0.12), { shape: 'flat', height: 12 });
  // Glowing void rune inset.
  c.rect(cx - 3, 10, 6, 9, mix(MATERIAL.voidPurple, '#1a1222', 0.3), { shape: 'flat', height: 11, shade: 0.7 });
  c.ellipse(cx, 13, 2.4, 4, MATERIAL.voidBright, { shape: 'flat', emissive: true });
  c.ellipse(cx, 13, 1.2, 2.4, '#f0d0ff', { shape: 'flat', emissive: true });
  c.ellipse(cx, 13, 6, 7, MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.12 });
  finish(c);
  return c;
}

/** A lit brazier: iron bowl on legs, fire and coals glowing inside. */
function brazierLit(): PixelCanvas {
  const c = new PixelCanvas(26, 32);
  const cx = 13;
  const iron = MATERIAL.iron;
  c.groundShadow(cx, 29, 10, 3, 0.34);
  // Glow.
  c.ellipse(cx, 12, 12, 11, MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.14 });
  // Legs.
  c.line(cx - 6, 28, cx - 3, 18, iron, 2, { height: 4 });
  c.line(cx + 6, 28, cx + 3, 18, iron, 2, { height: 4 });
  c.line(cx, 29, cx, 18, shift(iron, -0.06), 2, { height: 4 });
  // Bowl (cylinder-x, open top).
  c.rect(cx - 8, 14, 16, 7, iron, { shape: 'cylinder-x', height: 8, curve: 0.85 });
  c.ellipse(cx, 14, 8, 2.6, shift(iron, -0.12), { shape: 'flat', height: 9, shade: 0.6 });
  // Coals + flames.
  c.ellipse(cx, 13, 6, 2, MATERIAL.ember, { shape: 'flat', emissive: true });
  c.ellipse(cx - 1, 10, 3, 4, MATERIAL.emberCore, { shape: 'cone', emissive: true });
  c.ellipse(cx + 2, 8, 2, 3.4, MATERIAL.flame, { shape: 'cone', emissive: true });
  c.ellipse(cx, 7, 1.2, 2.4, '#fff0b0', { shape: 'flat', emissive: true });
  finish(c);
  return c;
}

/** A cold brazier: same iron bowl, filled with grey ash, no fire. */
function brazierCold(): PixelCanvas {
  const c = new PixelCanvas(26, 32);
  const cx = 13;
  const iron = shift(MATERIAL.iron, -0.04);
  c.groundShadow(cx, 29, 10, 3, 0.34);
  c.line(cx - 6, 28, cx - 3, 18, iron, 2, { height: 4 });
  c.line(cx + 6, 28, cx + 3, 18, iron, 2, { height: 4 });
  c.line(cx, 29, cx, 18, shift(iron, -0.06), 2, { height: 4 });
  c.rect(cx - 8, 14, 16, 7, iron, { shape: 'cylinder-x', height: 8, curve: 0.85 });
  c.ellipse(cx, 14, 8, 2.6, shift(iron, -0.14), { shape: 'flat', height: 9, shade: 0.55 });
  // Cold ash.
  c.ellipse(cx, 13, 6, 2, shift(MATERIAL.ash, -0.04), { shape: 'dome', height: 6, curve: 0.5 });
  finish(c);
  return c;
}

/** A campfire: stacked logs with flames licking up, ring of stones. */
function campfire(): PixelCanvas {
  const c = new PixelCanvas(30, 24);
  const cx = 15;
  c.groundShadow(cx, 20, 13, 3.4, 0.3);
  // Glow pool.
  c.ellipse(cx, 15, 13, 8, MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
  // Ring stones.
  const ring: Array<[number, number]> = [[-11, 17], [-5, 19], [3, 19], [10, 17], [-9, 15], [11, 14]];
  for (const [dx, cy] of ring) {
    c.ellipse(cx + dx, cy, 3, 2, MATERIAL.stone, { shape: 'round', height: 4, curve: 0.9 });
  }
  // Crossed logs.
  c.line(cx - 6, 17, cx + 6, 13, MATERIAL.wood, 3, { shape: 'cylinder-y', height: 5 });
  c.line(cx - 5, 13, cx + 6, 17, shift(MATERIAL.wood, -0.05), 3, { shape: 'cylinder-y', height: 5 });
  // Charred tops.
  c.line(cx - 6, 17, cx + 6, 13, '#241d22', 1, { height: 6, shade: 0.6 });
  // Flames.
  c.ellipse(cx, 12, 4, 5, MATERIAL.ember, { shape: 'cone', emissive: true });
  c.ellipse(cx - 1, 9, 3, 5, MATERIAL.emberCore, { shape: 'cone', emissive: true });
  c.ellipse(cx + 2, 8, 2, 4, MATERIAL.flame, { shape: 'cone', emissive: true });
  c.ellipse(cx, 6, 1.4, 3, '#fff0b0', { shape: 'flat', emissive: true });
  finish(c);
  return c;
}

/** A wall torch: bracket holding a burning brand. Emissive flame. */
function torchWall(): PixelCanvas {
  const c = new PixelCanvas(16, 26);
  const cx = 8;
  const iron = MATERIAL.iron;
  // Glow.
  c.ellipse(cx + 1, 8, 8, 9, MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
  // Wall bracket.
  c.rect(cx - 5, 12, 3, 8, MATERIAL.steelDark, { shape: 'cylinder-y', height: 4, curve: 0.7 });
  c.line(cx - 4, 16, cx + 1, 13, iron, 2, { height: 5 });
  // Brand handle.
  c.rect(cx, 12, 2, 10, MATERIAL.wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
  // Wrapped head.
  c.ellipse(cx + 1, 11, 3, 3, MATERIAL.leatherDark, { shape: 'round', height: 6, curve: 0.9 });
  // Flame.
  c.ellipse(cx + 1, 8, 3, 4.5, MATERIAL.ember, { shape: 'cone', emissive: true });
  c.ellipse(cx, 6, 2.2, 4, MATERIAL.emberCore, { shape: 'cone', emissive: true });
  c.ellipse(cx + 1, 4, 1.4, 3, MATERIAL.flame, { shape: 'cone', emissive: true });
  c.ellipse(cx + 1, 3, 0.9, 1.8, '#fff0b0', { shape: 'flat', emissive: true });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Containers & camp
// ---------------------------------------------------------------------------

/** Ferryman cargo: a lashed bundle of crates/sacks under a tarp. */
function cargo(): PixelCanvas {
  const c = new PixelCanvas(26, 24);
  const cx = 13;
  c.groundShadow(cx, 21, 12, 3, 0.34);
  // Base crate.
  c.rect(cx - 10, 10, 20, 12, MATERIAL.wood, { shape: 'bevel', height: 7, curve: 0.5 });
  c.rect(cx - 10, 10, 20, 1, shift(MATERIAL.wood, 0.14), { shape: 'flat', height: 8 });
  // Sack on top.
  c.ellipse(cx + 2, 7, 6, 5, MATERIAL.thatch, { shape: 'round', height: 11, curve: 0.9 });
  // Rope lashing.
  c.rect(cx - 3, 10, 2, 12, shift(MATERIAL.rust, 0.02), { shape: 'cylinder-y', height: 8 });
  c.rect(cx - 10, 15, 20, 2, shift(MATERIAL.rust, -0.04), { shape: 'cylinder-x', height: 8, curve: 0.8 });
  // Cloth wrap on the corner + a pink ribbon (matches the old cargo accent).
  c.rect(cx + 4, 11, 5, 4, MATERIAL.clothCold, { shape: 'bevel', height: 8, curve: 0.5 });
  c.rect(cx + 5, 12, 2, 2, MATERIAL.cloth, { shape: 'flat', height: 9 });
  finish(c);
  return c;
}

/** Miner's tools: a pick crossed with a shovel leaning together. */
function minerTools(): PixelCanvas {
  const c = new PixelCanvas(24, 24);
  const cx = 12;
  c.groundShadow(cx, 21, 10, 3, 0.3);
  const handle = MATERIAL.woodPale;
  const metal = MATERIAL.steel;
  // Pick: handle bottom-left to top-right, head across the top.
  c.line(cx - 7, 21, cx + 4, 5, handle, 2, { shape: 'cylinder-y', height: 5 });
  c.polygon([[cx - 2, 4], [cx + 9, 7], [cx + 8, 9], [cx - 2, 7]], metal, { shape: 'cylinder-x', height: 8, curve: 0.8 });
  c.rect(cx - 3, 4, 3, 3, shift(metal, -0.1), { shape: 'bevel', height: 8, curve: 0.6 });
  // Shovel: handle bottom-right to top-left, blade at the base.
  c.line(cx + 7, 21, cx - 3, 6, shift(handle, -0.04), 2, { shape: 'cylinder-y', height: 4 });
  c.polygon([[cx + 4, 18], [cx + 10, 18], [cx + 9, 23], [cx + 5, 23]], metal, { shape: 'dome', height: 5, curve: 0.7 });
  finish(c);
  return c;
}

/** A wooden crate — bevelled box with plank seams and corner braces. */
function crate(): PixelCanvas {
  const c = new PixelCanvas(24, 24);
  const cx = 12;
  const wood = MATERIAL.woodPale;
  c.groundShadow(cx, 21, 11, 3, 0.34);
  // Body as a bevel so edges catch light like a box.
  c.rect(cx - 9, 5, 18, 17, wood, { shape: 'bevel', height: 8, curve: 0.5 });
  // Top face lighter (we see a sliver of the lid).
  c.rect(cx - 9, 5, 18, 3, shift(wood, 0.12), { shape: 'flat', height: 9 });
  // Plank seams.
  c.rect(cx - 9, 12, 18, 1, shift(wood, -0.16), { shape: 'flat', height: 8, shade: 0.8 });
  c.rect(cx - 1, 8, 1, 14, shift(wood, -0.14), { shape: 'flat', height: 8, shade: 0.8 });
  // Diagonal brace.
  c.line(cx - 8, 20, cx + 8, 9, shift(wood, -0.1), 1, { height: 9, shade: 0.85 });
  // Iron corner brackets.
  for (const dx of [-9, 8]) {
    c.rect(cx + dx, 5, 1, 3, MATERIAL.iron, { shape: 'flat', height: 9 });
    c.rect(cx + dx, 19, 1, 3, MATERIAL.iron, { shape: 'flat', height: 9 });
  }
  finish(c);
  return c;
}

/** A barrel — a bulged cylinder with hoop bands and a domed top. */
function barrel(): PixelCanvas {
  const c = new PixelCanvas(22, 26);
  const cx = 11;
  const wood = MATERIAL.wood;
  c.groundShadow(cx, 23, 9, 3, 0.34);
  // Staves: cylinder-y body, slightly barrel-shaped by stacking two widths.
  c.rect(cx - 8, 8, 16, 15, wood, { shape: 'cylinder-y', height: 7, curve: 1 });
  c.rect(cx - 9, 12, 18, 7, shift(wood, -0.02), { shape: 'cylinder-y', height: 8, curve: 1 });
  // Top lid.
  c.ellipse(cx, 8, 8, 3, shift(wood, 0.08), { shape: 'dome', height: 9, curve: 0.6 });
  c.ellipse(cx, 8, 5, 1.8, shift(wood, -0.06), { shape: 'flat', height: 9 });
  // Iron hoops.
  c.rect(cx - 9, 11, 18, 1.5, MATERIAL.iron, { shape: 'cylinder-x', height: 9, curve: 0.9 });
  c.rect(cx - 8, 19, 16, 1.5, MATERIAL.iron, { shape: 'cylinder-x', height: 8, curve: 0.9 });
  // Stave seams.
  c.rect(cx - 1, 9, 1, 14, shift(wood, -0.14), { shape: 'flat', height: 8, shade: 0.8 });
  c.rect(cx + 4, 10, 1, 12, shift(wood, -0.1), { shape: 'flat', height: 8, shade: 0.85 });
  finish(c);
  return c;
}

/** A slumped burlap sack, cinched at the neck. */
function sack(): PixelCanvas {
  const c = new PixelCanvas(20, 22);
  const cx = 10;
  const cloth = MATERIAL.thatch;
  c.groundShadow(cx, 19, 9, 3, 0.32);
  // Bulging body.
  c.ellipse(cx, 14, 8, 6, cloth, { shape: 'round', height: 6, curve: 1 });
  c.ellipse(cx - 2, 12, 4, 3.5, shift(cloth, 0.12), { shape: 'dome', height: 7, curve: 0.9 });
  // Cinched neck + gathered top.
  c.rect(cx - 2, 6, 4, 4, shift(cloth, -0.08), { shape: 'cylinder-y', height: 7, curve: 0.8 });
  c.rect(cx - 3, 8, 6, 1.5, shift(MATERIAL.leatherDark, 0.04), { shape: 'cylinder-x', height: 8, curve: 0.8 });
  c.ellipse(cx, 5, 3, 2, cloth, { shape: 'dome', height: 8, curve: 0.9 });
  // Fold shadows.
  c.line(cx - 3, 12, cx - 2, 18, shift(cloth, -0.14), 1, { height: 6, shade: 0.8 });
  c.line(cx + 3, 12, cx + 2, 18, shift(cloth, -0.12), 1, { height: 6, shade: 0.8 });
  finish(c);
  return c;
}

/** A hay bale — a round bound bale with straw texture. */
function hayBale(): PixelCanvas {
  const c = new PixelCanvas(28, 22);
  const cx = 14;
  const straw = MATERIAL.thatch;
  c.groundShadow(cx, 19, 13, 3.4, 0.34);
  // Cylinder lying on its side (cylinder-x).
  c.rect(cx - 12, 7, 24, 13, straw, { shape: 'cylinder-x', height: 7, curve: 0.95 });
  // Round end cap.
  c.ellipse(cx - 11, 13, 3.5, 6.5, shift(straw, -0.06), { shape: 'round', height: 8, curve: 0.9 });
  c.ellipse(cx - 11, 13, 2, 4, shift(straw, 0.06), { shape: 'flat', height: 9 });
  // Straw striations.
  for (let i = 0; i < 5; i += 1) {
    const y = 9 + i * 2.4;
    c.line(cx - 8, y, cx + 11, y, shift(straw, i % 2 ? -0.08 : 0.06), 1, { height: 7, shade: 0.9 });
  }
  // Binding twine.
  c.rect(cx - 2, 7, 1.5, 13, shift(MATERIAL.rust, 0.04), { shape: 'cylinder-y', height: 8 });
  c.rect(cx + 6, 7, 1.5, 13, shift(MATERIAL.rust, 0.02), { shape: 'cylinder-y', height: 8 });
  finish(c);
  return c;
}

/** A canvas tent: triangular ridge tent with a dark doorway. */
function tent(): PixelCanvas {
  const c = new PixelCanvas(40, 30);
  const cx = 20;
  const canvasCol = shift(MATERIAL.thatch, 0.02, 6);
  c.groundShadow(cx, 27, 18, 3.6, 0.36);
  // Main triangular body.
  c.polygon([[cx, 4], [cx - 16, 26], [cx + 16, 26]], canvasCol, { shape: 'cylinder-y', height: 8, curve: 0.9 });
  // Lit left slope / shadowed right slope.
  c.polygon([[cx, 4], [cx - 16, 26], [cx - 2, 26]], shift(canvasCol, 0.1), { shape: 'flat', height: 9 });
  c.polygon([[cx, 4], [cx + 4, 26], [cx + 16, 26]], shift(canvasCol, -0.12, 6), { shape: 'flat', height: 8 });
  // Ridge pole line.
  c.line(cx, 4, cx, 26, shift(canvasCol, -0.06), 1, { height: 10 });
  // Dark entrance flap.
  c.polygon([[cx, 12], [cx - 5, 26], [cx + 5, 26]], '#1a1720', { shape: 'flat', height: 9, emissive: true });
  c.polygon([[cx, 12], [cx - 5, 26], [cx - 1, 26]], shift(canvasCol, -0.14), { shape: 'flat', height: 9 });
  // Guy line + peg.
  c.line(cx + 16, 26, cx + 20, 28, MATERIAL.rust, 1, { height: 2 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

/** Closed chest — domed lid, iron bands, big lock plate. */
function chestClosed(): PixelCanvas {
  const c = new PixelCanvas(30, 24);
  const cx = 15;
  const wood = MATERIAL.wood;
  c.groundShadow(cx, 21, 14, 3.2, 0.36);
  // Body box.
  c.rect(cx - 12, 12, 24, 10, wood, { shape: 'bevel', height: 7, curve: 0.5 });
  // Domed lid as a strong cylinder-x arch — high curve so it reads as barrel-topped.
  c.rect(cx - 12, 4, 24, 8, shift(wood, 0.06), { shape: 'cylinder-x', height: 11, curve: 1 });
  // Lit crown of the dome and a shadow at the lid/body seam sell the curvature.
  c.rect(cx - 11, 4, 22, 2, shift(wood, 0.18), { shape: 'flat', height: 13 });
  c.rect(cx - 12, 11, 24, 1, shift(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
  // Iron bands over lid and body — brighter iron + a dark edge so they pop.
  for (const dx of [-9, 7]) {
    c.rect(cx + dx, 4, 2.5, 18, MATERIAL.iron, { shape: 'cylinder-y', height: 12, curve: 0.85 });
    c.rect(cx + dx, 4, 1, 18, shift(MATERIAL.iron, 0.16), { shape: 'flat', height: 13 });
  }
  c.rect(cx - 12, 12, 24, 2, shift(MATERIAL.iron, -0.04), { shape: 'flat', height: 12 });
  // Lock plate.
  c.rect(cx - 2, 11, 4, 5, MATERIAL.gold, { shape: 'bevel', height: 13, curve: 0.7 });
  c.rect(cx - 1, 13, 2, 2, shift(MATERIAL.gold, -0.26), { shape: 'flat', height: 13 });
  finish(c);
  return c;
}

/** Open chest — lid tilted back, glowing loot spilling light from inside. */
function chestOpen(): PixelCanvas {
  const c = new PixelCanvas(30, 28);
  const cx = 15;
  const wood = MATERIAL.wood;
  c.groundShadow(cx, 25, 14, 3.2, 0.36);
  // Body box.
  c.rect(cx - 12, 14, 24, 11, wood, { shape: 'bevel', height: 7, curve: 0.5 });
  // Open interior — dark, with warm loot glow.
  c.rect(cx - 10, 11, 20, 5, '#1c1620', { shape: 'flat', height: 8, emissive: true });
  c.ellipse(cx, 13, 9, 3, MATERIAL.gold, { shape: 'flat', emissive: true, alpha: 0.9 });
  c.ellipse(cx, 13, 5, 2, '#ffe9a8', { shape: 'flat', emissive: true });
  // Loot glints.
  c.rect(cx - 4, 12, 1, 1, '#fff6d8', { emissive: true });
  c.rect(cx + 3, 13, 1, 1, '#fff6d8', { emissive: true });
  // Tilted-back lid above.
  c.rect(cx - 12, 3, 24, 6, shift(wood, -0.04), { shape: 'cylinder-x', height: 12, curve: 0.95 });
  c.rect(cx - 12, 8, 24, 1.5, shift(MATERIAL.iron, -0.06), { shape: 'flat', height: 12 });
  for (const dx of [-8, 8]) {
    c.rect(cx + dx, 3, 2, 6, MATERIAL.iron, { shape: 'cylinder-y', height: 13, curve: 0.8 });
  }
  finish(c);
  return c;
}

/** A glowing void doorway — a stone frame around a shimmering purple portal. */
function doorGlow(): PixelCanvas {
  const c = new PixelCanvas(24, 32);
  const cx = 12;
  const stone = MATERIAL.stoneDark;
  c.groundShadow(cx, 29, 11, 3, 0.34);
  // Portal fill (emissive gradient feel via stacked ellipses).
  c.rect(cx - 6, 4, 12, 24, mix(MATERIAL.voidPurple, '#140a1e', 0.2), { shape: 'flat', height: 3, emissive: true });
  c.ellipse(cx, 16, 5, 11, MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.7 });
  c.ellipse(cx, 16, 3, 8, MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.6 });
  c.ellipse(cx, 14, 1.5, 5, '#f0d0ff', { shape: 'flat', emissive: true, alpha: 0.7 });
  // Stone frame: two jambs + a lintel, bevelled.
  c.rect(cx - 9, 2, 4, 27, stone, { shape: 'bevel', height: 8, curve: 0.6 });
  c.rect(cx + 5, 2, 4, 27, shift(stone, -0.06), { shape: 'bevel', height: 8, curve: 0.6 });
  c.rect(cx - 9, 0, 18, 5, shift(stone, 0.04), { shape: 'cylinder-x', height: 9, curve: 0.7 });
  // Rune marks on the lintel.
  c.rect(cx - 4, 2, 1, 1, MATERIAL.voidBright, { emissive: true });
  c.rect(cx + 3, 2, 1, 1, MATERIAL.voidBright, { emissive: true });
  finish(c);
  return c;
}

/** The mine lift: a timber cage on rails with a crank wheel. */
function mineLift(): PixelCanvas {
  const c = new PixelCanvas(42, 44);
  const cx = 21;
  const wood = MATERIAL.wood;
  const iron = MATERIAL.iron;
  c.groundShadow(cx, 40, 18, 4, 0.38);
  // Back panel / cage interior (dark).
  c.rect(cx - 15, 8, 30, 30, '#1b1620', { shape: 'flat', height: 3, emissive: true });
  // Four corner posts.
  for (const dx of [-15, 12]) {
    c.rect(cx + dx, 5, 3, 33, wood, { shape: 'cylinder-y', height: 9, curve: 0.9 });
  }
  // Top beam + roof.
  c.rect(cx - 17, 3, 34, 4, shift(wood, 0.04), { shape: 'cylinder-x', height: 11, curve: 0.8 });
  // Cross-braces (X on the back).
  c.line(cx - 13, 10, cx + 13, 34, shift(wood, -0.06), 2, { height: 5 });
  c.line(cx + 13, 10, cx - 13, 34, shift(wood, -0.06), 2, { height: 5 });
  // Horizontal rails.
  c.rect(cx - 13, 20, 26, 2, shift(iron, -0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
  c.rect(cx - 13, 33, 26, 3, iron, { shape: 'cylinder-x', height: 6, curve: 0.8 });
  // Crank wheel on the side.
  c.circle(cx + 15, 16, 5, iron, { shape: 'round', height: 8, curve: 0.9 });
  c.circle(cx + 15, 16, 2.5, '#1b1620', { shape: 'flat', height: 9, emissive: true });
  c.rect(cx + 14, 12, 2, 8, shift(iron, 0.08), { shape: 'cylinder-y', height: 9 });
  finish(c);
  return c;
}

/** A stone well with a wooden roof and a bucket on a rope. */
function well(): PixelCanvas {
  const c = new PixelCanvas(32, 34);
  const cx = 16;
  const stone = MATERIAL.granite;
  c.groundShadow(cx, 31, 15, 3.6, 0.36);
  // Stone rim (cylinder-x drum).
  c.rect(cx - 11, 20, 22, 11, stone, { shape: 'cylinder-x', height: 6, curve: 0.85 });
  // Dark water hole at the top.
  c.ellipse(cx, 20, 10, 3.4, '#12161e', { shape: 'flat', height: 7, emissive: true });
  c.ellipse(cx, 21, 6, 2, mix(MATERIAL.water, '#0e1420', 0.4), { shape: 'flat', emissive: true, alpha: 0.7 });
  // Stone courses.
  c.rect(cx - 11, 25, 22, 1, shift(stone, -0.16), { shape: 'flat', height: 7, shade: 0.8 });
  // Roof posts.
  c.rect(cx - 9, 4, 2, 17, MATERIAL.wood, { shape: 'cylinder-y', height: 8, curve: 0.9 });
  c.rect(cx + 7, 4, 2, 17, shift(MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 8, curve: 0.9 });
  // Peaked roof (two slopes).
  c.polygon([[cx, 0], [cx - 12, 8], [cx - 8, 8]], MATERIAL.thatch, { shape: 'flat', height: 11 });
  c.polygon([[cx, 0], [cx + 12, 8], [cx + 8, 8]], shift(MATERIAL.thatch, -0.12, 6), { shape: 'flat', height: 11 });
  c.polygon([[cx, 0], [cx - 12, 8], [cx + 12, 8]], MATERIAL.thatch, { shape: 'cone', height: 10, curve: 0.6, alpha: 0.001 });
  c.rect(cx - 12, 7, 24, 2, shift(MATERIAL.wood, 0.02), { shape: 'cylinder-x', height: 9, curve: 0.7 });
  // Bucket hanging under the roof.
  c.line(cx, 9, cx, 15, MATERIAL.rust, 1, { height: 6 });
  c.rect(cx - 2, 15, 4, 4, MATERIAL.woodPale, { shape: 'cylinder-y', height: 7, curve: 0.8 });
  finish(c);
  return c;
}

/** A hand cart: a wooden bed on a big spoked wheel with handles. */
function cart(): PixelCanvas {
  const c = new PixelCanvas(38, 26);
  const cx = 19;
  const wood = MATERIAL.wood;
  c.groundShadow(cx, 23, 17, 3.2, 0.34);
  // Big wheel.
  c.circle(9, 16, 7, MATERIAL.iron, { shape: 'round', height: 5, curve: 0.9 });
  c.circle(9, 16, 5, shift(wood, -0.04), { shape: 'round', height: 4, curve: 0.9 });
  c.circle(9, 16, 1.6, MATERIAL.iron, { shape: 'flat', height: 6 });
  // Spokes.
  for (let a = 0; a < 4; a += 1) {
    const ang = (a / 4) * Math.PI;
    c.line(9 - Math.cos(ang) * 5, 16 - Math.sin(ang) * 5, 9 + Math.cos(ang) * 5, 16 + Math.sin(ang) * 5, shift(wood, 0.08), 1, { height: 5 });
  }
  // Cart bed, tilted, with plank seams.
  c.polygon([[cx - 6, 6], [cx + 14, 8], [cx + 13, 15], [cx - 7, 13]], wood, { shape: 'bevel', height: 8, curve: 0.5 });
  c.line(cx - 6, 9, cx + 13, 11, shift(wood, -0.14), 1, { height: 9, shade: 0.8 });
  c.line(cx - 5, 6, cx + 13, 8, shift(wood, 0.12), 1, { height: 9 });
  // Handle shafts extending to the right.
  c.line(cx + 13, 10, cx + 19, 12, shift(wood, -0.02), 2, { shape: 'cylinder-y', height: 7 });
  c.line(cx + 13, 13, cx + 18, 15, shift(wood, -0.04), 2, { shape: 'cylinder-y', height: 7 });
  finish(c);
  return c;
}

/** A leaning fence post with a broken rail stub. */
function fencePost(): PixelCanvas {
  const c = new PixelCanvas(14, 28);
  const cx = 7;
  const wood = shift(MATERIAL.wood, 0.02, 8);
  c.groundShadow(cx, 25, 6, 2.4, 0.3);
  // Post, slightly leaning.
  c.polygon([[cx - 2, 25], [cx + 2, 25], [cx + 3, 4], [cx - 1, 4]], wood, { shape: 'cylinder-y', height: 6, curve: 0.9 });
  // Split top.
  c.polygon([[cx - 1, 4], [cx + 3, 4], [cx + 1, 1]], shift(wood, 0.08), { shape: 'cone', height: 7, curve: 0.7 });
  // Rail stub.
  c.rect(cx + 1, 12, 6, 3, shift(wood, -0.04), { shape: 'cylinder-x', height: 7, curve: 0.8 });
  // Grain lines.
  c.line(cx, 6, cx + 1, 24, shift(wood, -0.14), 1, { height: 6, shade: 0.85 });
  finish(c);
  return c;
}

/** A hanging banner on a crossbar — dark cloth with a void sigil. */
function banner(): PixelCanvas {
  const c = new PixelCanvas(20, 34);
  const cx = 10;
  const cloth = MATERIAL.cloth;
  c.groundShadow(cx, 31, 6, 2, 0.28);
  // Pole + crossbar.
  c.rect(cx - 1, 2, 2, 30, MATERIAL.wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
  c.rect(cx - 6, 4, 13, 2, shift(MATERIAL.wood, -0.04), { shape: 'cylinder-x', height: 6, curve: 0.8 });
  // Cloth hanging, with a swallowtail bottom.
  c.polygon([
    [cx - 5, 6], [cx + 6, 6], [cx + 6, 24], [cx + 3, 21], [cx + 0.5, 25], [cx - 2, 21], [cx - 5, 24],
  ], cloth, { shape: 'cylinder-y', height: 4, curve: 0.85 });
  // Lit left fold / shadow right.
  c.rect(cx - 5, 7, 3, 16, shift(cloth, 0.1), { shape: 'flat', height: 5 });
  c.rect(cx + 3, 7, 3, 15, shift(cloth, -0.12, 6), { shape: 'flat', height: 4 });
  // Void sigil.
  c.circle(cx, 13, 3, MATERIAL.voidPurple, { shape: 'flat', height: 5 });
  c.circle(cx, 13, 1.4, MATERIAL.voidBright, { shape: 'flat', emissive: true });
  finish(c);
  return c;
}

/** A wooden signpost with an arrow board. */
function signpost(): PixelCanvas {
  const c = new PixelCanvas(24, 30);
  const cx = 9;
  const wood = MATERIAL.woodPale;
  c.groundShadow(cx, 27, 6, 2.2, 0.3);
  // Post.
  c.rect(cx - 1.5, 6, 3, 21, wood, { shape: 'cylinder-y', height: 5, curve: 0.9 });
  // Arrow board pointing right.
  c.polygon([[cx - 2, 8], [cx + 12, 8], [cx + 17, 12], [cx + 12, 16], [cx - 2, 16]], shift(wood, 0.02, 6), { shape: 'bevel', height: 7, curve: 0.5 });
  // Board plank line + a couple of carved marks.
  c.line(cx - 1, 12, cx + 13, 12, shift(wood, -0.14), 1, { height: 8, shade: 0.85 });
  c.rect(cx + 2, 10, 6, 1, shift(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
  c.rect(cx + 2, 13, 4, 1, shift(wood, -0.2), { shape: 'flat', height: 8, shade: 0.7 });
  finish(c);
  return c;
}

/** A single bridge plank segment with rope rails — tiles along a span. */
function bridgePlank(): PixelCanvas {
  const c = new PixelCanvas(30, 20);
  const cx = 15;
  const wood = MATERIAL.wood;
  c.groundShadow(cx, 16, 14, 3, 0.28);
  // Planks laid across (several short cylinders side by side).
  for (let i = 0; i < 5; i += 1) {
    const x = cx - 12 + i * 5;
    c.rect(x, 6, 4, 10, shift(wood, i % 2 ? -0.05 : 0.03, 4), { shape: 'cylinder-y', height: 4, curve: 0.85 });
  }
  // Side stringers.
  c.rect(cx - 13, 6, 26, 1.5, shift(wood, -0.14), { shape: 'flat', height: 5, shade: 0.85 });
  c.rect(cx - 13, 14, 26, 1.5, shift(wood, -0.16), { shape: 'flat', height: 5, shade: 0.85 });
  // Rope rail posts + line.
  c.rect(cx - 12, 2, 2, 5, shift(MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 7 });
  c.rect(cx + 10, 2, 2, 5, shift(MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 7 });
  c.line(cx - 11, 3, cx + 11, 3, MATERIAL.rust, 1, { height: 8 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Monuments
// ---------------------------------------------------------------------------

/** A weathered stone statue of a hooded figure on a plinth. */
function statue(): PixelCanvas {
  const c = new PixelCanvas(28, 46);
  const cx = 14;
  const stone = shift(MATERIAL.granite, 0.02, 4);
  c.groundShadow(cx, 42, 13, 3.6, 0.38);
  // Plinth.
  c.rect(cx - 10, 36, 20, 7, shift(stone, -0.06, 6), { shape: 'bevel', height: 5, curve: 0.5 });
  c.rect(cx - 8, 33, 16, 4, stone, { shape: 'cylinder-x', height: 7, curve: 0.6 });
  // Robed body: a tapering cloak (wide base, narrow shoulders).
  c.polygon([[cx - 8, 33], [cx + 8, 33], [cx + 5, 14], [cx - 5, 14]], stone, { shape: 'cylinder-y', height: 10, curve: 0.9 });
  // Fold shadows down the robe.
  c.line(cx - 2, 15, cx - 4, 32, shift(stone, -0.14), 1, { height: 11, shade: 0.85 });
  c.line(cx + 2, 15, cx + 3, 32, shift(stone, -0.12), 1, { height: 11, shade: 0.85 });
  // Cowl shoulders + hooded head (empty dark hood face).
  c.ellipse(cx, 12, 7, 5, stone, { shape: 'dome', height: 13, curve: 0.9 });
  c.ellipse(cx, 8, 5, 5.5, shift(stone, 0.02), { shape: 'dome', height: 15, curve: 0.95 });
  c.ellipse(cx, 9, 3, 3.5, '#1b1a20', { shape: 'flat', height: 15, emissive: true });
  // Lit crown edge, weathered.
  c.ellipse(cx - 1, 5, 3, 2, shift(stone, 0.14), { shape: 'dome', height: 16, curve: 0.8 });
  // A crack down the plinth for age.
  c.line(cx + 3, 34, cx + 5, 42, shift(stone, -0.24), 1, { height: 5, shade: 0.7 });
  finish(c);
  return c;
}

/** A tall carved obelisk with glowing runes down its face. */
function obelisk(): PixelCanvas {
  const c = new PixelCanvas(22, 50);
  const cx = 11;
  const stone = MATERIAL.slate;
  c.groundShadow(cx, 46, 11, 3.4, 0.38);
  // Base.
  c.rect(cx - 8, 40, 16, 6, shift(stone, -0.06, 6), { shape: 'bevel', height: 5, curve: 0.5 });
  // Tapering shaft (four-sided, so we show a lit front face + darker side).
  c.polygon([[cx - 6, 42], [cx + 6, 42], [cx + 3, 6], [cx - 3, 6]], stone, { shape: 'cylinder-y', height: 9, curve: 0.7 });
  // Right side plane, darker (implies the corner).
  c.polygon([[cx + 2, 42], [cx + 6, 42], [cx + 3, 6], [cx + 1, 6]], shift(stone, -0.14, 6), { shape: 'flat', height: 8 });
  // Pyramidal cap.
  c.polygon([[cx - 3, 6], [cx + 3, 6], [cx, 0]], shift(stone, 0.04), { shape: 'cone', height: 11, curve: 0.9 });
  // Glowing runes running up the face.
  for (let i = 0; i < 4; i += 1) {
    const y = 34 - i * 8;
    c.rect(cx - 1.5, y, 3, 3, mix(MATERIAL.spirit, '#1a2030', 0.2), { shape: 'flat', height: 10, emissive: true, alpha: 0.85 });
    c.rect(cx - 0.5, y + 1, 1, 1, '#dfeaff', { emissive: true });
  }
  finish(c);
  return c;
}

/** A crypt entrance: a stone arch over a pitch-dark descending doorway. */
function cryptEntrance(): PixelCanvas {
  const c = new PixelCanvas(40, 34);
  const cx = 20;
  const stone = MATERIAL.stoneDark;
  c.groundShadow(cx, 31, 19, 3.6, 0.38);
  // Mound / façade behind.
  c.ellipse(cx, 20, 19, 13, shift(stone, -0.04, 4), { shape: 'dome', height: 8, curve: 0.85 });
  // Dark doorway (arched).
  c.rect(cx - 7, 14, 14, 18, '#0e0c12', { shape: 'flat', height: 3, emissive: true });
  c.ellipse(cx, 14, 7, 5, '#0e0c12', { shape: 'flat', height: 3, emissive: true });
  // Stone arch voussoirs framing it.
  c.rect(cx - 10, 12, 3, 20, stone, { shape: 'bevel', height: 9, curve: 0.6 });
  c.rect(cx + 7, 12, 3, 20, shift(stone, -0.06), { shape: 'bevel', height: 9, curve: 0.6 });
  // Keystone arch across the top.
  for (let i = 0; i < 7; i += 1) {
    const ang = Math.PI * (0.15 + (i / 6) * 0.7);
    const bx = cx - Math.cos(ang) * 10;
    const by = 14 - Math.sin(ang) * 7;
    c.rect(bx - 1.5, by - 1.5, 3.5, 3.5, shift(stone, i === 3 ? 0.1 : 0), { shape: 'bevel', height: 10, curve: 0.6 });
  }
  // A skull set above the keystone.
  c.ellipse(cx, 6, 2.6, 2.4, MATERIAL.boneOld, { shape: 'round', height: 11, curve: 0.9 });
  c.rect(cx - 1, 6, 1, 1, '#1c1a1f', { emissive: true });
  c.rect(cx + 0.5, 6, 1, 1, '#1c1a1f', { emissive: true });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Forge & mine
// ---------------------------------------------------------------------------

/** An anvil on a stump base — classic horned silhouette. */
function anvil(): PixelCanvas {
  const c = new PixelCanvas(32, 28);
  const cx = 15;
  const iron = MATERIAL.steelDark;
  c.groundShadow(cx, 25, 13, 3.2, 0.36);

  // Wooden stump base, wider at the foot.
  c.rect(cx - 6, 19, 13, 6, MATERIAL.wood, { shape: 'cylinder-y', height: 4, curve: 0.85 });
  c.rect(cx - 4, 16, 9, 4, shift(MATERIAL.wood, -0.04), { shape: 'cylinder-y', height: 5, curve: 0.85 });

  // Narrow iron waist under the body.
  c.rect(cx - 3, 12, 7, 5, iron, { shape: 'cylinder-y', height: 7, curve: 0.85 });
  // Splayed foot flaring out from the waist for a stable stance.
  c.polygon([[cx - 6, 16], [cx + 7, 16], [cx + 4, 12], [cx - 3, 12]], shift(iron, -0.04), { shape: 'bevel', height: 7, curve: 0.6 });

  // Main body: a chunky block. The top face sits proud of it.
  c.rect(cx - 6, 7, 15, 5, iron, { shape: 'cylinder-x', height: 10, curve: 0.7 });
  // The pointed horn tapering left off the body.
  c.polygon([[cx - 6, 7], [cx - 14, 8.5], [cx - 6, 11]], shift(iron, 0.02), { shape: 'cone', height: 10, curve: 0.85 });
  // Squared heel/step on the right.
  c.rect(cx + 8, 8, 3, 4, shift(iron, -0.06), { shape: 'bevel', height: 10, curve: 0.6 });

  // Flat polished top face — a bright plane is the strongest anvil read.
  c.rect(cx - 7, 6, 17, 2, MATERIAL.steel, { shape: 'flat', height: 12 });
  c.rect(cx - 7, 6, 17, 1, shift(MATERIAL.steel, 0.12), { shape: 'flat', height: 12 });
  // Shadow line where the face overhangs the waist.
  c.rect(cx - 5, 11, 12, 1, shift(iron, -0.18), { shape: 'flat', height: 8, shade: 0.7 });
  finish(c);
  return c;
}

/** A forge fire: a stone hearth with roaring emissive flames and a chimney hood. */
function forgeFire(): PixelCanvas {
  const c = new PixelCanvas(34, 32);
  const cx = 17;
  const stone = MATERIAL.stoneDark;
  c.groundShadow(cx, 29, 16, 3.4, 0.36);
  // Glow.
  c.ellipse(cx, 18, 15, 12, MATERIAL.flame, { shape: 'flat', emissive: true, alpha: 0.16 });
  // Stone hearth box.
  c.rect(cx - 13, 16, 26, 12, stone, { shape: 'bevel', height: 7, curve: 0.55 });
  c.rect(cx - 13, 16, 26, 1.5, shift(stone, 0.12), { shape: 'flat', height: 8 });
  // Fire cavity (dark then hot).
  c.rect(cx - 8, 14, 16, 10, '#1a0f10', { shape: 'flat', height: 4, emissive: true });
  // Coal bed.
  c.ellipse(cx, 20, 8, 3, MATERIAL.ember, { shape: 'flat', emissive: true });
  c.ellipse(cx, 20, 5, 2, MATERIAL.emberCore, { shape: 'flat', emissive: true });
  // Flames.
  c.ellipse(cx - 3, 15, 3, 6, MATERIAL.ember, { shape: 'cone', emissive: true });
  c.ellipse(cx + 2, 14, 3.5, 7, MATERIAL.emberCore, { shape: 'cone', emissive: true });
  c.ellipse(cx, 11, 2.4, 6, MATERIAL.flame, { shape: 'cone', emissive: true });
  c.ellipse(cx + 1, 9, 1.4, 4, '#fff0b0', { shape: 'flat', emissive: true });
  // Chimney hood above.
  c.polygon([[cx - 11, 8], [cx + 11, 8], [cx + 6, 0], [cx - 6, 0]], shift(stone, -0.04, 6), { shape: 'cylinder-y', height: 10, curve: 0.7 });
  finish(c);
  return c;
}

/** An ore vein embedded in rock — dark stone shot through with glowing crystals. */
function oreVein(): PixelCanvas {
  const c = new PixelCanvas(28, 22);
  const cx = 14;
  const stone = MATERIAL.stoneDark;
  const gem = mix(MATERIAL.spirit, MATERIAL.voidBright, 0.3);
  c.groundShadow(cx, 19, 12, 3, 0.34);
  // Rock mass.
  c.ellipse(cx, 12, 13, 8, stone, { shape: 'round', height: 7, curve: 0.95 });
  c.polygon([[cx - 10, 12], [cx - 3, 6], [cx, 11], [cx - 5, 17]], shift(stone, 0.08), { shape: 'bevel', height: 8, curve: 0.6 });
  // Glowing crystal clusters set into the facets.
  const gems: Array<[number, number, number]> = [[-4, 9, 2], [3, 8, 2.4], [6, 13, 1.8], [-1, 14, 1.6], [-7, 12, 1.4]];
  for (const [dx, cy, r] of gems) {
    c.ellipse(cx + dx, cy, r, r * 1.2, gem, { shape: 'cone', height: 9, emissive: true });
    c.rect(cx + dx, cy - 1, 1, 1, '#eafbff', { emissive: true });
    // Faint bloom.
    c.ellipse(cx + dx, cy, r + 1.5, r + 1.5, gem, { shape: 'flat', emissive: true, alpha: 0.12 });
  }
  finish(c);
  return c;
}

/** A length of mine track — wooden ties and iron rails, seen along the run. */
function mineTrack(): PixelCanvas {
  const c = new PixelCanvas(30, 16);
  const cx = 15;
  const wood = shift(MATERIAL.wood, -0.02, 6);
  c.groundShadow(cx, 13, 14, 2.4, 0.24);
  // Ties across.
  for (let i = 0; i < 5; i += 1) {
    const x = cx - 12 + i * 6;
    c.rect(x, 5, 3, 8, shift(wood, i % 2 ? -0.04 : 0.04), { shape: 'cylinder-y', height: 3, curve: 0.8 });
  }
  // Two iron rails running the length.
  c.rect(cx - 13, 6, 26, 1.5, MATERIAL.iron, { shape: 'cylinder-x', height: 5, curve: 0.9 });
  c.rect(cx - 13, 11, 26, 1.5, shift(MATERIAL.iron, -0.04), { shape: 'cylinder-x', height: 5, curve: 0.9 });
  // Rail highlights.
  c.rect(cx - 13, 6, 26, 0.5, shift(MATERIAL.steel, 0.05), { shape: 'flat', height: 6 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Chains, misc
// ---------------------------------------------------------------------------

/** A hanging chain — interlocked iron links. */
function chain(): PixelCanvas {
  const c = new PixelCanvas(12, 30);
  const cx = 6;
  const iron = MATERIAL.iron;
  // Links alternate orientation so they read as interlocked.
  for (let i = 0; i < 6; i += 1) {
    const y = 3 + i * 4.5;
    if (i % 2 === 0) {
      c.ellipse(cx, y, 2.6, 2, iron, { shape: 'round', height: 5, curve: 1 });
      c.ellipse(cx, y, 1.2, 1, '#1b1b22', { shape: 'flat', height: 6, emissive: true });
    } else {
      c.ellipse(cx, y, 1.8, 2.6, shift(iron, -0.06), { shape: 'round', height: 5, curve: 1 });
      c.ellipse(cx, y, 0.8, 1.4, '#1b1b22', { shape: 'flat', height: 6, emissive: true });
    }
  }
  finish(c);
  return c;
}

/** A protective charm — a gold amulet on a cord with a purple gem. */
function charm(): PixelCanvas {
  const c = new PixelCanvas(14, 18);
  const cx = 7;
  const gold = MATERIAL.gold;
  c.groundShadow(cx, 15, 5, 1.8, 0.24);
  // Cord loop.
  c.ellipse(cx, 4, 3, 3, MATERIAL.leatherDark, { shape: 'round', height: 4, curve: 1 });
  c.ellipse(cx, 4, 1.6, 1.6, '#161018', { shape: 'flat', height: 5, emissive: true });
  // Amulet disc.
  c.circle(cx, 11, 4, gold, { shape: 'round', height: 6, curve: 1 });
  c.circle(cx, 11, 2.6, shift(gold, -0.14, -6), { shape: 'flat', height: 6, shade: 0.85 });
  // Gem.
  c.circle(cx, 11, 1.6, MATERIAL.voidBright, { shape: 'round', height: 7, emissive: true });
  c.rect(cx - 1, 10, 1, 1, '#f4d9ff', { emissive: true });
  // Rim highlight.
  c.ellipse(cx - 1, 9, 1.6, 1, shift(gold, 0.2), { shape: 'flat', height: 7 });
  finish(c);
  return c;
}

// ---------------------------------------------------------------------------
// Effects & particles (small, mostly emissive)
// ---------------------------------------------------------------------------

/** The rift core: a jagged void crystal pouring purple light. */
function riftCore(): PixelCanvas {
  const c = new PixelCanvas(34, 44);
  const cx = 17;
  c.groundShadow(cx, 40, 15, 4, 0.3);
  // Outer glow bloom.
  c.ellipse(cx, 22, 16, 20, MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.12 });
  c.ellipse(cx, 22, 10, 16, MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.16 });
  // Dark crystal body (a tall shard).
  c.polygon([[cx, 3], [cx + 8, 20], [cx + 4, 40], [cx - 5, 38], [cx - 8, 18]], mix(MATERIAL.voidPurple, '#140a1e', 0.45), { shape: 'cone', height: 10, emissive: true });
  // Inner glowing cracks.
  c.polygon([[cx, 6], [cx + 4, 22], [cx, 37], [cx - 3, 20]], MATERIAL.voidPurple, { shape: 'cone', height: 11, emissive: true });
  c.polygon([[cx, 10], [cx + 2, 24], [cx, 34], [cx - 1, 22]], MATERIAL.voidBright, { shape: 'flat', emissive: true });
  c.line(cx, 8, cx, 34, '#f0d0ff', 1, { emissive: true });
  // Floating shards around it.
  c.polygon([[cx - 11, 18], [cx - 8, 20], [cx - 10, 24]], MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.85 });
  c.polygon([[cx + 10, 26], [cx + 13, 24], [cx + 12, 30]], MATERIAL.voidBright, { shape: 'flat', emissive: true, alpha: 0.85 });
  return c; // no dark outline — it's a light source, keep the bloom soft
}

/** A firefly mote — a tiny green-gold glow with a soft halo. */
function firefly(): PixelCanvas {
  const c = new PixelCanvas(6, 6);
  const cx = 3;
  const glow = mix(MATERIAL.toxic, '#d9ff9c', 0.6);
  c.circle(cx, 3, 3, glow, { shape: 'flat', emissive: true, alpha: 0.3 });
  c.circle(cx, 3, 1.4, '#eaffb0', { shape: 'flat', emissive: true });
  c.rect(cx - 0.5, 2.5, 1, 1, '#ffffff', { emissive: true });
  return c;
}

/** A rising ember — hot core with a cooling trail. */
function ember(): PixelCanvas {
  const c = new PixelCanvas(6, 8);
  const cx = 3;
  c.rect(cx - 1, 3, 2, 4, MATERIAL.ember, { shape: 'flat', emissive: true, alpha: 0.7 });
  c.rect(cx - 1, 1, 2, 3, MATERIAL.emberCore, { shape: 'flat', emissive: true });
  c.rect(cx - 0.5, 0.5, 1, 1.5, '#ffe9a8', { emissive: true });
  return c;
}

/** An arrow/bolt projectile — a shaft with a bright tip and fletching. */
function projectileBolt(): PixelCanvas {
  const c = new PixelCanvas(14, 4);
  // Shaft.
  c.rect(1, 1, 10, 2, MATERIAL.bone, { shape: 'cylinder-x', height: 3, curve: 0.9 });
  // Toxic-lit tip.
  c.polygon([[10, 0], [14, 2], [10, 4]], MATERIAL.toxic, { shape: 'cone', height: 4, emissive: true });
  // Fletching.
  c.polygon([[0, 0], [3, 2], [0, 4]], shift(MATERIAL.moss, 0.1), { shape: 'flat', height: 3 });
  return c;
}

/** A magic projectile — a glowing violet orb with a bright core. */
function projectileMagic(): PixelCanvas {
  const c = new PixelCanvas(10, 10);
  const cx = 5;
  c.circle(cx, 5, 5, MATERIAL.voidPurple, { shape: 'flat', emissive: true, alpha: 0.35 });
  c.circle(cx, 5, 3, MATERIAL.voidBright, { shape: 'round', height: 4, emissive: true });
  c.circle(cx, 5, 1.6, '#f4d9ff', { shape: 'flat', emissive: true });
  c.rect(cx - 0.5, 4, 1, 1, '#ffffff', { emissive: true });
  return c;
}

/** A four-point spark flash. */
function spark(): PixelCanvas {
  const c = new PixelCanvas(6, 6);
  const cx = 3;
  c.rect(cx - 0.5, 0, 1, 6, '#fff1a1', { emissive: true });
  c.rect(0, cx - 0.5, 6, 1, '#fff1a1', { emissive: true });
  c.rect(cx - 1, cx - 1, 2, 2, '#ffffff', { emissive: true });
  return c;
}

/** A soft ground shadow blob, kept as a standalone texture the game reuses. */
function shadowBlob(): PixelCanvas {
  const c = new PixelCanvas(18, 8);
  c.groundShadow(9, 4, 8, 3.4, 0.42);
  return c;
}

/** A single white pixel — used for tinted particles and fills. */
function pixel(): PixelCanvas {
  const c = new PixelCanvas(2, 2);
  c.rect(0, 0, 2, 2, '#ffffff', { emissive: true });
  return c;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Props that come in 3 variants (variant-aware builders). */
const VARIANT_BUILDERS: Record<string, (v: number) => PixelCanvas> = {
  tree,
  'tree-dead': treeDead,
  'tree-pine': treePine,
  rock,
  rubble,
  bush,
  grave,
};

/** Single-shape builders. */
const SINGLE_BUILDERS: Record<string, () => PixelCanvas> = {
  stump,
  fern,
  reeds,
  'mushroom-cluster': mushroomCluster,
  'ash-pile': ashPile,
  'cracked-ground': crackedGround,
  puddle,
  lilypad,
  'bog-bubble': bogBubble,
  'tombstone-cross': tombstoneCross,
  bones,
  skull,
  'herb-moonwort': herbMoonwort,
  'herb-shadebloom': herbShadebloom,
  'herb-bog-reed': herbBogReed,
  glowcap,
  'flower-patch': flowerPatch,
  'lantern-off': lanternOff,
  'lantern-on': lanternOn,
  altar,
  'brazier-lit': brazierLit,
  'brazier-cold': brazierCold,
  campfire,
  'torch-wall': torchWall,
  cargo,
  'miner-tools': minerTools,
  crate,
  barrel,
  sack,
  'hay-bale': hayBale,
  tent,
  'chest-closed': chestClosed,
  'chest-open': chestOpen,
  'door-glow': doorGlow,
  'mine-lift': mineLift,
  well,
  cart,
  'fence-post': fencePost,
  banner,
  signpost,
  'bridge-plank': bridgePlank,
  statue,
  obelisk,
  'crypt-entrance': cryptEntrance,
  anvil,
  'forge-fire': forgeFire,
  'ore-vein': oreVein,
  'mine-track': mineTrack,
  chain,
  charm,
  'rift-core': riftCore,
  firefly,
  ember,
  'projectile-bolt': projectileBolt,
  'projectile-magic': projectileMagic,
  spark,
  shadow: shadowBlob,
  pixel,
};

/**
 * Render a prop by key.
 *
 * Variant keys work three ways so the game can reference whatever it has:
 *  - bare key (`tree`) → variant 0
 *  - suffixed key (`tree-2`) → that variant
 *  - explicit `variant` argument on the bare key → that variant
 * Variant indices wrap, so any integer is safe.
 */
export function renderProp(key: string, variant = 0): PixelCanvas {
  // Suffixed variant form, e.g. "tree-1" — but only when the prefix is a
  // registered variant builder (so "tree-dead" and "herb-bog-reed" are safe).
  const dash = key.lastIndexOf('-');
  if (dash > 0) {
    const prefix = key.slice(0, dash);
    const suffix = key.slice(dash + 1);
    if (VARIANT_BUILDERS[prefix] && /^\d+$/.test(suffix)) {
      return VARIANT_BUILDERS[prefix](Number(suffix) % 3);
    }
  }
  if (VARIANT_BUILDERS[key]) return VARIANT_BUILDERS[key](((variant % 3) + 3) % 3);
  const single = SINGLE_BUILDERS[key];
  if (single) return single();
  // Unknown key: a small neutral placeholder rather than throwing, so a bad
  // reference in the game degrades to a visible marker instead of a crash.
  const c = new PixelCanvas(8, 8);
  c.rect(1, 1, 6, 6, MATERIAL.blood, { shape: 'bevel', height: 3 });
  finish(c);
  return c;
}

/** Every prop key the factory can produce (variant props expanded to -0/-1/-2). */
export const PROP_KEYS: string[] = [
  ...Object.keys(VARIANT_BUILDERS).flatMap((k) => [k, `${k}-0`, `${k}-1`, `${k}-2`]),
  ...Object.keys(SINGLE_BUILDERS),
];

/**
 * Every prop frame as (key, canvas) pairs, for baking into the texture atlas.
 * Variant props emit their bare alias (variant 0) plus all three numbered
 * variants so the game can pick any of them by name.
 */
export function buildPropFrames(): Array<{ key: string; canvas: PixelCanvas }> {
  const frames: Array<{ key: string; canvas: PixelCanvas }> = [];
  for (const key of Object.keys(VARIANT_BUILDERS)) {
    frames.push({ key, canvas: VARIANT_BUILDERS[key](0) }); // bare alias = variant 0
    for (let v = 0; v < 3; v += 1) {
      frames.push({ key: `${key}-${v}`, canvas: VARIANT_BUILDERS[key](v) });
    }
  }
  for (const key of Object.keys(SINGLE_BUILDERS)) {
    frames.push({ key, canvas: SINGLE_BUILDERS[key]() });
  }
  return frames;
}
