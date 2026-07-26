/**
 * Adaptive music for the Valley of the Dead.
 *
 * The score is generated, not sequenced from a file, but it is written like a
 * score: every region has a mode, a chord progression and an instrument
 * character, and four independent layers (drone, harmony, melody, percussion)
 * fade in and out according to what the player is doing. Wandering the marsh
 * gives you a low reed drone; a boss fight stacks all four layers in a minor
 * mode at double tempo.
 *
 * The point is that the music should tell you where you are and how much trouble
 * you're in without you ever consciously noticing it changed.
 */

import { ENV, note, playNoise, playVoice, type Envelope } from './Synth';

export type MusicRegion =
  | 'home' | 'village' | 'cemetery' | 'forest' | 'ruins'
  | 'marsh' | 'mine' | 'docks' | 'citadel' | 'interior';

export type MusicIntensity = 'calm' | 'tense' | 'combat' | 'boss';

/** Scale degrees as semitone offsets. Modes carry most of the emotional weight. */
const MODE = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const;

type ModeName = keyof typeof MODE;

interface RegionScore {
  /** Tonic frequency, in Hz. Low roots feel heavier. */
  root: number;
  mode: ModeName;
  /** Chord roots as scale-degree indices, one per bar. */
  progression: number[];
  /** Melody instrument character. */
  lead: OscillatorType;
  /** Pad/harmony character. */
  pad: OscillatorType;
  /** Beats per minute at calm intensity. */
  tempo: number;
  /** How much reverb this space gets, 0..1. */
  space: number;
  /** Melodic activity, 0..1 — how often the lead plays. */
  density: number;
  /** Extra brightness on the lead filter. */
  brightness: number;
}

/**
 * Region palettes. Deliberately distinct: the village is warm and modal, the
 * cemetery sits in phrygian half-steps, the citadel uses harmonic minor for that
 * unresolved dread, and the mine drops to locrian — the most unstable mode there
 * is — because nothing down there should feel safe.
 */
const SCORES: Record<MusicRegion, RegionScore> = {
  home: { root: 174.61, mode: 'dorian', progression: [0, 5, 3, 4], lead: 'triangle', pad: 'sine', tempo: 62, space: 0.4, density: 0.5, brightness: 1500 },
  village: { root: 196, mode: 'mixolydian', progression: [0, 4, 5, 4], lead: 'triangle', pad: 'triangle', tempo: 78, space: 0.3, density: 0.68, brightness: 2100 },
  cemetery: { root: 146.83, mode: 'phrygian', progression: [0, 1, 0, 5], lead: 'sine', pad: 'sine', tempo: 52, space: 0.72, density: 0.34, brightness: 1050 },
  forest: { root: 164.81, mode: 'aeolian', progression: [0, 3, 5, 2], lead: 'triangle', pad: 'sine', tempo: 66, space: 0.5, density: 0.52, brightness: 1750 },
  ruins: { root: 138.59, mode: 'locrian', progression: [0, 4, 1, 5], lead: 'sawtooth', pad: 'sine', tempo: 58, space: 0.68, density: 0.42, brightness: 1250 },
  marsh: { root: 130.81, mode: 'phrygian', progression: [0, 5, 1, 3], lead: 'sine', pad: 'triangle', tempo: 48, space: 0.6, density: 0.3, brightness: 900 },
  mine: { root: 123.47, mode: 'locrian', progression: [0, 1, 4, 1], lead: 'square', pad: 'sine', tempo: 54, space: 0.85, density: 0.28, brightness: 780 },
  docks: { root: 155.56, mode: 'dorian', progression: [0, 5, 4, 2], lead: 'triangle', pad: 'triangle', tempo: 70, space: 0.45, density: 0.56, brightness: 1850 },
  citadel: { root: 116.54, mode: 'harmonicMinor', progression: [0, 5, 4, 6], lead: 'sawtooth', pad: 'sawtooth', tempo: 60, space: 0.7, density: 0.46, brightness: 1400 },
  interior: { root: 185, mode: 'dorian', progression: [0, 3, 4, 3], lead: 'triangle', pad: 'sine', tempo: 68, space: 0.35, density: 0.44, brightness: 1650 },
};

/** Intensity shapes tempo, layer mix and mode darkening. */
const INTENSITY: Record<MusicIntensity, {
  tempoScale: number;
  drone: number;
  harmony: number;
  melody: number;
  percussion: number;
  /** Flatten scale degrees for extra menace. */
  darken: boolean;
}> = {
  calm: { tempoScale: 1, drone: 0.9, harmony: 0.6, melody: 0.7, percussion: 0, darken: false },
  tense: { tempoScale: 1.16, drone: 1, harmony: 0.8, melody: 0.5, percussion: 0.35, darken: false },
  combat: { tempoScale: 1.5, drone: 0.85, harmony: 0.95, melody: 0.9, percussion: 1, darken: true },
  boss: { tempoScale: 1.62, drone: 1, harmony: 1, melody: 1, percussion: 1.15, darken: true },
};

