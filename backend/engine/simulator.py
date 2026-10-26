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

import math
import random
from datetime import datetime, timezone
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.match_event import MatchEvent
from app.models.match_state import MatchState
from app.models.odds import OddsSnapshot
from app.services.betting import auto_settle_fixture_bets
from app.services.odds_engine import compute_expected_goals, generate_fixture_markets

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
    "WOODWORK! Stunning effort from {club} rattles the crossbar!",
    "Sensational reflex save! Goalkeeper denies {club} from point-blank range!",
    "Vital goal-line clearance saves {club} from conceding!",
    "Glancing header from {club} flashes inches wide of the upright!",
    "Goalkeeper off their line to bravely smother the chance at the feet of {club}!",
]

_GOAL_COMMENTARY = [
    "GOAL! {club} finishes clinically into the bottom corner!",
    "GOAL! Brilliant header from {club} off a whipped cross!",
    "GOAL! {club} slots it home after a rapid counter-attack!",
    "GOAL! Unstoppable 25-yard screamer into the top corner from {club}!",
    "GOAL! {club} converts from the penalty spot under immense pressure!",
    "GOAL! Stunning volley off the underside of the crossbar for {club}!",
    "GOAL! Poacher's instinct from {club} pouncing on a loose ball in the box!",
]

_LATE_GOAL_COMMENTARY = [
    "DRAMA! Late equalizer in the dying seconds for {club}! Absolute pandemonium!",
    "LAST-GASP WINNER! {club} snatches victory in stoppage time! Incredible scenes!",
    "STUNNER! Heartbreaking late goal from {club} in the 90th minute!",
]

_YELLOW_CARD_COMMENTARY = [
    "Yellow card shown to {club} for a tactical foul in midfield.",
    "Booking for {club} after a late challenge breaking up a counter-attack.",
    "Referee cautions {club} for breaking up a promising attack.",
    "Yellow card for {club} for persistent simulation in the penalty area.",
]

_RED_CARD_COMMENTARY = [
    "RED CARD! Reckless two-footed lunge — straight red shown to {club}!",
    "SECOND YELLOW! {club} player receives marching orders! Down to 10 men!",
    "RED CARD! Professional foul denying an obvious goalscoring chance — {club} reduced to 10!",
]

# 15 timeline slots across the 480-second match (kickoff at 0, early action at 3 & 7,
# followed by 11 intervals across both halves, and full_time at 480).
_TIMELINE_SLOTS = [0, 3, 7, 36, 72, 115, 160, 205, 240, 285, 330, 375, 415, 455, 480]


def _sample_poisson(lam: float, rng: random.Random) -> int:
    """Knuth's Poisson random variable generator."""
    L = math.exp(-max(0.1, lam))
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= rng.random()
    return max(0, k - 1)


