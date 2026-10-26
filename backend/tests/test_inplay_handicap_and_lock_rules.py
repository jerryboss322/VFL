"""Unit tests for in-play dynamic handicap market shifts, < 1.07 odds locking, and BTTS lock rules."""

import unittest
from backend.app.services.odds_engine import generate_fixture_markets, LOCK_ODDS_THRESHOLD
from backend.app.services.asian_handicap import generate_asian_handicap_market


class TestInPlayHandicapAndLockRules(unittest.TestCase):
    def test_handicap_odds_shift_dynamically_with_inplay_goals(self):
        # 1. Pre-match at 0-0
        pre_markets = generate_fixture_markets(
            fixture_id="fix-test-1",
            home_name="Arsenal",
            away_name="Chelsea",
            home_attack=1.2,
            home_defense=1.1,
            away_attack=1.1,
            away_defense=1.1,
            is_live=False,
            current_home_goals=0,
            current_away_goals=0,
            elapsed_seconds=0,
        )
        pre_hcap = next(m for m in pre_markets if m["key"] == "handicap_3way")
        home_minus_1_pre = next(o for o in pre_hcap["options"] if o["outcome"] == "hcap_-1_home")

        # 2. In-play at 2-0 (Arsenal up by 2 goals)
        live_markets = generate_fixture_markets(
            fixture_id="fix-test-1",
            home_name="Arsenal",
            away_name="Chelsea",
            home_attack=1.2,
            home_defense=1.1,
            away_attack=1.1,
            away_defense=1.1,
            is_live=True,
            current_home_goals=2,
            current_away_goals=0,
            elapsed_seconds=300,
        )
        live_hcap = next(m for m in live_markets if m["key"] == "handicap_3way")
        home_minus_1_live = next(o for o in live_hcap["options"] if o["outcome"] == "hcap_-1_home")
        away_plus_1_live = next(o for o in live_hcap["options"] if o["outcome"] == "hcap_1_away")

        # When Arsenal leads 2-0, Arsenal -1 probability is significantly higher so decimal odds REDUCE
        self.assertLess(home_minus_1_live["decimal"], home_minus_1_pre["decimal"])

        # And away +1 when trailing 0-2 has diminished probability, so decimal odds INCREASE or lock
        self.assertGreater(away_plus_1_live["decimal"], 1.50)

    def test_odds_lower_than_1_07_are_strictly_locked(self):
        # Heavy lead late in match produces near 100% outcomes that drop below 1.07
        markets = generate_fixture_markets(
            fixture_id="fix-heavy-lead",
            home_name="Bayern",
            away_name="Bochum",
            home_attack=1.5,
            home_defense=1.3,
            away_attack=0.8,
            away_defense=0.8,
            is_live=True,
            current_home_goals=4,
            current_away_goals=0,
            elapsed_seconds=420,
        )
        for m in markets:
            for opt in m.get("options", []):
                if opt["decimal"] < LOCK_ODDS_THRESHOLD:
                    self.assertTrue(
                        opt["suspended"],
                        f"Option {opt['odds_id']} has odds {opt['decimal']} < {LOCK_ODDS_THRESHOLD} but is not suspended",
                    )
                    self.assertTrue(opt["locked"])

    def test_btts_is_locked_once_occurred(self):
        # At 1-1 in-play, BTTS has already occurred
        markets = generate_fixture_markets(
            fixture_id="fix-btts-done",
            home_name="Liverpool",
            away_name="Man City",
            is_live=True,
            current_home_goals=1,
            current_away_goals=1,
            elapsed_seconds=200,
        )
        btts_market = next(m for m in markets if m["key"] == "both_teams_to_score")
        self.assertTrue(btts_market["suspended"], "BTTS market must be suspended once both teams score")
        self.assertTrue(btts_market["locked"], "BTTS market must be locked once both teams score")

        for opt in btts_market["options"]:
            self.assertTrue(
                opt["suspended"],
                f"BTTS option {opt['outcome']} must be suspended after BTTS has occurred",
            )
            self.assertTrue(opt["locked"])

    def test_btts_remains_active_when_not_yet_occurred(self):
        # At 1-0 in-play, BTTS is still alive
        markets = generate_fixture_markets(
            fixture_id="fix-btts-pending",
            home_name="Liverpool",
            away_name="Man City",
            is_live=True,
            current_home_goals=1,
            current_away_goals=0,
            elapsed_seconds=120,
        )
        btts_market = next(m for m in markets if m["key"] == "both_teams_to_score")
        self.assertFalse(btts_market.get("suspended", False))
        yes_opt = next(o for o in btts_market["options"] if o["outcome"] == "btts_yes")
        no_opt = next(o for o in btts_market["options"] if o["outcome"] == "btts_no")
        self.assertFalse(yes_opt["suspended"])
        self.assertFalse(no_opt["suspended"])

    def test_asian_handicap_dynamic_inplay_and_lock(self):
        pre_ah = generate_asian_handicap_market("Real Madrid", "Getafe", 1.4, 1.3, 0.9, 0.9, 0, 0, False)
        live_ah = generate_asian_handicap_market("Real Madrid", "Getafe", 1.4, 1.3, 0.9, 0.9, 3, 0, True)

        # Primary line shifts when home team has a 3-goal lead
        self.assertLess(live_ah["primary_line"], pre_ah["primary_line"])

        # Any option with odds < 1.07 is flagged locked and suspended
        for opt in live_ah["options"]:
            if opt["odds"] < 1.07:
                self.assertTrue(opt["suspended"])
                self.assertTrue(opt["locked"])


if __name__ == "__main__":
    unittest.main()
