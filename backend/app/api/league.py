from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.league import League
from app.models.season import Season
from app.schemas.league import LeagueCreate, LeagueOut
from app.schemas.table import TableRowOut

router = APIRouter(prefix="/league", tags=["league"])


@router.get("", response_model=list[LeagueOut])
async def list_leagues(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(League).order_by(League.created_at.asc()))
    return result.scalars().all()


@router.post("", response_model=LeagueOut, status_code=status.HTTP_201_CREATED)
async def create_league(data: LeagueCreate, session: AsyncSession = Depends(get_session)):
    league = League(**data.model_dump())
    session.add(league)
    await session.commit()
    await session.refresh(league)
    return league


@router.get("/table", response_model=list[TableRowOut])
async def league_table(
    league_id: str | None = Query(None, alias="leagueId"),
    league_id_snake: str | None = Query(None, include_in_schema=False),
    session: AsyncSession = Depends(get_session),
):
    """Compute league standings across clubs and completed fixtures, optionally filtered by league."""
    target_league_id = league_id or league_id_snake

    club_stmt = select(Club).order_by(Club.name.asc())
    if target_league_id:
        club_stmt = club_stmt.where(Club.league_id == target_league_id)
    clubs_res = await session.execute(club_stmt)
    all_clubs = clubs_res.scalars().all()

    fx_stmt = (
        select(Fixture)
        .join(Season, Fixture.season_id == Season.id)
        .where(Fixture.status == "completed")
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    if target_league_id:
        fx_stmt = fx_stmt.where(Season.league_id == target_league_id)
        active_season_res = await session.execute(
            select(Season.id)
            .where(Season.league_id == target_league_id, Season.is_active == True)  # noqa: E712
            .order_by(Season.created_at.desc())
            .limit(1)
        )
        active_season_id = active_season_res.scalar_one_or_none()
        if not active_season_id:
            latest_season_res = await session.execute(
                select(Season.id)
                .where(Season.league_id == target_league_id)
                .order_by(Season.created_at.desc())
                .limit(1)
            )
            active_season_id = latest_season_res.scalar_one_or_none()
        if active_season_id:
            fx_stmt = fx_stmt.where(Fixture.season_id == active_season_id)

    result = await session.execute(fx_stmt)
    fixtures = result.scalars().all()

    # Deduplicate fixtures so duplicate records in DB are never counted multiple times
    seen_matches_by_md: set[tuple[int, str]] = set()
    deduped_completed: list[Fixture] = []
    for fx in fixtures:
        pair_key = (fx.matchday, "-".join(sorted([str(fx.home_club_id), str(fx.away_club_id)])))
        if pair_key in seen_matches_by_md:
            continue
        seen_matches_by_md.add(pair_key)
        deduped_completed.append(fx)
    fixtures = deduped_completed

    table: dict[str, dict] = {}
    for club in all_clubs:
        table[str(club.id)] = {
            "club": {
                "id": str(club.id),
                "name": club.name,
                "short_name": club.short_name,
                "attack_rating": club.attack_rating,
                "defense_rating": club.defense_rating,
            },
            "played": 0,
            "won": 0,
            "drawn": 0,
            "lost": 0,
            "gf": 0,
            "ga": 0,
            "gd": 0,
            "points": 0,
            "form": [],
        }

    for fx in fixtures:
        for club_id, club in [(fx.home_club_id, fx.home_club), (fx.away_club_id, fx.away_club)]:
            if club and str(club_id) not in table:
                table[str(club_id)] = {
                    "club": {
                        "id": str(club.id),
                        "name": club.name,
                        "short_name": club.short_name,
                        "attack_rating": getattr(club, "attack_rating", 1.0),
                        "defense_rating": getattr(club, "defense_rating", 1.0),
                    },
                    "played": 0,
                    "won": 0,
                    "drawn": 0,
                    "lost": 0,
                    "gf": 0,
                    "ga": 0,
                    "gd": 0,
                    "points": 0,
                    "form": [],
                }

        home = table[str(fx.home_club_id)]
        away = table[str(fx.away_club_id)]
        hg = fx.home_goals or 0
        ag = fx.away_goals or 0

        home["played"] += 1
        away["played"] += 1
        home["gf"] += hg
        home["ga"] += ag
        away["gf"] += ag
        away["ga"] += hg
        home["gd"] = home["gf"] - home["ga"]
        away["gd"] = away["gf"] - away["ga"]

        if hg > ag:
            home["won"] += 1
            home["points"] += 3
            away["lost"] += 1
            home["form"].append("W")
            away["form"].append("L")
        elif hg < ag:
            away["won"] += 1
            away["points"] += 3
            home["lost"] += 1
            away["form"].append("W")
            home["form"].append("L")
        else:
            home["drawn"] += 1
            home["points"] += 1
            away["drawn"] += 1
            away["points"] += 1
            home["form"].append("D")
            away["form"].append("D")

    sorted_rows = sorted(
        table.values(),
        key=lambda r: (-r["points"], -(r["gf"] - r["ga"]), -r["gf"], r["club"]["name"]),
    )
    for idx, row in enumerate(sorted_rows, start=1):
        row["position"] = idx
        row["form"] = row["form"][-5:]

    return sorted_rows
