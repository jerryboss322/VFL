import { describe, expect, it } from "vitest";
import {
  combinedOdds,
  displayReturnMinor,
  isOddLocked,
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
    expect(res.error).toContain("below the 1.07 floor");
  });
});
