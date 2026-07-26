/**
 * The bestiary — Trupy's enemy sprite factory.
 *
 * Same philosophy as the hero (see ./hero.ts): every creature is generated at
 * runtime and sculpted from shaped primitives rather than stacked rectangles, so
 * the depth-aware lighting in PixelCanvas gives them real volume. What matters
 * most here is the *silhouette*: a player under pressure identifies a threat by
 * its outline in a single frame, long before any surface detail registers. So
 * each of the nine creatures is built around one unmistakable shape —
 *
 *   husk        tall, thin, stooped, arms hanging past the knees
 *   boneguard   broad wall of a skeleton behind a round shield
 *   direwolf    long low horizontal quadruped, head down and forward
 *   wraith      floating teardrop, no legs, dissolving into mist
 *   bogling     squat sphere, belly wider than shoulders
 *   cavecrawler wide low arthropod bristling with legs
 *   ashborn     cracked humanoid leaking light from its fissures
 *   nameless    (boss) impossibly tall, many-armed, veiled — vertical menace
 *   cinderlord  (boss) massive armoured mass, horned, caped in embers — bulk
 *
 * Bosses are not scaled-up mooks: they get their own larger canvases, asymmetry,
 * and extra silhouette-defining parts (arms, horns, capes) so their scale reads
 * as *presence*, not zoom.
 */

import { PixelCanvas, type DrawOptions } from '../render/PixelCanvas';
import { mix, shift } from '../render/Palette';

/** The five combat states every enemy shares with the rest of the game. */
export type EnemyPose = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

/** Frame counts per pose — mirrors the hero's cadence for animation timing. */
export const ENEMY_POSE_FRAMES: Record<EnemyPose, number> = {
  idle: 4, // slow breathe / hover loop
  walk: 6, // full locomotion cycle
  attack: 3, // wind-up, strike, recover
  hurt: 1, // single recoil pose
  death: 4, // progressive collapse
};

/** Canvas footprint for one enemy. Bosses claim more room to feel big. */
interface EnemyDim {
  w: number;
  h: number;
}

/**
 * Per-enemy canvas sizes. Kept generous enough that arms, capes and lunging
 * attack frames never clip the edge. Boss dimensions roughly track their
 * `scale` field in ENEMIES but are hand-tuned for their specific silhouette
 * (nameless is tall and narrow; cinderlord is a wide slab).
 */
export const ENEMY_SIZE: Record<string, EnemyDim> = {
  husk: { w: 34, h: 46 },
  boneguard: { w: 40, h: 46 },
  direwolf: { w: 48, h: 34 }, // wide + short: the quadruped reads horizontally
  wraith: { w: 36, h: 48 },
  bogling: { w: 38, h: 40 },
  cavecrawler: { w: 50, h: 32 }, // widest footprint, lowest profile
  ashborn: { w: 38, h: 48 },
  nameless: { w: 52, h: 66 }, // tallest thing in the game
  cinderlord: { w: 60, h: 62 }, // heaviest mass in the game
};

/** Fallback dimension for an unknown id, so the factory never throws. */
const DEFAULT_DIM: EnemyDim = { w: 40, h: 46 };

export function enemyDim(id: string): EnemyDim {
  return ENEMY_SIZE[id] ?? DEFAULT_DIM;
}

/**
 * Base tints copied from ENEMIES (content.ts) as hex, so this file stays free of
 * a runtime import cycle with the data layer. Each is the creature's primary
 * material colour; ramps and accents are derived from it in the draw functions.
 */
const TINT: Record<string, string> = {
  husk: '#9ca87c',
  boneguard: '#d7c9aa',
  direwolf: '#7d708a',
  wraith: '#796aab',
  bogling: '#4e8a75',
  cavecrawler: '#8b7159',
  ashborn: '#c35d47',
  nameless: '#b25987',
  cinderlord: '#e06143',
};

const OUTLINE = '#101019';
const RIM = '#8f9bc4';
const VOID_EYE = '#d3f0ff'; // cold spectral eye-shine, used across the undead

/**
 * Generic per-frame motion. Every creature reads the fields it cares about and
 * ignores the rest, so one small kinematics model drives wildly different bodies
 * (a hovering wraith, a galloping wolf, a lumbering boss).
 */
interface Kinematics {
  /** Vertical bob of the whole body (breathing, hovering, gait bounce). */
  bob: number;
  /** Primary limb swing amplitude, in pixels. */
  stride: number;
  /** Forward reach for the striking limb on attack frames. */
  reach: number;
  /** Body lean along the facing (forward) axis. */
  lean: number;
  /** 0..1 collapse progress for the death sequence. */
  collapse: number;
  /** Horizontal recoil, used by the single hurt pose. */
  recoil: number;
  /** Squash factor for impact/landing frames. */
  squash: number;
}

const ZERO_K: Kinematics = { bob: 0, stride: 0, reach: 0, lean: 0, collapse: 0, recoil: 0, squash: 0 };

/**
 * Resolve motion for a pose/frame. `speed` scales the walk bounce so fast, light
 * creatures (the wolf) bob more energetically than heavy ones (the bosses).
 */
function kinematics(pose: EnemyPose, frame: number, speed = 1): Kinematics {
  switch (pose) {
    case 'idle': {
      // Gentle 4-frame breathe. A half-pixel lift at the top of the cycle.
      const phase = (frame / ENEMY_POSE_FRAMES.idle) * Math.PI * 2;
      return { ...ZERO_K, bob: Math.sin(phase) > 0.3 ? -1 : 0 };
    }
    case 'walk': {
      // 6-frame gait: sinusoidal stride, bounce peaks between contacts.
      const phase = (frame / ENEMY_POSE_FRAMES.walk) * Math.PI * 2;
      const stride = Math.round(Math.sin(phase) * 3);
      const bob = Math.round((Math.abs(Math.cos(phase)) - 0.5) * 2 * speed);
      return { ...ZERO_K, stride, bob, lean: Math.round(Math.abs(Math.sin(phase)) * 0.6) };
    }
    case 'attack': {
      // wind-up (draw back), strike (full extension), recover.
      const table: Kinematics[] = [
        { ...ZERO_K, reach: -3, lean: -2, bob: 0 },
        { ...ZERO_K, reach: 8, lean: 3, bob: -1, squash: 1 },
        { ...ZERO_K, reach: 3, lean: 1, bob: 0 },
      ];
      return table[Math.min(2, frame)];
    }
    case 'hurt':
      // Knocked back and down, torso jolted away from the blow.
      return { ...ZERO_K, recoil: -3, lean: -3, bob: 1, squash: 2 };
    case 'death': {
      // 4 frames easing toward the ground; collapse drives sink + fade + splay.
      const t = Math.min(1, frame / (ENEMY_POSE_FRAMES.death - 1));
      const eased = t * t; // accelerate as it falls
      return { ...ZERO_K, collapse: eased, bob: Math.round(eased * 4), squash: Math.round(eased * 3) };
    }
    default:
      return ZERO_K;
  }
}

/** Death fade: bodies dim and thin out as they collapse. */
function deathAlpha(k: Kinematics): number {
  return 1 - k.collapse * 0.55;
}

// ---------------------------------------------------------------------------
// Individual creatures. Each function owns its anatomy and reads `k` however
// suits its build. Convention (matching hero.ts): groundShadow first, body from
// back to front, outline last (added by the shared dispatcher).
// ---------------------------------------------------------------------------

/**
 * HUSK — a starved, half-feral human. The read is verticality gone wrong: a
 * narrow stooped frame, a head sunk between hunched shoulders, and arms so long
 * and slack they hang past the knees. Torn rags flap at the hem. No weapon; it
 * claws. Hollow glowing eyes mark it as no longer human.
 */
