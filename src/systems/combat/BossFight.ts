/**
 * BossFight — multi-phase boss choreography for Trupy's two bosses.
 *
 * WHY THIS EXISTS
 * ---------------
 * The two bosses used to differ from a common mook only in a bigger HP bar and a
 * single telegraphed slam, so "boss" meant "the same fight, but longer". A boss
 * should instead be a *conversation that escalates*: it opens readable, teaches
 * you its tells, then — as you win — changes the question it's asking. This module
 * turns each boss into a scripted, phased encounter with distinct attack sets per
 * phase, hard phase-transition beats (invulnerable pause, roar, shake, light
 * bloom), and a phase indicator the health bar can show.
 *
 * FAIRNESS FIRST
 * --------------
 * Every dangerous attack is telegraphed: a ground ring or a travelling warning
 * fills for a wind-up before anything can hurt the player. A boss hit should
 * always be "I read that wrong / I dodged late", never "where did that come
 * from". The telegraph windows widen slightly on lower-skill-friendly settings
 * implicitly (reduced motion keeps the ring but drops the shake), and every
 * effect scales down on low quality / reduced motion for performance and comfort.
 *
 * CONTRACT WITH WorldScene
 * ------------------------
 * WorldScene constructs one of these when a boss activates, then calls:
 *   - update(time, delta)   every enemy tick, to run the state machine,
 *   - onDamaged(hp)         after it applies damage, so phases can trigger,
 *   - destroy()             on boss death / scene shutdown, to clean up.
 * All privileged actions (hurt the player, spawn adds/projectiles, drive the
 * boss body) go through the BossContext callbacks, so BossFight never reaches
 * into WorldScene internals. It moves the boss sprite directly (the scene's
 * updateEnemies leaves boss bodies alone once EnemyAI returns false for them).
 *
 * PERFORMANCE
 * -----------
 * One instance per boss (so at most two ever). Vector maths uses module scratch
 * vectors; the state machine is a switch on a string. Projectile/ember visuals
 * are pooled by Phaser's tween/timer systems and self-destroy.
 */

import Phaser from 'phaser';

/** Which boss this fight drives — selects the whole script. */
export type BossKind = 'nameless' | 'cinderlord';

/**
 * Privileged actions BossFight requests but WorldScene performs, plus the live
 * world reads it needs. Built once by the scene and handed to the constructor;
 * the callbacks close over the scene.
 */
export interface BossContext {
  /** Deal `amount` (pre-armour) to the player; respects the scene i-frame gate. */
  hurtPlayer: (amount: number) => void;
  /** Spawn an add of `type` near (x,y). Used by the nameless summon phase. */
  spawnAdd: (type: string, x: number, y: number) => void;
  /**
   * Spawn a boss projectile from (x,y) toward (tx,ty). Reuses the scene's enemy
   * projectile path so hits, ttl and cleanup are handled in one place.
   */
  spawnProjectile: (opts: BossProjectileRequest) => void;
  /** Live player position. */
  playerX: () => number;
  playerY: () => number;
  /** Whether the player can be hit right now. */
  playerAlive: () => boolean;
  /** save.settings.reducedMotion. */
  reducedMotion: boolean;
  /** quality low (or auto+small): scale effect counts down. */
  lowQuality: boolean;
  /**
   * Called whenever the phase changes, with 1-based phase index and total, so
   * the health bar can show pips / a phase label. Optional.
   */
  onPhase?: (phase: number, total: number) => void;
  /**
   * Toggle the boss's damageable state. WorldScene reads this (or BossFight sets
   * a data flag) so the invulnerable transition pause actually blocks damage.
   */
  setInvulnerable?: (value: boolean) => void;
}

export interface BossProjectileRequest {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  damage: number;
  speed: number;
  kind: 'fire' | 'shadow';
}

// ---------------------------------------------------------------------------
// Module scratch — no per-tick allocation.
// ---------------------------------------------------------------------------
const toPlayer = new Phaser.Math.Vector2();
const move = new Phaser.Math.Vector2();

/** Arena clamp so teleports/positions never leave the world. */
const ARENA = { minX: 40, maxX: 4860, minY: 40, maxY: 2760 };