export interface MusicBuses {
  drone: GainNode;
  harmony: GainNode;
  melody: GainNode;
  percussion: GainNode;
  /** Reverb send. */
  space: GainNode;
}

/**
 * Sequences the score. One `step()` call per sixteenth note; the caller drives
 * timing so music stays in sync with the game loop rather than a stray timer.
 */
export class MusicDirector {
  private region: MusicRegion = 'home';
  private intensity: MusicIntensity = 'calm';
  private step16 = 0;
  private bar = 0;
  /** Melody contour memory, so phrases feel intentional rather than random. */
  private melodyIndex = 3;
  private melodyDirection = 1;
  private phraseCounter = 0;
  private lastNoteAt = -1;

  constructor(
    private readonly context: AudioContext,
    private readonly buses: MusicBuses,
  ) {}

  setRegion(region: MusicRegion): void {
    if (this.region === region) return;
    this.region = region;
    // Reset the phrase so a new area starts on a downbeat.
    this.step16 = 0;
    this.bar = 0;
    this.melodyIndex = 3;
    this.phraseCounter = 0;
  }

  setIntensity(intensity: MusicIntensity): void {
    this.intensity = intensity;
  }

  getRegion(): MusicRegion { return this.region; }
  getIntensity(): MusicIntensity { return this.intensity; }

  /** Milliseconds per sixteenth note at the current tempo. */
  stepDuration(): number {
    const score = SCORES[this.region];
    const bpm = score.tempo * INTENSITY[this.intensity].tempoScale;
    return (60 / bpm / 4) * 1000;
  }

  /** Current chord root frequency — used by SFX so hits sit in key. */
  currentChordRoot(): number {
    const score = SCORES[this.region];
    const degrees = MODE[score.mode];
    const chordDegree = score.progression[this.bar % score.progression.length];
    return note(score.root, degrees[chordDegree % degrees.length]);
  }

  /** Advance the sequencer by one sixteenth. */
  step(): void {
    const score = SCORES[this.region];
    const mix = INTENSITY[this.intensity];
    const degrees = MODE[score.mode];
    const beat = Math.floor(this.step16 / 4) % 4;
    const sixteenth = this.step16 % 16;
    const chordDegree = score.progression[this.bar % score.progression.length];
    const chordRoot = note(score.root, degrees[chordDegree % degrees.length]);
    const stepSeconds = this.stepDuration() / 1000;
    const reverbSend = score.space;

    // ---- Drone: the floor of the mix. One long low note per bar.
    if (sixteenth === 0 && mix.drone > 0) {
      const droneGain = 0.05 * mix.drone;
      playVoice(this.context, this.buses.drone, {
        frequency: chordRoot / 2,
        duration: stepSeconds * 15,
        gain: droneGain,
        type: score.pad,
        env: ENV.swell,
        detune: 7,
        cutoff: 420 + score.brightness * 0.1,
      });
      // Fifth above, quieter — gives the drone weight without muddying it.
      playVoice(this.context, this.buses.space, {
        frequency: (chordRoot / 2) * 1.5,
        duration: stepSeconds * 14,
        gain: droneGain * 0.4 * reverbSend,
        type: 'sine',
        env: ENV.swell,
      });
    }

    // ---- Harmony: arpeggiated chord tones on the off-beats.
    if (mix.harmony > 0 && sixteenth % 4 === 2) {
      const chordTones = [0, 2, 4, 6];
      const tone = chordTones[(Math.floor(this.step16 / 4) + this.bar) % chordTones.length];
      const degree = (chordDegree + tone) % degrees.length;
      const octave = tone >= 4 ? 1 : 0;
      playVoice(this.context, this.buses.harmony, {
        frequency: note(score.root, degrees[degree]) * (1 + octave),
        duration: stepSeconds * 2.6,
        gain: 0.028 * mix.harmony,
        type: score.pad,
        env: ENV.pad,
        detune: 5,
        cutoff: score.brightness * 0.7,
        pan: (tone % 2 ? 0.22 : -0.22),
      });
    }

    // ---- Melody: a wandering line with real contour. It steps through the mode,
    // turns around at the edges of its range, and rests between phrases so it
    // breathes instead of noodling forever.
    const melodyChance = score.density * mix.melody;
    const onMelodyGrid = sixteenth % 2 === 0;
    if (onMelodyGrid && this.step16 !== this.lastNoteAt) {
      // Deterministic-ish pseudo random keeps phrasing musical but varied.
      const roll = pseudoRandom(this.step16 * 7 + this.bar * 31 + score.root);
      if (roll < melodyChance) {
        this.melodyIndex += this.melodyDirection * (roll < melodyChance * 0.3 ? 2 : 1);
        if (this.melodyIndex > 9) { this.melodyIndex = 9; this.melodyDirection = -1; }
        if (this.melodyIndex < 0) { this.melodyIndex = 0; this.melodyDirection = 1; }
        // Occasionally reverse direction mid-phrase for interest.
        if (roll > melodyChance * 0.86) this.melodyDirection *= -1;

        const degreeIndex = this.melodyIndex % degrees.length;
        const octaveShift = Math.floor(this.melodyIndex / degrees.length);
        let semitone = degrees[degreeIndex] + octaveShift * 12;
        if (mix.darken && degreeIndex === 1) semitone -= 1;

        const isAccent = beat === 0 && sixteenth % 8 === 0;
        playVoice(this.context, this.buses.melody, {
          frequency: note(score.root * 2, semitone),
          duration: stepSeconds * (isAccent ? 3.4 : 1.9),
          gain: (isAccent ? 0.05 : 0.034) * mix.melody,
          type: score.lead,
          env: this.intensity === 'calm' ? ENV.bell : ENV.pluck,
          cutoff: score.brightness,
          cutoffTo: score.brightness * 0.55,
          resonance: 1.6,
          vibrato: this.intensity === 'boss' ? 12 : 5,
          pan: 0.1,
        });
        // Reverb tail on the melody makes the space audible.
        playVoice(this.context, this.buses.space, {
          frequency: note(score.root * 2, semitone),
          duration: stepSeconds * 2,
          gain: 0.02 * reverbSend * mix.melody,
          type: 'sine',
          env: ENV.bell,
          delay: 0.03,
        });
        this.phraseCounter += 1;
        this.lastNoteAt = this.step16;
      }
    }

    // ---- Percussion: only appears when things get dangerous, which is what
    // makes combat feel different rather than just louder.
    if (mix.percussion > 0) {
      const kickPattern = this.intensity === 'boss' ? [0, 6, 8, 14] : [0, 8];
      const snarePattern = this.intensity === 'boss' ? [4, 12] : [12];
      if (kickPattern.includes(sixteenth)) {
        playVoice(this.context, this.buses.percussion, {
          frequency: 82,
          duration: 0.1,
          gain: 0.1 * mix.percussion,
          type: 'sine',
          env: ENV.perc,
          glideTo: 40,
        });
      }
      if (snarePattern.includes(sixteenth)) {
        playNoise(this.context, this.buses.percussion, {
          buffer: this.noise,
          duration: 0.09,
          gain: 0.05 * mix.percussion,
          cutoff: 3400,
          highpass: 900,
          env: ENV.perc,
        });
      }
      // Hi-hat ticks at boss intensity add urgency.
      if (this.intensity === 'boss' && sixteenth % 2 === 0) {
        playNoise(this.context, this.buses.percussion, {
          buffer: this.noise,
          duration: 0.03,
          gain: 0.016 * mix.percussion,
          cutoff: 9000,
          highpass: 5200,
          env: ENV.perc,
        });
      }
    }

    this.step16 += 1;
    if (this.step16 % 16 === 0) {
      this.bar += 1;
      // Rest for a bar every four phrases so the melody has punctuation.
      if (this.phraseCounter > 14) this.phraseCounter = 0;
    }
  }

