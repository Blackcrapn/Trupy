/**
 * The armoury — Trupy's weapon sprite factory.
 *
 * Eight weapons, all generated at runtime and sculpted with the same
 * depth-aware renderer as the hero and the townsfolk (see ./hero.ts). Two views
 * are produced for each:
 *
 *   renderWeapon(id)      the held-in-hand view (~30x30), drawn on a diagonal
 *                         so it sits naturally in the exile's fist and swings
 *                         along the attack arc. This is the `held-{id}` texture
 *                         the scenes already pin to the player.
 *   renderWeaponIcon(id)  a larger, cleaner 3/4 presentation (~40x40) for the
 *                         inventory and shop, where the weapon is read at rest.
 *
 * Three things sell a weapon at small size, and every weapon here commits to all
 * three:
 *   1. A METALLIC EDGE — a single bright, thin highlight run down the blade/head.
 *      More than any amount of shading, that hot specular line is what makes a
 *      pixel blob read as *sharpened steel*.
 *   2. A DISTINCT GRIP — the handle uses a different material (wrapped leather,
 *      bone, carved wood, bound cloth) so the eye separates "the part you hold"
 *      from "the part that hurts".
 *   3. A GLOW — each weapon's `glow` colour, laid down emissive on its magical
 *      part (a fire crown, a void gem, a toxic ichor edge), so enchanted arms
 *      are legible in a dark world.
 *
 * Colours come from weaponVisuals.ts (primary / secondary / glow), inlined here
 * as a hex map to keep the sprite layer free of a data-layer import cycle — the
 * same pattern enemies.ts and npcs.ts use.
 */

import { PixelCanvas, type DrawOptions } from '../render/PixelCanvas';
import { MATERIAL, mix, shift } from '../render/Palette';

/** Palette for one weapon, mirrored from WEAPON_VISUALS (weaponVisuals.ts). */
interface WeaponPalette {
  primary: string; // blade / head metal or magical body
  secondary: string; // haft / grip material
  glow: string; // emissive magical accent
}

const PALETTE: Record<string, WeaponPalette> = {
  rustblade: { primary: '#c5cbd3', secondary: '#79563a', glow: '#e7ebef' },
  graveaxe: { primary: '#d3a05d', secondary: '#6f4a31', glow: '#f4c77f' },
  witchbow: { primary: '#76c4a4', secondary: '#4e6f61', glow: '#b7ffe0' },
  ashstaff: { primary: '#e56a48', secondary: '#684031', glow: '#ffca72' },
  moonblade: { primary: '#a8b8ee', secondary: '#555d79', glow: '#e2e8ff' },
  reliquary: { primary: '#bf78e2', secondary: '#59406c', glow: '#f1bdff' },
  bogreaper: { primary: '#6fc79b', secondary: '#476a53', glow: '#b5ffd5' },
  cinderbrand: { primary: '#f2774c', secondary: '#713c31', glow: '#ffd07a' },
};

const FALLBACK: WeaponPalette = PALETTE.rustblade;
const paletteOf = (id: string): WeaponPalette => PALETTE[id] ?? FALLBACK;

const OUTLINE = '#111019';
const RIM = '#9aa2bd';

/** Held-in-hand canvas footprint. */
const HELD = 30;
/** Inventory icon footprint — bigger, so the presentation view can breathe. */
const ICON = 40;

/**
 * Draw a bright, thin specular line down one long edge of a bladed shape. This
 * is the single most important flourish in the file — see the module note. It's
 * laid emissive so the lighting pass can't dim it away, and kept to one pixel
 * wide so it stays a *glint*, not a stripe.
 */
function edgeGlint(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, color: string, opts: DrawOptions = {}): void {
  c.line(x0, y0, x1, y1, color, 1, { emissive: true, ...opts });
}

// ---------------------------------------------------------------------------
// Held views. Every weapon is composed along a lower-left → upper-right
// diagonal: the grip sits at the bottom-left (where the fist is) and the
// business end points up and to the right, which is how it reads mid-swing.
// `scale` lets the icon builder reuse the exact same geometry at a larger size.
// ---------------------------------------------------------------------------

interface Layout {
  /** Canvas size (square). */
  size: number;
  /** Whole-figure scale multiplier relative to the 30px held view. */
  s: number;
  /** Whether this is the clean icon view (slightly straighter, more centred). */
  icon: boolean;
}

