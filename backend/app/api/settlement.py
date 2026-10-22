from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.bet import Bet
from app.models.fixture import Fixture
from app.services.betting import settle_bet

router = APIRouter(prefix="/bets", tags=["bets"])


@router.post("/{bet_id}/settle")
async def settle_bet_endpoint(
    bet_id: str,
    won: bool,
    current_user = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = result.scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bet not found")
    if bet.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your bet")

    result = await session.execute(select(Fixture).where(Fixture.id == bet.fixture_id))
    fixture = result.scalar_one_or_none()

    settled = await settle_bet(session, bet, fixture, won)
    return settled