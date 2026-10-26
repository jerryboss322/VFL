"""Social Trader Copy-Betting and Proportional Portfolio Mirroring Engine.

Enables sports bettors to mirror the bets of top-ranked master traders:
- Proportional stake sizing based on relative bankroll equity
- High-water mark performance fee calculation (e.g. 10% on net profits)
- Risk ceiling and slippage protection (cancelling mirrors if odds dropped > 5%)
- Historical ROI, Win Rate, Profit Factor, and Maximum Drawdown (MDD) telemetry
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Tuple


class CopyTraderTier(str, Enum):
    ROOKIE = "ROOKIE"
    PRO_SHARP = "PRO_SHARP"
    MASTER = "MASTER"
    LEGENDARY = "LEGENDARY"


@dataclass
class MasterTraderProfile:
    user_id: str
    username: str
    tier: CopyTraderTier
    total_bets: int
    won_bets: int
    total_staked_minor: int
    total_returned_minor: int
    max_drawdown_pct: float
    follower_count: int
    performance_fee_pct: float = 10.0  # 10% on net profit


@dataclass
class CopySubscription:
    subscription_id: str
    follower_id: str
    master_id: str
    max_stake_per_bet_minor: int
    fixed_stake_minor: Optional[int] = None  # If None, use proportional
    max_slippage_pct: float = 5.0
    active: bool = True
    total_mirrored_bets: int = 0
    total_profit_minor: int = 0
    fees_paid_minor: int = 0


@dataclass
class MirrorBetEvaluation:
    approved: bool
    rejection_reason: Optional[str]
    calculated_stake_minor: int
    estimated_fee_minor: int


def calculate_trader_metrics(
    total_staked_minor: int,
    total_returned_minor: int,
    won_bets: int,
    total_bets: int,
) -> Tuple[float, float, float]:
    """Returns (ROI percentage, Win Rate percentage, Profit Factor)."""
    if total_bets == 0 or total_staked_minor == 0:
        return (0.0, 0.0, 0.0)

    net_profit = total_returned_minor - total_staked_minor
    roi_pct = round((net_profit / total_staked_minor) * 100.0, 2)
    win_rate_pct = round((won_bets / total_bets) * 100.0, 2)

    total_lost = max(1, total_staked_minor - (total_returned_minor if total_returned_minor < total_staked_minor else 0))
    profit_factor = round(total_returned_minor / total_lost, 2)

    return (roi_pct, win_rate_pct, profit_factor)


def evaluate_copy_bet_allocation(
    subscription: CopySubscription,
    master_stake_minor: int,
    master_bankroll_minor: int,
    follower_bankroll_minor: int,
    master_odds: float,
    current_odds: float,
    min_platform_stake_minor: int = 1000,
) -> MirrorBetEvaluation:
    """Evaluates whether to place a mirrored bet and calculates the proportional stake."""
    if not subscription.active:
        return MirrorBetEvaluation(
            approved=False,
            rejection_reason="SUBSCRIPTION_INACTIVE",
            calculated_stake_minor=0,
            estimated_fee_minor=0,
        )

    # Slippage check
    if master_odds > 0:
        slippage_pct = ((master_odds - current_odds) / master_odds) * 100.0
        if slippage_pct > subscription.max_slippage_pct:
            return MirrorBetEvaluation(
                approved=False,
                rejection_reason=f"ODDS_SLIPPAGE_EXCEEDED ({slippage_pct:.1f}% > {subscription.max_slippage_pct}%)",
                calculated_stake_minor=0,
                estimated_fee_minor=0,
            )

    # Stake calculation
    if subscription.fixed_stake_minor is not None:
        raw_stake = subscription.fixed_stake_minor
    else:
        # Proportional: follower bankroll relative to master bankroll
        if master_bankroll_minor <= 0:
            return MirrorBetEvaluation(
                approved=False,
                rejection_reason="INVALID_MASTER_BANKROLL",
                calculated_stake_minor=0,
                estimated_fee_minor=0,
            )
        equity_ratio = follower_bankroll_minor / master_bankroll_minor
        raw_stake = int(master_stake_minor * equity_ratio)

    # Apply limits
    stake = min(raw_stake, subscription.max_stake_per_bet_minor)

    if stake < min_platform_stake_minor:
        return MirrorBetEvaluation(
            approved=False,
            rejection_reason=f"STAKE_BELOW_MINIMUM ({stake} < {min_platform_stake_minor})",
            calculated_stake_minor=0,
            estimated_fee_minor=0,
        )

    if stake > follower_bankroll_minor:
        return MirrorBetEvaluation(
            approved=False,
            rejection_reason="INSUFFICIENT_FOLLOWER_BALANCE",
            calculated_stake_minor=0,
            estimated_fee_minor=0,
        )

    # Anticipated fee on expected win (if odds > 1.0)
    potential_profit = int(stake * (current_odds - 1.0))
    fee = int(potential_profit * 0.10) if potential_profit > 0 else 0

    return MirrorBetEvaluation(
        approved=True,
        rejection_reason=None,
        calculated_stake_minor=stake,
        estimated_fee_minor=fee,
    )


def settle_copy_bet_profit_share(
    stake_minor: int,
    return_minor: int,
    performance_fee_pct: float = 10.0,
) -> Tuple[int, int]:
    """Calculates follower net payout and master trader commission fee.
    
    Returns:
        (follower_net_credit_minor, master_commission_fee_minor)
    """
    if return_minor <= stake_minor:
        # Loss or push: no performance fee
        return (return_minor, 0)

    net_profit = return_minor - stake_minor
    master_fee = int(net_profit * (performance_fee_pct / 100.0))
    follower_payout = return_minor - master_fee

    return (follower_payout, master_fee)
