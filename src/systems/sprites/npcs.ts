/**
 * The townsfolk — Trupy's NPC sprite factory.
 *
 * These are the ten humans the exile meets in the valley. They live in the same
 * world as the hero (see ./hero.ts) and must read as the same *art*: sculpted
 * from shaped primitives rather than stacked rectangles, lit by the same
 * depth-aware pass in PixelCanvas, outlined with the same dark keyline. So the
 * anatomy approach is deliberately the hero's — torso is a cylinder, head a
 * dome, shoulders and joints are spheres — and the shared conventions hold:
 * groundShadow first, body drawn back-to-front, outline last.
 *
 * What separates one villager from the next is *silhouette and profession*, not
 * surface detail. A player recognises the blacksmith by her bare broad arms and
 * the hammer, the priestess by her tall hood and bowed head, the miner by the
 * lamp on his helmet — all before any colour registers. So each NPC is built
 * around one unmistakable read:
 *
 *   mora     tall austere hood, head bowed over prayer beads
 *   runa     broad shoulders, bare muscled arms, leather apron, hammer
 *   gran     stooped and short, leaning on a staff, lantern in hand
 *   vesna    hooded, light + lithe, bow in hand, quiver of arrows on back
 *   elira    slight, long loose hair, simple dress and shawl
 *   orrin    well-fed and round, fine coat, ledger under arm, coin pouch
 *   ferryman wide flat hat, oilskin cloak, tall pole/oar
 *   iva      wild-haired witch, ragged bog-green robes, herb basket
 *   bram     helmet with a glowing lamp, pickaxe over shoulder, dusty
 *   serah    broken plate armour, red scarf trailing, sword sheathed at hip
 *
 * Every NPC uses their `accent` colour (from NPCS in content.ts) as the dominant
 * garment hue, so the sprite matches the accent that themes their dialogue and
 * home interior. Accents are inlined here as hex — like enemies.ts, this keeps
 * the sprite layer free of an import cycle with the data/content layer.
 */

import { PixelCanvas, type DrawOptions } from '../render/PixelCanvas';
import { MATERIAL, mix, shift } from '../render/Palette';

/** Shared canvas footprint. Generous enough that staves, bows and gesturing
 * arms never clip the edge; matches the hero's proportions so scale reads true
 * when both stand in the same scene. */
export const NPC_W = 34;
export const NPC_H = 46;

/** NPCs only ever stand and talk — two poses is all the world asks of them. */
export type NpcPose = 'idle' | 'talk';

/** Frame counts per pose. Idle is a slow breathing loop; talk is a livelier
 * gesture loop used while a dialogue box is open. */
export const NPC_POSE_FRAMES: Record<NpcPose, number> = {
  idle: 4, // gentle breathe / sway
  talk: 4, // head bob + gesturing hand
};

const OUTLINE = '#12131b';
const RIM = '#8f9bc4';

/**
 * Accent hues for the ten NPCs, indexed to match the NPCS array order in
 * content.ts. Inlined as hex to avoid a runtime import of the data layer.
 */
const ACCENT: string[] = [
  '#b78cff', // 0 mora     — pale violet, priestess
  '#e3a560', // 1 runa     — warm amber, smith
  '#9fc6b4', // 2 gran     — muted sage, lamplighter
  '#81c784', // 3 vesna    — green, hunter
  '#d3a1b1', // 4 elira    — dusty rose
  '#c5a47e', // 5 orrin    — tan/gold, merchant
  '#88a7c2', // 6 ferryman — cold slate blue
  '#76c9a1', // 7 iva      — bog green, witch
  '#c6a26d', // 8 bram     — dusty ochre, miner
  '#e47b68', // 9 serah    — red, deserter
];

/** Fallback so the factory never throws on an out-of-range index. */
const accentOf = (index: number): string => ACCENT[index] ?? MATERIAL.cloth;

/**
 * Per-frame motion shared by every villager. Each draw function reads only the
 * fields its pose cares about. Kept tiny on purpose — these are ambient standing
 * figures, not combatants, so the motion is subtle breathing and gesture rather
 * than a full gait.
 */
interface Kinematics {
  /** Vertical bob of the whole body (breath). */
  bob: number;
  /** Chest/shoulder rise, a touch of life independent of the whole-body bob. */
  breath: number;
  /** Head nod, mostly for the talk pose. */
  nod: number;
  /** Gesturing hand lift, talk pose. */
  gesture: number;
  /** Slow side sway of loose garments (cloaks, robes, hair). */
  sway: number;
}

function kinematics(pose: NpcPose, frame: number): Kinematics {
  const n = NPC_POSE_FRAMES[pose];
  const phase = (frame / n) * Math.PI * 2;
  switch (pose) {
    case 'idle':
      // Slow breathing: the chest lifts near the top of the cycle, garments
      // drift a pixel to the side. No hand gesture at rest.
      return {
        bob: Math.sin(phase) > 0.5 ? -1 : 0,
        breath: Math.sin(phase) > 0.2 ? 1 : 0,
        nod: 0,
        gesture: 0,
        sway: Math.round(Math.sin(phase) * 1.2),
      };
    case 'talk':
      // Livelier: the head bobs on every beat and one hand rises and falls as
      // if punctuating speech.
      return {
        bob: 0,
        breath: Math.sin(phase) > 0 ? 1 : 0,
        nod: Math.round(Math.sin(phase * 2) * 1.1),
        gesture: Math.round((Math.sin(phase) * 0.5 + 0.5) * 3),
        sway: Math.round(Math.cos(phase) * 1),
      };
  }
}

// ---------------------------------------------------------------------------
// Shared body builders. Villagers all share a front-facing human base — a pair
// of legs, a cylinder torso, a domed head with a simple face — and then each
// profession is layered on top. Factoring the common parts keeps every figure
// anatomically consistent with the hero and with each other, so only the
// silhouette-defining extras differ.
// ---------------------------------------------------------------------------

/** Tunable body dimensions, so proportions can vary per NPC (gran short and
 * stooped, runa broad, elira slight). */
interface Build {
  /** Half-width of the torso at the chest, in pixels. */
  torsoHalf: number;
  /** Torso height. */
  torsoH: number;
  /** Head radius. */
  headR: number;
  /** Leg length. */
  legH: number;
  /** Forward stoop — shifts head and upper torso forward, for the old and bent. */
  stoop: number;
  /** Overall vertical offset of the whole figure (shorter NPCs sit lower). */
  drop: number;
  /** Shoulder half-spread — how far pauldrons/arms sit from centre. */
  shoulder: number;
}

interface BaseColors {
  skin: string;
  hair: string;
  /** Primary garment (robe/coat/dress). */
  garb: string;
  /** Trim / accent detail on the garment. */
  trim: string;
  /** Legs / boots. */
  legs: string;
}

/** Anchor points other layers hang off, returned by the base builder so each
 * profession can attach props at the right height without re-deriving geometry. */
interface Anchors {
  cx: number;
  baseY: number;
  torsoTop: number;
  torsoBottom: number;
  headCx: number;
  headCy: number;
  shoulderY: number;
  leanX: number;
}

