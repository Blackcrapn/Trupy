/**
 * Combat and interaction sound effects.
 *
 * Every sound is designed from what physically happens: a sword hitting bone is a
 * hard transient plus a short woody body; hitting armour adds a metallic ring;
 * hitting a wraith is mostly filtered air. Material-aware impacts are the single
 * biggest upgrade to combat feel here — the player hears what they hit.
 */

import { ENV, playMetal, playNoise, playVoice } from './Synth';

export type ImpactMaterial = 'flesh' | 'bone' | 'armour' | 'shadow' | 'chitin' | 'stone' | 'ember';
export type StepSurface = 'grass' | 'stone' | 'wood' | 'water' | 'mud' | 'gravel' | 'snow';

export interface SfxBuses {
  sfx: GainNode;
  space: GainNode;
}

export class SfxLibrary {
  private footstepAlternate = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly buses: SfxBuses,
    private readonly noise: AudioBuffer,
    private readonly brownNoise: AudioBuffer,
  ) {}

  private get bus(): GainNode { return this.buses.sfx; }

  // ---------------------------------------------------------------- attacks

  /** Weapon swing — a whoosh whose pitch and body follow the weapon class. */
  swing(kind: 'melee' | 'ranged' | 'magic', heavy = false): void {
    if (kind === 'melee') {
      // Air being displaced: a fast downward filter sweep on noise.
      playNoise(this.context, this.bus, {
        buffer: this.noise,
        duration: heavy ? 0.2 : 0.13,
        gain: heavy ? 0.09 : 0.062,
        cutoff: heavy ? 2600 : 4200,
        cutoffTo: heavy ? 420 : 700,
        highpass: 320,
        resonance: 2.4,
        env: { attack: 0.008, decay: 0.06, sustain: 0.3, release: 0.1 },
      });
      playVoice(this.context, this.bus, {
        frequency: heavy ? 170 : 260,
        glideTo: heavy ? 62 : 96,
        duration: heavy ? 0.17 : 0.11,
        gain: 0.035,
        type: 'triangle',
        env: ENV.perc,
      });
    } else if (kind === 'ranged') {
      // Bowstring release: sharp click plus a short taut thrum.
      playNoise(this.context, this.bus, {
        buffer: this.noise, duration: 0.05, gain: 0.055,
        cutoff: 5200, highpass: 1400, env: ENV.perc,
      });
      playVoice(this.context, this.bus, {
        frequency: 420, glideTo: 210, duration: 0.1, gain: 0.04,
        type: 'square', env: ENV.perc, cutoff: 2400,
      });
    } else {
      // Spellcast: rising detuned tone with a shimmer above it.
      playVoice(this.context, this.bus, {
        frequency: 220, glideTo: 880, duration: 0.28, gain: 0.05,
        type: 'triangle', env: ENV.stab, detune: 14, cutoff: 900, cutoffTo: 4200, resonance: 3,
      });
      playVoice(this.context, this.buses.space, {
        frequency: 1760, duration: 0.5, gain: 0.026, type: 'sine', env: ENV.bell, delay: 0.06,
      });
    }
  }

  /**
   * Impact. Material choice changes the whole character, which is what makes
   * different enemies feel physically different to fight.
   */
  impact(material: ImpactMaterial, power = 1, critical = false): void {
    const gain = 0.06 * Math.min(1.6, power);
    switch (material) {
      case 'bone':
        // Hard, dry, hollow: high transient + short woody resonance.
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.06, gain: gain * 1.1,
          cutoff: 3800, cutoffTo: 900, highpass: 400, env: ENV.perc,
        });
        playVoice(this.context, this.bus, {
          frequency: 380, glideTo: 150, duration: 0.11, gain: gain * 0.7,
          type: 'triangle', env: ENV.perc, cutoff: 1800,
        });
        break;
      case 'armour':
        // Metal on metal: inharmonic ring over a heavy thud.
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.05, gain: gain,
          cutoff: 6200, highpass: 1200, env: ENV.perc,
        });
        playMetal(this.context, this.buses.space, 620, gain * 0.5, 0.44);
        playVoice(this.context, this.bus, {
          frequency: 96, glideTo: 52, duration: 0.13, gain: gain * 0.8,
          type: 'sine', env: ENV.perc,
        });
        break;
      case 'shadow':
        // Barely physical: a soft filtered gust with a dissonant tail.
        playNoise(this.context, this.buses.space, {
          buffer: this.brownNoise, duration: 0.3, gain: gain * 0.9,
          cutoff: 1500, cutoffTo: 420, resonance: 3,
          env: { attack: 0.01, decay: 0.12, sustain: 0.3, release: 0.24 },
        });
        playVoice(this.context, this.buses.space, {
          frequency: 300, glideTo: 190, duration: 0.28, gain: gain * 0.45,
          type: 'sine', env: ENV.pad, detune: 30,
        });
        break;
      case 'chitin':
        // Brittle shell: bright crack with a hollow click under it.
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.05, gain: gain * 1.15,
          cutoff: 7200, highpass: 2200, resonance: 3, env: ENV.perc,
        });
        playVoice(this.context, this.bus, {
          frequency: 720, glideTo: 260, duration: 0.07, gain: gain * 0.6,
          type: 'square', env: ENV.perc, cutoff: 3400,
        });
        break;
      case 'stone':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.08, gain: gain,
          cutoff: 1700, cutoffTo: 380, highpass: 180, env: ENV.perc,
        });
        playVoice(this.context, this.bus, {
          frequency: 120, glideTo: 58, duration: 0.13, gain: gain * 0.7,
          type: 'sine', env: ENV.perc,
        });
        break;
      case 'ember':
        // Wet-hot: a hiss plus a low roar.
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.22, gain: gain * 0.85,
          cutoff: 5400, cutoffTo: 1800, highpass: 900,
          env: { attack: 0.004, decay: 0.1, sustain: 0.3, release: 0.16 },
        });
        playVoice(this.context, this.bus, {
          frequency: 150, glideTo: 70, duration: 0.2, gain: gain * 0.7,
          type: 'sawtooth', env: ENV.perc, cutoff: 700,
        });
        break;
      case 'flesh':
      default:
        // Soft, damped, low: no ring at all.
        playNoise(this.context, this.bus, {
          buffer: this.brownNoise, duration: 0.09, gain: gain * 1.2,
          cutoff: 900, cutoffTo: 260, env: ENV.perc,
        });
        playVoice(this.context, this.bus, {
          frequency: 130, glideTo: 62, duration: 0.12, gain: gain * 0.75,
          type: 'sine', env: ENV.perc,
        });
        break;
    }

    if (critical) {
      // Crits get a bright metallic accent so they're unmistakable.
      playMetal(this.context, this.buses.space, 1180, 0.05, 0.6, 0.02);
      playVoice(this.context, this.bus, {
        frequency: 1600, glideTo: 2600, duration: 0.09, gain: 0.036,
        type: 'square', env: ENV.perc, delay: 0.015,
      });
    }
  }

  /** Parry / block — a bright metallic clang with a fast decay. */
  parry(): void {
    playMetal(this.context, this.buses.space, 900, 0.075, 0.55);
    playNoise(this.context, this.bus, {
      buffer: this.noise, duration: 0.04, gain: 0.06,
      cutoff: 8000, highpass: 2600, env: ENV.perc,
    });
  }

  /** Enemy death — a descending groan whose character follows the material. */
  death(material: ImpactMaterial): void {
    if (material === 'bone' || material === 'chitin') {
      // Clatter: a scatter of dry hits.
      for (let i = 0; i < 5; i += 1) {
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.06, gain: 0.038 / (1 + i * 0.4),
          cutoff: 3200 - i * 380, highpass: 500, env: ENV.perc,
          delay: i * (0.055 + Math.random() * 0.05),
          pan: (Math.random() - 0.5),
        });
      }
    } else if (material === 'shadow') {
      playNoise(this.context, this.buses.space, {
        buffer: this.brownNoise, duration: 0.8, gain: 0.055,
        cutoff: 1400, cutoffTo: 200,
        env: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
      });
      playVoice(this.context, this.buses.space, {
        frequency: 340, glideTo: 90, duration: 0.75, gain: 0.04,
        type: 'sine', env: ENV.pad, detune: 24,
      });
    } else if (material === 'ember') {
      playNoise(this.context, this.bus, {
        buffer: this.noise, duration: 0.7, gain: 0.06,
        cutoff: 3600, cutoffTo: 400, highpass: 300,
        env: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.5 },
      });
      playVoice(this.context, this.bus, {
        frequency: 180, glideTo: 48, duration: 0.6, gain: 0.05,
        type: 'sawtooth', env: ENV.pad, cutoff: 800, cutoffTo: 200,
      });
    } else {
      playVoice(this.context, this.bus, {
        frequency: 260, glideTo: 70, duration: 0.5, gain: 0.055,
        type: 'triangle', env: ENV.pad, cutoff: 1100, cutoffTo: 300, vibrato: 18,
      });
      playNoise(this.context, this.bus, {
        buffer: this.brownNoise, duration: 0.3, gain: 0.03,
        cutoff: 700, cutoffTo: 200, env: ENV.perc, delay: 0.05,
      });
    }
  }

  /** Boss death — a long, heavy collapse worth stopping to hear. */
  bossDeath(): void {
    playVoice(this.context, this.buses.space, {
      frequency: 210, glideTo: 42, duration: 1.6, gain: 0.075,
      type: 'sawtooth', env: { attack: 0.02, decay: 0.5, sustain: 0.5, release: 1.4 },
      cutoff: 1400, cutoffTo: 160, vibrato: 30, vibratoRate: 3.2,
    });
    for (let i = 0; i < 7; i += 1) {
      playNoise(this.context, this.buses.space, {
        buffer: this.brownNoise, duration: 0.3, gain: 0.05 / (1 + i * 0.3),
        cutoff: 1200 - i * 120, env: ENV.perc,
        delay: 0.1 + i * 0.13, pan: (Math.random() - 0.5) * 1.2,
      });
    }
    playMetal(this.context, this.buses.space, 260, 0.05, 2.4, 0.2);
  }

  // ------------------------------------------------------------- the player

  /** Player takes damage — a dull impact plus a brief tinnitus ring. */
  playerHurt(severity = 1): void {
    playNoise(this.context, this.bus, {
      buffer: this.brownNoise, duration: 0.14, gain: 0.075 * severity,
      cutoff: 620, cutoffTo: 190, env: ENV.perc,
    });
    playVoice(this.context, this.bus, {
      frequency: 110, glideTo: 48, duration: 0.18, gain: 0.06 * severity,
      type: 'sine', env: ENV.perc,
    });
    if (severity > 1.1) {
      playVoice(this.context, this.buses.space, {
        frequency: 3400, duration: 0.7, gain: 0.014,
        type: 'sine', env: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.5 },
      });
    }
  }

  playerDeath(): void {
    playVoice(this.context, this.buses.space, {
      frequency: 180, glideTo: 40, duration: 1.4, gain: 0.07,
      type: 'triangle', env: { attack: 0.01, decay: 0.4, sustain: 0.5, release: 1.2 },
      cutoff: 900, cutoffTo: 120,
    });
    playNoise(this.context, this.buses.space, {
      buffer: this.brownNoise, duration: 1.2, gain: 0.05,
      cutoff: 500, cutoffTo: 120,
      env: { attack: 0.02, decay: 0.4, sustain: 0.4, release: 0.9 },
    });
  }

  dash(): void {
    playNoise(this.context, this.bus, {
      buffer: this.noise, duration: 0.22, gain: 0.055,
      cutoff: 3600, cutoffTo: 600, highpass: 500, resonance: 2.6,
      env: { attack: 0.006, decay: 0.08, sustain: 0.3, release: 0.14 },
    });
    playVoice(this.context, this.bus, {
      frequency: 520, glideTo: 140, duration: 0.18, gain: 0.03,
      type: 'triangle', env: ENV.perc,
    });
  }

  /** Ability activation — a charged, rising swell. */
  special(kind: 'melee' | 'ranged' | 'magic'): void {
    const base = kind === 'magic' ? 180 : kind === 'ranged' ? 240 : 150;
    playVoice(this.context, this.bus, {
      frequency: base, glideTo: base * 5, duration: 0.34, gain: 0.06,
      type: kind === 'magic' ? 'sawtooth' : 'triangle',
      env: ENV.stab, detune: 18, cutoff: 700, cutoffTo: 5200, resonance: 4,
    });
    playMetal(this.context, this.buses.space, base * 6, 0.045, 0.9, 0.05);
    playNoise(this.context, this.bus, {
      buffer: this.noise, duration: 0.3, gain: 0.04,
      cutoff: 1200, cutoffTo: 6000, highpass: 400,
      env: { attack: 0.12, decay: 0.1, sustain: 0.4, release: 0.18 },
    });
  }

  step(surface: StepSurface = 'grass'): void {
    this.footstepAlternate = 1 - this.footstepAlternate;
    // Alternating pitch makes a stride read as left/right rather than a tick.
    const pitch = 1 + (this.footstepAlternate ? 0.09 : -0.06);
    switch (surface) {
      case 'stone':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.05, gain: 0.03,
          cutoff: 2400 * pitch, highpass: 400, env: ENV.perc,
        });
        playVoice(this.context, this.bus, {
          frequency: 150 * pitch, glideTo: 80, duration: 0.06, gain: 0.018, type: 'sine', env: ENV.perc,
        });
        break;
      case 'wood':
        // Hollow: a resonant low thump with a knock on top.
        playVoice(this.context, this.bus, {
          frequency: 190 * pitch, glideTo: 110, duration: 0.09, gain: 0.026,
          type: 'triangle', env: ENV.perc, cutoff: 1200, resonance: 3.5,
        });
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.035, gain: 0.016,
          cutoff: 3200, highpass: 800, env: ENV.perc,
        });
        break;
      case 'water':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.16, gain: 0.03,
          cutoff: 3600 * pitch, cutoffTo: 1200, highpass: 700,
          env: { attack: 0.005, decay: 0.07, sustain: 0.3, release: 0.1 },
        });
        break;
      case 'mud':
        // Suction: brown noise with a slow-ish attack.
        playNoise(this.context, this.bus, {
          buffer: this.brownNoise, duration: 0.14, gain: 0.032,
          cutoff: 700 * pitch, cutoffTo: 240,
          env: { attack: 0.012, decay: 0.06, sustain: 0.35, release: 0.1 },
        });
        break;
      case 'gravel':
        for (let i = 0; i < 3; i += 1) {
          playNoise(this.context, this.bus, {
            buffer: this.noise, duration: 0.03, gain: 0.014,
            cutoff: 4200, highpass: 1200, env: ENV.perc, delay: i * 0.014,
          });
        }
        break;
      case 'snow':
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.09, gain: 0.02,
          cutoff: 1400, highpass: 300, env: ENV.perc,
        });
        break;
      case 'grass':
      default:
        playNoise(this.context, this.bus, {
          buffer: this.noise, duration: 0.07, gain: 0.022,
          cutoff: 2000 * pitch, cutoffTo: 700, highpass: 350, env: ENV.perc,
        });
        break;
    }
  }

  // ------------------------------------------------------------- interface

  coin(count = 1): void {
    for (let i = 0; i < Math.min(4, count); i += 1) {
      playMetal(this.context, this.bus, 1500 + Math.random() * 700, 0.03, 0.3, i * 0.045);
    }
  }

  pickup(): void {
    playVoice(this.context, this.bus, {
      frequency: 620, glideTo: 940, duration: 0.09, gain: 0.036,
      type: 'triangle', env: ENV.pluck,
    });
    playVoice(this.context, this.buses.space, {
      frequency: 1240, duration: 0.3, gain: 0.018, type: 'sine', env: ENV.bell, delay: 0.03,
    });
  }

  potion(): void {
    // Glass clink, then a warm rising swell for the healing itself.
    playMetal(this.context, this.bus, 2100, 0.03, 0.22);
    playVoice(this.context, this.bus, {
      frequency: 380, glideTo: 880, duration: 0.42, gain: 0.045,
      type: 'sine', env: ENV.pad, detune: 8,
    });
    playVoice(this.context, this.buses.space, {
      frequency: 1320, duration: 0.7, gain: 0.022, type: 'sine', env: ENV.bell, delay: 0.1,
    });
  }

  ui(kind: 'click' | 'open' | 'close' | 'error' = 'click'): void {
    switch (kind) {
      case 'open':
        playVoice(this.context, this.bus, {
          frequency: 420, glideTo: 620, duration: 0.07, gain: 0.026, type: 'triangle', env: ENV.pluck,
        });
        break;
      case 'close':
        playVoice(this.context, this.bus, {
          frequency: 560, glideTo: 340, duration: 0.07, gain: 0.024, type: 'triangle', env: ENV.pluck,
        });
        break;
      case 'error':
        playVoice(this.context, this.bus, {
          frequency: 200, glideTo: 150, duration: 0.16, gain: 0.038, type: 'square', env: ENV.stab, cutoff: 900,
        });
        break;
      case 'click':
      default:
        playVoice(this.context, this.bus, {
          frequency: 520, duration: 0.03, gain: 0.02, type: 'square', env: ENV.perc, cutoff: 2600,
        });
        break;
    }
  }

  door(opening = true): void {
    playVoice(this.context, this.buses.space, {
      frequency: opening ? 90 : 110,
      glideTo: opening ? 130 : 70,
      duration: 0.6, gain: 0.045, type: 'sawtooth',
      env: ENV.pad, cutoff: 420, resonance: 6, vibrato: 20, vibratoRate: 7,
    });
    playNoise(this.context, this.bus, {
      buffer: this.brownNoise, duration: 0.3, gain: 0.03,
      cutoff: 600, cutoffTo: 200, env: ENV.perc, delay: 0.24,
    });
  }

  chest(): void {
    // Latch, hinge, then a bright reveal chord.
    playMetal(this.context, this.bus, 780, 0.045, 0.3);
    playVoice(this.context, this.buses.space, {
      frequency: 120, glideTo: 170, duration: 0.4, gain: 0.035,
      type: 'sawtooth', env: ENV.pad, cutoff: 500, resonance: 5, delay: 0.06,
    });
    [0, 4, 7].forEach((semi, i) => {
      playVoice(this.context, this.buses.space, {
        frequency: 660 * 2 ** (semi / 12), duration: 0.7, gain: 0.024,
        type: 'sine', env: ENV.bell, delay: 0.2 + i * 0.06,
      });
    });
  }

  craft(): void {
    // Hammer on anvil, three times, then a metallic ring.
    for (let i = 0; i < 3; i += 1) {
      playNoise(this.context, this.bus, {
        buffer: this.noise, duration: 0.05, gain: 0.06,
        cutoff: 5200, highpass: 900, env: ENV.perc, delay: i * 0.16,
      });
      playMetal(this.context, this.buses.space, 540 + i * 90, 0.045, 0.5, i * 0.16);
    }
    playMetal(this.context, this.buses.space, 1320, 0.04, 1.4, 0.52);
  }

  levelUp(): void {
    [0, 4, 7, 12, 16].forEach((semi, i) => {
      playVoice(this.context, this.bus, {
        frequency: 330 * 2 ** (semi / 12), duration: 0.5, gain: 0.04,
        type: 'triangle', env: ENV.bell, delay: i * 0.075, detune: 7,
      });
      playVoice(this.context, this.buses.space, {
        frequency: 330 * 2 ** (semi / 12) * 2, duration: 0.9, gain: 0.02,
        type: 'sine', env: ENV.bell, delay: i * 0.075 + 0.03,
      });
    });
  }

  riftOpen(): void {
    playVoice(this.context, this.buses.space, {
      frequency: 60, glideTo: 240, duration: 1.5, gain: 0.07,
      type: 'sawtooth', env: { attack: 0.5, decay: 0.4, sustain: 0.6, release: 0.9 },
      cutoff: 300, cutoffTo: 2600, resonance: 5, detune: 26,
    });
    playNoise(this.context, this.buses.space, {
      buffer: this.brownNoise, duration: 1.4, gain: 0.05,
      cutoff: 400, cutoffTo: 3200,
      env: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 0.7 },
    });
  }

  riftClose(): void {
    playVoice(this.context, this.buses.space, {
      frequency: 320, glideTo: 50, duration: 1.1, gain: 0.06,
      type: 'sawtooth', env: ENV.pad, cutoff: 2400, cutoffTo: 200, detune: 22,
    });
  }

  thunder(): void {
    // Distant storm: layered brown-noise rumbles with slow, irregular spacing.
    for (let i = 0; i < 4; i += 1) {
      playNoise(this.context, this.buses.space, {
        buffer: this.brownNoise,
        duration: 1.2 + Math.random() * 0.9,
        gain: 0.06 / (1 + i * 0.35),
        cutoff: 380 - i * 50, cutoffTo: 110,
        env: { attack: 0.03 + i * 0.05, decay: 0.5, sustain: 0.45, release: 1.1 },
        delay: i * (0.18 + Math.random() * 0.3),
        pan: (Math.random() - 0.5) * 1.4,
      });
    }
  }

  rainLayer(): { gain: GainNode; stop: () => void } {
    // Continuous rain bed the weather system fades in and out.
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const highpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 6200;
    highpass.type = 'highpass';
    highpass.frequency.value = 700;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.bus);
    source.start();
    return { gain, stop: () => { try { source.stop(); } catch { /* already stopped */ } } };
  }
}
