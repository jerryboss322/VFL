import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrowdAudioEngine } from "./crowd_audio_engine";

describe("CrowdAudioEngine", () => {
  let engine: CrowdAudioEngine;

  beforeEach(() => {
    engine = new CrowdAudioEngine({ masterVolume: 0.8, muted: false });
  });

  it("initializes with provided volume and unmute state", () => {
    expect(engine.isMuted()).toBe(false);
  });

  it("toggles mute state correctly", () => {
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);

    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
  });

  it("handles triggers gracefully in node/SSR environments without crashing", () => {
    expect(() => {
      engine.startStadiumDrone();
      engine.setThreatExcitement(0.75);
      engine.triggerGoalRoar();
      engine.triggerMissedChanceGroan();
      engine.triggerRefereeWhistle(false);
      engine.triggerRefereeWhistle(true);
    }).not.toThrow();
  });
});
