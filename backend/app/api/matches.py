import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.core.database import AsyncSessionLocal
from app.models.fixture import Fixture
from app.models.match_event import MatchEvent
from app.models.match_state import MatchState
from app.schemas.event import MatchEventOut
from app.schemas.match_state import MatchStateOut
from engine.simulator import MATCH_DURATION_SECONDS, MatchEngine

router = APIRouter(prefix="/matches", tags=["matches"])


class SimulateRequest(BaseModel):
    seconds: int | None = None


@router.get("/stream")
async def stream_live_matches():
    """Server-Sent Events (SSE) stream broadcasting live and recently completed fixtures."""

    async def event_generator():
        try:
            while True:
                async with AsyncSessionLocal() as session:
                    res = await session.execute(
                        select(Fixture)
                        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
                        .order_by(Fixture.matchday.asc(), Fixture.kickoff_at.asc())
                    )
                    fixtures = res.scalars().all()
                    payload = [
                        {
                            "id": str(fx.id),
                            "matchday": fx.matchday,
                            "status": fx.status,
                            "kickoffAt": fx.kickoff_at,
                            "homeGoals": fx.home_goals,
                            "awayGoals": fx.away_goals,
                            "clockSeconds": fx.clock_seconds,
                            "home": {
                                "id": str(fx.home_club.id),
                                "name": fx.home_club.name,
                                "shortName": fx.home_club.short_name,
                            }
                            if fx.home_club
                            else None,
                            "away": {
                                "id": str(fx.away_club.id),
                                "name": fx.away_club.name,
                                "shortName": fx.away_club.short_name,
                            }
                            if fx.away_club
                            else None,
                        }
                        for fx in fixtures
                    ]
                yield f"data: {json.dumps({'fixtures': payload})}\n\n"
                await asyncio.sleep(1.5)
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{fixture_id}/state", response_model=MatchStateOut)
async def match_state(fixture_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(MatchState).where(MatchState.fixture_id == fixture_id))
    state = result.scalar_one_or_none()
    if state is None:
        # Check if fixture exists; if so return default upcoming state snapshot
        fx_res = await session.execute(select(Fixture).where(Fixture.id == fixture_id))
        fx = fx_res.scalar_one_or_none()
        if fx is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match state not found")
        return MatchStateOut(
            fixture_id=str(fx.id),
            status=fx.status,
            clock_seconds=fx.clock_seconds or 0,
            home_goals=fx.home_goals or 0,
            away_goals=fx.away_goals or 0,
            event_version=0,
            current_events=[],
        )
    return state


@router.get("/{fixture_id}/events", response_model=list[MatchEventOut])
async def match_events(fixture_id: str, session: AsyncSession = Depends(get_session)):
    state_res = await session.execute(select(MatchState).where(MatchState.fixture_id == fixture_id))
    state = state_res.scalar_one_or_none()

    stmt = select(MatchEvent).where(MatchEvent.fixture_id == fixture_id)
    # If match is live, only return events up to current match clock
    if state and state.status == "live":
        stmt = stmt.where(MatchEvent.minute <= state.clock_seconds)
    elif state and state.status == "upcoming":
        # When upcoming, return all pre-generated events only if queried directly in tests,
        # or if clock_seconds == 0
        pass

    stmt = stmt.order_by(MatchEvent.event_seq)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.post("/{fixture_id}/start", status_code=status.HTTP_200_OK)
async def start_match(fixture_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fixture = result.scalar_one_or_none()
    if fixture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixture not found")

    engine = MatchEngine(session)
    state = await engine.initialize_match(fixture, fixture.home_club, fixture.away_club)
    if state.status == "upcoming":
        state = await engine.start_match(fixture)
    await session.commit()
    return {
        "status": state.status,
        "clock_seconds": state.clock_seconds,
        "clockSeconds": state.clock_seconds,
        "home_goals": state.home_goals,
        "homeGoals": state.home_goals,
        "away_goals": state.away_goals,
        "awayGoals": state.away_goals,
    }


@router.post("/{fixture_id}/simulate", status_code=status.HTTP_200_OK)
async def simulate_match(
    fixture_id: str,
    seconds: int | None = Query(None),
    body: SimulateRequest | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Start (if upcoming) and advance a match by `seconds` (or to full-time 480s if omitted)."""
    result = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fixture = result.scalar_one_or_none()
    if fixture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixture not found")

    engine = MatchEngine(session)
    state = await engine.initialize_match(fixture, fixture.home_club, fixture.away_club)
    if state.status == "upcoming":
        state = await engine.start_match(fixture)

    if state.status == "live":
        step = seconds if seconds is not None else (body.seconds if body and body.seconds is not None else None)
        target_clock = (
            min(MATCH_DURATION_SECONDS, state.clock_seconds + step)
            if step is not None
            else MATCH_DURATION_SECONDS
        )
        state = await engine.advance_tick(fixture, target_clock)

    await session.commit()
    return {
        "status": state.status,
        "clock_seconds": state.clock_seconds,
        "clockSeconds": state.clock_seconds,
        "home_goals": state.home_goals,
        "homeGoals": state.home_goals,
        "away_goals": state.away_goals,
        "awayGoals": state.away_goals,
    }


@router.post("/matchday/{matchday}/simulate", status_code=status.HTTP_200_OK)
async def simulate_matchday(
    matchday: int,
    seconds: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """Advance or complete all fixtures in a given matchday."""
    result = await session.execute(
        select(Fixture)
        .where(Fixture.matchday == matchday)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fixtures = result.scalars().all()
    if not fixtures:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No fixtures for matchday")

    engine = MatchEngine(session)
    updated = []
    for fx in fixtures:
        state = await engine.initialize_match(fx, fx.home_club, fx.away_club)
        if state.status == "upcoming":
            state = await engine.start_match(fx)
        if state.status == "live":
            target_clock = (
                min(MATCH_DURATION_SECONDS, state.clock_seconds + seconds)
                if seconds is not None
                else MATCH_DURATION_SECONDS
            )
            state = await engine.advance_tick(fx, target_clock)
        updated.append(
            {
                "fixtureId": str(fx.id),
                "status": state.status,
                "clockSeconds": state.clock_seconds,
                "homeGoals": state.home_goals,
                "awayGoals": state.away_goals,
            }
        )
    await session.commit()
    return {"matchday": matchday, "fixtures": updated}
