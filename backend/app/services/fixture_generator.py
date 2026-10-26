"""Automated Double Round-Robin League Fixture Scheduler & Matrix Generator.

Implements the Berger polygon rotation algorithm for professional league calendars:
- Generates valid double round-robin schedules where each club plays all rivals once home and once away
- Guarantees exactly N/2 fixtures per matchday with zero team schedule collisions
- Home/Away alternation optimization to minimize consecutive home/away stretches
- Deterministic pseudo-random pairing shuffle with seed reproducibility
- Exact minor/seconds epoch timeline scheduling across multi-league tiers
"""

from dataclasses import dataclass
import random
import time
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class ScheduledClub:
    club_id: str
    name: str
    short_name: str
    stadium_name: str
    attack_rating: float = 1.0
    defense_rating: float = 1.0


@dataclass
class GeneratedMatchFixture:
    fixture_id: str
    league_id: str
    matchday: int
    home_club_id: str
    away_club_id: str
    scheduled_kickoff_unix: int
    match_duration_sec: int


class RoundRobinScheduler:
    """Produces balanced, non-conflicting double round-robin league schedules."""

    def __init__(self, league_id: str, clubs: List[ScheduledClub], seed: Optional[int] = None):
        if len(clubs) < 2:
            raise ValueError("League must contain at least 2 clubs")
        if len(clubs) % 2 != 0:
            raise ValueError(f"League must contain an even number of clubs, got {len(clubs)}")

        self.league_id = league_id
        self.clubs = clubs
        self.num_clubs = len(clubs)
        self.total_rounds = (self.num_clubs - 1) * 2
        self.matches_per_round = self.num_clubs // 2
        self.total_matches = self.num_clubs * (self.num_clubs - 1)
        self.rng = random.Random(seed)

    def generate_season_calendar(
        self,
        start_epoch_unix: int,
        match_duration_sec: int = 480,  # 8 minutes
        interval_between_matchdays_sec: int = 600,  # 10 minutes
    ) -> List[GeneratedMatchFixture]:
        """Generates the full double round-robin calendar for the season."""
        # Shuffle club indices to randomize pairing sequences if seeded
        shuffled_club_ids = [c.club_id for c in self.clubs]
        self.rng.shuffle(shuffled_club_ids)

        # Polygon rotation algorithm (one fixed team, rest rotate in circle)
        fixed_team = shuffled_club_ids[0]
        rotating_teams = shuffled_club_ids[1:]
        num_rotating = len(rotating_teams)

        first_half_rounds: List[List[Tuple[str, str]]] = []

        for r in range(self.num_clubs - 1):
            round_pairings: List[Tuple[str, str]] = []

            # Match for the fixed team
            team_fixed_opponent = rotating_teams[r % num_rotating]
            # Alternate home/away for the fixed team to avoid bias
            if r % 2 == 0:
                round_pairings.append((fixed_team, team_fixed_opponent))
            else:
                round_pairings.append((team_fixed_opponent, fixed_team))

            # Match for remaining teams in rotation
            for i in range(1, self.matches_per_round):
                t1 = rotating_teams[(r + i) % num_rotating]
                t2 = rotating_teams[(r + num_rotating - i) % num_rotating]
                if (r + i) % 2 == 0:
                    round_pairings.append((t1, t2))
                else:
                    round_pairings.append((t2, t1))

            first_half_rounds.append(round_pairings)

        # Second half: exactly mirror rounds with reversed home/away venues
        second_half_rounds: List[List[Tuple[str, str]]] = []
        for round_pairings in first_half_rounds:
            mirrored_round = [(away, home) for home, away in round_pairings]
            second_half_rounds.append(mirrored_round)

        all_rounds = first_half_rounds + second_half_rounds

        # Build scheduled fixture objects
        all_fixtures: List[GeneratedMatchFixture] = []
        current_time = start_epoch_unix

        for matchday_idx, pairings in enumerate(all_rounds, start=1):
            for pair_idx, (home_id, away_id) in enumerate(pairings, start=1):
                fix_id = f"{self.league_id}_md{matchday_idx}_{pair_idx}_{home_id}_{away_id}"
                all_fixtures.append(
                    GeneratedMatchFixture(
                        fixture_id=fix_id,
                        league_id=self.league_id,
                        matchday=matchday_idx,
                        home_club_id=home_id,
                        away_club_id=away_id,
                        scheduled_kickoff_unix=current_time,
                        match_duration_sec=match_duration_sec,
                    )
                )
            current_time += interval_between_matchdays_sec

        return all_fixtures

    def validate_schedule_integrity(self, fixtures: List[GeneratedMatchFixture]) -> bool:
        """Verifies schedule invariants: total fixtures, no round clashes, and equal home/away."""
        if len(fixtures) != self.total_matches:
            return False

        # Group by matchday
        by_matchday: Dict[int, List[GeneratedMatchFixture]] = {}
        for f in fixtures:
            by_matchday.setdefault(f.matchday, []).append(f)

        if len(by_matchday) != self.total_rounds:
            return False

        # Check each matchday: exactly matches_per_round and no club appears twice
        for md, match_list in by_matchday.items():
            if len(match_list) != self.matches_per_round:
                return False
            clubs_in_md: Set[str] = set()
            for m in match_list:
                if m.home_club_id in clubs_in_md or m.away_club_id in clubs_in_md:
                    return False  # Schedule collision!
                clubs_in_md.add(m.home_club_id)
                clubs_in_md.add(m.away_club_id)
            if len(clubs_in_md) != self.num_clubs:
                return False

        # Check that every pair plays exactly once Home and once Away
        pairings_seen: Set[Tuple[str, str]] = set()
        for f in fixtures:
            pair = (f.home_club_id, f.away_club_id)
            if pair in pairings_seen:
                return False  # Duplicate venue pairing!
            pairings_seen.add(pair)

        return True
