"""Unit tests for Responsible Gaming, limit enforcement, and self-exclusion gates."""

from datetime import datetime, timedelta, timezone
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.responsible_gaming import (
    ExclusionType,
    PlayerLimitRecord,
    request_limit_modification,
    verify_deposit_against_limits,
    verify_wager_against_limits,
)


class TestResponsibleGaming(unittest.TestCase):
    def test_wager_blocked_under_daily_loss_limit(self):
        # Daily loss limit: 5,000 minor ($50). Past losses: 4,000 minor.
        # Placing 2,000 stake -> exceeds 5,000 -> Blocked!
        limits = PlayerLimitRecord(daily_loss_limit_minor=5000)
        allowed, err = verify_wager_against_limits(2000, limits, rolling_24h_losses_minor=4000)
        self.assertFalse(allowed)
        self.assertIn("exceeds your daily loss limit", err)

        # Placing 800 stake -> 4,000 + 800 <= 5,000 -> Allowed!
        allowed2, err2 = verify_wager_against_limits(800, limits, rolling_24h_losses_minor=4000)
        self.assertTrue(allowed2)
        self.assertIsNone(err2)

    def test_deposit_blocked_by_daily_cap(self):
        limits = PlayerLimitRecord(daily_deposit_limit_minor=10000)
        allowed, err = verify_deposit_against_limits(6000, limits, rolling_24h_deposits_minor=5000)
        self.assertFalse(allowed)
        self.assertIn("exceeds 24-hour deposit limit", err)

    def test_cool_off_blocks_activity(self):
        now = datetime.now(timezone.utc)
        limits = PlayerLimitRecord(
            exclusion_status=ExclusionType.COOL_OFF_24H,
            exclusion_expires_at=now + timedelta(hours=12),
        )
        allowed, err = verify_wager_against_limits(100, limits, current_time=now)
        self.assertFalse(allowed)
        self.assertIn("temporarily cool-off", err)

    def test_cooling_off_delay_on_limit_increases(self):
        # Decreasing limit from 10,000 to 5,000 takes effect immediately
        res_dec = request_limit_modification(10000, 5000)
        self.assertTrue(res_dec["immediate"])
        self.assertEqual(res_dec["cooling_off_hours"], 0)

        # Increasing limit from 5,000 to 15,000 requires 24h delay
        res_inc = request_limit_modification(5000, 15000)
        self.assertFalse(res_inc["immediate"])
        self.assertEqual(res_inc["cooling_off_hours"], 24)


if __name__ == "__main__":
    unittest.main()
