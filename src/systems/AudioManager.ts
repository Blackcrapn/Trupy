export type AudioRegion = 'home' | 'village' | 'cemetery' | 'forest' | 'ruins' | 'marsh' | 'mine' | 'docks' | 'citadel' | 'interior';

interface AudioMix {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  enabled: boolean;
}

const REGION_ROOT: Record<AudioRegion, number> = {
  home: 174.61,
  village: 196,
  cemetery: 146.83,
  forest: 164.81,
  ruins: 138.59,
  marsh: 130.81,
  mine: 123.47,
  docks: 155.56,
  citadel: 116.54,
  interior: 185,
};

const REGION_SCALE: Record<AudioRegion, number[]> = {
  home: [0, 3, 7, 10, 7, 3, 5, 7],
  village: [0, 4, 7, 9, 7, 4, 2, 4],
  cemetery: [0, 3, 6, 10, 6, 3, 1, 6],
  forest: [0, 3, 7, 12, 10, 7, 3, 5],
  ruins: [0, 1, 6, 8, 6, 3, 1, -2],
  marsh: [0, 1, 5, 7, 3, 1, -2, 1],
  mine: [0, 3, 6, 7, 3, 0, -5, -2],
  docks: [0, 5, 7, 10, 7, 5, 2, 5],
  citadel: [0, 1, 6, 12, 8, 6, 1, -4],
  interior: [0, 4, 7, 11, 7, 4, 2, 4],
};

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private ambienceBus?: GainNode;
  private ambienceSource?: AudioBufferSourceNode;
  private ambienceFilter?: BiquadFilterNode;
  private musicTimer?: number;
  private stepIndex = 0;
  private footstepIndex = 0;
  private region: AudioRegion = 'home';
  private combat = false;
  private unlocked = false;
  private mix: AudioMix = { master: .85, music: .55, sfx: .8, ambience: .5, enabled: true };

  async unlock(): Promise<void> {
    if (!this.context) this.createGraph();
    if (!this.context) return;
    if (this.context.state === 'suspended') await this.context.resume();
    this.unlocked = true;
    document.documentElement.dataset.audio = this.context.state;
    this.applyMix();
    this.startAmbience();
    this.startMusic();
    this.ui();
  }

  setMix(mix: Partial<AudioMix>): void {
    this.mix = { ...this.mix, ...mix };
    this.applyMix();
    if (this.mix.enabled && this.unlocked) {
      this.startAmbience();
      this.startMusic();
    }
  }

  isUnlocked(): boolean { return this.unlocked && this.context?.state === 'running'; }

  setRegion(region: AudioRegion, combat = this.combat): void {
    const changed = region !== this.region;
    this.region = region;
    this.combat = combat;
    if (changed) {
      this.stepIndex = 0;
      this.updateAmbienceTone();
      this.chime(REGION_ROOT[region] * 2, .22, .04);
    }
  }

  setCombat(combat: boolean): void {
    if (combat === this.combat) return;
    this.combat = combat;
    if (combat) this.percussion(.08);
  }

  attack(kind: string): void {
    if (kind === 'melee') this.sweep(210, 58, .09, .09, 'sawtooth');
    else if (kind === 'ranged') { this.tone(560, .045, 'square', .07, 180); this.noiseBurst(.035, .035, 1100); }
    else { this.sweep(220, 820, .2, .07, 'triangle'); this.chime(1040, .18, .03); }
  }

  hit(): void { this.noiseBurst(.08, .09, 240); this.tone(82, .1, 'square', .05, 45); }
  coin(): void { this.tone(740, .07, 'square', .045, 980); this.tone(980, .08, 'triangle', .025, 1180, .055); }
  quest(): void { [0, 4, 7, 12].forEach((semi, index) => this.tone(320 * 2 ** (semi / 12), .3, 'triangle', .04, undefined, index * .08)); }
  heal(): void { this.sweep(380, 920, .32, .055, 'sine'); this.chime(1220, .28, .025); }
  ui(): void { this.tone(310, .035, 'square', .03, 390); }
  pickup(): void { this.tone(510, .05, 'triangle', .035, 690); }
  chest(): void { this.noiseBurst(.12, .04, 560); this.quest(); }
  door(): void { this.noiseBurst(.18, .05, 150); this.tone(72, .14, 'triangle', .04, 48); }

  step(surface: 'stone' | 'wood' | 'grass' | 'water' = 'grass'): void {
    this.footstepIndex += 1;
    const frequency = surface === 'wood' ? 180 : surface === 'stone' ? 115 : surface === 'water' ? 240 : 145;
    this.noiseBurst(.035, .025, frequency * 2.3);
    this.tone(frequency + (this.footstepIndex % 2) * 18, .035, 'triangle', .018, frequency * .7);
  }

  private createGraph(): void {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.sfxBus = this.context.createGain();
    this.ambienceBus = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.ambienceBus.connect(this.master);
    this.master.connect(compressor);
    compressor.connect(this.context.destination);
    this.applyMix();
    document.addEventListener('visibilitychange', () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend();
      else if (this.mix.enabled) void this.context.resume();
    });
  }

  private applyMix(): void {
    if (!this.context || !this.master || !this.musicBus || !this.sfxBus || !this.ambienceBus) return;
    const now = this.context.currentTime;
    const enabled = this.mix.enabled ? 1 : 0;
    this.master.gain.setTargetAtTime(this.mix.master * enabled, now, .03);
    this.musicBus.gain.setTargetAtTime(this.mix.music * .28, now, .08);
    this.sfxBus.gain.setTargetAtTime(this.mix.sfx * .7, now, .03);
    this.ambienceBus.gain.setTargetAtTime(this.mix.ambience * .16, now, .1);
  }

  private startMusic(): void {
    if (!this.unlocked || this.musicTimer || !this.mix.enabled) return;
    const tick = () => {
      this.playMusicStep();
      this.musicTimer = window.setTimeout(tick, this.combat ? 180 : 330);
    };
    tick();
  }

  private playMusicStep(): void {
    const root = REGION_ROOT[this.region];
    const scale = REGION_SCALE[this.region];
    const step = this.stepIndex % scale.length;
    const note = root * 2 ** (scale[step] / 12);
    const duration = this.combat ? .2 : .55;
    this.musicTone(note, duration, step % 2 ? 'triangle' : 'sine', this.combat ? .08 : .045);
    if (step % 4 === 0) {
      this.musicTone(root / 2, this.combat ? .35 : 1.2, 'sine', this.combat ? .08 : .035);
      this.musicTone(root * 2 ** (scale[(step + 2) % scale.length] / 12), this.combat ? .25 : .8, 'triangle', .022, .02);
    }
    if (this.combat && step % 2 === 0) this.percussion(step % 4 === 0 ? .09 : .05);
    this.stepIndex += 1;
  }

  private startAmbience(): void {
    if (!this.context || !this.ambienceBus || this.ambienceSource || !this.mix.enabled) return;
    const length = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      last = last * .985 + white * .015;
      data[index] = last * 3.2;
    }
    this.ambienceSource = this.context.createBufferSource();
    this.ambienceFilter = this.context.createBiquadFilter();
    this.ambienceSource.buffer = buffer;
    this.ambienceSource.loop = true;
    this.ambienceFilter.type = 'lowpass';
    this.ambienceSource.connect(this.ambienceFilter);
    this.ambienceFilter.connect(this.ambienceBus);
    this.updateAmbienceTone();
    this.ambienceSource.start();
  }

  private updateAmbienceTone(): void {
    if (!this.context || !this.ambienceFilter) return;
    const frequencies: Record<AudioRegion, number> = { home: 560, village: 720, cemetery: 310, forest: 980, ruins: 260, marsh: 430, mine: 180, docks: 820, citadel: 240, interior: 380 };
    this.ambienceFilter.frequency.setTargetAtTime(frequencies[this.region], this.context.currentTime, .4);
  }

  private musicTone(frequency: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    this.playTone(this.musicBus, frequency, duration, type, gain, undefined, delay);
  }

  private tone(frequency: number, duration = .08, type: OscillatorType = 'square', gain = .04, endFrequency?: number, delay = 0): void {
    this.playTone(this.sfxBus, frequency, duration, type, gain, endFrequency, delay);
  }

  private sweep(start: number, end: number, duration: number, gain: number, type: OscillatorType): void {
    this.tone(start, duration, type, gain, end);
  }

  private chime(frequency: number, duration: number, gain: number): void {
    this.tone(frequency, duration, 'sine', gain);
    this.tone(frequency * 1.5, duration * .75, 'sine', gain * .5, undefined, .03);
  }

  private playTone(bus: GainNode | undefined, frequency: number, duration: number, type: OscillatorType, gain: number, endFrequency?: number, delay = 0): void {
    if (!this.context || !bus || !this.unlocked || !this.mix.enabled) return;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    const now = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    volume.gain.setValueAtTime(.0001, now);
    volume.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), now + .008);
    volume.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(volume);
    volume.connect(bus);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  private percussion(gain: number): void {
    this.noiseBurst(.055, gain, 160);
    this.tone(64, .08, 'sine', gain * .8, 38);
  }

  private noiseBurst(duration: number, gain: number, cutoff: number): void {
    if (!this.context || !this.sfxBus || !this.unlocked || !this.mix.enabled) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const volume = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    volume.gain.setValueAtTime(gain, this.context.currentTime);
    volume.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(volume);
    volume.connect(this.sfxBus);
    source.start();
  }
}

export const audio = new AudioManager();
