"""Fantasy Football Waiver Wire & Free Agent Acquisition Budget (FAB) Engine.

Manages post-draft player acquisitions:
- Rolling waiver priority queue (successful claimant drops to last place)
- Blind-bidding Free Agent Acquisition Budget (FAB) resolution with tie-breaking
- Roster quota validation on add/drop swaps (2 GKP, 5 DEF, 5 MID, 3 FWD)
- Atomic claims batch clearing with comprehensive audit trail
"""

from dataclasses import dataclass, field
from enum import Enum
import time
from typing import Dict, List, Optional, Tuple


class ClaimStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESSFUL = "SUCCESSFUL"
    FAILED_OUTBID = "FAILED_OUTBID"
    FAILED_UNAVAILABLE = "FAILED_UNAVAILABLE"
    FAILED_INSUFFICIENT_FUNDS = "FAILED_INSUFFICIENT_FUNDS"
    FAILED_ROSTER_INVALID = "FAILED_ROSTER_INVALID"


@dataclass
class WaiverPlayer:
    player_id: str
    name: str
    club: str
    position: str  # "GKP", "DEF", "MID", "FWD"
    price_major: float


@dataclass
class WaiverClaim:
    claim_id: str
    team_id: str
    add_player_id: str
    drop_player_id: str
    bid_amount_minor: int = 0  # FAB budget bid
    created_at_unix: float = field(default_factory=time.time)
    status: ClaimStatus = ClaimStatus.PENDING
    resolution_reason: Optional[str] = None


@dataclass
class WaiverTeamState:
    team_id: str
    team_name: str
    fab_balance_minor: int = 100_00  # Default 100.00 FAB
    waiver_priority_rank: int = 1  # 1 is highest priority
    roster_players: Dict[str, WaiverPlayer] = field(default_factory=dict)

    @property
    def gkp_count(self) -> int:
        return sum(1 for p in self.roster_players.values() if p.position == "GKP")

    @property
    def def_count(self) -> int:
        return sum(1 for p in self.roster_players.values() if p.position == "DEF")

    @property
    def mid_count(self) -> int:
        return sum(1 for p in self.roster_players.values() if p.position == "MID")

    @property
    def fwd_count(self) -> int:
        return sum(1 for p in self.roster_players.values() if p.position == "FWD")

    def would_swap_be_valid(self, drop_player: WaiverPlayer, add_player: WaiverPlayer) -> bool:
        """Validates that swapping drop_player for add_player maintains valid quotas."""
        if drop_player.position == add_player.position:
            return True

        # Calculate hypothetical counts
        sim_gkp = self.gkp_count - (1 if drop_player.position == "GKP" else 0) + (1 if add_player.position == "GKP" else 0)
        sim_def = self.def_count - (1 if drop_player.position == "DEF" else 0) + (1 if add_player.position == "DEF" else 0)
        sim_mid = self.mid_count - (1 if drop_player.position == "MID" else 0) + (1 if add_player.position == "MID" else 0)
        sim_fwd = self.fwd_count - (1 if drop_player.position == "FWD" else 0) + (1 if add_player.position == "FWD" else 0)

        return sim_gkp <= 2 and sim_def <= 5 and sim_mid <= 5 and sim_fwd <= 3


