"""Unit tests for Cashout mathematical valuation, partial cashout, and auto-cashout rules."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.cashout_math import (
    CashoutTriggerType,
    calculate_fair_cashout_value,
    calculate_partial_cashout_split,
    evaluate_auto_cashout_triggers,
)


class TestCashoutMath(unittest.TestCase):
    def test_in_play_lead_cashout_profit(self):
        # Stake: 10,000 minor ($100). Original odds: 3.00.
        # Team scores and leads -> Live odds drop to 1.25.
        # Fair value without margin: 10,000 * (3.00 / 1.25) = 24,000
        # With ~6% margin: ~22,500 minor ($225.00) -> profitable cashout!
        offer = calculate_fair_cashout_value(10000, 3.00, 1.25, match_minute=65)
        self.assertTrue(offer > 10000)
        self.assertTrue(offer < 30000)

    def test_trailing_team_cashout_loss(self):
        # Backed team is losing -> live odds lengthen from 2.00 to 8.00
        # Value drops significantly below initial stake
        offer = calculate_fair_cashout_value(10000, 2.00, 8.00, match_minute=70)
        self.assertTrue(offer < 10000)
        self.assertTrue(offer > 0)

    def test_partial_cashout_50_percent(self):
        # Original stake 10,000; cashout offer 20,000. Take 50%.
        payout, rem_stake, rem_offer = calculate_partial_cashout_split(10000, 20000, 50.0)
        self.assertEqual(payout, 10000)
        self.assertEqual(rem_stake, 5000)
        self.assertEqual(rem_offer, 10000)

    def test_auto_cashout_take_profit_trigger(self):
        # Target: 25,000 minor. Current offer: 26,000 -> Should trigger
        triggered, trig_type, msg = evaluate_auto_cashout_triggers(
            current_cashout_offer_minor=26000,
            take_profit_threshold_minor=25000,
        )
        self.assertTrue(triggered)
        self.assertEqual(trig_type, CashoutTriggerType.TAKE_PROFIT)

    def test_auto_cashout_stop_loss_trigger(self):
        # Protection floor: 4,000 minor. Current offer: 3,500 -> Should trigger
        triggered, trig_type, msg = evaluate_auto_cashout_triggers(
            current_cashout_offer_minor=3500,
            stop_loss_threshold_minor=4000,
        )
        self.assertTrue(triggered)
        self.assertEqual(trig_type, CashoutTriggerType.STOP_LOSS)


if __name__ == "__main__":
    unittest.main()
