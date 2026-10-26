import type { MarketKey } from "@/types/api";

export interface Selection {
  fixtureId: string;
  fixtureLabel?: string;
  market: MarketKey;
  oddsId: string;
  version: number;
  label: string;
  decimal: number;
}

export const LOCK_ODDS_THRESHOLD = 1.07;

/** Determine if an odd is locked due to value threshold or explicit suspension. */
export function isOddLocked(decimal: number, suspended?: boolean): boolean {
  return Boolean(suspended || decimal < LOCK_ODDS_THRESHOLD);
}

/** Validates slip selections before placement, strictly enforcing the 1.07 minimum odds threshold. */
export function validateSlipSelections(slip: Selection[]): { valid: boolean; error: string | null } {
  if (slip.length === 0) {
    return { valid: false, error: "Slip is empty." };
  }
  const lockedLeg = slip.find((s) => isOddLocked(s.decimal));
  if (lockedLeg) {
    return {
      valid: false,
      error: `Selection "${lockedLeg.label}" has odds ${lockedLeg.decimal.toFixed(2)} which is below the 1.07 floor and locked.`,
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
