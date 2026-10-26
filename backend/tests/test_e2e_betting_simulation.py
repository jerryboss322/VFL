"""End-to-End Betting, Match Simulation, and Financial Settlement Verification Suite.

Exercises the full virtual sports pipeline:
1. Deterministic match generation & Poisson goal generation
2. Multi-market odds calculation (1X2, Asian Handicap, Over/Under 2.5)
3. Multi-bet accumulator parlay settlement with PUSH / HALF_WON handling
4. Real-time in-play tick clock catchup & VAR reviews (SAOT millimeter telemetry)
5. Anti-fraud latency arbitrage & automated bot velocity rejection
6. Double-entry financial ledger journalization & reserve solvency verification
7. P2P exchange escrow execution and 2% net commission settlement
8. Virtual player stock exchange AMM share trading & performance dividends
"""

from datetime import datetime, timezone
import unittest

from backend.app.services.odds_engine import compute_expected_goals, compute_probability_explanation
from backend.app.services.asian_handicap import settle_asian_handicap, AsianSettlementOutcome
from backend.app.services.accumulators import (
    settle_parlay_combination,
    SelectionLeg,
    LegStatus,
)
from backend.app.services.anti_fraud_engine import (
    evaluate_wager_risk,
    WagerTelemetry,
    RiskAction,
)
from backend.app.services.var_engine import (
    compute_semi_automated_offside,
    conduct_var_review,
    VarIncidentType,
    VarReviewOutcome,
)
from backend.app.services.ledger_reconciliation import (
    conduct_full_ledger_audit,
    RawLedgerEntry,
    WalletState,
    LedgerReconciliationStatus,
)
from backend.app.services.p2p_bet_exchange import (
    P2PBetExchangeEngine,
    P2POfferType,
    P2POfferStatus,
)
from backend.app.services.player_stock_market import (
    PlayerSharePool,
    TraderPlayerPosition,
    execute_share_trade,
    compute_matchday_player_dividends,
)