/** A straight sword-like weapon: grip, guard, and a long tapering blade with a
 * hot edge. Used (with tweaks) by several of the melee weapons. */
function drawBladeWeapon(
  c: PixelCanvas,
  p: WeaponPalette,
  L: Layout,
  cfg: {
    /** How pitted/rough the blade is (rustblade) vs. clean (moonblade). */
    pitted?: boolean;
    /** Curve the blade into a cleaver/sabre profile. */
    curved?: boolean;
    /** Flame licking up the blade (cinderbrand). */
    flaming?: boolean;
    /** Grip material override. */
    grip?: string;
  },
): void {
  const cx = c.width / 2;
  const cy = c.height / 2;
  const s = L.s;
  // Anchor the grip toward the lower-left and run the blade to the upper-right.
  const gripX = cx - 7 * s;
  const gripY = cy + 9 * s;
  const tipX = cx + 9 * s;
  const tipY = cy - 11 * s;
  // Guard sits between grip and blade.
  const guardX = gripX + (tipX - gripX) * 0.28;
  const guardY = gripY + (tipY - gripY) * 0.28;

  const grip = cfg.grip ?? p.secondary;

  // ----- Grip: wrapped leather over a tang. Cross-hatched binding.
  c.line(gripX, gripY, guardX, guardY, grip, Math.max(2, Math.round(3 * s)), { shape: 'cylinder-x', height: 4 });
  // Binding rings across the grip so it reads as wrapped, not smooth.
  const wraps = 3;
  for (let i = 1; i <= wraps; i += 1) {
    const t = i / (wraps + 1);
    const wx = gripX + (guardX - gripX) * t;
    const wy = gripY + (guardY - gripY) * t;
    c.rect(wx - 1, wy - 0.5, 2, 1, shift(grip, -0.12), { shape: 'flat', height: 5, shade: 0.85 });
  }
  // Pommel knob at the very base.
  c.circle(gripX, gripY, 1.6 * s, shift(grip, 0.06), { shape: 'round', height: 5 });

  // ----- Guard / crossguard: a short bar of darker metal.
  const gnx = -(tipY - gripY);
  const gny = tipX - gripX;
  const glen = Math.hypot(gnx, gny) || 1;
  const perpX = (gnx / glen) * 3 * s;
  const perpY = (gny / glen) * 3 * s;
  c.line(guardX - perpX, guardY - perpY, guardX + perpX, guardY + perpY, shift(MATERIAL.bronze, -0.04), Math.max(2, Math.round(2 * s)), { shape: 'cylinder-y', height: 6 });

  // ----- Blade: a filled quad from the guard to the tip. Two edges: a spine
  // (dark) and a hot honed edge (bright). Curved weapons bow the far edge out.
  const bladeBaseHalf = 2.4 * s;
  // Unit direction along the blade.
  const bdx = (tipX - guardX) / (Math.hypot(tipX - guardX, tipY - guardY) || 1);
  const bdy = (tipY - guardY) / (Math.hypot(tipX - guardX, tipY - guardY) || 1);
  // Perpendicular (points toward the honed edge, upper-left).
  const pnx = -bdy;
  const pny = bdx;
  const bow = cfg.curved ? 2.2 * s : 0;
  const midX = (guardX + tipX) / 2 + pnx * bow;
  const midY = (guardY + tipY) / 2 + pny * bow;
  // Blade polygon: base corners → curved mid on the edge side → tip.
  c.polygon([
    [guardX + pnx * bladeBaseHalf, guardY + pny * bladeBaseHalf],
    [midX + pnx * bladeBaseHalf * 0.7, midY + pny * bladeBaseHalf * 0.7],
    [tipX, tipY],
    [midX - pnx * bladeBaseHalf * 0.5, midY - pny * bladeBaseHalf * 0.5],
    [guardX - pnx * bladeBaseHalf, guardY - pny * bladeBaseHalf],
  ], p.primary, { shape: 'cylinder-x', height: 7, curve: 0.9 });

  // Spine shadow down the back edge.
  c.line(guardX - pnx * bladeBaseHalf * 0.7, guardY - pny * bladeBaseHalf * 0.7, tipX, tipY, shift(p.primary, -0.2), Math.max(1, Math.round(1 * s)), { height: 6, shade: 0.7 });

  // Pitting for the rustblade: scatter dark flecks along the blade.
  if (cfg.pitted) {
    const rust = MATERIAL.rust;
    for (let i = 0; i < 6; i += 1) {
      const t = (i + 0.5) / 6;
      const bx = guardX + (tipX - guardX) * t + pnx * (Math.sin(i * 3.1) * 1.2);
      const by = guardY + (tipY - guardY) * t + pny * (Math.sin(i * 3.1) * 1.2);
      c.rect(bx - 0.5, by - 0.5, 1 + (i % 2), 1, mix(rust, p.primary, 0.3), { shape: 'flat', height: 6, shade: 0.8 });
    }
  }

  // ----- THE metallic honed edge: a bright glint down the leading edge.
  const eGlint = cfg.pitted ? mix(p.glow, MATERIAL.rust, 0.25) : p.glow;
  edgeGlint(c, guardX + pnx * bladeBaseHalf, guardY + pny * bladeBaseHalf, tipX, tipY, eGlint, { alpha: cfg.pitted ? 0.85 : 1 });

  // ----- Flame for the cinderbrand: emissive tongues licking off the blade.
  if (cfg.flaming) {
    for (let i = 0; i < 5; i += 1) {
      const t = 0.2 + (i / 5) * 0.8;
      const fx = guardX + (tipX - guardX) * t + pnx * (1.5 * s);
      const fy = guardY + (tipY - guardY) * t + pny * (1.5 * s);
      const flick = 2 + (i % 2) * 1.5;
      c.ellipse(fx, fy, 1.6 * s, flick, p.glow, { emissive: true, alpha: 0.6 });
      c.ellipse(fx, fy - 0.5, 0.9 * s, flick * 0.6, MATERIAL.flame, { emissive: true, alpha: 0.8 });
    }
    // Ember core hugging the blade.
    edgeGlint(c, guardX, guardY, tipX, tipY, MATERIAL.emberCore, { alpha: 0.5 });
  }
}

