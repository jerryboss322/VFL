/**
 * Asian Handicap and Alternative Spread Calculation Library.
 * Handles split quarter handicaps (+/- 0.25, +/- 0.75), half handicaps (+/- 0.5, +/- 1.5),
 * and level ball (0.0 / Draw No Bet).
 */

export type AsianOutcome = "WON" | "HALF_WON" | "PUSH" | "HALF_LOST" | "LOST";

export interface AsianSettlementSimulation {
  outcome: AsianOutcome;
  returnMinor: number;
  profitMinor: number;
  explanation: string;
}

export interface AsianHandicapOption {
  key: string;
  handicap: number;
  label: string;
  homeOdds: number;
  awayOdds: number;
  description: string;
}

/**
 * Format Asian Handicap line to standard betting notation.
 * e.g. -0.25 -> "0.0, -0.5"
 * e.g. +0.75 -> "+0.5, +1.0"
 * e.g. 0.0 -> "0.0"
 * e.g. -0.5 -> "-0.5"
 */
export function formatAsianHandicapLine(line: number): string {
  if (line === 0) return "0.0";

  const absLine = Math.abs(line);
  const sign = line > 0 ? "+" : "-";
  const rem = absLine % 1;

  if (Math.abs(rem - 0.25) < 0.001) {
    const lower = line > 0 ? absLine - 0.25 : -(absLine - 0.25);
    const upper = line > 0 ? absLine + 0.25 : -(absLine + 0.25);
    const formatPart = (val: number) => (val === 0 ? "0.0" : val > 0 ? `+${val}` : `${val}`);
    return `${formatPart(lower)}, ${formatPart(upper)}`;
  }

  if (Math.abs(rem - 0.75) < 0.001) {
    const lower = line > 0 ? absLine - 0.25 : -(absLine - 0.25);
    const upper = line > 0 ? absLine + 0.25 : -(absLine + 0.25);
    const formatPart = (val: number) => (val === 0 ? "0.0" : val > 0 ? `+${val}` : `${val}`);
    return `${formatPart(lower)}, ${formatPart(upper)}`;
  }

  return line > 0 ? `+${line}` : `${line}`;
}

/**
 * Explains how an Asian Handicap line works in plain English for bettors.
 */
export function explainAsianHandicapLine(line: number, teamName: string): string {
  const formatted = formatAsianHandicapLine(line);
  if (line === 0) {
    return `${teamName} must win. If the match is a draw, your entire stake is refunded (Push).`;
  }
  if (line === -0.5) {
    return `${teamName} must win by 1 or more goals. Any draw or defeat results in a loss.`;
  }
  if (line === 0.5) {
    return `${teamName} wins if they win or draw the match. You only lose if they are defeated.`;
  }
  if (line === -0.25) {
    return `Split line (${formatted}). If ${teamName} wins, you win full. If match draws, half your stake is refunded and half lost.`;
  }
  if (line === 0.25) {
    return `Split line (${formatted}). If ${teamName} wins, you win full. If match draws, half your bet wins at given odds and half is refunded.`;
  }
  if (line === -0.75) {
    return `Split line (${formatted}). ${teamName} must win by 2+ goals for full win. A 1-goal win pays half-win (half win, half refunded).`;
  }
  if (line === 0.75) {
    return `Split line (${formatted}). Win if ${teamName} wins or draws. If ${teamName} loses by exactly 1 goal, half stake is refunded and half lost.`;
  }
  if (line === -1.0) {
    return `${teamName} must win by 2+ goals. A 1-goal win refunds your stake (Push).`;
  }
  if (line === 1.0) {
    return `Win if ${teamName} wins or draws. A 1-goal loss refunds your stake (Push).`;
  }
  return `Asian Handicap ${formatted} applied to ${teamName} final score.`;
}

/**
 * Settles single, half, or quarter Asian Handicap bets in client minor units.
 */
