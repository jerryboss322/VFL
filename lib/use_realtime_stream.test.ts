import { describe, it, expect } from "vitest";
import { calculateBackoffMs } from "./use_realtime_stream";

describe("Realtime Stream Backoff Math", () => {
  it("calculates exponential backoff within bounds", () => {
    const delay0 = calculateBackoffMs(0, 30000);
    expect(delay0).toBeGreaterThanOrEqual(700);
    expect(delay0).toBeLessThanOrEqual(1500);

    const delay2 = calculateBackoffMs(2, 30000);
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(5000);

    // Max ceiling enforced
    const delayHuge = calculateBackoffMs(20, 30000);
    expect(delayHuge).toBeLessThanOrEqual(36000); // 30000 * 1.2 jitter
  });
});
