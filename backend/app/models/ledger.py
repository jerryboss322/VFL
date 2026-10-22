import uuid
from sqlalchemy import Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class LedgerEntry(BaseModel):
    __tablename__ = "ledger_entries"

    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wallets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    bet_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bets.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)  # deposit, stake_reserve, stake_release, settlement, adjustment
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)  # positive = credit, negative = debit
    balance_after_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    wallet: Mapped["Wallet"] = relationship(back_populates="ledger_entries")
    user: Mapped["User"] = relationship(back_populates="ledger_entries")
    bet: Mapped["Bet | None"] = relationship(back_populates="ledger_entries")