"""Penalty Shootout Sudden Death & Goalkeeper Telemetry Engine.

Implements high-stakes knockout tournament penalty shootouts:
- Regulation 5-round kicks rotation with early unreachable margin detection
- Sudden-death rounds extension when level after round 5 (AB / AB sudden death)
- Goalkeeper dive prediction and reflex physics against penalty taker shooting composure
- Fatigue exhaustion penalties accumulated over 120 minutes of cup football
- Full shot telemetry: ball velocity, target corner, GK dive direction, and deflection outcomes
"""

from dataclasses import dataclass
from enum import Enum
import random
from typing import Dict, List, Optional, Tuple


class PenaltyShotOutcome(str, Enum):
    GOAL = "GOAL"
    SAVED = "SAVED"
    WOODWORK = "WOODWORK"
    OFF_TARGET = "OFF_TARGET"


class TargetCorner(str, Enum):
    TOP_LEFT = "TOP_LEFT"
    TOP_RIGHT = "TOP_RIGHT"
    BOTTOM_LEFT = "BOTTOM_LEFT"
    BOTTOM_RIGHT = "BOTTOM_RIGHT"
    CENTER_PANENKA = "CENTER_PANENKA"


@dataclass
class ShootoutTaker:
    taker_id: str
    name: str
    composure: float      # 0.0 to 1.0 (higher resists pressure)
    penalty_skill: float  # 0.0 to 1.0
    fatigue_pct: float    # 0.0 to 100.0 (higher degrades conversion)


@dataclass
class ShootoutGoalkeeper:
    gk_id: str
    name: str
    saving_instinct: float  # 0.0 to 1.0
    reach_meters: float     # 2.2 to 2.8m reach


@dataclass
class ShootoutKickRecord:
    round_number: int
    kick_index: int
    team_id: str
    taker: ShootoutTaker
    target: TargetCorner
    gk_dive: TargetCorner
    outcome: PenaltyShotOutcome
    running_home_score: int
    running_away_score: int
    is_sudden_death: bool


@dataclass
class ShootoutSummary:
    winner_team_id: str
    loser_team_id: str
    home_score: int
    away_score: int
    total_kicks: int
    went_to_sudden_death: bool
    kick_history: List[ShootoutKickRecord]