/**
 * Draw the shared human base: ground shadow, legs, a tapering cylinder torso and
 * a domed head with skin, and returns the anchor points. Face and headwear are
 * intentionally NOT drawn here — hoods, hats and helmets replace the face, so
 * each profession decides what tops the head.
 */
function drawBase(
  c: PixelCanvas,
  build: Build,
  colors: BaseColors,
  k: Kinematics,
  opts: { skirt?: boolean } = {},
): Anchors {
  const cx = c.width / 2;
  const baseY = 5 + build.drop + k.bob;
  const groundY = c.height - 4;
  // Contact shadow first — anchors the figure. Wider builds cast wider shadows.
  c.groundShadow(cx, groundY, build.torsoHalf + 3, 3.2, 0.4);

  const leanX = Math.round(build.stoop * 0.6);

  // ----- Legs. Rear leg shaded down so the near leg reads in front. A robed or
  // skirted NPC hides the legs under a hem, so we only draw stubby boots.
  const legY = baseY + build.torsoH + 11;
  const legSpread = Math.max(2, build.torsoHalf - 3);
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * legSpread - 1.5;
    if (!opts.skirt) {
      c.rect(lx, legY, 3, build.legH, colors.legs, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.78 : 1, curve: 0.9 });
    }
    // Boot / foot at the bottom, always visible.
    c.ellipse(lx + 1.5, legY + (opts.skirt ? build.legH - 2 : build.legH), 2.6, 1.8, shift(colors.legs, -0.12), { shape: 'round', height: 4, shade: i === 0 ? 0.82 : 1 });
  });

  // ----- Torso: a cylinder that tapers to the waist, exactly like the hero's.
  const torsoTop = baseY + build.headR * 2 + 1;
  const torsoBottom = torsoTop + build.torsoH;
  c.rect(cx - build.torsoHalf + leanX, torsoTop, build.torsoHalf * 2, build.torsoH - 3, colors.garb, { shape: 'cylinder-y', height: 8, curve: 0.95 });
  // Waist taper.
  c.rect(cx - build.torsoHalf + 1 + leanX, torsoTop + build.torsoH - 3, build.torsoHalf * 2 - 2, 3, colors.garb, { shape: 'cylinder-y', height: 8, curve: 0.95 });

  // ----- Head: a dome on a short neck, set forward by the stoop.
  const headCx = cx + leanX + Math.round(build.stoop);
  const headCy = baseY + build.headR + k.nod;
  // Neck ties the head to the shoulders.
  c.rect(cx - 1.5 + leanX, baseY + build.headR * 2 - 2, 3, 4, shift(colors.skin, -0.12, -6), { shape: 'cylinder-y', height: 12, shade: 0.72 });
  c.ellipse(headCx, headCy + 1, build.headR, build.headR + 0.4, colors.skin, { shape: 'dome', height: 16, curve: 0.92 });

  const shoulderY = torsoTop;
  return { cx, baseY, torsoTop, torsoBottom, headCx, headCy, shoulderY, leanX };
}

/**
 * A simple forward-facing face: two eyes with pupils and a mouth. Kept identical
 * in construction to the hero's face so the villagers feel drawn by the same
 * hand. `talk` opens the mouth on alternate frames for a bit of life.
 */
function drawFace(c: PixelCanvas, a: Anchors, headR: number, talk: boolean, frame: number): void {
  const eyeY = a.headCy + 0.5;
  [-1, 1].forEach((side) => {
    const ex = a.headCx + side * (headR * 0.42) - 0.5;
    c.rect(ex, eyeY, 2, 2, '#efe6ee', { shape: 'flat', height: 17 });
    c.rect(ex + (side < 0 ? 0 : 1), eyeY + 1, 1, 1, '#2b2430', { shape: 'flat', height: 17 });
  });
  // Brow shadow for a bit of gravity to the expression.
  c.rect(a.headCx - headR + 1.5, a.headCy - 1, headR * 2 - 3, 1, shift('#2b2430', 0.1), { shape: 'flat', height: 17, shade: 0.9 });
  // Mouth. Open on alternate talk frames.
  const mouthW = talk && frame % 2 === 1 ? 2 : 3;
  const mouthH = talk && frame % 2 === 1 ? 2 : 1;
  c.rect(a.headCx - mouthW / 2, a.headCy + headR - 1.5, mouthW, mouthH, shift(MATERIAL.skin, -0.26, -8), { shape: 'flat', height: 16 });
}

/**
 * Two arms hanging from the shoulders in garment colour, ending in skin hands.
 * `gestureSide` (−1 left, +1 right, 0 none) lifts one forearm for the talk pose;
 * `bareColor` swaps the sleeve colour for bare skin (the blacksmith). Returns
 * the hand positions so a profession can place a held item in the hand.
 */
function drawArms(
  c: PixelCanvas,
  a: Anchors,
  build: Build,
  sleeve: string,
  skin: string,
  k: Kinematics,
  gestureSide: number,
  bare = false,
): { left: [number, number]; right: [number, number] } {
  const armColor = bare ? skin : sleeve;
  const armLen = build.torsoH - 2;
  const shoulderX = build.shoulder;
  const hands: Record<number, [number, number]> = {};
  [-1, 1].forEach((side) => {
    const sx = a.cx + side * shoulderX + a.leanX;
    // Gesturing arm bends up; others hang straight with a slight breath sway.
    const lift = side === gestureSide ? k.gesture : 0;
    const shade = side === -1 ? 0.86 : 1; // far arm slightly darker
    // Upper arm from the shoulder.
    c.rect(sx - 1.5, a.shoulderY + 1, 3, armLen - lift, armColor, { shape: 'cylinder-y', height: 9, curve: 0.9, shade });
    // Bare arms get a hint of muscle: a lighter highlight down the outer edge.
    if (bare) {
      c.rect(sx - 1.5 + (side > 0 ? 2 : 0), a.shoulderY + 2, 1, armLen - lift - 2, shift(skin, 0.1), { shape: 'flat', height: 10, shade });
    }
    // Hand at the end.
    const hx = sx;
    const hy = a.shoulderY + armLen - lift + 1;
    c.ellipse(hx, hy, 2, 1.9, skin, { shape: 'round', height: 11, shade });
    hands[side] = [hx, hy];
  });
  return { left: hands[-1], right: hands[1] };
}

/** Dark keyline + faint lit edge, applied once at the very end of every NPC. */
function finish(c: PixelCanvas): void {
  c.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.94 });
}

// ---------------------------------------------------------------------------
// The ten villagers. Each owns its build proportions, palette and the one or
// two props that make its profession legible at a glance.
// ---------------------------------------------------------------------------

/**
 * 0. MORA — priestess. The read is *austere verticality*: a tall pointed hood
 * that swallows the head in shadow, a long straight robe to the floor, hands
 * clasped low over a string of prayer beads. Head bowed. No skin but the face
 * deep inside the cowl.
 */