function drawHusk(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 4;
  c.groundShadow(cx, groundY, 8 - k.squash, 3, 0.4);

  const alpha = deathAlpha(k);
  const skin = mix(TINT.husk, '#6f5a48', 0.35); // sickly grey-green flesh
  const skinDeep = shift(skin, -0.14, -6);
  const rag = mix(TINT.husk, '#4a4436', 0.5); // filthy torn cloth
  const lean = k.lean + k.recoil;
  // Death: the whole figure folds forward and down.
  const fold = Math.round(k.collapse * 10);
  const baseY = 4 + k.bob + Math.round(k.collapse * 8);

  // Long, slack, ape-like arms — the husk's signature. Upper arm splays a little
  // off the hunched shoulder, then a LONG forearm hangs almost to the shins so
  // the hands dangle past the knees. Drawn behind the torso so they read as
  // trailing limply. On the attack the near arm swings a raking claw forward.
  const armSwing = Math.round(k.stride * 0.8);
  const armReach = Math.round(k.reach); // near arm rakes forward on strike
  [-1, 1].forEach((side) => {
    const ax = cx + side * 5 + lean;
    const swing = side > 0 ? armReach : Math.round(armReach * -0.3);
    // Upper arm (short) canting outward from the sunken shoulder.
    c.rect(ax - 1 + side, baseY + 13, 3, 6, rag, { shape: 'cylinder-y', height: 6, curve: 0.85, alpha });
    // Forearm (long, ~10px) hanging down and slightly outward — the drooping read.
    const fx = ax + side * 2 + swing;
    c.rect(fx - 1, baseY + 18, 3, 10 - fold, skin, { shape: 'cylinder-y', height: 5, curve: 0.9, alpha });
    // Splayed clawing hand near knee height, fingers as short dark spurs.
    const hy = baseY + 28 - fold;
    c.ellipse(fx + 0.5, hy, 2.4, 2, skinDeep, { shape: 'round', height: 4, alpha });
    for (let d = -1; d <= 1; d += 1) {
      c.line(fx + 0.5, hy + 1, fx + 0.5 + d, hy + 3, skinDeep, 1, { height: 4, alpha });
    }
  });

  // Spindly legs, knees slightly bent.
  const legY = baseY + 26;
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * 3 + Math.round(k.stride * side * 0.6);
    c.rect(lx - 1, legY, 3, 12 - fold, skinDeep, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.8 : 1, alpha });
    c.ellipse(lx + 0.5, legY + 12 - fold, 2.4, 1.6, skinDeep, { shape: 'round', height: 4, shade: 0.85, alpha });
  });

  // Torso: a gaunt cylinder, ribs implied by a darker central shade. Narrow.
  const torsoY = baseY + 12;
  c.rect(cx - 4 + lean, torsoY, 8, 12 - Math.round(fold * 0.5), skin, { shape: 'cylinder-y', height: 9, curve: 0.95, alpha });
  // Sunken sternum shadow — reads as an emaciated ribcage.
  c.rect(cx - 1 + lean, torsoY + 2, 2, 7, skinDeep, { shape: 'flat', height: 9, shade: 0.7, alpha });
  // Ragged loincloth / shirt hem, torn into points that lag behind the stride.
  const hemSway = Math.round(k.stride * 0.5);
  c.polygon([
    [cx - 5 + lean, torsoY + 9],
    [cx + 5 + lean, torsoY + 9],
    [cx + 4 + lean + hemSway, torsoY + 15],
    [cx + 1 + lean + hemSway, torsoY + 12],
    [cx - 1 + lean + hemSway, torsoY + 15],
    [cx - 4 + lean + hemSway, torsoY + 12],
  ], rag, { shape: 'cylinder-y', height: 7, curve: 0.7, alpha });

  // Head, sunk forward between the shoulders (the signature stoop).
  const headY = baseY + 4 + fold;
  const headX = cx + lean + Math.round(k.lean * 1.5);
  c.rect(cx - 1.5 + lean, baseY + 10, 3, 4, skinDeep, { shape: 'cylinder-y', height: 8, shade: 0.7, alpha }); // neck
  c.ellipse(headX, headY + 3, 4, 4.4, skin, { shape: 'dome', height: 13, curve: 0.95, alpha });
  // Gaunt jaw shadow and hollow cheeks.
  c.ellipse(headX, headY + 5, 3, 2.4, skinDeep, { shape: 'round', height: 12, shade: 0.75, alpha });
  // Hollow eyes: two dark pits with a faint cold glow, unless fully dead.
  if (k.collapse < 0.7) {
    [-1.6, 1.6].forEach((ox) => {
      c.rect(headX + ox - 0.5, headY + 2, 2, 2, '#171512', { shape: 'flat', height: 14, alpha });
      c.rect(headX + ox, headY + 2.5, 1, 1, VOID_EYE, { emissive: true, alpha: alpha * 0.85 });
    });
  }
}

/**
 * BONEGUARD — an armoured skeleton drilled to hold a line. The read is *mass and
 * defence*: a broad round shield fills one side of the silhouette, a crested
 * helm caps the skull, and between them the exposed ribcage shows the thing is
 * dead. It plants and bashes rather than lunges.
 */
function drawBoneguard(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 4;
  c.groundShadow(cx, groundY, 10 - k.squash, 3.4, 0.42);

  const alpha = deathAlpha(k);
  const bone = TINT.boneguard;
  const boneShade = shift(bone, -0.16, 12);
  const steel = '#8f97a6';
  const steelDark = shift(steel, -0.2, 10);
  const lean = k.lean + k.recoil;
  const baseY = 4 + k.bob + Math.round(k.collapse * 10);
  // On death the frame clatters apart: parts drift and drop.
  const scatter = Math.round(k.collapse * 6);

  // Legs: bare bone, braced apart for a wide, stable stance.
  const legY = baseY + 27;
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * 5 + Math.round(k.stride * side * 0.5);
    c.rect(lx - 1.5, legY, 3, 11 + scatter, boneShade, { shape: 'cylinder-y', height: 5, shade: i === 0 ? 0.78 : 1, alpha });
    c.ellipse(lx, legY + 11 + scatter, 2.6, 1.8, boneShade, { shape: 'round', height: 5, alpha }); // foot
    // Knee knob — a joint sphere, the volume cue on an otherwise stick leg.
    c.circle(lx, legY + 5, 1.8, bone, { shape: 'round', height: 6, alpha });
  });

  // Ribcage torso: a cylinder with carved rib lines so it reads as hollow bone.
  const torsoY = baseY + 13;
  c.rect(cx - 5 + lean, torsoY, 10, 12, bone, { shape: 'cylinder-y', height: 9, curve: 0.95, alpha });
  c.rect(cx - 2 + lean, torsoY + 1, 4, 11, shift(bone, -0.06), { shape: 'flat', height: 9, shade: 0.82, alpha }); // spine gutter
  // Individual ribs as short dark arcs across the chest.
  for (let r = 0; r < 4; r += 1) {
    c.rect(cx - 5 + lean, torsoY + 1 + r * 2.5, 10, 1, boneShade, { shape: 'cylinder-x', height: 9, shade: 0.7, alpha });
  }
  // Pelvis wedge under the ribs.
  c.polygon([
    [cx - 5 + lean, torsoY + 12],
    [cx + 5 + lean, torsoY + 12],
    [cx + 3 + lean, torsoY + 16],
    [cx - 3 + lean, torsoY + 16],
  ], boneShade, { shape: 'cylinder-y', height: 8, alpha });

  // Skull with a crested helm. Helm crest adds an aggressive top spike.
  const headY = baseY + 4;
  const headX = cx + lean;
  c.rect(cx - 1.5 + lean, baseY + 11, 3, 3, boneShade, { shape: 'cylinder-y', height: 9, shade: 0.7, alpha }); // neck vertebrae
  c.ellipse(headX, headY + 4, 4, 4.2, bone, { shape: 'dome', height: 15, curve: 0.95, alpha });
  // Eye sockets: deep black pits with a pinprick of cold light.
  [-1.7, 1.7].forEach((ox) => {
    c.rect(headX + ox - 0.5, headY + 3, 2, 2, '#14140f', { shape: 'flat', height: 16, alpha });
    if (k.collapse < 0.6) c.rect(headX + ox, headY + 3.5, 1, 1, VOID_EYE, { emissive: true, alpha: alpha * 0.8 });
  });
  c.rect(headX - 1, headY + 6, 2, 1, boneShade, { shape: 'flat', height: 15, shade: 0.7, alpha }); // nasal cavity
  // Helm: a steel dome cap over the crown plus a forward crest fin.
  c.ellipse(headX, headY + 1.5, 4.4, 2.8, steel, { shape: 'dome', height: 17, curve: 1, alpha: alpha });
  c.polygon([
    [headX - 0.5, headY - 3 - scatter],
    [headX + 1.5, headY - 3 - scatter],
    [headX + 1, headY + 1],
    [headX, headY + 1],
  ], steelDark, { shape: 'bevel', height: 18, alpha });

  // Shield arm (creature's left / screen right): the defining feature. A big
  // round steel disc with a boss, held forward. Bashes on the strike frame.
  const shieldX = cx + 8 + lean + Math.round(k.reach * 0.7);
  const shieldY = torsoY + 4;
  c.circle(shieldX, shieldY, 6.5, steel, { shape: 'dome', height: 12, curve: 1, alpha });
  c.circle(shieldX, shieldY, 6.5, steelDark, { shape: 'round', height: 11, shade: 0.6, alpha }); // rim ring drawn under...
  c.circle(shieldX, shieldY, 5, steel, { shape: 'dome', height: 12, curve: 1, alpha }); // ...then the face on top
  c.circle(shieldX, shieldY, 1.8, shift(steel, 0.12), { shape: 'round', height: 14, alpha }); // central boss

  // Weapon arm (screen left): a bone club/mace held low and out to the side at
  // rest — kept well clear of the skull so the head silhouette stays clean —
  // then hauled up and forward on the strike frame to bash over the shield.
  const armX = cx - 7 + lean;
  const swing = k.reach > 4 ? 1 : 0; // strike frame raises the whole weapon
  const raise = swing * 8; // how far the mace lifts when it swings
  c.rect(armX - 1, torsoY + 3, 3, 6, boneShade, { shape: 'cylinder-y', height: 8, alpha }); // upper arm
  // Forearm angles down-and-out at rest, up-and-forward on strike.
  const foreX = armX - 3;
  const foreY = torsoY + 6 - raise;
  c.rect(foreX, foreY, 3, 7, bone, { shape: 'cylinder-y', height: 8, alpha });
  // Mace head sits at the far low corner at rest (never near the head).
  c.circle(foreX + 1, foreY + 8, 2.6, steelDark, { shape: 'round', height: 10, alpha });
  c.circle(foreX + 1, foreY + 8, 1.2, steel, { shape: 'round', height: 11, alpha }); // flanged glint
}