def _generate_match_events(
    fixture_id: str,
    home_club: Club,
    away_club: Club,
    rng: random.Random,
) -> list[dict[str, Any]]:
    """Generate a deterministic sequence with authentic unpredictability: matchday form swings,
    underdog upset surges, red cards, dramatic comebacks, and late stoppage-time winners."""
    events: list[dict[str, Any]] = []

    h_att = getattr(home_club, "attack_rating", 1.0) or 1.0
    h_def = getattr(home_club, "defense_rating", 1.0) or 1.0
    a_att = getattr(away_club, "attack_rating", 1.0) or 1.0
    a_def = getattr(away_club, "defense_rating", 1.0) or 1.0

    # 1. Stochastic Matchday Form Volatility (tactical variance, condition, match adrenaline)
    h_form = rng.gauss(1.0, 0.20)
    a_form = rng.gauss(1.0, 0.20)

    # 2. Giant-Killing & Underdog Upset Surge Factor:
    # If one club is a substantial favorite, the underdog has a fierce upset surge chance (~22%)
    # while the favorite risks complacency or squad fatigue (~18%).
    rating_diff = (h_att + h_def) - (a_att + a_def)
    if rating_diff > 0.25:
        if rng.random() < 0.22:
            a_form *= 1.30  # Inspired underdog away surge
        if rng.random() < 0.18:
            h_form *= 0.82  # Favorite home complacency
    elif rating_diff < -0.25:
        if rng.random() < 0.25:
            h_form *= 1.32  # Inspired underdog home surge with crowd roar
        if rng.random() < 0.18:
            a_form *= 0.82  # Favorite away complacency

    h_form = max(0.60, min(1.50, h_form))
    a_form = max(0.60, min(1.50, a_form))

    eff_h_att = h_att * h_form
    eff_h_def = h_def * h_form
    eff_a_att = a_att * a_form
    eff_a_def = a_def * a_form

    # 3. Baseline Expected Goals derived from effective form
    lam_home, lam_away = compute_expected_goals(eff_h_att, eff_h_def, eff_a_att, eff_a_def)
    # Ensure realistic goal scoring (3+ goals is exciting, not trivially common)
    lam_home = min(2.10, max(0.25, lam_home * 0.90))
    lam_away = min(1.95, max(0.20, lam_away * 0.90))

    # Sample initial target goals
    home_goals_target = min(4, _sample_poisson(lam_home, rng))
    away_goals_target = min(4, _sample_poisson(lam_away, rng))

    # 4. Realistic Red Card Dynamics (~8% match probability)
    has_red_card = rng.random() < 0.08
    red_side: str | None = None
    red_tick: int | None = None
    if has_red_card:
        candidate_ticks = [36, 72, 115, 160, 205, 285, 330, 375]
        red_tick = rng.choice(candidate_ticks)
        if lam_home > lam_away:
            red_side = "away" if rng.random() < 0.60 else "home"
        else:
            red_side = "home" if rng.random() < 0.60 else "away"

        # 10-man handicap: opposing team has 40% chance of a bonus goal
        if red_side == "home" and away_goals_target < 4 and rng.random() < 0.40:
            away_goals_target += 1
        elif red_side == "away" and home_goals_target < 4 and rng.random() < 0.40:
            home_goals_target += 1

    action_ticks = [t for t in _TIMELINE_SLOTS if t not in (0, 240, MATCH_DURATION_SECONDS)]
    avail_goal_ticks = [t for t in action_ticks if t != red_tick]

    total_goals = min(len(avail_goal_ticks), home_goals_target + away_goals_target)
    goal_ticks: list[int] = []
    if total_goals > 0:
        goal_ticks = rng.sample(avail_goal_ticks, total_goals)

    rng.shuffle(goal_ticks)
    home_goal_ticks = set(goal_ticks[:home_goals_target])
    away_goal_ticks = set(goal_ticks[home_goals_target:home_goals_target + away_goals_target])

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

        if tick == 240:
            events.append(
                {
                    "fixture_id": fixture_id,
                    "event_seq": seq,
                    "event_type": "half_time",
                    "minute": 240,
                    "club_id": None,
                    "text": "Half-time whistle blown (45'). 10-second interval.",
                    "payload": {
                        "side": None,
                        "club_id": None,
                        "display_minute": 45,
                        "is_halftime": True,
                        "break_seconds": 10,
                    },
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

        is_red = (tick == red_tick)
        if is_red:
            event_type = "card"
            side = red_side
            club = home_club if side == "home" else away_club
            template = rng.choice(_RED_CARD_COMMENTARY)
        elif tick in home_goal_ticks:
            event_type = "goal"
            side = "home"
            club = home_club
            template = rng.choice(_LATE_GOAL_COMMENTARY) if tick >= 415 else rng.choice(_GOAL_COMMENTARY)
        elif tick in away_goal_ticks:
            event_type = "goal"
            side = "away"
            club = away_club
            template = rng.choice(_LATE_GOAL_COMMENTARY) if tick >= 415 else rng.choice(_GOAL_COMMENTARY)
        else:
            # Check 10-man penalty if a red card was already issued
            if has_red_card and red_tick and tick > red_tick:
                # The team with 11 men dominates possession (~75%)
                is_home = (red_side != "home") if rng.random() < 0.75 else (red_side == "home")
            else:
                prob = eff_h_att / (eff_h_att + eff_a_att) if (eff_h_att + eff_a_att) > 0 else 0.52
                is_home = rng.random() < prob

            side = "home" if is_home else "away"
            club = home_club if is_home else away_club
            # 20% yellow card chance, 80% goal chance / keeper save / woodwork
            if rng.random() < 0.20:
                event_type = "card"
                template = rng.choice(_YELLOW_CARD_COMMENTARY)
            else:
                event_type = "chance"
                template = rng.choice(_CHANCE_COMMENTARY)

        club_id = str(club.id)
        club_name = club.name
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
                    "is_red": is_red,
                },
            }
        )

    return events

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
        fx_id = fixture.id if isinstance(fixture.id, uuid.UUID) else uuid.UUID(str(fixture.id))
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fx_id)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing

        rng = random.Random(seed or str(fx_id))

        try:
            async with self.session.begin_nested():
                match_state = MatchState(
                    fixture_id=fx_id,
                    status="upcoming",
                    clock_seconds=0,
                    home_goals=0,
                    away_goals=0,
                    current_events=[],
                    event_version=0,
                )
                self.session.add(match_state)
                await self.session.flush()

                events = _generate_match_events(str(fx_id), home_club, away_club, rng)

                for ev in events:
                    c_id = ev.get("club_id")
                    if c_id and not isinstance(c_id, uuid.UUID):
                        try:
                            c_id = uuid.UUID(str(c_id))
                        except Exception:
                            c_id = None
                    event = MatchEvent(
                        fixture_id=fx_id,
                        event_seq=ev["event_seq"],
                        event_type=ev["event_type"],
                        minute=ev["minute"],
                        club_id=c_id,
                        text=ev["text"],
                        payload=ev["payload"],
                    )
                    self.session.add(event)

                await self.session.flush()
            return match_state
        except Exception:
            # If concurrent initialize_match happened, roll back savepoint and return existing state
            result = await self.session.execute(
                select(MatchState).where(MatchState.fixture_id == fx_id)
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                return existing
            raise

    async def start_match(self, fixture: Fixture) -> MatchState:
        fx_id = fixture.id if isinstance(fixture.id, uuid.UUID) else uuid.UUID(str(fixture.id))
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fx_id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            home = fixture.home_club or await self.session.get(Club, fixture.home_club_id)
            away = fixture.away_club or await self.session.get(Club, fixture.away_club_id)
            state = await self.initialize_match(fixture, home, away)

        if state.status == "live":
            if fixture.status != "live":
                fixture.status = "live"
            return state

        if state.status == "completed":
            if fixture.status != "completed":
                fixture.status = "completed"
            return state

        state.status = "live"
        state.clock_seconds = 0
        state.event_version += 1

        fixture.status = "live"
        fixture.clock_seconds = 0
        fixture.home_goals = 0
        fixture.away_goals = 0

        kickoff = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fx_id)
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

        return state

    async def advance_tick(
        self, fixture: Fixture, seconds_elapsed: int
    ) -> MatchState:
        fx_id = fixture.id if isinstance(fixture.id, uuid.UUID) else uuid.UUID(str(fixture.id))
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fx_id)
        )
        state = result.scalar_one_or_none()
        if state is None:
            home = fixture.home_club or await self.session.get(Club, fixture.home_club_id)
            away = fixture.away_club or await self.session.get(Club, fixture.away_club_id)
            state = await self.initialize_match(fixture, home, away)
            state = await self.start_match(fixture)

        if state.status == "completed":
            if fixture.status != "completed":
                fixture.status = "completed"
            return state

        if state.status == "upcoming":
            state = await self.start_match(fixture)

        clock = max(0, min(seconds_elapsed, MATCH_DURATION_SECONDS))
        state.clock_seconds = clock

        last_seq = 0
        if state.current_events:
            last_seq = max((e.get("event_seq", 0) for e in state.current_events), default=0)

        due_events = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fx_id)
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
                .where(MatchEvent.fixture_id == fx_id)
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

        # Update in-play live odds dynamically based on current score & clock progression
        if state.status == "live":
            odds_res = await self.session.execute(
                select(OddsSnapshot)
                .where(OddsSnapshot.fixture_id == fixture.id)
                .where(OddsSnapshot.is_active == True)
                .order_by(OddsSnapshot.version.desc())
                .limit(1)
            )
            odds_snap = odds_res.scalar_one_or_none()
            if odds_snap is not None:
                new_ver = odds_snap.version + 1
                home_club = fixture.home_club or await self.session.get(Club, fixture.home_club_id)
                away_club = fixture.away_club or await self.session.get(Club, fixture.away_club_id)
                ht_h = 0
                ht_a = 0
                for ev in (state.current_events or []):
                    if ev.get("event_type") == "goal":
                        m = ev.get("minute", 0)
                        if m <= 240:
                            side = (ev.get("payload") or {}).get("side")
                            if side == "home":
                                ht_h += 1
                            elif side == "away":
                                ht_a += 1
                odds_snap.markets = generate_fixture_markets(
                    fixture_id=fixture.id,
                    home_name=home_club.name if home_club else "Home",
                    away_name=away_club.name if away_club else "Away",
                    home_attack=home_club.attack_rating if home_club else 1.0,
                    home_defense=home_club.defense_rating if home_club else 1.0,
                    away_attack=away_club.attack_rating if away_club else 1.0,
                    away_defense=away_club.defense_rating if away_club else 1.0,
                    version=new_ver,
                    suspended=False,
                    current_home_goals=state.home_goals,
                    current_away_goals=state.away_goals,
                    elapsed_seconds=clock,
                    match_duration_seconds=MATCH_DURATION_SECONDS,
                    is_live=True,
                    ht_home_goals=ht_h,
                    ht_away_goals=ht_a,
                )
                odds_snap.version = new_ver
        elif state.status == "completed":
            odds_res = await self.session.execute(
                select(OddsSnapshot)
                .where(OddsSnapshot.fixture_id == fixture.id)
                .where(OddsSnapshot.is_active == True)
                .order_by(OddsSnapshot.version.desc())
                .limit(1)
            )
            odds_snap = odds_res.scalar_one_or_none()
            if odds_snap is not None and odds_snap.markets:
                for m in odds_snap.markets:
                    for o in m.get("options", []):
                        o["suspended"] = True

        # Check early condition settlement for in-play bets (Over/Under, BTTS) and full-time settlement
        if state.status == "live" or just_completed:
            try:
                await auto_settle_fixture_bets(self.session, fixture)
            except Exception as e:
                import logging
                logging.exception("Error settling bets for fixture %s: %s", fixture.id, e)

        return state

    async def get_state(self, fixture_id) -> MatchState | None:
        fx_id = fixture_id if isinstance(fixture_id, uuid.UUID) else uuid.UUID(str(fixture_id))
        result = await self.session.execute(
            select(MatchState).where(MatchState.fixture_id == fx_id)
        )
        return result.scalar_one_or_none()

    async def get_events(self, fixture_id) -> list[MatchEvent]:
        fx_id = fixture_id if isinstance(fixture_id, uuid.UUID) else uuid.UUID(str(fixture_id))
        result = await self.session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fx_id)
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
