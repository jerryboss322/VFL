"""Unit tests for Video Assistant Referee (VAR) decision tree and SAOT line tracking."""

import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.var_engine import (
    VarIncidentType,
    VarReviewOutcome,
    compute_semi_automated_offside,
    conduct_var_review,
)


class TestVarEngine(unittest.TestCase):
    def test_semi_automated_offside_calculation(self):
        # Attacker at 65.50m, defender at 65.20m -> Offside by 30cm (300mm)
        telemetry = compute_semi_automated_offside(65.50, 65.20, margin_tolerance_cm=0.0, seed=42)
        self.assertTrue(telemetry.is_offside)
        self.assertAlmostEqual(telemetry.margin_mm, 300.0, delta=1.0)
        self.assertTrue(telemetry.confidence_level > 0.95)

        # Attacker onside: attacker at 64.80m, defender at 65.00m
        onside_tel = compute_semi_automated_offside(64.80, 65.00, margin_tolerance_cm=0.0, seed=42)
        self.assertFalse(onside_tel.is_offside)
        self.assertTrue(onside_tel.margin_mm < 0)

    def test_goal_offside_review_workflow(self):
        res = conduct_var_review(
            review_id="var_001",
            minute=44,
            incident_type=VarIncidentType.GOAL_POSSIBLE_OFFSIDE,
            on_field_call="GOAL",
            seed=10,
        )
        self.assertFalse(res.monitor_review_conducted)  # Offside does not need monitor review
        self.assertIsNotNone(res.telemetry)
        self.assertIn(
            res.review_outcome,
            [VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION, VarReviewOutcome.OVERTURNED_GOAL_DISALLOWED],
        )

    def test_red_card_on_field_review(self):
        res = conduct_var_review(
            review_id="var_002",
            minute=68,
            incident_type=VarIncidentType.POSSIBLE_RED_CARD,
            on_field_call="YELLOW_CARD",
            evidence_clarity=0.95,
            seed=99,
        )
        self.assertTrue(res.monitor_review_conducted)  # Subjective review requires monitor
        self.assertIn("ON-FIELD REVIEW", res.narrative_explanation)


if __name__ == "__main__":
    unittest.main()
