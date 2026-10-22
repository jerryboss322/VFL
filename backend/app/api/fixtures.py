from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.schemas.fixture import FixtureCreate, FixtureDetailOut, FixtureOut
from app.services.odds_engine import generate_fixture_markets

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


@router.get("", response_model=list[FixtureOut])
async def list_fixtures(
    status: str | None = Query(None),
    matchday: int | None = Query(None),
    league_id: str | None = Query(None, alias="leagueId"),
    league_id_snake: str | None = Query(None, include_in_schema=False),
    session: AsyncSession = Depends(get_session),
):
    target_league_id = league_id or league_id_snake
    stmt = (
        select(Fixture)
        .join(Season, Fixture.season_id == Season.id)
        .options(
            selectinload(Fixture.home_club),
            selectinload(Fixture.away_club),
            selectinload(Fixture.season),
        )
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    if target_league_id:
        stmt = stmt.where(Season.league_id == target_league_id)
    if status:
        stmt = stmt.where(Fixture.status == status)
    if matchday is not None:
        stmt = stmt.where(Fixture.matchday == matchday)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{fixture_id}", response_model=FixtureDetailOut)
async def get_fixture(fixture_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(
            selectinload(Fixture.home_club),
            selectinload(Fixture.away_club),
            selectinload(Fixture.season),
        )
    )
    fx = result.scalar_one_or_none()
    if fx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixture not found")
    return fx


@router.post("", response_model=FixtureOut, status_code=status.HTTP_201_CREATED)
async def create_fixture(data: FixtureCreate, session: AsyncSession = Depends(get_session)):
    payload = data.model_dump()
    if hasattr(payload.get("kickoff_at"), "isoformat"):
        payload["kickoff_at"] = payload["kickoff_at"].isoformat()
    fixture = Fixture(**payload)
    session.add(fixture)
    await session.flush()

    home_club = await session.get(Club, fixture.home_club_id)
    away_club = await session.get(Club, fixture.away_club_id)
    if home_club and away_club:
        markets = generate_fixture_markets(
            fixture_id=fixture.id,
            home_name=home_club.name,
            away_name=away_club.name,
            home_attack=home_club.attack_rating,
            home_defense=home_club.defense_rating,
            away_attack=away_club.attack_rating,
            away_defense=away_club.defense_rating,
            version=1,
        )
        session.add(
            OddsSnapshot(
                fixture_id=fixture.id,
                version=1,
                markets=markets,
                is_active=True,
            )
        )

    await session.commit()
    result = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture.id)
        .options(
            selectinload(Fixture.home_club),
            selectinload(Fixture.away_club),
            selectinload(Fixture.season),
        )
    )
    return result.scalar_one()
