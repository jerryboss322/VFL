"""
Probabilistic & ratings-driven simulation engine for virtual football matches.

Design principles:
- 8-minute real-time matches (480 wall-clock seconds mapped to 90 football minutes).
- One authoritative state per match persisted in the database.
- Persistent, append-only event history.
- Club attack/defense ratings determine possession, chance creation, and goal conversion.
- Recovery after application restarts by replaying committed events.
- Automatic bet settlement trigger upon full-time completion.
"""

import random
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.match_event import MatchEvent
from app.models.match_state import MatchState
from app.services.betting import auto_settle_fixture_bets
from app.services.odds_engine import compute_expected_goals

MATCH_DURATION_SECONDS = settings.MATCH_DURATION_SECONDS  # 480


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clock_to_football_minute(clock_seconds: int) -> int:
    if clock_seconds <= 0:
        return 0
    if clock_seconds >= MATCH_DURATION_SECONDS:
        return 90
    return max(1, min(90, round((clock_seconds / MATCH_DURATION_SECONDS) * 90)))


_CHANCE_COMMENTARY = [
    "{club} threads a pass into the box — keeper parries it wide!",
    "Sharp counter-attack from {club}, shot fizzes just over the crossbar.",
    "{club} wins a dangerous corner after sustained pressure.",
    "Curling effort from {club} clips the outside of the post!",
    "{club} breaks through the midfield line and tests the goalkeeper.",
]

_GOAL_COMMENTARY = [
    "GOAL! {club} finishes clinically into the bottom corner!",
    "GOAL! Brilliant header from {club} off a whipped cross!",
    "GOAL! {club} slots it home after a rapid counter-attack!",
    "GOAL! Unstoppable strike from the edge of the area by {club}!",
]

_CARD_COMMENTARY = [
    "Yellow card shown to {club} for a tactical foul in midfield.",
    "Booking for {club} after a late challenge on the wing.",
    "Referee cautions {club} for breaking up a promising attack.",
]

# 15 timeline slots across the 480-second match (kickoff at 0, early action at 3 & 7,
# followed by 11 intervals across both halves, and full_time at 480).
_TIMELINE_SLOTS = [0, 3, 7, 36, 72, 115, 160, 205, 240, 285, 330, 375, 415, 455, 480]


def _generate_match_events(
    fixture_id: str,
    home_club: Club,
    away_club: Club,
    rng: random.Random,
) -> list[dict[str, Any]]:
    """Generate a deterministic, ratings-weighted 15-event sequence for a match."""
    events: list[dict[str, Any]] = []

    h_att = getattr(home_club, "attack_rating", 1.0) or 1.0
    h_def = getattr(home_club, "defense_rating", 1.0) or 1.0
    a_att = getattr(away_club, "attack_rating", 1.0) or 1.0
    a_def = getattr(away_club, "defense_rating", 1.0) or 1.0

    lam_home, lam_away = compute_expected_goals(h_att, h_def, a_att, a_def)
    total_lam = lam_home + lam_away
    home_prob = lam_home / total_lam if total_lam > 0 else 0.53

    # Expected conversion rate per action slot so total match goals reflect Poisson lambda
    goal_prob = min(0.45, max(0.18, (total_lam - 1.0) / 11.0))

    for seq, tick in enumerate(_TIMELINE_SLOTS, start=1):
        display_min = _clock_to_football_minute(tick)

        if tick == 0:
            events.append(
                {
                    "fixture_id": fixture_id,
                    "event_seq": seq,
                    "event_type": "kickoff",
                    "minute": 0,
                    "club_id": None,
                    "text": f"Kick-off: {home_club.name} vs {away_club.name}",
                    "payload": {"side": None, "club_id": None, "display_minute": 1},
                }
            )
            continue

        if tick == MATCH_DURATION_SECONDS:
            events.append(
                {
                    "fixture_id": fixture_id,
                    "event_seq": seq,
                    "event_type": "full_time",
                    "minute": MATCH_DURATION_SECONDS,
                    "club_id": None,
                    "text": "Full time whistle blown.",
                    "payload": {"side": None, "club_id": None, "display_minute": 90},
                }
            )
            continue

        is_home = rng.random() < home_prob
        side = "home" if is_home else "away"
        club = home_club if is_home else away_club
        club_id = str(club.id)
        club_name = club.name

        # Slot at tick=7 is a guaranteed early goal breakthrough; other slots roll probabilistically
        if tick == 7:
            event_type = "goal"
        else:
            roll = rng.random()
            if roll < goal_prob:
                event_type = "goal"
            elif roll < goal_prob + 0.25:
                event_type = "card"
            else:
                event_type = "chance"

        if event_type == "goal":
            template = rng.choice(_GOAL_COMMENTARY)
        elif event_type == "card":
            template = rng.choice(_CARD_COMMENTARY)
        else:
            template = rng.choice(_CHANCE_COMMENTARY)

        text = template.format(club=club_name)

        events.append(
            {
                "fixture_id": fixture_id,
                "event_seq": seq,
                "event_type": event_type,
                "minute": tick,
                "club_id": club_id,
                "text": text,
                "payload": {
                    "side": side,
                    "club_id": club_id,
                    "display_minute": display_min,
                },
            }
        )

    return events


