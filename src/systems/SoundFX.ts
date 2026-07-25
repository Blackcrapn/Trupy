export class SoundFX {
  private context?: AudioContext;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private getContext(): AudioContext | undefined {
    if (!this.enabled) return undefined;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  tone(frequency: number, duration = 0.08, type: OscillatorType = 'square', gain = 0.025, endFrequency?: number): void {
    const context = this.getContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    volume.gain.setValueAtTime(gain, now);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  attack(kind: string): void {
    if (kind === 'melee') this.tone(180, 0.075, 'sawtooth', 0.028, 70);
    else if (kind === 'ranged') this.tone(520, 0.055, 'square', 0.02, 180);
    else this.tone(240, 0.16, 'triangle', 0.035, 720);
  }

  hit(): void { this.tone(95, 0.09, 'square', 0.025, 42); }
  coin(): void { this.tone(740, 0.08, 'square', 0.025, 980); }
  quest(): void { this.tone(360, 0.28, 'triangle', 0.035, 760); }
  heal(): void { this.tone(420, 0.22, 'sine', 0.035, 880); }
  ui(): void { this.tone(280, 0.035, 'square', 0.012, 350); }
}
