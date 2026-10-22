import uuid
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    staff_role: Mapped[str] = mapped_column(String(40), default="TRADER", server_default="TRADER", nullable=False)
    staff_permissions: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    session_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    last_login_at: Mapped[str | None] = mapped_column(String(60), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    kyc_tier: Mapped[str] = mapped_column(String(30), default="UNVERIFIED", server_default="UNVERIFIED", nullable=False)
    risk_flag: Mapped[str] = mapped_column(String(30), default="NORMAL", server_default="NORMAL", nullable=False)
    custom_max_stake_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    wallet: Mapped["Wallet"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    bets: Mapped[list["Bet"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="user", cascade="all, delete-orphan")