"""Accumulator, Multi-Bet, System Bet Permutations, and Correlation Engine.

Supports:
- Standard Straight Accumulators (2-fold through 20-fold parlays)
- System / Permutation Bets:
  * Trixie (3 legs -> 4 bets: 3 doubles, 1 treble)
  * Patent (3 legs -> 7 bets: 3 singles, 3 doubles, 1 treble)
  * Yankee (4 legs -> 11 bets: 6 doubles, 4 trebles, 1 four-fold)
  * Lucky 15 (4 legs -> 15 bets: 4 singles, 6 doubles, 4 trebles, 1 four-fold)
  * Canadian / Super Yankee (5 legs -> 26 bets: 10 doubles, 10 trebles, 5 four-folds, 1 five-fold)
  * Lucky 31 (5 legs -> 31 bets: 5 singles, 10 doubles, 10 trebles, 5 four-folds, 1 five-fold)
  * Heinz (6 legs -> 57 bets: 15 doubles, 20 trebles, 15 four-folds, 6 five-folds, 1 six-fold)
  * Lucky 63 (6 legs -> 63 bets: 6 singles, 15 doubles, 20 trebles, 15 four-folds, 6 five-folds, 1 six-fold)
  * Super Heinz (7 legs -> 120 bets)
  * Goliath (8 legs -> 247 bets)
- Exact minor unit settlement with PUSH / HALF_WON / HALF_LOST leg handling
- Same-Game Multi (SGM) / Bet Builder correlation discount modeling
"""

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from itertools import combinations
from typing import Dict, List, Optional, Set, Tuple


class LegStatus(str, Enum):
    PENDING = "PENDING"
    WON = "WON"
    HALF_WON = "HALF_WON"
    PUSH = "PUSH"          # Void / Push -> odds treated as 1.0
    HALF_LOST = "HALF_LOST"  # Half stake lost, other half lost -> zero return for combo
    LOST = "LOST"


class SystemBetType(str, Enum):
    SINGLE = "SINGLE"
    ACCUMULATOR = "ACCUMULATOR"
    TRIXIE = "TRIXIE"
    PATENT = "PATENT"
    YANKEE = "YANKEE"
    LUCKY_15 = "LUCKY_15"
    CANADIAN = "CANADIAN"
    LUCKY_31 = "LUCKY_31"
    HEINZ = "HEINZ"
    LUCKY_63 = "LUCKY_63"
    SUPER_HEINZ = "SUPER_HEINZ"
    GOLIATH = "GOLIATH"


# Definition of system bet structures:
# (required_selections, [combination sizes included], has_singles_bonuses)
SYSTEM_BET_CONFIG: Dict[SystemBetType, Tuple[int, List[int]]] = {
    SystemBetType.TRIXIE: (3, [2, 3]),
    SystemBetType.PATENT: (3, [1, 2, 3]),
    SystemBetType.YANKEE: (4, [2, 3, 4]),
    SystemBetType.LUCKY_15: (4, [1, 2, 3, 4]),
    SystemBetType.CANADIAN: (5, [2, 3, 4, 5]),
    SystemBetType.LUCKY_31: (5, [1, 2, 3, 4, 5]),
    SystemBetType.HEINZ: (6, [2, 3, 4, 5, 6]),
    SystemBetType.LUCKY_63: (6, [1, 2, 3, 4, 5, 6]),
    SystemBetType.SUPER_HEINZ: (7, [2, 3, 4, 5, 6, 7]),
    SystemBetType.GOLIATH: (8, [2, 3, 4, 5, 6, 7, 8]),
}


class SelectionLeg:
    def __init__(
        self,
        leg_id: str,
        fixture_id: str,
        market_key: str,
        selection_key: str,
        odds_decimal: float,
        status: LegStatus = LegStatus.PENDING,
    ):
        if odds_decimal < 1.01:
            raise ValueError(f"Odds must be at least 1.01, got {odds_decimal}")
        self.leg_id = leg_id
        self.fixture_id = fixture_id
        self.market_key = market_key
        self.selection_key = selection_key
        self.odds_decimal = odds_decimal
        self.status = status

    def effective_multiplier(self) -> Decimal:
        """Returns the multiplier factor for this leg during settlement."""
        if self.status == LegStatus.WON:
            return Decimal(str(self.odds_decimal))
        elif self.status == LegStatus.PUSH:
            return Decimal("1.0")
        elif self.status == LegStatus.HALF_WON:
            # Half-won in accumulator: (odds + 1) / 2
            return (Decimal(str(self.odds_decimal)) + Decimal("1.0")) / Decimal("2.0")
        elif self.status in (LegStatus.HALF_LOST, LegStatus.LOST):
            return Decimal("0.0")
        else:
            return Decimal(str(self.odds_decimal))


def calculate_system_bet_line_count(system_type: SystemBetType, selection_count: int) -> int:
    """Returns the total number of bets / lines for a given system bet type."""
    if system_type == SystemBetType.SINGLE:
        return selection_count
    if system_type == SystemBetType.ACCUMULATOR:
        return 1

    if system_type not in SYSTEM_BET_CONFIG:
        raise ValueError(f"Unknown system bet type: {system_type}")

    required_sel, group_sizes = SYSTEM_BET_CONFIG[system_type]
    if selection_count < required_sel:
        raise ValueError(
            f"{system_type.value} requires at least {required_sel} selections, got {selection_count}"
        )

    total_lines = 0
    from math import comb
    for k in group_sizes:
        total_lines += comb(selection_count, k)
    return total_lines