/**
 * DIREWOLF — a corrupted beast that runs on all fours. The read is a long, low,
 * *horizontal* mass: shoulders and haunches high, spine dipping between, a heavy
 * head thrust forward and down at throat height. Mangy fur breaks the outline
 * into spikes; the muzzle snarls open on attack.
 */
function drawDirewolf(c: PixelCanvas, k: Kinematics): void {
  const groundY = c.height - 3;
  const midX = c.width / 2;
  c.groundShadow(midX, groundY, 16 - k.squash, 3.2, 0.4);

  const alpha = deathAlpha(k);
  const fur = TINT.direwolf;
  const furDark = shift(fur, -0.16, 8);
  const furLight = shift(fur, 0.1, -6);
  // Facing screen-right (head on the right). Death: legs splay, body sinks flat.
  const sink = Math.round(k.collapse * 8);
  const baseY = 7 + k.bob + sink; // body rides low — a heavy predator, not a deer
  const gait = k.stride;
  const lunge = Math.round(k.reach * 0.7); // whole head/neck drives forward on attack

  // ---- Four muscled legs. Each is real anatomy, not a stilt: a thick upper limb
  // (haunch/shoulder muscle) tapering down a narrower shank to a small paw. They
  // are SHORT — a dire wolf stands low — but still clearly legs, with real ground
  // clearance and negative space between the pairs. Drawn first; the haunch and
  // shoulder masses are then laid over their tops so the body→leg join reads as a
  // continuous muscled slope, never an abrupt peg-joint. Front and rear pairs
  // swing out of phase and lift at different points, so the gait reads as a trot.
  const groundLine = groundY - 1;
  const drawLeg = (hipX: number, phase: number, shade: number, front: boolean): void => {
    const swing = Math.round(Math.sin(phase) * gait); // fore/aft reach of the paw
    const lift = Math.max(0, -Math.cos(phase)) * 3; // paw lifts through the swing
    const hipY = baseY + 12; // where the limb leaves the body mass
    const kneeY = baseY + 18 + Math.round(sink * 0.5);
    const footY = groundLine - Math.round(lift) + sink;
    const kneeX = hipX + Math.round(swing * 0.35) + (front ? 1 : -1);
    const footX = hipX + swing + (front ? 2 : -1);
    // Upper limb: thick at the hip, tapering toward the knee (cylinder-y gives it
    // a rounded, muscled front).
    c.polygon([
      [hipX - 2.5, hipY],
      [hipX + 2.5, hipY],
      [kneeX + 1.5, kneeY],
      [kneeX - 1.5, kneeY],
    ], furDark, { shape: 'cylinder-y', height: 5, shade, curve: 0.9, alpha });
    // Shank: narrower, angling to the paw — the taper that says "leg, not peg".
    c.polygon([
      [kneeX - 1.5, kneeY - 1],
      [kneeX + 1.5, kneeY - 1],
      [footX + 1, footY],
      [footX - 1, footY],
    ], furDark, { shape: 'cylinder-y', height: 4, shade: shade * 0.9, curve: 0.9, alpha });
    // Small paw pad, wider than the ankle so it grips the ground.
    c.ellipse(footX + 0.5, footY, 2.3, 1.4, furDark, { shape: 'round', height: 4, shade, alpha });
  };
  // Far pair first (dimmer for depth), then near pair. Wider stance front/back.
  drawLeg(midX - 8, 0, 0.6, false); // far rear
  drawLeg(midX + 9, Math.PI, 0.6, true); // far front
  drawLeg(midX - 11, Math.PI, 0.95, false); // near rear
  drawLeg(midX + 12, 0, 1, true); // near front

  // ---- Body: a long, low horizontal barrel slung between two muscle masses.
  // Haunch (rear) is the bulkiest; chest/shoulder (front) carries the head. The
  // masses OVERLAP the tops of the legs so the transition reads as anatomy, and
  // sit high enough on the leg that real leg still shows below them.
  const bodyY = baseY + 6; // barrel low, but leaving clearance for visible legs
  // Rear haunch: a rounded thigh mass swelling down toward the back legs.
  c.ellipse(midX - 9, bodyY + 4, 7.5, 6, fur, { shape: 'round', height: 9, curve: 1, alpha });
  c.ellipse(midX - 10, bodyY + 5, 4, 3.5, furDark, { shape: 'round', height: 8, shade: 0.9, alpha }); // haunch crease
  // Front shoulder: a chest/shoulder mass feeding into the front legs.
  c.ellipse(midX + 9, bodyY + 4, 6, 5.5, fur, { shape: 'round', height: 9, curve: 1, alpha });
  // The barrel connecting them.
  c.rect(midX - 12, bodyY, 22, 8, fur, { shape: 'cylinder-x', height: 9, curve: 0.95, alpha });
  // A shallow tuck-up of the belly toward the loin, so the underside isn't a slab
  // but the legs stay clear of it.
  c.ellipse(midX + 2, bodyY + 7, 5, 1.6, furDark, { shape: 'cylinder-x', height: 7, shade: 0.85, alpha });
  // Spine ridge — a lit strip along the top so the barrel reads as rounded.
  c.rect(midX - 11, bodyY, 20, 1, furLight, { shape: 'flat', height: 10, alpha });
  // Mangy fur: dark spikes bristling off the back and haunch, breaking outline.
  for (let s = 0; s < 6; s += 1) {
    const sx = midX - 10 + s * 3.4;
    c.polygon([
      [sx, bodyY - 1],
      [sx + 2, bodyY - 1],
      [sx + 1, bodyY - 3 - (s % 2)],
    ], furDark, { shape: 'flat', height: 10, alpha });
  }

  // ---- Neck + head, thrust forward and low toward the prey (down-right).
  const headX = midX + 15 + lunge;
  const headY = bodyY + 3 + Math.round(k.reach * 0.3);
  c.polygon([
    [midX + 8, bodyY],
    [midX + 14, bodyY - 1],
    [headX, headY - 2],
    [headX, headY + 4],
    [midX + 9, bodyY + 7],
  ], fur, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha }); // thick neck
  // Skull.
  c.ellipse(headX, headY, 5, 4.2, fur, { shape: 'dome', height: 11, curve: 0.95, alpha });
  // Elongated snarling muzzle jutting forward.
  const jawGap = k.reach > 4 ? 2 : 0.5; // mouth gapes on the strike frame
  c.polygon([
    [headX + 2, headY - 2],
    [headX + 9, headY - 1],
    [headX + 8, headY + 1],
    [headX + 2, headY + 1],
  ], furDark, { shape: 'cylinder-x', height: 11, curve: 0.85, alpha }); // upper jaw
  c.polygon([
    [headX + 2, headY + 1 + jawGap],
    [headX + 8, headY + 1 + jawGap],
    [headX + 7, headY + 3 + jawGap],
    [headX + 2, headY + 3 + jawGap],
  ], shift(fur, -0.1), { shape: 'cylinder-x', height: 10, curve: 0.85, alpha }); // lower jaw
  // Fangs: tiny bone triangles at the mouth line when it snarls.
  if (jawGap > 1) {
    for (let t = 0; t < 3; t += 1) {
      const tx = headX + 3 + t * 2;
      c.polygon([[tx, headY + 1], [tx + 1.2, headY + 1], [tx + 0.5, headY + 2.4]], '#e8e0c8', { shape: 'flat', height: 12, alpha });
    }
  }
  // Ears, pinned back and pointed.
  c.polygon([[headX - 3, headY - 3], [headX - 1, headY - 6], [headX, headY - 2]], furDark, { shape: 'flat', height: 12, alpha });
  c.polygon([[headX + 1, headY - 3], [headX + 3, headY - 6], [headX + 3, headY - 2]], furDark, { shape: 'flat', height: 12, alpha });
  // Feral eye: a hot ember glow, the one warm accent on a cold grey beast.
  if (k.collapse < 0.7) {
    c.rect(headX + 1, headY - 1, 1.6, 1.6, '#ffb84a', { emissive: true, alpha: alpha * 0.9 });
  }

  // Ragged tail sweeping off the haunch, opposite the head.
  const tailSwing = Math.round(Math.sin((k.stride / 3) * Math.PI) * 3);
  c.polygon([
    [midX - 15, bodyY + 2],
    [midX - 17, bodyY + 1 + tailSwing],
    [midX - 20, bodyY + 4 + tailSwing],
    [midX - 15, bodyY + 5],
  ], furDark, { shape: 'cylinder-y', height: 7, alpha });
}

/**
 * WRAITH — a floating spectre. The read is *no legs*: a hovering teardrop of
 * tattered shroud that widens at the shoulders and frays into drifting rags and
 * mist at the bottom, never touching the ground. Two cold eyes burn in the void
 * of the hood. Everything is semi-transparent, so it looks incorporeal.
 */
