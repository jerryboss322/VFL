"""Unit tests for Virtual European Champions Cup knockout engine."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.cup_bracket_engine import (
    ClubParticipant,
    TieResolutionType,
    TournamentRound,
    conduct_r16_draw,
    resolve_two_legged_tie,
    simulate_penalty_shootout,
    calculate_outright_winner_odds,
)


class TestCupBracketEngine(unittest.TestCase):
    def setUp(self):
        self.real_madrid = ClubParticipant("rma", "Real Madrid", "RMA", "Spain", 1.85, 1.45, True)
        self.bayern = ClubParticipant("bay", "Bayern Munich", "BAY", "Germany", 1.80, 1.40, True)
        self.man_city = ClubParticipant("mci", "Manchester City", "MCI", "England", 1.90, 1.50, True)
        self.arsenal = ClubParticipant("ars", "Arsenal", "ARS", "England", 1.75, 1.35, False)
        self.psg = ClubParticipant("psg", "Paris Saint-Germain", "PSG", "France", 1.70, 1.30, False)
        self.inter = ClubParticipant("int", "Inter Milan", "INT", "Italy", 1.65, 1.40, False)

    def test_regular_time_aggregate_win(self):
        # Leg 1: Real Madrid (H) 2 - 0 PSG (A)
        # Leg 2: PSG (H) 1 - 1 Real Madrid (A)
        # Aggregate: RMA 3 - 1 PSG
        res = resolve_two_legged_tie(
            tie_id="tie_1",
            round_name=TournamentRound.ROUND_OF_16,
            club_a=self.real_madrid,
            club_b=self.psg,
            leg_1_home_goals=2,
            leg_1_away_goals=0,
            leg_2_home_goals=1,
            leg_2_away_goals=1,
        )
        self.assertEqual(res.winner_club_id, "rma")
        self.assertEqual(res.aggregate_a, 3)
        self.assertEqual(res.aggregate_b, 1)
        self.assertEqual(res.resolution, TieResolutionType.REGULAR_TIME)

    def test_extra_time_or_penalty_shootout_when_tied(self):
        # Leg 1: 1 - 1
        # Leg 2: 1 - 1
        # Aggregate: 2 - 2 -> Must resolve via Extra Time or Penalties
        res = resolve_two_legged_tie(
            tie_id="tie_2",
            round_name=TournamentRound.QUARTER_FINALS,
            club_a=self.bayern,
            club_b=self.inter,
            leg_1_home_goals=1,
            leg_1_away_goals=1,
            leg_2_home_goals=1,
            leg_2_away_goals=1,
            seed=42,
        )
        self.assertIn(res.resolution, [TieResolutionType.EXTRA_TIME, TieResolutionType.PENALTY_SHOOTOUT])
        self.assertIn(res.winner_club_id, ["bay", "int"])

    def test_penalty_shootout_mechanics(self):
        score_a, score_b, shots_a, shots_b = simulate_penalty_shootout(1.8, 1.8, seed=123)
        self.assertNotEqual(score_a, score_b)
        self.assertTrue(len(shots_a) >= 3)
        self.assertTrue(len(shots_b) >= 3)

    def test_r16_draw_country_protection(self):
        # 8 seeded clubs
        seeded = [
            ClubParticipant(f"s{i}", f"Seeded {i}", f"S{i}", country, 1.7, 1.3, True)
            for i, country in enumerate(["England", "Spain", "Germany", "Italy", "France", "Portugal", "Netherlands", "Belgium"])
        ]
        # 8 unseeded clubs with matching countries
        unseeded = [
            ClubParticipant(f"u{i}", f"Unseeded {i}", f"U{i}", country, 1.5, 1.2, False)
            for i, country in enumerate(["England", "Spain", "Germany", "Italy", "France", "Portugal", "Netherlands", "Belgium"])
        ]

        pairs = conduct_r16_draw(seeded, unseeded, seed=999)
        self.assertEqual(len(pairs), 8)
        # Verify no pair shares the exact same country
        for pot1, pot2 in pairs:
            self.assertNotEqual(pot1.country, pot2.country)

    def test_outright_odds_calculation(self):
        clubs = [self.man_city, self.real_madrid, self.bayern, self.arsenal]
        odds_list = calculate_outright_winner_odds(clubs)
        self.assertEqual(len(odds_list), 4)
        # Strongest team (Man City) should have the shortest odds
        self.assertEqual(odds_list[0]["club_id"], "mci")
        self.assertTrue(odds_list[0]["decimal_odds"] < odds_list[-1]["decimal_odds"])


if __name__ == "__main__":
    unittest.main()