function drawMora(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(0);
  const robe = mix(MATERIAL.clothCold, '#2b2f45', 0.4); // deep cold habit
  const build: Build = { torsoHalf: 6, torsoH: 16, headR: 4.6, legH: 8, stoop: 1, drop: 0, shoulder: 6 };
  const colors: BaseColors = { skin: MATERIAL.skinPale, hair: '#3a2b33', garb: robe, trim: accent, legs: shift(robe, -0.1) };
  const a = drawBase(c, build, colors, k, { skirt: true });

  // Long robe skirt to the floor — a single tapering column, the priestess read.
  const hemSway = k.sway;
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 5],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 5],
    [a.cx + build.torsoHalf + 2 + hemSway, c.height - 5],
    [a.cx - build.torsoHalf - 2 + hemSway, c.height - 5],
  ], robe, { shape: 'cylinder-y', height: 6, curve: 0.8 });
  // Central seam so the robe isn't one flat slab.
  c.rect(a.cx - 1 + a.leanX + Math.round(hemSway * 0.5), a.torsoTop + 6, 2, c.height - a.torsoTop - 12, shift(robe, -0.08), { shape: 'flat', height: 5, shade: 0.82 });

  // Clasped hands low over the belly, holding prayer beads.
  const handY = a.torsoTop + 9;
  [-1, 1].forEach((side) => {
    c.ellipse(a.cx + side * 2, handY, 2, 1.8, MATERIAL.skinPale, { shape: 'round', height: 10, shade: 0.9 });
  });
  // Prayer beads: a small loop of accent dots hanging from the hands.
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const bx = a.cx - 2 + t * 4;
    const by = handY + 2 + Math.sin(t * Math.PI) * 3;
    c.circle(bx, by, 0.9, accent, { shape: 'round', height: 11 });
  }
  c.circle(a.cx, handY + 6, 1.1, MATERIAL.gold, { shape: 'round', height: 11 }); // pendant

  // ----- Hood: a tall cowl that peaks above the crown and drapes onto the
  // shoulders, leaving the face in shadow. This is the whole silhouette.
  const hx = a.headCx;
  const hy = a.headCy;
  // Shoulder drape of the hood.
  c.rect(a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop - 1, build.torsoHalf * 2 + 2, 5, robe, { shape: 'cylinder-x', height: 11, curve: 0.85 });
  // The cowl itself: a peaked shape rising above the head.
  c.polygon([
    [hx, hy - build.headR - 5],
    [hx + build.headR + 1.5, hy + 1],
    [hx + build.headR, hy + build.headR + 1],
    [hx - build.headR, hy + build.headR + 1],
    [hx - build.headR - 1.5, hy + 1],
  ], shift(robe, 0.04), { shape: 'dome', height: 17, curve: 0.85 });
  // Face cavity: a darkened oval inside the cowl, only a pale face and eyes.
  c.ellipse(hx, hy + 1.5, build.headR - 1, build.headR - 0.5, shift(MATERIAL.skinPale, -0.18, -4), { shape: 'flat', height: 15, shade: 0.7 });
  drawFace(c, a, build.headR - 1, talk, frame);
  // Accent trim along the hood edge.
  c.line(hx - build.headR - 1.5, hy + 1, hx, hy - build.headR - 4, accent, 1, { height: 17, shade: 0.9 });
  c.line(hx + build.headR + 1.5, hy + 1, hx, hy - build.headR - 4, accent, 1, { height: 17, shade: 0.9 });
}

/**
 * 1. RUNA — blacksmith. The read is *strength*: the broadest shoulders in town,
 * bare muscled arms, a heavy leather apron over the chest, soot on the skin, and
 * a smith's hammer resting head-down by her side. Hair tied back out of the fire.
 */
function drawRuna(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(1);
  // Tan work-leather apron, deliberately kept LIGHT and warm so it separates
  // cleanly from the dark tunic behind and from the exposed arms in front.
  const apron = mix(accent, MATERIAL.leather, 0.35);
  // The broadest build in town: wide shoulders, thick torso, planted stance.
  const build: Build = { torsoHalf: 9, torsoH: 14, headR: 5, legH: 10, stoop: 0, drop: 0, shoulder: 9 };
  // Bare skin kept close to full skin tone (only lightly sooted) so the arms
  // read unmistakably as flesh, not sleeve — the muscled-arms tell.
  const skin = mix(MATERIAL.skin, '#7a5a3f', 0.12);
  const tunic = mix('#3a2c26', accent, 0.12); // dark undershirt behind the apron
  const colors: BaseColors = { skin, hair: '#4a2f22', garb: tunic, trim: accent, legs: MATERIAL.leatherDark };
  const a = drawBase(c, build, colors, k);

  // Bare, muscled arms — thick, drawn before the apron so the apron overlaps the
  // chest. drawArms already lightens the outer edge for a muscle highlight; here
  // we also thicken the upper arm into a visible bicep bulge.
  const hands = drawArms(c, a, build, tunic, skin, k, talk ? 1 : 0, true);
  [-1, 1].forEach((side) => {
    const sx = a.cx + side * build.shoulder + a.leanX;
    c.ellipse(sx, a.shoulderY + 4, 2.4, 3, skin, { shape: 'round', height: 10, shade: side < 0 ? 0.86 : 1 }); // bicep
  });

  // Heavy leather apron: a broad bib over the chest tapering to the knees. Wide
  // and pale — the single loudest professional signal on the figure.
  c.polygon([
    [a.cx - build.torsoHalf + 2 + a.leanX, a.torsoTop],
    [a.cx + build.torsoHalf - 2 + a.leanX, a.torsoTop],
    [a.cx + build.torsoHalf - 1 + a.leanX, a.torsoTop + build.torsoH + 6],
    [a.cx - build.torsoHalf + 1 - a.leanX, a.torsoTop + build.torsoH + 6],
  ], apron, { shape: 'cylinder-y', height: 10, curve: 0.9 });
  // Bib top edge highlight so the apron reads as a distinct front panel.
  c.rect(a.cx - build.torsoHalf + 2 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 4, 1, shift(apron, 0.12), { shape: 'flat', height: 11 });
  // Soot scorch marks and a burn hole.
  c.rect(a.cx - 3, a.torsoTop + 7, 3, 3, shift(apron, -0.16), { shape: 'flat', height: 10, shade: 0.75 });
  c.rect(a.cx + 2, a.torsoTop + 11, 2, 2, shift(apron, -0.14), { shape: 'flat', height: 10, shade: 0.75 });
  // Neck strap + waist tie of the apron in darker leather.
  c.line(a.cx - 3, a.torsoTop - 2, a.cx - 2, a.torsoTop + 1, MATERIAL.leatherDark, 1, { height: 11 });
  c.line(a.cx + 3, a.torsoTop - 2, a.cx + 2, a.torsoTop + 1, MATERIAL.leatherDark, 1, { height: 11 });
  c.rect(a.cx - build.torsoHalf + 1, a.torsoTop + build.torsoH - 4, build.torsoHalf * 2 - 2, 2, MATERIAL.leatherDark, { shape: 'cylinder-y', height: 10 });

  // Hair tied back in a short tail — practical, out of the forge.
  c.ellipse(a.headCx, a.headCy - build.headR + 1, build.headR + 0.3, 2.6, colors.hair, { shape: 'dome', height: 17, curve: 0.85 });
  c.ellipse(a.headCx - build.headR + 0.5, a.headCy, 1.6, 2.4, colors.hair, { shape: 'round', height: 15 }); // side
  drawFace(c, a, build.headR, talk, frame);

  // Big smith's hammer held across the body in BOTH hands, head up by the near
  // shoulder — far more legible than a small tool at the hip. A stout haft and a
  // chunky squared steel head with a bright struck face.
  const gripLoX = hands.left[0];
  const gripLoY = hands.left[1];
  const headX = a.cx + build.torsoHalf - 1;
  const headY = a.torsoTop + 1;
  c.line(gripLoX, gripLoY, headX, headY + 3, MATERIAL.wood, 3, { shape: 'cylinder-x', height: 12 }); // haft across the chest
  c.line(gripLoX, gripLoY, headX, headY + 3, shift(MATERIAL.woodPale, 0.05), 1, { height: 13, shade: 1 }); // lit side of haft
  // Squared hammer head at the top of the haft.
  c.rect(headX - 1, headY - 2, 5, 7, MATERIAL.steelDark, { shape: 'bevel', height: 14, curve: 0.8 });
  c.rect(headX - 1, headY - 2, 5, 1.5, shift(MATERIAL.steel, 0.16), { shape: 'flat', height: 15 }); // top struck-face highlight
  c.rect(headX + 3, headY - 1, 1.5, 5, shift(MATERIAL.steel, 0.12), { shape: 'flat', height: 15 }); // lit edge
  // Near hand gripping the haft high up.
  c.ellipse(headX - 3, headY + 4, 2, 1.9, skin, { shape: 'round', height: 13 });
}