function drawWraith(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 3;
  // A faint, diffuse shadow well below it — it hovers, so the shadow is weak.
  c.groundShadow(cx, groundY, 7, 2.2, 0.22);

  const shroud = TINT.wraith;
  const shroudDark = shift(shroud, -0.18, 6);
  const shroudLight = shift(shroud, 0.14, -8);
  // Hover: the idle bob is the primary motion; on death it sinks and fades out.
  const hover = k.bob + Math.round(Math.sin((k.stride / 3) * Math.PI) * 1.5);
  const baseY = 6 + hover + Math.round(k.collapse * 6);
  const bodyAlpha = (1 - k.collapse * 0.8) * 0.9; // ghostly even when alive
  const lean = k.lean + k.recoil;

  // Dissolving base of mist. Not discrete tendrils (those read as legs) but a
  // soft, overlapping cloud: broad low-alpha lobes that fatten near the body and
  // thin out below, so the bottom of the silhouette blurs into vapour instead of
  // sprouting limbs. Two layers — a wide faint haze, then denser wisps inside it.
  const mistFade = 1 - k.collapse; // the mist thins as the spectre unravels
  // Wide diffuse haze, one continuous band that sways as a whole.
  const hazeSway = Math.round(Math.sin(k.stride * 0.9) * 2);
  c.ellipse(cx + lean + hazeSway, baseY + 30, 9, 6 * mistFade, shroudDark, { shape: 'flat', height: 2, alpha: bodyAlpha * 0.18 });
  c.ellipse(cx + lean + hazeSway, baseY + 26, 8, 6, shroud, { shape: 'cylinder-y', height: 4, alpha: bodyAlpha * 0.3 });
  // A few fat, curling wisps peeling off the cloud — wide and short so they read
  // as vapour curls, never as legs. They overlap, leaving no clean gaps.
  for (let s = 0; s < 4; s += 1) {
    const sway = Math.sin((k.stride + s * 1.6) * 0.8) * 3;
    const mx = cx - 7 + s * 5 + lean;
    const len = (7 + (s % 2) * 3) * mistFade;
    c.polygon([
      [mx - 2.5, baseY + 24],
      [mx + 2.5, baseY + 24],
      [mx + 2 + sway, baseY + 24 + len],
      [mx - 1 + sway, baseY + 24 + len + 1],
    ], shroudDark, { shape: 'cylinder-y', height: 3, alpha: bodyAlpha * 0.32 });
  }

  // Body: a hooded teardrop. Wide cowl-shoulders tapering to a wispy point.
  c.polygon([
    [cx - 9 + lean, baseY + 10],
    [cx + 9 + lean, baseY + 10],
    [cx + 6 + lean, baseY + 26],
    [cx + 2 + lean, baseY + 30],
    [cx - 2 + lean, baseY + 30],
    [cx - 6 + lean, baseY + 26],
  ], shroud, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha: bodyAlpha });
  // Inner fold shadow gives the shroud depth rather than a flat cutout.
  c.polygon([
    [cx - 4 + lean, baseY + 12],
    [cx + 4 + lean, baseY + 12],
    [cx + 1 + lean, baseY + 28],
    [cx - 1 + lean, baseY + 28],
  ], shroudDark, { shape: 'flat', height: 8, shade: 0.7, alpha: bodyAlpha });

  // Reaching wispy arms/sleeves that flare out on the attack (a grasping lunge).
  const reach = Math.round(k.reach * 0.9);
  [-1, 1].forEach((side) => {
    const ax = cx + side * 8 + lean;
    c.polygon([
      [ax, baseY + 11],
      [ax + side * 2, baseY + 12],
      [ax + side * (5 + reach), baseY + 18 + reach],
      [ax + side * (3 + reach), baseY + 20 + reach],
    ], shroud, { shape: 'cylinder-y', height: 7, alpha: bodyAlpha });
    // Skeletal hand at the tip when reaching to strike.
    if (reach > 4) {
      c.ellipse(ax + side * (5 + reach), baseY + 19 + reach, 1.8, 1.8, shroudLight, { shape: 'round', height: 7, alpha: bodyAlpha });
    }
  });

  // Cowl: a raised hood peak framing a black void where a face should be.
  c.polygon([
    [cx - 6 + lean, baseY + 10],
    [cx + 6 + lean, baseY + 10],
    [cx + 4 + lean, baseY + 2],
    [cx + lean, baseY - 2],
    [cx - 4 + lean, baseY + 2],
  ], shroud, { shape: 'dome', height: 10, curve: 0.9, alpha: bodyAlpha });
  // The hood's interior void.
  c.ellipse(cx + lean, baseY + 6, 4, 5, '#0c0a14', { shape: 'flat', height: 9, alpha: bodyAlpha * 0.95 });
  // Two burning eyes — the strongest, most identifiable mark on the wraith.
  // These stay bright until nearly gone (fade with collapse).
  const eyeA = (1 - k.collapse) * 0.95;
  [-1.7, 1.7].forEach((ox) => {
    c.circle(cx + ox + lean, baseY + 5.5, 1.4, '#eafbff', { emissive: true, alpha: eyeA });
    c.circle(cx + ox + lean, baseY + 5.5, 0.8, '#8fe4ff', { emissive: true, alpha: eyeA });
  });
  // A soft cool aura bleed around the eyes sells the emissive glow.
  c.ellipse(cx + lean, baseY + 6, 5, 5.5, '#5fd0ff', { emissive: true, alpha: eyeA * 0.14 });
}

/**
 * BOGLING — a drowned corpse bloated with swamp gas. The read is *swollen and
 * squat*: a huge sagging belly wider than the shoulders, stubby limbs, a
 * lolling head, all dripping. Waterweed hangs off it and it slouches low. Sickly
 * green-black, glistening wet.
 */
function drawBogling(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 3;
  c.groundShadow(cx, groundY, 11 - k.squash, 3.4, 0.42);

  const alpha = deathAlpha(k);
  const flesh = TINT.bogling;
  const fleshDark = shift(flesh, -0.16, -8);
  const fleshLight = shift(flesh, 0.12, -4); // wet highlight tone
  const weed = mix(flesh, '#2f3a24', 0.6);
  const baseY = 6 + k.bob + Math.round(k.collapse * 8);
  const lean = k.lean + k.recoil;
  // Belly wobble: the bloat jiggles on the walk and deflates a touch on death.
  const wobble = Math.round(Math.sin((k.stride / 3) * Math.PI) * 1);
  const deflate = Math.round(k.collapse * 3);

  // Stubby legs, set wide under the belly, barely supporting the mass.
  const legY = baseY + 26;
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * 6 + Math.round(k.stride * side * 0.4);
    c.rect(lx - 2, legY, 4, 7, fleshDark, { shape: 'cylinder-y', height: 4, shade: i === 0 ? 0.8 : 1, alpha });
    c.ellipse(lx, legY + 7, 3, 1.8, fleshDark, { shape: 'round', height: 4, alpha }); // splayed foot
  });

  // The belly: an enormous low sphere, the dominant shape. Drawn before the
  // upper body so the torso appears to sit back into the bloat.
  const bellyY = baseY + 18 + wobble;
  c.ellipse(cx + lean * 0.5, bellyY, 12 - deflate, 10 - deflate, flesh, { shape: 'round', height: 9, curve: 1, alpha });
  // Taut, glistening highlight on the belly's upper-left — sells "wet + full".
  c.ellipse(cx - 3 + lean * 0.5, bellyY - 3, 4, 3, fleshLight, { shape: 'round', height: 11, alpha: alpha * 0.8 });
  // A dark distended navel / split seam.
  c.rect(cx - 0.5 + lean * 0.5, bellyY + 2, 1.5, 4, fleshDark, { shape: 'flat', height: 9, shade: 0.6, alpha });

  // Narrow slumped shoulders sitting atop the belly (shoulders < belly = bloat).
  const shoulderY = baseY + 9;
  c.rect(cx - 5 + lean, shoulderY, 10, 8, flesh, { shape: 'cylinder-y', height: 10, curve: 0.9, alpha });

  // Short swollen arms hanging limp, one raised to swipe on attack.
  const reach = Math.round(k.reach * 0.8);
  c.rect(cx - 8 + lean, shoulderY + 1, 4, 8, flesh, { shape: 'cylinder-y', height: 8, shade: 0.85, alpha });
  c.ellipse(cx - 6 + lean, shoulderY + 9, 2.6, 2.4, fleshDark, { shape: 'round', height: 8, shade: 0.85, alpha });
  c.rect(cx + 5 + lean, shoulderY + 1 - Math.max(0, reach), 4, 8, flesh, { shape: 'cylinder-y', height: 9, alpha });
  c.ellipse(cx + 7 + lean, shoulderY + 9 - Math.max(0, reach), 2.8, 2.6, fleshDark, { shape: 'round', height: 9, alpha });

  // Head: lolling to one side, jaw slack. Sits low, half-sunk into the shoulders.
  const headTilt = 2; // permanent lifeless tilt
  const headX = cx + lean + headTilt;
  const headY = baseY + 3;
  c.ellipse(headX, headY + 3, 4.4, 4, flesh, { shape: 'dome', height: 12, curve: 0.95, alpha });
  // Bloated cheek and slack lower jaw.
  c.ellipse(headX + 1, headY + 5, 3, 2.4, fleshDark, { shape: 'round', height: 11, shade: 0.85, alpha });
  // Dead white eyes, no glow — this one is drowned, not spectral.
  if (k.collapse < 0.7) {
    [-1.5, 1.5].forEach((ox) => {
      c.rect(headX + ox - 0.5, headY + 2, 2, 2, '#cfd8c4', { shape: 'flat', height: 13, alpha });
      c.rect(headX + ox, headY + 2.5, 1, 1, '#3a4230', { shape: 'flat', height: 13, alpha });
    });
  }

  // Waterweed draped over the head and shoulders — thin dark strands hanging,
  // swaying slightly. This ragged fringe is a big part of the read.
  for (let s = 0; s < 5; s += 1) {
    const sway = Math.sin((k.stride + s) * 0.8) * 1.5;
    const wx = cx - 6 + s * 3 + lean;
    c.line(wx, headY + 1, wx + sway, headY + 10 + (s % 2) * 3, weed, 1, { height: 12, alpha: alpha * 0.9 });
  }
  // A few drip beads leaving the belly, reinforcing "sodden".
  if (k.collapse < 0.5) {
    c.rect(cx - 8 + lean, bellyY + 6, 1, 2, fleshLight, { emissive: true, alpha: 0.5 });
    c.rect(cx + 9 + lean, bellyY + 4, 1, 2, fleshLight, { emissive: true, alpha: 0.5 });
  }
}

