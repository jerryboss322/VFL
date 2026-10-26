/**
 * Peer-to-Peer (P2P) Betting Exchange Financial & Escrow Client Utilities.
 *
 * Implements client-side mathematical calculations for P2P sports betting:
 * - Backer stake vs Layer liability collateral calculations
 * - Potential profit and exchange commission deductions (2% net profit)
 * - Balance validation and order slippage checks
 */

export type ExchangeSide = "BACK" | "LAY";

export interface P2PEscrowCalculation {
  escrowRequiredMinor: number;
  liabilityMinor: number;
  potentialProfitMinor: number;
  commissionMinor: number;
  netPayoutMinor: number;
}

export function calculateP2PEscrow(
  side: ExchangeSide,
  stakeMinor: number,
  odds: number,
  commissionRate = 0.02
): P2PEscrowCalculation {
  if (stakeMinor <= 0) {
    return {
      escrowRequiredMinor: 0,
      liabilityMinor: 0,
      potentialProfitMinor: 0,
      commissionMinor: 0,
      netPayoutMinor: 0,
    };
  }

  const rawProfit = stakeMinor * (odds - 1.0);
  const potentialProfitMinor = Math.round(rawProfit);
  const liabilityMinor = potentialProfitMinor;

  if (side === "BACK") {
    // Backer risks their stake
    const escrowRequiredMinor = stakeMinor;
    const grossReturn = stakeMinor + potentialProfitMinor;
    const commissionMinor = Math.max(0, Math.round(potentialProfitMinor * commissionRate));
    const netPayoutMinor = grossReturn - commissionMinor;

    return {
      escrowRequiredMinor,
      liabilityMinor: 0,
      potentialProfitMinor,
      commissionMinor,
      netPayoutMinor,
    };
  } else {
    // Layer risks liability
    const escrowRequiredMinor = liabilityMinor;
    const grossReturn = liabilityMinor + stakeMinor;
    // Layer's net profit is the backer's stake
    const commissionMinor = Math.max(0, Math.round(stakeMinor * commissionRate));
    const netPayoutMinor = grossReturn - commissionMinor;

    return {
      escrowRequiredMinor,
      liabilityMinor,
      potentialProfitMinor: stakeMinor,
      commissionMinor,
      netPayoutMinor,
    };
  }
}

export function validateP2POffer(
  side: ExchangeSide,
  stakeMinor: number,
  odds: number,
  availableBalanceMinor: number
): { isValid: boolean; error?: string } {
  if (stakeMinor < 100) {
    return { isValid: false, error: "Minimum stake is £1.00 (100 minor units)" };
  }
  if (odds <= 1.01) {
    return { isValid: false, error: "Odds must be strictly greater than 1.01" };
  }
  if (odds > 100.0) {
    return { isValid: false, error: "Maximum allowable exchange odds is 100.00" };
  }

  const calc = calculateP2PEscrow(side, stakeMinor, odds);
  if (calc.escrowRequiredMinor > availableBalanceMinor) {
    return {
      isValid: false,
      error: `Insufficient balance: requires ${calc.escrowRequiredMinor} minor units, available ${availableBalanceMinor}`,
    };
  }

  return { isValid: true };
}