/** RUSTBLADE — a pitted, corroded arming sword. Straight, dull, honed only along
 * the very edge where the rust has been ground back. */
function drawRustblade(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  drawBladeWeapon(c, p, L, { pitted: true, grip: mix(p.secondary, MATERIAL.leatherDark, 0.3) });
}

/** MOONBLADE — an elegant curved cleaver in pale moon-steel. Clean, bright, a
 * cold blue glint the whole length of the sweep. */
function drawMoonblade(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  drawBladeWeapon(c, p, L, { curved: true, grip: mix(p.secondary, MATERIAL.cloth, 0.3) });
}

/** CINDERBRAND — a straight brand-sword wreathed in fire. The blade is dark iron
 * but flame runs its length and an ember edge burns hot. */
function drawCinderbrand(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  drawBladeWeapon(c, p, { ...L }, { flaming: true, grip: mix(p.secondary, MATERIAL.leatherDark, 0.4) });
}

/** GRAVEAXE — a heavy bearded battle-axe: a thick wooden haft and a broad
 * single-bit head with a long "beard" hooking down, capped by a hot edge. */
function drawGraveaxe(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  const cx = c.width / 2;
  const cy = c.height / 2;
  const s = L.s;
  // Haft runs bottom-left to upper-right.
  const buttX = cx - 8 * s;
  const buttY = cy + 10 * s;
  const topX = cx + 6 * s;
  const topY = cy - 10 * s;
  const haft = mix(MATERIAL.wood, p.secondary, 0.5);
  c.line(buttX, buttY, topX, topY, haft, Math.max(2, Math.round(2.4 * s)), { shape: 'cylinder-x', height: 5 });
  edgeGlint(c, buttX, buttY, topX, topY, shift(haft, 0.14), { alpha: 0.5, shade: 1 }); // lit side of the shaft
  // Grip binding near the butt.
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 6;
    const wx = buttX + (topX - buttX) * t;
    const wy = buttY + (topY - buttY) * t;
    c.rect(wx - 1, wy - 0.5, 2, 1, MATERIAL.leatherDark, { shape: 'flat', height: 6 });
  }

  // Axe head: a broad single bit mounted on the upper-right of the haft. Built
  // for a clear BEARDED-AXE read — a compact socket, a near-straight top, and a
  // deep sweeping cutting edge whose lower "beard" hooks well below the socket.
  const headCx = cx + 3.5 * s;
  const headCy = cy - 6.5 * s;
  // Socket cheek: a squarish block hugging the haft — the mounting mass.
  c.rect(headCx - 2.5 * s, headCy - 2 * s, 3 * s, 6 * s, shift(p.primary, -0.14), { shape: 'cylinder-y', height: 8, shade: 0.82 });
  // The bit: a wedge fanning out to the cutting edge. Top edge nearly straight,
  // bottom edge plunges past the socket into a hooked beard.
  c.polygon([
    [headCx - 0.5 * s, headCy - 3 * s], // top, at the socket
    [headCx + 6.5 * s, headCy - 1.5 * s], // top corner of the edge
    [headCx + 6 * s, headCy + 4 * s], // edge belly
    [headCx + 2.5 * s, headCy + 8 * s], // beard tip, hooking down below the socket
    [headCx + 0.5 * s, headCy + 6 * s], // beard root
    [headCx - 0.5 * s, headCy + 3.5 * s], // back to socket bottom
  ], p.primary, { shape: 'dome', height: 9, curve: 0.7 });
  // Cheek bevel + fuller line, so the flat of the bit reads as forged, not flat.
  c.line(headCx + 0.5 * s, headCy - 1.5 * s, headCx + 3 * s, headCy + 5 * s, shift(p.primary, -0.16), 1, { height: 8, shade: 0.72 });
  c.ellipse(headCx + 1.5 * s, headCy + 1 * s, 1.2 * s, 2.4 * s, shift(p.primary, 0.12), { shape: 'round', height: 9, shade: 1 }); // struck-cheek highlight

  // THE metallic edge: a hot glint running the full curved cutting arc, top
  // corner down to the beard tip. This is what sells "sharpened".
  edgeGlint(c, headCx + 6.5 * s, headCy - 1.5 * s, headCx + 6 * s, headCy + 4 * s, p.glow);
  edgeGlint(c, headCx + 6 * s, headCy + 4 * s, headCx + 2.5 * s, headCy + 8 * s, p.glow);
  // A faint warm inner glow so the heavy grave-iron feels charged.
  c.ellipse(headCx + 3 * s, headCy + 2 * s, 1.4 * s, 2 * s, p.glow, { emissive: true, alpha: 0.14 });
}

