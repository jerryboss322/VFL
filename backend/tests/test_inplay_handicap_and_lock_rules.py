"""Unit tests for in-play dynamic handicap market shifts, < 1.07 odds locking, condition-met locking, and BTTS lock rules."""

import unittest
from backend.app.services.odds_engine import (
    generate_fixture_markets,
    evaluate_selection_outcome,
    evaluate_early_condition_settlement,
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

    def test_over_0_5_locked_once_1_goal_scored_fulltime_and_halves(self):
        # 1-0 at 360 seconds (1 goal total, 120s remaining)
        markets = generate_fixture_markets(
            fixture_id="fix-1-goal",
            home_name="Arsenal",
            away_name="Chelsea",
            is_live=True,
            current_home_goals=1,
            current_away_goals=0,
            elapsed_seconds=360,
        )
        ou_market = next(m for m in markets if m["key"] == "over_under_goals")
        over_0_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_0_5")
        under_0_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_0_5")
        over_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_1_5")
        under_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_1_5")

        self.assertTrue(over_0_5["locked"], "Over 0.5 must be locked once 1 goal scored")
        self.assertTrue(under_0_5["locked"], "Under 0.5 must be locked once 1 goal scored")
        self.assertFalse(over_1_5["locked"], "Over 1.5 must remain unlocked at 1-0 with 120s remaining")
        self.assertFalse(under_1_5["locked"], "Under 1.5 must remain unlocked at 1-0 with 120s remaining")

        # 1st-half Over/Under at 1 goal in 1H (at 180s, 60s remaining in 1H)
        h1_markets = generate_fixture_markets(
            fixture_id="fix-1h-goal",
            home_name="Arsenal",
            away_name="Chelsea",
            is_live=True,
            current_home_goals=1,
            current_away_goals=0,
            elapsed_seconds=180,
        )
        h1_market = next(m for m in h1_markets if m["key"] == "first_half_goals_ou")
        h1_over_0_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_over_0_5")
        h1_under_0_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_under_0_5")
        h1_over_1_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_over_1_5")

        self.assertTrue(h1_over_0_5["locked"], "1st-half Over 0.5 must be locked once 1 goal scored in 1H")
        self.assertTrue(h1_under_0_5["locked"], "1st-half Under 0.5 must be locked once 1 goal scored in 1H")
        self.assertFalse(h1_over_1_5["locked"], "1st-half Over 1.5 must remain unlocked with 1 goal in 1H at 180s")

    def test_over_1_5_locked_once_2_goals_scored_fulltime_and_halves(self):
        # 2-0 at 360 seconds (2 goals total, 120s remaining)
        markets = generate_fixture_markets(
            fixture_id="fix-2-goals",
            home_name="Real Madrid",
            away_name="Barcelona",
            is_live=True,
            current_home_goals=2,
            current_away_goals=0,
            elapsed_seconds=360,
        )
        ou_market = next(m for m in markets if m["key"] == "over_under_goals")
        over_0_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_0_5")
        over_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_1_5")
        under_1_5 = next(o for o in ou_market["options"] if o["outcome"] == "under_1_5")
        over_2_5 = next(o for o in ou_market["options"] if o["outcome"] == "over_2_5")

        self.assertTrue(over_0_5["locked"], "Over 0.5 must be locked at 2 goals")
        self.assertTrue(over_1_5["locked"], "Over 1.5 must be locked once 2 goals scored")
        self.assertTrue(under_1_5["locked"], "Under 1.5 must be locked once 2 goals scored")
        self.assertFalse(over_2_5["locked"], "Over 2.5 must remain unlocked at 2 goals with 120s remaining")

        # 1st-half Over 1.5 (at 180s with 2 goals in 1H)
        h1_markets = generate_fixture_markets(
            fixture_id="fix-2h1-goals",
            home_name="Real Madrid",
            away_name="Barcelona",
            is_live=True,
            current_home_goals=2,
            current_away_goals=0,
            elapsed_seconds=180,
        )
        h1_market = next(m for m in h1_markets if m["key"] == "first_half_goals_ou")
        h1_over_1_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_over_1_5")
        h1_under_1_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_under_1_5")
        h1_over_2_5 = next(o for o in h1_market["options"] if o["outcome"] == "1h_over_2_5")

        self.assertTrue(h1_over_1_5["locked"], "1st-half Over 1.5 must be locked once 2 goals scored in 1H")
        self.assertTrue(h1_under_1_5["locked"], "1st-half Under 1.5 must be locked once 2 goals scored in 1H")
        self.assertFalse(h1_over_2_5["locked"], "1st-half Over 2.5 must remain unlocked with 2 goals in 1H at 180s")

    def test_second_half_over_under_locking(self):
        # Match at 300 seconds (2nd half). HT was 1-0. Score is now 2-1 (Total 3 goals, 2nd half goals: 2-0 = 1 home + 1 away = 2 goals in 2H).
        markets = generate_fixture_markets(
            fixture_id="fix-2h-check",
            home_name="Liverpool",
            away_name="Man City",
            is_live=True,
            current_home_goals=2,
            current_away_goals=1,
            elapsed_seconds=300,
            ht_home_goals=1,
            ht_away_goals=0,
        )

        # In 2H: 1 home goal in 2H, 1 away goal in 2H -> total 2 goals scored in 2nd half
        h2_market = next(m for m in markets if m["key"] == "second_half_goals_ou")
        h2_over_0_5 = next(o for o in h2_market["options"] if o["outcome"] == "2h_over_0_5")
        h2_under_0_5 = next(o for o in h2_market["options"] if o["outcome"] == "2h_under_0_5")
        h2_over_1_5 = next(o for o in h2_market["options"] if o["outcome"] == "2h_over_1_5")
        h2_under_1_5 = next(o for o in h2_market["options"] if o["outcome"] == "2h_under_1_5")
        h2_over_2_5 = next(o for o in h2_market["options"] if o["outcome"] == "2h_over_2_5")

        self.assertTrue(h2_over_0_5["locked"], "2nd-half Over 0.5 must be locked once 2 goals in 2H")
        self.assertTrue(h2_under_0_5["locked"], "2nd-half Under 0.5 must be locked once 2 goals in 2H")
        self.assertTrue(h2_over_1_5["locked"], "2nd-half Over 1.5 must be locked once 2 goals in 2H")
        self.assertTrue(h2_under_1_5["locked"], "2nd-half Under 1.5 must be locked once 2 goals in 2H")
        self.assertFalse(h2_over_2_5["locked"], "2nd-half Over 2.5 must remain unlocked when 2 goals in 2H")

        # 1st-half market must be completely closed since clock >= 240
        h1_market = next(m for m in markets if m["key"] == "first_half_goals_ou")
        self.assertTrue(h1_market["locked"], "1st-half market must be locked after half time")
        for o in h1_market["options"]:
            self.assertTrue(o["locked"], "All 1st-half options must be locked after half time")

    def test_halves_early_condition_settlement(self):
        # 1. 1st-half Over 0.5 won early in minute 1
        done, won = evaluate_early_condition_settlement(
            market_key="first_half_goals_ou",
            outcome="1h_over_0_5",
            home_goals=1,
            away_goals=0,
            clock_seconds=50,
        )
        self.assertTrue(done)
        self.assertTrue(won)

        # 2. 1st-half Under 0.5 lost early in minute 1
        done, won = evaluate_early_condition_settlement(
            market_key="first_half_goals_ou",
            outcome="1h_under_0_5",
            home_goals=1,
            away_goals=0,
            clock_seconds=50,
        )
        self.assertTrue(done)
        self.assertFalse(won)

        # 3. 2nd-half Over 0.5 won early after 2nd-half goal
        events = [
            {"event_type": "goal", "minute": 100, "payload": {"side": "home"}},  # 1H goal
            {"event_type": "goal", "minute": 280, "payload": {"side": "away"}},  # 2H goal
        ]
        done, won = evaluate_early_condition_settlement(
            market_key="second_half_goals_ou",
            outcome="2h_over_0_5",
            home_goals=1,
            away_goals=1,
            clock_seconds=300,
            events=events,
        )
        self.assertTrue(done)
        self.assertTrue(won)


if __name__ == "__main__":
    unittest.main()