/**
 * CAVECRAWLER — a chittering subterranean arthropod. The read is *many legs, low
 * and wide*: a segmented chitinous body hugging the ground with a bristling fan
 * of jointed legs on both sides and a fanged, mandibled head up front. Nothing
 * humanoid about it — pure bug threat.
 */
function drawCavecrawler(c: PixelCanvas, k: Kinematics): void {
  const groundY = c.height - 3;
  const midX = c.width / 2;
  c.groundShadow(midX, groundY, 17 - k.squash, 3, 0.4);

  const alpha = deathAlpha(k);
  const chitin = TINT.cavecrawler;
  const chitinDark = shift(chitin, -0.18, 10);
  const chitinLight = shift(chitin, 0.12, -6);
  // Faces screen-right (head/mandibles on the right).
  const sink = Math.round(k.collapse * 6);
  const baseY = 8 + k.bob + sink; // body slung low — a wide, ground-hugging bug
  const groundLine = groundY - 1;

  // ---- Segment layout, back (left) to front (right). Each plate has its own
  // crown height `top`: the thorax hump rises high, then the plates descend
  // toward the low tail, so the silhouette has a real domed high point instead of
  // reading as one horizontal smear. `r` is the plate half-width.
  const bodyY = baseY + 5;
  const segs = [
    { x: midX - 17, r: 4.4, top: bodyY - 1 }, // tail plate (lowest)
    { x: midX - 12, r: 6, top: bodyY - 4 }, // abdomen
    { x: midX - 6, r: 6.8, top: bodyY - 8 }, // rising
    { x: midX, r: 6.6, top: bodyY - 11 }, // THORAX HUMP — the high point
    { x: midX + 6, r: 5.4, top: bodyY - 7 }, // dropping toward the neck
    { x: midX + 11, r: 4.2, top: bodyY - 3 }, // neck plate
  ];

  // ---- Legs: jointed arachnid limbs that ARCH — femur rising up-and-out from
  // the body to a knee above the attachment, then the tibia angling back down to
  // the ground. The arch gives the low bug real vertical presence and reads as
  // "scuttling" rather than a fringe of straight spikes. They stay short and
  // stocky so the creature keeps its low, wide profile. Ripple down the body;
  // drawn first so the plates overlap their roots. On death they curl inward + up.
  const curl = k.collapse * 3;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const s = segs[i];
    const rootY = s.top + s.r * 0.9; // leg leaves the lower flank of the plate
    const phase = (k.stride / 3) * Math.PI + i * 0.9; // ripple down the body
    const step = Math.round(Math.sin(phase) * 2); // fore/aft scuttle of the foot
    const kneeLift = 3 + Math.round(Math.abs(Math.cos(phase)) * 1.5); // arch height
    [-1, 1].forEach((side) => {
      const kneeX = s.x + side * (5 - curl);
      const kneeY = rootY - kneeLift + Math.round(curl * 2); // knee rides above the root
      const footX = s.x + side * (7 - curl * 2) + step;
      const footY = groundLine + sink - Math.round(curl);
      const shade = side < 0 ? 0.62 : 1; // far legs darker for depth
      // Femur: body → knee (rises up and out into the arch).
      c.line(s.x, rootY, kneeX, kneeY, chitinDark, 2, { height: 6, shade, alpha });
      // Tibia: knee → foot on the ground (angles back down).
      c.line(kneeX, kneeY, footX, footY, chitinDark, 1, { height: 5, shade, alpha });
      // Tarsal claw tip biting the floor.
      if (k.collapse < 0.5) c.rect(footX + side * 0.5, footY, 1, 1, chitinDark, { shape: 'flat', height: 4, shade, alpha });
    });
  }

  // ---- Segmented carapace: overlapping chitin plates. Each is a tall dome
  // (aspect ~1.0, not flattened) rising to its own crown, so the row builds into
  // a humped back. Drawn back-to-front so the front plates overlap the ones
  // behind, reinforcing the descending overlap toward the tail.
  segs.forEach((s, i) => {
    const h = groundLine - s.top; // taller plates read as more raised
    c.ellipse(s.x, s.top + s.r, s.r, s.r, chitin, { shape: 'dome', height: 8 + h * 0.4, curve: 1, alpha });
    // Bright crown ridge along the top of each plate — sells the raised dome.
    c.ellipse(s.x - 1, s.top + 1, s.r * 0.55, s.r * 0.35, chitinLight, { shape: 'dome', height: 10 + h * 0.4, alpha: alpha * 0.8 });
    // Dark seam in front of each plate (the overlap shadow).
    c.rect(s.x + s.r - 1, s.top, 1, s.r * 1.5, chitinDark, { shape: 'flat', height: 7, shade: 0.55, alpha });
  });
  // A short spine tuft cresting the thorax hump, emphasising the high point.
  const hump = segs[3];
  for (let t = -1; t <= 1; t += 1) {
    c.polygon([
      [hump.x + t * 2 - 0.8, hump.top + 1],
      [hump.x + t * 2 + 0.8, hump.top + 1],
      [hump.x + t * 2, hump.top - 2 - (t === 0 ? 1 : 0)],
    ], chitinDark, { shape: 'cone', height: 16, alpha });
  }

  // ---- Head: a large, distinct armoured node LIFTED above the body line and
  // thrust forward on a short neck, clearly separated from the carapace. The
  // mandibles project off the front as their own forms (not fused into the head),
  // spreading wide on the attack frame.
  const neck = segs[segs.length - 1];
  const headX = midX + 18;
  const headY = neck.top + 1; // sits up near the crest, above the body midline
  // Short neck stalk connecting the front plate to the raised head.
  c.polygon([
    [neck.x + 1, neck.top + 2],
    [neck.x + 2, neck.top + neck.r],
    [headX - 2, headY + 4],
    [headX - 3, headY],
  ], chitinDark, { shape: 'cylinder-y', height: 8, alpha });
  // The head capsule — bigger than any single old segment, its own rounded mass.
  c.ellipse(headX, headY + 2, 5.2, 4.6, chitin, { shape: 'dome', height: 13, curve: 1, alpha });
  c.ellipse(headX - 1, headY + 0.5, 2.4, 1.6, chitinLight, { shape: 'dome', height: 15, alpha: alpha * 0.8 }); // head highlight
  // Mandibles: two hooked pincers reaching off the FRONT of the head, with a
  // clear gap (dark) between them and the head mass. They gape on the strike.
  const spread = k.reach > 4 ? 3 : 1;
  [-1, 1].forEach((side) => {
    c.polygon([
      [headX + 4, headY + side * 1.5],
      [headX + 10, headY + side * (spread + 1)],
      [headX + 9, headY + side * (spread + 2.6)],
      [headX + 4, headY + side * 3],
    ], chitinDark, { shape: 'cylinder-x', height: 11, curve: 0.8, alpha });
    // Pale fang tip curving inward.
    c.ellipse(headX + 9.5, headY + side * (spread + 1.6), 1, 1, '#d8ccae', { shape: 'round', height: 12, alpha });
  });
  // A pair of short antennae sweeping up off the head, adding to the bug read.
  c.line(headX + 2, headY - 2, headX + 6, headY - 6, chitinDark, 1, { height: 13, alpha });
  c.line(headX + 3, headY - 2, headX + 8, headY - 4, chitinDark, 1, { height: 13, alpha });
  // Cluster of small glowing eyes on the raised head — a menacing glint.
  if (k.collapse < 0.7) {
    [[-1.5, -1], [1, -1.4], [-0.5, 1], [2, 0.5]].forEach(([ox, oy]) => {
      c.rect(headX + ox - 0.5, headY + oy - 0.5, 1.3, 1.3, '#c9ff7a', { emissive: true, alpha: alpha * 0.85 });
    });
  }

  // A raised, curling tail-stinger off the low rear plate — asymmetry and threat,
  // and a second vertical accent balancing the head end.
  const tail = segs[0];
  const tailLift = Math.round(k.reach * 0.4);
  c.polygon([
    [tail.x - 1, tail.top + tail.r],
    [tail.x - 4, tail.top - 3 - tailLift],
    [tail.x - 2, tail.top - 7 - tailLift],
    [tail.x, tail.top - 3 - tailLift],
    [tail.x + 2, tail.top + 2],
  ], chitinDark, { shape: 'cylinder-y', height: 9, alpha });
  c.polygon([
    [tail.x - 3, tail.top - 7 - tailLift],
    [tail.x - 1, tail.top - 11 - tailLift],
    [tail.x, tail.top - 6 - tailLift],
  ], '#d8ccae', { shape: 'cone', height: 11, alpha }); // bone stinger tip
}