def settle_parlay_combination(
    stake_minor_per_line: int,
    legs: List[SelectionLeg],
) -> Tuple[int, int, bool]:
    """Settles a single combination of legs.

    Returns:
    - return_amount_minor
    - profit_minor
    - is_winner (whether return > 0)
    """
    if stake_minor_per_line <= 0:
        return 0, 0, False

    combined_multiplier = Decimal("1.0")
    for leg in legs:
        mult = leg.effective_multiplier()
        if mult == Decimal("0.0"):
            return 0, -stake_minor_per_line, False
        combined_multiplier *= mult

    gross_return = (Decimal(stake_minor_per_line) * combined_multiplier).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    gross_int = int(gross_return)
    profit_int = gross_int - stake_minor_per_line
    return gross_int, profit_int, gross_int > 0


def settle_system_bet(
    system_type: SystemBetType,
    unit_stake_minor: int,
    selections: List[SelectionLeg],
) -> Dict[str, object]:
    """Settles a full system or accumulator bet across all generated sub-combinations.

    :param system_type: e.g. TRIXIE, PATENT, YANKEE, ACCUMULATOR
    :param unit_stake_minor: Stake placed on EACH line / combination in minor units
    :param selections: The list of selections included in the bet
    """
    total_lines = calculate_system_bet_line_count(system_type, len(selections))
    total_stake_minor = total_lines * unit_stake_minor

    if system_type == SystemBetType.ACCUMULATOR:
        ret, prof, won = settle_parlay_combination(unit_stake_minor, selections)
        all_resolved = all(s.status != LegStatus.PENDING for s in selections)
        return {
            "system_type": system_type.value,
            "total_lines": 1,
            "unit_stake_minor": unit_stake_minor,
            "total_stake_minor": total_stake_minor,
            "winning_lines": 1 if won else 0,
            "total_return_minor": ret,
            "net_profit_minor": prof,
            "is_fully_resolved": all_resolved,
            "combinations": [
                {
                    "indices": list(range(len(selections))),
                    "size": len(selections),
                    "return_minor": ret,
                    "won": won,
                }
            ],
        }

    _, group_sizes = SYSTEM_BET_CONFIG[system_type]
    combinations_breakdown = []
    total_return_minor = 0
    winning_lines = 0

    indices = list(range(len(selections)))
    for size in group_sizes:
        for comb_indices in combinations(indices, size):
            combo_legs = [selections[i] for i in comb_indices]
            ret, _, won = settle_parlay_combination(unit_stake_minor, combo_legs)
            if won:
                winning_lines += 1
                total_return_minor += ret
            combinations_breakdown.append({
                "indices": list(comb_indices),
                "size": size,
                "return_minor": ret,
                "won": won,
            })

    net_profit_minor = total_return_minor - total_stake_minor
    all_resolved = all(s.status != LegStatus.PENDING for s in selections)

    return {
        "system_type": system_type.value,
        "total_lines": total_lines,
        "unit_stake_minor": unit_stake_minor,
        "total_stake_minor": total_stake_minor,
        "winning_lines": winning_lines,
        "total_return_minor": total_return_minor,
        "net_profit_minor": net_profit_minor,
        "is_fully_resolved": all_resolved,
        "combinations_count_by_size": {
            str(size): len([c for c in combinations_breakdown if c["size"] == size])
            for size in group_sizes
        },
        "sample_combinations": combinations_breakdown[:10],
    }


def calculate_sgm_correlated_odds(
    legs: List[Tuple[str, str, float]],
) -> Dict[str, object]:
    """Calculates Same-Game Multi / Bet Builder joint decimal odds with correlation adjustment.

    When multiple bets are placed on the SAME fixture (e.g. Arsenal to win + Over 2.5 + Saka anytime scorer),
    the markets are mathematically positively correlated. Multiplying odds naively without discounting
    gives massive player edge. This engine applies standard bookmaker copula correlation matrices.

    :param legs: List of tuples (market_key, selection_key, standard_odds)
    """
    if len(legs) <= 1:
        single_odds = legs[0][2] if legs else 1.0
        return {
            "unadjusted_odds": single_odds,
            "correlated_odds": single_odds,
            "correlation_factor": 1.0,
            "leg_count": len(legs),
        }

    unadjusted_multiplier = Decimal("1.0")
    for _, _, odds in legs:
        unadjusted_multiplier *= Decimal(str(odds))

    # Calculate correlation penalty based on interacting market types
    # e.g., Winner + Over/Under correlation = 0.88; Winner + BTTS = 0.90; Over + BTTS = 0.82
    market_keys = [l[0] for l in legs]
    factor = 1.0

    has_1x2 = "match_result" in market_keys or "1x2" in market_keys
    has_totals = "over_under" in market_keys or "totals" in market_keys
    has_btts = "btts" in market_keys
    has_scorer = any("scorer" in m for m in market_keys)

    if has_1x2 and has_totals:
        factor *= 0.89
    if has_1x2 and has_btts:
        factor *= 0.91
    if has_totals and has_btts:
        factor *= 0.83
    if has_scorer and (has_1x2 or has_totals):
        factor *= 0.86

    # Diminishing returns scaling for larger number of correlated legs
    if len(legs) >= 3:
        factor *= (0.95 ** (len(legs) - 2))

    # Ensure factor doesn't drop below fair mathematical floor (0.50)
    factor = max(0.50, min(1.0, factor))

    correlated = (unadjusted_multiplier * Decimal(str(factor))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    # Floor at 1.05
    correlated_float = max(1.05, float(correlated))

    return {
        "unadjusted_odds": round(float(unadjusted_multiplier), 2),
        "correlated_odds": correlated_float,
        "correlation_factor": round(factor, 3),
        "leg_count": len(legs),
    }
