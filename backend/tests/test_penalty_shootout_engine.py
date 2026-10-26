import unittest
from backend.app.services.penalty_shootout_engine import (
    PenaltyShootoutEngine,
    ShootoutTaker,
    ShootoutGoalkeeper,
    PenaltyShotOutcome,
    ShootoutSummary,
)


class TestPenaltyShootoutEngine(unittest.TestCase):
    def setUp(self):
        self.home_takers = [
            ShootoutTaker("h1", "Bukayo Saka", composure=0.92, penalty_skill=0.88, fatigue_pct=25.0),
            ShootoutTaker("h2", "Martin Odegaard", composure=0.90, penalty_skill=0.85, fatigue_pct=30.0),
            ShootoutTaker("h3", "Kai Havertz", composure=0.86, penalty_skill=0.82, fatigue_pct=35.0),
            ShootoutTaker("h4", "Declan Rice", composure=0.88, penalty_skill=0.80, fatigue_pct=40.0),
            ShootoutTaker("h5", "Gabriel Magalhaes", composure=0.80, penalty_skill=0.75, fatigue_pct=45.0),
            ShootoutTaker("h6", "Ben White", composure=0.78, penalty_skill=0.72, fatigue_pct=50.0),
        ]

        self.away_takers = [
            ShootoutTaker("a1", "Cole Palmer", composure=0.95, penalty_skill=0.92, fatigue_pct=20.0),
            ShootoutTaker("a2", "Enzo Fernandez", composure=0.88, penalty_skill=0.84, fatigue_pct=30.0),
            ShootoutTaker("a3", "Nicolas Jackson", composure=0.75, penalty_skill=0.78, fatigue_pct=40.0),
            ShootoutTaker("a4", "Moises Caicedo", composure=0.82, penalty_skill=0.76, fatigue_pct=45.0),
            ShootoutTaker("a5", "Marc Cucurella", composure=0.78, penalty_skill=0.70, fatigue_pct=50.0),
            ShootoutTaker("a6", "Levi Colwill", composure=0.72, penalty_skill=0.68, fatigue_pct=55.0),
        ]

        self.home_gk = ShootoutGoalkeeper("gk_h", "David Raya", saving_instinct=0.85, reach_meters=2.6)
        self.away_gk = ShootoutGoalkeeper("gk_a", "Robert Sanchez", saving_instinct=0.80, reach_meters=2.7)

    def test_min_takers_validation(self):
        with self.assertRaises(ValueError):
            PenaltyShootoutEngine(
                "ars", "che",
                self.home_takers[:4],  # Only 4 takers
                self.away_takers,
                self.home_gk, self.away_gk,
            )

    def test_regulation_shootout_execution(self):
        engine = PenaltyShootoutEngine(
            "ars", "che",
            self.home_takers, self.away_takers,
            self.home_gk, self.away_gk,
            seed=42,
        )
        summary = engine.execute_shootout()

        self.assertIn(summary.winner_team_id, ["ars", "che"])
        self.assertIn(summary.loser_team_id, ["ars", "che"])
        self.assertNotEqual(summary.winner_team_id, summary.loser_team_id)
        self.assertGreater(summary.total_kicks, 0)
        self.assertEqual(len(summary.kick_history), summary.total_kicks)

        # Check that scores match kick outcomes
        home_goals = sum(
            1 for k in summary.kick_history
            if k.team_id == "ars" and k.outcome == PenaltyShotOutcome.GOAL
        )
        away_goals = sum(
            1 for k in summary.kick_history
            if k.team_id == "che" and k.outcome == PenaltyShotOutcome.GOAL
        )
        self.assertEqual(summary.home_score, home_goals)
        self.assertEqual(summary.away_score, away_goals)

    def test_sudden_death_extension_triggers_correctly(self):
        # Run across multiple seeds until sudden death occurs
        sd_found = False
        for s in range(50):
            engine = PenaltyShootoutEngine(
                "ars", "che",
                self.home_takers, self.away_takers,
                self.home_gk, self.away_gk,
                seed=s,
            )
            summary = engine.execute_shootout()
            if summary.went_to_sudden_death:
                sd_found = True
                self.assertGreater(summary.total_kicks, 10)
                # Verify sudden death kicks have flag set
                sd_kicks = [k for k in summary.kick_history if k.is_sudden_death]
                self.assertGreater(len(sd_kicks), 0)
                self.assertNotEqual(summary.home_score, summary.away_score)
                break
        self.assertTrue(sd_found, "Sudden death should occur in a sample of 50 seeded shootouts")

    def test_seed_determinism(self):
        e1 = PenaltyShootoutEngine("ars", "che", self.home_takers, self.away_takers, self.home_gk, self.away_gk, seed=777)
        e2 = PenaltyShootoutEngine("ars", "che", self.home_takers, self.away_takers, self.home_gk, self.away_gk, seed=777)

        s1 = e1.execute_shootout()
        s2 = e2.execute_shootout()

        self.assertEqual(s1.winner_team_id, s2.winner_team_id)
        self.assertEqual(s1.home_score, s2.home_score)
        self.assertEqual(s1.away_score, s2.away_score)
        self.assertEqual(s1.total_kicks, s2.total_kicks)


if __name__ == "__main__":
    unittest.main()
