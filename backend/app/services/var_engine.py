"""Video Assistant Referee (VAR) Decision Tree, Pitch Telemetry, and Offside Review Engine.

Simulates broadcast-grade VAR review workflows:
- Reviewable incidents: Goal Check (Foul in build-up / Offside / Handball), Penalty Decision, Direct Red Card, Mistaken Identity.
- Semi-Automated Offside Technology (SAOT): computes 3D skeletal limb tracking lines, ball release frame, and millimeter margin of error.
- Pitchside Monitor Review (OFR - On-Field Review) with referee overturn probability.
- Real-time broadcast delay and status transitions (REVIEW_INITIATED -> CHECKS_IN_PROGRESS -> MONITOR_CALLED -> DECISION_RENDERED).
"""

from dataclasses import dataclass
from enum import Enum
import random
from typing import Dict, List, Optional, Tuple


class VarIncidentType(str, Enum):
    GOAL_POSSIBLE_OFFSIDE = "GOAL_POSSIBLE_OFFSIDE"
    GOAL_POSSIBLE_FOUL = "GOAL_POSSIBLE_FOUL"
    GOAL_POSSIBLE_HANDBALL = "GOAL_POSSIBLE_HANDBALL"
    PENALTY_POSSIBLE_FOUL = "PENALTY_POSSIBLE_FOUL"
    PENALTY_POSSIBLE_DIVING = "PENALTY_POSSIBLE_DIVING"
    POSSIBLE_RED_CARD = "POSSIBLE_RED_CARD"
    MISTAKEN_IDENTITY = "MISTAKEN_IDENTITY"


class VarReviewOutcome(str, Enum):
    CONFIRMED_ORIGINAL_DECISION = "CONFIRMED_ORIGINAL_DECISION"
    OVERTURNED_GOAL_DISALLOWED = "OVERTURNED_GOAL_DISALLOWED"
    OVERTURNED_PENALTY_AWARDED = "OVERTURNED_PENALTY_AWARDED"
    OVERTURNED_PENALTY_CANCELLED = "OVERTURNED_PENALTY_CANCELLED"
    OVERTURNED_RED_CARD_AWARDED = "OVERTURNED_RED_CARD_AWARDED"
    OVERTURNED_YELLOW_RESCINDED = "OVERTURNED_YELLOW_RESCINDED"


@dataclass
class SaotOffsideTelemetry:
    attacker_limb_x_mm: float
    defender_limb_x_mm: float
    margin_mm: float
    is_offside: bool
    confidence_level: float
    calibrated_frame: int


@dataclass
class VarReviewResult:
    review_id: str
    match_minute: int
    incident_type: VarIncidentType
    on_field_decision: str
    review_outcome: VarReviewOutcome
    monitor_review_conducted: bool
    review_duration_seconds: int
    narrative_explanation: str
    telemetry: Optional[SaotOffsideTelemetry] = None


def compute_semi_automated_offside(
    attacker_pos_meters: float,
    last_defender_pos_meters: float,
    margin_tolerance_cm: float = 1.5,
    seed: Optional[int] = None,
) -> SaotOffsideTelemetry:
    """Computes high-precision millimeter offside line tracking calibrated at ball release."""
    rng = random.Random(seed)
    # Convert to millimeters
    att_mm = attacker_pos_meters * 1000.0
    def_mm = last_defender_pos_meters * 1000.0

    # Sensor jitter in millimeters
    jitter = rng.uniform(-margin_tolerance_cm * 10, margin_tolerance_cm * 10)
    margin = (att_mm - def_mm) + jitter

    is_offside = margin > 0.0
    confidence = 0.99 if abs(margin) > 50.0 else 0.88 + (abs(margin) / 50.0) * 0.11

    return SaotOffsideTelemetry(
        attacker_limb_x_mm=round(att_mm, 1),
        defender_limb_x_mm=round(def_mm, 1),
        margin_mm=round(margin, 1),
        is_offside=is_offside,
        confidence_level=round(confidence, 3),
        calibrated_frame=rng.randint(1420, 18500),
    )