/** WITCHBOW — a crossbow: a horizontal bow lath, a straight stock along the
 * diagonal, a nocked bolt, and a green-glowing enchantment at the lath centre. */
function drawWitchbow(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  const cx = c.width / 2;
  const cy = c.height / 2;
  const s = L.s;
  // Stock runs bottom-left (grip) to upper-right (muzzle), like the blades.
  const gripX = cx - 7 * s;
  const gripY = cy + 8 * s;
  const noseX = cx + 8 * s;
  const noseY = cy - 8 * s;
  const wood = mix(MATERIAL.wood, p.secondary, 0.6);
  // Stock body.
  c.line(gripX, gripY, noseX, noseY, wood, Math.max(2, Math.round(3 * s)), { shape: 'cylinder-x', height: 5 });
  edgeGlint(c, gripX, gripY, noseX, noseY, shift(wood, 0.12), { alpha: 0.45 });
  // Grip wrap.
  c.circle(gripX, gripY, 1.6 * s, shift(wood, -0.1), { shape: 'round', height: 5 });

  // Bow lath: mounted across the muzzle, roughly perpendicular to the stock, its
  // two limbs curving back. Drawn as two arms of dark horn.
  const lath = p.primary;
  const dirx = (noseX - gripX) / (Math.hypot(noseX - gripX, noseY - gripY) || 1);
  const diry = (noseY - gripY) / (Math.hypot(noseX - gripX, noseY - gripY) || 1);
  const px = -diry;
  const py = dirx;
  const limb = 7 * s;
  const tip1x = noseX + px * limb - dirx * 1.5 * s;
  const tip1y = noseY + py * limb - diry * 1.5 * s;
  const tip2x = noseX - px * limb - dirx * 1.5 * s;
  const tip2y = noseY - py * limb - diry * 1.5 * s;
  c.line(noseX, noseY, tip1x, tip1y, lath, Math.max(1, Math.round(1.6 * s)), { shape: 'cylinder-y', height: 6 });
  c.line(noseX, noseY, tip2x, tip2y, lath, Math.max(1, Math.round(1.6 * s)), { shape: 'cylinder-y', height: 6 });
  // Bowstring between the limb tips.
  c.line(tip1x, tip1y, tip2x, tip2y, mix(MATERIAL.bone, '#ffffff', 0.3), 1, { height: 7, shade: 0.9 });

  // Nocked bolt lying down the stock, tip past the lath.
  c.line(cx, cy, noseX + dirx * 3 * s, noseY + diry * 3 * s, MATERIAL.woodPale, 1, { height: 7 });
  c.polygon([
    [noseX + dirx * 3 * s, noseY + diry * 3 * s],
    [noseX + dirx * 1.5 * s + px * 1.2 * s, noseY + diry * 1.5 * s + py * 1.2 * s],
    [noseX + dirx * 1.5 * s - px * 1.2 * s, noseY + diry * 1.5 * s - py * 1.2 * s],
  ], shift(p.primary, 0.1), { shape: 'flat', height: 8 }); // bolt head

  // Green enchantment glowing at the lath centre — the witch's mark.
  c.circle(noseX, noseY, 1.8 * s, p.glow, { shape: 'round', emissive: true });
  c.circle(noseX, noseY, 0.9 * s, mix(p.glow, '#ffffff', 0.5), { emissive: true });
  // Metallic glint on the bolt head.
  edgeGlint(c, noseX + dirx * 3 * s, noseY + diry * 3 * s, noseX + dirx * 1.5 * s + px * 1.2 * s, noseY + diry * 1.5 * s + py * 1.2 * s, MATERIAL.steel, { alpha: 0.8 });
}

