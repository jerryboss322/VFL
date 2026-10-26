"""Unit tests for Anti-Fraud, latency arbitrage, and bot velocity detection engine."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.anti_fraud_engine import (
    FraudEvaluationResult,
    MatchEventTelemetry,
    RiskAction,
    WagerTelemetry,
    detect_latency_arbitrage,
    evaluate_wager_risk,
)


class TestAntiFraudEngine(unittest.TestCase):
    def test_latency_arbitrage_detection(self):
        # Goal at t=10,000ms. Market suspended at t=10,800ms.
        # Sneaky bet placed at t=10,200ms -> should flag as latency arbitrage!
        flagged, score = detect_latency_arbitrage(
            wager_ms=10200,
            event_ms=10000,
            market_suspended_ms=10800,
        )
        self.assertTrue(flagged)
        self.assertTrue(score >= 0.90)

    def test_clean_pre_event_wager(self):
        # Bet placed at t=9,000ms, goal happened at t=10,000ms -> Clean legitimate wager!
        flagged, score = detect_latency_arbitrage(
            wager_ms=9000,
            event_ms=10000,
            market_suspended_ms=10800,
        )
        self.assertFalse(flagged)
        self.assertEqual(score, 0.0)

    def test_bot_velocity_burst_rejected(self):
        now = 50000
        # 12 bets placed within 3 seconds
        timestamps = [now - (i * 200) for i in range(12)]

        wager = WagerTelemetry(
            user_id="u1",
            fixture_id="f1",
            odds_id="o1",
            stake_minor=1000,
            wager_timestamp_ms=now,
            odds_version=1,
            user_recent_wager_timestamps_ms=timestamps,
        )

        res = evaluate_wager_risk(wager)
        self.assertTrue(res.is_velocity_burst)
        self.assertEqual(res.action, RiskAction.REJECT_WAGER)

    def test_clean_normal_wager(self):
        wager = WagerTelemetry(
            user_id="u2",
            fixture_id="f2",
            odds_id="o2",
            stake_minor=2000,
            wager_timestamp_ms=100000,
            odds_version=1,
            user_historical_avg_stake_minor=2000,
            user_recent_wager_timestamps_ms=[90000, 95000],
        )

        res = evaluate_wager_risk(wager)
        self.assertEqual(res.action, RiskAction.ALLOW)
        self.assertEqual(res.risk_score, 0.0)


if __name__ == "__main__":
    unittest.main()