class WaiverWireEngine:
    """Processes weekly waiver wire blind auctions and priority claims."""

    def __init__(self, league_id: str, teams: List[WaiverTeamState], use_fab: bool = True):
        self.league_id = league_id
        self.use_fab = use_fab
        self.teams: Dict[str, WaiverTeamState] = {t.team_id: t for t in teams}
        self.waiver_pool: Dict[str, WaiverPlayer] = {}
        self.claims_queue: List[WaiverClaim] = []
        self.processed_claims_history: List[WaiverClaim] = []

    def populate_waiver_pool(self, players: List[WaiverPlayer]) -> None:
        """Adds available free agents to waiver wire."""
        for p in players:
            self.waiver_pool[p.player_id] = p

    def submit_claim(self, claim: WaiverClaim) -> WaiverClaim:
        """Submits an add/drop waiver claim to the queue."""
        if claim.team_id not in self.teams:
            raise ValueError(f"Team {claim.team_id} not registered in league")

        team = self.teams[claim.team_id]
        if claim.drop_player_id not in team.roster_players:
            raise ValueError(f"Drop player {claim.drop_player_id} is not on team roster")

        if claim.add_player_id not in self.waiver_pool:
            raise ValueError(f"Add player {claim.add_player_id} is not in waiver pool")

        if self.use_fab and claim.bid_amount_minor > team.fab_balance_minor:
            raise ValueError(f"Insufficient FAB: bid {claim.bid_amount_minor} exceeds balance {team.fab_balance_minor}")

        self.claims_queue.append(claim)
        return claim

    def _rotate_waiver_priority(self, winning_team_id: str) -> None:
        """Moves winning team to last place in rolling waiver priority."""
        winning_team = self.teams[winning_team_id]
        old_rank = winning_team.waiver_priority_rank
        max_rank = max(t.waiver_priority_rank for t in self.teams.values())

        # Shift all teams with rank > old_rank up by 1
        for t in self.teams.values():
            if t.waiver_priority_rank > old_rank:
                t.waiver_priority_rank -= 1

        winning_team.waiver_priority_rank = max_rank

    def process_clearing_cycle(self) -> List[WaiverClaim]:
        """Executes the waiver clearing cycle and resolves all pending bids."""
        if not self.claims_queue:
            return []

        # Sort claims:
        # In FAB mode: Highest bid first. On tie, lowest waiver_priority_rank (1 is top priority).
        # In Priority mode: Lowest waiver_priority_rank first.
        def sort_key(c: WaiverClaim):
            team = self.teams[c.team_id]
            if self.use_fab:
                return (-c.bid_amount_minor, team.waiver_priority_rank, c.created_at_unix)
            return (team.waiver_priority_rank, c.created_at_unix)

        sorted_claims = sorted(self.claims_queue, key=sort_key)
        self.claims_queue = []  # Clear pending queue

        for claim in sorted_claims:
            team = self.teams[claim.team_id]

            # 1. Check if add player is still available
            if claim.add_player_id not in self.waiver_pool:
                claim.status = ClaimStatus.FAILED_UNAVAILABLE
                claim.resolution_reason = "Player already awarded to another team"
                self.processed_claims_history.append(claim)
                continue

            # 2. Check if team still owns drop player
            if claim.drop_player_id not in team.roster_players:
                claim.status = ClaimStatus.FAILED_ROSTER_INVALID
                claim.resolution_reason = "Drop player no longer on team roster"
                self.processed_claims_history.append(claim)
                continue

            # 3. Check FAB budget availability (if team made other winning bids earlier in cycle)
            if self.use_fab and team.fab_balance_minor < claim.bid_amount_minor:
                claim.status = ClaimStatus.FAILED_INSUFFICIENT_FUNDS
                claim.resolution_reason = "Insufficient remaining FAB balance after earlier bids"
                self.processed_claims_history.append(claim)
                continue

            drop_p = team.roster_players[claim.drop_player_id]
            add_p = self.waiver_pool[claim.add_player_id]

            # 4. Check positional quota validity
            if not team.would_swap_be_valid(drop_p, add_p):
                claim.status = ClaimStatus.FAILED_ROSTER_INVALID
                claim.resolution_reason = f"Swap creates invalid positional roster balance ({add_p.position} limit)"
                self.processed_claims_history.append(claim)
                continue

            # Execute swap!
            if self.use_fab:
                team.fab_balance_minor -= claim.bid_amount_minor

            # Transfer players
            del team.roster_players[claim.drop_player_id]
            del self.waiver_pool[claim.add_player_id]

            team.roster_players[add_p.player_id] = add_p
            self.waiver_pool[drop_p.player_id] = drop_p

            # Rotate waiver priority to back of the line
            self._rotate_waiver_priority(team.team_id)

            claim.status = ClaimStatus.SUCCESSFUL
            claim.resolution_reason = f"Successfully acquired for {claim.bid_amount_minor / 100:.2f} FAB"
            self.processed_claims_history.append(claim)

        return self.processed_claims_history[-len(sorted_claims):]
