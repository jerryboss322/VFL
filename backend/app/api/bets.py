from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_session
from app.models.bet import Bet
from app.models.fixture import Fixture
from app.models.odds import OddsSnapshot
from app.models.user import User
from app.schemas.bet import BetOut, CashoutRequest, PlaceBetRequest
from app.services.betting import (
    BettingError,
    _extract_fixture_id_from_odds_id,
    _find_selection,
    _format_bet_dict,
    cashout_bet,
    compute_bet_cashout,
    place_bet,
)

router = APIRouter(prefix="/bets", tags=["bets"])


@router.post("", response_model=BetOut, status_code=status.HTTP_201_CREATED)
async def place_bet_endpoint(
    request: PlaceBetRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    first_sel = request.selections[0]
    explicit_fixture_id: UUID | None = None
    if first_sel.fixture_id:
        try:
            explicit_fixture_id = UUID(first_sel.fixture_id)
        except ValueError:
            pass
    if explicit_fixture_id is None:
        explicit_fixture_id = _extract_fixture_id_from_odds_id(first_sel.odds_id)

    target_odds: OddsSnapshot | None = None
    if explicit_fixture_id is not None:
        res = await session.execute(
            select(OddsSnapshot)
            .where(OddsSnapshot.fixture_id == explicit_fixture_id)
            .where(OddsSnapshot.is_active == True)  # noqa: E712
        )
        for cand in res.scalars().all():
            if _find_selection(cand, first_sel.odds_id, first_sel.version):
                target_odds = cand
                break

    if target_odds is None:
        result = await session.execute(
            select(OddsSnapshot).where(OddsSnapshot.is_active == True)  # noqa: E712
        )
        for cand in result.scalars().all():
            if _find_selection(cand, first_sel.odds_id, first_sel.version):
                target_odds = cand
                break

    if not target_odds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ODDS_CHANGED", "message": "Odds selection not found"},
        )

    result = await session.execute(select(Fixture).where(Fixture.id == target_odds.fixture_id))
    fixture = result.scalar_one_or_none()
    if fixture is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Fixture not found"},
        )

    try:
        bet = await place_bet(session, current_user, fixture, request)
    except BettingError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message},
        )

    return bet


@router.get("", response_model=list[BetOut])
async def list_bets(
    status: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = (
        select(Bet)
        .where(Bet.user_id == current_user.id)
        .options(selectinload(Bet.fixture))
        .order_by(Bet.created_at.desc())
    )
    if status:
        stmt = stmt.where(Bet.status == status)
    result = await session.execute(stmt)
    bets = result.scalars().all()

    out_bets = []
    for b in bets:
        if b.status == "pending":
            co = await compute_bet_cashout(session, b)
            out_bets.append(_format_bet_dict(b, cashout_info=co))
        else:
            out_bets.append(_format_bet_dict(b))
    return out_bets


@router.post("/{bet_id}/cashout", response_model=BetOut)
async def cashout_bet_endpoint(
    bet_id: str,
    request: CashoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = res.scalar_one_or_none()
    if bet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Bet not found"},
        )
    percentage = request.percentage if request else 100
    try:
        return await cashout_bet(session, current_user, bet, percentage=percentage)
    except BettingError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"code": e.code, "message": e.message},
        )
