import uuid
from sqlalchemy import CheckConstraint, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Wallet(BaseModel):
    __tablename__ = "wallets"
    __table_args__ = (
        CheckConstraint("available_minor >= 0", name="ck_wallets_available_non_negative"),
        CheckConstraint("reserved_minor >= 0", name="ck_wallets_reserved_non_negative"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    available_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="XTS", nullable=False)  # test currency
    simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="user_wallet" if False else "wallet")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="wallet", cascade="all, delete-orphan")
