"use client";

/**
 * Web Audio API synthesized sound effects engine for Virtual Football.
 * Uses native oscillators and gain envelopes — zero external audio assets required.
 */

let audioCtx: AudioContext | null = null;
let memorySoundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      // @ts-expect-error webkit fallback
      window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isAudioEnabled(): boolean {
  if (typeof window === "undefined") return memorySoundEnabled;
  try {
    const stored = window.localStorage.getItem("vfu_sound_enabled");
    return stored === null ? memorySoundEnabled : stored === "true";
  } catch {
    return memorySoundEnabled;
  }
}

export function setAudioEnabled(enabled: boolean): void {
  memorySoundEnabled = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("vfu_sound_enabled", String(enabled));
  } catch {
    // ignore
  }
}

/**
 * Celebratory goal scored chime (Ascending melodic triad)
 */
export function playGoalChime(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

    gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + idx * 0.12);
    osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
  });
}

/**
 * Crisp ticket placement confirmation pop
 */
export function playBetPlacedSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.16);
}

/**
 * Rewarding cash out settlement chime
 */
export function playCashOutSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [587.33, 880.0]; // D5 -> A5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.1 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + idx * 0.1);
    osc.stop(ctx.currentTime + idx * 0.1 + 0.3);
  });
}

/**
 * Referee whistle blast for cards / match events
 */
export function playWhistleSound(): void {
  if (!isAudioEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  [0, 0.14].forEach((delay) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2400, ctx.currentTime + delay);
    osc.frequency.linearRampToValueAtTime(2200, ctx.currentTime + delay + 0.1);

    gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.11);
  });
}
