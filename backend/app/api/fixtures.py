from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.api.deps import get_session
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.schemas.fixture import FixtureCreate, FixtureDetailOut, FixtureOut
from app.services.odds_engine import generate_fixture_markets
import uuid

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
    target_uuid = None
    if target_league_id:
        try:
            target_uuid = uuid.UUID(str(target_league_id))
        except (ValueError, TypeError):
            target_uuid = None

    stmt = (
        select(Fixture)
        .join(Season, Fixture.season_id == Season.id)
        .options(
            joinedload(Fixture.home_club),
            joinedload(Fixture.away_club),
            joinedload(Fixture.season),
        )
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    if target_uuid:
        stmt = stmt.where(Season.league_id == target_uuid)
    elif target_league_id:
        stmt = stmt.where(Season.league_id == target_league_id)

    if status:
        stmt = stmt.where(Fixture.status == status)
    if matchday is not None:
        stmt = stmt.where(Fixture.matchday == matchday)
    result = await session.execute(stmt)
    fixtures = result.scalars().all()

    # Deduplicate fixtures to guarantee every club plays at most once per matchday
    # and no matchup is ever duplicated. Prioritize live > upcoming > completed.
    status_priority = {"live": 0, "upcoming": 1, "completed": 2}
    sorted_fixtures = sorted(
        fixtures,
        key=lambda fx: (
            fx.matchday,
            status_priority.get(fx.status, 3),
            str(fx.id),
        ),
    )
    deduped: list[Fixture] = []
    seen_pairings_by_md: set[tuple[int, str]] = set()
    seen_clubs_by_md: dict[int, set[str]] = {}

    for fx in sorted_fixtures:
        md = fx.matchday
        c1, c2 = str(fx.home_club_id), str(fx.away_club_id)
        pair_key = (md, "-".join(sorted([c1, c2])))
        if pair_key in seen_pairings_by_md:
            continue

        clubs_in_md = seen_clubs_by_md.setdefault(md, set())
        if c1 in clubs_in_md or c2 in clubs_in_md:
            continue

        seen_pairings_by_md.add(pair_key)
        clubs_in_md.add(c1)
        clubs_in_md.add(c2)
        deduped.append(fx)

    deduped.sort(key=lambda f: (f.matchday, str(f.id)))
    return deduped


@router.get("/{fixture_id}", response_model=FixtureDetailOut)
async def get_fixture(fixture_id: str, session: AsyncSession = Depends(get_session)):
    try:
        fx_uuid = uuid.UUID(fixture_id)
    except (ValueError, TypeError):
        fx_uuid = fixture_id

    result = await session.execute(
        select(Fixture)
        .where(Fixture.id == fx_uuid)
        .options(
            joinedload(Fixture.home_club),
            joinedload(Fixture.away_club),
            joinedload(Fixture.season),
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
