/**
 * EnemyAI — per-archetype behaviour for Trupy's mooks.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every enemy used to run one identical "walk straight at the player and touch
 * them" loop, so a husk, a wolf and a fire-mage all fought the same way. That is
 * the single biggest thing flattening combat: the player learns one counter
 * (back-pedal and swing) and it beats the entire bestiary. This module gives
 * each creature a distinct *movement grammar* and a distinct *threat vector*, so
 * the player has to read the enemy's silhouette and change tactics:
 *
 *   - a shambler you can kite but never out-wait (it never gives up),
 *   - a shieldbearer you must flank (frontal damage bounces),
 *   - a wolf pack you must not let surround you (they circle and take turns),
 *   - a wraith you can't reliably combo (it blinks out and reappears),
 *   - a brute you must bait-and-dodge (huge telegraphed slam),
 *   - a skitterer that refuses to hold still (dashes, burrows behind you),
 *   - a ranged ashborn that punishes standing still (the archetype the game
 *     most lacked — a real ranged threat rewrites how the player moves).
 *
 * DESIGN CONTRACT WITH WorldScene
 * -------------------------------
 * This file never touches WorldScene internals. It reads the enemy's existing
 * getData() fields and steers the enemy's Arcade body, and it asks the scene to
 * do the privileged things (deal damage to the player, spawn a projectile, spawn
 * an add) through the callbacks on `AIContext`. That keeps WorldScene the single
 * integrator: it wires the callbacks once and calls `EnemyAI.update(enemy, ctx)`
 * from `updateEnemies`. See the INTEGRATION NOTE at the bottom for exact sites.
 *
 * PERFORMANCE
 * -----------
 * `update` runs for up to ~30 enemies. It allocates nothing per call: all vector
 * maths goes through module-level scratch vectors, and all per-enemy state lives
 * in a single object stashed on the sprite via getData/setData('ai'). The scene
 * already throttles enemy updates to a ~72ms "slow tick", so `context.delta` is
 * ~72ms, not a 16ms frame — behaviours are written in wall-clock time (ms), not
 * frames, so they stay correct at any tick rate.
 */

import Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Public types the scene consumes.
// ---------------------------------------------------------------------------

/**
 * The seven distinct fighting styles. Bosses get their own light-weight entry so
 * the same iteration in `updateEnemies` can skip them (their real fight lives in
 * BossFight.ts) without special-casing enemy ids at the call site.
 */
export type Archetype =
  | 'shambler'
  | 'shieldbearer'
  | 'packHunter'
  | 'phaser'
  | 'brute'
  | 'skitterer'
  | 'ranged'
  | 'boss';

/** The nine content enemies mapped onto their archetype. */
export const ARCHETYPE_BY_ENEMY: Record<string, Archetype> = {
  husk: 'shambler',
  boneguard: 'shieldbearer',
  direwolf: 'packHunter',
  wraith: 'phaser',
  bogling: 'brute',
  cavecrawler: 'skitterer',
  ashborn: 'ranged',
  nameless: 'boss',
  cinderlord: 'boss',
};

/** Alert lifecycle. Drives which animation plays and whether the enemy fights. */
export type AlertState = 'idle' | 'alerted' | 'engaged';

/**
 * Everything a behaviour needs from the world, passed in each tick so the AI
 * stays a pure function of (enemy, context). WorldScene fills this once per tick
 * and reuses the object — do not retain references to it past the call.
 */
export interface AIContext {
  /** Live player position (world space). */
  playerX: number;
  playerY: number;
  /** Whether the player can currently be damaged (dash i-frames, dead, etc.). */
  playerAlive: boolean;
  /** scene.time.now, ms. */
  time: number;
  /** ms since this enemy was last updated (≈72 on the slow tick). */
  delta: number;
  /** weather.profile().visibility, 0.52–1.0. Lower = fog hides the player. */
  visibility: number;
  /** lighting.getState().danger, ~0.85 (day) – 1.55 (deep night). */
  danger: number;
  /** save.settings.reducedMotion — suppress screen-shake-y flourishes. */
  reducedMotion: boolean;
  /** true when quality==='low' (or auto+small): scale telegraph particle counts. */
  lowQuality: boolean;

  // --- Privileged actions the AI requests but WorldScene performs. ---
  /** Deal `amount` to the player (respects the scene's own i-frame gate). */
  hurtPlayer: (amount: number) => void;
  /**
   * Fire an enemy projectile from (x,y) toward (tx,ty). `damage` is pre-armour.
   * `speed` px/s, `kind` selects the visual/impact. Returns nothing; the scene
   * owns the projectile lifetime.
   */
  spawnProjectile: (opts: EnemyProjectileRequest) => void;
  /** Spawn an add of `type` near (x,y) — used by phasers/bosses. */
  spawnAdd?: (type: string, x: number, y: number) => void;
  /** All active enemies, for coordination (pack sequencing). Read-only use. */
  enemies: Phaser.Physics.Arcade.Sprite[];
}

export interface EnemyProjectileRequest {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  damage: number;
  speed: number;
  kind: 'fire' | 'shadow';
  /**
   * Source enemy, so the scene can tag or skew the projectile if it wants.
   * Optional because boss attacks route through the same scene helper and some
   * of them have no attributable body (arena-wide ember rain, for instance).
   */
  source?: Phaser.Physics.Arcade.Sprite;
}

// ---------------------------------------------------------------------------
// Per-enemy AI state. One object per sprite, created lazily, stored on the
// sprite. Kept tiny and flat — this is hot memory touched every tick.
// ---------------------------------------------------------------------------

interface AIState {
  archetype: Archetype;
  alert: AlertState;
  /** Sub-state within an archetype's own little machine (e.g. wolf phases). */
  phase: string;
  /** Generic timer: when the current phase/cooldown expires (ms, absolute). */
  until: number;
  /** Next time a special/attack may fire (ms, absolute). */
  nextSpecial: number;
  /** Circling direction for pack hunters / orbiters: +1 or -1. */
  orbitSign: number;
  /** Cached elite flag so we don't re-read getData each tick. */
  elite: boolean;
  /** When the enemy first noticed the player, for the alerted→engaged delay. */
  alertedAt: number;
  /**
   * Absolute time (ms) until which the enemy is "blinded" — inside a smoke cloud
   * it cannot detect or re-acquire the player. 0 = not blinded. Set by
   * EnemyAI.blind (see the smoke bomb). While blinded, detection is forced to
   * fail so an alerted/engaged enemy drops back to idle and a fresh one never
   * notices the player through the smoke.
   */
  blindUntil: number;
}

