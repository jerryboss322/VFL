"""Asian Handicap Calculation and Settlement Engine.

Handles full lines (0.0, -1.0, +1.0), half lines (-0.5, +0.5), and quarter split
lines (-0.25, +0.25, -0.75, +0.75) with precise minor-unit settlement returns.
"""

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import NamedTuple


class AsianSettlementOutcome(str, Enum):
    WON = "WON"              # Full profit: stake * odds
    HALF_WON = "HALF_WON"    # Half profit: (stake / 2) * odds + (stake / 2)
    PUSH = "PUSH"            # Full refund: stake returned
    HALF_LOST = "HALF_LOST"  # Half refund: (stake / 2) returned, half lost
    LOST = "LOST"            # Full loss: 0 return


class AsianSettlementResult(NamedTuple):
    outcome: AsianSettlementOutcome
    return_amount_minor: int
    profit_loss_minor: int
    effective_odds: float
    description: str


def settle_asian_handicap(
    stake_minor: int,
    odds_decimal: float,
    handicap: float,
    home_goals: int,
    away_goals: int,
    is_home_bet: bool = True,
) -> AsianSettlementResult:
    """Calculate the exact Asian Handicap settlement for single, half, or quarter lines.

    :param stake_minor: Stake in integer minor units (e.g. cents).
    :param odds_decimal: Decimal odds (e.g. 1.95).
    :param handicap: The handicap value for the chosen side (e.g. -0.25, +0.5, -1.75).
    :param home_goals: Final full-time goals scored by home team.
    :param away_goals: Final full-time goals scored by away team.
    :param is_home_bet: True if bet is on Home side, False if bet is on Away side.
    """
    if stake_minor <= 0:
        raise ValueError("Stake must be strictly positive minor units.")
    if odds_decimal < 1.01:
        raise ValueError("Odds must be at least 1.01.")

    # Calculate net adjusted goal difference from the perspective of the backed team
    raw_diff = (home_goals - away_goals) if is_home_bet else (away_goals - home_goals)
    adjusted_diff = raw_diff + handicap

    # Remainder when divided by 0.5 reveals if it's a quarter line (±0.25, ±0.75)
    # Using round to avoid floating point precision artifacts (e.g. 0.2500000000000001)
    normalized_handicap = round(handicap * 4) / 4
    is_quarter_line = (abs(normalized_handicap) * 4) % 2 == 1

    if not is_quarter_line:
        # Full Line (0, ±1.0, ±2.0) or Half Line (±0.5, ±1.5)
        if adjusted_diff > 0:
            outcome = AsianSettlementOutcome.WON
            return_amt = int(round(stake_minor * odds_decimal))
            pnl = return_amt - stake_minor
            eff_odds = odds_decimal
            desc = f"Won: Adjusted goal difference was +{adjusted_diff:.2f}."
        elif adjusted_diff < 0:
            outcome = AsianSettlementOutcome.LOST
            return_amt = 0
            pnl = -stake_minor
            eff_odds = 0.0
            desc = f"Lost: Adjusted goal difference was {adjusted_diff:.2f}."
        else:
            # Exact tie on full line (Push / Void)
            outcome = AsianSettlementOutcome.PUSH
            return_amt = stake_minor
            pnl = 0
            eff_odds = 1.0
            desc = f"Push: Adjusted goal difference tied at 0.00. Stake refunded."

        return AsianSettlementResult(
            outcome=outcome,
            return_amount_minor=return_amt,
            profit_loss_minor=pnl,
            effective_odds=eff_odds,
            description=desc,
        )

    # Quarter Line: Splits the bet into two halves:
    # Example -0.25 splits into 0.0 (DNB) and -0.5
    # Example +0.75 splits into +0.5 and +1.0
    lower_line = round((normalized_handicap - 0.25) * 2) / 2
    upper_line = round((normalized_handicap + 0.25) * 2) / 2

    diff_lower = raw_diff + lower_line
    diff_upper = raw_diff + upper_line

    half_stake_1 = stake_minor // 2
    half_stake_2 = stake_minor - half_stake_1  # Preserves exact penny rounding

    # Settle half 1 (lower line)
    if diff_lower > 0:
        ret_1 = int(round(half_stake_1 * odds_decimal))
    elif diff_lower == 0:
        ret_1 = half_stake_1
    else:
        ret_1 = 0

    # Settle half 2 (upper line)
    if diff_upper > 0:
        ret_2 = int(round(half_stake_2 * odds_decimal))
    elif diff_upper == 0:
        ret_2 = half_stake_2
    else:
        ret_2 = 0

    total_return = ret_1 + ret_2
    total_pnl = total_return - stake_minor

    if total_return == int(round(stake_minor * odds_decimal)):
        outcome = AsianSettlementOutcome.WON
        desc = f"Full Win: Both split handicaps ({lower_line:+.2f} / {upper_line:+.2f}) covered."
    elif total_return > stake_minor:
        outcome = AsianSettlementOutcome.HALF_WON
        desc = f"Half Win: Lower split ({lower_line:+.2f}) tied/won, upper ({upper_line:+.2f}) won."
    elif total_return == stake_minor:
        outcome = AsianSettlementOutcome.PUSH
        desc = f"Push: Both split lines resulted in net push."
    elif total_return > 0:
        outcome = AsianSettlementOutcome.HALF_LOST
        desc = f"Half Lost: One split lost, other split tied ({lower_line:+.2f} / {upper_line:+.2f})."
    else:
        outcome = AsianSettlementOutcome.LOST
        desc = f"Full Loss: Neither split handicap covered."

    effective_odds = round(total_return / stake_minor, 4) if stake_minor > 0 else 0.0

    return AsianSettlementResult(
        outcome=outcome,
        return_amount_minor=total_return,
        profit_loss_minor=total_pnl,
        effective_odds=effective_odds,
        description=desc,
    )


