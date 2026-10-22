from datetime import datetime
from typing import Any
import uuid
from sqlalchemy import Integer, String, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.models.base import BaseModel


class Bet(BaseModel):
    __tablename__ = "bets"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    fixture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fixtures.id"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    stake_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_odds: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)  # combined decimal odds
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)  # pending, won, lost, void
    return_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    placed_at: Mapped[str] = mapped_column(String(50), nullable=False)  # ISO 8601
    settled_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    selections: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)

    user: Mapped["User"] = relationship(back_populates="bets")
    fixture: Mapped["Fixture"] = relationship(back_populates="bets")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="bet", cascade="all, delete-orphan")

    @validates("placed_at", "settled_at")
    def _validate_timestamps(self, key: str, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)