/**
 * 2. GRAN — old lamplighter / graveyard warden. The read is *age and burden*: a
 * short, forward-stooped frame under a heavy coat, both hands leaning on a tall
 * walking staff, a lantern hanging from the other hand. White beard, bowed back.
 */
function drawGran(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(2);
  const coat = mix(accent, '#41463f', 0.55); // muddy sage greatcoat
  // Short and bent: small head, low drop, strong stoop.
  const build: Build = { torsoHalf: 6.5, torsoH: 12, headR: 4.6, legH: 7, stoop: 3, drop: 5, shoulder: 6 };
  const colors: BaseColors = { skin: mix(MATERIAL.skin, MATERIAL.skinPale, 0.5), hair: '#c9c4bb', garb: coat, trim: accent, legs: MATERIAL.leatherDark };
  const a = drawBase(c, build, colors, k, { skirt: true });

  // Long heavy coat, hanging in a slightly hunched line to mid-shin.
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 3],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 3],
    [a.cx + build.torsoHalf + k.sway, c.height - 7],
    [a.cx - build.torsoHalf - 1 + k.sway, c.height - 7],
  ], coat, { shape: 'cylinder-y', height: 7, curve: 0.82 });
  // Coat collar and a lighter panel down the front for the buttoned seam.
  c.rect(a.cx - 1 + a.leanX, a.torsoTop + 3, 2, build.torsoH + 6, shift(coat, -0.08), { shape: 'flat', height: 6, shade: 0.82 });

  // Walking staff planted forward, both the near hand and a bent posture leaning
  // on it. The staff plus the stoop is the silhouette.
  const staffX = a.cx + build.torsoHalf + 2;
  c.rect(staffX, a.baseY + 2, 2, c.height - a.baseY - 6, MATERIAL.wood, { shape: 'cylinder-y', height: 10 });
  c.ellipse(staffX + 1, a.baseY + 2, 1.8, 1.5, MATERIAL.woodPale, { shape: 'round', height: 11 }); // knob top
  // Near hand gripping the staff.
  c.ellipse(staffX + 1, a.torsoTop + 6, 2, 1.9, colors.skin, { shape: 'round', height: 12 });

  // Lantern hanging from the far hand, low and slightly swaying. A faint warm
  // emissive core marks it as the lamplighter's tool.
  const lx = a.cx - build.torsoHalf - 1 + Math.round(k.sway * 0.5);
  const ly = a.torsoTop + build.torsoH + 2;
  c.ellipse(lx, a.torsoTop + 7, 2, 1.9, colors.skin, { shape: 'round', height: 11 }); // hand
  c.line(lx, a.torsoTop + 7, lx, ly - 2, MATERIAL.iron, 1, { height: 10 }); // handle wire
  c.rect(lx - 2, ly - 2, 5, 6, MATERIAL.iron, { shape: 'cylinder-y', height: 9, curve: 0.7 }); // lantern frame
  c.rect(lx - 1, ly, 3, 3, '#f4b85b', { shape: 'flat', emissive: true }); // warm glass
  c.rect(lx, ly + 0.5, 1, 2, '#fff0a8', { emissive: true }); // flame core

  // Bald pate + long white beard framing a lined face.
  c.ellipse(a.headCx, a.headCy - build.headR + 2, build.headR - 0.4, 2, shift(colors.skin, 0.05), { shape: 'dome', height: 17 }); // pate
  drawFace(c, a, build.headR, talk, frame);
  // Beard: a pale wedge under the chin.
  c.polygon([
    [a.headCx - build.headR + 1, a.headCy + 1],
    [a.headCx + build.headR - 1, a.headCy + 1],
    [a.headCx + 1.5, a.headCy + build.headR + 3],
    [a.headCx - 1.5, a.headCy + build.headR + 3],
  ], colors.hair, { shape: 'round', height: 15, curve: 0.7 });
}

/**
 * 3. VESNA — hunter. The read is *lean readiness*: a slight hooded figure in
 * light leathers, a tall longbow held vertically in one hand, and a quiver of
 * fletched arrows jutting over the shoulder. Not bulky — quick.
 */
function drawVesna(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(3);
  const leathers = mix(accent, MATERIAL.leather, 0.55);
  const build: Build = { torsoHalf: 5, torsoH: 13, headR: 4.6, legH: 11, stoop: 0, drop: 0, shoulder: 5.5 };
  const colors: BaseColors = { skin: MATERIAL.skin, hair: '#5a4030', garb: leathers, trim: accent, legs: MATERIAL.leatherDark };

  // Quiver + arrows drawn FIRST so they sit behind the shoulder.
  const qx = c.width / 2 + 5;
  const qBaseY = 6 + 4;
  c.rect(qx, qBaseY, 3, 10, MATERIAL.leatherDark, { shape: 'cylinder-y', height: 6, curve: 0.8 }); // quiver tube
  for (let i = 0; i < 3; i += 1) {
    const ax = qx + 0.5 + i;
    c.line(ax, qBaseY - 4, ax, qBaseY + 2, MATERIAL.woodPale, 1, { height: 7 }); // shaft
    c.rect(ax - 0.5, qBaseY - 5, 2, 2, accent, { shape: 'flat', height: 8 }); // fletching
  }

  const a = drawBase(c, build, colors, k);
  const hands = drawArms(c, a, build, leathers, colors.skin, k, talk ? -1 : 0);

  // A light jerkin cinched with an accent belt.
  c.rect(a.cx - build.torsoHalf + a.leanX, a.torsoTop + build.torsoH - 6, build.torsoHalf * 2, 2, accent, { shape: 'cylinder-y', height: 9, shade: 0.95 });
  // Cross-strap for the quiver.
  c.line(a.cx - build.torsoHalf + 1, a.torsoTop + 1, a.cx + build.torsoHalf, a.torsoTop + 6, MATERIAL.leatherDark, 1, { height: 10 });

  // Hood pulled up — a soft cowl, less severe than Mora's, framing a visible face.
  const hx = a.headCx;
  const hy = a.headCy;
  c.ellipse(hx, hy - 0.5, build.headR + 1, build.headR + 1.5, shift(leathers, -0.04), { shape: 'dome', height: 16, curve: 0.9 });
  // Cut out the face opening.
  c.ellipse(hx, hy + 1.5, build.headR - 0.8, build.headR - 0.5, colors.skin, { shape: 'dome', height: 15 });
  drawFace(c, a, build.headR - 0.8, talk, frame);

  // Longbow: a tall, gently curved stave held vertically in the right hand, with
  // a bowstring. The vertical bow is the hunter's unmistakable read.
  const [bx, by] = hands.right;
  const bowTop = a.baseY - 3;
  const bowBot = c.height - 6;
  const bowMid = (bowTop + bowBot) / 2;
  // Stave as two arcs bulging outward from the hand.
  c.line(bx + 1, bowTop, bx + 3, bowMid, MATERIAL.wood, 2, { height: 10 });
  c.line(bx + 3, bowMid, bx + 1, bowBot, MATERIAL.wood, 2, { height: 10 });
  c.line(bx + 2, bowTop + 1, bx + 3.5, bowMid, MATERIAL.woodPale, 1, { height: 11 }); // lit belly
  // Bowstring: a straight taut line tip to tip.
  c.line(bx + 1, bowTop, bx + 1, bowBot, mix(MATERIAL.bone, '#ffffff', 0.3), 1, { height: 11, shade: 0.9 });
}

