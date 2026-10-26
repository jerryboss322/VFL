import { describe, it, expect } from "vitest";
import { calculateP2PEscrow, validateP2POffer } from "./p2p_exchange";

describe("P2P Exchange Mathematical Calculations", () => {
  it("calculates Backer escrow, profit, and 2% net commission", () => {
    // Back £50.00 (5000 minor) @ 2.40 odds:
    // Profit = £50 * 1.40 = £70.00 (7000 minor)
    // 2% commission on £70 = £1.40 (140 minor)
    // Net payout = £120.00 - £1.40 = £118.60 (11860 minor)
    const calc = calculateP2PEscrow("BACK", 5000, 2.40, 0.02);

    expect(calc.escrowRequiredMinor).toBe(5000);
    expect(calc.potentialProfitMinor).toBe(7000);
    expect(calc.commissionMinor).toBe(140);
    expect(calc.netPayoutMinor).toBe(11860);
  });

  it("calculates Layer liability escrow, profit, and 2% net commission", () => {
    // Lay £50.00 (5000 minor) @ 2.00 odds:
    // Layer liability = £50 * (2.0 - 1) = £50.00 (5000 minor)
    // Layer profit = £50.00 stake (5000 minor)
    // 2% commission on £50 = £1.00 (100 minor)
    // Net payout = £100.00 - £1.00 = £99.00 (9900 minor)
    const calc = calculateP2PEscrow("LAY", 5000, 2.00, 0.02);

    expect(calc.escrowRequiredMinor).toBe(5000);
    expect(calc.liabilityMinor).toBe(5000);
    expect(calc.potentialProfitMinor).toBe(5000);
    expect(calc.commissionMinor).toBe(100);
    expect(calc.netPayoutMinor).toBe(9900);
  });

  it("validates offer bounds and insufficient balance", () => {
    // Minimum stake check
    const minCheck = validateP2POffer("BACK", 50, 2.0, 10000);
    expect(minCheck.isValid).toBe(false);
    expect(minCheck.error).toContain("Minimum stake");

    // Odds check
    const oddsCheck = validateP2POffer("BACK", 1000, 1.01, 10000);
    expect(oddsCheck.isValid).toBe(false);
    expect(oddsCheck.error).toContain("greater than 1.01");

    // Insufficient balance for Layer liability
    // Lay £100 @ 3.0 requires £200 (20000 minor). User has only 15000
    const balanceCheck = validateP2POffer("LAY", 10000, 3.0, 15000);
    expect(balanceCheck.isValid).toBe(false);
    expect(balanceCheck.error).toContain("Insufficient balance");

    // Valid offer
    const validCheck = validateP2POffer("BACK", 2500, 2.50, 10000);
    expect(validCheck.isValid).toBe(true);
  });
});