/**
 * ASHBORN — a humanoid of burnt charcoal with fire trapped inside. The read is a
 * cracked stone figure lit from within: matte black-red plating split by a
 * branching network of glowing fissures, brightest at the core, radiating heat
 * shimmer. The emissive cracks are the whole identity, so they get real glow.
 */
function drawAshborn(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 4;
  c.groundShadow(cx, groundY, 8 - k.squash, 3, 0.4);

  const alpha = deathAlpha(k);
  const char = mix(TINT.ashborn, '#2a1c1c', 0.62); // near-black charcoal skin
  const charDark = shift(char, -0.08, 0);
  // The internal fire cools as the creature dies (fissures dim toward ember).
  const heat = 1 - k.collapse * 0.85;
  const lava = mix('#ff9038', '#7a2410', k.collapse * 0.7);
  const core = mix('#ffd27a', '#ff6a2a', k.collapse * 0.5);
  const baseY = 4 + k.bob + Math.round(k.collapse * 8);
  const lean = k.lean + k.recoil;
  const crumble = Math.round(k.collapse * 3);

  // Helper: draw a glowing fissure segment (dark crack edges + emissive centre).
  const fissure = (x0: number, y0: number, x1: number, y1: number, bright = 1): void => {
    c.line(x0, y0, x1, y1, lava, 1, { emissive: true, alpha: alpha * heat * bright });
  };

  // Legs: cracked charcoal columns with a lava seam up each shin.
  const legY = baseY + 26;
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * 4 + Math.round(k.stride * side * 0.6);
    c.rect(lx - 1.5, legY, 4, 12 - crumble, char, { shape: 'cylinder-y', height: 5, shade: i === 0 ? 0.85 : 1, alpha });
    c.ellipse(lx + 0.5, legY + 12 - crumble, 2.6, 1.8, charDark, { shape: 'round', height: 5, alpha });
    fissure(lx, legY + 1, lx, legY + 9 - crumble, 0.8); // shin crack
  });

  // Torso: a blocky charcoal cylinder. The molten core glows at the chest.
  const torsoY = baseY + 12;
  c.rect(cx - 5 + lean, torsoY, 10, 13, char, { shape: 'cylinder-y', height: 9, curve: 0.9, alpha });
  // The core: a bright emissive well at the sternum, radiating cracks outward.
  c.ellipse(cx + lean, torsoY + 6, 3.4, 4, core, { emissive: true, alpha: alpha * heat });
  c.ellipse(cx + lean, torsoY + 6, 2, 2.4, mix(core, '#fff2c8', 0.6), { emissive: true, alpha: alpha * heat });
  // Branching fissures spidering out from the core across the chest.
  fissure(cx + lean, torsoY + 3, cx - 3 + lean, torsoY, 0.9);
  fissure(cx + lean, torsoY + 3, cx + 3 + lean, torsoY + 1, 0.9);
  fissure(cx + lean, torsoY + 9, cx - 4 + lean, torsoY + 12, 0.9);
  fissure(cx + lean, torsoY + 9, cx + 4 + lean, torsoY + 11, 0.9);
  fissure(cx - 3 + lean, torsoY + 5, cx - 5 + lean, torsoY + 7, 0.7);
  fissure(cx + 3 + lean, torsoY + 5, cx + 5 + lean, torsoY + 8, 0.7);

  // Arms: charcoal, the striking arm rearing back then hammering forward. A
  // fissure runs down the forearm and flares brighter as it swings (stoking).
  const reach = Math.round(k.reach);
  // Off arm.
  c.rect(cx - 8 + lean, torsoY + 1, 4, 9, char, { shape: 'cylinder-y', height: 8, shade: 0.85, alpha });
  c.ellipse(cx - 6 + lean, torsoY + 10, 2.6, 2.4, charDark, { shape: 'round', height: 8, shade: 0.85, alpha });
  fissure(cx - 6 + lean, torsoY + 3, cx - 6 + lean, torsoY + 9, 0.6);
  // Striking arm.
  const saX = cx + 6 + lean + Math.max(0, reach - 2);
  const saY = torsoY + 1 - Math.max(0, Math.round(reach * 0.4));
  c.rect(saX - 2, saY, 4, 9, char, { shape: 'cylinder-y', height: 9, alpha });
  c.ellipse(saX, saY + 9, 3, 2.8, charDark, { shape: 'round', height: 9, alpha });
  // Molten fist — the hand glows hot when cocked/striking.
  const fistHeat = k.reach !== 0 ? 1 : 0.5;
  c.ellipse(saX, saY + 9, 2, 2, lava, { emissive: true, alpha: alpha * heat * fistHeat });
  fissure(saX, saY + 2, saX, saY + 8, 0.8 + fistHeat * 0.2);

  // Head: a cracked skull-like block with burning eyes and a molten crown seam.
  const headY = baseY + 3;
  const headX = cx + lean;
  c.rect(cx - 1.5 + lean, baseY + 10, 3, 3, charDark, { shape: 'cylinder-y', height: 9, shade: 0.7, alpha }); // neck
  c.ellipse(headX, headY + 4, 4.2, 4.4, char, { shape: 'dome', height: 14, curve: 0.95, alpha });
  // Cracked-open crown: a jagged emissive seam across the top of the skull.
  fissure(headX - 3, headY + 1, headX + 3, headY, 0.9);
  fissure(headX - 1, headY + 1, headX, headY + 4, 0.7);
  // Eyes: molten slits.
  [-1.6, 1.6].forEach((ox) => {
    c.rect(headX + ox - 0.5, headY + 3.5, 2, 1.4, core, { emissive: true, alpha: alpha * heat });
  });
  // Heat haze: a faint emissive bloom over the whole figure while it burns hot.
  if (k.collapse < 0.5) {
    c.ellipse(headX, torsoY + 4, 8, 12, '#ff6a2a', { emissive: true, alpha: 0.05 * heat });
  }
  // On death: rising embers where the body is coming apart.
  if (k.collapse > 0.3) {
    for (let e = 0; e < 4; e += 1) {
      c.rect(cx - 4 + e * 2.5 + lean, torsoY - e * 2 + crumble, 1, 1, core, { emissive: true, alpha: heat * 0.7 });
    }
  }
}

/**
 * NAMELESS — the first boss. Not bulk but *wrongness of proportion*: an
 * impossibly tall, slender horror, elegant and still, with FOUR arms fanned in
 * an unsettling gesture, a veil hiding the upper face, and a thin crown of
 * spines. It should read as a silhouette that is almost beautiful and entirely
 * wrong — the vertical opposite of the cinderlord's mass.
 */
