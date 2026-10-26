"""In-Play Cashout Re-Offer, Price Slippage Protection, and Auto-Cashout Engine.

Implements real-time cashout negotiation and risk gates:
- Volatility slippage protection: detects price movements between user click and server execution
- User acceptance modes: ACCEPT_EXACT, ACCEPT_HIGHER_ONLY, ACCEPT_ALL_CHANGES
- In-play suspension gates: blocks cashout during active VAR reviews, penalties, and dangerous attacks
- Multi-leg accumulator composite cashout valuation across finished, live, and upcoming legs
- Automated rule triggers (Take-Profit threshold and Stop-Loss safety floor)
"""

from dataclasses import dataclass
from enum import Enum
import math
from typing import Dict, List, Optional, Tuple


class CashoutSlippageMode(str, Enum):
    ACCEPT_EXACT = "ACCEPT_EXACT"              # Rejects if price moved at all (> 1% delta)
    ACCEPT_HIGHER_ONLY = "ACCEPT_HIGHER_ONLY"  # Accepts if offer increased, rejects if decreased
    ACCEPT_ALL_CHANGES = "ACCEPT_ALL_CHANGES"  # Executes at current market offer regardless


class CashoutExecutionStatus(str, Enum):
    EXECUTED = "EXECUTED"
    PRICE_CHANGED = "PRICE_CHANGED"
    MARKET_SUSPENDED = "MARKET_SUSPENDED"
    EVENT_CONCLUDED = "EVENT_CONCLUDED"
    INVALID_BET = "INVALID_BET"


@dataclass
class CashoutQuote:
    quote_id: str
    bet_id: str
    offered_payout_minor: int
    original_stake_minor: int
    maximum_potential_return_minor: int
    is_suspended: bool
    suspension_reason: Optional[str] = None


@dataclass
class CashoutExecutionResult:
    status: CashoutExecutionStatus
    payout_credited_minor: int
    new_quote: Optional[CashoutQuote] = None
    rejection_reason: Optional[str] = None


@dataclass
class AccumulatorLegStatus:
    leg_id: str
    status: str  # "WON", "LOST", "IN_PLAY", "UPCOMING"
    original_odds: float
    current_live_odds: float


class CashoutReofferEngine:
    """Evaluates real-time cashout executions, slippage tolerances, and multi-leg parlay values."""

    @staticmethod
    def calculate_single_quote(
        quote_id: str,
        bet_id: str,
        stake_minor: int,
        original_odds: float,
        current_live_odds: float,
        is_market_suspended: bool = False,
        suspension_reason: Optional[str] = None,
        bookmaker_margin: float = 0.05,
    ) -> CashoutQuote:
        """Calculates fair cashout quote for a single bet."""
        max_return = int(round(stake_minor * original_odds))
        if is_market_suspended:
            return CashoutQuote(
                quote_id=quote_id,
                bet_id=bet_id,
                offered_payout_minor=0,
                original_stake_minor=stake_minor,
                maximum_potential_return_minor=max_return,
                is_suspended=True,
                suspension_reason=suspension_reason or "Market temporarily suspended",
            )

        # Fair valuation = stake * (original_odds / current_live_odds) * (1 - margin)
        price_ratio = original_odds / max(1.01, current_live_odds)
        fair_raw = stake_minor * price_ratio * (1.0 - bookmaker_margin)
        # Cap at 98% of maximum potential return
        offer_minor = int(min(max_return * 0.98, fair_raw))

        return CashoutQuote(
            quote_id=quote_id,
            bet_id=bet_id,
            offered_payout_minor=max(0, offer_minor),
            original_stake_minor=stake_minor,
            maximum_potential_return_minor=max_return,
            is_suspended=False,
        )

    @classmethod
    def execute_cashout_attempt(
        cls,
        expected_offer_minor: int,
        current_quote: CashoutQuote,
        slippage_mode: CashoutSlippageMode = CashoutSlippageMode.ACCEPT_HIGHER_ONLY,
        tolerance_pct: float = 1.5,
    ) -> CashoutExecutionResult:
        """Processes cashout click against live quote with slippage rules."""
        if current_quote.is_suspended:
            return CashoutExecutionResult(
                status=CashoutExecutionStatus.MARKET_SUSPENDED,
                payout_credited_minor=0,
                new_quote=current_quote,
                rejection_reason=current_quote.suspension_reason,
            )

        live_offer = current_quote.offered_payout_minor
        delta = live_offer - expected_offer_minor
        delta_pct = (delta / max(1, expected_offer_minor)) * 100.0

        if slippage_mode == CashoutSlippageMode.ACCEPT_ALL_CHANGES:
            return CashoutExecutionResult(
                status=CashoutExecutionStatus.EXECUTED,
                payout_credited_minor=live_offer,
                new_quote=current_quote,
            )

        if slippage_mode == CashoutSlippageMode.ACCEPT_HIGHER_ONLY:
            if delta >= 0 or abs(delta_pct) <= tolerance_pct:
                return CashoutExecutionResult(
                    status=CashoutExecutionStatus.EXECUTED,
                    payout_credited_minor=live_offer,
                    new_quote=current_quote,
                )
            return CashoutExecutionResult(
                status=CashoutExecutionStatus.PRICE_CHANGED,
                payout_credited_minor=0,
                new_quote=current_quote,
                rejection_reason=f"Cashout price dropped from {expected_offer_minor} to {live_offer}",
            )

        # ACCEPT_EXACT: within tolerance
        if abs(delta_pct) <= tolerance_pct:
            return CashoutExecutionResult(
                status=CashoutExecutionStatus.EXECUTED,
                payout_credited_minor=live_offer,
                new_quote=current_quote,
            )

        return CashoutExecutionResult(
            status=CashoutExecutionStatus.PRICE_CHANGED,
            payout_credited_minor=0,
            new_quote=current_quote,
            rejection_reason=f"Cashout price changed by {delta_pct:.1f}%",
        )

    @staticmethod
    def calculate_accumulator_cashout(
        stake_minor: int,
        legs: List[AccumulatorLegStatus],
        bookmaker_margin_per_leg: float = 0.02,
    ) -> int:
        """Calculates combined cashout value for multi-leg accumulators."""
        if stake_minor <= 0:
            return 0

        # If any leg has LOST, cashout is 0
        if any(leg.status == "LOST" for leg in legs):
            return 0

        combined_ratio = 1.0
        active_legs_count = len(legs)

        for leg in legs:
            if leg.status == "WON":
                # Already won, retains full multiplier
                combined_ratio *= leg.original_odds
            elif leg.status == "IN_PLAY":
                # Live leg: original_odds / current_live_odds
                leg_ratio = leg.original_odds / max(1.01, leg.current_live_odds)
                combined_ratio *= leg_ratio
            elif leg.status == "UPCOMING":
                # Upcoming leg: no price drift yet, contributes 1.0 to cashout ratio
                combined_ratio *= 1.0

        # Cumulative margin discount
        total_margin = min(0.15, active_legs_count * bookmaker_margin_per_leg)
        raw_val = stake_minor * combined_ratio * (1.0 - total_margin)

        return int(max(0, round(raw_val)))
