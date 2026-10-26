import { describe, expect, it } from "vitest";
import {
  combinedOdds,
  displayReturnMinor,
  isOddLocked,
  isOverUnderConditionLocked,
  stakeError,
  toggleSelection,
  validateSlipSelections,
  type Selection,
} from "./betslip";

const sel = (fixtureId: string, oddsId: string, decimal: number): Selection =>
  ({ fixtureId, market: "match_winner", oddsId, version: 1, label: oddsId, decimal });

describe("bet slip", () => {
  it("keeps at most one selection per match", () => {
    const slip = toggleSelection([sel("f1", "a", 2)], sel("f1", "b", 3));
    expect(slip).toHaveLength(1);
    expect(slip[0]?.oddsId).toBe("b");
  });
  it("removes a selection when toggled again", () => {
    expect(toggleSelection([sel("f1", "a", 2)], sel("f1", "a", 2))).toEqual([]);
  });
  it("allows selections from different matches", () => {
    expect(toggleSelection([sel("f1", "a", 2)], sel("f2", "c", 1.5))).toHaveLength(2);
  });
  it("computes display odds and return", () => {
    const slip = [sel("f1", "a", 2), sel("f2", "c", 1.5)];
    expect(combinedOdds(slip)).toBe(3);
    expect(displayReturnMinor(1000, slip)).toBe(3000);
  });
  it("rejects invalid stakes", () => {
    expect(stakeError(0)).not.toBeNull();
    expect(stakeError(1.5)).not.toBeNull();
    expect(stakeError(500)).toBeNull();
  });
  it("locks any odds below 1.07", () => {
    expect(isOddLocked(1.06)).toBe(true);
    expect(isOddLocked(1.01)).toBe(true);
    expect(isOddLocked(1.07)).toBe(false);
    expect(isOddLocked(1.08)).toBe(false);
    expect(isOddLocked(2.5, true)).toBe(true);
  });
  it("validates slip selections and catches locked odds", () => {
    const validSlip = [sel("f1", "a", 1.5), sel("f2", "b", 1.07)];
    expect(validateSlipSelections(validSlip).valid).toBe(true);

    const invalidSlip = [sel("f1", "a", 1.5), sel("f2", "b", 1.06)];
    const res = validateSlipSelections(invalidSlip);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("is locked and cannot be placed");
  });

  it("locks Over/Under options strictly when goals are scored", () => {
    // Total goals = 1: Lock Over 0.5 and Under 0.5; leave Over 1.5 unlocked
    expect(isOverUnderConditionLocked("over_under_goals", "over_0_5", "Over 0.5", 1)).toBe(true);
    expect(isOverUnderConditionLocked("over_under_goals", "under_0_5", "Under 0.5", 1)).toBe(true);
    expect(isOverUnderConditionLocked("over_under_goals", "over_1_5", "Over 1.5", 1)).toBe(false);
    expect(isOverUnderConditionLocked("over_under_goals", "under_1_5", "Under 1.5", 1)).toBe(false);

    // Total goals = 2: Lock Over 1.5 and Under 1.5; leave Over 2.5 unlocked
    expect(isOverUnderConditionLocked("over_under_goals", "over_1_5", "Over 1.5", 2)).toBe(true);
    expect(isOverUnderConditionLocked("over_under_goals", "under_1_5", "Under 1.5", 2)).toBe(true);
    expect(isOverUnderConditionLocked("over_under_goals", "over_2_5", "Over 2.5", 2)).toBe(false);

    // Total goals = 3: Lock Over 2.5 and Under 2.5
    expect(isOverUnderConditionLocked("over_under_goals", "over_2_5", "Over 2.5", 3)).toBe(true);
    expect(isOverUnderConditionLocked("over_under_2_5", "over_2_5", "Over 2.5", 3)).toBe(true);

    // First Half: 1 goal scored in 1H locks Over 0.5 in 1H
    expect(isOverUnderConditionLocked("first_half_goals_ou", "1h_over_0_5", "1st Half Over 0.5", 1, 1, 0, 100)).toBe(true);
    expect(isOverUnderConditionLocked("first_half_goals_ou", "1h_under_0_5", "1st Half Under 0.5", 1, 1, 0, 100)).toBe(true);
    expect(isOverUnderConditionLocked("first_half_goals_ou", "1h_over_1_5", "1st Half Over 1.5", 1, 1, 0, 100)).toBe(false);

    // First Half: 2 goals scored in 1H locks Over 1.5 in 1H
    expect(isOverUnderConditionLocked("first_half_goals_ou", "1h_over_1_5", "1st Half Over 1.5", 2, 2, 0, 120)).toBe(true);

    // Second Half: 1 goal scored in 2H locks Over 0.5 in 2H
    expect(isOverUnderConditionLocked("second_half_goals_ou", "2h_over_0_5", "2nd Half Over 0.5", 2, 1, 1, 300)).toBe(true);
    expect(isOverUnderConditionLocked("second_half_goals_ou", "2h_under_0_5", "2nd Half Under 0.5", 2, 1, 1, 300)).toBe(true);
    expect(isOverUnderConditionLocked("second_half_goals_ou", "2h_over_1_5", "2nd Half Over 1.5", 2, 1, 1, 300)).toBe(false);

    // Second Half: 2 goals scored in 2H locks Over 1.5 in 2H
    expect(isOverUnderConditionLocked("second_half_goals_ou", "2h_over_1_5", "2nd Half Over 1.5", 3, 1, 2, 350)).toBe(true);
  });
});
