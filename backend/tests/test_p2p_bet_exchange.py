import unittest
from backend.app.services.p2p_bet_exchange import (
    P2PBetExchangeEngine,
    P2PBetOffer,
    P2POfferType,
    P2POfferStatus,
    P2PMatchedContract,
)


class TestP2PBetExchangeEngine(unittest.TestCase):
    def setUp(self):
        # 2% commission
        self.engine = P2PBetExchangeEngine(commission_rate=0.02)
        self.market = "match_101:full_time_result:HOME"

    def test_post_back_offer_and_escrow_validation(self):
        # Stake 5000 minor units (£50.00), user has only 4000 -> should raise ValueError
        with self.assertRaises(ValueError) as ctx:
            self.engine.post_offer(
                offer_id="o1",
                user_id="user_alice",
                market_key=self.market,
                offer_type=P2POfferType.BACK,
                target_odds=2.50,
                stake_minor=5000,
                user_available_balance_minor=4000,
            )
        self.assertIn("Insufficient escrow", str(ctx.exception))

        # With 5000 balance -> success
        offer, matches = self.engine.post_offer(
            offer_id="o1",
            user_id="user_alice",
            market_key=self.market,
            offer_type=P2POfferType.BACK,
            target_odds=2.50,
            stake_minor=5000,
            user_available_balance_minor=10000,
        )
        self.assertEqual(offer.status, P2POfferStatus.OPEN)
        self.assertEqual(offer.unmatched_stake_minor, 5000)
        self.assertEqual(len(matches), 0)

    def test_post_lay_offer_liability_escrow(self):
        # Lay £50.00 at odds 3.00 requires liability: £50 * (3 - 1) = £100.00 (10000 minor units)
        with self.assertRaises(ValueError):
            self.engine.post_offer(
                offer_id="o_lay_fail",
                user_id="user_bob",
                market_key=self.market,
                offer_type=P2POfferType.LAY,
                target_odds=3.00,
                stake_minor=5000,
                user_available_balance_minor=8000,  # 8000 < 10000
            )

        offer, _ = self.engine.post_offer(
            offer_id="o_lay",
            user_id="user_bob",
            market_key=self.market,
            offer_type=P2POfferType.LAY,
            target_odds=3.00,
            stake_minor=5000,
            user_available_balance_minor=15000,
        )
        self.assertEqual(offer.total_liability_minor, 10000)
        self.assertEqual(offer.escrow_required_minor, 10000)

    def test_cross_match_and_partial_fill(self):
        # Maker: Bob posts LAY £100.00 at 2.00 (liability £100.00)
        maker_offer, _ = self.engine.post_offer(
            offer_id="o_maker",
            user_id="user_bob",
            market_key=self.market,
            offer_type=P2POfferType.LAY,
            target_odds=2.00,
            stake_minor=100_00,
            user_available_balance_minor=200_00,
        )

        # Taker: Alice posts BACK £40.00 at 2.00
        taker_offer, matches = self.engine.post_offer(
            offer_id="o_taker",
            user_id="user_alice",
            market_key=self.market,
            offer_type=P2POfferType.BACK,
            target_odds=2.00,
            stake_minor=40_00,
            user_available_balance_minor=100_00,
        )

        self.assertEqual(len(matches), 1)
        match = matches[0]
        self.assertEqual(match.stake_minor, 40_00)
        self.assertEqual(match.liability_minor, 40_00)
        self.assertEqual(match.backer_user_id, "user_alice")
        self.assertEqual(match.layer_user_id, "user_bob")

        # Taker is fully matched
        self.assertEqual(taker_offer.status, P2POfferStatus.FULLY_MATCHED)
        self.assertEqual(taker_offer.matched_stake_minor, 40_00)

        # Maker is partially matched with £60.00 remaining
        self.assertEqual(maker_offer.status, P2POfferStatus.PARTIALLY_MATCHED)
        self.assertEqual(maker_offer.matched_stake_minor, 40_00)
        self.assertEqual(maker_offer.unmatched_stake_minor, 60_00)

    def test_cancel_offer_and_refund(self):
        offer, _ = self.engine.post_offer(
            offer_id="o_cancel",
            user_id="user_alice",
            market_key=self.market,
            offer_type=P2POfferType.BACK,
            target_odds=2.50,
            stake_minor=30_00,
            user_available_balance_minor=50_00,
        )

        refund = self.engine.cancel_offer("o_cancel", "user_alice")
        self.assertEqual(refund, 30_00)
        self.assertEqual(offer.status, P2POfferStatus.CANCELLED)

    def test_settlement_backer_wins(self):
        # Match £50.00 stake at 2.40 odds:
        # Stake = £50.00 (5000 minor)
        # Liability = £50 * 1.40 = £70.00 (7000 minor)
        # Total Pot = 5000 + 7000 = 12000 minor units
        self.engine.post_offer(
            offer_id="maker_lay",
            user_id="user_bob",
            market_key=self.market,
            offer_type=P2POfferType.LAY,
            target_odds=2.40,
            stake_minor=5000,
            user_available_balance_minor=20000,
        )
        self.engine.post_offer(
            offer_id="taker_back",
            user_id="user_alice",
            market_key=self.market,
            offer_type=P2POfferType.BACK,
            target_odds=2.40,
            stake_minor=5000,
            user_available_balance_minor=20000,
        )

        # Backer wins!
        settled_contracts = self.engine.settle_market(self.market, backer_wins=True)
        self.assertEqual(len(settled_contracts), 1)
        c = settled_contracts[0]

        self.assertTrue(c.is_settled)
        self.assertEqual(c.winner_user_id, "user_alice")
        # Net profit = 7000. Commission = 2% of 7000 = 140 minor units.
        # Payout = 12000 - 140 = 11860 minor units.
        self.assertEqual(c.commission_minor, 140)
        self.assertEqual(c.payout_minor, 11860)

    def test_settlement_layer_wins(self):
        self.engine.post_offer(
            offer_id="maker_lay",
            user_id="user_bob",
            market_key=self.market,
            offer_type=P2POfferType.LAY,
            target_odds=2.00,
            stake_minor=5000,
            user_available_balance_minor=20000,
        )
        self.engine.post_offer(
            offer_id="taker_back",
            user_id="user_alice",
            market_key=self.market,
            offer_type=P2POfferType.BACK,
            target_odds=2.00,
            stake_minor=5000,
            user_available_balance_minor=20000,
        )

        # Layer wins!
        settled_contracts = self.engine.settle_market(self.market, backer_wins=False)
        self.assertEqual(len(settled_contracts), 1)
        c = settled_contracts[0]

        self.assertTrue(c.is_settled)
        self.assertEqual(c.winner_user_id, "user_bob")
        # Total pot = 5000 stake + 5000 liability = 10000.
        # Layer net profit = 5000 stake. Commission = 2% of 5000 = 100 minor units.
        # Payout = 10000 - 100 = 9900 minor units.
        self.assertEqual(c.commission_minor, 100)
        self.assertEqual(c.payout_minor, 9900)


if __name__ == "__main__":
    unittest.main()
