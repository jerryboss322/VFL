import type { MarketKey } from "@/types/api";

export interface Selection {
  fixtureId: string;
  fixtureLabel?: string;
  market: MarketKey;
  oddsId: string;
  version: number;
  label: string;
  decimal: number;
  locked?: boolean;
  suspended?: boolean;
}

export const LOCK_ODDS_THRESHOLD = 1.07;

/** Determine if an odd is locked due to value threshold or explicit suspension. */
export function isOddLocked(decimal: number, suspended?: boolean, locked?: boolean): boolean {
  return Boolean(suspended || locked || decimal < LOCK_ODDS_THRESHOLD);
}

/**
 * Evaluates whether an in-play Over/Under selection must be locked because its condition is already determined:
 * - Once 1 goal scored in match: Lock Over 0.5 & Under 0.5
 * - Once 2 goals scored in match: Lock Over 1.5 & Under 1.5
 * - Once 3 goals scored in match: Lock Over 2.5 & Under 2.5
 * - Once 4 goals scored in match: Lock Over 3.5 & Under 3.5
 * - Once 5 goals scored in match: Lock Over 4.5 & Under 4.5
 * - In 1st half: Same rules based on 1st-half goals scored (lock Over/Under 0.5 at 1 goal, Over/Under 1.5 at 2 goals, etc.)
 * - In 2nd half: Same rules based on 2nd-half goals scored (lock Over/Under 0.5 at 1 goal, Over/Under 1.5 at 2 goals, etc.)
 */
export function isOverUnderConditionLocked(
  marketKey: string,
  outcome: string,
  label: string,
  totalGoals: number,
  firstHalfGoals?: number,
  secondHalfGoals?: number,
  clockSeconds?: number
): boolean {
  const normKey = (marketKey || "").toLowerCase();
  const normOut = (outcome || "").toLowerCase();
  const normLabel = (label || "").toLowerCase();

  // Full match Over/Under
  if (normKey === "over_under_goals" || normKey === "over_under_2_5") {
    for (const t of [0, 1, 2, 3, 4]) {
      if (normOut.includes(`_${t}_5`) || normLabel.includes(`${t}.5`)) {
        if (totalGoals > t) return true;
      }
    }
    if (totalGoals >= 3 && (normOut === "over_2_5" || normOut === "under_2_5" || normLabel.includes("2.5"))) {
      return true;
    }
  }

  // First-Half Goals Over/Under
  if (normKey === "first_half_goals_ou") {
    if (clockSeconds !== undefined && clockSeconds >= 240) return true;
    const h1 = firstHalfGoals !== undefined ? firstHalfGoals : (clockSeconds !== undefined && clockSeconds < 240 ? totalGoals : 0);
    for (const t of [0, 1, 2]) {
      if (normOut.includes(`_${t}_5`) || normLabel.includes(`${t}.5`)) {
        if (h1 > t) return true;
      }
    }
  }

  // Second-Half Goals Over/Under
  if (normKey === "second_half_goals_ou") {
    if (clockSeconds !== undefined && clockSeconds >= 240 && secondHalfGoals !== undefined) {
      for (const t of [0, 1, 2]) {
        if (normOut.includes(`_${t}_5`) || normLabel.includes(`${t}.5`)) {
          if (secondHalfGoals > t) return true;
        }
      }
    }
  }

  return false;
}

/** Validates slip selections before placement, strictly enforcing the 1.07 minimum odds threshold. */
export function validateSlipSelections(slip: Selection[]): { valid: boolean; error: string | null } {
  if (slip.length === 0) {
    return { valid: false, error: "Slip is empty." };
  }
  const lockedLeg = slip.find((s) => isOddLocked(s.decimal, s.suspended, s.locked));
  if (lockedLeg) {
    return {
      valid: false,
      error: `Selection "${lockedLeg.label}" is locked and cannot be placed.`,
    };
  }
  return { valid: true, error: null };
}

/** One selection per match: choosing another outcome for the same fixture replaces it; choosing the same one removes it. */
export function toggleSelection(slip: Selection[], next: Selection): Selection[] {
  const existing = slip.find((s) => s.fixtureId === next.fixtureId);
  const rest = slip.filter((s) => s.fixtureId !== next.fixtureId);
  if (existing && existing.oddsId === next.oddsId) return rest;
  return [...rest, next];
}

/** Display-only. The backend computes the authoritative price and payout. */
export function combinedOdds(slip: Selection[]): number {
  return slip.reduce((acc, s) => acc * s.decimal, 1);
}
export function displayReturnMinor(stakeMinor: number, slip: Selection[]): number {
  return Math.floor(stakeMinor * combinedOdds(slip));
}
export function stakeError(stakeMinor: number): string | null {
  if (!Number.isInteger(stakeMinor) || stakeMinor <= 0) return "Enter a stake greater than zero.";
  return null;
}

export function formatMinor(minor: number | null | undefined, currency = "XTS"): string {
  if (minor === null || minor === undefined) return `0.00 ${currency}`;
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${major.toLocaleString("en-US")}.${cents} ${currency}`;
}