def generate_asian_handicap_market(
    home_name: str,
    away_name: str,
    home_attack: float,
    home_defense: float,
    away_attack: float,
    away_defense: float,
    current_home_goals: int = 0,
    current_away_goals: int = 0,
    is_live: bool = False,
) -> dict:
    """Derive competitive Asian Handicap lines and prices based on attacking ratings and in-play score."""
    # Compute relative dominance differential
    home_power = home_attack / max(0.5, away_defense)
    away_power = away_attack / max(0.5, home_defense)
    diff = home_power - away_power

    # When live, adjust expected spread based on in-play goal difference
    if is_live and (current_home_goals > 0 or current_away_goals > 0):
        inplay_goal_diff = current_home_goals - current_away_goals
        diff += inplay_goal_diff * 0.55

    # Determine central spread line
    if diff > 1.20:
        primary_line = -3.0
    elif diff > 0.85:
        primary_line = -2.5
    elif diff > 0.60:
        primary_line = -2.0
    elif diff > 0.40:
        primary_line = -1.5
    elif diff > 0.25:
        primary_line = -1.0
    elif diff > 0.12:
        primary_line = -0.5
    elif diff > 0.04:
        primary_line = -0.25
    elif diff < -1.20:
        primary_line = 3.0
    elif diff < -0.85:
        primary_line = 2.5
    elif diff < -0.60:
        primary_line = 2.0
    elif diff < -0.40:
        primary_line = 1.5
    elif diff < -0.25:
        primary_line = 1.0
    elif diff < -0.12:
        primary_line = 0.5
    elif diff < -0.04:
        primary_line = 0.25
    else:
        primary_line = 0.0

    lines = [
        round(primary_line - 0.5, 2),
        round(primary_line - 0.25, 2),
        round(primary_line, 2),
        round(primary_line + 0.25, 2),
        round(primary_line + 0.5, 2),
    ]

    options = []
    for line in lines:
        home_line_str = f"{line:+.2f}"
        away_line_str = f"{-line:+.2f}"

        # Standard bookmaker margin ~1.90 / 1.90
        skew = (diff - (-line * 0.35)) * 0.15
        base_h = 1.92 - skew
        base_a = 1.92 + skew

        h_odds = max(1.02, min(15.00, round(base_h, 2)))
        a_odds = max(1.02, min(15.00, round(base_a, 2)))

        h_locked = h_odds < 1.07
        a_locked = a_odds < 1.07

        options.append({
            "key": f"ah_home_{line}",
            "label": f"{home_name} ({home_line_str})",
            "odds": h_odds,
            "handicap": line,
            "side": "home",
            "suspended": h_locked,
            "locked": h_locked,
        })
        options.append({
            "key": f"ah_away_{-line}",
            "label": f"{away_name} ({away_line_str})",
            "odds": a_odds,
            "handicap": -line,
            "side": "away",
            "suspended": a_locked,
            "locked": a_locked,
        })

    return {
        "key": "asian_handicap",
        "label": "Asian Handicap",
        "category": "handicap",
        "primary_line": primary_line,
        "options": options,
    }
