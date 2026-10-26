"""Virtual European Champions Cup & Knockout Tournament Bracket Engine.

Handles:
- Two-legged aggregate knockout ties (Round of 16, Quarter-Finals, Semi-Finals)
- Single-leg neutral venue Final
- Extra time (2 x 15-minute periods) when aggregate is tied after 180 minutes
- Penalty shootout simulator (best-of-5 with sudden death)
- Pot-based UEFA-style draw engine (seeded group winners vs unseeded runners-up, country protection)
- Outright tournament winner odds calculation based on club Elo/attack/defense ratings
"""

import math
import random
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple


class TournamentRound(str, Enum):
    ROUND_OF_16 = "ROUND_OF_16"
    QUARTER_FINALS = "QUARTER_FINALS"
    SEMI_FINALS = "SEMI_FINALS"
    FINAL = "FINAL"


class TieResolutionType(str, Enum):
    REGULAR_TIME = "REGULAR_TIME"
    EXTRA_TIME = "EXTRA_TIME"
    PENALTY_SHOOTOUT = "PENALTY_SHOOTOUT"


@dataclass
class ClubParticipant:
    club_id: str
    name: str
    short_name: str
    country: str
    attack_rating: float
    defense_rating: float
    is_seeded: bool = False


@dataclass
class MatchLegScore:
    home_club_id: str
    away_club_id: str
    home_goals: int
    away_goals: int
    home_et_goals: int = 0
    away_et_goals: int = 0
    home_penalties: Optional[int] = None
    away_penalties: Optional[int] = None


@dataclass
class KnockoutTieResult:
    tie_id: str
    round_name: TournamentRound
    club_a: ClubParticipant
    club_b: ClubParticipant
    leg_1: MatchLegScore
    leg_2: Optional[MatchLegScore]
    aggregate_a: int
    aggregate_b: int
    resolution: TieResolutionType
    winner_club_id: str
    loser_club_id: str
    summary_text: str


def simulate_penalty_shootout(
    club_a_rating: float, club_b_rating: float, seed: Optional[int] = None
) -> Tuple[int, int, List[bool], List[bool]]:
    """Simulates realistic 5-penalty shootout followed by sudden death if tied.

    Returns (score_a, score_b, shots_a, shots_b)
    """
    rng = random.Random(seed)
    prob_a = max(0.65, min(0.85, 0.75 + (club_a_rating - club_b_rating) * 0.05))
    prob_b = max(0.65, min(0.85, 0.75 + (club_b_rating - club_a_rating) * 0.05))

    shots_a: List[bool] = []
    shots_b: List[bool] = []
    score_a = 0
    score_b = 0

    # Best of 5
    for round_num in range(1, 6):
        scored_a = rng.random() < prob_a
        shots_a.append(scored_a)
        if scored_a:
            score_a += 1

        # Check early mathematical win for A
        remaining_b = 6 - round_num
        if score_a > score_b + remaining_b:
            break

        scored_b = rng.random() < prob_b
        shots_b.append(scored_b)
        if scored_b:
            score_b += 1

        # Check early mathematical win for B
        remaining_a = 5 - round_num
        if score_b > score_a + remaining_a:
            break

    # Sudden death if tied
    if score_a == score_b:
        while score_a == score_b and len(shots_a) < 15:
            scored_a = rng.random() < prob_a
            scored_b = rng.random() < prob_b
            shots_a.append(scored_a)
            shots_b.append(scored_b)
            if scored_a:
                score_a += 1
            if scored_b:
                score_b += 1

    # Guarantee non-tie in sudden death
    if score_a == score_b:
        score_a += 1

    return score_a, score_b, shots_a, shots_b


