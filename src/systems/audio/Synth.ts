/**
 * Synth primitives for Trupy's runtime audio.
 *
 * The old audio layer fired one bare oscillator per note, which is why it read as
 * a beeping test tone rather than music. Everything here exists to fix that:
 * proper ADSR envelopes so notes have shape, detuned multi-oscillator voices so
 * they have body, a convolution reverb so the valley has space, and filtered
 * noise voices for wind, water and impacts.
 *
 * No audio files — every sample is generated from maths at load time.
 */

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export const ENV = {
  pluck: { attack: 0.004, decay: 0.09, sustain: 0.12, release: 0.22 },
  pad: { attack: 0.35, decay: 0.4, sustain: 0.65, release: 1.4 },
  bell: { attack: 0.002, decay: 0.55, sustain: 0.05, release: 1.1 },
  swell: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 2.2 },
  stab: { attack: 0.006, decay: 0.14, sustain: 0.2, release: 0.3 },
  perc: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.08 },
  bass: { attack: 0.02, decay: 0.2, sustain: 0.55, release: 0.5 },
} as const satisfies Record<string, Envelope>;

/** Apply an ADSR contour to a gain node. Returns when the note fully ends. */
export function applyEnvelope(
  gain: GainNode,
  now: number,
  duration: number,
  peak: number,
  env: Envelope,
): number {
  const attackEnd = now + env.attack;
  const decayEnd = attackEnd + env.decay;
  const sustainLevel = Math.max(0.0001, peak * env.sustain);
  const releaseStart = Math.max(decayEnd, now + duration);
  const end = releaseStart + env.release;

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), attackEnd);
  gain.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
  gain.gain.setValueAtTime(sustainLevel, releaseStart);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  return end;
}

/** Semitone offset from a root frequency. */
export function note(root: number, semitones: number): number {
  return root * 2 ** (semitones / 12);
}

/**
 * Build an impulse response for the reverb: exponentially decaying noise, with
 * the highs rolling off faster than the lows the way a real stone room behaves.
 */
export function buildImpulse(context: BaseAudioContext, seconds: number, decay: number, damp = 0.55): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let lowpass = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const envelope = (1 - t) ** decay;
      const white = Math.random() * 2 - 1;
      // One-pole lowpass makes the tail darken over time.
      lowpass += (white - lowpass) * (1 - damp * t);
      data[i] = lowpass * envelope;
    }
  }
  return buffer;
}

/** Pre-rendered noise loop. Cheaper than generating noise per-voice. */
export function buildNoise(context: BaseAudioContext, seconds: number, brown = 0): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown > 0) {
      last = last * brown + white * (1 - brown);
      data[i] = last * (1 / (1 - brown)) * 0.4;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export interface VoiceOptions {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  env?: Envelope;
  /** Second oscillator detuned by this many cents, for thickness. */
  detune?: number;
  /** Pitch glide target. */
  glideTo?: number;
  /** Lowpass cutoff; omit for no filter. */
  cutoff?: number;
  resonance?: number;
  /** Filter sweep target. */
  cutoffTo?: number;
  /** Delay before the note starts, in seconds. */
  delay?: number;
  /** Stereo pan, -1..1. */
  pan?: number;
  /** Vibrato depth in cents. */
  vibrato?: number;
  vibratoRate?: number;
}

/**
 * A single synth voice: one or two detuned oscillators through an optional
 * filter, an ADSR gain stage and a panner. Self-cleaning — everything is
 * scheduled up front and torn down on end.
 */
export function playVoice(context: AudioContext, destination: AudioNode, options: VoiceOptions): void {
  const {
    frequency, duration, gain, type = 'triangle', env = ENV.pluck,
    detune = 0, glideTo, cutoff, resonance = 1, cutoffTo, delay = 0, pan = 0,
    vibrato = 0, vibratoRate = 5.2,
  } = options;

  const now = context.currentTime + delay;
  const amp = context.createGain();
  let node: AudioNode = amp;

  if (cutoff !== undefined) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(60, cutoff), now);
    filter.Q.value = resonance;
    if (cutoffTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffTo), now + duration + env.release * 0.5);
    }
    amp.connect(filter);
    node = filter;
  }

  if (pan !== 0 && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(panner);
    node = panner;
  }
  node.connect(destination);

  const end = applyEnvelope(amp, now, duration, gain, env);
  const oscillators: OscillatorNode[] = [];
  const voices = detune !== 0 ? [0, detune] : [0];

  for (const cents of voices) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    if (cents !== 0) osc.detune.setValueAtTime(cents, now);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), now + duration);
    }
    if (vibrato > 0) {
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = vibratoRate;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(now);
      lfo.stop(end);
    }
    // Split gain across voices so detuning doesn't double the level.
    const voiceGain = context.createGain();
    voiceGain.gain.value = 1 / voices.length;
    osc.connect(voiceGain);
    voiceGain.connect(amp);
    osc.start(now);
    osc.stop(end + 0.02);
    oscillators.push(osc);
  }

  oscillators[oscillators.length - 1].onended = () => {
    amp.disconnect();
  };
}

export interface NoiseOptions {
  buffer: AudioBuffer;
  duration: number;
  gain: number;
  cutoff?: number;
  cutoffTo?: number;
  resonance?: number;
  highpass?: number;
  env?: Envelope;
  delay?: number;
  pan?: number;
  playbackRate?: number;
}

/** A filtered noise burst — footsteps, impacts, wind gusts, water. */
export function playNoise(context: AudioContext, destination: AudioNode, options: NoiseOptions): void {
  const {
    buffer, duration, gain, cutoff = 2200, cutoffTo, resonance = 0.8,
    highpass, env = ENV.perc, delay = 0, pan = 0, playbackRate = 1,
  } = options;

  const now = context.currentTime + delay;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  // Random start offset keeps repeated hits from sounding identical.
  const offset = Math.random() * Math.max(0, buffer.duration - duration - 0.05);

  const amp = context.createGain();
  let node: AudioNode = amp;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(60, cutoff), now);
  filter.Q.value = resonance;
  if (cutoffTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoffTo), now + duration);
  }
  source.connect(amp);
  amp.connect(filter);
  node = filter;

  if (highpass !== undefined) {
    const hp = context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highpass;
    node.connect(hp);
    node = hp;
  }

  if (pan !== 0 && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(panner);
    node = panner;
  }
  node.connect(destination);

  const end = applyEnvelope(amp, now, duration, gain, env);
  source.start(now, offset);
  source.stop(end + 0.02);
  source.onended = () => amp.disconnect();
}

/** Metallic ring built from inharmonic partials — swords, bells, chains. */
export function playMetal(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  gain: number,
  duration = 0.5,
  delay = 0,
): void {
  // Inharmonic ratios are what separate "metal" from "musical note".
  const partials = [1, 2.41, 3.83, 5.17, 6.94];
  partials.forEach((ratio, index) => {
    playVoice(context, destination, {
      frequency: frequency * ratio,
      duration: duration * (1 - index * 0.13),
      gain: gain / (1.7 + index * 1.5),
      type: index === 0 ? 'triangle' : 'sine',
      env: ENV.bell,
      delay,
      pan: (index % 2 ? 0.14 : -0.14),
    });
  });
}
