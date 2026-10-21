export class AudioManager {
  private context?: AudioContext;
  private master = 0.65;

  setVolume(percent: number): void { this.master = Math.max(0, Math.min(1, percent / 100)); }

  play(kind: 'pickup' | 'pulse' | 'hit' | 'switch' | 'boss' | 'win' = 'pulse'): void {
    if (this.master <= 0) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      const now = this.context.currentTime;
      const notes: Record<typeof kind, number[]> = {
        pickup: [620, 880], pulse: [170, 75], hit: [110, 68], switch: [420, 620],
        boss: [90, 140, 80], win: [440, 660, 880],
      };
      const duration = kind === 'pulse' || kind === 'hit' ? 0.24 : 0.5;
      notes[kind].forEach((frequency, index) => {
        const osc = this.context!.createOscillator();
        const gain = this.context!.createGain();
        const start = now + index * 0.065;
        osc.type = kind === 'hit' || kind === 'boss' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.72), start + duration);
        gain.gain.setValueAtTime(this.master * 0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain); gain.connect(this.context!.destination);
        osc.start(start); osc.stop(start + duration);
      });
    } catch { /* Web Audio can be unavailable in restricted browser contexts */ }
  }
}
