import unittest
from backend.app.services.cashout_reoffer_engine import (
    CashoutReofferEngine,
    CashoutQuote,
    CashoutSlippageMode,
    CashoutExecutionStatus,
    AccumulatorLegStatus,
)


class TestCashoutReofferEngine(unittest.TestCase):
    def test_single_bet_fair_quote_calculation(self):
        # Stake £50.00 (5000 minor) @ 2.50 original odds. Live odds shortened to 1.50 (looking good!)
        quote = CashoutReofferEngine.calculate_single_quote(
            quote_id="q1",
            bet_id="bet_101",
            stake_minor=5000,
            original_odds=2.50,
            current_live_odds=1.50,
            bookmaker_margin=0.05,
        )
        self.assertFalse(quote.is_suspended)
        # Expected value: 5000 * (2.50 / 1.50) * 0.95 = 5000 * 1.6667 * 0.95 = ~7916 minor units (£79.16)
        self.assertGreater(quote.offered_payout_minor, 5000)
        self.assertLessEqual(quote.offered_payout_minor, quote.maximum_potential_return_minor)

    def test_market_suspension_quote(self):
        quote = CashoutReofferEngine.calculate_single_quote(
            quote_id="q_susp",
            bet_id="bet_102",
            stake_minor=5000,
            original_odds=2.50,
            current_live_odds=1.50,
            is_market_suspended=True,
            suspension_reason="VAR Penalty Check in Progress",
        )
        self.assertTrue(quote.is_suspended)
        self.assertEqual(quote.offered_payout_minor, 0)
        self.assertEqual(quote.suspension_reason, "VAR Penalty Check in Progress")

    def test_slippage_protection_accept_higher_only(self):
        # Current live quote is £70.00 (7000 minor)
        quote = CashoutQuote(
            quote_id="q_live",
            bet_id="bet_103",
            offered_payout_minor=7000,
            original_stake_minor=5000,
            maximum_potential_return_minor=12500,
            is_suspended=False,
        )

        # User clicked when expecting £68.00 -> Live offer is £70.00 (price improved!) -> EXECUTED
        res_higher = CashoutReofferEngine.execute_cashout_attempt(
            expected_offer_minor=6800,
            current_quote=quote,
            slippage_mode=CashoutSlippageMode.ACCEPT_HIGHER_ONLY,
        )
        self.assertEqual(res_higher.status, CashoutExecutionStatus.EXECUTED)
        self.assertEqual(res_higher.payout_credited_minor, 7000)

        # User clicked when expecting £78.00 -> Live offer dropped to £70.00 -> PRICE_CHANGED
        res_lower = CashoutReofferEngine.execute_cashout_attempt(
            expected_offer_minor=7800,
            current_quote=quote,
            slippage_mode=CashoutSlippageMode.ACCEPT_HIGHER_ONLY,
        )
        self.assertEqual(res_lower.status, CashoutExecutionStatus.PRICE_CHANGED)
        self.assertEqual(res_lower.payout_credited_minor, 0)

    def test_slippage_accept_all_changes(self):
        quote = CashoutQuote(
            quote_id="q_live",
            bet_id="bet_104",
            offered_payout_minor=6000,
            original_stake_minor=5000,
            maximum_potential_return_minor=12500,
            is_suspended=False,
        )
        # Even though user expected 7500, mode is ACCEPT_ALL_CHANGES -> executes at 6000
        res = CashoutReofferEngine.execute_cashout_attempt(
            expected_offer_minor=7500,
            current_quote=quote,
            slippage_mode=CashoutSlippageMode.ACCEPT_ALL_CHANGES,
        )
        self.assertEqual(res.status, CashoutExecutionStatus.EXECUTED)
        self.assertEqual(res.payout_credited_minor, 6000)

    def test_accumulator_cashout_calculation(self):
        legs = [
            AccumulatorLegStatus("l1", status="WON", original_odds=2.00, current_live_odds=1.0),
            AccumulatorLegStatus("l2", status="IN_PLAY", original_odds=1.80, current_live_odds=1.20),
            AccumulatorLegStatus("l3", status="UPCOMING", original_odds=1.50, current_live_odds=1.50),
        ]
        # Stake £10.00 (1000 minor)
        cashout_val = CashoutReofferEngine.calculate_accumulator_cashout(
            stake_minor=1000,
            legs=legs,
        )
        # Leg 1 (2.0x) * Leg 2 (1.80/1.20 = 1.5x) * Leg 3 (1.0x) = 3.0x minus margin = ~2820 minor
        self.assertGreater(cashout_val, 2500)
        self.assertLess(cashout_val, 3000)

        # If any leg is LOST -> cashout is immediately 0
        legs[0].status = "LOST"
        lost_val = CashoutReofferEngine.calculate_accumulator_cashout(
            stake_minor=1000,
            legs=legs,
        )
        self.assertEqual(lost_val, 0)


if __name__ == "__main__":
    unittest.main()
