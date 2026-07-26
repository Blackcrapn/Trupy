/**
 * SmokeBomb — the reusable effect behind the `smoke_bomb` consumable.
 *
 * WHY THIS EXISTS
 * ---------------
 * The item (`отпугивает врагов рядом и даёт передышку`) had a description and a
 * crafting recipe but no implementation: `InventorySystem.use` returned
 * `effect: 'smoke'` and WorldScene only drew a single fading circle and shoved
 * nearby enemies once. There was nothing that made the smoke a *tactic* — no
 * lingering cover, no loss of aggro. This module makes the bomb do what the text
 * promises, and does it identically for both the world and interiors so the two
 * scenes never drift.
 *
 * WHAT IT DOES
 * ------------
 *  - Visual: an expanding cloud of grey particles that blooms out, hangs for
 *    ~4 seconds, then fades. Particle counts scale down for reduced-motion and
 *    low-quality so it stays cheap on weak hardware / accessibility settings.
 *  - Effect: every enemy within `radius` is pushed away from the blast, loses
 *    aggro (dropped to idle via EnemyAI.blind), and — crucially — cannot
 *    re-detect the player for as long as the cloud lingers. Enemies that walk
 *    into the cloud while it is still active are also blinded, so the smoke is a
 *    genuine screen of cover, not a one-frame shove.
 *
 * DESIGN CONTRACT WITH THE SCENES
 * -------------------------------
 * Like EnemyAI, this file never reaches into a scene's private state. The caller
 * hands it a scene, an origin, the live enemy list and the player's settings; it
 * owns the particle/tween lifetime and asks EnemyAI to do the AI-side work. Both
 * WorldScene and InteriorScene can call it — interiors have no persistent enemies
 * today, so there `enemies` is simply empty and only the visual plays, which is
 * still the right feedback for "you used a smoke bomb indoors".
 *
 * See the INTEGRATION NOTE at the bottom for the exact WorldScene call site.
 */

import Phaser from 'phaser';
import { EnemyAI } from './EnemyAI';

export interface SmokeBombOptions {
  /** Blast origin, world space (usually the player's position). */
  x: number;
  y: number;
  /** Enemies that may be caught in the cloud. Pass the scene's live enemy list. */
  enemies?: Phaser.Physics.Arcade.Sprite[];
  /** save.settings.reducedMotion — trims particle count and motion. */
  reducedMotion?: boolean;
  /** true when quality==='low' (or auto+small) — trims particle count. */
  lowQuality?: boolean;
  /**
   * How long the cloud lingers and blinds, in ms. Defaults to 4000 (~4s) to
   * match the "даёт передышку" (buys a breather) promise.
   */
  durationMs?: number;
  /** Cloud radius in world pixels. Defaults to 190. */
  radius?: number;
  /** Depth to draw the cloud at. Defaults just above typical actors. */
  depth?: number;
}

/** Tunables shared by every detonation. */
const DEFAULT_DURATION = 4000;
const DEFAULT_RADIUS = 190;
const PUSH_SPEED = 300;
/** Grey palette for the cloud — cool smoke, not warm fire. */
const SMOKE_TINTS = [0x8b8791, 0x6f6b78, 0xa9a5b0, 0x565360];

/**
 * Detonate a smoke bomb at (x, y).
 *
 * Returns the number of enemies caught, so a caller can vary its feedback (e.g.
 * a different toast when the smoke actually broke a fight). Safe to call with no
 * enemies — the cloud still plays.
 */
