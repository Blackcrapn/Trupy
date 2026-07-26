/**
 * Layered environmental ambience.
 *
 * A single filtered noise loop (what this replaced) sounds like tape hiss. Real
 * places are made of several independent sounds at different rates: a wind bed
 * that swells and fades, water that trickles, occasional distant events — a crow,
 * a dripping stone, a creaking rope. Each region mixes these differently, and the
 * random events are what make a place feel alive rather than looped.
 */

import { ENV, playNoise, playVoice } from './Synth';
import type { MusicRegion } from './Music';

export interface AmbienceLayer {
  /** Base filter cutoff for the wind/room bed. */
  cutoff: number;
  /** How much the bed level breathes, 0..1. */
  swell: number;
  /** Bed level. */
  bed: number;
  /** Brown-noise coefficient — higher is deeper/rumblier. */
  texture: number;
  /** Water/trickle layer level, 0 disables. */
  water: number;
  /** Reverb amount for one-shot events. */
  space: number;
  /** Weighted list of random ambient events. */
  events: Array<{ kind: AmbientEvent; weight: number }>;
  /** Average seconds between events. */
  eventGap: number;
}

export type AmbientEvent =
  | 'crow' | 'drip' | 'creak' | 'rustle' | 'bubble' | 'distant-howl'
  | 'stone-fall' | 'chain' | 'bell' | 'whisper' | 'ember-crack' | 'gull'
  | 'wood-groan' | 'wind-gust' | 'insect';

/**
 * Per-region character. The cemetery gets crows and whispers; the mine gets
 * dripping water, falling stone and chains; the docks get gulls and creaking
 * wood. These lists are the main reason each area feels like somewhere specific.
 */
