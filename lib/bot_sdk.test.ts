import { describe, it, expect } from "vitest";
import {
  calculateKellyStakeFraction,
  detectArbitrage,
  simulateBacktest,
} from "./bot_sdk";

describe("Bot Strategy SDK", () => {
  it("calculates positive fractional Kelly sizing when model has an edge", () => {
    // Odds 2.50 (implied 40%), model says true probability is 50% (+10% edge)
    // Full Kelly: (1.5 * 0.5 - 0.5) / 1.5 = 0.25 / 1.5 = 16.66%
    // Half Kelly (0.5): 8.33% -> capped at maxCap 5%
    const fraction = calculateKellyStakeFraction(2.5, 0.5, 0.5, 0.05);
    expect(fraction).toBe(0.05);

    // Uncapped Quarter Kelly: 16.66% * 0.25 = 4.16%
    const uncapped = calculateKellyStakeFraction(2.5, 0.5, 0.25, 0.1);
    expect(uncapped).toBeCloseTo(0.0416, 3);
  });

  it("returns zero stake when model has negative expectation", () => {
    // Odds 2.00 (implied 50%), model says true probability is 40% (Negative expectation)
    const fraction = calculateKellyStakeFraction(2.0, 0.4, 0.5, 0.05);
    expect(fraction).toBe(0.0);
  });

  it("detects genuine cross-market synthetic arbitrage", () => {
    // Bookmaker A has Home Win @ 2.20, Bookmaker B has Away Win/Draw @ 2.20
    // 1/2.20 + 1/2.20 = 0.4545 + 0.4545 = 0.909 (< 0.995 threshold)
    const arb = detectArbitrage([
      { id: "home-win", decimalOdds: 2.2 },
      { id: "away-win-or-draw", decimalOdds: 2.2 },
    ]);

    expect(arb.hasArbitrage).toBe(true);
    expect(arb.profitMarginPct).toBeGreaterThan(9.0);
    expect(arb.proportionalStakes["home-win"]).toBeCloseTo(50.0, 1);
  });

  it("simulates strategy backtest and accurately calculates ROI and drawdown", () => {
    const historicalTrades = [
      { decimalOdds: 2.1, won: true, modelEstimatedWinProb: 0.6 },
      { decimalOdds: 1.95, won: true, modelEstimatedWinProb: 0.58 },
      { decimalOdds: 2.4, won: false, modelEstimatedWinProb: 0.48 },
      { decimalOdds: 2.05, won: true, modelEstimatedWinProb: 0.55 },
      { decimalOdds: 1.85, won: false, modelEstimatedWinProb: 0.6 },
    ];

    const result = simulateBacktest(historicalTrades, 1_000_000, 0.33);

    expect(result.totalTrades).toBe(5);
    expect(result.wonTrades).toBe(3);
    expect(result.winRatePct).toBe(60.0);
    expect(result.finalBankrollMinor).toBeGreaterThan(1_000_000);
    expect(result.netProfitMinor).toBeGreaterThan(0);
    expect(result.maxDrawdownPct).toBeGreaterThan(0);
  });
});