// ---------------------------------------------------------------------------
// Module-level scratch. Reused across every enemy and every tick so the hot
// path allocates nothing. NEVER return these or hold them across a yield.
// ---------------------------------------------------------------------------

const toPlayer = new Phaser.Math.Vector2();
const perp = new Phaser.Math.Vector2();
const desired = new Phaser.Math.Vector2();
const scratch = new Phaser.Math.Vector2();

/**
 * Elite tuning. Elites are the "oh no" spike: tankier, faster to react, hit
 * harder, and visibly marked. Kept modest on damage (the player's health pool is
 * small) but generous on HP so they change the *pacing* of a fight, not just its
 * lethality.
 */
const ELITE_HEALTH_MULT = 2.35;
const ELITE_DAMAGE_MULT = 1.4;
const ELITE_SPEED_MULT = 1.12;
/** Base chance a normal (non-boss, non-rift-forced) spawn rolls elite. */
const ELITE_CHANCE = 0.09;
/** A warm gold-ish shift laid over the enemy's tint so elites read instantly. */
const ELITE_TINT = 0xffd27a;

export const EnemyAI = {
  /**
   * Decide (once, at spawn) whether an enemy is elite and, if so, buff it in
   * place. Returns true if it became elite. WorldScene calls this right after it
   * finishes `setData` in `spawnEnemy`, before adding the health bar, so the
   * buffed maxHealth is what the bar reads.
   *
   * `force` lets callers opt a spawn in/out (bosses never elite; a rift could
   * force one). `chanceMult` lets night/danger raise the elite rate.
   */
  rollElite(
    enemy: Phaser.Physics.Arcade.Sprite,
    opts: { force?: boolean; chanceMult?: number } = {},
  ): boolean {
    const type = String(enemy.getData('type'));
    const archetype = ARCHETYPE_BY_ENEMY[type] ?? 'shambler';
    if (archetype === 'boss') return false; // bosses are their own event
    const forced = opts.force === true;
    const chance = Math.min(0.4, ELITE_CHANCE * (opts.chanceMult ?? 1));
    const isElite = forced || Math.random() < chance;
    if (!isElite) {
      enemy.setData('elite', false);
      return false;
    }
    enemy.setData('elite', true);
    const maxHealth = Math.round(Number(enemy.getData('maxHealth')) * ELITE_HEALTH_MULT);
    enemy.setData('maxHealth', maxHealth);
    enemy.setData('health', maxHealth);
    enemy.setData('damage', Math.round(Number(enemy.getData('damage')) * ELITE_DAMAGE_MULT));
    enemy.setData('speed', Math.round(Number(enemy.getData('speed')) * ELITE_SPEED_MULT));
    // Elites drop more: WorldScene reads this multiplier in killEnemy.
    enemy.setData('lootMult', 2);
    // A colour-shifted tint + a subtle scale bump so the silhouette reads as
    // "bigger, hotter, dangerous" before any number is visible.
    enemy.setTint(ELITE_TINT);
    enemy.setData('eliteTint', ELITE_TINT);
    enemy.setScale(enemy.scaleX * 1.14, enemy.scaleY * 1.14);
    return true;
  },

  /**
   * Attach a floating marker above an elite so the player can pick it out of a
   * crowd. Returns the marker (a Text) or undefined for non-elites. WorldScene
   * owns the object's lifetime; it should destroy it in killEnemy alongside the
   * health bar. Kept here so all elite presentation lives in one place.
   */
  createEliteMarker(
    scene: Phaser.Scene,
    enemy: Phaser.Physics.Arcade.Sprite,
  ): Phaser.GameObjects.Text | undefined {
    if (!enemy.getData('elite')) return undefined;
    const marker = scene.add
      .text(enemy.x, enemy.y - enemy.displayHeight * 0.62, '✦', {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffdc86',
        stroke: '#2a1a06',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(enemy.depth + 3);
    return marker;
  },

  /**
   * The per-tick brain. Steers the enemy's body, plays animations, and requests
   * privileged actions via the context. Returns whether this enemy is in combat
   * this tick, so the scene can keep its existing `combat` flag / music logic
   * (it OR-reduces the return across all enemies).
   *
   * WorldScene calls this INSTEAD of its old inline chase+`tryEnemySpecial`
   * block, once per non-boss enemy inside the range check. Boss sprites return
   * false immediately (their fight is driven by BossFight.ts).
   */
  update(enemy: Phaser.Physics.Arcade.Sprite, ctx: AIContext): boolean {
    const body = enemy.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !enemy.active) return false;

    const state = getState(enemy);
    if (state.archetype === 'boss') {
      // Boss movement/attacks are BossFight's job. Leave the body untouched so
      // the two systems never fight over velocity.
      return false;
    }

    const type = String(enemy.getData('type'));
    const baseAggro = Number(enemy.getData('aggro')) || 240;
    const speed = Number(enemy.getData('speed')) || 60;
    const damage = Number(enemy.getData('damage')) || 10;

    // ---- Detection. Fog shrinks it (visibility<1), night grows it (danger>1),
    // so the same enemy is a longer-range threat in the dark and an ambush in
    // fog. Elites are more alert. This is the core of "the weather changes how
    // the game plays" — a foggy marsh genuinely hides the drowned until close.
    const detectRange = baseAggro * ctx.visibility * (0.85 + ctx.danger * 0.35) * (state.elite ? 1.2 : 1);
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
    const distance = toPlayer.length();

    // ---- Alert state machine: idle → alerted → engaged.
    // The alerted beat (a brief pause + a "notice" cue) is what makes stealth
    // and fog meaningful: you get a heartbeat of warning, or you get the drop.
    updateAlert(enemy, state, ctx, distance, detectRange);

    if (state.alert === 'idle') {
      idleWander(enemy, body, ctx, state, speed);
      return false;
    }
    if (state.alert === 'alerted') {
      // Freeze-and-notice: hold position, face the player, play idle. This is the
      // fair-warning window before the enemy commits.
      body.setVelocity(0, 0);
      faceTarget(enemy, ctx.playerX);
      playLoop(enemy, type, 'idle');
      return true;
    }

    // ---- Engaged: dispatch to the archetype behaviour. Each returns whether it
    // wants the "in combat" flag set (essentially always true when engaged).
    switch (state.archetype) {
      case 'shambler':
        return behaveShambler(enemy, body, ctx, state, type, distance, speed, damage);
      case 'shieldbearer':
        return behaveShieldbearer(enemy, body, ctx, state, type, distance, speed, damage);
      case 'packHunter':
        return behavePackHunter(enemy, body, ctx, state, type, distance, speed, damage);
      case 'phaser':
        return behavePhaser(enemy, body, ctx, state, type, distance, speed, damage);
      case 'brute':
        return behaveBrute(enemy, body, ctx, state, type, distance, speed, damage);
      case 'skitterer':
        return behaveSkitterer(enemy, body, ctx, state, type, distance, speed, damage);
      case 'ranged':
        return behaveRanged(enemy, body, ctx, state, type, distance, speed, damage);
      default:
        return false;
    }
  },

  /**
   * Frontal damage reduction for shieldbearers. WorldScene calls this in
   * `damageEnemy` to fold the shield into the incoming hit: a blow landing on
   * the raised shield (player in front of the facing arc) is cut ~60%, so the
   * player is pushed to flank. Returns the (possibly reduced) damage.
   *
   * Non-shieldbearers and shield-lowered states return `damage` unchanged.
   */
  mitigateDamage(
    enemy: Phaser.Physics.Arcade.Sprite,
    damage: number,
    attackerX: number,
    attackerY: number,
  ): number {
    const state = enemy.getData('ai') as AIState | undefined;
    if (!state || state.archetype !== 'shieldbearer') return damage;
    if (state.phase === 'open') return damage; // shield lowered to strike = real opening
    // Shield faces the player when raised. The enemy's flipX encodes facing:
    // flipX=true → facing left (−x). Compare the attack's incoming direction to
    // the shield normal; a frontal hit is mitigated, a flank/back hit is not.
    const facingX = enemy.flipX ? -1 : 1;
    const dx = attackerX - enemy.x;
    const dy = attackerY - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    // dot of (attacker→direction) with facing on x, plus a small vertical
    // tolerance so "in front" is a ~120° frontal cone, not a razor line.
    const frontal = (dx / len) * facingX;
    if (frontal > 0.35 && Math.abs(dy) < len * 0.85) {
      return Math.max(1, Math.round(damage * 0.4)); // ~60% reduction
    }
    return damage;
  },

  /** True if the sprite is currently intangible (wraith mid-blink): the scene
   * skips damage entirely. Cheap read for the melee/projectile hit paths. */
  isIntangible(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    const state = enemy.getData('ai') as AIState | undefined;
    return Boolean(state && state.archetype === 'phaser' && state.phase === 'blink');
  },

  /** Reset cached AI state — call if an enemy sprite is recycled to a new type. */
  reset(enemy: Phaser.Physics.Arcade.Sprite): void {
    enemy.setData('ai', undefined);
  },

  /**
   * Blind an enemy for `durationMs`: drop it straight back to idle and prevent it
   * from detecting or re-acquiring the player until the timer expires. This is the
   * public hook the smoke bomb (SmokeBomb.ts) uses so an enemy caught in the cloud
   * loses aggro and can't lock back on while the smoke lingers.
   *
   * Bosses are intentionally immune — their fights are choreographed by
   * BossFight.ts and must not be interrupted by a consumable. Calling this on a
   * boss is a harmless no-op.
   *
   * Time is read from the enemy's scene clock so the caller doesn't have to pass
   * `time` in; the AI update path compares against the same clock.
   */
  blind(enemy: Phaser.Physics.Arcade.Sprite, durationMs: number): void {
    if (!enemy.active) return;
    const state = getState(enemy);
    if (state.archetype === 'boss') return;
    const now = enemy.scene?.time.now ?? 0;
    state.blindUntil = Math.max(state.blindUntil, now + Math.max(0, durationMs));
    // Immediately forget the player: reset the alert machine and any committed
    // attack phase so the enemy visibly disengages the instant the smoke lands.
    state.alert = 'idle';
    state.phase = 'approach';
    state.alertedAt = 0;
    state.until = 0;
  },

  /** True if the enemy is currently blinded by smoke (for scene-side visuals). */
  isBlinded(enemy: Phaser.Physics.Arcade.Sprite): boolean {
    const state = enemy.getData('ai') as AIState | undefined;
    if (!state) return false;
    return state.blindUntil > (enemy.scene?.time.now ?? 0);
  },
};

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

function getState(enemy: Phaser.Physics.Arcade.Sprite): AIState {
  let state = enemy.getData('ai') as AIState | undefined;
  const type = String(enemy.getData('type'));
  const archetype = ARCHETYPE_BY_ENEMY[type] ?? 'shambler';
  if (!state || state.archetype !== archetype) {
    state = {
      archetype,
      alert: 'idle',
      phase: 'approach',
      until: 0,
      nextSpecial: 0,
      orbitSign: Math.random() < 0.5 ? -1 : 1,
      elite: Boolean(enemy.getData('elite')),
      alertedAt: 0,
      blindUntil: 0,
    };
    enemy.setData('ai', state);
  }
  return state;
}

/**
 * idle→alerted→engaged transitions. Alerted is a short (350ms) beat: the enemy
 * has noticed but hasn't committed. Losing sight (player leaves 1.4× detect,
 * e.g. by breaking away in fog) drops it back toward idle after a grace period,
 * so enemies genuinely "lose" you rather than tracking forever.
 */
function updateAlert(
  enemy: Phaser.Physics.Arcade.Sprite,
  state: AIState,
  ctx: AIContext,
  distance: number,
  detectRange: number,
): void {
  // Smoke blindness overrides everything: while the timer is live the enemy
  // simply cannot perceive the player, so it falls back to idle wander and can't
  // re-engage from inside the cloud.
  const blinded = state.blindUntil > ctx.time;
  const seen = !blinded && distance < detectRange && ctx.playerAlive;
  switch (state.alert) {
    case 'idle':
      if (seen) {
        state.alert = 'alerted';
        state.alertedAt = ctx.time;
        // A small "!" so the noticing is legible to the player, scaled down when
        // motion is reduced (still shown — it's information, not decoration).
        spawnAlertMark(enemy);
      }
      break;
    case 'alerted':
      if (!seen) {
        state.alert = 'idle';
      } else if (ctx.time > state.alertedAt + 350) {
        state.alert = 'engaged';
      }
      break;
    case 'engaged':
      // Grace: only disengage once the player is well outside detection, and
      // give the enemy a moment so a single fog wisp doesn't reset the fight.
      if (distance > detectRange * 1.5 || !ctx.playerAlive) {
        if (state.until < ctx.time) {
          state.alert = 'idle';
          state.phase = 'approach';
        }
      } else {
        state.until = ctx.time + 900; // keep the fight alive while in range
      }
      break;
  }
}

function spawnAlertMark(enemy: Phaser.Physics.Arcade.Sprite): void {
  const scene = enemy.scene;
  if (!scene) return;
  const mark = scene.add
    .text(enemy.x, enemy.y - enemy.displayHeight * 0.5, '!', {
      fontFamily: 'monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffe08a',
      stroke: '#1a1206',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(enemy.depth + 4);
  scene.tweens.add({
    targets: mark,
    y: mark.y - 12,
    alpha: 0,
    duration: 520,
    ease: 'Quad.easeOut',
    onComplete: () => mark.destroy(),
  });
}

/** Idle behaviour when the player is unseen: a gentle drift near home. Mirrors
 * the scene's old home-tether so enemies don't wander off their spawn zone. */
function idleWander(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  speed: number,
): void {
  const homeX = Number(enemy.getData('homeX'));
  const homeY = Number(enemy.getData('homeY'));
  const type = String(enemy.getData('type'));
  const homeDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, homeX, homeY);
  if (homeDist > 55) {
    desired.set(homeX - enemy.x, homeY - enemy.y).normalize().scale(speed * 0.45);
    body.setVelocity(desired.x, desired.y);
    playLoop(enemy, type, 'walk');
    faceTarget(enemy, homeX);
  } else {
    // Tiny sinusoidal shuffle so idle enemies breathe rather than freeze.
    body.setVelocity(
      Math.sin((ctx.time + homeX) * 0.001) * 8,
      Math.cos((ctx.time + homeY) * 0.0012) * 8,
    );
    playLoop(enemy, type, 'idle');
  }
  void state;
}

/**
 * Play a looping pose (idle/walk) if not already the current animation. Guards
 * against restarting the anim every tick (which would freeze it on frame 0).
 */
function playLoop(enemy: Phaser.Physics.Arcade.Sprite, type: string, pose: 'idle' | 'walk'): void {
  const key = `enemy-${type}-${pose}`;
  const current = enemy.anims.currentAnim?.key;
  if (current !== key && enemy.scene?.anims.exists(key)) {
    enemy.play(key, true);
  }
}

/**
 * Play a one-shot pose (attack). Lets it run to completion; the loop poses will
 * take back over once it finishes. Returns nothing; safe to call repeatedly (it
 * no-ops while the same one-shot is already playing).
 */
function playOnce(enemy: Phaser.Physics.Arcade.Sprite, type: string, pose: 'attack' | 'hurt'): void {
  const key = `enemy-${type}-${pose}`;
  const anims = enemy.anims;
  if (anims.isPlaying && anims.currentAnim?.key === key) return;
  if (enemy.scene?.anims.exists(key)) enemy.play(key, true);
}

/** Face the given world x by flipping the sprite. flipX=true means facing −x. */
function faceTarget(enemy: Phaser.Physics.Arcade.Sprite, targetX: number): void {
  enemy.setFlipX(targetX < enemy.x);
}

/** Move toward a world point at `speed`, updating facing + walk anim. */
function moveToward(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  tx: number,
  ty: number,
  speed: number,
  type: string,
): void {
  desired.set(tx - enemy.x, ty - enemy.y);
  if (desired.lengthSq() > 0.001) desired.normalize().scale(speed);
  body.setVelocity(desired.x, desired.y);
  faceTarget(enemy, tx);
  playLoop(enemy, type, 'walk');
}

/**
 * A ground telegraph ring that fills over `windup` ms then fires `onFire`. This
 * is the single most important fairness primitive: every dangerous enemy attack
 * shows this first, so a hit is always the player's mistake, never a surprise.
 * Scales its particle/stroke work down on low quality and reduced motion.
 */
function telegraph(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  windup: number,
  ctx: AIContext,
  onFire: () => void,
): void {
  const alpha = ctx.reducedMotion ? 0.22 : 0.14;
  const ring = scene.add
    .circle(x, y, radius, color, alpha)
    .setStrokeStyle(ctx.lowQuality ? 3 : 5, color, 0.9)
    .setDepth(880);
  scene.tweens.add({
    targets: ring,
    scale: ctx.reducedMotion ? 1.05 : 1.2,
    alpha: alpha + 0.24,
    duration: windup,
    onComplete: () => {
      ring.destroy();
      onFire();
    },
  });
}

// ---------------------------------------------------------------------------
// SHAMBLER (husk) — slow, relentless, no retreat. It never kites, never gives
// ground; the pressure is that it simply keeps coming. Its one trick is a short
// lunge when it gets close, so a player who lets it into melee eats a bite.
// The fantasy: attrition. You can out-run it, but you can't out-wait it.
// ---------------------------------------------------------------------------
function behaveShambler(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const scene = enemy.scene;
  const meleeRange = 40 + enemy.displayWidth * 0.18;

  if (state.phase === 'lunge') {
    // Committed lunge: velocity already set; just wait it out, then recover.
    if (ctx.time > state.until) state.phase = 'approach';
    if (distance < meleeRange + 6) tryTouch(enemy, ctx, damage, 1.3);
    return true;
  }

  // Wind up a lunge when close and off cooldown.
  if (distance < meleeRange + 34 && ctx.time > state.nextSpecial && scene) {
    state.phase = 'lunge';
    state.until = ctx.time + 260;
    state.nextSpecial = ctx.time + 2200;
    playOnce(enemy, type, 'attack');
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y).normalize();
    body.setVelocity(toPlayer.x * speed * 3.4, toPlayer.y * speed * 3.4);
    faceTarget(enemy, ctx.playerX);
    return true;
  }

  // Otherwise: relentless plod straight at the player.
  moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
  if (distance < meleeRange) tryTouch(enemy, ctx, damage, 1);
  return true;
}

// ---------------------------------------------------------------------------
// SHIELDBEARER (boneguard) — advances behind a raised shield. Frontal damage is
// cut ~60% (see mitigateDamage), so trading blows head-on is a losing game; the
// player must circle to its flank. Periodically it LOWERS the shield to wind up
// a heavy bash — a real, readable opening where it takes full damage. The
// fantasy: a puzzle of positioning, not a DPS race.
// ---------------------------------------------------------------------------
function behaveShieldbearer(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const meleeRange = 46 + enemy.displayWidth * 0.18;

  if (state.phase === 'open') {
    // Shield down, mid-bash. Full-damage window. Freeze in place for the strike.
    if (ctx.time > state.until) {
      state.phase = 'guard';
      state.nextSpecial = ctx.time + 2600;
    }
    body.setVelocity(0, 0);
    faceTarget(enemy, ctx.playerX);
    if (distance < meleeRange + 10) tryTouch(enemy, ctx, damage, 1.5);
    return true;
  }

  // Guarding: advance slowly, shield up (mitigation active), always facing the
  // player so the shield stays between them. Slower than a mook — it's a wall.
  faceTarget(enemy, ctx.playerX);
  if (distance > meleeRange - 4) {
    moveToward(enemy, body, ctx.playerX, ctx.playerY, speed * 0.9, type);
    faceTarget(enemy, ctx.playerX); // moveToward faces travel dir; re-face player
  } else {
    body.setVelocity(0, 0);
    playLoop(enemy, type, 'idle');
  }

  // Drop the guard to bash when in range and off cooldown — the opening.
  if (distance < meleeRange + 8 && ctx.time > state.nextSpecial) {
    state.phase = 'open';
    state.until = ctx.time + 520; // vulnerable while the shield is down
    playOnce(enemy, type, 'attack');
    if (enemy.scene && !ctx.reducedMotion) {
      // A brief glint where the shield drops, so the opening is legible.
      const glint = enemy.scene.add
        .circle(enemy.x, enemy.y - 6, 7, 0xffe6b0, 0.5)
        .setDepth(enemy.depth + 3);
      enemy.scene.tweens.add({ targets: glint, alpha: 0, scale: 1.6, duration: 300, onComplete: () => glint.destroy() });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// PACK HUNTER (direwolf) — does not charge in a straight line; it circles,
// looking for an opening, and the pack COORDINATES: only one wolf commits to a
// lunge at a time (a shared token via the nearest-wolf check), so the player
// faces staggered attacks instead of an alpha-strike blob. After a lunge it
// retreats to reposition. The fantasy: being hunted by something smart.
// ---------------------------------------------------------------------------
function behavePackHunter(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const lungeRange = 300;

  if (state.phase === 'lunge') {
    if (ctx.time > state.until) {
      state.phase = 'retreat';
      state.until = ctx.time + 700;
    }
    if (distance < 60) tryTouch(enemy, ctx, damage, 1.35);
    return true;
  }

  if (state.phase === 'retreat') {
    // Pull back after striking to reset — this is what makes the pack read as
    // "circling for another pass" rather than piling on.
    if (ctx.time > state.until) state.phase = 'circle';
    toPlayer.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY).normalize();
    body.setVelocity(toPlayer.x * speed, toPlayer.y * speed);
    faceTarget(enemy, ctx.playerX);
    playLoop(enemy, type, 'walk');
    return true;
  }

  // Default: circle. Move mostly tangentially around the player with a slight
  // inward bias, at the circling radius.
  const orbitRadius = 150;
  toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
  const dist = toPlayer.length() || 1;
  toPlayer.scale(1 / dist);
  perp.set(-toPlayer.y * state.orbitSign, toPlayer.x * state.orbitSign);
  // Blend tangential + radial (in if far, out if too close) so wolves settle
  // onto the ring instead of spiralling in.
  const radialBias = distance > orbitRadius ? 0.55 : -0.35;
  desired.set(perp.x + toPlayer.x * radialBias, perp.y + toPlayer.y * radialBias).normalize().scale(speed);
  body.setVelocity(desired.x, desired.y);
  faceTarget(enemy, ctx.playerX);
  playLoop(enemy, type, 'walk');

  // Commit to a lunge only if this wolf currently "holds the token": it is the
  // nearest engaged wolf to the player and no wolf lunged very recently. This
  // sequences the pack.
  if (
    distance < lungeRange &&
    ctx.time > state.nextSpecial &&
    packHoldsToken(enemy, ctx)
  ) {
    state.phase = 'lunge';
    state.until = ctx.time + 300;
    state.nextSpecial = ctx.time + 2600;
    setPackLungeStamp(ctx, ctx.time);
    playOnce(enemy, type, 'attack');
    if (enemy.scene) {
      const line = enemy.scene.add
        .line(0, 0, enemy.x, enemy.y, ctx.playerX, ctx.playerY, 0xd9a06a, 0.6)
        .setOrigin(0)
        .setLineWidth(ctx.lowQuality ? 2 : 4)
        .setDepth(878);
      enemy.scene.tweens.add({ targets: line, alpha: 0, duration: 260, onComplete: () => line.destroy() });
    }
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y).normalize();
    body.setVelocity(toPlayer.x * speed * 3.6, toPlayer.y * speed * 3.6);
  }
  return true;
}

/**
 * Pack coordination token. A wolf may lunge only if it is the closest engaged
 * wolf to the player AND at least ~700ms has passed since any wolf last lunged.
 * The stamp is stored on the scene's data manager (registry-free) via a shared
 * WeakMap keyed by scene, so no globals leak across scene restarts.
 */
const lastPackLunge = new WeakMap<Phaser.Scene, number>();
function setPackLungeStamp(ctx: AIContext, time: number): void {
  const scene = ctx.enemies[0]?.scene;
  if (scene) lastPackLunge.set(scene, time);
}
function packHoldsToken(enemy: Phaser.Physics.Arcade.Sprite, ctx: AIContext): boolean {
  const scene = enemy.scene;
  if (!scene) return true;
  const last = lastPackLunge.get(scene) ?? -9999;
  if (ctx.time < last + 700) return false; // another wolf just went; wait our turn
  const myDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, ctx.playerX, ctx.playerY);
  for (const other of ctx.enemies) {
    if (other === enemy || !other.active) continue;
    if (String(other.getData('type')) !== 'direwolf') continue;
    const otherState = other.getData('ai') as AIState | undefined;
    if (!otherState || otherState.alert !== 'engaged') continue;
    const d = Phaser.Math.Distance.Between(other.x, other.y, ctx.playerX, ctx.playerY);
    if (d < myDist - 1) return false; // someone is closer; let them lead
  }
  return true;
}

// ---------------------------------------------------------------------------
// PHASER (wraith) — teleports short hops toward the player, going briefly
// intangible (immune) mid-blink then reappearing, often beside or behind the
// target. It drifts through terrain (its body already ignores collision in the
// scene sense — we simply never path it around walls). The fantasy: an enemy you
// can't reliably combo, that punishes tunnel-vision by reappearing off-angle.
// ---------------------------------------------------------------------------
function behavePhaser(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const scene = enemy.scene;
  const meleeRange = 44;

  if (state.phase === 'blink') {
    // Intangible transit. Body is parked (we hard-set position on arrival); the
    // sprite is faded so the player reads "can't hit this right now".
    if (ctx.time > state.until) {
      // Reappear at the stashed destination.
      const dx = Number(enemy.getData('blinkX'));
      const dy = Number(enemy.getData('blinkY'));
      enemy.setPosition(dx, dy);
      enemy.setAlpha(1);
      state.phase = 'approach';
      if (scene && !ctx.lowQuality) {
        const pop = scene.add.circle(dx, dy, 10, 0x9d7be0, 0.5).setDepth(enemy.depth + 2);
        scene.tweens.add({ targets: pop, scale: 2, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
      }
    }
    body.setVelocity(0, 0);
    return true;
  }

  // Drift toward the player through anything (no wall avoidance by design).
  moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);

  // Touch damage in melee.
  if (distance < meleeRange) tryTouch(enemy, ctx, damage, 1);

  // Start a blink when it's time: fade out, stash a destination near/behind the
  // player, and go intangible for the transit window.
  if (ctx.time > state.nextSpecial && distance < 360 && scene) {
    state.phase = 'blink';
    state.until = ctx.time + 340;
    state.nextSpecial = ctx.time + 2400;
    playOnce(enemy, type, 'attack');
    // Destination: a point on the far side of the player (flank/behind), so the
    // wraith keeps ending up off the player's facing.
    scratch.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
    if (scratch.lengthSq() < 1) scratch.set(1, 0);
    scratch.normalize();
    const behindDist = 70;
    const destX = Phaser.Math.Clamp(ctx.playerX + scratch.x * behindDist, 40, 4860);
    const destY = Phaser.Math.Clamp(ctx.playerY + scratch.y * behindDist, 40, 2760);
    enemy.setData('blinkX', destX);
    enemy.setData('blinkY', destY);
    enemy.setAlpha(0.28);
    body.setVelocity(0, 0);
    // A departure wisp at the origin.
    if (!ctx.lowQuality) {
      const wisp = scene.add.circle(enemy.x, enemy.y, 9, 0x8d63c4, 0.45).setDepth(enemy.depth + 2);
      scene.tweens.add({ targets: wisp, scale: 2.1, alpha: 0, duration: 280, onComplete: () => wisp.destroy() });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// BRUTE (bogling) — slow and heavy with a big HP pool and one huge, telegraphed
// slam that puts out a ground shockwave. Its whole threat is the slam: a wide
// wind-up ring you must be out of when it lands. The fantasy: a lumbering
// pressure that forces committed dodges rather than continuous poking.
// ---------------------------------------------------------------------------
function behaveBrute(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const scene = enemy.scene;
  const slamRange = 150;

  if (state.phase === 'slam') {
    // Rooted during the wind-up (the telegraph tween handles the payload).
    body.setVelocity(0, 0);
    if (ctx.time > state.until) state.phase = 'approach';
    return true;
  }

  // Advance slowly.
  moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
  if (distance < 42 + enemy.displayWidth * 0.18) tryTouch(enemy, ctx, damage, 1);

  // Telegraphed slam with a ground shockwave.
  if (distance < slamRange && ctx.time > state.nextSpecial && scene) {
    state.phase = 'slam';
    const windup = 620;
    state.until = ctx.time + windup + 120;
    state.nextSpecial = ctx.time + 3200;
    playOnce(enemy, type, 'attack');
    faceTarget(enemy, ctx.playerX);
    const slamX = enemy.x;
    const slamY = enemy.y;
    const radius = 118;
    telegraph(scene, slamX, slamY, radius, 0x83d6ad, windup, ctx, () => {
      // Shockwave ring expands outward; anyone inside `radius` at impact is hit.
      if (!enemy.active) return;
      const wave = scene.add
        .circle(slamX, slamY, 24, 0x4fa985, 0.6)
        .setDepth(enemy.depth + 1);
      scene.tweens.add({ targets: wave, radius: radius + 18, alpha: 0, duration: 360, onComplete: () => wave.destroy() });
      if (!ctx.reducedMotion) scene.cameras.main.shake(160, 0.006);
      if (Phaser.Math.Distance.Between(slamX, slamY, ctx.playerX, ctx.playerY) < radius) {
        ctx.hurtPlayer(Math.round(damage * 1.5));
      }
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// SKITTERER (cavecrawler) — fast and erratic. It dashes in bursts at odd angles
// rather than tracking smoothly, and periodically BURROWS, vanishing and
// re-emerging behind the player. The fantasy: a jittery, hard-to-pin target
// that keeps getting behind you — punishes players who don't keep moving.
// ---------------------------------------------------------------------------
function behaveSkitterer(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const scene = enemy.scene;
  const meleeRange = 40 + enemy.displayWidth * 0.16;

  if (state.phase === 'burrow') {
    // Underground: intangible-ish (we just hide + park), emerge behind player.
    if (ctx.time > state.until) {
      scratch.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY);
      if (scratch.lengthSq() < 1) scratch.set(1, 0);
      scratch.normalize();
      const emergeX = Phaser.Math.Clamp(ctx.playerX - scratch.x * 60, 40, 4860);
      const emergeY = Phaser.Math.Clamp(ctx.playerY - scratch.y * 60, 40, 2760);
      enemy.setPosition(emergeX, emergeY).setAlpha(1).setVisible(true);
      state.phase = 'dash';
      state.until = ctx.time + 220;
      toPlayer.set(ctx.playerX - emergeX, ctx.playerY - emergeY).normalize();
      body.setVelocity(toPlayer.x * speed * 2.2, toPlayer.y * speed * 2.2);
      if (scene && !ctx.lowQuality) {
        const dirt = scene.add.circle(emergeX, emergeY, 12, 0x8b7159, 0.55).setDepth(enemy.depth + 2);
        scene.tweens.add({ targets: dirt, scale: 2.2, alpha: 0, duration: 300, onComplete: () => dirt.destroy() });
      }
    } else {
      body.setVelocity(0, 0);
    }
    return true;
  }

  if (state.phase === 'dash') {
    // Committed erratic dash: hold velocity, then re-choose.
    if (ctx.time > state.until) state.phase = 'approach';
    if (distance < meleeRange) tryTouch(enemy, ctx, damage, 1.2);
    return true;
  }

  // Approach in stutter-dashes at a jittered angle, not a smooth line.
  if (ctx.time > state.until) {
    state.until = ctx.time + 260;
    const jitter = (Math.random() - 0.5) * 0.9; // radians of wobble off-axis
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
    const ang = Math.atan2(toPlayer.y, toPlayer.x) + jitter;
    body.setVelocity(Math.cos(ang) * speed * 1.6, Math.sin(ang) * speed * 1.6);
    faceTarget(enemy, ctx.playerX);
    playLoop(enemy, type, 'walk');
  }
  if (distance < meleeRange) tryTouch(enemy, ctx, damage, 1.1);

  // Burrow to reposition behind the player.
  if (ctx.time > state.nextSpecial && distance < 340 && distance > 60 && scene) {
    state.phase = 'burrow';
    state.until = ctx.time + 520;
    state.nextSpecial = ctx.time + 3000;
    playOnce(enemy, type, 'attack');
    enemy.setAlpha(0.15);
    body.setVelocity(0, 0);
    if (!ctx.lowQuality) {
      const dust = scene.add.circle(enemy.x, enemy.y, 12, 0x6f5a44, 0.5).setDepth(enemy.depth + 1);
      scene.tweens.add({ targets: dust, scale: 2, alpha: 0, duration: 320, onComplete: () => dust.destroy() });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// RANGED (ashborn) — THE archetype the game most lacked. Keeps its distance and
// lobs fire projectiles; when the player closes, it back-pedals to re-open the
// gap before firing again. A single ranged threat changes the whole spatial
// game: the player can no longer treat "far away" as "safe", and must choose
// between chasing the ashborn or dodging its shots while fighting melee mobs.
// The fantasy: a zoner that dictates the range of the fight.
// ---------------------------------------------------------------------------
function behaveRanged(
  enemy: Phaser.Physics.Arcade.Sprite,
  body: Phaser.Physics.Arcade.Body,
  ctx: AIContext,
  state: AIState,
  type: string,
  distance: number,
  speed: number,
  damage: number,
): boolean {
  const scene = enemy.scene;
  const preferredMin = 190; // too close → retreat
  const preferredMax = 330; // too far → advance
  const fireRange = 380;

  if (state.phase === 'cast') {
    // Rooted during the cast wind-up; the telegraph fires the projectile.
    body.setVelocity(0, 0);
    faceTarget(enemy, ctx.playerX);
    if (ctx.time > state.until) state.phase = 'approach';
    return true;
  }

  // Kiting movement: retreat if the player is inside preferredMin, close if
  // beyond preferredMax, otherwise strafe to keep a clean line of sight.
  if (distance < preferredMin) {
    toPlayer.set(enemy.x - ctx.playerX, enemy.y - ctx.playerY).normalize().scale(speed * 1.15);
    body.setVelocity(toPlayer.x, toPlayer.y);
    faceTarget(enemy, ctx.playerX);
    playLoop(enemy, type, 'walk');
  } else if (distance > preferredMax) {
    moveToward(enemy, body, ctx.playerX, ctx.playerY, speed, type);
    faceTarget(enemy, ctx.playerX);
  } else {
    // In the sweet spot: gentle strafe so it isn't a stationary turret.
    toPlayer.set(ctx.playerX - enemy.x, ctx.playerY - enemy.y);
    const d = toPlayer.length() || 1;
    toPlayer.scale(1 / d);
    perp.set(-toPlayer.y * state.orbitSign, toPlayer.x * state.orbitSign).scale(speed * 0.5);
    body.setVelocity(perp.x, perp.y);
    faceTarget(enemy, ctx.playerX);
    playLoop(enemy, type, 'walk');
  }

  // Fire a telegraphed fireball when in range and off cooldown.
  if (distance < fireRange && ctx.time > state.nextSpecial && scene) {
    state.phase = 'cast';
    const windup = 460;
    state.until = ctx.time + windup + 80;
    state.nextSpecial = ctx.time + (state.elite ? 1500 : 2100);
    playOnce(enemy, type, 'attack');
    faceTarget(enemy, ctx.playerX);
    // A charge glow at the caster that resolves into the shot.
    const originX = enemy.x;
    const originY = enemy.y;
    if (!ctx.lowQuality) {
      const charge = scene.add.circle(originX, originY - 4, 5, 0xff9d68, 0.6).setDepth(enemy.depth + 3);
      scene.tweens.add({ targets: charge, scale: 2.4, alpha: 0, duration: windup, onComplete: () => charge.destroy() });
    }
    scene.time.delayedCall(windup, () => {
      if (!enemy.active) return;
      // Aim at the player's position AT FIRE TIME (leading is unfair with a slow
      // lob — this way a moving player naturally dodges, rewarding movement).
      ctx.spawnProjectile({
        x: originX,
        y: originY - 6,
        targetX: ctx.playerX,
        targetY: ctx.playerY,
        damage: Math.round(damage * 1.1),
        speed: 260,
        kind: 'fire',
        source: enemy,
      });
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Touch-attack helper. Applies the scene's melee hit through the context (which
// respects the player's i-frames) on the enemy's own attack cadence, and plays
// the attack pose. `mult` scales the enemy's base damage for lunges/bashes.
// ---------------------------------------------------------------------------
function tryTouch(
  enemy: Phaser.Physics.Arcade.Sprite,
  ctx: AIContext,
  damage: number,
  mult: number,
): void {
  const last = Number(enemy.getData('lastAttack')) || 0;
  if (ctx.time < last + 850) return;
  enemy.setData('lastAttack', ctx.time);
  const type = String(enemy.getData('type'));
  playOnce(enemy, type, 'attack');
  ctx.hurtPlayer(Math.round(damage * mult));
}

/*
 * ===========================================================================
 * INTEGRATION NOTE — how WorldScene wires this in (no WorldScene edits by me).
 * ===========================================================================
 *
 * 1) IMPORT at the top of WorldScene.ts:
 *
 *      import { EnemyAI, type AIContext } from '../systems/combat/EnemyAI';
 *
 * 2) ELITE ROLL — in `spawnEnemy`, right after the existing `enemy.setData({...})`
 *    block and BEFORE creating the health bar (so the bar reads the buffed HP).
 *    Skip bosses; let night raise the elite rate via the lighting danger value:
 *
 *      if (spawn.type !== 'nameless' && spawn.type !== 'cinderlord') {
 *        EnemyAI.rollElite(enemy, { chanceMult: this.lighting?.getState().danger ?? 1 });
 *        const marker = EnemyAI.createEliteMarker(this, enemy);
 *        if (marker) enemy.setData('eliteMarker', marker);
 *      }
 *
 *    Then in `killEnemy`, destroy the marker next to the bar, and honour loot
 *    multiplier + keep the elite tint from being cleared as a hit-flash:
 *
 *      (enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined)?.destroy();
 *      const lootMult = Number(enemy.getData('lootMult')) || 1;   // multiply drop quantity
 *
 *    And in `updateEnemyBars`/`updateEnemies` the marker position can be synced:
 *
 *      const em = enemy.getData('eliteMarker') as Phaser.GameObjects.Text | undefined;
 *      if (em) em.setPosition(enemy.x, enemy.y - enemy.displayHeight * 0.62).setDepth(enemy.depth + 3);
 *
 * 3) DRIVE THE AI — replace the body of `updateEnemies`' per-enemy `if (distance
 *    < aggro) { ... } else { ... }` chase/tryEnemySpecial block with a single
 *    call. Build the context ONCE before the loop (reused each enemy):
 *
 *      const enemyList = this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
 *      const visibility = this.weather.profile().visibility;
 *      const danger = this.lighting.getState().danger;
 *      const reducedMotion = this.saves.get().settings.reducedMotion;
 *      const lowQuality = this.saves.get().settings.quality === 'low'
 *        || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700);
 *      const ctx: AIContext = {
 *        playerX: this.player.x, playerY: this.player.y,
 *        playerAlive: this.player.active,
 *        time, delta: _delta, visibility, danger, reducedMotion, lowQuality,
 *        hurtPlayer: (amount) => this.hurtPlayer(amount),
 *        spawnProjectile: (o) => this.spawnEnemyProjectile(o),   // small helper, see 5)
 *        spawnAdd: (t, x, y) => this.spawnEnemy({ type: t as keyof typeof ENEMIES, x, y, temporary: true }),
 *        enemies: enemyList,
 *      };
 *
 *    then inside the loop, after the renderDistance cull:
 *
 *      const inCombat = EnemyAI.update(enemy, ctx);
 *      if (inCombat) combat = true;
 *      enemy.setDepth(enemy.y / 10 + 12);
 *
 *    Boss sprites make EnemyAI.update return false and leave their body alone —
 *    BossFight drives them — so nothing else in updateEnemies needs to change.
 *
 * 4) SHIELD + INTANGIBILITY in `damageEnemy` (very top, before applying damage):
 *
 *      if (EnemyAI.isIntangible(enemy)) return;   // wraith mid-blink is immune
 *      damage = EnemyAI.mitigateDamage(enemy, damage, this.player.x, this.player.y);
 *
 *    (Do the same isIntangible guard in the projectile overlap in setupPhysics.)
 *
 * 5) ENEMY PROJECTILES — the scene needs a small spawner + an overlap vs the
 *    player. Add an `enemyProjectiles` group in create() and:
 *
 *      private spawnEnemyProjectile(o: EnemyProjectileRequest): void {
 *        const tex = o.kind === 'fire' ? 'projectile-magic' : 'projectile-bolt';
 *        const p = this.physics.add.sprite(o.x, o.y, tex).setScale(1.7).setDepth(920);
 *        const ang = Math.atan2(o.targetY - o.y, o.targetX - o.x);
 *        p.setRotation(ang).setVelocity(Math.cos(ang) * o.speed, Math.sin(ang) * o.speed);
 *        p.setData('damage', o.damage); p.setData('ttl', 2600);
 *        if (o.kind === 'fire') p.setTint(0xff8a4c);
 *        this.enemyProjectiles.add(p);
 *        this.sfx.attack('magic');
 *      }
 *
 *      // in setupPhysics:
 *      this.physics.add.overlap(this.enemyProjectiles, this.player, (pObj) => {
 *        const p = pObj as Phaser.Physics.Arcade.Sprite;
 *        this.hurtPlayer(Number(p.getData('damage')) || 10);
 *        p.destroy();
 *      });
 *      this.physics.add.collider(this.enemyProjectiles, this.solids, (p) => p.destroy());
 *
 *      // in updateProjectiles: tick down enemyProjectiles ttl the same way.
 *
 * That's the whole surface: an import, an elite roll in spawn, one call in the
 * enemy loop, two one-liners in damageEnemy, and a small enemy-projectile path.
 * ===========================================================================
 */