function drawNameless(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 4;
  c.groundShadow(cx, groundY, 11 - k.squash, 3.6, 0.44);

  const alpha = deathAlpha(k);
  const flesh = mix(TINT.nameless, '#e8d3dd', 0.35); // pale, bloodless porcelain
  const fleshDark = shift(flesh, -0.16, 6);
  const gown = shift(TINT.nameless, -0.12, 4); // deep wine gown
  const gownDark = shift(gown, -0.12, 4);
  const gownLight = shift(gown, 0.12, -4);
  const gold = '#d8b25a';
  // A tall, slow idle sway rather than a bob — regal, floating menace.
  const sway = Math.round(Math.sin((k.bob + k.stride) * 0.7) * 1);
  const baseY = 5 + k.bob + Math.round(k.collapse * 12);
  const lean = k.lean + k.recoil + sway;
  // Death: the tall frame buckles and folds down dramatically.
  const fold = Math.round(k.collapse * 14);

  // The gown pools to the floor — no legs visible, a long tapering column that
  // makes the figure read as gliding. Widens at the hem into a pooled skirt.
  const gownTop = baseY + 20;
  const hemSway = Math.round(Math.sin((k.stride) * 0.8) * 2);
  c.polygon([
    [cx - 5 + lean, gownTop],
    [cx + 5 + lean, gownTop],
    [cx + 11 + hemSway, groundY - fold],
    [cx - 11 + hemSway, groundY - fold],
  ], gown, { shape: 'cylinder-y', height: 8, curve: 0.9, alpha });
  // Vertical fold lines elongate the silhouette.
  [-6, -2, 2, 6].forEach((ox, i) => {
    c.line(cx + ox * 0.5 + lean, gownTop + 1, cx + ox + hemSway, groundY - fold - 1, i % 2 ? gownDark : gownLight, 1, { height: 8, shade: 0.85, alpha });
  });
  // A gilded hem band.
  c.rect(cx - 11 + hemSway, groundY - 2 - fold, 22, 2, gold, { shape: 'cylinder-x', height: 8, shade: 0.8, alpha });

  // Slender torso, unnaturally long and narrow. Corset-like gilded seam.
  const torsoY = baseY + 10;
  c.rect(cx - 3.5 + lean, torsoY, 7, 12, gown, { shape: 'cylinder-y', height: 10, curve: 0.95, alpha });
  c.line(cx + lean, torsoY + 1, cx + lean, torsoY + 11, gold, 1, { height: 11, shade: 0.9, alpha });
  c.rect(cx - 3.5 + lean, torsoY + 5, 7, 1, gold, { shape: 'flat', height: 10, shade: 0.85, alpha });

  // FOUR arms — the signature. Upper pair raised wide in an eerie welcome; lower
  // pair lower and closer. Long, thin, ending in delicate elongated hands. The
  // whole fan spreads further on the attack (a grasping embrace).
  const spread = 1 + (k.reach > 4 ? 0.5 : 0) + k.reach * 0.05;
  const drawArm = (side: number, shoulderY: number, angle: number, len: number, shade: number): void => {
    const sx = cx + side * 3 + lean;
    // Elbow out along the angle, hand continuing further out and up/down.
    const ex = sx + side * Math.round(len * 0.55 * spread);
    const ey = shoulderY + Math.round(angle * len * 0.4);
    const hx = ex + side * Math.round(len * 0.5 * spread);
    const hy = ey + Math.round(angle * len * 0.55) - Math.round(k.reach * 0.3);
    c.line(sx, shoulderY, ex, ey, flesh, 2, { height: 9, shade, alpha });
    c.line(ex, ey, hx, hy, flesh, 2, { height: 9, shade: shade * 0.95, alpha });
    // Long-fingered hand: a small palm plus splayed finger lines.
    c.ellipse(hx, hy, 1.8, 1.6, fleshDark, { shape: 'round', height: 9, shade, alpha });
    for (let f = -1; f <= 1; f += 1) {
      c.line(hx, hy, hx + side * 2, hy + f * 2 + Math.round(angle), fleshDark, 1, { height: 9, shade, alpha });
    }
  };
  // Upper arms: raised high and wide (angle negative = upward).
  drawArm(-1, torsoY + 1, -1.1, 12, 0.82);
  drawArm(1, torsoY + 1, -1.1, 12, 1);
  // Lower arms: reaching outward and slightly down.
  drawArm(-1, torsoY + 6, 0.5, 11, 0.78);
  drawArm(1, torsoY + 6, 0.5, 11, 0.95);

  // Slender neck and a narrow, tilted head.
  const headY = baseY + 1 + Math.round(fold * 0.5);
  const headX = cx + lean + Math.round(sway);
  c.rect(cx - 1 + lean, baseY + 8, 2, 4, fleshDark, { shape: 'cylinder-y', height: 11, shade: 0.7, alpha }); // long neck
  c.ellipse(headX, headY + 4, 3.4, 4.2, flesh, { shape: 'dome', height: 15, curve: 0.95, alpha });
  // The veil: a translucent band across the eyes, hiding the upper face. Below
  // it, a small serene mouth — the "unsettling grace".
  c.rect(headX - 3.2, headY + 2.5, 6.4, 2.4, gownDark, { shape: 'cylinder-x', height: 16, shade: 0.9, alpha: alpha * 0.85 });
  // Two faint glowing eyes bleeding through the veil.
  if (k.collapse < 0.7) {
    [-1.4, 1.4].forEach((ox) => {
      c.rect(headX + ox - 0.5, headY + 3, 1.4, 1.4, '#ffd6ec', { emissive: true, alpha: alpha * 0.7 });
    });
  }
  c.rect(headX - 1, headY + 6, 2, 1, fleshDark, { shape: 'flat', height: 15, shade: 0.8, alpha }); // small mouth

  // Crown of thin spines — a jagged halo that tops the tall silhouette and reads
  // as royalty-gone-wrong. Slightly asymmetric on purpose.
  const spikes = [-3, -1.5, 0, 1.5, 3];
  spikes.forEach((ox, i) => {
    const h = 4 + (i === 2 ? 3 : (i % 2 === 0 ? 2 : 0)); // tallest at centre
    c.polygon([
      [headX + ox - 0.8, headY + 1],
      [headX + ox + 0.8, headY + 1],
      [headX + ox + (i - 2) * 0.4, headY + 1 - h],
    ], gold, { shape: 'cone', height: 17, shade: 0.9, alpha });
  });
}

/**
 * CINDERLORD — the final boss. Pure *mass and heat*: a towering, wide-shouldered
 * armoured warlord with a great horned helm, a molten core burning behind the
 * breastplate, gauntleted fists the size of the husk's whole torso, and a
 * cape of drifting embers. Where nameless is a thin vertical, this is a
 * broad, heavy pyramid that dominates the frame.
 */