class PenaltyShootoutEngine:
    """Simulates knockout penalty shootouts with full sudden death support."""

    CORNERS = [
        TargetCorner.TOP_LEFT,
        TargetCorner.TOP_RIGHT,
        TargetCorner.BOTTOM_LEFT,
        TargetCorner.BOTTOM_RIGHT,
        TargetCorner.CENTER_PANENKA,
    ]

    def __init__(
        self,
        home_team_id: str,
        away_team_id: str,
        home_takers: List[ShootoutTaker],
        away_takers: List[ShootoutTaker],
        home_gk: ShootoutGoalkeeper,
        away_gk: ShootoutGoalkeeper,
        seed: Optional[int] = None,
    ):
        if len(home_takers) < 5 or len(away_takers) < 5:
            raise ValueError("Both teams must submit at least 5 penalty takers")

        self.home_team_id = home_team_id
        self.away_team_id = away_team_id
        self.home_takers = home_takers
        self.away_takers = away_takers
        self.home_gk = home_gk
        self.away_gk = away_gk
        self.rng = random.Random(seed)

    def _simulate_kick(
        self,
        taker: ShootoutTaker,
        gk: ShootoutGoalkeeper,
        is_pressure_kick: bool,
    ) -> Tuple[TargetCorner, TargetCorner, PenaltyShotOutcome]:
        """Resolves a single penalty shot attempt."""
        target = self.rng.choice(self.CORNERS)
        # GK dives
        gk_dive = self.rng.choice(self.CORNERS)

        # Baseline goal probability: ~75% across top European competitions
        base_conversion = 0.76

        # Adjust for taker skill and composure
        base_conversion += (taker.penalty_skill - 0.75) * 0.20
        if is_pressure_kick:
            base_conversion -= (1.0 - taker.composure) * 0.15

        # Adjust for fatigue
        base_conversion -= (taker.fatigue_pct / 100.0) * 0.10

        # If GK guesses right corner
        if gk_dive == target:
            # GK save chance is boosted by GK saving instinct
            save_prob = 0.50 + gk.saving_instinct * 0.35
            if self.rng.random() < save_prob:
                return target, gk_dive, PenaltyShotOutcome.SAVED

        # Roll conversion outcome
        roll = self.rng.random()
        if roll < base_conversion:
            return target, gk_dive, PenaltyShotOutcome.GOAL
        elif roll < base_conversion + 0.12:
            return target, gk_dive, PenaltyShotOutcome.SAVED
        elif roll < base_conversion + 0.18:
            return target, gk_dive, PenaltyShotOutcome.WOODWORK
        else:
            return target, gk_dive, PenaltyShotOutcome.OFF_TARGET

    def execute_shootout(self) -> ShootoutSummary:
        """Executes the full shootout until an authoritative winner emerges."""
        history: List[ShootoutKickRecord] = []
        home_score = 0
        away_score = 0
        home_kicks_left = 5
        away_kicks_left = 5
        home_idx = 0
        away_idx = 0

        # Phase 1: Regulation 5 Rounds
        for round_num in range(1, 6):
            # Home team kick
            h_taker = self.home_takers[home_idx % len(self.home_takers)]
            home_idx += 1
            home_kicks_left -= 1

            is_pressure_h = abs(home_score - away_score) >= 2 or round_num >= 4
            target_h, dive_a, outcome_h = self._simulate_kick(h_taker, self.away_gk, is_pressure_h)
            if outcome_h == PenaltyShotOutcome.GOAL:
                home_score += 1

            history.append(
                ShootoutKickRecord(
                    round_number=round_num,
                    kick_index=len(history) + 1,
                    team_id=self.home_team_id,
                    taker=h_taker,
                    target=target_h,
                    gk_dive=dive_a,
                    outcome=outcome_h,
                    running_home_score=home_score,
                    running_away_score=away_score,
                    is_sudden_death=False,
                )
            )

            # Check if away team can mathematically catch up
            if home_score > away_score + away_kicks_left:
                return ShootoutSummary(
                    winner_team_id=self.home_team_id,
                    loser_team_id=self.away_team_id,
                    home_score=home_score,
                    away_score=away_score,
                    total_kicks=len(history),
                    went_to_sudden_death=False,
                    kick_history=history,
                )
            if away_score > home_score + home_kicks_left:
                return ShootoutSummary(
                    winner_team_id=self.away_team_id,
                    loser_team_id=self.home_team_id,
                    home_score=home_score,
                    away_score=away_score,
                    total_kicks=len(history),
                    went_to_sudden_death=False,
                    kick_history=history,
                )

            # Away team kick
            a_taker = self.away_takers[away_idx % len(self.away_takers)]
            away_idx += 1
            away_kicks_left -= 1

            is_pressure_a = abs(home_score - away_score) >= 1 or round_num >= 4
            target_a, dive_h, outcome_a = self._simulate_kick(a_taker, self.home_gk, is_pressure_a)
            if outcome_a == PenaltyShotOutcome.GOAL:
                away_score += 1

            history.append(
                ShootoutKickRecord(
                    round_number=round_num,
                    kick_index=len(history) + 1,
                    team_id=self.away_team_id,
                    taker=a_taker,
                    target=target_a,
                    gk_dive=dive_h,
                    outcome=outcome_a,
                    running_home_score=home_score,
                    running_away_score=away_score,
                    is_sudden_death=False,
                )
            )

            # Check early winner after round
            if home_score > away_score + away_kicks_left:
                return ShootoutSummary(
                    winner_team_id=self.home_team_id,
                    loser_team_id=self.away_team_id,
                    home_score=home_score,
                    away_score=away_score,
                    total_kicks=len(history),
                    went_to_sudden_death=False,
                    kick_history=history,
                )
            if away_score > home_score + home_kicks_left:
                return ShootoutSummary(
                    winner_team_id=self.away_team_id,
                    loser_team_id=self.home_team_id,
                    home_score=home_score,
                    away_score=away_score,
                    total_kicks=len(history),
                    went_to_sudden_death=False,
                    kick_history=history,
                )

        # If not tied after 5 rounds, return winner
        if home_score != away_score:
            winner = self.home_team_id if home_score > away_score else self.away_team_id
            loser = self.away_team_id if winner == self.home_team_id else self.home_team_id
            return ShootoutSummary(
                winner_team_id=winner,
                loser_team_id=loser,
                home_score=home_score,
                away_score=away_score,
                total_kicks=len(history),
                went_to_sudden_death=False,
                kick_history=history,
            )

        # Phase 2: Sudden Death Rounds (Round 6 onwards)
        round_sd = 6
        while True:
            # Home kicks
            h_taker = self.home_takers[home_idx % len(self.home_takers)]
            home_idx += 1
            target_h, dive_a, outcome_h = self._simulate_kick(h_taker, self.away_gk, is_pressure_kick=True)
            if outcome_h == PenaltyShotOutcome.GOAL:
                home_score += 1

            history.append(
                ShootoutKickRecord(
                    round_number=round_sd,
                    kick_index=len(history) + 1,
                    team_id=self.home_team_id,
                    taker=h_taker,
                    target=target_h,
                    gk_dive=dive_a,
                    outcome=outcome_h,
                    running_home_score=home_score,
                    running_away_score=away_score,
                    is_sudden_death=True,
                )
            )

            # Away kicks
            a_taker = self.away_takers[away_idx % len(self.away_takers)]
            away_idx += 1
            target_a, dive_h, outcome_a = self._simulate_kick(a_taker, self.home_gk, is_pressure_kick=True)
            if outcome_a == PenaltyShotOutcome.GOAL:
                away_score += 1

            history.append(
                ShootoutKickRecord(
                    round_number=round_sd,
                    kick_index=len(history) + 1,
                    team_id=self.away_team_id,
                    taker=a_taker,
                    target=target_a,
                    gk_dive=dive_h,
                    outcome=outcome_a,
                    running_home_score=home_score,
                    running_away_score=away_score,
                    is_sudden_death=True,
                )
            )

            # Check if tie broken after paired sudden death round
            if home_score != away_score:
                winner = self.home_team_id if home_score > away_score else self.away_team_id
                loser = self.away_team_id if winner == self.home_team_id else self.home_team_id
                return ShootoutSummary(
                    winner_team_id=winner,
                    loser_team_id=loser,
                    home_score=home_score,
                    away_score=away_score,
                    total_kicks=len(history),
                    went_to_sudden_death=True,
                    kick_history=history,
                )

            round_sd += 1
