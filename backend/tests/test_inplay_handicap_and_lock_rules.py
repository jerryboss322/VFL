"""Unit tests for in-play dynamic handicap market shifts, < 1.07 odds locking, condition-met locking, and BTTS lock rules."""

import unittest
from backend.app.services.odds_engine import (
    generate_fixture_markets,
    evaluate_selection_outcome,
    LOCK_ODDS_THRESHOLD,
)
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

        # When Arsenal leads 2-0, Arsenal -1 probability is significantly higher so decimal odds REDUCE
        self.assertLess(home_minus_1_live["decimal"], home_minus_1_pre["decimal"])

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

    def test_condition_met_locks_over_under_and_scores(self):
        # Match score is 2-1 (Total 3 goals)
        markets = generate_fixture_markets(
            fixture_id="fix-cond-met",
            home_name="Inter",
            away_name="Milan",
            is_live=True,
            current_home_goals=2,
            current_away_goals=1,
            elapsed_seconds=320,
        )

        # 1. Over/Under 0.5, 1.5, 2.5 conditions have already been met or decided!
        ou_market = next(m for m in markets if m["key"] == "over_under_goals")
        over_0_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_0_5")
        under_0_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_0_5")
        over_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_1_5")
        under_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_1_5")
        over_2_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_2_5")
        under_2_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_2_5")

        self.assertTrue(over_0_5["locked"], "Over 0.5 must be locked once 3 goals scored")
        self.assertTrue(under_0_5["locked"], "Under 0.5 must be locked once 3 goals scored")
        self.assertTrue(over_1_5["locked"], "Over 1.5 must be locked once 3 goals scored")
        self.assertTrue(under_1_5["locked"], "Under 1.5 must be locked once 3 goals scored")
        self.assertTrue(over_2_5["locked"], "Over 2.5 must be locked once 3 goals scored")
        self.assertTrue(under_2_5["locked"], "Under 2.5 must be locked once 3 goals scored")

        # 2. Correct score 0-0 or 1-0 is impossible now and must be locked!
        cs_market = next(m for m in markets if m["key"] == "correct_score")
        cs_0_0 = next(o for o in cs_market["options"] if o["label"] == "0 - 0")
        cs_1_0 = next(o for o in cs_market["options"] if o["label"] == "1 - 0")
        self.assertTrue(cs_0_0["locked"], "0-0 must be locked once score is 2-1")
        self.assertTrue(cs_1_0["locked"], "1-0 must be locked once score is 2-1")

    def test_first_class_asian_handicap_market_and_settlement(self):
        markets = generate_fixture_markets(
            fixture_id="fix-ah-check",
            home_name="Juventus",
            away_name="Roma",
            is_live=True,
            current_home_goals=1,
            current_away_goals=0,
            elapsed_seconds=150,
        )
        ah_market = next((m for m in markets if m["key"] == "asian_handicap"), None)
        self.assertIsNotNone(ah_market, "asian_handicap market must exist in generate_fixture_markets")
        self.assertGreater(len(ah_market["options"]), 0)

        # Test settlement of Asian Handicap
        # Bet on Home (-0.5), final score 2-1 (Home won by 1) -> Bet won!
        won = evaluate_selection_outcome(
            market_key="asian_handicap",
            outcome="ah_-0.50_home",
            label="Juventus (-0.50)",
            odds_id="fix:ah:-0.50:home",
            home_goals=2,
            away_goals=1,
        )
        self.assertTrue(won)

        # Bet on Away (+0.5), final score 2-1 (Away lost by 1) -> Bet lost!
        lost = evaluate_selection_outcome(
            market_key="asian_handicap",
            outcome="ah_+0.50_away",
            label="Roma (+0.50)",
            odds_id="fix:ah:+0.50:away",
            home_goals=2,
            away_goals=1,
        )
        self.assertFalse(lost)

    def test_early_condition_settlement_over_under_and_btts(self):
        from backend.app.services.odds_engine import evaluate_early_condition_settlement

        # Scenario: Score is 2-0 (Total 2 goals)
        # 1. Over 1.5 Goals -> condition met early, WON!
        done, won = evaluate_early_condition_settlement(
            market_key="over_under_goals",
            outcome="over_1_5",
            label="Over 1.5 Goals",
            odds_id="fix:ou_goals:over_1_5",
            home_goals=2,
            away_goals=0,
        )
        self.assertTrue(done, "Over 1.5 must be concluded early when 2 goals scored")
        self.assertTrue(won, "Over 1.5 must be won early when 2 goals scored")

        # 2. Under 1.5 Goals -> 2 goals scored, impossible now, LOST!
        done, won = evaluate_early_condition_settlement(
            market_key="over_under_goals",
            outcome="under_1_5",
            label="Under 1.5 Goals",
            odds_id="fix:ou_goals:under_1_5",
            home_goals=2,
            away_goals=0,
        )
        self.assertTrue(done, "Under 1.5 must be concluded early when 2 goals scored")
        self.assertFalse(won, "Under 1.5 must be lost early when 2 goals scored")

        # 3. Over 2.5 Goals -> Only 2 goals scored, still pending!
        done, won = evaluate_early_condition_settlement(
            market_key="over_under_goals",
            outcome="over_2_5",
            label="Over 2.5 Goals",
            odds_id="fix:ou_goals:over_2_5",
            home_goals=2,
            away_goals=0,
        )
        self.assertFalse(done, "Over 2.5 must remain pending when only 2 goals scored")

        # 4. Scenario: Score becomes 2-1 (Both teams scored, Total 3 goals)
        # BTTS Yes -> condition met early, WON!
        done, won = evaluate_early_condition_settlement(
            market_key="both_teams_to_score",
            outcome="btts_yes",
            label="Yes (BTTS)",
            odds_id="fix:btts:yes",
            home_goals=2,
            away_goals=1,
        )
        self.assertTrue(done, "BTTS Yes must be concluded early once 1-1 or 2-1")
        self.assertTrue(won, "BTTS Yes must be won early once both teams scored")

        # BTTS No -> both teams scored, impossible, LOST!
        done, won = evaluate_early_condition_settlement(
            market_key="both_teams_to_score",
            outcome="btts_no",
            label="No (Clean Sheet)",
            odds_id="fix:btts:no",
            home_goals=2,
            away_goals=1,
        )
        self.assertTrue(done, "BTTS No must be concluded early once both teams scored")
        self.assertFalse(won, "BTTS No must be lost early once both teams scored")


if __name__ == "__main__":
    unittest.main()
