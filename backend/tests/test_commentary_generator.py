"""Unit tests for Dynamic Commentary Generator and speech modulation engine."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.commentary_generator import (
    CommentaryLanguage,
    CommentaryUrgency,
    generate_live_commentary,
)


class TestCommentaryGenerator(unittest.TestCase):
    def test_goal_commentary_high_urgency_and_modulation(self):
        res = generate_live_commentary(
            event_type="goal",
            team_name="Arsenal",
            minute=74,
            language=CommentaryLanguage.EN,
            seed=42,
        )
        self.assertEqual(res["minute"], 74)
        self.assertEqual(res["urgency"], CommentaryUrgency.CRITICAL.value)
        self.assertTrue("GOAL" in res["text"].upper() or "STRIKE" in res["text"].upper())
        self.assertTrue(res["speechParams"]["pitch"] > 1.2)
        self.assertTrue(res["speechParams"]["rate"] > 1.1)

    def test_multilingual_commentary(self):
        # Spanish goal
        es_res = generate_live_commentary("goal", "Real Madrid", 89, CommentaryLanguage.ES, seed=1)
        self.assertTrue("¡GOL" in es_res["text"] or "A la red" in es_res["text"])

        # German goal
        de_res = generate_live_commentary("goal", "Bayern Munich", 23, CommentaryLanguage.DE, seed=1)
        self.assertTrue("TOOR" in de_res["text"] or "Treffer" in de_res["text"] or "Netz" in de_res["text"])

        # French goal
        fr_res = generate_live_commentary("goal", "Paris Saint-Germain", 45, CommentaryLanguage.FR, seed=1)
        self.assertTrue("BUT" in fr_res["text"] or "filets" in fr_res["text"])

    def test_red_card_and_woodwork_urgency(self):
        red_res = generate_live_commentary("red_card", "Chelsea", 34, CommentaryLanguage.EN, seed=2)
        self.assertEqual(red_res["urgency"], CommentaryUrgency.HIGH.value)
        self.assertTrue("RED" in red_res["text"].upper() or "OFF" in red_res["text"].upper())

        wood_res = generate_live_commentary("shot_woodwork", "Inter", 56, CommentaryLanguage.IT, seed=3)
        self.assertEqual(wood_res["urgency"], CommentaryUrgency.HIGH.value)
        self.assertTrue("PALO" in wood_res["text"].upper() or "TRAVERSA" in wood_res["text"].upper())


if __name__ == "__main__":
    unittest.main()
