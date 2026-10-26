"""FastAPI routes for Virtual Fantasy Football and Trader League."""

import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_session
from app.models.club import Club
from app.models.fantasy import (
    FantasyGameweekScore,
    FantasyLeague,
    FantasyPlayerValuation,
    FantasyRoster,
)
from app.models.user import User
from app.services.fantasy_engine import validate_squad_composition

router = APIRouter(prefix="/fantasy", tags=["fantasy"])


class FantasyPlayerIn(BaseModel):
    playerId: str
    name: str
    clubId: str
    position: str
    priceMinor: int


class FantasyRosterSubmit(BaseModel):
    leagueId: str
    teamName: str
    formation: str = "4-4-2"
    captainId: str
    viceCaptainId: str
    startingXi: List[FantasyPlayerIn]
    bench: List[FantasyPlayerIn]


class CreateFantasyLeagueIn(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    targetLeagueId: Optional[str] = None
    isPublic: bool = True
    entryFeeMinor: int = 0
    maxManagers: int = 100


class JoinFantasyLeagueIn(BaseModel):
    inviteCode: str
    teamName: str


@router.get("/leagues")
async def list_fantasy_leagues(
    session: AsyncSession = Depends(get_session),
):
    """List all public virtual fantasy leagues and current manager participant counts."""
    stmt = (
        select(FantasyLeague)
        .where(FantasyLeague.is_public == True)  # noqa: E712
        .options(selectinload(FantasyLeague.rosters))
        .order_by(FantasyLeague.created_at.desc())
    )
    res = await session.execute(stmt)
    leagues = res.scalars().all()

    return [
        {
            "id": str(lg.id),
            "name": lg.name,
            "inviteCode": lg.invite_code,
            "isPublic": lg.is_public,
            "budgetCapMinor": lg.budget_cap_minor,
            "entryFeeMinor": lg.entry_fee_minor,
            "maxManagers": lg.max_managers,
            "managerCount": len(lg.rosters),
            "adminUserId": str(lg.admin_user_id),
        }
        for lg in leagues
    ]


@router.post("/leagues", status_code=status.HTTP_201_CREATED)
async def create_fantasy_league(
    payload: CreateFantasyLeagueIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new custom private or public fantasy league."""
    invite_code = f"FL-{uuid.uuid4().hex[:6].upper()}"
    target_lid = None
    if payload.targetLeagueId:
        try:
            target_lid = uuid.UUID(payload.targetLeagueId)
        except ValueError:
            pass

    fl = FantasyLeague(
        name=payload.name,
        invite_code=invite_code,
        admin_user_id=current_user.id,
        target_league_id=target_lid,
        is_public=payload.isPublic,
        entry_fee_minor=payload.entryFeeMinor,
        max_managers=payload.maxManagers,
    )
    session.add(fl)
    await session.commit()
    await session.refresh(fl)

    return {
        "id": str(fl.id),
        "name": fl.name,
        "inviteCode": fl.invite_code,
        "isPublic": fl.is_public,
        "entryFeeMinor": fl.entry_fee_minor,
        "maxManagers": fl.max_managers,
    }


@router.get("/leagues/{league_id}/standings")
async def get_fantasy_standings(
    league_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get the current leaderboard and managerial standings for a fantasy league."""
    try:
        lid = uuid.UUID(league_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fantasy league ID format")

    stmt = (
        select(FantasyRoster)
        .where(FantasyRoster.fantasy_league_id == lid)
        .options(selectinload(FantasyRoster.user))
        .order_by(desc(FantasyRoster.total_points), desc(FantasyRoster.matchday_points))
    )
    res = await session.execute(stmt)
    rosters = res.scalars().all()

    return [
        {
            "rank": idx + 1,
            "rosterId": str(r.id),
            "teamName": r.team_name,
            "managerName": r.user.email.split("@")[0] if r.user else "Anonymous",
            "totalPoints": r.total_points,
            "matchdayPoints": r.matchday_points,
            "formation": r.formation,
            "transfersMade": r.transfers_made,
        }
        for idx, r in enumerate(rosters)
    ]


@router.get("/players")
async def list_fantasy_players(
    club_id: Optional[str] = Query(None, alias="clubId"),
    position: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List all eligible fantasy players with their valuations, form ratings, and club affiliations."""
    # First check if we have seeded valuations in DB
    stmt = select(FantasyPlayerValuation)
    if position:
        stmt = stmt.where(FantasyPlayerValuation.position == position.upper())
    res = await session.execute(stmt)
    db_players = res.scalars().all()

    if db_players:
        return [
            {
                "playerId": p.player_id,
                "name": p.name,
                "clubId": str(p.club_id),
                "position": p.position,
                "priceMinor": p.current_price_minor,
                "formRating": float(p.form_rating),
                "selectedByPercent": float(p.selected_by_percent),
                "totalSeasonPoints": p.total_season_points,
            }
            for p in db_players
        ]

    # If valuations table is not yet seeded, synthesize realistic players from active clubs
    clubs_res = await session.execute(select(Club).limit(20))
    clubs = clubs_res.scalars().all()

    sample_positions = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"]
    synthesized = []
    for c in clubs:
        c_short = c.short_name or c.name[:3].upper()
        for i, pos in enumerate(sample_positions):
            pid = f"{c_short.lower()}_{pos.lower()}_{i+1}"
            base_price = 5_000_000 if pos in ("GK", "DEF") else 7_500_000 if pos == "MID" else 9_500_000
            synthesized.append({
                "playerId": pid,
                "name": f"{c.name} {pos} #{i+1}",
                "clubId": str(c.id),
                "clubName": c.name,
                "clubShort": c_short,
                "position": pos,
                "priceMinor": base_price,
                "formRating": 6.5,
                "selectedByPercent": 12.4,
                "totalSeasonPoints": 42,
            })

    return synthesized


@router.get("/roster/me")
async def get_my_fantasy_roster(
    league_id: Optional[str] = Query(None, alias="leagueId"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get authenticated user's current fantasy team roster."""
    stmt = select(FantasyRoster).where(FantasyRoster.user_id == current_user.id)
    if league_id:
        try:
            stmt = stmt.where(FantasyRoster.fantasy_league_id == uuid.UUID(league_id))
        except ValueError:
            pass
    stmt = stmt.order_by(FantasyRoster.created_at.desc())
    res = await session.execute(stmt)
    roster = res.scalars().first()

    if not roster:
        return None

    return {
        "id": str(roster.id),
        "fantasyLeagueId": str(roster.fantasy_league_id),
        "teamName": roster.team_name,
        "matchday": roster.matchday,
        "totalPoints": roster.total_points,
        "matchdayPoints": roster.matchday_points,
        "formation": roster.formation,
        "captainId": roster.captain_player_id,
        "viceCaptainId": roster.vice_captain_player_id,
        "startingXi": roster.starting_xi,
        "bench": roster.bench,
        "freeTransfersRemaining": roster.free_transfers_remaining,
        "bankBalanceMinor": roster.bank_balance_minor,
    }


@router.post("/roster")
async def save_fantasy_roster(
    payload: FantasyRosterSubmit,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Submit or transfer players in the 15-man squad adhering to budget and composition constraints."""
    try:
        fl_id = uuid.UUID(payload.leagueId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fantasy league ID")

    # Combine all 15 players for squad composition audit
    all_players = [p.model_dump() for p in payload.startingXi] + [p.model_dump() for p in payload.bench]
    valid, err = validate_squad_composition(all_players)
    if not valid:
        raise HTTPException(status_code=400, detail=f"Invalid squad: {err}")

    # Check for existing roster in this fantasy league
    stmt = select(FantasyRoster).where(
        FantasyRoster.fantasy_league_id == fl_id,
        FantasyRoster.user_id == current_user.id,
    )
    res = await session.execute(stmt)
    roster = res.scalars().first()

    if roster:
        # Update existing roster
        roster.team_name = payload.teamName
        roster.formation = payload.formation
        roster.captain_player_id = payload.captainId
        roster.vice_captain_player_id = payload.viceCaptainId
        roster.starting_xi = [p.model_dump() for p in payload.startingXi]
        roster.bench = [p.model_dump() for p in payload.bench]
        roster.transfers_made += 1
    else:
        # Create new roster
        roster = FantasyRoster(
            fantasy_league_id=fl_id,
            user_id=current_user.id,
            team_name=payload.teamName,
            formation=payload.formation,
            captain_player_id=payload.captainId,
            vice_captain_player_id=payload.viceCaptainId,
            starting_xi=[p.model_dump() for p in payload.startingXi],
            bench=[p.model_dump() for p in payload.bench],
            total_points=0,
            matchday_points=0,
        )
        session.add(roster)

    await session.commit()
    await session.refresh(roster)

    return {
        "status": "success",
        "rosterId": str(roster.id),
        "teamName": roster.team_name,
        "totalPoints": roster.total_points,
    }
