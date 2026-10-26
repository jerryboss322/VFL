"""Unit tests for Central Limit Order Book (CLOB) & Matching Engine."""

import unittest

from backend.app.services.order_book_engine import (
    OrderSide,
    OrderStatus,
    OrderType,
    PlayerLimitOrderBook,
)


class TestOrderBookEngine(unittest.TestCase):
    def setUp(self):
        self.book = PlayerLimitOrderBook(player_id="ply-haaland")

    def test_limit_order_placement_and_sorting(self):
        # Place 2 buy orders at different prices
        ord1, fills1 = self.book.submit_order(
            trader_id="t1", side=OrderSide.BUY, order_type=OrderType.LIMIT, quantity=10, price_minor=5000
        )
        ord2, fills2 = self.book.submit_order(
            trader_id="t2", side=OrderSide.BUY, order_type=OrderType.LIMIT, quantity=5, price_minor=5200
        )

        self.assertEqual(len(fills1), 0)
        self.assertEqual(len(fills2), 0)
        self.assertEqual(len(self.book.bids), 2)
        # 5200 must be first (descending price)
        self.assertEqual(self.book.bids[0].price_minor, 5200)
        self.assertEqual(self.book.bids[1].price_minor, 5000)

    def test_immediate_match_execution(self):
        # Maker submits limit sell: 10 shares @ 5100
        self.book.submit_order("maker", OrderSide.SELL, OrderType.LIMIT, quantity=10, price_minor=5100)

        # Taker submits limit buy: 6 shares @ 5150 (crosses book)
        order_taker, fills = self.book.submit_order("taker", OrderSide.BUY, OrderType.LIMIT, quantity=6, price_minor=5150)

        self.assertEqual(len(fills), 1)
        self.assertEqual(fills[0].executed_quantity, 6)
        self.assertEqual(fills[0].executed_price_minor, 5100)
        self.assertEqual(fills[0].total_minor, 6 * 5100)
        self.assertEqual(order_taker.status, OrderStatus.FILLED)

        # Maker order should have 4 shares remaining
        self.assertEqual(len(self.book.asks), 1)
        self.assertEqual(self.book.asks[0].remaining_quantity, 4)
        self.assertEqual(self.book.asks[0].status, OrderStatus.PARTIALLY_FILLED)

    def test_market_order_sweep(self):
        # Provide liquidity at two price levels: 5 shares @ 5000, 5 shares @ 5100
        self.book.submit_order("m1", OrderSide.SELL, OrderType.LIMIT, quantity=5, price_minor=5000)
        self.book.submit_order("m2", OrderSide.SELL, OrderType.LIMIT, quantity=5, price_minor=5100)

        # Market buy for 8 shares sweeps 5 @ 5000 and 3 @ 5100
        mkt_order, fills = self.book.submit_order("taker", OrderSide.BUY, OrderType.MARKET, quantity=8)

        self.assertEqual(len(fills), 2)
        self.assertEqual(fills[0].executed_quantity, 5)
        self.assertEqual(fills[0].executed_price_minor, 5000)
        self.assertEqual(fills[1].executed_quantity, 3)
        self.assertEqual(fills[1].executed_price_minor, 5100)
        self.assertEqual(mkt_order.status, OrderStatus.FILLED)

        # 2 shares remain on m2 ask @ 5100
        self.assertEqual(len(self.book.asks), 1)
        self.assertEqual(self.book.asks[0].remaining_quantity, 2)

    def test_order_cancellation(self):
        ord_buy, _ = self.book.submit_order("t1", OrderSide.BUY, OrderType.LIMIT, quantity=20, price_minor=4800)
        cancelled = self.book.cancel_order(ord_buy.order_id)

        self.assertIsNotNone(cancelled)
        self.assertEqual(cancelled.status, OrderStatus.CANCELLED)
        self.assertEqual(len(self.book.bids), 0)

    def test_l2_depth_aggregation(self):
        self.book.submit_order("t1", OrderSide.BUY, OrderType.LIMIT, quantity=10, price_minor=5000)
        self.book.submit_order("t2", OrderSide.BUY, OrderType.LIMIT, quantity=15, price_minor=5000)
        self.book.submit_order("t3", OrderSide.SELL, OrderType.LIMIT, quantity=20, price_minor=5200)

        depth = self.book.get_l2_depth()
        self.assertEqual(len(depth.bids), 1)
        self.assertEqual(depth.bids[0].price_minor, 5000)
        self.assertEqual(depth.bids[0].total_quantity, 25)
        self.assertEqual(depth.bids[0].order_count, 2)
        self.assertEqual(depth.spread_minor, 200)


if __name__ == "__main__":
    unittest.main()