function drawCinderlord(c: PixelCanvas, k: Kinematics): void {
  const cx = c.width / 2;
  const groundY = c.height - 4;
  c.groundShadow(cx, groundY, 16 - k.squash, 4.2, 0.5);

  const alpha = deathAlpha(k);
  const plate = mix(TINT.cinderlord, '#2c1a1a', 0.55); // scorched dark iron
  const plateDark = shift(plate, -0.1, 4);
  const plateLight = shift(plate, 0.12, -4);
  const heat = 1 - k.collapse * 0.85;
  const lava = mix('#ff8a30', '#7a2410', k.collapse * 0.7);
  const core = mix('#ffd884', '#ff5e24', k.collapse * 0.5);
  const gold = '#c99a44';
  const baseY = 4 + k.bob + Math.round(k.collapse * 12);
  const lean = k.lean + k.recoil;
  const buckle = Math.round(k.collapse * 8); // heavy collapse

  // ---- Cape of embers behind everything: a broad dark mantle flaring out at
  // the shoulders, its lower edge dissolving into rising emissive sparks.
  const capeSway = Math.round(Math.sin((k.stride / 3) * Math.PI) * 2);
  c.polygon([
    [cx - 13 + lean, baseY + 12],
    [cx + 13 + lean, baseY + 12],
    [cx + 16 + capeSway, groundY - 2 - buckle],
    [cx - 16 + capeSway, groundY - 2 - buckle],
  ], mix(plate, '#1a1012', 0.5), { shape: 'cylinder-y', height: 4, curve: 0.85, alpha });
  // Ember sparks lifting off the cape's ragged lower edge.
  for (let s = 0; s < 7; s += 1) {
    const sx = cx - 12 + s * 4 + capeSway;
    const sy = groundY - 4 - ((s * 3) % 9) - buckle;
    c.rect(sx, sy, 1, 1 + (s % 2), lava, { emissive: true, alpha: heat * (0.5 + (s % 3) * 0.15) });
  }

  // ---- Legs: enormous armoured columns planted wide. Sabatons flare at the
  // feet; molten seams glow between the plates.
  const legY = baseY + 34;
  [-1, 1].forEach((side, i) => {
    const lx = cx + side * 8 + Math.round(k.stride * side * 0.4);
    c.rect(lx - 3, legY, 6, 14 - buckle, plate, { shape: 'cylinder-y', height: 6, shade: i === 0 ? 0.82 : 1, alpha });
    c.rect(lx - 4, legY + 12 - buckle, 8, 4, plateDark, { shape: 'bevel', height: 6, shade: i === 0 ? 0.82 : 1, alpha }); // sabaton
    // Knee cop — a bevelled plate with a glowing rivet.
    c.rect(lx - 3, legY + 4, 6, 3, plateLight, { shape: 'bevel', height: 7, shade: i === 0 ? 0.82 : 1, alpha });
    c.line(lx, legY + 1, lx, legY + 11 - buckle, lava, 1, { emissive: true, alpha: alpha * heat * 0.7 });
  });

  // ---- Massive torso: a broad barrel breastplate. Widest at the chest, so the
  // whole figure is a top-heavy pyramid of armour.
  const torsoY = baseY + 14;
  c.rect(cx - 11 + lean, torsoY, 22, 16, plate, { shape: 'cylinder-y', height: 11, curve: 0.9, alpha });
  // Fauld (skirt of plates) below the breastplate.
  for (let p = 0; p < 5; p += 1) {
    c.rect(cx - 10 + p * 4 + lean, torsoY + 15, 4, 5 - buckle, plateDark, { shape: 'bevel', height: 9, alpha });
  }
  // The molten core: a huge glowing furnace behind a cracked breastplate vent.
  // This is the boss's heart and the eye is drawn to it.
  c.ellipse(cx + lean, torsoY + 7, 5, 6, mix(core, '#3a1408', 0.3), { emissive: true, alpha: alpha * heat }); // vent shadow ring
  c.ellipse(cx + lean, torsoY + 7, 4, 5, core, { emissive: true, alpha: alpha * heat });
  c.ellipse(cx + lean, torsoY + 7, 2.4, 3, mix(core, '#fff2cc', 0.7), { emissive: true, alpha: alpha * heat });
  // Grated vent bars across the core (dark plate strips over the glow).
  for (let g = -1; g <= 1; g += 1) {
    c.rect(cx - 4 + lean, torsoY + 5 + g * 2.5, 8, 1, plateDark, { shape: 'flat', height: 12, alpha });
  }
  // Fissures cracking outward from the core across the breastplate.
  c.line(cx + lean, torsoY + 2, cx - 5 + lean, torsoY, lava, 1, { emissive: true, alpha: alpha * heat * 0.8 });
  c.line(cx + lean, torsoY + 2, cx + 5 + lean, torsoY + 1, lava, 1, { emissive: true, alpha: alpha * heat * 0.8 });

  // ---- Huge spiked pauldrons — the widest points of the silhouette, sitting
  // above the shoulders like a second, larger head-height line. Asymmetric: the
  // weapon-side pauldron is bigger and spikier.
  const drawPauldron = (side: number, size: number): void => {
    const px = cx + side * 12 + lean;
    c.ellipse(px, torsoY, size, size * 0.8, plate, { shape: 'dome', height: 13, curve: 1, alpha });
    c.ellipse(px - side, torsoY - 1, size * 0.5, size * 0.35, plateLight, { shape: 'dome', height: 14, alpha: alpha * 0.7 });
    // Spikes fanning off the top of the pauldron.
    for (let s = -1; s <= 1; s += 1) {
      c.polygon([
        [px + s * size * 0.6 - 1, torsoY - size * 0.6],
        [px + s * size * 0.6 + 1, torsoY - size * 0.6],
        [px + s * size * 0.6, torsoY - size * 0.6 - 4 - Math.abs(s === 0 ? 2 : 0)],
      ], plateDark, { shape: 'cone', height: 14, alpha });
    }
  };
  drawPauldron(-1, 5.5);
  drawPauldron(1, 6.5); // weapon side, bigger

  // ---- Arms and gauntleted fists. The weapon arm (screen right) hauls a
  // massive fist back then hammers down on the strike; the off arm braces.
  const reach = Math.round(k.reach);
  // Off arm.
  c.rect(cx - 13 + lean, torsoY + 3, 5, 10, plate, { shape: 'cylinder-y', height: 9, shade: 0.85, alpha });
  c.rect(cx - 15 + lean, torsoY + 12, 7, 6, plateDark, { shape: 'round', height: 9, shade: 0.85, alpha }); // fist
  // Weapon arm.
  const waX = cx + 13 + lean + Math.round(reach * 0.5);
  const waY = torsoY + 3 - Math.max(0, Math.round(reach * 0.5));
  c.rect(waX - 2, waY, 5, 10, plate, { shape: 'cylinder-y', height: 10, alpha });
  // Enormous gauntlet fist, knuckles glowing with trapped heat.
  c.rect(waX - 3, waY + 9, 8, 7, plate, { shape: 'round', height: 10, alpha });
  for (let kx = 0; kx < 3; kx += 1) {
    c.rect(waX - 2 + kx * 2.5, waY + 9, 1.6, 1.6, lava, { emissive: true, alpha: alpha * heat * (k.reach !== 0 ? 1 : 0.6) });
  }

  // ---- Horned helm: a heavy dome with a face-slit and a great pair of curving
  // horns that top the whole silhouette. The horns are the final "this is the
  // big one" signal.
  const headY = baseY + 2;
  const headX = cx + lean;
  c.rect(cx - 3 + lean, baseY + 10, 6, 4, plateDark, { shape: 'cylinder-y', height: 10, shade: 0.75, alpha }); // gorget/neck
  c.ellipse(headX, headY + 5, 5.5, 5, plate, { shape: 'dome', height: 17, curve: 0.95, alpha });
  // A dark T-slit visor with molten eyes burning behind it.
  c.rect(headX - 3.5, headY + 4, 7, 2, '#120a0a', { shape: 'flat', height: 18, alpha });
  c.rect(headX - 0.5, headY + 4, 1.5, 4, '#120a0a', { shape: 'flat', height: 18, alpha });
  if (k.collapse < 0.7) {
    [-2.2, 2.2].forEach((ox) => {
      c.rect(headX + ox - 0.5, headY + 4.2, 1.6, 1.4, core, { emissive: true, alpha: alpha * heat });
    });
  }
  // A gilded brow ridge.
  c.rect(headX - 4, headY + 2, 8, 1.4, gold, { shape: 'cylinder-x', height: 18, shade: 0.85, alpha });
  // Great heavy horns — thick at the temple, curving up and out to a point. Kept
  // broad (a wide base tapering over several pixels) so they read as ram horns,
  // not antennae; they are the final, unmissable "this is the big one" signal.
  const horn = mix(plate, '#3a2418', 0.4);
  const hornLit = shift(horn, 0.14, -4);
  [-1, 1].forEach((side) => {
    // Base horn body: a fat wedge from the temple sweeping outward and up.
    c.polygon([
      [headX + side * 2, headY + 4],
      [headX + side * 5, headY + 5],
      [headX + side * 10, headY - 3],
      [headX + side * 12, headY - 9],
      [headX + side * 9, headY - 9],
      [headX + side * 6, headY - 2],
      [headX + side * 2, headY + 1],
    ], horn, { shape: 'cone', height: 16, shade: side < 0 ? 0.82 : 1, alpha });
    // Lit ridge along the horn's upper edge to give it round volume.
    c.line(headX + side * 4, headY, headX + side * 11, headY - 8, hornLit, 1, { height: 17, shade: side < 0 ? 0.82 : 1, alpha });
    // Dark banded grooves near the base — the classic horn texture cue.
    c.line(headX + side * 4, headY + 3, headX + side * 6, headY + 1, plateDark, 1, { height: 16, shade: 0.7, alpha });
    c.line(headX + side * 6, headY + 1, headX + side * 8, headY - 2, plateDark, 1, { height: 16, shade: 0.7, alpha });
    // Heat glow at the horn root where it fuses to the burning skull.
    c.rect(headX + side * 3, headY + 2, 1.4, 1.4, lava, { emissive: true, alpha: alpha * heat * 0.6 });
  });
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/** Which draw function builds which creature, plus its gait "energy". */
const BUILDERS: Record<string, { draw: (c: PixelCanvas, k: Kinematics) => void; speed: number }> = {
  husk: { draw: drawHusk, speed: 0.8 },
  boneguard: { draw: drawBoneguard, speed: 0.7 },
  direwolf: { draw: drawDirewolf, speed: 1.4 }, // fast, bouncy gait
  wraith: { draw: drawWraith, speed: 1 },
  bogling: { draw: drawBogling, speed: 0.7 },
  cavecrawler: { draw: drawCavecrawler, speed: 1.2 },
  ashborn: { draw: drawAshborn, speed: 0.9 },
  nameless: { draw: drawNameless, speed: 0.6 }, // slow, regal
  cinderlord: { draw: drawCinderlord, speed: 0.6 }, // slow, heavy
};

/** Shared shading config for the bestiary — a touch moodier than the hero's. */
export const ENEMY_SHADE = {
  lightX: -0.5,
  lightY: -0.76,
  lightZ: 0.4,
  intensity: 0.64,
  ambient: 0.46, // slightly darker fill: monsters lurk
  ambientColor: '#47547e',
  occlusion: 0.44,
  rim: 0.26,
  rimColor: '#9aa6d0',
  bands: 5,
  dither: 0.44,
};

/** Stable texture key for one enemy frame. */
export function enemyKey(id: string, pose: EnemyPose, frame: number): string {
  return `enemy-${id}-${pose}-${frame}`;
}

/** Render a single enemy frame into a fresh, correctly-sized canvas. */
export function renderEnemyFrame(id: string, pose: EnemyPose, frame: number): PixelCanvas {
  const dim = enemyDim(id);
  const canvas = new PixelCanvas(dim.w, dim.h);
  const builder = BUILDERS[id];
  if (!builder) return canvas; // unknown id → empty canvas rather than a throw
  const k = kinematics(pose, frame, builder.speed);
  builder.draw(canvas, k);
  // Dark keyline + faint lit edge on the upper-left, exactly like the hero, so
  // enemies read against the dark world with the same visual language.
  canvas.outline(OUTLINE, { lightEdge: mix(OUTLINE, RIM, 0.5), alpha: 0.94 });
  return canvas;
}

/** Every frame in the bestiary, as (key, canvas) pairs for the texture atlas. */
export function buildEnemyFrames(): Array<{ key: string; canvas: PixelCanvas }> {
  const frames: Array<{ key: string; canvas: PixelCanvas }> = [];
  for (const id of Object.keys(BUILDERS)) {
    for (const pose of Object.keys(ENEMY_POSE_FRAMES) as EnemyPose[]) {
      for (let frame = 0; frame < ENEMY_POSE_FRAMES[pose]; frame += 1) {
        frames.push({ key: enemyKey(id, pose, frame), canvas: renderEnemyFrame(id, pose, frame) });
      }
    }
  }
  return frames;
}

/** Convenience re-exports mirroring hero.ts. */
export const ENEMY_IDS = Object.keys(BUILDERS);
export type { DrawOptions };
