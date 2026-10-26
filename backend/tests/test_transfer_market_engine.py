import unittest
from backend.app.services.transfer_market_engine import (
    TransferMarketEngine,
    PlayerContract,
    ClubFinancialFairPlayProfile,
    TransferBid,
    TransferBidStatus,
)


class TestTransferMarketEngine(unittest.TestCase):
    def setUp(self):
        # Star striker with £100m release clause
        self.star_striker = PlayerContract(
            player_id="p_star",
            name="Erling Haaland",
            club_id="club_mci",
            position="FWD",
            age=24,
            overall_rating=91,
            recent_form_rating=8.8,
            contract_years_remaining=3,
            weekly_wage_minor=375_000_00,  # £375k / week
            release_clause_minor=100_000_000_00,  # £100M
            is_transfer_listed=False,
        )

        # Veteran with 1 year left on contract
        self.veteran_winger = PlayerContract(
            player_id="p_vet",
            name="Aging Winger",
            club_id="club_mci",
            position="FWD",
            age=34,
            overall_rating=80,
            recent_form_rating=6.5,
            contract_years_remaining=1,
            weekly_wage_minor=150_000_00,
            release_clause_minor=20_000_000_00,
            is_transfer_listed=True,
        )

        # Wealthy buyer club
        self.buyer_real = ClubFinancialFairPlayProfile(
            club_id="club_rma",
            name="Real Madrid",
            cash_balance_minor=150_000_000_00,  # £150M cash
            annual_revenue_minor=800_000_000_00,  # £800M annual revenue
            annual_wage_bill_minor=400_000_000_00,  # 50% wage ratio (compliant)
        )

        # Selling club
        self.seller_mci = ClubFinancialFairPlayProfile(
            club_id="club_mci",
            name="Manchester City",
            cash_balance_minor=120_000_000_00,
            annual_revenue_minor=750_000_000_00,
            annual_wage_bill_minor=420_000_000_00,
        )

        # Broke / FFP-strained buyer club
        self.broke_buyer = ClubFinancialFairPlayProfile(
            club_id="club_broke",
            name="Financially Strained FC",
            cash_balance_minor=5_000_000_00,  # only £5M cash
            annual_revenue_minor=100_000_000_00,
            annual_wage_bill_minor=68_000_000_00,  # 68% wage ratio (almost at 70% cap)
        )

    def test_dynamic_valuation_math(self):
        val_star = TransferMarketEngine.calculate_market_value_minor(self.star_striker)
        val_vet = TransferMarketEngine.calculate_market_value_minor(self.veteran_winger)

        # Prime star in 20s with high rating and long contract commands far higher fee than 34yo with 1 yr
        self.assertGreater(val_star, val_vet * 4)
        self.assertGreater(val_star, 50_000_000_00)  # > £50M

    def test_release_clause_buyout_acceptance(self):
        # Buyer triggers £100M release clause
        bid = TransferBid(
            bid_id="bid_rc_1",
            player_id="p_star",
            buyer_club_id="club_rma",
            offered_fee_minor=100_000_000_00,
            offered_weekly_wage_minor=400_000_00,
        )

        evaluated = TransferMarketEngine.evaluate_bid(bid, self.star_striker, self.seller_mci, self.buyer_real)
        self.assertEqual(evaluated.status, TransferBidStatus.ACCEPTED)

    def test_insufficient_funds_rejection(self):
        # Broke buyer offers £50M when they only have £5M
        bid = TransferBid(
            bid_id="bid_broke",
            player_id="p_star",
            buyer_club_id="club_broke",
            offered_fee_minor=50_000_000_00,
            offered_weekly_wage_minor=200_000_00,
        )
        evaluated = TransferMarketEngine.evaluate_bid(bid, self.star_striker, self.seller_mci, self.broke_buyer)
        self.assertEqual(evaluated.status, TransferBidStatus.REJECTED_INSUFFICIENT_FUNDS)

    def test_ffp_wage_ceiling_rejection(self):
        # Buyer has £150M cash but wage bill is already near the 70% limit
        strained_buyer = ClubFinancialFairPlayProfile(
            club_id="club_strained",
            name="Strained High Spender",
            cash_balance_minor=150_000_000_00,
            annual_revenue_minor=100_000_000_00,
            annual_wage_bill_minor=69_500_000_00,  # 69.5% wage ratio
        )

        # Added wage of £400k/wk = £20.8M/yr -> pushes wage ratio to 90.3% > 70% FFP cap
        bid = TransferBid(
            bid_id="bid_ffp",
            player_id="p_star",
            buyer_club_id="club_strained",
            offered_fee_minor=100_000_000_00,
            offered_weekly_wage_minor=400_000_00,
        )
        evaluated = TransferMarketEngine.evaluate_bid(bid, self.star_striker, self.seller_mci, strained_buyer)
        self.assertEqual(evaluated.status, TransferBidStatus.REJECTED_FFP_CEILING)

    def test_execute_transfer_settlement(self):
        bid = TransferBid(
            bid_id="bid_exec",
            player_id="p_star",
            buyer_club_id="club_rma",
            offered_fee_minor=100_000_000_00,
            offered_weekly_wage_minor=400_000_00,
            status=TransferBidStatus.ACCEPTED,
        )

        initial_buyer_cash = self.buyer_real.cash_balance_minor
        initial_seller_cash = self.seller_mci.cash_balance_minor

        success = TransferMarketEngine.execute_transfer(bid, self.star_striker, self.seller_mci, self.buyer_real)
        self.assertTrue(success)

        # Verify cash transfers
        self.assertEqual(self.buyer_real.cash_balance_minor, initial_buyer_cash - 100_000_000_00)
        self.assertEqual(self.seller_mci.cash_balance_minor, initial_seller_cash + 100_000_000_00)

        # Player club changed to Real Madrid
        self.assertEqual(self.star_striker.club_id, "club_rma")
        self.assertEqual(self.star_striker.weekly_wage_minor, 400_000_00)


if __name__ == "__main__":
    unittest.main()
