"""FastAPI endpoints for Predictive Analytics, Head-to-Head (H2H) matrix, and Radar comparisons."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.models.club import Club
from app.models.fixture import Fixture
from app.services.h2h_analytics import (
    compute_h2h_clash_metrics,
    compute_team_radar_attributes,
    generate_score_probability_matrix,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/h2h/{club_a_id}/{club_b_id}")
async def get_head_to_head_analytics(
    club_a_id: str,
    club_b_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Returns predictive analytics, historic encounters, and Poisson score distributions between two clubs."""
    try:
        c_a_uuid = uuid.UUID(club_a_id)
        c_b_uuid = uuid.UUID(club_b_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid club UUID format")

    # Fetch both clubs
    clubs_res = await session.execute(
        select(Club).where(Club.id.in_([c_a_uuid, c_b_uuid]))
    )
    clubs = {str(c.id): c for c in clubs_res.scalars().all()}

    club_a = clubs.get(club_a_id)
    club_b = clubs.get(club_b_id)

    if not club_a or not club_b:
        raise HTTPException(status_code=404, detail="One or both clubs not found")

    # Fetch past completed fixtures between these two clubs
    stmt = (
        select(Fixture)
        .where(
            Fixture.status == "completed",
            or_(
                (Fixture.home_club_id == c_a_uuid) & (Fixture.away_club_id == c_b_uuid),
                (Fixture.home_club_id == c_b_uuid) & (Fixture.away_club_id == c_a_uuid),
            ),
        )
        .order_by(Fixture.kickoff_at.desc())
        .limit(10)
    )
    res = await session.execute(stmt)
    past_fixtures = res.scalars().all()

    past_matches_data = [
        {
            "home_id": str(f.home_club_id),
            "away_id": str(f.away_club_id),
            "home_goals": f.home_goals or 0,
            "away_goals": f.away_goals or 0,
            "kickoff": str(f.kickoff_at),
        }
        for f in past_fixtures
    ]

    h2h_metrics = compute_h2h_clash_metrics(past_matches_data, club_a_id, club_b_id)

    # Compute expected goals (xG) based on attack & defense ratings + home advantage factor
    att_a = float(club_a.attack_rating or 1.6)
    def_a = float(club_a.defense_rating or 1.3)
    att_b = float(club_b.attack_rating or 1.5)
    def_b = float(club_b.defense_rating or 1.2)

    # Standard Dixon-Coles goal expectation
    home_xg = max(0.5, (att_a / def_b) * 1.35)
    away_xg = max(0.4, (att_b / def_a) * 1.05)

    poisson_matrix = generate_score_probability_matrix(home_xg, away_xg)

    # Generate tactical radar comparisons
    radar_a = compute_team_radar_attributes(att_a, def_a, [2, 1, 3, 2, 1], [1, 0, 2, 1, 0])
    radar_b = compute_team_radar_attributes(att_b, def_b, [1, 2, 2, 0, 1], [2, 1, 1, 1, 2])

    return {
        "clubA": {
            "id": club_a_id,
            "name": club_a.name,
            "shortName": club_a.short_name,
            "attackRating": att_a,
            "defenseRating": def_a,
            "radar": radar_a,
        },
        "clubB": {
            "id": club_b_id,
            "name": club_b.name,
            "shortName": club_b.short_name,
            "attackRating": att_b,
            "defenseRating": def_b,
            "radar": radar_b,
        },
        "clashHistory": h2h_metrics,
        "pastEncounters": past_matches_data,
        "predictiveMatrix": poisson_matrix,
    }