/**
 * 4. ELIRA — a young widow. The read is *quiet slightness*: the narrowest frame,
 * a plain long dress, a shawl over the shoulders, and long loose hair that sways.
 * No profession props — she is defined by softness and hair.
 */
function drawElira(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(4);
  const dress = mix(accent, '#5b4650', 0.45); // dusty rose, muted
  const build: Build = { torsoHalf: 4.5, torsoH: 13, headR: 4.6, legH: 9, stoop: 0, drop: 1, shoulder: 5 };
  const colors: BaseColors = { skin: MATERIAL.skinPale, hair: '#3d2b26', garb: dress, trim: accent, legs: MATERIAL.leatherDark };

  // Long hair behind the shoulders, drawn first so it falls behind the body.
  const cx = c.width / 2;
  const hairTop = 6 + build.drop + build.headR - 1;
  c.polygon([
    [cx - build.headR - 1, hairTop],
    [cx + build.headR + 1, hairTop],
    [cx + build.headR + k.sway, hairTop + 16],
    [cx - build.headR - 1 + k.sway, hairTop + 16],
  ], colors.hair, { shape: 'cylinder-y', height: 6, curve: 0.85 });

  const a = drawBase(c, build, colors, k, { skirt: true });
  const hands = drawArms(c, a, build, dress, colors.skin, k, talk ? 1 : 0);

  // Long simple dress skirt.
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 6],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 6],
    [a.cx + build.torsoHalf + 2 + k.sway, c.height - 6],
    [a.cx - build.torsoHalf - 2 + k.sway, c.height - 6],
  ], dress, { shape: 'cylinder-y', height: 6, curve: 0.8 });

  // Shawl: a triangular wrap over both shoulders, a slightly lighter tone.
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop - 1],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop - 1],
    [a.cx + a.leanX, a.torsoTop + 6],
  ], shift(dress, 0.1, 6), { shape: 'cylinder-x', height: 10, curve: 0.85 });

  // Hair framing the face at the front too.
  [-1, 1].forEach((side) => {
    c.ellipse(a.headCx + side * (build.headR - 0.5), a.headCy + 1, 1.4, build.headR, colors.hair, { shape: 'cylinder-y', height: 15, shade: side < 0 ? 0.85 : 1 });
  });
  c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR, 2.4, colors.hair, { shape: 'dome', height: 17 }); // crown/parting
  drawFace(c, a, build.headR, talk, frame);
  // Hands clasped softly in front.
  const [, hyl] = hands.left;
  c.ellipse(a.cx - 1, hyl - 1, 1.8, 1.6, colors.skin, { shape: 'round', height: 11, shade: 0.9 });
}

/**
 * 5. ORRIN — merchant. The read is *prosperity*: a round, well-fed body (widest
 * torso, short legs), a fine long coat with a fur collar, a heavy coin pouch on
 * the belt, and a ledger tucked under one arm. Combed hair, content.
 */
function drawOrrin(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(5);
  // Rich coat kept lighter and warmer than a peasant's brown, so the gold trim
  // and fur read as *fine* rather than muddy.
  const coat = mix(accent, '#6a5232', 0.3);
  // Portly: widest torso in town, short legs, low drop.
  const build: Build = { torsoHalf: 9, torsoH: 13, headR: 5, legH: 6, stoop: -1, drop: 3, shoulder: 8 };
  const colors: BaseColors = { skin: mix(MATERIAL.skin, MATERIAL.skinPale, 0.5), hair: '#4a3728', garb: coat, trim: MATERIAL.gold, legs: MATERIAL.leatherDark };
  const a = drawBase(c, build, colors, k);

  // Round belly: a big ellipse bulging the lower torso well past the shoulders —
  // the well-fed read.
  c.ellipse(a.cx + a.leanX, a.torsoTop + build.torsoH - 3, build.torsoHalf + 0.5, 6, coat, { shape: 'round', height: 10, curve: 0.95 });
  // Buttoned waistcoat panel over the belly in a contrasting deep tone.
  c.ellipse(a.cx + a.leanX, a.torsoTop + build.torsoH - 3, build.torsoHalf - 2, 5, shift(coat, -0.12, 6), { shape: 'round', height: 10, shade: 0.9 });

  const hands = drawArms(c, a, build, coat, colors.skin, k, talk ? 1 : 0);

  // Fine coat: broad gold-trimmed lapels flaring open over the waistcoat.
  c.polygon([
    [a.cx - 4 + a.leanX, a.torsoTop],
    [a.cx + a.leanX, a.torsoTop + 4],
    [a.cx + 4 + a.leanX, a.torsoTop],
    [a.cx + 3 + a.leanX, a.torsoTop + build.torsoH - 2],
    [a.cx - 3 + a.leanX, a.torsoTop + build.torsoH - 2],
  ], shift(coat, 0.06), { shape: 'flat', height: 9, shade: 0.95 });
  // Gold lapel edges — thicker (2px) so they actually catch the eye.
  c.line(a.cx - 3 + a.leanX, a.torsoTop + 1, a.cx - 1 + a.leanX, a.torsoTop + build.torsoH - 2, MATERIAL.gold, 1, { height: 11 });
  c.line(a.cx + 3 + a.leanX, a.torsoTop + 1, a.cx + 1 + a.leanX, a.torsoTop + build.torsoH - 2, MATERIAL.gold, 1, { height: 11 });
  // Three gold buttons down the waistcoat.
  for (let i = 0; i < 3; i += 1) c.circle(a.cx + a.leanX, a.torsoTop + 6 + i * 3, 0.9, MATERIAL.gold, { shape: 'round', height: 11 });
  // Fur collar: a fat pale fuzzy band across the shoulders and up the neck.
  c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop - 1, build.torsoHalf * 2 - 2, 3, mix(coat, MATERIAL.bone, 0.5), { shape: 'cylinder-x', height: 12, curve: 0.7 });

  // Heavy coin pouch on the belt with a gold tie, and a gold coin catching light
  // beside it — an unmistakable "money" cue for the merchant.
  c.ellipse(a.cx + build.torsoHalf - 1, a.torsoTop + build.torsoH, 2.6, 3, MATERIAL.leather, { shape: 'round', height: 11 });
  c.rect(a.cx + build.torsoHalf - 2.5, a.torsoTop + build.torsoH - 2.5, 4, 1, MATERIAL.gold, { shape: 'flat', height: 12 });
  c.circle(a.cx + build.torsoHalf + 1.5, a.torsoTop + build.torsoH - 2, 1.3, MATERIAL.gold, { shape: 'round', height: 12 });
  c.rect(a.cx + build.torsoHalf + 1, a.torsoTop + build.torsoH - 2.5, 1, 1, shift(MATERIAL.gold, 0.2), { shape: 'flat', height: 13 }); // coin glint

  // Big ledger held in the near hand: a fat book with a gold clasp and pages.
  const [lx, ly] = hands.left;
  c.rect(lx - 4, ly - 5, 6, 8, mix(MATERIAL.leatherDark, accent, 0.15), { shape: 'bevel', height: 11, curve: 0.6 });
  c.rect(lx + 1, ly - 5, 1.5, 8, mix(MATERIAL.bone, MATERIAL.woodPale, 0.4), { shape: 'flat', height: 12 }); // page block
  c.rect(lx - 4, ly - 5, 6, 1, shift(MATERIAL.leatherDark, 0.08), { shape: 'flat', height: 12 }); // cover top
  c.rect(lx + 1, ly - 1, 2, 1.5, MATERIAL.gold, { shape: 'flat', height: 12 }); // clasp

  // Combed hair, receding, over a round content face with jowls.
  c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR - 0.5, 2.4, colors.hair, { shape: 'dome', height: 17 });
  c.ellipse(a.headCx, a.headCy + 2, build.headR - 0.5, build.headR - 1.5, shift(colors.skin, -0.04), { shape: 'round', height: 15, shade: 0.95 }); // round cheeks
  drawFace(c, a, build.headR, talk, frame);
  // Bushy mustache to sell the well-fed merchant.
  c.rect(a.headCx - 2, a.headCy + build.headR - 2, 4, 1.5, colors.hair, { shape: 'cylinder-x', height: 16, shade: 0.9 });
}

