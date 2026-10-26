"""Unit tests for VIP loyalty tier progression, streak bonuses, and daily quests."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.loyalty_engine import (
    determine_tier_from_xp,
    calculate_daily_streak_rewards,
    get_default_daily_quests,
)


class TestLoyaltyEngine(unittest.TestCase):
    def test_bronze_tier(self):
        res = determine_tier_from_xp(250)
        self.assertEqual(res["tier"], "BRONZE")
        self.assertEqual(res["cashback_rate"], 0.01)
        self.assertEqual(res["next_tier_xp"], 1000)
        self.assertEqual(res["progress_percentage"], 25.0)

    def test_gold_tier_upgrade(self):
        res = determine_tier_from_xp(12500)
        self.assertEqual(res["tier"], "GOLD")
        self.assertEqual(res["cashback_rate"], 0.035)
        self.assertEqual(res["next_tier_xp"], 20000)
        # Range is 5,000 to 20,000 (15,000 span). 12,500 - 5,000 = 7,500 -> 50%
        self.assertEqual(res["progress_percentage"], 50.0)

    def test_master_tier(self):
        res = determine_tier_from_xp(150000)
        self.assertEqual(res["tier"], "MASTER")
        self.assertEqual(res["cashback_rate"], 0.10)

    def test_streak_rewards_cycle(self):
        day1 = calculate_daily_streak_rewards(1)
        self.assertEqual(day1["xp_reward"], 50)
        self.assertEqual(day1["freeze_tokens"], 0)

        day7 = calculate_daily_streak_rewards(7)
        self.assertEqual(day7["xp_reward"], 500)
        self.assertEqual(day7["bonus_minor"], 1500)
        self.assertEqual(day7["freeze_tokens"], 1)

        # Day 8 wraps to day 1 in cycle
        day8 = calculate_daily_streak_rewards(8)
        self.assertEqual(day8["day_in_cycle"], 1)

    def test_daily_quests_structure(self):
        quests = get_default_daily_quests()
        self.assertTrue(len(quests) >= 4)
        for q in quests:
            self.assertIn("quest_key", q)
            self.assertIn("xp_reward", q)
            self.assertTrue(q["xp_reward"] > 0)


if __name__ == "__main__":
    unittest.main()