/** A capped staff: a long shaft with a magical crown at the top. Shared by the
 * ashstaff (fire crown) and reliquary (void artifact). */
function drawStaffWeapon(
  c: PixelCanvas,
  p: WeaponPalette,
  L: Layout,
  variant: 'fire' | 'void',
): void {
  const cx = c.width / 2;
  const cy = c.height / 2;
  const s = L.s;
  const buttX = cx - 7 * s;
  const buttY = cy + 10 * s;
  const topX = cx + 6 * s;
  const topY = cy - 9 * s;
  const wood = variant === 'void' ? mix(p.secondary, MATERIAL.wood, 0.4) : mix(MATERIAL.wood, p.secondary, 0.5);
  // Shaft.
  c.line(buttX, buttY, topX, topY, wood, Math.max(2, Math.round(2.2 * s)), { shape: 'cylinder-x', height: 5 });
  edgeGlint(c, buttX, buttY, topX, topY, shift(wood, 0.14), { alpha: 0.4 });
  // Wrapped grip in the middle.
  const dirx = (topX - buttX) / (Math.hypot(topX - buttX, topY - buttY) || 1);
  const diry = (topY - buttY) / (Math.hypot(topX - buttX, topY - buttY) || 1);
  for (let i = 0; i < 3; i += 1) {
    const t = 0.45 + i * 0.08;
    const wx = buttX + (topX - buttX) * t;
    const wy = buttY + (topY - buttY) * t;
    c.rect(wx - 1, wy - 0.5, 2, 1, MATERIAL.leatherDark, { shape: 'flat', height: 6 });
  }

  const headX = topX + dirx * 1.5 * s;
  const headY = topY + diry * 1.5 * s;

  if (variant === 'fire') {
    // Iron claw setting: a small cup with three clear upward prongs cradling a
    // molten core, and a tall braided flame rising above — a proper fire-staff.
    c.rect(headX - 2.4 * s, headY, 4.8 * s, 2.4 * s, MATERIAL.iron, { shape: 'cylinder-y', height: 8, curve: 0.7 }); // cup
    c.rect(headX - 2.4 * s, headY, 4.8 * s, 1, shift(MATERIAL.iron, 0.14), { shape: 'flat', height: 9 }); // cup rim highlight
    [-1, 0, 1].forEach((sd) => {
      c.line(headX + sd * 2 * s, headY, headX + sd * 1.6 * s, headY - 3 * s, MATERIAL.iron, Math.max(1, Math.round(1 * s)), { shape: 'cylinder-y', height: 9 }); // prong
    });
    // Molten core seated in the cup (emissive).
    c.circle(headX, headY, 1.5 * s, p.glow, { shape: 'round', emissive: true });
    c.circle(headX, headY - 0.3 * s, 0.8 * s, MATERIAL.flame, { emissive: true });
    // Tall layered flame: an outer glow body, an inner bright tongue, licking
    // higher than the prongs so the fire is the unmistakable read.
    c.polygon([
      [headX - 2.4 * s, headY - 1 * s],
      [headX - 1 * s, headY - 5 * s],
      [headX, headY - 3 * s],
      [headX + 1 * s, headY - 6.5 * s],
      [headX + 2.4 * s, headY - 1 * s],
    ], p.glow, { emissive: true, alpha: 0.55 });
    c.polygon([
      [headX - 1.2 * s, headY - 1.5 * s],
      [headX, headY - 5.5 * s],
      [headX + 1.2 * s, headY - 1.5 * s],
    ], MATERIAL.flame, { emissive: true, alpha: 0.9 });
    c.rect(headX - 0.5, headY - 4.5 * s, 1, 2 * s, MATERIAL.emberCore, { emissive: true }); // hot core streak
  } else {
    // Void reliquary: a forbidden artifact — a dark clawed reliquary box cradling
    // a purple void gem that bleeds light, with orbiting motes.
    c.rect(headX - 2.5 * s, headY - 3 * s, 5 * s, 6 * s, mix(MATERIAL.iron, p.secondary, 0.5), { shape: 'bevel', height: 8, curve: 0.7 });
    // Gold reliquary trim.
    c.rect(headX - 2.5 * s, headY - 3 * s, 5 * s, 1, MATERIAL.gold, { shape: 'flat', height: 9 });
    c.rect(headX - 2.5 * s, headY + 2 * s, 5 * s, 1, MATERIAL.gold, { shape: 'flat', height: 9 });
    // Void gem (emissive core with a bright pupil).
    c.ellipse(headX, headY, 1.8 * s, 2.4 * s, p.primary, { shape: 'round', height: 9, emissive: true });
    c.ellipse(headX, headY - 0.5 * s, 0.9 * s, 1.4 * s, p.glow, { emissive: true });
    c.rect(headX - 0.5, headY - 0.5, 1, 1, '#ffffff', { emissive: true, alpha: 0.9 }); // spark
    // Orbiting void motes.
    for (let i = 0; i < 3; i += 1) {
      const ang = (i / 3) * Math.PI * 2;
      c.circle(headX + Math.cos(ang) * 3.5 * s, headY + Math.sin(ang) * 3.5 * s, 0.8 * s, p.glow, { emissive: true, alpha: 0.6 });
    }
  }
}

