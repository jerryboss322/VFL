"""FastAPI endpoints for Virtual Champions Cup and Knockout Tournaments."""

import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.club import Club
from app.models.cup import Tournament, TournamentTie
from app.services.cup_bracket_engine import (
    ClubParticipant,
    TieResolutionType,
    TournamentRound,
    calculate_outright_winner_odds,
    conduct_r16_draw,
    resolve_two_legged_tie,
)

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.get("")
async def list_tournaments(
    session: AsyncSession = Depends(get_session),
):
    """List all available Virtual European Cup Tournaments."""
    stmt = (
        select(Tournament)
        .options(selectinload(Tournament.champion_club))
        .order_by(Tournament.created_at.desc())
    )
    res = await session.execute(stmt)
    tournaments = res.scalars().all()

    if not tournaments:
        # Return default virtual champions cup structure if not yet seeded
        return [
            {
                "id": "e0000000-0000-0000-0000-000000000001",
                "name": "Virtual European Champions Cup",
                "slug": "champions-cup",
                "status": "active",
                "currentRound": "ROUND_OF_16",
                "champion": None,
                "totalTeams": 16,
            }
        ]

    return [
        {
            "id": str(t.id),
            "name": t.name,
            "slug": t.slug,
            "status": t.status,
            "currentRound": t.current_round,
            "champion": t.champion_club.name if t.champion_club else None,
            "outrightOddsCount": len(t.outright_odds),
        }
        for t in tournaments
    ]


