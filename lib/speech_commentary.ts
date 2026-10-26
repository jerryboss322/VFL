/**
 * Client-side Web Speech API Audio Commentary Engine.
 * Features priority queueing, urgency-based pitch/rate modulation, and live speech synthesis.
 */

export type CommentaryUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SpokenCommentaryItem {
  id: string;
  minute: number;
  text: string;
  urgency: CommentaryUrgency;
  pitch: number;
  rate: number;
  volume: number;
  timestampMs: number;
}

class SpeechCommentaryManager {
  private queue: SpokenCommentaryItem[] = [];
  private isSpeaking = false;
  private isMuted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private listeners: Set<(item: SpokenCommentaryItem | null, isSpeaking: boolean) => void> = new Set();
  private history: SpokenCommentaryItem[] = [];

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Load voices
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectDefaultVoice();
      };
      this.selectDefaultVoice();
    }
  }

  private selectDefaultVoice(langPrefix = "en") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(langPrefix)) || voices[0] || null;
    this.voice = match;
  }

  public setVoice(voice: SpeechSynthesisVoice) {
    this.voice = voice;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.notifyListeners(null);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getHistory(): SpokenCommentaryItem[] {
    return [...this.history];
  }

  public subscribe(cb: (item: SpokenCommentaryItem | null, isSpeaking: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notifyListeners(item: SpokenCommentaryItem | null) {
    this.listeners.forEach((cb) => cb(item, this.isSpeaking));
  }

  public speak(item: SpokenCommentaryItem) {
    this.history.unshift(item);
    if (this.history.length > 50) this.history.pop();

    if (this.isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.notifyListeners(item);
      return;
    }

    // Critical events (goals, red cards) interrupt any ongoing speech immediately
    if (item.urgency === "CRITICAL" && this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.queue = [];
    }

    this.queue.push(item);
    this.processQueue();
  }

  private processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const next = this.queue.shift();
    if (!next) return;

    const utterance = new SpeechSynthesisUtterance(next.text);
    if (this.voice) utterance.voice = this.voice;
    utterance.pitch = next.pitch;
    utterance.rate = next.rate;
    utterance.volume = next.volume;

    this.isSpeaking = true;
    this.notifyListeners(next);

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notifyListeners(null);
      this.processQueue();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.notifyListeners(null);
      this.processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }
}

export const speechCommentary = new SpeechCommentaryManager();