def conduct_var_review(
    review_id: str,
    minute: int,
    incident_type: VarIncidentType,
    on_field_call: str,
    evidence_clarity: float = 0.85,  # 0.0 (ambiguous) to 1.0 (clear & obvious)
    seed: Optional[int] = None,
) -> VarReviewResult:
    """Simulates realistic referee VAR review process with high accuracy and stadium commentary."""
    rng = random.Random(seed)
    duration_sec = rng.randint(45, 130)

    # Offside is factual: decided purely via semi-automated line
    if incident_type == VarIncidentType.GOAL_POSSIBLE_OFFSIDE:
        # Attacker 10cm ahead vs behind
        att_pos = 65.10
        def_pos = 65.00 if rng.random() > 0.4 else 65.25
        telemetry = compute_semi_automated_offside(att_pos, def_pos, seed=seed)

        if telemetry.is_offside:
            outcome = VarReviewOutcome.OVERTURNED_GOAL_DISALLOWED
            narrative = (
                f"VAR CHECK COMPLETE ({minute}'): Goal Disallowed. Semi-Automated Offside "
                f"calibrated attacker {abs(telemetry.margin_mm)}mm ahead of the defensive line."
            )
        else:
            outcome = VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION
            narrative = (
                f"VAR CHECK COMPLETE ({minute}'): Goal Confirmed! Attacker was played onside "
                f"by {abs(telemetry.margin_mm)}mm."
            )

        return VarReviewResult(
            review_id=review_id,
            match_minute=minute,
            incident_type=incident_type,
            on_field_decision=on_field_call,
            review_outcome=outcome,
            monitor_review_conducted=False,  # Factual decisions do not require pitchside monitor
            review_duration_seconds=duration_sec,
            narrative_explanation=narrative,
            telemetry=telemetry,
        )

    # Subjective reviews (fouls, handballs, red cards): requires Pitchside Monitor check
    monitor_called = True
    overturn_prob = 0.75 if evidence_clarity >= 0.7 else 0.35
    should_overturn = rng.random() < overturn_prob

    if incident_type in (VarIncidentType.GOAL_POSSIBLE_FOUL, VarIncidentType.GOAL_POSSIBLE_HANDBALL):
        if should_overturn:
            outcome = VarReviewOutcome.OVERTURNED_GOAL_DISALLOWED
            narrative = f"ON-FIELD REVIEW ({minute}'): Goal Disallowed after referee inspects pitchside monitor for an infraction in attacking phase."
        else:
            outcome = VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION
            narrative = f"ON-FIELD REVIEW ({minute}'): Goal Stands! Referee confirms no clear and obvious foul occurred."

    elif incident_type == VarIncidentType.PENALTY_POSSIBLE_FOUL:
        if should_overturn:
            outcome = VarReviewOutcome.OVERTURNED_PENALTY_AWARDED
            narrative = f"ON-FIELD REVIEW ({minute}'): Penalty Awarded! Referee overturns original decision after seeing clear trip inside the box."
        else:
            outcome = VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION
            narrative = f"ON-FIELD REVIEW ({minute}'): No Penalty. On-field decision confirmed after monitor review."

    elif incident_type == VarIncidentType.POSSIBLE_RED_CARD:
        if should_overturn:
            outcome = VarReviewOutcome.OVERTURNED_RED_CARD_AWARDED
            narrative = f"ON-FIELD REVIEW ({minute}'): RED CARD Awarded! Serious foul play upgraded from initial warning."
        else:
            outcome = VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION
            narrative = f"ON-FIELD REVIEW ({minute}'): Yellow Card confirmed. Contact deemed careless rather than excessive force."

    else:
        outcome = VarReviewOutcome.CONFIRMED_ORIGINAL_DECISION
        narrative = f"VAR Check complete ({minute}'): Original call stands."

    return VarReviewResult(
        review_id=review_id,
        match_minute=minute,
        incident_type=incident_type,
        on_field_decision=on_field_call,
        review_outcome=outcome,
        monitor_review_conducted=monitor_called,
        review_duration_seconds=duration_sec,
        narrative_explanation=narrative,
    )
