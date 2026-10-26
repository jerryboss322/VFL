import unittest
from backend.app.services.fantasy_draft_engine import (
    FantasySnakeDraftEngine,
    DraftStatus,
    AvailableDraftPlayer,
    DraftPick,
)


class TestFantasySnakeDraftEngine(unittest.TestCase):
    def setUp(self):
        self.teams = ["team_alpha", "team_beta", "team_gamma"]
        self.engine = FantasySnakeDraftEngine(league_id="league_prem_1", team_ids=self.teams, turn_time_limit_sec=45)

        # Populate a diverse player pool with various positions and VORP scores
        self.players = [
            AvailableDraftPlayer("p1", "Erling Haaland", "MCI", "FWD", vorp_score=14.5, price_major=15.0),
            AvailableDraftPlayer("p2", "Mohamed Salah", "LIV", "MID", vorp_score=13.8, price_major=13.5),
            AvailableDraftPlayer("p3", "Bukayo Saka", "ARS", "MID", vorp_score=11.2, price_major=10.5),
            AvailableDraftPlayer("p4", "Trent Alexander-Arnold", "LIV", "DEF", vorp_score=9.5, price_major=7.5),
            AvailableDraftPlayer("p5", "William Saliba", "ARS", "DEF", vorp_score=8.7, price_major=6.5),
            AvailableDraftPlayer("p6", "David Raya", "ARS", "GKP", vorp_score=7.1, price_major=5.5),
            AvailableDraftPlayer("p7", "Alisson Becker", "LIV", "GKP", vorp_score=6.9, price_major=5.5),
            AvailableDraftPlayer("p8", "Ederson", "MCI", "GKP", vorp_score=6.5, price_major=5.5),
            AvailableDraftPlayer("p9", "Ollie Watkins", "AVL", "FWD", vorp_score=10.1, price_major=9.0),
            AvailableDraftPlayer("p10", "Cole Palmer", "CHE", "MID", vorp_score=12.4, price_major=11.0),
        ]
        self.engine.populate_player_pool(self.players)

    def test_initialization_and_snake_schedule(self):
        # 3 teams * 15 rounds = 45 picks
        self.assertEqual(len(self.engine.picks_timeline), 45)
        self.assertEqual(self.engine.status, DraftStatus.SCHEDULED)

        # Round 1: alpha -> beta -> gamma
        self.assertEqual(self.engine.picks_timeline[0].team_id, "team_alpha")
        self.assertEqual(self.engine.picks_timeline[1].team_id, "team_beta")
        self.assertEqual(self.engine.picks_timeline[2].team_id, "team_gamma")

        # Round 2: gamma -> beta -> alpha
        self.assertEqual(self.engine.picks_timeline[3].team_id, "team_gamma")
        self.assertEqual(self.engine.picks_timeline[4].team_id, "team_beta")
        self.assertEqual(self.engine.picks_timeline[5].team_id, "team_alpha")

        # Round 3: alpha -> beta -> gamma
        self.assertEqual(self.engine.picks_timeline[6].team_id, "team_alpha")

    def test_min_teams_validation(self):
        with self.assertRaises(ValueError):
            FantasySnakeDraftEngine(league_id="bad_lg", team_ids=["team_lone"])

    def test_start_draft_and_make_valid_pick(self):
        self.engine.start_draft()
        self.assertEqual(self.engine.status, DraftStatus.IN_PROGRESS)
        self.assertIsNotNone(self.engine.current_turn_deadline_unix)

        current = self.engine.get_current_pick()
        self.assertIsNotNone(current)
        self.assertEqual(current.team_id, "team_alpha")
        self.assertEqual(current.overall_pick, 1)

        # Alpha picks Haaland (FWD)
        pick_res = self.engine.make_pick("team_alpha", "p1")
        self.assertEqual(pick_res.player_id, "p1")
        self.assertIsNotNone(pick_res.picked_at_unix)
        self.assertNotIn("p1", self.engine.available_pool)

        alpha_roster = self.engine.rosters["team_alpha"]
        self.assertEqual(len(alpha_roster.picked_players), 1)
        self.assertEqual(alpha_roster.fwd_count, 1)

        # Next on clock should be team_beta
        next_pick = self.engine.get_current_pick()
        self.assertIsNotNone(next_pick)
        self.assertEqual(next_pick.team_id, "team_beta")

    def test_turn_enforcement_and_invalid_picks(self):
        self.engine.start_draft()
        # beta tries to pick out of turn
        with self.assertRaises(ValueError) as ctx:
            self.engine.make_pick("team_beta", "p2")
        self.assertIn("Not team_beta's turn", str(ctx.exception))

        # Alpha tries to pick nonexistent player
        with self.assertRaises(ValueError) as ctx2:
            self.engine.make_pick("team_alpha", "p999")
        self.assertIn("not available", str(ctx2.exception))

    def test_positional_quota_enforcement(self):
        self.engine.start_draft()
        # Simulate alpha roster having 2 GKPs already
        self.engine.rosters["team_alpha"].picked_players.append(self.players[5])  # Raya
        self.engine.rosters["team_alpha"].picked_players.append(self.players[6])  # Alisson
        self.assertEqual(self.engine.rosters["team_alpha"].gkp_count, 2)
        self.assertFalse(self.engine.rosters["team_alpha"].can_pick_position("GKP"))

        # Alpha attempts to pick a 3rd GKP (Ederson p8)
        with self.assertRaises(ValueError) as ctx:
            self.engine.make_pick("team_alpha", "p8")
        self.assertIn("positional quota exceeded", str(ctx.exception))

    def test_execute_auto_pick_highest_vorp(self):
        self.engine.start_draft()
        # Highest VORP in pool is Haaland (p1, vorp 14.5)
        auto_pick = self.engine.execute_auto_pick()
        self.assertIsNotNone(auto_pick)
        self.assertEqual(auto_pick.team_id, "team_alpha")
        self.assertEqual(auto_pick.player_id, "p1")

        # Next turn is team_beta, highest remaining is Salah (p2, vorp 13.8)
        auto_pick2 = self.engine.execute_auto_pick()
        self.assertIsNotNone(auto_pick2)
        self.assertEqual(auto_pick2.team_id, "team_beta")
        self.assertEqual(auto_pick2.player_id, "p2")

    def test_auto_pick_respects_quota(self):
        self.engine.start_draft()
        # Pretend team_alpha has 3 FWDs already
        self.engine.rosters["team_alpha"].picked_players = [
            AvailableDraftPlayer("f1", "FWD 1", "MCI", "FWD", 1.0, 5.0),
            AvailableDraftPlayer("f2", "FWD 2", "LIV", "FWD", 1.0, 5.0),
            AvailableDraftPlayer("f3", "FWD 3", "ARS", "FWD", 1.0, 5.0),
        ]
        self.assertFalse(self.engine.rosters["team_alpha"].can_pick_position("FWD"))

        # Highest VORP in available_pool is Haaland (FWD, 14.5), but alpha cannot take FWD.
        # Next highest is Salah (MID, 13.8)
        auto_pick = self.engine.execute_auto_pick()
        self.assertIsNotNone(auto_pick)
        self.assertEqual(auto_pick.player_id, "p2")  # Salah MID picked!


if __name__ == "__main__":
    unittest.main()
