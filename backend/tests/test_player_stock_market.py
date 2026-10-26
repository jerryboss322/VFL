"""Unit tests for Virtual Player Stock Exchange & Fractional Share Trading Floor Engine."""

import unittest

from backend.app.services.player_stock_market import (
    PlayerSharePool,
    TraderPlayerPosition,
    compute_matchday_player_dividends,
    execute_share_trade,
    get_current_share_price_minor,
)


class TestPlayerStockMarket(unittest.TestCase):
    def setUp(self):
        # 10,000 shares in pool backed by 50,000,000 minor units (500,000 XTS)
        # Spot price = 50,000,000 / 10,000 = 5,000 minor units (50.00 XTS per share)
        self.pool = PlayerSharePool(
            player_id="ply-haaland",
            player_name="Erling Haaland",
            club_name="Manchester Blue",
            position="FWD",
            cash_reserve_minor=50_000_000,
            shares_reserve=10_000,
            total_shares_issued=20_000,
            base_dividend_yield_minor=500,
            spread_pct=1.5,
        )

    def test_spot_price_calculation(self):
        spot = get_current_share_price_minor(self.pool)
        self.assertEqual(spot, 5000)

    def test_buy_shares_advances_price_and_deducts_cash(self):
        pos = TraderPlayerPosition("trader-1", self.pool.player_id, 0, 0)
        # Trader buys 100 shares with 1,000,000 balance
        res, pool, new_pos = execute_share_trade(
            pool=self.pool,
            trader_position=pos,
            side="BUY",
            shares_requested=100,
            trader_balance_minor=1_000_000,
        )

        self.assertTrue(res.success)
        self.assertEqual(res.shares, 100)
        self.assertEqual(new_pos.shares_owned, 100)
        self.assertGreater(res.total_cost_or_proceeds_minor, 500_000)
        self.assertGreater(pool.cash_reserve_minor, 50_000_000)
        self.assertEqual(pool.shares_reserve, 9_900)
        # Pool price increased because shares were purchased
        self.assertGreater(res.new_pool_price_minor, 5000)

    def test_sell_shares_credits_cash_and_lowers_price(self):
        # Trader already owns 100 shares
        pos = TraderPlayerPosition("trader-1", self.pool.player_id, 100, 5000)
        res, pool, new_pos = execute_share_trade(
            pool=self.pool,
            trader_position=pos,
            side="SELL",
            shares_requested=50,
            trader_balance_minor=100_000,
        )

        self.assertTrue(res.success)
        self.assertEqual(res.shares, 50)
        self.assertEqual(new_pos.shares_owned, 50)
        self.assertGreater(res.total_cost_or_proceeds_minor, 0)
        self.assertEqual(pool.shares_reserve, 10_050)
        # Pool price decreased because shares were supplied
        self.assertLess(res.new_pool_price_minor, 5000)

    def test_insufficient_shares_sell_rejected(self):
        pos = TraderPlayerPosition("trader-1", self.pool.player_id, 10, 5000)
        res, pool, new_pos = execute_share_trade(
            pool=self.pool,
            trader_position=pos,
            side="SELL",
            shares_requested=50,  # Only owns 10
            trader_balance_minor=100_000,
        )
        self.assertFalse(res.success)
        self.assertEqual(res.error_message, "INSUFFICIENT_SHARES_OWNED")

    def test_matchday_dividend_calculation(self):
        pos = TraderPlayerPosition("trader-1", self.pool.player_id, 100, 5000)
        # Player scored 2 goals (2 * 500 = 1000), 1 assist (250), match rating 8.8 (+500)
        # Total per share = 1750 minor units -> For 100 shares = 175,000 minor units
        payout = compute_matchday_player_dividends(
            player_position=pos,
            goals_scored=2,
            assists_provided=1,
            match_rating=8.8,
            is_clean_sheet=False,
            base_yield_minor=500,
        )

        self.assertEqual(payout, 175_000)
        self.assertEqual(pos.total_dividends_earned_minor, 175_000)


if __name__ == "__main__":
    unittest.main()
