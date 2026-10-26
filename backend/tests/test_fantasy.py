"""Unit tests for Virtual Fantasy Football scoring, squad validation, and roster calculation."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.fantasy_engine import (
    PlayerMatchStats,
    calculate_player_fantasy_points,
    validate_squad_composition,
    calculate_gameweek_roster_points,
)


class TestFantasyEngine(unittest.TestCase):
    def test_forward_scoring(self):
        # Forward plays 90 mins, scores 2 goals, receives yellow card
        stats = PlayerMatchStats(
            player_id="p1",
            name="Erling Haaland",
            position="FWD",
            club_id="mci",
            minutes_played=90,
            goals=2,
            assists=1,
            yellow_cards=1,
            bonus_points=3,
        )
        # Expected:
        # 60+ mins: +2
        # 2 goals (FWD): 2 * 4 = +8
        # 1 assist: +3
        # 1 yellow: -1
        # Bonus: +3
        # Total = 2 + 8 + 3 - 1 + 3 = 15
        res = calculate_player_fantasy_points(stats)
        self.assertEqual(res["total_points"], 15)

    def test_defender_clean_sheet_and_goal(self):
        # Defender plays 90 mins, scores 1 goal, keeps clean sheet
        stats = PlayerMatchStats(
            player_id="p2",
            name="Trent Alexander-Arnold",
            position="DEF",
            club_id="liv",
            minutes_played=90,
            goals=1,
            clean_sheet=True,
            goals_conceded=0,
            bonus_points=2,
        )
        # Expected:
        # 60+ mins: +2
        # 1 goal (DEF): +6
        # Clean sheet (DEF): +4
        # Bonus: +2
        # Total = 2 + 6 + 4 + 2 = 14
        res = calculate_player_fantasy_points(stats)
        self.assertEqual(res["total_points"], 14)

    def test_goalkeeper_saves_and_penalty_save(self):
        # Goalkeeper plays 90 mins, makes 6 saves, saves a penalty, concedes 2 goals
        stats = PlayerMatchStats(
            player_id="p3",
            name="Alisson Becker",
            position="GK",
            club_id="liv",
            minutes_played=90,
            saves=6,
            penalties_saved=1,
            goals_conceded=2,
        )
        # Expected:
        # 60+ mins: +2
        # Saves (6 // 3): +2
        # Penalty saved: +5
        # 2 goals conceded (-2 // 2): -1
        # Total = 2 + 2 + 5 - 1 = 8
        res = calculate_player_fantasy_points(stats)
        self.assertEqual(res["total_points"], 8)

    def test_squad_validation_success(self):
        squad = []
        # 2 GKs
        for i in range(2):
            squad.append({"playerId": f"gk{i}", "position": "GK", "clubId": f"c{i}", "priceMinor": 5_000_000})
        # 5 DEFs
        for i in range(5):
            squad.append({"playerId": f"def{i}", "position": "DEF", "clubId": f"c{i+2}", "priceMinor": 5_000_000})
        # 5 MIDs
        for i in range(5):
            squad.append({"playerId": f"mid{i}", "position": "MID", "clubId": f"c{i+7}", "priceMinor": 6_000_000})
        # 3 FWDs
        for i in range(3):
            squad.append({"playerId": f"fwd{i}", "position": "FWD", "clubId": f"c{i+12}", "priceMinor": 8_000_000})

        # Total cost: 2*5M + 5*5M + 5*6M + 3*8M = 10M + 25M + 30M + 24M = 89M <= 100M
        valid, err = validate_squad_composition(squad, 100_000_000)
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_squad_validation_club_limit_exceeded(self):
        squad = []
        # 4 players from Arsenal (club 'ars') -> should fail
        for i in range(4):
            squad.append({"playerId": f"p{i}", "position": "DEF" if i < 3 else "GK", "clubId": "ars", "priceMinor": 5_000_000})
        valid, err = validate_squad_composition(squad, 100_000_000)
        self.assertFalse(valid)
        self.assertIn("Squad must have exactly 15 players", err)

    def test_captain_doubling_and_vice_captain_fallback(self):
        starting_xi = [
            {"playerId": "p1", "name": "Haaland", "position": "FWD"},
            {"playerId": "p2", "name": "Salah", "position": "MID"},
        ]
        bench = []

        # Scenario 1: Captain played and earned 10 pts
        scores = {
            "p1": {"total_points": 10, "minutes_played": 90},
            "p2": {"total_points": 8, "minutes_played": 90},
        }
        res = calculate_gameweek_roster_points(starting_xi, bench, captain_id="p1", vice_captain_id="p2", player_scores_map=scores)
        # Haaland 10 * 2 = 20, Salah 8 * 1 = 8 -> Total 28
        self.assertEqual(res["net_gameweek_points"], 28)
        self.assertEqual(res["effective_captain_id"], "p1")

        # Scenario 2: Captain rested (0 mins) -> Vice-Captain (Salah) gets 2x
        scores_rested = {
            "p1": {"total_points": 0, "minutes_played": 0},
            "p2": {"total_points": 8, "minutes_played": 90},
        }
        res2 = calculate_gameweek_roster_points(starting_xi, bench, captain_id="p1", vice_captain_id="p2", player_scores_map=scores_rested)
        # Salah 8 * 2 = 16
        self.assertEqual(res2["net_gameweek_points"], 16)
        self.assertEqual(res2["effective_captain_id"], "p2")


if __name__ == "__main__":
    unittest.main()