/**
 * 6. FERRYMAN — silent guide. The read is *tall and shrouded*: a wide flat brim
 * hat that hides the face, a long oilskin cloak falling straight, and a tall
 * pole/oar held vertically that rises above the hat. Gaunt and still.
 */
function drawFerryman(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(6);
  const oilskin = mix(accent, '#2c3540', 0.55); // dark wet slate cloak
  const build: Build = { torsoHalf: 6, torsoH: 15, headR: 4.4, legH: 9, stoop: 0, drop: 0, shoulder: 6 };
  const colors: BaseColors = { skin: MATERIAL.skinDead, hair: '#2b2a2e', garb: oilskin, trim: accent, legs: '#20242a' };

  // Tall pole/oar drawn first, behind the body, rising above the hat.
  const px = c.width / 2 + build.torsoHalf + 3;
  c.rect(px, 2, 2, c.height - 6, MATERIAL.wood, { shape: 'cylinder-y', height: 8 });
  c.ellipse(px + 1, 2, 1.6, 2.4, MATERIAL.woodPale, { shape: 'dome', height: 9 }); // pole tip
  // Oar blade near the bottom.
  c.ellipse(px + 1, c.height - 8, 2.6, 4, mix(MATERIAL.wood, MATERIAL.woodPale, 0.4), { shape: 'round', height: 7 });

  const a = drawBase(c, build, colors, k, { skirt: true });
  drawArms(c, a, build, oilskin, colors.skin, k, 0);

  // Long straight oilskin cloak — a heavy column with a wet sheen highlight.
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 1],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 1],
    [a.cx + build.torsoHalf + Math.round(k.sway * 0.5), c.height - 5],
    [a.cx - build.torsoHalf - 1 + Math.round(k.sway * 0.5), c.height - 5],
  ], oilskin, { shape: 'cylinder-y', height: 7, curve: 0.85 });
  // Wet sheen: a bright thin vertical highlight, marks the oilskin as slick.
  c.rect(a.cx - 2 + a.leanX, a.torsoTop + 2, 1, build.torsoH + 6, shift(oilskin, 0.16, -6), { shape: 'flat', height: 8 });

  // Hand gripping the pole.
  c.ellipse(px, a.torsoTop + 5, 2, 1.9, colors.skin, { shape: 'round', height: 11 });

  // ----- Wide-brimmed hat: a flat disc over a low crown, hiding the face in a
  // band of shadow. Only two faint eye-glints beneath. The hat is the read.
  const hx = a.headCx;
  const hy = a.headCy;
  // Face left mostly in shadow under the brim.
  c.ellipse(hx, hy + 1.5, build.headR - 1, build.headR - 0.5, shift(colors.skin, -0.2), { shape: 'flat', height: 15, shade: 0.6 });
  // Two cold eye-glints in the dark.
  [-1.4, 1.4].forEach((ox) => c.rect(hx + ox, hy + 1, 1, 1, '#c7d6e0', { emissive: true, alpha: 0.8 }));
  // Low crown.
  c.ellipse(hx, hy - build.headR + 1, build.headR - 0.5, 2.6, shift(oilskin, -0.06), { shape: 'dome', height: 18, curve: 0.9 });
  // Wide flat brim.
  c.ellipse(hx, hy - build.headR + 2.5, build.headR + 3.5, 2, mix(oilskin, '#1c2228', 0.4), { shape: 'flat', height: 17 });
  c.ellipse(hx, hy - build.headR + 2, build.headR + 3.5, 1, shift(oilskin, 0.08), { shape: 'flat', height: 18 }); // lit brim edge
}

/**
 * 7. IVA — bog witch / herbalist. The read is *wild and stooped*: a mass of
 * unkempt hair, ragged layered robes in bog green, a woven herb basket carried
 * at the hip, and gnarled posture. A little unsettling, a little maternal.
 */
