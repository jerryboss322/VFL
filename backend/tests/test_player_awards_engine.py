import unittest
from backend.app.services.player_awards_engine import (
    PlayerAwardsEngine,
    PlayerSeasonRecord,
    PlayerEfficiencyMetrics,
)


class TestPlayerAwardsEngine(unittest.TestCase):
    def setUp(self):
        self.players = [
            PlayerSeasonRecord(
                "p1", "Erling Haaland", "MCI", "FWD",
                appearances=28, minutes_played=2400,
                goals=27, penalty_goals=4, xg=24.5,
                assists=5, xa=4.2, clean_sheets=0, goals_conceded=0, saves=0,
                yellow_cards=2, red_cards=0,
            ),
            PlayerSeasonRecord(
                "p2", "Mohamed Salah", "LIV", "MID",
                appearances=28, minutes_played=2450,
                goals=22, penalty_goals=3, xg=19.8,
                assists=14, xa=12.5, clean_sheets=0, goals_conceded=0, saves=0,
                yellow_cards=1, red_cards=0,
            ),
            PlayerSeasonRecord(
                "p3", "Cole Palmer", "CHE", "MID",
                appearances=26, minutes_played=2200,
                goals=22, penalty_goals=7, xg=18.0,
                assists=11, xa=9.5, clean_sheets=0, goals_conceded=0, saves=0,
                yellow_cards=3, red_cards=0,
            ),
            PlayerSeasonRecord(
                "p4", "Alexander Isak", "NEW", "FWD",
                appearances=24, minutes_played=1950,
                goals=22, penalty_goals=2, xg=20.5,
                assists=5, xa=3.8, clean_sheets=0, goals_conceded=0, saves=0,
                yellow_cards=2, red_cards=0,
            ),
            PlayerSeasonRecord(
                "p5", "David Raya", "ARS", "GKP",
                appearances=28, minutes_played=2520,
                goals=0, penalty_goals=0, xg=0.0,
                assists=0, xa=0.0, clean_sheets=14, goals_conceded=22, saves=78,
                yellow_cards=1, red_cards=0,
            ),
            PlayerSeasonRecord(
                "p6", "Alisson Becker", "LIV", "GKP",
                appearances=26, minutes_played=2340,
                goals=0, penalty_goals=0, xg=0.0,
                assists=1, xa=0.2, clean_sheets=12, goals_conceded=20, saves=70,
                yellow_cards=0, red_cards=0,
            ),
        ]

    def test_golden_boot_ranking_and_tie_breaking(self):
        ranked = PlayerAwardsEngine.rank_golden_boot(self.players)

        # 1st place: Haaland (27 goals)
        self.assertEqual(ranked[0].player_id, "p1")
        self.assertEqual(ranked[0].goals, 27)

        # 2nd, 3rd, 4th all tied on 22 goals:
        # Salah: 22 goals, 14 assists -> wins 2nd place
        # Palmer: 22 goals, 11 assists -> wins 3rd place
        # Isak: 22 goals, 5 assists -> 4th place
        self.assertEqual(ranked[1].player_id, "p2")
        self.assertEqual(ranked[2].player_id, "p3")
        self.assertEqual(ranked[3].player_id, "p4")

    def test_playmaker_ranking(self):
        ranked = PlayerAwardsEngine.rank_playmaker(self.players)
        # Top assist provider: Salah (14 assists)
        self.assertEqual(ranked[0].player_id, "p2")
        self.assertEqual(ranked[0].assists, 14)
        # 2nd place: Palmer (11 assists)
        self.assertEqual(ranked[1].player_id, "p3")
        self.assertEqual(ranked[1].assists, 11)

    def test_golden_glove_ranking(self):
        ranked = PlayerAwardsEngine.rank_golden_glove(self.players)
        self.assertEqual(len(ranked), 2)  # Only Raya & Alisson
        # Raya has 14 clean sheets > Alisson 12
        self.assertEqual(ranked[0].player_id, "p5")
        self.assertEqual(ranked[0].clean_sheets, 14)
        self.assertEqual(ranked[1].player_id, "p6")
        self.assertEqual(ranked[1].clean_sheets, 12)

    def test_efficiency_metrics_calculation(self):
        haaland = self.players[0]
        metrics = PlayerAwardsEngine.calculate_efficiency(haaland)

        # 2400 mins / 90 = 26.67 matches. 27 goals / 26.67 = ~1.01 goals/90
        self.assertGreater(metrics.goals_per_90, 0.95)
        # xG overperformance: 27 goals - 24.5 xG = +2.5
        self.assertEqual(metrics.xg_overperformance, 2.5)
        # 2 yellow cards = 2 demerit points
        self.assertEqual(metrics.fair_play_demerit_points, 2)

        # Goalkeeper save percentage
        raya = self.players[4]
        gk_metrics = PlayerAwardsEngine.calculate_efficiency(raya)
        # 78 saves / (78 + 22) = 78.0% save percentage
        self.assertEqual(gk_metrics.save_percentage, 78.0)


if __name__ == "__main__":
    unittest.main()