/** ASHSTAFF — a fire-topped staff. */
function drawAshstaff(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  drawStaffWeapon(c, p, L, 'fire');
}

/** RELIQUARY — a forbidden void artifact on a haft. */
function drawReliquary(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  drawStaffWeapon(c, p, L, 'void');
}

/** BOGREAPER — a curved sickle/scythe. A wooden snath, a long inward-curving
 * blade, and a toxic-green ichor weeping along the edge. */
function drawBogreaper(c: PixelCanvas, p: WeaponPalette, L: Layout): void {
  const cx = c.width / 2;
  const cy = c.height / 2;
  const s = L.s;
  const buttX = cx - 8 * s;
  const buttY = cy + 10 * s;
  const topX = cx + 5 * s;
  const topY = cy - 8 * s;
  const snath = mix(MATERIAL.wood, p.secondary, 0.55);
  // Snath (handle).
  c.line(buttX, buttY, topX, topY, snath, Math.max(2, Math.round(2.2 * s)), { shape: 'cylinder-x', height: 5 });
  edgeGlint(c, buttX, buttY, topX, topY, shift(snath, 0.12), { alpha: 0.4 });
  // Grip wraps.
  for (let i = 1; i <= 2; i += 1) {
    const t = i / 5;
    const wx = buttX + (topX - buttX) * t;
    const wy = buttY + (topY - buttY) * t;
    c.rect(wx - 1, wy - 0.5, 2, 1, MATERIAL.leatherDark, { shape: 'flat', height: 6 });
  }

  // Curved blade sweeping from the top of the snath, hooking left/up like a
  // scythe. Built from a chain of points so it reads as a smooth crescent.
  const bx = topX;
  const by = topY;
  const arc: Array<[number, number]> = [
    [bx, by + 1 * s],
    [bx + 2 * s, by - 2 * s],
    [bx + 1 * s, by - 6 * s],
    [bx - 3 * s, by - 8 * s],
    [bx - 7 * s, by - 7 * s],
  ];
  // Fill the blade body as a thick crescent (outer arc + inner arc back).
  c.polygon([
    ...arc,
    [bx - 6 * s, by - 5 * s],
    [bx - 2 * s, by - 5 * s],
    [bx, by - 3 * s],
    [bx - 1 * s, by],
  ], p.primary, { shape: 'cylinder-x', height: 7, curve: 0.85 });

  // Toxic ichor + THE edge glint along the concave cutting edge.
  edgeGlint(c, bx + 1 * s, by - 6 * s, bx - 7 * s, by - 7 * s, p.glow);
  // Ichor drips weeping off the blade.
  for (let i = 0; i < 3; i += 1) {
    const t = 0.3 + i * 0.25;
    const dx = bx + 1 * s + (-8 * s) * t;
    const dy = by - 6.5 * s + (Math.sin(t * 3) * 1);
    c.circle(dx, dy + 2 * s, 0.9 * s, p.glow, { emissive: true, alpha: 0.7 });
  }
  // Iron collar binding blade to snath.
  c.circle(topX, topY, 1.6 * s, MATERIAL.iron, { shape: 'round', height: 8 });
}

