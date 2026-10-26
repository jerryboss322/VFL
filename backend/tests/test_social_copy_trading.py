"""Unit tests for Social Trader Copy-Betting and Proportional Portfolio Mirroring Engine."""

import unittest

from backend.app.services.social_copy_trading import (
    CopySubscription,
    CopyTraderTier,
    MasterTraderProfile,
    calculate_trader_metrics,
    evaluate_copy_bet_allocation,
    settle_copy_bet_profit_share,
)


class TestSocialCopyTrading(unittest.TestCase):
    def test_trader_metrics_calculation(self):
        # Staked 1,000,000, Returned 1,350,000 across 20 bets (14 won)
        roi, win_rate, profit_factor = calculate_trader_metrics(
            total_staked_minor=1_000_000,
            total_returned_minor=1_350_000,
            won_bets=14,
            total_bets=20,
        )
        self.assertEqual(roi, 35.0)
        self.assertEqual(win_rate, 70.0)
        self.assertGreater(profit_factor, 1.0)

    def test_proportional_copy_allocation_approved(self):
        sub = CopySubscription(
            subscription_id="sub-101",
            follower_id="u-follower-1",
            master_id="u-master-sharp",
            max_stake_per_bet_minor=200_000,
            fixed_stake_minor=None,  # Proportional
            max_slippage_pct=5.0,
            active=True,
        )

        # Master bankroll: 10,000,000; Follower bankroll: 2,000,000 (ratio 0.20)
        # Master bet stake: 500,000 -> Proportional follower stake: 100,000
        eval_result = evaluate_copy_bet_allocation(
            subscription=sub,
            master_stake_minor=500_000,
            master_bankroll_minor=10_000_000,
            follower_bankroll_minor=2_000_000,
            master_odds=2.10,
            current_odds=2.08,  # Minor slippage < 5%
        )

        self.assertTrue(eval_result.approved)
        self.assertEqual(eval_result.calculated_stake_minor, 100_000)
        self.assertIsNone(eval_result.rejection_reason)

    def test_excessive_slippage_rejected(self):
        sub = CopySubscription(
            subscription_id="sub-102",
            follower_id="u-follower-2",
            master_id="u-master-sharp",
            max_stake_per_bet_minor=100_000,
            max_slippage_pct=5.0,
            active=True,
        )

        # Master took 2.50, but odds collapsed to 2.10 (16% slippage > 5%)
        eval_result = evaluate_copy_bet_allocation(
            subscription=sub,
            master_stake_minor=100_000,
            master_bankroll_minor=5_000_000,
            follower_bankroll_minor=1_000_000,
            master_odds=2.50,
            current_odds=2.10,
        )

        self.assertFalse(eval_result.approved)
        self.assertIn("ODDS_SLIPPAGE_EXCEEDED", eval_result.rejection_reason or "")

    def test_performance_fee_settlement(self):
        # Stake 100,000 minor, Win 250,000 minor (Profit 150,000 minor)
        # 10% performance fee = 15,000 minor to master trader
        # Follower receives net return = 235,000 minor
        follower_net, master_fee = settle_copy_bet_profit_share(
            stake_minor=100_000,
            return_minor=250_000,
            performance_fee_pct=10.0,
        )

        self.assertEqual(master_fee, 15_000)
        self.assertEqual(follower_net, 235_000)
        self.assertEqual(follower_net + master_fee, 250_000)

    def test_losing_bet_incurs_zero_fee(self):
        follower_net, master_fee = settle_copy_bet_profit_share(
            stake_minor=100_000,
            return_minor=0,
            performance_fee_pct=10.0,
        )
        self.assertEqual(master_fee, 0)
        self.assertEqual(follower_net, 0)


if __name__ == "__main__":
    unittest.main()
