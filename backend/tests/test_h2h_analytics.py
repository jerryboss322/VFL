"""Unit tests for H2H analytics, Poisson probability matrix, and radar metrics."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.h2h_analytics import (
    calculate_poisson_probability,
    generate_score_probability_matrix,
    compute_h2h_clash_metrics,
    compute_team_radar_attributes,
)


class TestH2HAnalytics(unittest.TestCase):
    def test_poisson_probability(self):
        # lambda = 1.5, k = 1 -> (1.5 * e^-1.5) / 1! = 1.5 * 0.22313 = 0.3347
        p1 = calculate_poisson_probability(1.5, 1)
        self.assertAlmostEqual(p1, 0.3347, delta=0.005)

        # k = 0
        p0 = calculate_poisson_probability(1.5, 0)
        self.assertAlmostEqual(p0, 0.2231, delta=0.005)

    def test_score_probability_matrix(self):
        # Home xG: 1.8, Away xG: 1.2
        matrix = generate_score_probability_matrix(1.8, 1.2)
        self.assertTrue(matrix["home_win_probability"] > matrix["away_win_probability"])
        self.assertTrue(0.0 < matrix["over_2_5_probability"] < 1.0)
        self.assertTrue(0.0 < matrix["btts_yes_probability"] < 1.0)
        self.assertEqual(len(matrix["top_scores"]), 5)
        # Sum of win + draw + loss should approach 1.0
        tot = matrix["home_win_probability"] + matrix["draw_probability"] + matrix["away_win_probability"]
        self.assertAlmostEqual(tot, 1.0, delta=0.05)

    def test_h2h_clash_metrics(self):
        matches = [
            {"home_id": "c1", "away_id": "c2", "home_goals": 2, "away_goals": 1},  # c1 win
            {"home_id": "c2", "away_id": "c1", "home_goals": 0, "away_goals": 1},  # c1 win
            {"home_id": "c1", "away_id": "c2", "home_goals": 2, "away_goals": 2},  # draw
            {"home_id": "c2", "away_id": "c1", "home_goals": 3, "away_goals": 0},  # c2 win
        ]
        res = compute_h2h_clash_metrics(matches, "c1", "c2")
        self.assertEqual(res["total_matches"], 4)
        self.assertEqual(res["club_a_wins"], 2)
        self.assertEqual(res["club_b_wins"], 1)
        self.assertEqual(res["draws"], 1)
        self.assertEqual(res["club_a_goals"], 5)  # 2 + 1 + 2 + 0
        self.assertEqual(res["club_b_goals"], 6)  # 1 + 0 + 2 + 3
        self.assertEqual(res["clean_sheets_a"], 1)
        self.assertEqual(res["clean_sheets_b"], 1)
        self.assertEqual(res["btts_percentage"], 50.0)

    def test_radar_attributes(self):
        attrs = compute_team_radar_attributes(1.8, 1.4, [2, 3, 1, 2], [1, 0, 1, 1])
        self.assertTrue(40 <= attrs["attack"] <= 99)
        self.assertTrue(40 <= attrs["defense"] <= 99)
        self.assertTrue(40 <= attrs["possession"] <= 99)
        self.assertTrue(40 <= attrs["pressing"] <= 99)
        self.assertTrue(40 <= attrs["setPieces"] <= 99)


if __name__ == "__main__":
    unittest.main()
