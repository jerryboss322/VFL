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