export function simulateAsianHandicapSettlement(
  stakeMinor: number,
  odds: number,
  handicap: number,
  homeGoals: number,
  awayGoals: number,
  isHome: boolean
): AsianSettlementSimulation {
  if (stakeMinor <= 0) {
    return { outcome: "LOST", returnMinor: 0, profitMinor: 0, explanation: "Invalid stake" };
  }

  const netDiff = isHome ? (homeGoals - awayGoals) + handicap : (awayGoals - homeGoals) + handicap;
  const rem = Math.abs(handicap) % 0.5;

  // Single line or half line
  if (Math.abs(rem) < 0.001) {
    if (netDiff > 0.0001) {
      const returnMinor = Math.round(stakeMinor * odds);
      return {
        outcome: "WON",
        returnMinor,
        profitMinor: returnMinor - stakeMinor,
        explanation: "Bet won with full profit payout.",
      };
    } else if (Math.abs(netDiff) < 0.0001) {
      return {
        outcome: "PUSH",
        returnMinor: stakeMinor,
        profitMinor: 0,
        explanation: "Handicap resulted in exact tie: full stake refunded.",
      };
    } else {
      return {
        outcome: "LOST",
        returnMinor: 0,
        profitMinor: -stakeMinor,
        explanation: "Handicap was not overcome: bet lost.",
      };
    }
  }

  // Quarter split lines
  const lowerH = handicap > 0 ? handicap - 0.25 : handicap + 0.25;
  const upperH = handicap > 0 ? handicap + 0.25 : handicap - 0.25;

  const halfStake = Math.floor(stakeMinor / 2);
  const otherHalfStake = stakeMinor - halfStake;

  const sub1 = simulateAsianHandicapSettlement(halfStake, odds, lowerH, homeGoals, awayGoals, isHome);
  const sub2 = simulateAsianHandicapSettlement(otherHalfStake, odds, upperH, homeGoals, awayGoals, isHome);

  const totalReturn = sub1.returnMinor + sub2.returnMinor;
  const totalProfit = totalReturn - stakeMinor;

  let outcome: AsianOutcome = "LOST";
  if (sub1.outcome === "WON" && sub2.outcome === "WON") {
    outcome = "WON";
  } else if (sub1.outcome === "LOST" && sub2.outcome === "LOST") {
    outcome = "LOST";
  } else if ((sub1.outcome === "WON" && sub2.outcome === "PUSH") || (sub1.outcome === "PUSH" && sub2.outcome === "WON")) {
    outcome = "HALF_WON";
  } else if ((sub1.outcome === "LOST" && sub2.outcome === "PUSH") || (sub1.outcome === "PUSH" && sub2.outcome === "LOST")) {
    outcome = "HALF_LOST";
  } else if (sub1.outcome === "PUSH" && sub2.outcome === "PUSH") {
    outcome = "PUSH";
  }

  return {
    outcome,
    returnMinor: totalReturn,
    profitMinor: totalProfit,
    explanation: `Split bet: split 1 (${lowerH}) was ${sub1.outcome}, split 2 (${upperH}) was ${sub2.outcome}.`,
  };
}

/**
 * Generate standard set of Asian Handicap lines based on club attack/defense ratings
 */
export function generateAsianHandicapOptions(
  homeName: string,
  awayName: string,
  baseGoalDiff: number = 0.35,
  currentHomeGoals: number = 0,
  currentAwayGoals: number = 0,
  isLive: boolean = false
): AsianHandicapOption[] {
  const goalDiff = isLive ? currentHomeGoals - currentAwayGoals : 0;
  const centerLine = isLive && goalDiff !== 0 ? -goalDiff : 0.0;

  const rawLines = isLive && goalDiff !== 0
    ? [
        centerLine - 1.0,
        centerLine - 0.75,
        centerLine - 0.5,
        centerLine - 0.25,
        centerLine,
        centerLine + 0.25,
        centerLine + 0.5,
        centerLine + 0.75,
        centerLine + 1.0,
      ]
    : [-1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0];

  const lines = rawLines
    .map((l) => Number(l.toFixed(2)))
    .filter((l) => Math.abs(l) <= 4.5);

  return lines.map((line) => {
    // Model odds based on handicap offset relative to expected goal difference and in-play score
    const effectiveDiff = baseGoalDiff + goalDiff * 0.75;
    const homeAdvantage = effectiveDiff - line;
    const homeProb = 1 / (1 + Math.exp(-homeAdvantage * 1.4));
    const awayProb = 1 - homeProb;

    // Apply 5.5% bookmaker overround
    const margin = 1.055;
    const rawHome = Number((margin / homeProb).toFixed(2));
    const rawAway = Number((margin / awayProb).toFixed(2));
    const homeOdds = Math.max(1.02, Math.min(15.0, rawHome));
    const awayOdds = Math.max(1.02, Math.min(15.0, rawAway));

    return {
      key: `ah_${line.toFixed(2)}`,
      handicap: line,
      label: `AH ${formatAsianHandicapLine(line)}`,
      homeOdds,
      awayOdds,
      description: explainAsianHandicapLine(line, homeName),
    };
  });
}