function drawIva(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(7);
  const robe = mix(accent, '#33463a', 0.5); // murky bog green
  const build: Build = { torsoHalf: 6, torsoH: 13, headR: 4.8, legH: 8, stoop: 2, drop: 2, shoulder: 6 };
  const colors: BaseColors = { skin: mix(MATERIAL.skinPale, MATERIAL.toxic, 0.15), hair: '#5a5546', garb: robe, trim: accent, legs: MATERIAL.leatherDark };

  // Wild hair mass behind the head, drawn first — big and irregular.
  const cx = c.width / 2;
  const hairTop = 6 + build.drop + 1;
  c.ellipse(cx, hairTop + build.headR, build.headR + 2.5, build.headR + 3, colors.hair, { shape: 'dome', height: 14, curve: 0.9 });
  // Straggly locks hanging down.
  [-1, 0, 1].forEach((s) => {
    c.rect(cx + s * (build.headR) - 0.5 + k.sway, hairTop + build.headR, 1.5, 8 + Math.abs(s) * 2, colors.hair, { shape: 'cylinder-y', height: 8, shade: 0.85 });
  });

  const a = drawBase(c, build, colors, k, { skirt: true });
  const hands = drawArms(c, a, build, robe, colors.skin, k, talk ? 1 : 0);

  // Layered ragged robe: an outer skirt with a torn, uneven hem.
  c.polygon([
    [a.cx - build.torsoHalf - 1 + a.leanX, a.torsoTop + 4],
    [a.cx + build.torsoHalf + 1 + a.leanX, a.torsoTop + 4],
    [a.cx + build.torsoHalf + 1 + k.sway, c.height - 6],
    [a.cx + 2 + k.sway, c.height - 8],
    [a.cx + k.sway, c.height - 5],
    [a.cx - 2 + k.sway, c.height - 8],
    [a.cx - build.torsoHalf - 1 + k.sway, c.height - 6],
  ], robe, { shape: 'cylinder-y', height: 6, curve: 0.8 });
  // A lighter under-layer showing at the collar.
  c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 2, 2, shift(robe, 0.1, 8), { shape: 'cylinder-x', height: 9 });

  // Herb basket at the hip: a woven bowl with a few sprigs poking out.
  const [bx, by] = hands.left;
  c.ellipse(bx - 1, by + 1, 3.4, 2.4, MATERIAL.woodPale, { shape: 'round', height: 9 });
  c.ellipse(bx - 1, by, 3, 1.4, shift(MATERIAL.wood, 0.05), { shape: 'flat', height: 10 }); // basket mouth
  // Weave lines.
  c.line(bx - 4, by + 1, bx + 2, by + 1, shift(MATERIAL.wood, -0.1), 1, { height: 10, shade: 0.8 });
  // Herb sprigs.
  [-2, 0, 1.5].forEach((ox, i) => {
    c.line(bx + ox - 1, by, bx + ox - 1, by - 3 - (i % 2), MATERIAL.foliageLit, 1, { height: 11 });
    c.circle(bx + ox - 1, by - 3 - (i % 2), 1, i === 1 ? accent : MATERIAL.moss, { shape: 'round', height: 12 });
  });

  // Face peering out of the hair — a little sharp, with faint green cast.
  drawFace(c, a, build.headR, talk, frame);
  // A crooked nose shadow for character.
  c.rect(a.headCx, a.headCy + 1, 1, 2, shift(colors.skin, -0.16, -6), { shape: 'flat', height: 16 });
}

/**
 * 8. BRAM — the last miner. The read is *the lamp*: a round helmet with a
 * bright emissive lamp on the brow, a stocky dust-caked body, and a pickaxe
 * shouldered. The helmet light is the one warm point on a grimy grey figure.
 */
function drawBram(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(8);
  const garb = mix(accent, '#4a4238', 0.5); // dust-caked work clothes
  const build: Build = { torsoHalf: 7, torsoH: 13, headR: 4.8, legH: 8, stoop: 1, drop: 1, shoulder: 7 };
  // Grime-greyed skin.
  const skin = mix(MATERIAL.skin, MATERIAL.stone, 0.28);
  const colors: BaseColors = { skin, hair: '#3a3128', garb, trim: accent, legs: '#33302a' };

  // Pickaxe drawn first, shouldered behind: a long haft with a curved twin head
  // rising over the shoulder. Reads instantly as mining.
  const cx = c.width / 2;
  const px = cx - build.torsoHalf - 2;
  c.line(px + 4, c.height - 10, px - 1, 5, MATERIAL.wood, 2, { height: 8 }); // haft, angled over shoulder
  // Pick head: two curved spikes at the top.
  c.polygon([[px - 4, 4], [px - 1, 3], [px + 2, 6], [px - 1, 6]], MATERIAL.iron, { shape: 'bevel', height: 12, curve: 0.7 });
  c.polygon([[px + 2, 3], [px + 5, 4], [px + 2, 7], [px, 6]], shift(MATERIAL.iron, -0.08), { shape: 'bevel', height: 11, curve: 0.7 });
  c.line(px - 3, 4.5, px + 4, 4.5, shift(MATERIAL.steel, 0.16), 1, { height: 13 }); // metal highlight along the pick

  const a = drawBase(c, build, colors, k);
  drawArms(c, a, build, garb, skin, k, talk ? 1 : 0);

  // Sturdy work tunic with a wide belt; dust smudges on the chest.
  c.rect(a.cx - build.torsoHalf + a.leanX, a.torsoTop + build.torsoH - 5, build.torsoHalf * 2, 2, MATERIAL.leatherDark, { shape: 'cylinder-y', height: 9 });
  c.rect(a.cx - 2, a.torsoTop + 4, 3, 2, shift(garb, 0.12), { shape: 'flat', height: 9, shade: 0.9 }); // dust smear
  c.rect(a.cx + 1, a.torsoTop + 8, 2, 2, shift(garb, 0.1), { shape: 'flat', height: 9, shade: 0.9 });

  // ----- Helmet: a rounded steel dome low over the brow, with the lamp bracket
  // and a bright emissive beam at the front. The glowing lamp is the silhouette.
  const hx = a.headCx;
  const hy = a.headCy;
  // Shadowed face under the helmet.
  drawFace(c, a, build.headR, talk, frame);
  // Helmet dome.
  c.ellipse(hx, hy - build.headR + 2.5, build.headR + 0.6, build.headR - 1, MATERIAL.iron, { shape: 'dome', height: 18, curve: 1 });
  c.rect(hx - build.headR - 0.5, hy - build.headR + 3.5, build.headR * 2 + 1, 1.5, shift(MATERIAL.iron, -0.14), { shape: 'cylinder-x', height: 17, shade: 0.85 }); // brim
  // Lamp bracket + emissive lamp on the brow.
  c.rect(hx - 1.5, hy - build.headR + 2, 3, 2, MATERIAL.bronze, { shape: 'bevel', height: 19, curve: 0.7 });
  c.circle(hx, hy - build.headR + 3, 1.6, '#ffe08a', { shape: 'round', emissive: true }); // lamp glass
  c.circle(hx, hy - build.headR + 3, 0.9, '#fff6d6', { emissive: true }); // hot core
  // Faint cast beam downward from the lamp.
  c.polygon([[hx - 1, hy - build.headR + 4], [hx + 1, hy - build.headR + 4], [hx + 3, hy + build.headR + 2], [hx - 3, hy + build.headR + 2]], '#ffe9a8', { alpha: 0.14, emissive: true });
}

/**
 * 9. SERAH — citadel deserter. The read is *broken soldier*: dented plate on one
 * shoulder and the chest, a long red scarf trailing in the wind, and a sword
 * sheathed at the hip. Proud posture gone weary. The red scarf is the accent.
 */
