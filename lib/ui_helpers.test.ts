import { describe, expect, it } from "vitest";
import { formatMinor } from "./betslip";
import { isAudioEnabled, setAudioEnabled } from "./sound";

describe("UI formatting and helpers", () => {
  it("formats minor units with default currency (XTS)", () => {
    expect(formatMinor(1000000)).toBe("10,000.00 XTS");
    expect(formatMinor(50)).toBe("0.50 XTS");
    expect(formatMinor(0)).toBe("0.00 XTS");
  });

  it("formats minor units with explicit currency", () => {
    expect(formatMinor(250000, "EUR")).toBe("2,500.00 EUR");
    expect(formatMinor(100, "GBP")).toBe("1.00 GBP");
  });

  it("handles negative amounts or edge values gracefully", () => {
    expect(formatMinor(-5000)).toBe("-50.00 XTS");
  });

  it("handles audio toggle state defaults gracefully in test environment", () => {
    setAudioEnabled(false);
    expect(isAudioEnabled()).toBe(false);
    setAudioEnabled(true);
    expect(isAudioEnabled()).toBe(true);
  });
});