export class BossFight {
  private readonly scene: Phaser.Scene;
  private readonly boss: Phaser.Physics.Arcade.Sprite;
  private readonly ctx: BossContext;
  private readonly kind: BossKind;
  private readonly maxHealth: number;
  private readonly type: string;

  /** 1-based current phase. */
  private phase = 1;
  private readonly totalPhases = 3;
  /** Fractional HP thresholds that trigger the next phase (descending). */
  private readonly phaseThresholds: number[];
  /** Current action within the phase's rotation. */
  private action = 'idle';
  /** When the current action/cooldown ends (absolute ms). */
  private actionUntil = 0;
  /** Next time an attack may begin. */
  private nextAttack = 0;
  /** Transition lock: boss is invulnerable + inert until this time. */
  private transitionUntil = 0;
  /** Rotating index so attacks cycle rather than repeat randomly. */
  private rotation = 0;
  /** Timers/tweens we own, cleared on destroy to avoid leaks after death. */
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    boss: Phaser.Physics.Arcade.Sprite,
    kind: BossKind,
    ctx: BossContext,
  ) {
    this.scene = scene;
    this.boss = boss;
    this.kind = kind;
    this.ctx = ctx;
    this.type = String(boss.getData('type'));
    this.maxHealth = Number(boss.getData('maxHealth')) || (kind === 'cinderlord' ? 760 : 460);
    // Phase gates per the design brief:
    //   nameless  → 100 / 60 / 30 %  (thresholds crossed at 60% and 30%)
    //   cinderlord→ 100 / 65 / 35 %  (thresholds crossed at 65% and 35%)
    this.phaseThresholds = kind === 'cinderlord' ? [0.65, 0.35] : [0.6, 0.3];
    boss.setData('bossPhase', 1);
    boss.setData('bossInvulnerable', false);
    this.nextAttack = scene.time.now + 900; // a breath before the first attack
    this.ctx.onPhase?.(1, this.totalPhases);
  }

  /** Current 1-based phase, for the health-bar indicator. */
  getPhase(): number {
    return this.phase;
  }

  getTotalPhases(): number {
    return this.totalPhases;
  }

  /**
   * Called after WorldScene applies damage. Drives phase transitions off the
   * boss's current HP. Kept off the render path so it only runs on real hits.
   */
  onDamaged(hp: number): void {
    if (this.destroyed) return;
    const frac = hp / this.maxHealth;
    const nextIndex = this.phase - 1; // threshold to cross to reach phase+1
    if (nextIndex < this.phaseThresholds.length && frac <= this.phaseThresholds[nextIndex]) {
      this.enterPhase(this.phase + 1);
    }
  }

  /** Per-tick brain. `delta` is the scene's enemy-tick delta (~72ms). */
  update(time: number, delta: number): void {
    if (this.destroyed) return;
    const body = this.boss.body as Phaser.Physics.Arcade.Body | null;
    if (!body || !this.boss.active) return;

    // Transition pause: invulnerable, inert, glaring. Nothing else runs.
    if (time < this.transitionUntil) {
      body.setVelocity(0, 0);
      return;
    }

    if (this.kind === 'nameless') this.updateNameless(time, delta, body);
    else this.updateCinderlord(time, delta, body);
  }

  /** Clean up all owned timers/state. Call on boss death and scene shutdown. */
  destroy(): void {
    this.destroyed = true;
    for (const timer of this.timers) timer.remove(false);
    this.timers.length = 0;
    this.ctx.setInvulnerable?.(false);
    if (this.boss.active) this.boss.setData('bossInvulnerable', false);
  }

  // -------------------------------------------------------------------------
  // Phase transition — the "moment": invulnerable pause, roar (audio is the
  // scene's; we do the visible + tactile part), screen shake, light-ish flash
  // via an expanding ring, then resume harder. This beat is what sells that the
  // fight just changed gears.
  // -------------------------------------------------------------------------
  private enterPhase(phase: number): void {
    if (phase > this.totalPhases || phase <= this.phase) return;
    this.phase = phase;
    this.boss.setData('bossPhase', phase);
    this.action = 'idle';
    this.rotation = 0;
    const pauseMs = 1100;
    this.transitionUntil = this.scene.time.now + pauseMs;
    this.nextAttack = this.transitionUntil + 300;
    this.setInvulnerable(true);

    const color = this.kind === 'cinderlord' ? 0xff7a3c : 0xc85182;
    const body = this.boss.body as Phaser.Physics.Arcade.Body | null;
    body?.setVelocity(0, 0);

    // Visible burst: a shockwave ring + a hard tint pulse. Scaled by settings.
    if (!this.ctx.lowQuality) {
      const ring = this.scene.add
        .circle(this.boss.x, this.boss.y, 60, color, 0.35)
        .setDepth(this.boss.depth - 1);
      this.scene.tweens.add({
        targets: ring,
        radius: 320,
        alpha: 0,
        duration: 900,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
    this.boss.setTintFill(color);
    this.scene.time.delayedCall(220, () => {
      if (this.boss.active) this.boss.clearTint();
    });
    if (!this.ctx.reducedMotion) {
      this.scene.cameras.main.shake(pauseMs * 0.5, 0.01);
      this.scene.cameras.main.flash(160, (color >> 16) & 255, (color >> 8) & 255, color & 255);
    }
    // A brief pulse of the boss growing then settling — reads as "drawing power".
    this.scene.tweens.add({
      targets: this.boss,
      scaleX: this.boss.scaleX * 1.12,
      scaleY: this.boss.scaleY * 1.12,
      duration: 260,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // Drop invulnerability when the pause ends.
    this.scene.time.delayedCall(pauseMs, () => {
      if (!this.destroyed) this.setInvulnerable(false);
    });

    this.ctx.onPhase?.(phase, this.totalPhases);
  }

  private setInvulnerable(value: boolean): void {
    this.boss.setData('bossInvulnerable', value);
    this.ctx.setInvulnerable?.(value);
  }

  // =========================================================================
  // БЕЗЫМЯННАЯ (nameless) — an elegant four-armed horror. A duel that grows
  // frantic. 460 HP, phases at 100 / 60 / 30 %.
  //   Phase 1: measured, telegraphed reach attacks (long four-arm sweeps).
  //   Phase 2: summons wraith adds and blinks around the arena.
  //   Phase 3: desperate — fast, chained multi-strike combos, little downtime.
  // =========================================================================
  private updateNameless(time: number, _delta: number, body: Phaser.Physics.Arcade.Body): void {
    const px = this.ctx.playerX();
    const py = this.ctx.playerY();
    const speed = Number(this.boss.getData('speed')) || 64;

    // Resolve an in-progress action first.
    if (this.action !== 'idle') {
      if (time > this.actionUntil) this.action = 'idle';
      else {
        // While mid-action the boss is committed (rooted), except the phase-3
        // combo which walks between strikes for a stalking feel.
        if (this.action === 'combo') {
          this.stepToward(body, px, py, speed * 1.15);
        } else {
          body.setVelocity(0, 0);
        }
        this.faceTarget(px);
        return;
      }
    }

    const distance = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, px, py);

    // Movement between attacks: glide toward the player at phase-scaled speed.
    const phaseSpeed = speed * (this.phase === 3 ? 1.5 : this.phase === 2 ? 1.15 : 1);
    if (distance > 70) this.stepToward(body, px, py, phaseSpeed);
    else body.setVelocity(0, 0);
    this.faceTarget(px);
    this.playLoop(distance > 70 ? 'walk' : 'idle');

    if (time < this.nextAttack) return;

    // Choose an attack from the current phase's rotation.
    if (this.phase === 1) {
      this.namelessReachSweep(time, px, py);
    } else if (this.phase === 2) {
      // Alternate: summon, then blink-strike, then reach sweep.
      const pick = this.rotation % 3;
      this.rotation += 1;
      if (pick === 0) this.namelessSummon(time);
      else if (pick === 1) this.namelessBlinkStrike(time, px, py);
      else this.namelessReachSweep(time, px, py);
    } else {
      // Phase 3: mostly the fast combo, occasionally a blink to reposition.
      if (this.rotation % 4 === 3) this.namelessBlinkStrike(time, px, py);
      else this.namelessCombo(time, px, py);
      this.rotation += 1;
    }
  }

  /**
   * Phase-1 signature: a long four-arm reach. A wide arc telegraph in front of
   * the boss fills, then sweeps — being anywhere in the arc at the strike is a
   * hit. Teaches the player to respect the boss's reach and to get to its side.
   */
  private namelessReachSweep(time: number, px: number, py: number): void {
    this.action = 'reach';
    const windup = this.phase === 3 ? 360 : 560;
    this.actionUntil = time + windup + 200;
    this.nextAttack = time + windup + (this.phase === 1 ? 1500 : 1000);
    this.playOnce('attack');
    this.faceTarget(px);
    // The reach lands in a forward arc; represent it as a ring centred a bit in
    // front of the boss toward the player, radius = reach.
    toPlayer.set(px - this.boss.x, py - this.boss.y);
    if (toPlayer.lengthSq() < 1) toPlayer.set(1, 0);
    toPlayer.normalize();
    const reach = 120;
    const cx = this.boss.x + toPlayer.x * reach * 0.6;
    const cy = this.boss.y + toPlayer.y * reach * 0.6;
    this.telegraph(cx, cy, reach, 0xc85182, windup, () => {
      if (Phaser.Math.Distance.Between(cx, cy, this.ctx.playerX(), this.ctx.playerY()) < reach) {
        this.ctx.hurtPlayer(Number(this.boss.getData('damage')) || 22);
      }
      // A sweep arc flourish.
      if (!this.ctx.lowQuality) {
        const arc = this.scene.add.circle(cx, cy, reach * 0.5, 0xa64d8c, 0.4).setDepth(this.boss.depth + 1);
        this.scene.tweens.add({ targets: arc, radius: reach, alpha: 0, duration: 260, onComplete: () => arc.destroy() });
      }
    });
  }

  /**
   * Phase-2: summon two wraith adds at the arena edges, then a short recovery.
   * Adds pressure the player must split attention to — the boss stops being a
   * pure 1v1 and forces target priority.
   */
  private namelessSummon(time: number): void {
    this.action = 'summon';
    this.actionUntil = time + 900;
    this.nextAttack = time + 2600;
    this.playOnce('attack');
    const count = this.phase === 3 ? 3 : 2;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 160;
      const sx = Phaser.Math.Clamp(this.boss.x + Math.cos(angle) * radius, ARENA.minX, ARENA.maxX);
      const sy = Phaser.Math.Clamp(this.boss.y + Math.sin(angle) * radius, ARENA.minY, ARENA.maxY);
      // A gather-in telegraph so the add "coalesces" rather than popping in.
      this.telegraph(sx, sy, 40, 0x8d63c4, 620, () => {
        if (!this.destroyed) this.ctx.spawnAdd('wraith', sx, sy);
      });
    }
  }

  /**
   * Phase-2/3: blink to a flank of the player and immediately threaten a strike.
   * A departure wisp, a short intangible gap, then reappear beside them with a
   * telegraphed jab — punishes standing still, keeps the duel mobile.
   */
  private namelessBlinkStrike(time: number, px: number, py: number): void {
    this.action = 'blink';
    this.actionUntil = time + 520;
    this.nextAttack = time + 1200;
    // Depart.
    if (!this.ctx.lowQuality) {
      const wisp = this.scene.add.circle(this.boss.x, this.boss.y, 22, 0x8d63c4, 0.4).setDepth(this.boss.depth + 2);
      this.scene.tweens.add({ targets: wisp, scale: 2.2, alpha: 0, duration: 260, onComplete: () => wisp.destroy() });
    }
    // Destination: a flank of the player (perpendicular offset), clamped.
    toPlayer.set(px - this.boss.x, py - this.boss.y);
    if (toPlayer.lengthSq() < 1) toPlayer.set(1, 0);
    toPlayer.normalize();
    const side = Math.random() < 0.5 ? 1 : -1;
    const destX = Phaser.Math.Clamp(px - toPlayer.y * 90 * side, ARENA.minX, ARENA.maxX);
    const destY = Phaser.Math.Clamp(py + toPlayer.x * 90 * side, ARENA.minY, ARENA.maxY);
    this.setInvulnerable(true);
    const arriveMs = 240;
    this.timers.push(
      this.scene.time.delayedCall(arriveMs, () => {
        if (this.destroyed || !this.boss.active) return;
        this.boss.setPosition(destX, destY);
        this.setInvulnerable(false);
        this.playOnce('attack');
        this.faceTarget(this.ctx.playerX());
        if (!this.ctx.lowQuality) {
          const pop = this.scene.add.circle(destX, destY, 16, 0xa64d8c, 0.45).setDepth(this.boss.depth + 2);
          this.scene.tweens.add({ targets: pop, scale: 2.2, alpha: 0, duration: 240, onComplete: () => pop.destroy() });
        }
        // Telegraphed jab at the landing.
        this.telegraph(destX, destY, 90, 0xc85182, 320, () => {
          if (Phaser.Math.Distance.Between(destX, destY, this.ctx.playerX(), this.ctx.playerY()) < 100) {
            this.ctx.hurtPlayer(Math.round((Number(this.boss.getData('damage')) || 22) * 1.15));
          }
        });
      }),
    );
  }

  /**
   * Phase-3 desperation: a fast chain of three telegraphed strikes with barely a
   * beat between them. Each is individually dodgeable, but together they demand
   * clean, committed dodges — the climax of the duel.
   */
  private namelessCombo(time: number, _px: number, _py: number): void {
    this.action = 'combo';
    const strikes = 3;
    const gap = 300;
    this.actionUntil = time + strikes * gap + 260;
    this.nextAttack = this.actionUntil + 500;
    this.playOnce('attack');
    for (let i = 0; i < strikes; i += 1) {
      this.timers.push(
        this.scene.time.delayedCall(i * gap, () => {
          if (this.destroyed || !this.boss.active) return;
          const tx = this.ctx.playerX();
          const ty = this.ctx.playerY();
          this.playOnce('attack');
          this.telegraph(tx, ty, 70, 0xc85182, 200, () => {
            if (Phaser.Math.Distance.Between(tx, ty, this.ctx.playerX(), this.ctx.playerY()) < 78) {
              this.ctx.hurtPlayer(Math.round((Number(this.boss.getData('damage')) || 22) * 0.85));
            }
          });
        }),
      );
    }
  }

  // =========================================================================
  // ВЛАДЫКА УГЛЕЙ (cinderlord) — an armoured fire-lord. Bulk and area denial.
  // 760 HP, phases at 100 / 65 / 35 %.
  //   Phase 1: slow heavy slams that leave burning ground (a lingering hazard).
  //   Phase 2: fire-wave projectile patterns the player must dodge THROUGH.
  //   Phase 3: arena-wide ember rain + enrage speed — sustained pressure.
  // =========================================================================
  private updateCinderlord(time: number, _delta: number, body: Phaser.Physics.Arcade.Body): void {
    const px = this.ctx.playerX();
    const py = this.ctx.playerY();
    const speed = Number(this.boss.getData('speed')) || 70;

    if (this.action !== 'idle') {
      if (time > this.actionUntil) this.action = 'idle';
      else {
        body.setVelocity(0, 0); // the cinderlord roots to attack — it's a slab
        this.faceTarget(px);
        return;
      }
    }

    const distance = Phaser.Math.Distance.Between(this.boss.x, this.boss.y, px, py);
    const phaseSpeed = speed * (this.phase === 3 ? 1.55 : this.phase === 2 ? 1.1 : 0.85);
    if (distance > 90) this.stepToward(body, px, py, phaseSpeed);
    else body.setVelocity(0, 0);
    this.faceTarget(px);
    this.playLoop(distance > 90 ? 'walk' : 'idle');

    if (time < this.nextAttack) return;

    if (this.phase === 1) {
      this.cinderSlam(time, px, py);
    } else if (this.phase === 2) {
      // Alternate fire-wave fans with the occasional slam to keep melee honest.
      if (this.rotation % 3 === 2) this.cinderSlam(time, px, py);
      else this.cinderFireWave(time, px, py);
      this.rotation += 1;
    } else {
      // Phase 3: ember rain is the spine; a fire-wave now and then adds a lane
      // to thread while dodging the rain.
      if (this.rotation % 3 === 1) this.cinderFireWave(time, px, py);
      else this.cinderEmberRain(time);
      this.rotation += 1;
    }
  }

  /**
   * Phase-1: a heavy overhead slam. Wide ground-ring telegraph; on impact it
   * both hits and leaves a patch of burning ground that ticks damage for a few
   * seconds, denying that spot. Slow enough to dodge, punishing to ignore.
   */
  private cinderSlam(time: number, px: number, py: number): void {
    this.action = 'slam';
    const windup = this.phase === 3 ? 460 : 700;
    this.actionUntil = time + windup + 220;
    this.nextAttack = time + windup + 900;
    this.playOnce('attack');
    this.faceTarget(px);
    const radius = 150;
    // Slam lands where the player IS at cast (with the wind-up they can leave).
    const sx = px;
    const sy = py;
    this.telegraph(sx, sy, radius, 0xff7a3c, windup, () => {
      const wave = this.scene.add.circle(sx, sy, 30, 0xf05b39, 0.6).setDepth(this.boss.depth + 1);
      this.scene.tweens.add({ targets: wave, radius: radius + 20, alpha: 0, duration: 340, onComplete: () => wave.destroy() });
      if (!this.ctx.reducedMotion) this.scene.cameras.main.shake(180, 0.008);
      if (Phaser.Math.Distance.Between(sx, sy, this.ctx.playerX(), this.ctx.playerY()) < radius) {
        this.ctx.hurtPlayer(Number(this.boss.getData('damage')) || 30);
      }
      this.spawnBurningGround(sx, sy, radius * 0.7);
    });
  }

  /**
   * A patch of burning ground: a visible fire zone that ticks damage while the
   * player stands in it, for ~3.5s. Area denial that reshapes the safe space.
   */
  private spawnBurningGround(x: number, y: number, radius: number): void {
    const zone = this.scene.add
      .circle(x, y, radius, 0xff6a2a, this.ctx.reducedMotion ? 0.16 : 0.24)
      .setDepth(this.boss.depth - 2);
    this.scene.tweens.add({ targets: zone, alpha: 0, duration: 3500, onComplete: () => zone.destroy() });
    const ticks = 7;
    const dmg = Math.round((Number(this.boss.getData('damage')) || 30) * 0.35);
    for (let i = 1; i <= ticks; i += 1) {
      this.timers.push(
        this.scene.time.delayedCall(i * 500, () => {
          if (this.destroyed) return;
          if (Phaser.Math.Distance.Between(x, y, this.ctx.playerX(), this.ctx.playerY()) < radius) {
            this.ctx.hurtPlayer(dmg);
          }
        }),
      );
    }
  }

  /**
   * Phase-2 signature: a fan of fire projectiles with a GAP the player dodges
   * through. Rather than an unavoidable wall, it's a readable pattern — several
   * bolts in an arc with one lane left open, so the player is rewarded for
   * reading the spread and moving into the gap.
   */
  private cinderFireWave(time: number, px: number, py: number): void {
    this.action = 'firewave';
    const windup = 420;
    this.actionUntil = time + windup + 260;
    this.nextAttack = time + windup + 800;
    this.playOnce('attack');
    this.faceTarget(px);
    const originX = this.boss.x;
    const originY = this.boss.y;
    toPlayer.set(px - originX, py - originY);
    const baseAngle = Math.atan2(toPlayer.y, toPlayer.x);
    const bolts = this.phase === 3 ? 7 : 5;
    const spread = 0.9; // total fan width in radians
    const gapIndex = Phaser.Math.Between(0, bolts - 1); // the lane to leave open
    // A faint aim line so the fan is telegraphed before it fires.
    if (!this.ctx.lowQuality) {
      const aim = this.scene.add
        .line(0, 0, originX, originY, px, py, 0xff7a3c, 0.4)
        .setOrigin(0)
        .setLineWidth(3)
        .setDepth(878);
      this.scene.tweens.add({ targets: aim, alpha: 0, duration: windup, onComplete: () => aim.destroy() });
    }
    this.timers.push(
      this.scene.time.delayedCall(windup, () => {
        if (this.destroyed || !this.boss.active) return;
        for (let i = 0; i < bolts; i += 1) {
          if (i === gapIndex) continue; // leave the dodge lane
          // Fan the bolts evenly across the spread, centred on the aim line.
          const t = i / (bolts - 1) - 0.5;
          const ang = baseAngle + t * spread;
          const reach = 500;
          this.ctx.spawnProjectile({
            x: originX,
            y: originY - 6,
            targetX: originX + Math.cos(ang) * reach,
            targetY: originY + Math.sin(ang) * reach,
            damage: Math.round((Number(this.boss.getData('damage')) || 30) * 0.6),
            speed: 300,
            kind: 'fire',
          });
        }
      }),
    );
  }

  /**
   * Phase-3: arena-wide ember rain. A sequence of telegraphed strike-markers
   * rains across the area around the player; each shows a small ring before it
   * lands. Sustained, spreads the player out, and combined with enrage speed
   * makes the finish genuinely frantic — but every single ember is dodgeable.
   */
  private cinderEmberRain(time: number): void {
    this.action = 'emberrain';
    const duration = 2600;
    this.actionUntil = time + duration + 200;
    this.nextAttack = time + duration + 700;
    this.playOnce('attack');
    const drops = this.ctx.lowQuality ? 8 : 14;
    const dmg = Math.round((Number(this.boss.getData('damage')) || 30) * 0.5);
    for (let i = 0; i < drops; i += 1) {
      const at = (i / drops) * duration;
      this.timers.push(
        this.scene.time.delayedCall(at, () => {
          if (this.destroyed) return;
          // Bias impacts around the player's current position so it tracks the
          // fight, but with scatter so it's dodgeable, not homing.
          const ex = Phaser.Math.Clamp(
            this.ctx.playerX() + Phaser.Math.Between(-180, 180),
            ARENA.minX,
            ARENA.maxX,
          );
          const ey = Phaser.Math.Clamp(
            this.ctx.playerY() + Phaser.Math.Between(-180, 180),
            ARENA.minY,
            ARENA.maxY,
          );
          this.telegraph(ex, ey, 46, 0xff8a4c, 420, () => {
            const flash = this.scene.add.circle(ex, ey, 20, 0xffb066, 0.7).setDepth(this.boss.depth + 1);
            this.scene.tweens.add({ targets: flash, radius: 48, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
            if (Phaser.Math.Distance.Between(ex, ey, this.ctx.playerX(), this.ctx.playerY()) < 50) {
              this.ctx.hurtPlayer(dmg);
            }
          });
        }),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Shared boss helpers.
  // -------------------------------------------------------------------------

  private stepToward(body: Phaser.Physics.Arcade.Body, tx: number, ty: number, speed: number): void {
    move.set(tx - this.boss.x, ty - this.boss.y);
    if (move.lengthSq() > 0.001) move.normalize().scale(speed);
    body.setVelocity(move.x, move.y);
  }

  private faceTarget(targetX: number): void {
    this.boss.setFlipX(targetX < this.boss.x);
  }

  private playLoop(pose: 'idle' | 'walk'): void {
    const key = `enemy-${this.type}-${pose}`;
    if (this.boss.anims.currentAnim?.key !== key && this.scene.anims.exists(key)) {
      this.boss.play(key, true);
    }
  }

  private playOnce(pose: 'attack' | 'hurt'): void {
    const key = `enemy-${this.type}-${pose}`;
    if (this.boss.anims.isPlaying && this.boss.anims.currentAnim?.key === key) return;
    if (this.scene.anims.exists(key)) this.boss.play(key, true);
  }

  /**
   * The universal fairness primitive (mirrors EnemyAI.telegraph): a filling ring
   * that resolves into `onFire`. Scales stroke/alpha down on low quality and
   * keeps the ring (but not the shake) under reduced motion. Registers no
   * long-lived timer — the tween self-cleans — so it's safe to spam per attack.
   */
  private telegraph(x: number, y: number, radius: number, color: number, windup: number, onFire: () => void): void {
    const alpha = this.ctx.reducedMotion ? 0.22 : 0.12;
    const ring = this.scene.add
      .circle(x, y, radius, color, alpha)
      .setStrokeStyle(this.ctx.lowQuality ? 4 : 6, color, 0.95)
      .setDepth(882);
    this.scene.tweens.add({
      targets: ring,
      scale: this.ctx.reducedMotion ? 1.04 : 1.18,
      alpha: alpha + 0.28,
      duration: windup,
      onComplete: () => {
        ring.destroy();
        if (!this.destroyed) onFire();
      },
    });
  }
}

/*
 * ===========================================================================
 * INTEGRATION NOTE — how WorldScene drives BossFight (no WorldScene edits by me).
 * ===========================================================================
 *
 * 1) IMPORT:
 *
 *      import { BossFight, type BossContext } from '../systems/combat/BossFight';
 *
 *    and hold two handles next to `boss` / `cinderBoss`:
 *
 *      private namelessFight?: BossFight;
 *      private cinderFight?: BossFight;
 *
 * 2) CONSTRUCT on activation. In `syncBoss`, inside the branch that flips the
 *    boss active/visible (right after `this.bossFightStartedAt = this.time.now;`),
 *    build the fight for that boss:
 *
 *      const bossCtx: BossContext = {
 *        hurtPlayer: (a) => this.hurtPlayer(a),
 *        spawnAdd: (t, x, y) => this.spawnEnemy({ type: t as keyof typeof ENEMIES, x, y, temporary: true }),
 *        spawnProjectile: (o) => this.spawnEnemyProjectile(o),   // same helper as EnemyAI (see EnemyAI note 5)
 *        playerX: () => this.player.x,
 *        playerY: () => this.player.y,
 *        playerAlive: () => this.player.active,
 *        reducedMotion: this.saves.get().settings.reducedMotion,
 *        lowQuality: this.saves.get().settings.quality === 'low'
 *          || (this.saves.get().settings.quality === 'auto' && this.scale.width < 700),
 *        onPhase: (phase, total) => GameEvents.emit('boss-phase', { type, phase, total }), // health bar hook
 *        setInvulnerable: (v) => enemy!.setData('bossInvulnerable', v),
 *      };
 *      if (type === 'nameless') this.namelessFight = new BossFight(this, enemy, 'nameless', bossCtx);
 *      else this.cinderFight = new BossFight(this, enemy, 'cinderlord', bossCtx);
 *
 * 3) DRIVE per tick. In `update` (or at the end of `updateEnemies`), after the
 *    slow-tick guard so it runs on the same cadence as enemies:
 *
 *      this.namelessFight?.update(time, delta);
 *      this.cinderFight?.update(time, delta);
 *
 *    (delta here is the same value passed to updateEnemies.)
 *
 * 4) FEED DAMAGE + RESPECT INVULNERABILITY. In `damageEnemy`, guard the boss
 *    transition/blink invuln and notify the fight after applying HP:
 *
 *      if (enemy.getData('bossInvulnerable')) return;            // near the top, with the isIntangible guard
 *      ...
 *      // after `enemy.setData('health', health);`:
 *      if (type === 'nameless') this.namelessFight?.onDamaged(health);
 *      else if (type === 'cinderlord') this.cinderFight?.onDamaged(health);
 *
 * 5) DESTROY. In `killEnemy`, where the boss handles are cleared, and in
 *    `cleanup`:
 *
 *      this.namelessFight?.destroy(); this.namelessFight = undefined;   // for nameless
 *      this.cinderFight?.destroy();   this.cinderFight = undefined;     // for cinderlord
 *
 * 6) HEALTH-BAR PHASE INDICATOR. `onPhase` emits `boss-phase` with { phase,
 *    total }; GameUI's boss bar can render `total` pips and fill `phase` of them,
 *    or show "Фаза 2/3". BossFight also stores it on the sprite as
 *    getData('bossPhase') if you prefer to read it in `updateEnemyBars`.
 *
 * Effects honour reducedMotion (rings stay, shakes drop) and lowQuality (fewer
 * embers / no flourish lines), and no per-tick allocation occurs on the hot path.
 * ===========================================================================
 */