export const AMBIENCE: Record<MusicRegion, AmbienceLayer> = {
  home: {
    cutoff: 620, swell: 0.3, bed: 0.5, texture: 0.9, water: 0, space: 0.3, eventGap: 11,
    events: [{ kind: 'creak', weight: 3 }, { kind: 'rustle', weight: 2 }, { kind: 'wind-gust', weight: 2 }, { kind: 'insect', weight: 1 }],
  },
  village: {
    cutoff: 840, swell: 0.22, bed: 0.42, texture: 0.86, water: 0.1, space: 0.24, eventGap: 8,
    events: [{ kind: 'wood-groan', weight: 3 }, { kind: 'bell', weight: 1 }, { kind: 'rustle', weight: 2 }, { kind: 'insect', weight: 2 }, { kind: 'creak', weight: 2 }],
  },
  cemetery: {
    cutoff: 340, swell: 0.44, bed: 0.6, texture: 0.94, water: 0, space: 0.72, eventGap: 7,
    events: [{ kind: 'crow', weight: 4 }, { kind: 'whisper', weight: 3 }, { kind: 'wind-gust', weight: 3 }, { kind: 'stone-fall', weight: 1 }],
  },
  forest: {
    cutoff: 1150, swell: 0.36, bed: 0.52, texture: 0.82, water: 0.08, space: 0.42, eventGap: 6,
    events: [{ kind: 'rustle', weight: 5 }, { kind: 'insect', weight: 3 }, { kind: 'distant-howl', weight: 2 }, { kind: 'crow', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
  },
  ruins: {
    cutoff: 300, swell: 0.4, bed: 0.58, texture: 0.95, water: 0.05, space: 0.74, eventGap: 8,
    events: [{ kind: 'whisper', weight: 4 }, { kind: 'stone-fall', weight: 3 }, { kind: 'chain', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
  },
  marsh: {
    cutoff: 470, swell: 0.38, bed: 0.55, texture: 0.9, water: 0.42, space: 0.5, eventGap: 5,
    events: [{ kind: 'bubble', weight: 5 }, { kind: 'insect', weight: 4 }, { kind: 'drip', weight: 3 }, { kind: 'rustle', weight: 2 }],
  },
  mine: {
    cutoff: 210, swell: 0.3, bed: 0.62, texture: 0.97, water: 0.2, space: 0.88, eventGap: 6,
    events: [{ kind: 'drip', weight: 5 }, { kind: 'stone-fall', weight: 3 }, { kind: 'chain', weight: 3 }, { kind: 'wood-groan', weight: 2 }, { kind: 'whisper', weight: 1 }],
  },
  docks: {
    cutoff: 900, swell: 0.42, bed: 0.5, texture: 0.85, water: 0.55, space: 0.4, eventGap: 6,
    events: [{ kind: 'gull', weight: 4 }, { kind: 'wood-groan', weight: 4 }, { kind: 'creak', weight: 3 }, { kind: 'chain', weight: 2 }, { kind: 'wind-gust', weight: 2 }],
  },
  citadel: {
    cutoff: 260, swell: 0.34, bed: 0.6, texture: 0.93, water: 0, space: 0.7, eventGap: 6,
    events: [{ kind: 'ember-crack', weight: 5 }, { kind: 'chain', weight: 3 }, { kind: 'whisper', weight: 2 }, { kind: 'stone-fall', weight: 2 }, { kind: 'bell', weight: 1 }],
  },
  interior: {
    cutoff: 520, swell: 0.18, bed: 0.34, texture: 0.9, water: 0, space: 0.3, eventGap: 10,
    events: [{ kind: 'creak', weight: 4 }, { kind: 'wood-groan', weight: 3 }, { kind: 'ember-crack', weight: 2 }],
  },
};

/**
 * Runs the ambience beds and schedules random one-shots.
 *
 * The beds are looping buffer sources whose filters and gains are retargeted on
 * region change, so transitions crossfade instead of cutting.
 */
export class AmbienceEngine {
  private windSource?: AudioBufferSourceNode;
  private windFilter?: BiquadFilterNode;
  private windGain?: GainNode;
  private waterSource?: AudioBufferSourceNode;
  private waterFilter?: BiquadFilterNode;
  private waterGain?: GainNode;
  private swellPhase = 0;
  private nextEventAt = 0;
  private region: MusicRegion = 'home';

  constructor(
    private readonly context: AudioContext,
    private readonly bus: GainNode,
    private readonly spaceBus: GainNode,
    private readonly noise: AudioBuffer,
    private readonly brownNoise: AudioBuffer,
  ) {}

  start(): void {
    if (this.windSource) return;
    const layer = AMBIENCE[this.region];

    // Wind/room bed: brown noise through a lowpass, slowly modulated.
    this.windGain = this.context.createGain();
    this.windFilter = this.context.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = layer.cutoff;
    this.windFilter.Q.value = 0.7;
    this.windSource = this.context.createBufferSource();
    this.windSource.buffer = this.brownNoise;
    this.windSource.loop = true;
    this.windGain.gain.value = layer.bed * 0.5;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.bus);
    this.windSource.start();

    // Water bed: brighter, bandpassed noise for trickle and lapping.
    this.waterGain = this.context.createGain();
    this.waterFilter = this.context.createBiquadFilter();
    this.waterFilter.type = 'bandpass';
    this.waterFilter.frequency.value = 2400;
    this.waterFilter.Q.value = 0.9;
    this.waterSource = this.context.createBufferSource();
    this.waterSource.buffer = this.noise;
    this.waterSource.loop = true;
    this.waterGain.gain.value = layer.water * 0.16;
    this.waterSource.connect(this.waterFilter);
    this.waterFilter.connect(this.waterGain);
    this.waterGain.connect(this.bus);
    this.waterSource.start();
  }

  setRegion(region: MusicRegion): void {
    if (this.region === region) return;
    this.region = region;
    const layer = AMBIENCE[region];
    const now = this.context.currentTime;
    // Long time-constants: the soundscape morphs rather than switching.
    this.windFilter?.frequency.setTargetAtTime(layer.cutoff, now, 0.9);
    this.windGain?.gain.setTargetAtTime(layer.bed * 0.5, now, 1.1);
    this.waterGain?.gain.setTargetAtTime(layer.water * 0.16, now, 1.2);
    this.nextEventAt = 0;
  }

  /** Drive the slow swell and fire random events. Call a few times a second. */
  update(deltaSeconds: number, timeSeconds: number): void {
    const layer = AMBIENCE[this.region];
    if (this.windGain) {
      // Two out-of-phase sines make the wind breathe irregularly.
      this.swellPhase += deltaSeconds;
      const breath = Math.sin(this.swellPhase * 0.13) * 0.6 + Math.sin(this.swellPhase * 0.052) * 0.4;
      const target = layer.bed * 0.5 * (1 + breath * layer.swell);
      this.windGain.gain.setTargetAtTime(Math.max(0.001, target), this.context.currentTime, 0.6);
    }
    if (this.waterFilter && layer.water > 0) {
      const wobble = 2200 + Math.sin(this.swellPhase * 0.31) * 600;
      this.waterFilter.frequency.setTargetAtTime(wobble, this.context.currentTime, 0.4);
    }

    if (timeSeconds >= this.nextEventAt) {
      if (this.nextEventAt > 0) this.fireEvent(this.pickEvent(layer));
      // Jittered gap so events never fall into a rhythm.
      this.nextEventAt = timeSeconds + layer.eventGap * (0.55 + Math.random() * 0.9);
    }
  }

  private pickEvent(layer: AmbienceLayer): AmbientEvent {
    const total = layer.events.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    for (const entry of layer.events) {
      roll -= entry.weight;
      if (roll <= 0) return entry.kind;
    }
    return layer.events[0].kind;
  }

  /** One-shot ambient sounds, each synthesised from its physical character. */
  fireEvent(kind: AmbientEvent): void {
    const layer = AMBIENCE[this.region];
    const pan = (Math.random() - 0.5) * 1.5;
    const send = layer.space;
    const wet = send > 0.4 ? this.spaceBus : this.bus;

    switch (kind) {
      case 'crow': {
        // Two harsh descending caws.
        const caws = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < caws; i += 1) {
          playVoice(this.context, wet, {
            frequency: 620 + Math.random() * 120,
            glideTo: 300,
            duration: 0.16,
            gain: 0.05,
            type: 'sawtooth',
            env: ENV.stab,
            cutoff: 2400,
            cutoffTo: 900,
            resonance: 3.2,
            delay: i * 0.29,
            pan,
          });
        }
        break;
      }
      case 'gull':
        for (let i = 0; i < 3; i += 1) {
          playVoice(this.context, wet, {
            frequency: 900 - i * 60,
            glideTo: 1250 - i * 80,
            duration: 0.13,
            gain: 0.035,
            type: 'triangle',
            env: ENV.stab,
            cutoff: 4200,
            delay: i * 0.19,
            pan,
          });
        }
        break;
      case 'drip':
        // Sharp attack, quick pitch rise: a droplet hitting standing water.
        playVoice(this.context, wet, {
          frequency: 900 + Math.random() * 700,
          glideTo: 2100,
          duration: 0.05,
          gain: 0.05,
          type: 'sine',
          env: ENV.perc,
          pan,
        });
        playNoise(this.context, wet, {
          buffer: this.noise, duration: 0.04, gain: 0.014,
          cutoff: 5200, highpass: 1800, env: ENV.perc, delay: 0.005, pan,
        });
        break;
      case 'creak':
      case 'wood-groan': {
        const low = kind === 'wood-groan';
        playVoice(this.context, wet, {
          frequency: low ? 78 : 190,
          glideTo: low ? 62 : 240,
          duration: low ? 0.9 : 0.42,
          gain: 0.038,
          type: 'sawtooth',
          env: ENV.pad,
          cutoff: low ? 340 : 700,
          resonance: 5.5,
          vibrato: 26,
          vibratoRate: low ? 5.5 : 11,
          pan,
        });
        break;
      }
      case 'rustle':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.42, gain: 0.03,
          cutoff: 4200, cutoffTo: 1600, highpass: 900,
          env: { attack: 0.09, decay: 0.16, sustain: 0.35, release: 0.28 }, pan,
        });
        break;
      case 'wind-gust':
        playNoise(this.context, this.bus, {
          buffer: this.brownNoise, duration: 1.7, gain: 0.055,
          cutoff: 900, cutoffTo: 320,
          env: { attack: 0.7, decay: 0.5, sustain: 0.5, release: 1.1 }, pan,
        });
        break;
      case 'bubble': {
        // Rising pitch = a bubble surfacing. Cheap and instantly readable.
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i += 1) {
          playVoice(this.context, this.bus, {
            frequency: 150 + Math.random() * 160,
            glideTo: 420 + Math.random() * 260,
            duration: 0.11,
            gain: 0.03,
            type: 'sine',
            env: ENV.perc,
            delay: i * (0.1 + Math.random() * 0.14),
            pan: pan + (Math.random() - 0.5) * 0.4,
          });
        }
        break;
      }
      case 'insect':
        playVoice(this.context, this.bus, {
          frequency: 3100 + Math.random() * 900,
          duration: 0.5,
          gain: 0.008,
          type: 'square',
          env: { attack: 0.12, decay: 0.1, sustain: 0.5, release: 0.24 },
          cutoff: 5200,
          vibrato: 55,
          vibratoRate: 34,
          pan,
        });
        break;
      case 'distant-howl':
        playVoice(this.context, wet, {
          frequency: 240,
          glideTo: 400,
          duration: 1.1,
          gain: 0.036,
          type: 'triangle',
          env: { attack: 0.3, decay: 0.35, sustain: 0.6, release: 0.9 },
          cutoff: 1100,
          cutoffTo: 600,
          vibrato: 22,
          vibratoRate: 4.4,
          pan,
        });
        break;
      case 'stone-fall': {
        const hits = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < hits; i += 1) {
          playNoise(this.context, wet, {
            buffer: this.noise, duration: 0.09, gain: 0.04 / (1 + i * 0.5),
            cutoff: 1400 - i * 200, highpass: 200,
            env: ENV.perc, delay: i * (0.07 + Math.random() * 0.1), pan,
          });
        }
        break;
      }
      case 'chain':
        // Rattling links: bright inharmonic noise clicks, irregularly spaced.
        for (let i = 0; i < 4; i += 1) {
          playNoise(this.context, wet, {
            buffer: this.noise,
            duration: 0.06,
            gain: 0.018,
            cutoff: 7600,
            highpass: 2400,
            resonance: 4,
            env: ENV.perc,
            delay: i * (0.05 + Math.random() * 0.07),
            pan: pan + (Math.random() - 0.5) * 0.3,
          });
          playVoice(this.context, wet, {
            frequency: 2100 + Math.random() * 1500,
            duration: 0.07,
            gain: 0.01,
            type: 'square',
            env: ENV.perc,
            cutoff: 8000,
            delay: i * (0.05 + Math.random() * 0.07),
            pan,
          });
        }
        break;
      case 'bell':
        playVoice(this.context, wet, {
          frequency: 320, duration: 1.9, gain: 0.03, type: 'sine', env: ENV.bell, pan,
        });
        playVoice(this.context, wet, {
          frequency: 320 * 2.41, duration: 1.3, gain: 0.012, type: 'sine', env: ENV.bell, delay: 0.01, pan,
        });
        break;
      case 'whisper':
        // Formant-ish filtered noise: unintelligible voices, which is scarier.
        playNoise(this.context, wet, {
          buffer: this.noise, duration: 0.85, gain: 0.026,
          cutoff: 1500, cutoffTo: 700, highpass: 480, resonance: 7,
          env: { attack: 0.24, decay: 0.2, sustain: 0.45, release: 0.5 }, pan,
        });
        break;
      case 'ember-crack':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.05, gain: 0.03,
          cutoff: 4600, highpass: 1400, env: ENV.perc, pan,
        });
        playVoice(this.context, this.bus, {
          frequency: 190, glideTo: 90, duration: 0.09, gain: 0.02,
          type: 'triangle', env: ENV.perc, delay: 0.01, pan,
        });
        break;
    }
  }

  stop(): void {
    this.windSource?.stop();
    this.waterSource?.stop();
    this.windSource = undefined;
    this.waterSource = undefined;
  }
}
