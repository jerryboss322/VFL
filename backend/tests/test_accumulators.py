"""Unit tests for Accumulator permutations, system bets, and SGM correlation engine."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.accumulators import (
    LegStatus,
    SelectionLeg,
    SystemBetType,
    calculate_system_bet_line_count,
    calculate_sgm_correlated_odds,
    settle_parlay_combination,
    settle_system_bet,
)


class TestAccumulators(unittest.TestCase):
    def test_line_counts_for_system_bets(self):
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.TRIXIE, 3), 4)  # 3 doubles + 1 treble
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.PATENT, 3), 7)  # 3 singles + 3 doubles + 1 treble
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.YANKEE, 4), 11)  # 6 doubles + 4 trebles + 1 fourfold
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.LUCKY_15, 4), 15)  # 4 singles + 11
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.CANADIAN, 5), 26)  # 10 + 10 + 5 + 1
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.LUCKY_31, 5), 31)
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.HEINZ, 6), 57)
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.LUCKY_63, 6), 63)
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.SUPER_HEINZ, 7), 120)
        self.assertEqual(calculate_system_bet_line_count(SystemBetType.GOLIATH, 8), 247)

    def test_trixie_settlement_all_win(self):
        # 3 legs @ 2.0 each. Unit stake: 1000 ($10.00). Total stake: 4 * 1000 = 4000 ($40.00)
        legs = [
            SelectionLeg("1", "f1", "1x2", "HOME", 2.0, LegStatus.WON),
            SelectionLeg("2", "f2", "1x2", "HOME", 2.0, LegStatus.WON),
            SelectionLeg("3", "f3", "1x2", "HOME", 2.0, LegStatus.WON),
        ]
        res = settle_system_bet(SystemBetType.TRIXIE, 1000, legs)
        self.assertEqual(res["total_lines"], 4)
        self.assertEqual(res["total_stake_minor"], 4000)
        self.assertEqual(res["winning_lines"], 4)
        # Doubles: 3 * (1000 * 2 * 2) = 3 * 4000 = 12000
        # Treble: 1 * (1000 * 2 * 2 * 2) = 8000
        # Total return = 20000
        self.assertEqual(res["total_return_minor"], 20000)
        self.assertEqual(res["net_profit_minor"], 16000)

    def test_trixie_settlement_one_loss(self):
        # 2 win, 1 lose: 1 double wins (4000), other 2 doubles and treble lose
        legs = [
            SelectionLeg("1", "f1", "1x2", "HOME", 2.0, LegStatus.WON),
            SelectionLeg("2", "f2", "1x2", "HOME", 2.0, LegStatus.WON),
            SelectionLeg("3", "f3", "1x2", "HOME", 2.0, LegStatus.LOST),
        ]
        res = settle_system_bet(SystemBetType.TRIXIE, 1000, legs)
        self.assertEqual(res["winning_lines"], 1)
        self.assertEqual(res["total_return_minor"], 4000)
        self.assertEqual(res["net_profit_minor"], 0)  # broke even

    def test_accumulator_with_push_and_half_won(self):
        # Leg 1: 2.0 (WON)
        # Leg 2: 3.0 (PUSH -> multiplier becomes 1.0)
        # Leg 3: 2.0 (HALF_WON -> multiplier becomes (2 + 1) / 2 = 1.5)
        legs = [
            SelectionLeg("1", "f1", "1x2", "HOME", 2.0, LegStatus.WON),
            SelectionLeg("2", "f2", "totals", "OVER", 3.0, LegStatus.PUSH),
            SelectionLeg("3", "f3", "asian", "H-0.25", 2.0, LegStatus.HALF_WON),
        ]
        # Combined multiplier: 2.0 * 1.0 * 1.5 = 3.0
        # Stake: 1000 minor ($10) -> Return: 3000 minor ($30)
        ret, prof, won = settle_parlay_combination(1000, legs)
        self.assertTrue(won)
        self.assertEqual(ret, 3000)
        self.assertEqual(prof, 2000)

    def test_same_game_multi_correlation(self):
        legs = [
            ("match_result", "HOME", 1.80),
            ("over_under", "OVER_2_5", 1.95),
            ("btts", "YES", 1.85),
        ]
        # Unadjusted: 1.80 * 1.95 * 1.85 = 6.4935
        # Correlated should discount unadjusted multiplier to reflect joint probability
        res = calculate_sgm_correlated_odds(legs)
        self.assertAlmostEqual(res["unadjusted_odds"], 6.49, delta=0.02)
        self.assertTrue(res["correlated_odds"] < res["unadjusted_odds"])
        self.assertTrue(res["correlation_factor"] < 1.0)
        self.assertTrue(res["correlation_factor"] >= 0.5)


if __name__ == "__main__":
    unittest.main()
