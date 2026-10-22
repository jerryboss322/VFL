from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.models.ledger import LedgerEntry
from app.models.wallet import Wallet
from app.schemas.transaction import TransactionOut
from app.schemas.wallet import WalletOut

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
async def get_wallet(
    current_user = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")
    return wallet


@router.get("/transactions", response_model=list[TransactionOut])
async def get_transactions(
    current_user = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(LedgerEntry)
        .where(LedgerEntry.user_id == current_user.id)
        .order_by(LedgerEntry.created_at.desc())
    )
    return result.scalars().all()