class MatchEngine:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def initialize_match(
        self,
        fixture: Fixture,
        home_club: Club,
        away_club: Club,
        seed: str | None = None,
    ) -> MatchState:
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fixture.id)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing

        rng = random.Random(seed or str(fixture.id))

        match_state = MatchState(
            fixture_id=fixture.id,
            status="upcoming",
            clock_seconds=0,
            home_goals=0,
            away_goals=0,
            current_events=[],
            event_version=0,
        )
        self.session.add(match_state)
        await self.session.flush()

        events = _generate_match_events(str(fixture.id), home_club, away_club, rng)

        for ev in events:
            event = MatchEvent(
                fixture_id=fixture.id,
                event_seq=ev["event_seq"],
                event_type=ev["event_type"],
                minute=ev["minute"],
                club_id=ev["club_id"],
                text=ev["text"],
                payload=ev["payload"],
            )
            self.session.add(event)

        await self.session.commit()
        await self.session.refresh(match_state)
        return match_state

    async def start_match(self, fixture: Fixture) -> MatchState:
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fixture.id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            raise ValueError(f"No match state for fixture {fixture.id}")
        if state.status != "upcoming":
            raise ValueError(f"Match {fixture.id} is already {state.status}")

        state.status = "live"
        state.clock_seconds = 0
        state.event_version += 1

        fixture.status = "live"
        fixture.clock_seconds = 0
        fixture.home_goals = 0
        fixture.away_goals = 0

        kickoff = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fixture.id)
            .where(MatchEvent.event_type == "kickoff")
            .order_by(MatchEvent.event_seq)
            .limit(1)
        )
        ko = kickoff.scalar_one_or_none()
        if ko:
            state.current_events = [
                {
                    "event_seq": ko.event_seq,
                    "event_type": ko.event_type,
                    "minute": ko.minute,
                    "club_id": str(ko.club_id) if ko.club_id else None,
                    "text": ko.text,
                    "payload": ko.payload,
                }
            ]

        await self.session.commit()
        await self.session.refresh(state)
        return state

    async def advance_tick(
        self, fixture: Fixture, seconds_elapsed: int
    ) -> MatchState:
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fixture.id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            raise ValueError(f"No match state for fixture {fixture.id}")
        if state.status != "live":
            raise ValueError(f"Match {fixture.id} is not live (status={state.status})")

        clock = min(seconds_elapsed, MATCH_DURATION_SECONDS)
        state.clock_seconds = clock

        last_seq = 0
        if state.current_events:
            last_seq = max(e["event_seq"] for e in state.current_events)

        due_events = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fixture.id)
            .where(MatchEvent.minute > 0)
            .where(MatchEvent.minute <= clock)
            .where(MatchEvent.event_seq > last_seq)
            .order_by(MatchEvent.event_seq)
        )
        new_events = due_events.scalars().all()

        if new_events:
            current = list(state.current_events or [])
            for ev in new_events:
                current.append(
                    {
                        "event_seq": ev.event_seq,
                        "event_type": ev.event_type,
                        "minute": ev.minute,
                        "club_id": str(ev.club_id) if ev.club_id else None,
                        "text": ev.text,
                        "payload": ev.payload,
                    }
                )
                if ev.event_type == "goal" and ev.payload:
                    side = ev.payload.get("side")
                    if side == "home":
                        state.home_goals += 1
                    elif side == "away":
                        state.away_goals += 1
            state.current_events = current
            state.event_version += 1

        just_completed = False
        if clock >= MATCH_DURATION_SECONDS and state.status == "live":
            state.status = "completed"
            just_completed = True
            ft = await self.session.execute(
                select(MatchEvent)
                .where(MatchEvent.fixture_id == fixture.id)
                .where(MatchEvent.event_type == "full_time")
                .limit(1)
            )
            ft_ev = ft.scalar_one_or_none()
            if ft_ev and not any(
                e["event_seq"] == ft_ev.event_seq for e in state.current_events
            ):
                current = list(state.current_events or [])
                current.append(
                    {
                        "event_seq": ft_ev.event_seq,
                        "event_type": ft_ev.event_type,
                        "minute": ft_ev.minute,
                        "club_id": str(ft_ev.club_id) if ft_ev.club_id else None,
                        "text": ft_ev.text,
                        "payload": ft_ev.payload,
                    }
                )
                state.current_events = current

        fixture.status = state.status
        fixture.home_goals = state.home_goals
        fixture.away_goals = state.away_goals
        fixture.clock_seconds = state.clock_seconds

        await self.session.commit()
        await self.session.refresh(state)

        if just_completed:
            await auto_settle_fixture_bets(self.session, fixture)

        return state

    async def get_state(self, fixture_id) -> MatchState | None:
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fixture_id)
        )
        return result.scalar_one_or_none()

    async def get_events(self, fixture_id) -> list[MatchEvent]:
        result = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fixture_id)
            .order_by(MatchEvent.event_seq)
        )
        return result.scalars().all()

    async def recover_after_restart(self, fixture_id) -> MatchState | None:
        state = await self.get_state(fixture_id)
        if state is None:
            return None

        events = await self.get_events(fixture_id)

        current: list[dict[str, Any]] = []
        home_goals = 0
        away_goals = 0

        for ev in events:
            if ev.minute <= state.clock_seconds:
                current.append(
                    {
                        "event_seq": ev.event_seq,
                        "event_type": ev.event_type,
                        "minute": ev.minute,
                        "club_id": str(ev.club_id) if ev.club_id else None,
                        "text": ev.text,
                        "payload": ev.payload,
                    }
                )
                if ev.event_type == "goal" and ev.payload:
                    side = ev.payload.get("side")
                    if side == "home":
                        home_goals += 1
                    elif side == "away":
                        away_goals += 1

        state.current_events = current
        state.home_goals = home_goals
        state.away_goals = away_goals

        result = await self.session.execute(
            select(Fixture).where(Fixture.id == fixture_id)
        )
        fixture = result.scalar_one_or_none()
        if fixture:
            fixture.status = state.status
            fixture.home_goals = home_goals
            fixture.away_goals = away_goals
            fixture.clock_seconds = state.clock_seconds

        await self.session.commit()
        return state
