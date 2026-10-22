"""Pytest configuration and shared fixtures for backend tests."""

import asyncio
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app

TEST_DATABASE_URL = settings.DATABASE_URL


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


TABLES_FOR_TRUNCATE = [
    "ledger_entries",
    "bets",
    "match_events",
    "match_states",
    "odds_snapshots",
    "fixtures",
    "wallets",
    "users",
    "seasons",
    "clubs",
    "leagues",
]


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async session with table truncation after each test.

    We truncate tables after each test (instead of relying on transaction
    rollback) because the application code calls session.commit(), which
    commits the outer transaction and prevents rollback-based isolation.
    """
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True)
    TestSessionLocal = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with test_engine.connect() as connection:
        await connection.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))  # noqa: S603
        session = TestSessionLocal(bind=connection)
        try:
            yield session
        finally:
            await session.close()
            # Truncate all tables to ensure test isolation
            await connection.execute(
                text(
                    "TRUNCATE " + ", ".join(TABLES_FOR_TRUNCATE) + " CASCADE"
                )
            )
            await connection.commit()
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with the database dependency overridden."""

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[
        __import__("app.core.database", fromlist=["get_session"]).get_session
    ] = override_get_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Seed-data helpers
# ---------------------------------------------------------------------------


async def _create_club(session: AsyncSession, name: str, short_name: str) -> uuid.UUID:
    from app.models.club import Club
    club = Club(name=name, short_name=short_name)
    session.add(club)
    await session.flush()
    return club.id


async def _create_league(
    session: AsyncSession, name: str = "Test League", short_name: str = "TL", country: str = "TC"
) -> uuid.UUID:
    from app.models.league import League
    league = League(name=name, short_name=short_name, country=country)
    session.add(league)
    await session.flush()
    return league.id


async def _create_season(
    session: AsyncSession,
    league_id: uuid.UUID,
    name: str = "2025 Season",
    year: int = 2025,
    is_active: bool = True,
) -> uuid.UUID:
    from app.models.season import Season
    season = Season(league_id=league_id, name=name, year=year, is_active=is_active)
    session.add(season)
    await session.flush()
    return season.id


async def _create_fixture(
    session: AsyncSession,
    season_id: uuid.UUID,
    home_club_id: uuid.UUID,
    away_club_id: uuid.UUID,
    matchday: int = 1,
    kickoff_at: str = "2025-01-01T12:00:00Z",
    status: str = "upcoming",
) -> uuid.UUID:
    from app.models.fixture import Fixture
    fixture = Fixture(
        season_id=season_id,
        home_club_id=home_club_id,
        away_club_id=away_club_id,
        matchday=matchday,
        kickoff_at=kickoff_at,
        status=status,
    )
    session.add(fixture)
    await session.flush()
    return fixture.id


async def _create_odds_snapshot(
    session: AsyncSession,
    fixture_id: uuid.UUID,
    version: int = 1,
    is_active: bool = True,
) -> uuid.UUID:
    from app.models.odds import OddsSnapshot
    markets = [
        {
            "key": "1x2",
            "label": "Match Result",
            "options": [
                {
                    "odds_id": "home_win",
                    "version": version,
                    "label": "Home Win",
                    "decimal": 2.10,
                    "outcome": "home",
                    "suspended": False,
                },
                {
                    "odds_id": "draw",
                    "version": version,
                    "label": "Draw",
                    "decimal": 3.40,
                    "outcome": "draw",
                    "suspended": False,
                },
                {
                    "odds_id": "away_win",
                    "version": version,
                    "label": "Away Win",
                    "decimal": 3.60,
                    "outcome": "away",
                    "suspended": False,
                },
            ],
        }
    ]
    odds = OddsSnapshot(
        fixture_id=fixture_id,
        version=version,
        markets=markets,
        is_active=is_active,
    )
    session.add(odds)
    await session.flush()
    return odds.id


async def _create_user(
    session: AsyncSession,
    email: str = "test@example.com",
    password: str = "Password123!",
    display_name: str = "Test User",
    is_admin: bool = False,
) -> uuid.UUID:
    from app.core.security import hash_password
    from app.models.user import User
    from app.models.wallet import Wallet

    user = User(
        email=email,
        display_name=display_name,
        password_hash=hash_password(password),
        is_active=True,
        is_admin=is_admin,
    )
    session.add(user)
    await session.flush()

    wallet = Wallet(
        id=user.id,
        user_id=user.id,
        available_minor=1000000,
        reserved_minor=0,
        currency="XTS",
        simulated=True,
    )
    session.add(wallet)
    await session.flush()

    from app.models.ledger import LedgerEntry
    session.add(
        LedgerEntry(
            wallet_id=wallet.id,
            user_id=user.id,
            kind="initial_grant",
            amount_minor=1000000,
            balance_after_minor=1000000,
            description="Initial test-token wallet grant",
            reference=f"signup:{user.id}",
        )
    )
    await session.flush()
    return user.id


async def seed_match_data(session: AsyncSession) -> dict:
    """Create a full match context: club, league, season, fixture, odds, user."""
    home_id = await _create_club(session, "Home United", "HOM")
    away_id = await _create_club(session, "Away City", "AWY")
    league_id = await _create_league(session)
    season_id = await _create_season(session, league_id)
    fixture_id = await _create_fixture(session, season_id, home_id, away_id)
    odds_id = await _create_odds_snapshot(session, fixture_id)
    user_id = await _create_user(session)
    return {
        "home_club_id": home_id,
        "away_club_id": away_id,
        "league_id": league_id,
        "season_id": season_id,
        "fixture_id": fixture_id,
        "odds_id": odds_id,
        "user_id": user_id,
    }