@router.get("/{slug}/bracket")
async def get_tournament_bracket(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Returns the complete knockout tree bracket structure for visual rendering."""
    # Find clubs from database to synthesize realistic bracket if DB tournament not initialized
    clubs_res = await session.execute(select(Club).limit(16))
    clubs = clubs_res.scalars().all()

    if len(clubs) < 16:
        # Provide fallback teams
        sample_names = [
            ("Real Madrid", "RMA", "Spain"),
            ("Manchester City", "MCI", "England"),
            ("Bayern Munich", "BAY", "Germany"),
            ("Paris Saint-Germain", "PSG", "France"),
            ("Arsenal", "ARS", "England"),
            ("Inter Milan", "INT", "Italy"),
            ("Barcelona", "BAR", "Spain"),
            ("Borussia Dortmund", "BVB", "Germany"),
            ("Atletico Madrid", "ATM", "Spain"),
            ("Juventus", "JUV", "Italy"),
            ("Liverpool", "LIV", "England"),
            ("AC Milan", "ACM", "Italy"),
            ("Benfica", "BEN", "Portugal"),
            ("Sporting CP", "SPO", "Portugal"),
            ("PSV Eindhoven", "PSV", "Netherlands"),
            ("Feyenoord", "FEY", "Netherlands"),
        ]
        participants = [
            ClubParticipant(f"club_{i+1}", name, short, country, 1.8 - (i * 0.03), 1.4 - (i * 0.02), i < 8)
            for i, (name, short, country) in enumerate(sample_names)
        ]
    else:
        participants = [
            ClubParticipant(
                str(c.id),
                c.name,
                c.short_name or c.name[:3].upper(),
                "Europe",
                float(c.attack_rating or 1.5),
                float(c.defense_rating or 1.2),
                i < 8,
            )
            for i, c in enumerate(clubs)
        ]

    # Conduct R16 draw
    seeded = participants[:8]
    unseeded = participants[8:16]
    pairs = conduct_r16_draw(seeded, unseeded, seed=42)

    # Simulate R16 ties
    r16_ties = []
    qf_teams = []
    for idx, (team_a, team_b) in enumerate(pairs):
        tie = resolve_two_legged_tie(
            tie_id=f"r16_{idx+1}",
            round_name=TournamentRound.ROUND_OF_16,
            club_a=team_a,
            club_b=team_b,
            leg_1_home_goals=2 if idx % 2 == 0 else 1,
            leg_1_away_goals=1 if idx % 3 == 0 else 0,
            leg_2_home_goals=1 if idx % 2 == 1 else 2,
            leg_2_away_goals=1,
            seed=100 + idx,
        )
        r16_ties.append({
            "slot": idx + 1,
            "clubA": { "id": team_a.club_id, "name": team_a.name, "short": team_a.short_name },
            "clubB": { "id": team_b.club_id, "name": team_b.name, "short": team_b.short_name },
            "leg1": f"{tie.leg_1.home_goals} - {tie.leg_1.away_goals}",
            "leg2": f"{tie.leg_2.home_goals} - {tie.leg_2.away_goals}" if tie.leg_2 else "-",
            "aggregate": f"{tie.aggregate_a} - {tie.aggregate_b}",
            "winnerId": tie.winner_club_id,
            "winnerName": team_a.name if tie.winner_club_id == team_a.club_id else team_b.name,
            "status": "completed",
            "summary": tie.summary_text,
        })
        winner = team_a if tie.winner_club_id == team_a.club_id else team_b
        qf_teams.append(winner)

    # QF ties
    qf_ties = []
    sf_teams = []
    for idx in range(0, 8, 2):
        team_a = qf_teams[idx]
        team_b = qf_teams[idx + 1]
        tie = resolve_two_legged_tie(
            tie_id=f"qf_{idx//2 + 1}",
            round_name=TournamentRound.QUARTER_FINALS,
            club_a=team_a,
            club_b=team_b,
            leg_1_home_goals=1,
            leg_1_away_goals=0,
            leg_2_home_goals=2,
            leg_2_away_goals=2,
            seed=200 + idx,
        )
        qf_ties.append({
            "slot": idx // 2 + 1,
            "clubA": { "id": team_a.club_id, "name": team_a.name, "short": team_a.short_name },
            "clubB": { "id": team_b.club_id, "name": team_b.name, "short": team_b.short_name },
            "leg1": f"{tie.leg_1.home_goals} - {tie.leg_1.away_goals}",
            "leg2": f"{tie.leg_2.home_goals} - {tie.leg_2.away_goals}" if tie.leg_2 else "-",
            "aggregate": f"{tie.aggregate_a} - {tie.aggregate_b}",
            "winnerId": tie.winner_club_id,
            "winnerName": team_a.name if tie.winner_club_id == team_a.club_id else team_b.name,
            "status": "completed",
            "summary": tie.summary_text,
        })
        winner = team_a if tie.winner_club_id == team_a.club_id else team_b
        sf_teams.append(winner)

    # SF ties
    sf_ties = []
    final_teams = []
    for idx in range(0, 4, 2):
        team_a = sf_teams[idx]
        team_b = sf_teams[idx + 1]
        tie = resolve_two_legged_tie(
            tie_id=f"sf_{idx//2 + 1}",
            round_name=TournamentRound.SEMI_FINALS,
            club_a=team_a,
            club_b=team_b,
            leg_1_home_goals=2,
            leg_1_away_goals=1,
            leg_2_home_goals=1,
            leg_2_away_goals=1,
            seed=300 + idx,
        )
        sf_ties.append({
            "slot": idx // 2 + 1,
            "clubA": { "id": team_a.club_id, "name": team_a.name, "short": team_a.short_name },
            "clubB": { "id": team_b.club_id, "name": team_b.name, "short": team_b.short_name },
            "leg1": f"{tie.leg_1.home_goals} - {tie.leg_1.away_goals}",
            "leg2": f"{tie.leg_2.home_goals} - {tie.leg_2.away_goals}" if tie.leg_2 else "-",
            "aggregate": f"{tie.aggregate_a} - {tie.aggregate_b}",
            "winnerId": tie.winner_club_id,
            "winnerName": team_a.name if tie.winner_club_id == team_a.club_id else team_b.name,
            "status": "completed",
            "summary": tie.summary_text,
        })
        winner = team_a if tie.winner_club_id == team_a.club_id else team_b
        final_teams.append(winner)

    # Final tie (single leg neutral venue)
    final_a = final_teams[0]
    final_b = final_teams[1]
    final_tie = resolve_two_legged_tie(
        tie_id="final_1",
        round_name=TournamentRound.FINAL,
        club_a=final_a,
        club_b=final_b,
        leg_1_home_goals=2,
        leg_1_away_goals=1,
        leg_2_home_goals=0,
        leg_2_away_goals=0,
        seed=500,
    )
    champion = final_a if final_tie.winner_club_id == final_a.club_id else final_b

    # Outright winner odds
    outright_odds = calculate_outright_winner_odds(participants)

    return {
        "slug": slug,
        "name": "Virtual European Champions Cup",
        "currentRound": "FINAL",
        "champion": {
            "id": champion.club_id,
            "name": champion.name,
            "short": champion.short_name,
        },
        "outrightOdds": outright_odds,
        "rounds": {
            "roundOf16": r16_ties,
            "quarterFinals": qf_ties,
            "semiFinals": sf_ties,
            "final": {
                "clubA": { "id": final_a.club_id, "name": final_a.name, "short": final_a.short_name },
                "clubB": { "id": final_b.club_id, "name": final_b.name, "short": final_b.short_name },
                "score": f"{final_tie.leg_1.home_goals} - {final_tie.leg_1.away_goals}",
                "winnerId": champion.club_id,
                "winnerName": champion.name,
                "status": "completed",
                "summary": f"{champion.name} are crowned European Champions!",
            },
        },
    }
