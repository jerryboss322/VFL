from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.fixture import Fixture
from app.models.match_event import MatchEvent
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
        # If match is currently live, generate/refresh dynamic in-play odds
        fx_res = await session.execute(
            select(Fixture)
            .where(Fixture.id == fixture_id)
            .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        )
        fx = fx_res.scalar_one_or_none()
        if fx is not None and fx.status == "live":
            new_ver = odds.version + 1
            ht_h = 0
            ht_a = 0
            if (fx.clock_seconds or 0) >= 240:
                ev_res = await session.execute(
                    select(MatchEvent)
                    .where(MatchEvent.fixture_id == fx.id)
                    .where(MatchEvent.minute <= 240)
                    .where(MatchEvent.event_type == "goal")
                )
                for ev in ev_res.scalars():
                    side = (ev.payload or {}).get("side")
                    if side == "home":
                        ht_h += 1
                    elif side == "away":
                        ht_a += 1
            else:
                ht_h = fx.home_goals or 0
                ht_a = fx.away_goals or 0

            odds.markets = generate_fixture_markets(
                fixture_id=fx.id,
                home_name=fx.home_club.name if fx.home_club else "Home",
                away_name=fx.away_club.name if fx.away_club else "Away",
                home_attack=fx.home_club.attack_rating if fx.home_club else 1.0,
                home_defense=fx.home_club.defense_rating if fx.home_club else 1.0,
                away_attack=fx.away_club.attack_rating if fx.away_club else 1.0,
                away_defense=fx.away_club.defense_rating if fx.away_club else 1.0,
                version=new_ver,
                suspended=False,
                current_home_goals=fx.home_goals or 0,
                current_away_goals=fx.away_goals or 0,
                elapsed_seconds=fx.clock_seconds or 0,
                is_live=True,
                ht_home_goals=ht_h,
                ht_away_goals=ht_a,
            )
            odds.version = new_ver
            await session.commit()
            await session.refresh(odds)
        elif odds.markets and fx is not None and fx.status == "completed":
            for m in odds.markets:
                for o in m.get("options", []):
                    o["suspended"] = True
        return odds

    fx_res = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fx = fx_res.scalar_one_or_none()
    if fx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Odds not found")

    is_live = fx.status == "live"
    is_completed = fx.status == "completed"
    ht_h = 0
    ht_a = 0
    if is_live and (fx.clock_seconds or 0) >= 240:
        ev_res = await session.execute(
            select(MatchEvent)
            .where(MatchEvent.fixture_id == fx.id)
            .where(MatchEvent.minute <= 240)
            .where(MatchEvent.event_type == "goal")
        )
        for ev in ev_res.scalars():
            side = (ev.payload or {}).get("side")
            if side == "home":
                ht_h += 1
            elif side == "away":
                ht_a += 1
    elif is_live:
        ht_h = fx.home_goals or 0
        ht_a = fx.away_goals or 0

    markets = generate_fixture_markets(
        fixture_id=fx.id,
        home_name=fx.home_club.name if fx.home_club else "Home",
        away_name=fx.away_club.name if fx.away_club else "Away",
        home_attack=fx.home_club.attack_rating if fx.home_club else 1.0,
        home_defense=fx.home_club.defense_rating if fx.home_club else 1.0,
        away_attack=fx.away_club.attack_rating if fx.away_club else 1.0,
        away_defense=fx.away_club.defense_rating if fx.away_club else 1.0,
        version=1,
        suspended=is_completed,
        current_home_goals=fx.home_goals or 0,
        current_away_goals=fx.away_goals or 0,
        elapsed_seconds=fx.clock_seconds or 0,
        is_live=is_live,
        ht_home_goals=ht_h,
        ht_away_goals=ht_a,
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
