"""Match engine tests: progression, recovery, duplicate-event prevention, HTTP endpoints, auto-settlement."""

import uuid
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bet import Bet
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.match_event import MatchEvent
from app.models.user import User
from app.schemas.bet import BetSelectionIn, PlaceBetRequest
from app.services.betting import place_bet
from engine.simulator import MatchEngine
from tests.conftest import seed_match_data


async def _start_match(session: AsyncSession, fixture_id):
    result = await session.execute(select(Fixture).where(Fixture.id == fixture_id))
    fixture = result.scalar_one()
    home = await session.get(Club, fixture.home_club_id)
    away = await session.get(Club, fixture.away_club_id)
    engine = MatchEngine(session)
    state = await engine.initialize_match(fixture, home, away)
    state = await engine.start_match(fixture)
    return state, fixture


async def test_initialize_match_creates_state_and_events(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()
    home = await db_session.get(Club, fixture.home_club_id)
    away = await db_session.get(Club, fixture.away_club_id)

    engine = MatchEngine(db_session)
    state = await engine.initialize_match(fixture, home, away)

    assert state.status == "upcoming"
    assert state.clock_seconds == 0
    assert state.home_goals == 0
    assert state.away_goals == 0

    ev_result = await db_session.execute(
        select(MatchEvent).where(MatchEvent.fixture_id == fixture.id).order_by(MatchEvent.event_seq)
    )
    events = ev_result.scalars().all()
    assert len(events) == 15
    assert events[0].event_type == "kickoff"
    assert events[-1].event_type == "full_time"


async def test_initialize_match_idempotent(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)

    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()
    home = await db_session.get(Club, fixture.home_club_id)
    away = await db_session.get(Club, fixture.away_club_id)

    engine = MatchEngine(db_session)
    state1 = await engine.initialize_match(fixture, home, away)
    state2 = await engine.initialize_match(fixture, home, away)
    assert state1.id == state2.id


async def test_start_match_sets_live(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    state, _ = await _start_match(db_session, data["fixture_id"])
    assert state.status == "live"
    assert state.clock_seconds == 0


async def test_start_match_already_live_raises(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    await _start_match(db_session, data["fixture_id"])

    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    engine = MatchEngine(db_session)
    try:
        await engine.start_match(fixture)
        pytest.fail("Expected ValueError for already-live match")
    except ValueError as e:
        assert "already live" in str(e)


async def test_match_progression_advances_clock(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    state, fixture = await _start_match(db_session, data["fixture_id"])
    engine = MatchEngine(db_session)

    state = await engine.advance_tick(fixture, 7)
    assert state.status == "live"
    assert state.clock_seconds == 7
    assert state.home_goals + state.away_goals >= 1


async def test_full_time_completes_match_and_auto_settles_bets(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()
    result = await db_session.execute(select(Fixture).where(Fixture.id == data["fixture_id"]))
    fixture = result.scalar_one()

    # Place a bet before kickoff
    bet_dict = await place_bet(
        db_session,
        user,
        fixture,
        PlaceBetRequest(
            selections=[BetSelectionIn(odds_id="home_win", version=1)],
            stake_minor=5000,
            idempotency_key="auto-settle-test",
        ),
    )
    assert bet_dict["status"] == "pending"

    state, fixture = await _start_match(db_session, data["fixture_id"])
    engine = MatchEngine(db_session)

    state = await engine.advance_tick(fixture, 480)
    assert state.status == "completed"

    # Bet should now be automatically settled as won or lost
    bet_res = await db_session.execute(select(Bet).where(Bet.id == uuid.UUID(bet_dict["id"])))
    settled_bet = bet_res.scalar_one()
    expected_status = "won" if state.home_goals > state.away_goals else "lost"
    assert settled_bet.status == expected_status


async def test_match_http_start_and_simulate_endpoints(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    fid = str(data["fixture_id"])

    start_resp = await client.post(f"/matches/{fid}/start")
    assert start_resp.status_code == 200, start_resp.text
    assert start_resp.json()["status"] == "live"

    sim_resp = await client.post(f"/matches/{fid}/simulate?seconds=60")
    assert sim_resp.status_code == 200, sim_resp.text
    assert sim_resp.json()["clockSeconds"] == 60

    finish_resp = await client.post(f"/matches/{fid}/simulate")
    assert finish_resp.status_code == 200, finish_resp.text
    assert finish_resp.json()["status"] == "completed"


async def test_recover_after_restart(client, db_session: AsyncSession):
    data = await seed_match_data(db_session)
    await _start_match(db_session, data["fixture_id"])

    engine = MatchEngine(db_session)
    state = await engine.recover_after_restart(data["fixture_id"])
    assert state is not None
    assert state.fixture_id == data["fixture_id"]
    assert len(state.current_events) >= 1


async def test_recover_nonexistent_fixture(client, db_session: AsyncSession):
    engine = MatchEngine(db_session)
    state = await engine.recover_after_restart(uuid.uuid4())
    assert state is None
