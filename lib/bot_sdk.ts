/**
 * Algorithmic Sports Trading Bot Client SDK & Quantitative Strategy Engine.
 *
 * Provides quant developers and automated syndicates with:
 * - Kelly Criterion mathematical bankroll stake optimization
 * - Cross-market synthetic arbitrage opportunity scanner
 * - Backtesting simulation runner across historical match series
 * - Risk-adjusted Sharpe ratio and maximum drawdown calculations
 */

export interface BotStrategyConfig {
  name: string;
  fractionalKelly: number; // e.g. 0.25 (Quarter Kelly)
  maxBankrollAllocationPct: number; // e.g. 5.0%
  minEdgePct: number; // Minimum perceived positive edge (e.g. 3.0%)
  stopLossMinor: number;
}

export interface ArbitrageOpportunity {
  hasArbitrage: boolean;
  marketKey: string;
  impliedMarginPct: number;
  profitMarginPct: number;
  proportionalStakes: Record<string, number>; // oddsId -> % of bankroll
}

export interface BacktestSimulationResult {
  totalTrades: number;
  wonTrades: number;
  winRatePct: number;
  initialBankrollMinor: number;
  finalBankrollMinor: number;
  netProfitMinor: number;
  roiPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
}

/**
 * Computes optimal stake percentage using Fractional Kelly Criterion.
 *
 * f* = (b * p - q) / b
 * where:
 * - b = decimal odds - 1 (net fractional odds)
 * - p = true win probability estimated by model
 * - q = 1 - p (loss probability)
 */
export function calculateKellyStakeFraction(
  decimalOdds: number,
  trueWinProbability: number,
  fractionalKelly = 0.5,
  maxCapPct = 0.05
): number {
  if (decimalOdds <= 1.0 || trueWinProbability <= 0.0 || trueWinProbability >= 1.0) {
    return 0.0;
  }

  const b = decimalOdds - 1.0;
  const p = trueWinProbability;
  const q = 1.0 - p;

  const fullKelly = (b * p - q) / b;
  if (fullKelly <= 0) return 0.0; // Negative edge: no wager

  const scaledKelly = fullKelly * fractionalKelly;
  return Math.min(scaledKelly, maxCapPct);
}

/**
 * Scans a 2-way or 3-way partition of disjoint outcomes for synthetic arbitrage.
 * Sum(1 / Odds_i) < 1.00 indicates positive risk-free expected return.
 */
export function detectArbitrage(
  outcomes: Array<{ id: string; decimalOdds: number }>
): ArbitrageOpportunity {
  if (outcomes.length < 2) {
    return {
      hasArbitrage: false,
      marketKey: "INVALID",
      impliedMarginPct: 100,
      profitMarginPct: 0,
      proportionalStakes: {},
    };
  }

  const invertedSum = outcomes.reduce((acc, o) => acc + (o.decimalOdds > 0 ? 1 / o.decimalOdds : 0), 0);
  const marginPct = invertedSum * 100;
  const hasArbitrage = invertedSum < 0.995; // Allow for 0.5% threshold buffer
  const profitMarginPct = hasArbitrage ? ((1 - invertedSum) / invertedSum) * 100 : 0;

  const proportionalStakes: Record<string, number> = {};
  if (hasArbitrage) {
    for (const o of outcomes) {
      proportionalStakes[o.id] = (1 / o.decimalOdds / invertedSum) * 100;
    }
  }

  return {
    hasArbitrage,
    marketKey: "DISJOINT_SYNTHETIC",
    impliedMarginPct: Math.round(marginPct * 100) / 100,
    profitMarginPct: Math.round(profitMarginPct * 100) / 100,
    proportionalStakes,
  };
}

/**
 * Simulates an algorithmic trading strategy against historical wagers.
 */
export function simulateBacktest(
  trades: Array<{ decimalOdds: number; won: boolean; modelEstimatedWinProb: number }>,
  initialBankrollMinor = 1_000_000, // 10,000.00 XTS
  fractionalKelly = 0.33
): BacktestSimulationResult {
  let bankroll = initialBankrollMinor;
  let peakBankroll = initialBankrollMinor;
  let maxDrawdown = 0;
  let wonCount = 0;
  const returnSeries: number[] = [];

  for (const t of trades) {
    const stakeFraction = calculateKellyStakeFraction(
      t.decimalOdds,
      t.modelEstimatedWinProb,
      fractionalKelly,
      0.05
    );

    const stakeMinor = Math.floor(bankroll * stakeFraction);
    if (stakeMinor <= 0) continue;

    if (t.won) {
      wonCount++;
      const payout = Math.floor(stakeMinor * t.decimalOdds);
      const profit = payout - stakeMinor;
      bankroll += profit;
      returnSeries.push(profit / stakeMinor);
    } else {
      bankroll -= stakeMinor;
      returnSeries.push(-1.0);
    }

    if (bankroll > peakBankroll) peakBankroll = bankroll;
    const currentDrawdown = ((peakBankroll - bankroll) / peakBankroll) * 100;
    if (currentDrawdown > maxDrawdown) maxDrawdown = currentDrawdown;
  }

  const netProfit = bankroll - initialBankrollMinor;
  const roiPct = (netProfit / initialBankrollMinor) * 100;
  const winRate = trades.length > 0 ? (wonCount / trades.length) * 100 : 0;

  // Approximate Sharpe ratio (mean return / std deviation)
  let sharpe = 0;
  if (returnSeries.length > 1) {
    const mean = returnSeries.reduce((a, b) => a + b, 0) / returnSeries.length;
    const variance =
      returnSeries.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returnSeries.length - 1);
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(252) * 100) / 100 : 0;
  }

  return {
    totalTrades: trades.length,
    wonTrades: wonCount,
    winRatePct: Math.round(winRate * 10) / 10,
    initialBankrollMinor,
    finalBankrollMinor: bankroll,
    netProfitMinor: netProfit,
    roiPct: Math.round(roiPct * 10) / 10,
    maxDrawdownPct: Math.round(maxDrawdown * 10) / 10,
    sharpeRatio: sharpe,
  };
}
