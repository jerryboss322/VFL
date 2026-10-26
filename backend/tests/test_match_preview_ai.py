"""Unit tests for AI Match Preview & Tactical Dossier Generation Engine."""

import unittest

from backend.app.services.match_preview_ai import (
    MatchPreviewDossier,
    generate_match_preview_dossier,
)


class TestMatchPreviewAi(unittest.TestCase):
    def test_preview_generation_structure(self):
        dossier = generate_match_preview_dossier(
            fixture_id="fx-test-mci-liv",
            home_club_name="Manchester Blue",
            away_club_name="Liverpool Red",
            home_attack_rating=1.35,
            home_defense_rating=0.80,
            away_attack_rating=1.25,
            away_defense_rating=0.85,
            home_formation="4-3-3",
            away_formation="4-3-3",
            seed=42,
        )

        self.assertEqual(dossier.fixture_id, "fx-test-mci-liv")
        self.assertIn("Manchester Blue", dossier.headline)
        self.assertGreater(dossier.home_projected_xg, 0.5)
        self.assertGreater(dossier.away_projected_xg, 0.5)
        self.assertIsNotNone(dossier.most_likely_scoreline)
        self.assertGreater(dossier.scoreline_probability_pct, 5.0)

        # Player duel check
        self.assertIsNotNone(dossier.player_duel.home_key_player)
        self.assertIsNotNone(dossier.player_duel.away_key_player)

        # Value tip recommendation check
        self.assertGreater(dossier.expert_tip.recommended_decimal_odds, 1.01)
        self.assertIn(dossier.expert_tip.confidence_stars, [1, 2, 3, 4, 5])
        self.assertTrue(len(dossier.key_match_facts) >= 3)

    def test_deterministic_seeding(self):
        d1 = generate_match_preview_dossier("fx-01", "Team A", "Team B", seed=999)
        d2 = generate_match_preview_dossier("fx-01", "Team A", "Team B", seed=999)

        self.assertEqual(d1.home_projected_xg, d2.home_projected_xg)
        self.assertEqual(d1.most_likely_scoreline, d2.most_likely_scoreline)
        self.assertEqual(d1.expert_tip.recommended_decimal_odds, d2.expert_tip.recommended_decimal_odds)


if __name__ == "__main__":
    unittest.main()
