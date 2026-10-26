/**
 * Virtual Stadium Audio Ambience & Procedural Crowd Acoustics Engine.
 *
 * Uses the Web Audio API to synthesize realistic matchday audio without external MP3 assets:
 * - Low-frequency stadium drone and murmuring crowd ambience
 * - Dynamic volume & frequency modulation tied to pitch possession and Expected Threat (xT)
 * - Explosive goal roar with acoustic stadium reverberation
 * - Dissonant dual-tone referee whistle (3000 Hz / 3250 Hz)
 * - Collective crowd groan on near-miss chances
 */

export interface StadiumAudioOptions {
  masterVolume?: number;
  muted?: boolean;
}

export class CrowdAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isPlaying = false;
  private muted = false;
  private masterVolume = 0.5;

  constructor(options?: StadiumAudioOptions) {
    if (options?.masterVolume !== undefined) this.masterVolume = options.masterVolume;
    if (options?.muted !== undefined) this.muted = options.muted;
  }

  private initContext(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return false;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return true;
  }

  /** Starts continuous procedural stadium crowd ambience */
  public startStadiumDrone(): void {
    if (!this.initContext() || !this.ctx || !this.masterGain) return;
    if (this.isPlaying) return;

    // Create 3 seconds of looped pink noise buffer for ambient crowd murmuring
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    // Lowpass filter to simulate distance & stadium enclosure acoustics
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.setValueAtTime(650, this.ctx.currentTime);

    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.noiseNode.connect(this.filterNode);
    this.filterNode.connect(this.crowdGain);
    this.crowdGain.connect(this.masterGain);

    this.noiseNode.start();
    this.isPlaying = true;
  }

  /** Modulates crowd excitement based on pitch zone threat (xT in [0, 1]) */
  public setThreatExcitement(threatLevel: number): void {
    if (!this.ctx || !this.crowdGain || !this.filterNode) return;
    const clamped = Math.max(0, Math.min(1, threatLevel));
    const targetGain = 0.25 + clamped * 0.45;
    const targetFreq = 500 + clamped * 1200;

    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(targetGain, t, 0.2);
    this.filterNode.frequency.setTargetAtTime(targetFreq, t, 0.3);
  }

  /** Plays explosive celebration roar on goal scored */
  public triggerGoalRoar(): void {
    if (!this.initContext() || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Boost crowd gain dramatically for 3.5 seconds
    if (this.crowdGain && this.filterNode) {
      this.crowdGain.gain.cancelScheduledValues(t);
      this.crowdGain.gain.setValueAtTime(0.85, t);
      this.crowdGain.gain.exponentialRampToValueAtTime(0.3, t + 3.8);

      this.filterNode.frequency.cancelScheduledValues(t);
      this.filterNode.frequency.setValueAtTime(2400, t);
      this.filterNode.frequency.exponentialRampToValueAtTime(650, t + 3.8);
    }
  }

  /** Plays crowd disappointment collective groan on missed chance */
  public triggerMissedChanceGroan(): void {
    if (!this.initContext() || !this.ctx || !this.crowdGain || !this.filterNode) return;
    const t = this.ctx.currentTime;
    this.filterNode.frequency.setValueAtTime(1400, t);
    this.filterNode.frequency.exponentialRampToValueAtTime(350, t + 1.2);
    this.crowdGain.gain.setValueAtTime(0.6, t);
    this.crowdGain.gain.exponentialRampToValueAtTime(0.25, t + 1.2);
  }

  /** Synthesizes official referee match whistle (dual-tone blast) */
  public triggerRefereeWhistle(isFullTime = false): void {
    if (!this.initContext() || !this.ctx || !this.masterGain) return;

    const blasts = isFullTime ? [0, 0.3, 0.65] : [0];
    const blastDuration = isFullTime ? 0.22 : 0.45;

    for (const offset of blasts) {
      const t = this.ctx.currentTime + offset;
      // Dissonant dual oscillators (3000 Hz + 3250 Hz)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const whistleGain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2980, t);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(3220, t);

      whistleGain.gain.setValueAtTime(0, t);
      whistleGain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      whistleGain.gain.exponentialRampToValueAtTime(0.001, t + blastDuration);

      osc1.connect(whistleGain);
      osc2.connect(whistleGain);
      whistleGain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + blastDuration);
      osc2.stop(t + blastDuration);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }
}

export const stadiumCrowdEngine = new CrowdAudioEngine();