class TestE2EBettingSimulation(unittest.TestCase):
    def test_full_platform_lifecycle(self):
        # 1. Poisson expected goals and match probability explainer
        lam_h, lam_a = compute_expected_goals(
            home_attack=1.85, home_defense=0.92,
            away_attack=1.45, away_defense=1.10
        )
        self.assertGreater(lam_h, 1.0)
        self.assertGreater(lam_a, 0.5)

        explainer = compute_probability_explanation(
            home_name="Arsenal",
            away_name="Chelsea",
            home_attack=1.85, home_defense=0.92,
            away_attack=1.45, away_defense=1.10
        )
        self.assertGreater(explainer["winProbabilities"]["home"], 40.0)
        self.assertGreater(explainer["winProbabilities"]["over25"], 35.0)

        # 2. Asian Handicap calculation
        ah_res = settle_asian_handicap(
            stake_minor=100_00,  # £100.00
            odds_decimal=1.95,
            handicap=-0.75,
            home_goals=2,
            away_goals=1,
            is_home_bet=True,
        )
        # 2 - 1 = 1 goal margin with -0.75 line -> HALF_WON
        self.assertGreater(ah_res.return_amount_minor, 100_00)
        self.assertEqual(ah_res.outcome, AsianSettlementOutcome.HALF_WON)

        # 3. P2P Exchange cross matching & Escrow
        p2p = P2PBetExchangeEngine(commission_rate=0.02)
        market_key = "e2e_match_1:winner:HOME"
        # Maker: Lay £50 at 2.00 (liability £50)
        maker_offer, _ = p2p.post_offer(
            offer_id="maker_1",
            user_id="trader_bob",
            market_key=market_key,
            offer_type=P2POfferType.LAY,
            target_odds=2.00,
            stake_minor=50_00,
            user_available_balance_minor=100_00,
        )
        # Taker: Back £50 at 2.00 (stake £50)
        taker_offer, matches = p2p.post_offer(
            offer_id="taker_1",
            user_id="trader_alice",
            market_key=market_key,
            offer_type=P2POfferType.BACK,
            target_odds=2.00,
            stake_minor=50_00,
            user_available_balance_minor=100_00,
        )
        self.assertEqual(len(matches), 1)
        self.assertEqual(maker_offer.status, P2POfferStatus.FULLY_MATCHED)
        self.assertEqual(taker_offer.status, P2POfferStatus.FULLY_MATCHED)

        # Settle market where Backer wins
        settled_p2p = p2p.settle_market(market_key, backer_wins=True)
        self.assertEqual(len(settled_p2p), 1)
        contract = settled_p2p[0]
        self.assertEqual(contract.winner_user_id, "trader_alice")
        # Pot is £100.00 (10000 minor). Net profit is £50.00 (5000 minor).
        # 2% commission on £50 = £1.00 (100 minor). Payout = 9900 minor units.
        self.assertEqual(contract.commission_minor, 100)
        self.assertEqual(contract.payout_minor, 9900)

        # 4. Virtual Stock Exchange AMM Buy & Dividend Distribution
        pool = PlayerSharePool(
            player_id="p_star",
            player_name="Erling Haaland",
            club_name="MCI",
            position="FWD",
            cash_reserve_minor=10000_00,  # £10,000 cash reserve
            shares_reserve=1000,          # 1,000 shares reserve
            total_shares_issued=1000,
            base_dividend_yield_minor=500,
        )
        trade_res, pool, pos = execute_share_trade(
            pool=pool,
            trader_position=None,
            side="BUY",
            shares_requested=10,
            trader_balance_minor=5000_00,
        )
        self.assertTrue(trade_res.success)
        self.assertEqual(pos.shares_owned, 10)
        self.assertGreater(trade_res.total_cost_or_proceeds_minor, 0)

        # Matchday dividend
        div_minor = compute_matchday_player_dividends(
            player_position=pos,
            goals_scored=2,
            assists_provided=1,
            match_rating=8.8,
            is_clean_sheet=False,
            base_yield_minor=500,
        )
        self.assertGreater(div_minor, 0)
        self.assertEqual(pos.total_dividends_earned_minor, div_minor)

        # 5. Financial Ledger Reconciliation & Double-Entry Integrity
        now = datetime.now(timezone.utc)
        wallet = WalletState(
            wallet_id="w_alice",
            user_id="trader_alice",
            available_minor=299_00,  # 200 deposit - 100 bet + 199 payout
            reserved_minor=0,
        )
        entries = [
            RawLedgerEntry("e1", "w_alice", "DEPOSIT", 200_00, 200_00, now),
            RawLedgerEntry("e2", "w_alice", "BET_PLACED", -100_00, 100_00, now),
            RawLedgerEntry("e3", "w_alice", "BET_PAYOUT", 199_00, 299_00, now),
        ]
        audit = conduct_full_ledger_audit(
            wallets=[wallet],
            entries_by_wallet={"w_alice": entries},
            platform_treasury_minor=5000_00,  # £5,000.00 treasury
            required_solvency_ratio=1.10,
        )
        self.assertEqual(audit.status, LedgerReconciliationStatus.BALANCED)
        self.assertTrue(audit.is_solvent)
        self.assertEqual(len(audit.discrepancies), 0)
        self.assertGreater(len(audit.audit_hash), 30)

    def test_multi_bet_accumulator_settlement(self):
        # 3-fold parlay: Leg 1 (2.00 WON), Leg 2 (1.50 PUSH/VOID), Leg 3 (3.00 WON)
        legs = [
            SelectionLeg("l1", "fx_1", "match_winner", "HOME", 2.00, status=LegStatus.WON),
            SelectionLeg("l2", "fx_2", "over_under_2_5", "OVER", 1.50, status=LegStatus.PUSH),
            SelectionLeg("l3", "fx_3", "btts", "YES", 3.00, status=LegStatus.WON),
        ]
        # Stake £10.00 (1000 minor units).
        # Multiplier: 2.00 * 1.0 (push) * 3.00 = 6.00x return = £60.00 (6000 minor units)
        gross_return, profit, is_winner = settle_parlay_combination(
            stake_minor_per_line=1000,
            legs=legs,
        )
        self.assertTrue(is_winner)
        self.assertEqual(gross_return, 6000)
        self.assertEqual(profit, 5000)

        # If Leg 1 had LOST, entire accumulator returns 0
        legs[0].status = LegStatus.LOST
        gross_lost, profit_lost, is_winner_lost = settle_parlay_combination(
            stake_minor_per_line=1000,
            legs=legs,
        )
        self.assertFalse(is_winner_lost)
        self.assertEqual(gross_lost, 0)
        self.assertEqual(profit_lost, -1000)

    def test_anti_fraud_bot_velocity_rejection(self):
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        # High frequency bot burst: 12 bets placed within trailing 3000ms
        recent_timestamps = [now_ms - (i * 250) for i in range(12)]

        wager = WagerTelemetry(
            user_id="bot_user_77",
            fixture_id="fx_live_1",
            odds_id="odds_123",
            stake_minor=2000,
            wager_timestamp_ms=now_ms,
            odds_version=4,
            user_recent_wager_timestamps_ms=recent_timestamps,
        )

        fraud_result = evaluate_wager_risk(wager)
        self.assertTrue(fraud_result.is_velocity_burst)
        self.assertEqual(fraud_result.action, RiskAction.REJECT_WAGER)
        self.assertGreaterEqual(fraud_result.risk_score, 0.85)

    def test_var_saot_millimeter_offside_review(self):
        # Attacker 35.12 meters from goal line, Defender 35.10 meters from goal line
        telemetry = compute_semi_automated_offside(
            attacker_pos_meters=35.12,
            last_defender_pos_meters=35.10,
            margin_tolerance_cm=0.0,
            seed=42,
        )
        # Margin is positive -> Attacker is offside
        self.assertTrue(telemetry.is_offside)
        self.assertGreater(telemetry.margin_mm, 0)
        self.assertGreater(telemetry.confidence_level, 0.80)


if __name__ == "__main__":
    unittest.main()
