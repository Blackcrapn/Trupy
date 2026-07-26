/**
 * Trupy's audio manager.
 *
 * Owns the mixer graph and routes everything through it: adaptive music
 * (Music.ts), layered ambience (Ambience.ts) and material-aware sound effects
 * (Sfx.ts). Nothing here loads a file — every sample is synthesised at runtime.
 *
 * The mixer is a real bus layout rather than one gain node: separate music,
 * ambience and SFX buses feed a master chain of convolution reverb send →
 * compressor → limiter, so loud combat ducks cleanly instead of clipping.
 *
 * The public surface is deliberately backwards-compatible with the previous
 * version (`attack`, `hit`, `coin`, `step`, `setRegion`, …) so existing scenes
 * keep working while gaining the richer sound.
 */

import { AmbienceEngine } from './audio/Ambience';
import { MusicDirector, type MusicIntensity, type MusicRegion } from './audio/Music';
import { SfxLibrary, type ImpactMaterial, type StepSurface } from './audio/Sfx';
import { buildImpulse, buildNoise } from './audio/Synth';

/** Region names, kept identical to the previous API. */
export type AudioRegion = MusicRegion;

interface AudioMix {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  enabled: boolean;
}

/** Maps enemy ids to the material they sound like when struck. */
const ENEMY_MATERIAL: Record<string, ImpactMaterial> = {
  husk: 'flesh',
  boneguard: 'bone',
  direwolf: 'flesh',
  wraith: 'shadow',
  bogling: 'flesh',
  cavecrawler: 'chitin',
  ashborn: 'ember',
  nameless: 'shadow',
  cinderlord: 'armour',
};

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private ambienceBus?: GainNode;
  private reverbSend?: GainNode;
  private reverb?: ConvolverNode;

  private music?: MusicDirector;
  private ambience?: AmbienceEngine;
  private sfx?: SfxLibrary;

  private musicTimer?: number;
  private ambienceTimer?: number;
  private lastAmbienceUpdate = 0;

  private region: AudioRegion = 'home';
  private intensity: MusicIntensity = 'calm';
  private combat = false;
  private unlocked = false;
  private rain?: { gain: GainNode; stop: () => void };
  private mix: AudioMix = { master: 0.85, music: 0.55, sfx: 0.8, ambience: 0.5, enabled: true };

  // ------------------------------------------------------------- lifecycle

  async unlock(): Promise<void> {
    if (!this.context) this.createGraph();
    if (!this.context) return;
    if (this.context.state === 'suspended') await this.context.resume();
    this.unlocked = true;
    document.documentElement.dataset.audio = this.context.state;
    this.applyMix();
    this.ambience?.start();
    this.startMusicClock();
    this.startAmbienceClock();
    this.ui();
  }

  isUnlocked(): boolean {
    return this.unlocked && this.context?.state === 'running';
  }

  setMix(mix: Partial<AudioMix>): void {
    this.mix = { ...this.mix, ...mix };
    this.applyMix();
    if (this.mix.enabled && this.unlocked) {
      this.ambience?.start();
      this.startMusicClock();
      this.startAmbienceClock();
    }
  }

  private createGraph(): void {
    const AudioContextClass = window.AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    this.context = context;

    this.master = context.createGain();
    this.musicBus = context.createGain();
    this.sfxBus = context.createGain();
    this.ambienceBus = context.createGain();
    this.reverbSend = context.createGain();

    // Convolution reverb gives the valley a sense of physical space. The impulse
    // is generated noise — a real hall response without shipping an audio file.
    this.reverb = context.createConvolver();
    this.reverb.buffer = buildImpulse(context, 2.6, 2.4, 0.62);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    // Glue compressor, then a fast limiter so peaks never clip.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 22;
    compressor.ratio.value = 4.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.24;

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -2.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;
    this.limiter = limiter;

    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambienceBus.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(context.destination);

    // Shared noise buffers — generating these once saves a lot of allocation.
    const white = buildNoise(context, 2.2, 0);
    const brown = buildNoise(context, 3, 0.96);

    // Music layer buses, so the director can mix layers independently.
    const layerBus = (): GainNode => {
      const gain = context.createGain();
      gain.connect(this.musicBus!);
      return gain;
    };
    this.music = new MusicDirector(context, {
      drone: layerBus(),
      harmony: layerBus(),
      melody: layerBus(),
      percussion: layerBus(),
      space: this.reverbSend,
    });
    this.music.setNoise(white);

    this.ambience = new AmbienceEngine(context, this.ambienceBus, this.reverbSend, white, brown);
    this.sfx = new SfxLibrary(context, { sfx: this.sfxBus, space: this.reverbSend }, white, brown);

    this.applyMix();
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend();
      else if (this.mix.enabled) void this.context.resume();
    });
  }

  private applyMix(): void {
    if (!this.context || !this.master || !this.musicBus || !this.sfxBus || !this.ambienceBus || !this.reverbSend) return;
    const now = this.context.currentTime;
    const enabled = this.mix.enabled ? 1 : 0;
    this.master.gain.setTargetAtTime(this.mix.master * enabled, now, 0.03);
    this.musicBus.gain.setTargetAtTime(this.mix.music * 0.75, now, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.mix.sfx * 0.85, now, 0.03);
    this.ambienceBus.gain.setTargetAtTime(this.mix.ambience * 0.6, now, 0.1);
    // Reverb rides with the music level so quiet settings stay dry.
    this.reverbSend.gain.setTargetAtTime(0.55 * Math.max(this.mix.music, this.mix.sfx), now, 0.12);
  }

  // ----------------------------------------------------------------- clocks

  /**
   * The music clock re-arms itself with the current tempo each tick, so tempo
   * changes (entering combat) take effect on the next sixteenth rather than
   * waiting for a restart.
   */
  private startMusicClock(): void {
    if (!this.unlocked || this.musicTimer || !this.mix.enabled || !this.music) return;
    const tick = (): void => {
      if (!this.mix.enabled || !this.music) { this.musicTimer = undefined; return; }
      this.music.step();
      this.musicTimer = window.setTimeout(tick, this.music.stepDuration());
    };
    tick();
  }

  private startAmbienceClock(): void {
    if (!this.unlocked || this.ambienceTimer || !this.mix.enabled) return;
    this.lastAmbienceUpdate = performance.now();
    this.ambienceTimer = window.setInterval(() => {
      if (!this.mix.enabled || !this.ambience) return;
      const now = performance.now();
      const delta = (now - this.lastAmbienceUpdate) / 1000;
      this.lastAmbienceUpdate = now;
      this.ambience.update(delta, now / 1000);
    }, 250);
  }

  // ------------------------------------------------------------------ state

  setRegion(region: AudioRegion, combat = this.combat): void {
    const changed = region !== this.region;
    this.region = region;
    this.combat = combat;
    if (changed) {
      this.music?.setRegion(region);
      this.ambience?.setRegion(region);
      this.music?.regionStinger();
    }
    this.refreshIntensity();
  }

  setCombat(combat: boolean): void {
    if (combat === this.combat) return;
    this.combat = combat;
    this.refreshIntensity();
  }

  /** Escalate to the boss score. */
  setBossFight(active: boolean): void {
    this.intensity = active ? 'boss' : this.combat ? 'combat' : 'calm';
    this.music?.setIntensity(this.intensity);
  }

  /** Nearby-danger tension without full combat. */
  setTension(tense: boolean): void {
    if (this.intensity === 'boss' || this.combat) return;
    this.intensity = tense ? 'tense' : 'calm';
    this.music?.setIntensity(this.intensity);
  }

  private refreshIntensity(): void {
    if (this.intensity === 'boss') return;
    this.intensity = this.combat ? 'combat' : 'calm';
    this.music?.setIntensity(this.intensity);
  }

  // ----------------------------------------------------------------- effects

  /** Weapon swing. Kept for API compatibility with the previous version. */
  attack(kind: string): void {
    if (!this.ready()) return;
    if (kind === 'melee') this.sfx!.swing('melee');
    else if (kind === 'ranged') this.sfx!.swing('ranged');
    else this.sfx!.swing('magic');
  }

  /** Heavy weapon swing. */
  heavyAttack(kind: 'melee' | 'ranged' | 'magic'): void {
    if (!this.ready()) return;
    this.sfx!.swing(kind, true);
  }

  /** Generic hit, retained for compatibility. */
  hit(): void {
    if (!this.ready()) return;
    this.sfx!.impact('flesh');
  }

  /** Material-aware impact — the preferred call. */
  impact(enemyType: string, power = 1, critical = false): void {
    if (!this.ready()) return;
    this.sfx!.impact(ENEMY_MATERIAL[enemyType] ?? 'flesh', power, critical);
  }

  parry(): void { if (this.ready()) this.sfx!.parry(); }

  enemyDeath(enemyType: string, boss = false): void {
    if (!this.ready()) return;
    if (boss) this.sfx!.bossDeath();
    else this.sfx!.death(ENEMY_MATERIAL[enemyType] ?? 'flesh');
  }

  playerHurt(severity = 1): void { if (this.ready()) this.sfx!.playerHurt(severity); }

  playerDeath(): void {
    if (!this.ready()) return;
    this.sfx!.playerDeath();
    this.music?.deathMotif();
  }

  dash(): void { if (this.ready()) this.sfx!.dash(); }

  special(kind: 'melee' | 'ranged' | 'magic'): void { if (this.ready()) this.sfx!.special(kind); }

  coin(count = 1): void { if (this.ready()) this.sfx!.coin(count); }

  quest(): void { if (this.ready()) this.music?.fanfare(); }

  heal(): void { if (this.ready()) this.sfx!.potion(); }

  ui(kind: 'click' | 'open' | 'close' | 'error' = 'click'): void {
    if (this.ready()) this.sfx!.ui(kind);
  }

  pickup(): void { if (this.ready()) this.sfx!.pickup(); }

  chest(): void { if (this.ready()) this.sfx!.chest(); }

  door(opening = true): void { if (this.ready()) this.sfx!.door(opening); }

  craft(): void { if (this.ready()) this.sfx!.craft(); }

  levelUp(): void { if (this.ready()) this.sfx!.levelUp(); }

  riftOpen(): void { if (this.ready()) this.sfx!.riftOpen(); }

  riftClose(): void { if (this.ready()) this.sfx!.riftClose(); }

  thunder(): void { if (this.ready()) this.sfx!.thunder(); }

  step(surface: StepSurface = 'grass'): void {
    if (this.ready()) this.sfx!.step(surface);
  }

  /** Fade a continuous rain bed in or out, 0..1. */
  setRain(amount: number): void {
    if (!this.ready() || !this.context) return;
    if (amount <= 0.001) {
      if (this.rain) {
        this.rain.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.6);
        const handle = this.rain;
        this.rain = undefined;
        window.setTimeout(() => handle.stop(), 2200);
      }
      return;
    }
    if (!this.rain) this.rain = this.sfx!.rainLayer();
    this.rain.gain.gain.setTargetAtTime(amount * 0.12, this.context.currentTime, 0.8);
  }

  /** Trigger a specific ambient one-shot (used for scripted moments). */
  ambientEvent(kind: Parameters<AmbienceEngine['fireEvent']>[0]): void {
    if (this.ready()) this.ambience?.fireEvent(kind);
  }

  private ready(): boolean {
    return Boolean(this.unlocked && this.mix.enabled && this.context && this.sfx);
  }

  /** Current musical root — lets visual effects pulse in time with the score. */
  chordRoot(): number {
    return this.music?.currentChordRoot() ?? 220;
  }
}

export const audio = new AudioManager();
export type { ImpactMaterial, StepSurface, MusicIntensity };