export function detonateSmokeBomb(scene: Phaser.Scene, options: SmokeBombOptions): number {
  const {
    x,
    y,
    enemies = [],
    reducedMotion = false,
    lowQuality = false,
    durationMs = DEFAULT_DURATION,
    radius = DEFAULT_RADIUS,
    depth = 900,
  } = options;

  // --- AI effect: push out, blind, and keep blinding for the cloud's lifetime.
  let caught = 0;
  const affect = (enemy: Phaser.Physics.Arcade.Sprite): void => {
    if (!enemy.active) return;
    if (Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) > radius) return;
    caught += 1;
    // Shove away from the blast so the player gets breathing room.
    const push = new Phaser.Math.Vector2(enemy.x - x, enemy.y - y);
    if (push.lengthSq() < 0.01) push.set(Math.random() - 0.5, Math.random() - 0.5);
    push.normalize();
    enemy.setVelocity(push.x * PUSH_SPEED, push.y * PUSH_SPEED);
    // Drop aggro and prevent re-detection for the whole lingering window.
    EnemyAI.blind(enemy, durationMs);
  };
  for (const enemy of enemies) affect(enemy);

  // Re-apply blindness periodically so enemies wandering *into* the cloud while
  // it lingers are also caught — the smoke is cover, not a single pulse. Cheap:
  // a few ticks over the lifetime, each a short distance check per enemy.
  if (enemies.length) {
    const reblindEvery = 500;
    const ticks = Math.max(1, Math.floor(durationMs / reblindEvery) - 1);
    for (let index = 1; index <= ticks; index += 1) {
      scene.time.delayedCall(index * reblindEvery, () => {
        for (const enemy of enemies) {
          if (!enemy.active) continue;
          if (Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) > radius) continue;
          // Top up the blind timer to at least cover the rest of the cloud.
          EnemyAI.blind(enemy, durationMs - index * reblindEvery);
        }
      });
    }
  }

  // --- Visual: an expanding, lingering, fading cloud of grey puffs.
  // Particle budget scales with the accessibility / quality settings.
  const puffCount = reducedMotion ? 8 : lowQuality ? 12 : 26;
  const fadeIn = reducedMotion ? 120 : 260;
  // The cloud should sit (linger) most of its life, then fade out at the end.
  const lingerAlpha = reducedMotion ? 0.32 : 0.44;
  const fadeOut = Math.max(500, Math.round(durationMs * 0.4));

  // A soft base disc gives the cloud body under the puffs.
  const base = scene.add.circle(x, y, radius * 0.34, 0x6f6b78, 0)
    .setDepth(depth - 1)
    .setBlendMode(Phaser.BlendModes.NORMAL);
  scene.tweens.add({
    targets: base,
    radius: radius * 0.92,
    fillAlpha: lingerAlpha * 0.6,
    duration: fadeIn,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: base,
        fillAlpha: 0,
        radius: radius,
        delay: Math.max(0, durationMs - fadeIn - fadeOut),
        duration: fadeOut,
        onComplete: () => base.destroy(),
      });
    },
  });

  for (let index = 0; index < puffCount; index += 1) {
    const angle = (index / puffCount) * Math.PI * 2 + Math.random() * 0.6;
    const spread = radius * (0.35 + Math.random() * 0.6);
    const targetX = x + Math.cos(angle) * spread;
    const targetY = y + Math.sin(angle) * spread * 0.8;
    const tint = SMOKE_TINTS[index % SMOKE_TINTS.length];
    const puff = scene.add.image(x, y, 'pixel')
      .setTint(tint)
      .setAlpha(0)
      .setDepth(depth)
      .setScale(Phaser.Math.FloatBetween(3, 6));
    // Bloom out and up a touch, hold, then dissipate. Reduced motion keeps the
    // puffs nearly in place (information over spectacle).
    const driftX = reducedMotion ? targetX : targetX + Phaser.Math.Between(-14, 14);
    const driftY = reducedMotion ? targetY : targetY - Phaser.Math.Between(4, 22);
    scene.tweens.add({
      targets: puff,
      x: driftX,
      y: driftY,
      alpha: lingerAlpha,
      scale: Phaser.Math.FloatBetween(7, 13),
      duration: fadeIn + Phaser.Math.Between(0, 180),
      ease: 'Quad.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: puff,
          alpha: 0,
          y: reducedMotion ? puff.y : puff.y - Phaser.Math.Between(10, 30),
          scale: puff.scaleX * 1.35,
          delay: Math.max(0, durationMs - fadeIn - fadeOut) + Phaser.Math.Between(0, 200),
          duration: fadeOut,
          onComplete: () => puff.destroy(),
        });
      },
    });
  }

  return caught;
}

/*
 * ===========================================================================
 * INTEGRATION NOTE — WorldScene call site (no WorldScene edits by me).
 * ===========================================================================
 *
 * WorldScene already routes the consumable through `useInventoryItem`, whose
 * `result.effect === 'smoke'` branch currently hand-rolls a one-off circle and a
 * single shove. Replace the BODY of that `else if (result.effect === 'smoke')`
 * branch with a call into this module so the world gets the lingering,
 * aggro-dropping cloud:
 *
 *   1) IMPORT at the top of WorldScene.ts, next to the other combat imports:
 *
 *        import { detonateSmokeBomb } from '../systems/combat/SmokeBomb';
 *
 *   2) In `useInventoryItem`, swap the smoke branch for:
 *
 *        } else if (result.effect === 'smoke') {
 *          const settings = this.saves.get().settings;
 *          const lowQuality = settings.quality === 'low'
 *            || (settings.quality === 'auto' && this.scale.width < 700);
 *          detonateSmokeBomb(this, {
 *            x: this.player.x,
 *            y: this.player.y,
 *            enemies: this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[],
 *            reducedMotion: settings.reducedMotion,
 *            lowQuality,
 *            depth: this.player.depth + 2,
 *          });
 *          this.sfx.special('magic');            // a soft "whoomph"; optional
 *          this.lighting.flash(this.player.x, this.player.y, 120, 0x8b8791, 320);
 *        }
 *
 * That's the whole surface: one import and the swapped branch. The blindness is
 * driven entirely through EnemyAI.blind, which WorldScene's existing
 * `EnemyAI.update` call in `updateEnemies` already honours (it forces detection
 * to fail while the timer is live), so no change to the enemy loop is needed.
 * ===========================================================================
 */
