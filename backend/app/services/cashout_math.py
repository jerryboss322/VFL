"""Automated Cashout Risk, Mathematical Valuation, and Hedging Engine.

Calculates:
- Fair market cashout value for in-play singles and multi-leg accumulators
- Dynamic bookmaker margin deduction based on clock elapsed (4% to 8%)
- Partial cashout split: settles fraction f, retaining (1 - f) of stake at original odds
- Auto-cashout trigger evaluations (Take-Profit target & Stop-Loss protection floor)
"""

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Dict, List, Optional, Tuple


class CashoutTriggerType(str, Enum):
    TAKE_PROFIT = "TAKE_PROFIT"
    STOP_LOSS = "STOP_LOSS"


def calculate_fair_cashout_value(
    original_stake_minor: int,
    original_odds: float,
    current_live_odds: float,
    match_minute: int = 45,
    margin_percent: float = 0.05,
) -> int:
    """Calculates fair cashout offer in integer minor units.

    Formula:
    Fair value = Stake * (Original Odds / Current Live Odds) * (1 - Margin)
    """
    if original_stake_minor <= 0:
        return 0
    if current_live_odds <= 1.0 or original_odds <= 1.0:
        return 0

    # Margin scales slightly with elapsed minute (higher uncertainty late in match)
    time_factor = min(0.03, (match_minute / 90.0) * 0.02)
    effective_margin = margin_percent + time_factor

    ratio = Decimal(str(original_odds)) / Decimal(str(current_live_odds))
    raw_offer = Decimal(original_stake_minor) * ratio * Decimal(str(1.0 - effective_margin))

    # Cap cashout offer at maximum potential return minus small margin
    max_return = Decimal(original_stake_minor) * Decimal(str(original_odds))
    capped_offer = min(max_return * Decimal("0.98"), raw_offer)

    # Minimum cashout floor: 0
    offer_minor = int(capped_offer.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return max(0, offer_minor)


def calculate_partial_cashout_split(
    original_stake_minor: int,
    full_cashout_offer_minor: int,
    cashout_percentage: float,  # e.g. 50.0 for 50%
) -> Tuple[int, int, int]:
    """Splits an active wager into cashed-out portion and remaining active stake.

    Returns:
    (payout_minor, remaining_stake_minor, remaining_cashout_offer_minor)
    """
    pct = max(0.05, min(0.95, cashout_percentage / 100.0))
    payout_minor = int(
        (Decimal(full_cashout_offer_minor) * Decimal(str(pct))).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )

    remaining_stake_minor = int(
        (Decimal(original_stake_minor) * Decimal(str(1.0 - pct))).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )

    remaining_cashout_offer_minor = full_cashout_offer_minor - payout_minor
    return payout_minor, remaining_stake_minor, remaining_cashout_offer_minor


def evaluate_auto_cashout_triggers(
    current_cashout_offer_minor: int,
    take_profit_threshold_minor: Optional[int] = None,
    stop_loss_threshold_minor: Optional[int] = None,
) -> Tuple[bool, Optional[CashoutTriggerType], str]:
    """Determines whether an active automated cashout rule should be executed immediately."""
    if current_cashout_offer_minor <= 0:
        return False, None, "Cashout offer is zero"

    # 1. Check Take-Profit: offer >= target
    if take_profit_threshold_minor and current_cashout_offer_minor >= take_profit_threshold_minor:
        return (
            True,
            CashoutTriggerType.TAKE_PROFIT,
            f"Take-Profit triggered! Current offer ({current_cashout_offer_minor}) reached target ({take_profit_threshold_minor})",
        )

    # 2. Check Stop-Loss: offer <= floor
    if stop_loss_threshold_minor and current_cashout_offer_minor <= stop_loss_threshold_minor:
        return (
            True,
            CashoutTriggerType.STOP_LOSS,
            f"Stop-Loss triggered! Current offer ({current_cashout_offer_minor}) fell to protection floor ({stop_loss_threshold_minor})",
        )

    return False, None, "No auto-cashout trigger conditions met"