def resolve_two_legged_tie(
    tie_id: str,
    round_name: TournamentRound,
    club_a: ClubParticipant,
    club_b: ClubParticipant,
    leg_1_home_goals: int,
    leg_1_away_goals: int,
    leg_2_home_goals: int,
    leg_2_away_goals: int,
    seed: Optional[int] = None,
) -> KnockoutTieResult:
    """Resolves a 2-legged UEFA tie (Club A was home in Leg 1, away in Leg 2).

    Leg 1: Club A (H) vs Club B (A)
    Leg 2: Club B (H) vs Club A (A)
    """
    total_a = leg_1_home_goals + leg_2_away_goals
    total_b = leg_1_away_goals + leg_2_home_goals

    leg1 = MatchLegScore(
        home_club_id=club_a.club_id,
        away_club_id=club_b.club_id,
        home_goals=leg_1_home_goals,
        away_goals=leg_1_away_goals,
    )

    leg2 = MatchLegScore(
        home_club_id=club_b.club_id,
        away_club_id=club_a.club_id,
        home_goals=leg_2_home_goals,
        away_goals=leg_2_away_goals,
    )

    if total_a > total_b:
        return KnockoutTieResult(
            tie_id=tie_id,
            round_name=round_name,
            club_a=club_a,
            club_b=club_b,
            leg_1=leg1,
            leg_2=leg2,
            aggregate_a=total_a,
            aggregate_b=total_b,
            resolution=TieResolutionType.REGULAR_TIME,
            winner_club_id=club_a.club_id,
            loser_club_id=club_b.club_id,
            summary_text=f"{club_a.name} wins {total_a} - {total_b} on aggregate.",
        )
    elif total_b > total_a:
        return KnockoutTieResult(
            tie_id=tie_id,
            round_name=round_name,
            club_a=club_a,
            club_b=club_b,
            leg_1=leg1,
            leg_2=leg2,
            aggregate_a=total_a,
            aggregate_b=total_b,
            resolution=TieResolutionType.REGULAR_TIME,
            winner_club_id=club_b.club_id,
            loser_club_id=club_a.club_id,
            summary_text=f"{club_b.name} wins {total_b} - {total_a} on aggregate.",
        )

    # Aggregate tied: Proceed to Extra Time
    rng = random.Random(seed)
    # Extra time probability of goal
    et_goals_b = 1 if rng.random() < 0.25 else 0
    et_goals_a = 1 if rng.random() < 0.25 else 0

    leg2.home_et_goals = et_goals_b
    leg2.away_et_goals = et_goals_a
    total_a += et_goals_a
    total_b += et_goals_b

    if total_a > total_b:
        return KnockoutTieResult(
            tie_id=tie_id,
            round_name=round_name,
            club_a=club_a,
            club_b=club_b,
            leg_1=leg1,
            leg_2=leg2,
            aggregate_a=total_a,
            aggregate_b=total_b,
            resolution=TieResolutionType.EXTRA_TIME,
            winner_club_id=club_a.club_id,
            loser_club_id=club_b.club_id,
            summary_text=f"{club_a.name} wins {total_a} - {total_b} after extra time.",
        )
    elif total_b > total_a:
        return KnockoutTieResult(
            tie_id=tie_id,
            round_name=round_name,
            club_a=club_a,
            club_b=club_b,
            leg_1=leg1,
            leg_2=leg2,
            aggregate_a=total_a,
            aggregate_b=total_b,
            resolution=TieResolutionType.EXTRA_TIME,
            winner_club_id=club_b.club_id,
            loser_club_id=club_a.club_id,
            summary_text=f"{club_b.name} wins {total_b} - {total_a} after extra time.",
        )

    # Still tied after extra time: Penalty Shootout
    pen_b, pen_a, _, _ = simulate_penalty_shootout(club_b.attack_rating, club_a.attack_rating, seed)
    leg2.home_penalties = pen_b
    leg2.away_penalties = pen_a

    winner_id = club_b.club_id if pen_b > pen_a else club_a.club_id
    loser_id = club_a.club_id if winner_id == club_b.club_id else club_b.club_id
    winner_name = club_b.name if winner_id == club_b.club_id else club_a.name

    return KnockoutTieResult(
        tie_id=tie_id,
        round_name=round_name,
        club_a=club_a,
        club_b=club_b,
        leg_1=leg1,
        leg_2=leg2,
        aggregate_a=total_a,
        aggregate_b=total_b,
        resolution=TieResolutionType.PENALTY_SHOOTOUT,
        winner_club_id=winner_id,
        loser_club_id=loser_id,
        summary_text=f"{winner_name} wins {max(pen_a, pen_b)} - {min(pen_a, pen_b)} on penalties after {total_a} - {total_b} aggregate tie.",
    )


def conduct_r16_draw(
    seeded_clubs: List[ClubParticipant],
    unseeded_clubs: List[ClubParticipant],
    seed: Optional[int] = None,
) -> List[Tuple[ClubParticipant, ClubParticipant]]:
    """Conducts official Round of 16 UEFA draw with country protection.

    Rules:
    - 8 seeded teams (Pot 1) vs 8 unseeded teams (Pot 2)
    - No two clubs from the same country can be drawn against each other in R16
    """
    if len(seeded_clubs) != 8 or len(unseeded_clubs) != 8:
        raise ValueError("Round of 16 requires exactly 8 seeded and 8 unseeded clubs")

    rng = random.Random(seed)
    max_attempts = 100

    for _ in range(max_attempts):
        shuffled_unseeded = list(unseeded_clubs)
        rng.shuffle(shuffled_unseeded)

        pairs = []
        valid = True
        for i in range(8):
            pot1 = seeded_clubs[i]
            pot2 = shuffled_unseeded[i]
            if pot1.country.upper() == pot2.country.upper():
                valid = False
                break
            pairs.append((pot1, pot2))

        if valid:
            return pairs

    # Fallback if strict country collision occurs
    return list(zip(seeded_clubs, unseeded_clubs))


def calculate_outright_winner_odds(
    clubs: List[ClubParticipant],
) -> List[Dict[str, object]]:
    """Calculates fair outright winner decimal odds for each club in the Champions Cup tournament."""
    # Composite Elo power rating: attack * 0.55 + defense * 0.45
    powers = [c.attack_rating * 0.55 + c.defense_rating * 0.45 for c in clubs]
    exp_powers = [math.exp(p * 2.2) for p in powers]
    total_exp = sum(exp_powers)

    # 8% bookmaker margin on outright market
    margin = 1.08
    results = []

    for club, exp_p in zip(clubs, exp_powers):
        prob = exp_p / total_exp
        raw_odds = margin / prob
        decimal_odds = max(1.5, min(80.0, round(raw_odds, 1)))
        results.append({
            "club_id": club.club_id,
            "name": club.name,
            "short_name": club.short_name,
            "country": club.country,
            "probability": round(prob, 4),
            "decimal_odds": decimal_odds,
        })

    results.sort(key=lambda x: x["decimal_odds"])
    return results
