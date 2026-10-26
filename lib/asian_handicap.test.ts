import { describe, it, expect } from "vitest";
import {
  formatAsianHandicapLine,
  explainAsianHandicapLine,
  simulateAsianHandicapSettlement,
  generateAsianHandicapOptions,
} from "./asian_handicap";

describe("Asian Handicap Formatting", () => {
  it("formats standard full and half lines correctly", () => {
    expect(formatAsianHandicapLine(0)).toBe("0.0");
    expect(formatAsianHandicapLine(-0.5)).toBe("-0.5");
    expect(formatAsianHandicapLine(0.5)).toBe("+0.5");
    expect(formatAsianHandicapLine(-1.0)).toBe("-1");
    expect(formatAsianHandicapLine(1.5)).toBe("+1.5");
  });

  it("formats quarter split lines into dual notation", () => {
    expect(formatAsianHandicapLine(-0.25)).toBe("0.0, -0.5");
    expect(formatAsianHandicapLine(0.25)).toBe("0.0, +0.5");
    expect(formatAsianHandicapLine(-0.75)).toBe("-0.5, -1");
    expect(formatAsianHandicapLine(0.75)).toBe("+0.5, +1");
  });

  it("provides helpful descriptive text", () => {
    const expZero = explainAsianHandicapLine(0.0, "Arsenal");
    expect(expZero).toContain("refunded (Push)");

    const expMinusQuarter = explainAsianHandicapLine(-0.25, "Liverpool");
    expect(expMinusQuarter).toContain("Split line");
    expect(expMinusQuarter).toContain("half your stake is refunded and half lost");
  });
});

describe("Asian Handicap Settlement Simulator", () => {
  it("settles 0.0 line correctly", () => {
    // 2-1 win -> WON
    const win = simulateAsianHandicapSettlement(10000, 1.9, 0.0, 2, 1, true);
    expect(win.outcome).toBe("WON");
    expect(win.returnMinor).toBe(19000);
    expect(win.profitMinor).toBe(9000);

    // 1-1 draw -> PUSH
    const push = simulateAsianHandicapSettlement(10000, 1.9, 0.0, 1, 1, true);
    expect(push.outcome).toBe("PUSH");
    expect(push.returnMinor).toBe(10000);
    expect(push.profitMinor).toBe(0);

    // 0-1 loss -> LOST
    const loss = simulateAsianHandicapSettlement(10000, 1.9, 0.0, 0, 1, true);
    expect(loss.outcome).toBe("LOST");
    expect(loss.returnMinor).toBe(0);
    expect(loss.profitMinor).toBe(-10000);
  });

  it("settles quarter line -0.25 on a draw as HALF_LOST", () => {
    // 10,000 stake: 5,000 on 0.0 (pushes -> 5000) and 5,000 on -0.5 (loses -> 0)
    const drawRes = simulateAsianHandicapSettlement(10000, 2.0, -0.25, 0, 0, true);
    expect(drawRes.outcome).toBe("HALF_LOST");
    expect(drawRes.returnMinor).toBe(5000);
    expect(drawRes.profitMinor).toBe(-5000);
  });

  it("settles quarter line +0.25 on a draw as HALF_WON", () => {
    // 10,000 stake @ 1.90: 5,000 on 0.0 (pushes -> 5,000) + 5,000 on +0.5 (wins -> 9,500) = 14,500
    const drawRes = simulateAsianHandicapSettlement(10000, 1.9, 0.25, 1, 1, true);
    expect(drawRes.outcome).toBe("HALF_WON");
    expect(drawRes.returnMinor).toBe(14500);
    expect(drawRes.profitMinor).toBe(4500);
  });
});

describe("Asian Handicap Market Generation", () => {
  it("generates 9 balanced handicap spreads", () => {
    const options = generateAsianHandicapOptions("Real Madrid", "Barcelona", 0.2);
    expect(options.length).toBe(9);
    expect(options.some((o) => o.handicap === 0.0)).toBe(true);
    expect(options.some((o) => o.handicap === -0.25)).toBe(true);
    expect(options.some((o) => o.handicap === 0.25)).toBe(true);
    for (const opt of options) {
      expect(opt.homeOdds).toBeGreaterThanOrEqual(1.15);
      expect(opt.awayOdds).toBeGreaterThanOrEqual(1.15);
    }
  });
});