  /** Noise buffer, injected by the manager (shared to avoid re-allocating). */
  private noise!: AudioBuffer;
  setNoise(buffer: AudioBuffer): void { this.noise = buffer; }

  /** A short stinger when the player enters a new region. */
  regionStinger(): void {
    const score = SCORES[this.region];
    const degrees = MODE[score.mode];
    [0, 4, 2].forEach((degree, index) => {
      playVoice(this.context, this.buses.space, {
        frequency: note(score.root * 2, degrees[degree % degrees.length]),
        duration: 0.9,
        gain: 0.036,
        type: 'sine',
        env: ENV.bell,
        delay: index * 0.075,
      });
    });
  }

  /** Triumphant flourish — quest turn-in, tier unlock. */
  fanfare(): void {
    const score = SCORES[this.region];
    [0, 4, 7, 12].forEach((semitone, index) => {
      playVoice(this.context, this.buses.melody, {
        frequency: note(score.root * 2, semitone),
        duration: 0.5,
        gain: 0.045,
        type: 'triangle',
        env: ENV.bell,
        delay: index * 0.085,
        detune: 6,
      });
      playVoice(this.context, this.buses.space, {
        frequency: note(score.root * 2, semitone),
        duration: 1.3,
        gain: 0.03,
        type: 'sine',
        env: ENV.bell,
        delay: index * 0.085 + 0.02,
      });
    });
  }

  /** Descending figure for death — the score giving up. */
  deathMotif(): void {
    const score = SCORES[this.region];
    [0, -2, -5, -9, -12].forEach((semitone, index) => {
      playVoice(this.context, this.buses.melody, {
        frequency: note(score.root, semitone),
        duration: 0.8,
        gain: 0.05,
        type: 'sine',
        env: ENV.pad,
        delay: index * 0.18,
        cutoff: 900,
        cutoffTo: 300,
      });
    });
  }
}

/** Cheap deterministic hash to 0..1 — musical decisions need repeatability. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export const MUSIC_REGIONS = Object.keys(SCORES) as MusicRegion[];
export type { Envelope };
