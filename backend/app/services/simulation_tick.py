"""Stateless simulation tick.

Advances the persistent football world based on wall-clock time, so it can be
driven either by the local always-on background loop (every second) or by a
Vercel Cron invocation (e.g. once a minute) and always converge to the same state.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.fixture import Fixture
from engine.simulator import MATCH_DURATION_SECONDS, MatchEngine


def _parse_iso(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


async def run_simulation_tick() -> dict:
    """Bring live matches up to date with the wall clock, kick off due matchdays,
    and schedule the next matchday after one completes. Idempotent."""
    if settings.SIMULATION_PAUSED:
        return {"paused": True}

    pre_match = getattr(settings, "PRE_MATCH_BREAK_SECONDS", 240)
    now = datetime.now(timezone.utc)
    advanced = kicked_off = 0

    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(Fixture)
            .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
            .order_by(Fixture.matchday.asc(), Fixture.created_at.asc())
        )
        fixtures = res.scalars().all()
        if not fixtures:
            return {"advanced": 0, "kickedOff": 0}

        engine = MatchEngine(session)

        # 1. Kick off the next matchday if its kickoff time has passed and nothing is live
        live = [f for f in fixtures if f.status == "live"]
        upcoming = [f for f in fixtures if f.status == "upcoming"]
        if not live and upcoming:
            next_md = min(f.matchday for f in upcoming)
            md_fx = [f for f in upcoming if f.matchday == next_md]
            if now >= min(_parse_iso(f.kickoff_at) for f in md_fx):
                for fx in md_fx:
                    state = await engine.initialize_match(fx, fx.home_club, fx.away_club)
                    if state.status == "upcoming":
                        await engine.start_match(fx)
                        kicked_off += 1
                live = md_fx

        # 2. Advance every live match to the clock implied by elapsed wall time
        finished_at: datetime | None = None
        for fx in live:
            if fx.status != "live":
                continue
            state = await engine.get_state(fx.id)
            if state is None:
                await engine.initialize_match(fx, fx.home_club, fx.away_club)
                state = await engine.start_match(fx)
            started = _parse_iso(fx.kickoff_at)
            elapsed = int((now - started).total_seconds()) * settings.SIMULATION_SPEED_MULTIPLIER
            target = max(state.clock_seconds + 1, min(MATCH_DURATION_SECONDS, elapsed))
            new_state = await engine.advance_tick(fx, min(MATCH_DURATION_SECONDS, target))
            advanced += 1
            if new_state.status == "completed":
                finished_at = started + timedelta(
                    seconds=MATCH_DURATION_SECONDS / max(1, settings.SIMULATION_SPEED_MULTIPLIER)
                )

        # 3. Once the whole matchday is done, schedule the following matchdays
        if finished_at is not None and not any(f.status == "live" for f in live):
            remaining = [f for f in fixtures if f.status == "upcoming"]
            if remaining:
                base = max(finished_at, now - timedelta(seconds=pre_match))
                next_md = min(f.matchday for f in remaining)
                for f in remaining:
                    offset = f.matchday - next_md
                    f.kickoff_at = (
                        base
                        + timedelta(seconds=pre_match + offset * (MATCH_DURATION_SECONDS + pre_match))
                    ).isoformat()
                await session.commit()

    return {"advanced": advanced, "kickedOff": kicked_off}