function drawSerah(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean): void {
  const accent = accentOf(9);
  const cloth = mix(MATERIAL.clothCold, '#3a3340', 0.4);
  const steel = MATERIAL.steel;
  const build: Build = { torsoHalf: 6.5, torsoH: 14, headR: 4.8, legH: 10, stoop: 0, drop: 0, shoulder: 7 };
  const colors: BaseColors = { skin: MATERIAL.skin, hair: '#2f2622', garb: cloth, trim: accent, legs: MATERIAL.leatherDark };

  // Red scarf trailing behind, drawn first so it flows out from the neck.
  const cx = c.width / 2;
  const scarfBase = 6 + build.headR * 2;
  c.polygon([
    [cx - 1, scarfBase],
    [cx + 2, scarfBase],
    [cx + 6 + k.sway * 2, scarfBase + 8],
    [cx + 9 + k.sway * 2, scarfBase + 14],
    [cx + 5 + k.sway * 2, scarfBase + 13],
    [cx + 2, scarfBase + 8],
  ], accent, { shape: 'cylinder-y', height: 5, curve: 0.7 });

  const a = drawBase(c, build, colors, k);
  const hands = drawArms(c, a, build, cloth, colors.skin, k, talk ? 1 : 0);

  // Dented breastplate over the chest — steel with battle scars.
  c.rect(a.cx - build.torsoHalf + 1 + a.leanX, a.torsoTop, build.torsoHalf * 2 - 2, build.torsoH - 4, steel, { shape: 'cylinder-y', height: 9, curve: 0.9 });
  // Scratches and a dent (darker gouges).
  c.line(a.cx - 3 + a.leanX, a.torsoTop + 3, a.cx + 1 + a.leanX, a.torsoTop + 6, shift(steel, -0.22), 1, { height: 10, shade: 0.7 });
  c.rect(a.cx + 1 + a.leanX, a.torsoTop + 8, 2, 2, shift(steel, -0.26), { shape: 'flat', height: 9, shade: 0.65 }); // dent
  // Central ridge highlight sells the curved plate.
  c.rect(a.cx - 0.5 + a.leanX, a.torsoTop + 1, 1, build.torsoH - 6, shift(steel, 0.16), { shape: 'flat', height: 10 });

  // One intact steel pauldron (left), one broken/bare shoulder (right) — the
  // asymmetry is the "broken armour" read.
  c.ellipse(a.cx - build.shoulder + a.leanX, a.torsoTop + 1, 3.4, 2.8, steel, { shape: 'round', height: 13, curve: 1 });
  c.rect(a.cx - build.shoulder - 1.5 + a.leanX, a.torsoTop + 2.5, 4, 1, shift(steel, -0.18), { shape: 'flat', height: 12 });
  // Broken shoulder: just a torn cloth strap, no plate.
  c.rect(a.cx + build.shoulder - 2 + a.leanX, a.torsoTop, 3, 3, shift(cloth, -0.08), { shape: 'bevel', height: 11, curve: 0.6 });

  // Sword sheathed at the hip (near/left side), angled back. Pulled slightly
  // inward and drawn with a lighter scabbard + a prominent hilt so the "armed
  // deserter" read survives the dark keyline and the small display size.
  const sx = a.cx - build.torsoHalf + 1;
  const sy = a.torsoTop + build.torsoH - 4;
  // Scabbard: a browner leather so it separates from the outline.
  c.line(sx, sy, sx - 4, c.height - 5, mix(MATERIAL.leather, MATERIAL.leatherDark, 0.4), 3, { shape: 'cylinder-x', height: 6 });
  c.line(sx - 3.5, c.height - 6, sx - 4, c.height - 4, steel, 2, { height: 7 }); // steel chape tip
  // Hilt above the belt: a tall wrapped grip, a wide bronze crossguard and a
  // round pommel — the parts that actually say "sword".
  c.rect(sx + 0.5, sy - 5, 1.5, 5, mix(accent, MATERIAL.leather, 0.5), { shape: 'cylinder-y', height: 11 }); // grip
  c.line(sx - 1.5, sy - 0.5, sx + 3.5, sy - 0.5, MATERIAL.bronze, 2, { shape: 'cylinder-x', height: 11 }); // crossguard
  c.circle(sx + 1.2, sy - 6, 1.3, shift(MATERIAL.bronze, 0.08), { shape: 'round', height: 12 }); // pommel

  // Weary face under short-cropped soldier's hair.
  c.ellipse(a.headCx, a.headCy - build.headR + 1.5, build.headR, 2.4, colors.hair, { shape: 'dome', height: 17 });
  drawFace(c, a, build.headR, talk, frame);
  // Scar across one eye — a pale diagonal line.
  c.line(a.headCx - 2, a.headCy - 1, a.headCx - 0.5, a.headCy + 2, shift(colors.skin, 0.16), 1, { height: 17 });
}

/** Dispatch table: index → draw function. */
const DRAWERS: Array<(c: PixelCanvas, k: Kinematics, frame: number, talk: boolean) => void> = [
  drawMora, drawRuna, drawGran, drawVesna, drawElira, drawOrrin, drawFerryman, drawIva, drawBram, drawSerah,
];

/**
 * Texture key for a generated NPC frame.
 *
 * CRITICAL COMPAT: the resting frame (idle, frame 0) must key to plain
 * `npc-{index}`, because existing scene code (WorldScene / InteriorScene) loads
 * villagers by that exact key. Every other frame gets a fully-qualified key so
 * animation systems can address them without colliding with the legacy one.
 */
export function npcKey(index: number, pose: NpcPose, frame: number): string {
  if (pose === 'idle' && frame === 0) return `npc-${index}`;
  return `npc-${index}-${pose}-${frame}`;
}

/** Render a single NPC frame into a fresh canvas. */
export function renderNpcFrame(index: number, pose: NpcPose, frame: number): PixelCanvas {
  const canvas = new PixelCanvas(NPC_W, NPC_H);
  const draw = DRAWERS[index] ?? DRAWERS[0];
  const k = kinematics(pose, frame);
  draw(canvas, k, frame, pose === 'talk');
  finish(canvas);
  return canvas;
}

/**
 * Lighting profile for the villagers. Matches the hero's (HERO_SHADE) so the
 * whole cast is lit by the same key light and reads as one scene — just a hair
 * softer rim, since townsfolk stand in lit interiors rather than the dark wild.
 */
export const NPC_SHADE = {
  lightX: -0.5,
  lightY: -0.76,
  lightZ: 0.4,
  intensity: 0.66,
  ambient: 0.52,
  ambientColor: '#4f5f8c',
  occlusion: 0.4,
  rim: 0.18,
  rimColor: '#9fb0dc',
  bands: 5,
  dither: 0.42,
};

/** Every NPC frame the game needs, as (key, canvas) pairs. */
export function buildNpcFrames(): Array<{ key: string; canvas: PixelCanvas }> {
  const frames: Array<{ key: string; canvas: PixelCanvas }> = [];
  for (let index = 0; index < DRAWERS.length; index += 1) {
    for (const pose of Object.keys(NPC_POSE_FRAMES) as NpcPose[]) {
      for (let frame = 0; frame < NPC_POSE_FRAMES[pose]; frame += 1) {
        frames.push({ key: npcKey(index, pose, frame), canvas: renderNpcFrame(index, pose, frame) });
      }
    }
  }
  return frames;
}

export type { DrawOptions };
