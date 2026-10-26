"""Unit tests for Asian Handicap mathematical settlement and odds engine."""

import unittest
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.asian_handicap import (
    AsianSettlementOutcome,
    generate_asian_handicap_market,
    settle_asian_handicap,
)


class TestAsianHandicap(unittest.TestCase):
    def test_level_ball_zero_handicap_draw_no_bet(self):
        stake = 10000  # 100.00
        odds = 1.90

        # Win: 2 - 1
        res = settle_asian_handicap(stake, odds, handicap=0.0, home_goals=2, away_goals=1, is_home_bet=True)
        self.assertEqual(res.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res.return_amount_minor, 19000)
        self.assertEqual(res.profit_loss_minor, 9000)

        # Draw: 1 - 1 -> Push / Refund
        res_draw = settle_asian_handicap(stake, odds, handicap=0.0, home_goals=1, away_goals=1, is_home_bet=True)
        self.assertEqual(res_draw.outcome, AsianSettlementOutcome.PUSH)
        self.assertEqual(res_draw.return_amount_minor, 10000)
        self.assertEqual(res_draw.profit_loss_minor, 0)

        # Loss: 0 - 2
        res_loss = settle_asian_handicap(stake, odds, handicap=0.0, home_goals=0, away_goals=2, is_home_bet=True)
        self.assertEqual(res_loss.outcome, AsianSettlementOutcome.LOST)
        self.assertEqual(res_loss.return_amount_minor, 0)
        self.assertEqual(res_loss.profit_loss_minor, -10000)

    def test_half_line_handicap(self):
        stake = 10000
        odds = 2.05

        # Home -0.5 on 1 - 0 win -> WON
        res_win = settle_asian_handicap(stake, odds, handicap=-0.5, home_goals=1, away_goals=0, is_home_bet=True)
        self.assertEqual(res_win.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res_win.return_amount_minor, 20500)

        # Home -0.5 on 1 - 1 draw -> LOST
        res_draw = settle_asian_handicap(stake, odds, handicap=-0.5, home_goals=1, away_goals=1, is_home_bet=True)
        self.assertEqual(res_draw.outcome, AsianSettlementOutcome.LOST)
        self.assertEqual(res_draw.return_amount_minor, 0)

        # Away +0.5 on 1 - 1 draw -> WON
        res_away = settle_asian_handicap(stake, odds, handicap=0.5, home_goals=1, away_goals=1, is_home_bet=False)
        self.assertEqual(res_away.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res_away.return_amount_minor, 20500)

    def test_quarter_line_minus_quarter(self):
        """-0.25 splits into 0.0 and -0.5"""
        stake = 10000
        odds = 2.00

        # Win 2 - 1 -> Both splits win -> Full Win
        res_win = settle_asian_handicap(stake, odds, handicap=-0.25, home_goals=2, away_goals=1, is_home_bet=True)
        self.assertEqual(res_win.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res_win.return_amount_minor, 20000)

        # Draw 0 - 0 -> 0.0 pushes (5,000 returned), -0.5 loses (0 returned) -> HALF_LOST
        res_half_loss = settle_asian_handicap(stake, odds, handicap=-0.25, home_goals=0, away_goals=0, is_home_bet=True)
        self.assertEqual(res_half_loss.outcome, AsianSettlementOutcome.HALF_LOST)
        self.assertEqual(res_half_loss.return_amount_minor, 5000)
        self.assertEqual(res_half_loss.profit_loss_minor, -5000)

        # Loss 0 - 1 -> Both splits lose -> Full Loss
        res_loss = settle_asian_handicap(stake, odds, handicap=-0.25, home_goals=0, away_goals=1, is_home_bet=True)
        self.assertEqual(res_loss.outcome, AsianSettlementOutcome.LOST)
        self.assertEqual(res_loss.return_amount_minor, 0)

    def test_quarter_line_plus_quarter(self):
        """+0.25 splits into 0.0 and +0.5"""
        stake = 10000
        odds = 1.90

        # Win 1 - 0 -> Full Win
        res_win = settle_asian_handicap(stake, odds, handicap=0.25, home_goals=1, away_goals=0, is_home_bet=True)
        self.assertEqual(res_win.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res_win.return_amount_minor, 19000)

        # Draw 1 - 1 -> 0.0 pushes (5,000 returned), +0.5 wins (5,000 * 1.90 = 9,500) -> HALF_WON
        res_half_win = settle_asian_handicap(stake, odds, handicap=0.25, home_goals=1, away_goals=1, is_home_bet=True)
        self.assertEqual(res_half_win.outcome, AsianSettlementOutcome.HALF_WON)
        self.assertEqual(res_half_win.return_amount_minor, 14500)
        self.assertEqual(res_half_win.profit_loss_minor, 4500)

    def test_quarter_line_minus_three_quarters(self):
        """-0.75 splits into -0.5 and -1.0"""
        stake = 10000
        odds = 2.10

        # Win by 2 goals (2 - 0) -> Both splits win -> Full Win
        res_win2 = settle_asian_handicap(stake, odds, handicap=-0.75, home_goals=2, away_goals=0, is_home_bet=True)
        self.assertEqual(res_win2.outcome, AsianSettlementOutcome.WON)
        self.assertEqual(res_win2.return_amount_minor, 21000)

        # Win by exactly 1 goal (1 - 0) -> -0.5 wins (5,000 * 2.10 = 10,500), -1.0 pushes (5,000) -> HALF_WON
        res_win1 = settle_asian_handicap(stake, odds, handicap=-0.75, home_goals=1, away_goals=0, is_home_bet=True)
        self.assertEqual(res_win1.outcome, AsianSettlementOutcome.HALF_WON)
        self.assertEqual(res_win1.return_amount_minor, 15500)
        self.assertEqual(res_win1.profit_loss_minor, 5500)

        # Draw 1 - 1 -> Full Loss
        res_draw = settle_asian_handicap(stake, odds, handicap=-0.75, home_goals=1, away_goals=1, is_home_bet=True)
        self.assertEqual(res_draw.outcome, AsianSettlementOutcome.LOST)
        self.assertEqual(res_draw.return_amount_minor, 0)

    def test_market_generation(self):
        market = generate_asian_handicap_market("Arsenal", "Chelsea", 1.34, 1.28, 1.24, 1.16)
        self.assertEqual(market["key"], "asian_handicap")
        self.assertEqual(len(market["options"]), 10)  # 5 lines x 2 sides
        self.assertTrue(all("odds" in opt and "handicap" in opt for opt in market["options"]))


if __name__ == "__main__":
    unittest.main()