type Drawer = (c: PixelCanvas, p: WeaponPalette, L: Layout) => void;

const DRAWERS: Record<string, Drawer> = {
  rustblade: drawRustblade,
  graveaxe: drawGraveaxe,
  witchbow: drawWitchbow,
  ashstaff: drawAshstaff,
  moonblade: drawMoonblade,
  reliquary: drawReliquary,
  bogreaper: drawBogreaper,
  cinderbrand: drawCinderbrand,
};

/** Dark keyline + faint lit edge, applied once per weapon. Kept subtle so the
 * emissive glints and glows stay the brightest thing on the sprite. */
function finish(c: PixelCanvas): void {
  c.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.92 });
}

/** Held-in-hand view (~30x30). Keyed `held-{id}` by the frame builder. */
export function renderWeapon(id: string): PixelCanvas {
  const c = new PixelCanvas(HELD, HELD);
  const draw = DRAWERS[id] ?? drawRustblade;
  draw(c, paletteOf(id), { size: HELD, s: 1, icon: false });
  finish(c);
  return c;
}

/** Larger, cleaner presentation view (~40x40) for inventory/shop UI. Same
 * geometry, scaled up so surface detail and the glow read at rest. */
export function renderWeaponIcon(id: string): PixelCanvas {
  const c = new PixelCanvas(ICON, ICON);
  const draw = DRAWERS[id] ?? drawRustblade;
  // Scale geometry to the larger canvas; a touch under the size ratio so nothing
  // clips the padding.
  draw(c, paletteOf(id), { size: ICON, s: 1.28, icon: true });
  finish(c);
  return c;
}

/**
 * Lighting profile for weapons. Cooler and more specular than the character
 * shade — metal wants a harder key and a stronger rim so edges pop — while the
 * emissive glints/glows bypass lighting entirely.
 */
export const WEAPON_SHADE = {
  lightX: -0.5,
  lightY: -0.72,
  lightZ: 0.46,
  intensity: 0.72,
  ambient: 0.46,
  ambientColor: '#54607f',
  occlusion: 0.34,
  rim: 0.32,
  rimColor: '#c9d2e8',
  bands: 6,
  dither: 0.4,
};

/**
 * Every weapon texture the game needs. Emits the legacy `held-{id}` keys the
 * scenes already pin to the player, plus a `wicon-{id}` for each UI icon.
 */
export function buildWeaponFrames(): Array<{ key: string; canvas: PixelCanvas }> {
  const frames: Array<{ key: string; canvas: PixelCanvas }> = [];
  for (const id of Object.keys(DRAWERS)) {
    frames.push({ key: `held-${id}`, canvas: renderWeapon(id) });
    frames.push({ key: `wicon-${id}`, canvas: renderWeaponIcon(id) });
  }
  return frames;
}

export type { DrawOptions };
