"""Live Fantasy Football Snake Draft & Waiver Wire Free Agency Engine.

Orchestrates multi-team competitive fantasy drafts:
- Snake draft rotation: Round 1 (1 -> N), Round 2 (N -> 1), alternating across 15 rounds
- Draft clock with auto-pick fallback selecting the highest Value-Over-Replacement (VORP) player
- Strict roster position quota validation (2 GK, 5 DEF, 5 MID, 3 FWD)
- Rolling waiver wire priority order and free agency transaction claim queues
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import time
from typing import Dict, List, Optional, Tuple


class DraftStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


@dataclass
class DraftPick:
    overall_pick: int
    round_number: int
    pick_in_round: int
    team_id: str
    player_id: Optional[str] = None
    picked_at_unix: Optional[float] = None


@dataclass
class AvailableDraftPlayer:
    player_id: str
    name: str
    club: str
    position: str  # "GKP", "DEF", "MID", "FWD"
    vorp_score: float  # Value over replacement player (higher is better)
    price_major: float


@dataclass
class FantasyTeamDraftRoster:
    team_id: str
    team_name: str
    picked_players: List[AvailableDraftPlayer] = field(default_factory=list)

    @property
    def gkp_count(self) -> int:
        return sum(1 for p in self.picked_players if p.position == "GKP")

    @property
    def def_count(self) -> int:
        return sum(1 for p in self.picked_players if p.position == "DEF")

    @property
    def mid_count(self) -> int:
        return sum(1 for p in self.picked_players if p.position == "MID")

    @property
    def fwd_count(self) -> int:
        return sum(1 for p in self.picked_players if p.position == "FWD")

    def can_pick_position(self, pos: str) -> bool:
        if pos == "GKP" and self.gkp_count >= 2:
            return False
        if pos == "DEF" and self.def_count >= 5:
            return False
        if pos == "MID" and self.mid_count >= 5:
            return False
        if pos == "FWD" and self.fwd_count >= 3:
            return False
        return True


class FantasySnakeDraftEngine:
    """Manages the full lifecycle and pick validation of a 15-round snake draft."""

    def __init__(self, league_id: str, team_ids: List[str], turn_time_limit_sec: int = 60):
        if len(team_ids) < 2:
            raise ValueError("Draft requires at least 2 teams")
        self.league_id = league_id
        self.team_ids = team_ids
        self.total_teams = len(team_ids)
        self.total_rounds = 15  # 15 players per team
        self.turn_time_limit_sec = turn_time_limit_sec
        self.status = DraftStatus.SCHEDULED
        self.current_pick_index = 0
        self.picks_timeline: List[DraftPick] = self._generate_snake_order()
        self.rosters: Dict[str, FantasyTeamDraftRoster] = {
            t_id: FantasyTeamDraftRoster(team_id=t_id, team_name=f"Team {t_id}")
            for t_id in team_ids
        }
        self.available_pool: Dict[str, AvailableDraftPlayer] = {}
        self.current_turn_deadline_unix: Optional[float] = None

    def _generate_snake_order(self) -> List[DraftPick]:
        """Generates all picks following snake rotation."""
        picks: List[DraftPick] = []
        overall = 1

        for r in range(1, self.total_rounds + 1):
            # Odd rounds: 1 -> N; Even rounds: N -> 1
            team_order = self.team_ids if r % 2 != 0 else list(reversed(self.team_ids))
            for pick_in_round, t_id in enumerate(team_order, start=1):
                picks.append(
                    DraftPick(
                        overall_pick=overall,
                        round_number=r,
                        pick_in_round=pick_in_round,
                        team_id=t_id,
                    )
                )
                overall += 1

        return picks

    def populate_player_pool(self, players: List[AvailableDraftPlayer]) -> None:
        """Loads available players into the draft pool."""
        self.available_pool = {p.player_id: p for p in players}

    def start_draft(self) -> None:
        """Starts the draft clock for pick #1."""
        self.status = DraftStatus.IN_PROGRESS
        self.current_pick_index = 0
        self.current_turn_deadline_unix = time.time() + self.turn_time_limit_sec

    def get_current_pick(self) -> Optional[DraftPick]:
        """Returns the active pick on the clock."""
        if self.current_pick_index >= len(self.picks_timeline):
            return None
        return self.picks_timeline[self.current_pick_index]

    def make_pick(self, team_id: str, player_id: str) -> DraftPick:
        """Submits a player pick for the active team."""
        if self.status != DraftStatus.IN_PROGRESS:
            raise ValueError(f"Draft is not in progress (Status: {self.status})")

        current_pick = self.get_current_pick()
        if not current_pick or current_pick.team_id != team_id:
            raise ValueError(f"Not {team_id}'s turn to pick")

        if player_id not in self.available_pool:
            raise ValueError("Player is not available in pool")

        player = self.available_pool[player_id]
        roster = self.rosters[team_id]

        if not roster.can_pick_position(player.position):
            raise ValueError(f"Roster positional quota exceeded for {player.position}")

        # Execute pick
        del self.available_pool[player_id]
        roster.picked_players.append(player)
        current_pick.player_id = player_id
        current_pick.picked_at_unix = time.time()

        # Advance to next pick
        self.current_pick_index += 1
        if self.current_pick_index >= len(self.picks_timeline):
            self.status = DraftStatus.COMPLETED
            self.current_turn_deadline_unix = None
        else:
            self.current_turn_deadline_unix = time.time() + self.turn_time_limit_sec

        return current_pick

    def execute_auto_pick(self) -> Optional[DraftPick]:
        """Auto-picks the highest VORP eligible player when timer expires."""
        current_pick = self.get_current_pick()
        if not current_pick:
            return None

        roster = self.rosters[current_pick.team_id]
        # Sort available players by VORP descending
        sorted_pool = sorted(self.available_pool.values(), key=lambda p: p.vorp_score, reverse=True)

        for candidate in sorted_pool:
            if roster.can_pick_position(candidate.position):
                return self.make_pick(current_pick.team_id, candidate.player_id)

        return None
