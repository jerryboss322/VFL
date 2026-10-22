from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.fixture import Fixture
from app.models.odds import OddsSnapshot
from app.schemas.odds import FixtureOddsOut
from app.services.odds_engine import generate_fixture_markets

router = APIRouter(tags=["odds"])


async def _get_or_create_fixture_odds(session: AsyncSession, fixture_id: str) -> OddsSnapshot:
    result = await session.execute(
        select(OddsSnapshot)
        .where(OddsSnapshot.fixture_id == fixture_id)
        .where(OddsSnapshot.is_active == True)  # noqa: E712
        .order_by(OddsSnapshot.version.desc())
        .limit(1)
    )
    odds = result.scalar_one_or_none()
    if odds is not None:
        # Auto-upgrade legacy 3-market snapshots to the full 27-market sportsbook suite
        if len(odds.markets or []) == 3:
            fx_res = await session.execute(
                select(Fixture)
                .where(Fixture.id == fixture_id)
                .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
            )
            fx = fx_res.scalar_one_or_none()
            if fx is not None:
                odds.markets = generate_fixture_markets(
                    fixture_id=fx.id,
                    home_name=fx.home_club.name if fx.home_club else "Home",
                    away_name=fx.away_club.name if fx.away_club else "Away",
                    home_attack=fx.home_club.attack_rating if fx.home_club else 1.0,
                    home_defense=fx.home_club.defense_rating if fx.home_club else 1.0,
                    away_attack=fx.away_club.attack_rating if fx.away_club else 1.0,
                    away_defense=fx.away_club.defense_rating if fx.away_club else 1.0,
                    version=odds.version,
                    suspended=(fx.status != "upcoming"),
                )
                await session.commit()
                await session.refresh(odds)
        return odds

    fx_res = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fx = fx_res.scalar_one_or_none()
    if fx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Odds not found")

    markets = generate_fixture_markets(
        fixture_id=fx.id,
        home_name=fx.home_club.name if fx.home_club else "Home",
        away_name=fx.away_club.name if fx.away_club else "Away",
        home_attack=fx.home_club.attack_rating if fx.home_club else 1.0,
        home_defense=fx.home_club.defense_rating if fx.home_club else 1.0,
        away_attack=fx.away_club.attack_rating if fx.away_club else 1.0,
        away_defense=fx.away_club.defense_rating if fx.away_club else 1.0,
        version=1,
        suspended=(fx.status != "upcoming"),
    )
    odds = OddsSnapshot(
        fixture_id=fx.id,
        version=1,
        markets=markets,
        is_active=True,
    )
    session.add(odds)
    await session.commit()
    await session.refresh(odds)
    return odds


@router.get("/fixtures/{fixture_id}/odds", response_model=FixtureOddsOut)
async def fixture_odds(fixture_id: str, session: AsyncSession = Depends(get_session)):
    odds = await _get_or_create_fixture_odds(session, fixture_id)
    return {
        "fixture_id": str(odds.fixture_id),
        "version": odds.version,
        "markets": odds.markets or [],
    }


@router.get("/odds", response_model=FixtureOddsOut)
async def query_odds(
    fixture_id: str = Query(..., alias="fixtureId"),
    session: AsyncSession = Depends(get_session),
):
    odds = await _get_or_create_fixture_odds(session, fixture_id)
    return {
        "fixture_id": str(odds.fixture_id),
        "version": odds.version,
        "markets": odds.markets or [],
    }
