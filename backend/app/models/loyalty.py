"""SQLAlchemy models for VIP Loyalty Tiers, Streaks, Quests, and Rewards."""

import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class UserLoyaltyProfile(BaseModel):
    __tablename__ = "user_loyalty_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True, nullable=False)
    xp_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_tier: Mapped[str] = mapped_column(String(20), default="BRONZE", nullable=False)  # BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, MASTER
    current_streak_days: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    longest_streak_days: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_login_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    streak_freeze_tokens: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    cashback_rate: Mapped[float] = mapped_column(Numeric(4, 2), default=0.01, nullable=False)  # 1% to 10%
    total_bonus_claimed_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship("User")
    quests: Mapped[List["UserQuestProgress"]] = relationship("UserQuestProgress", back_populates="loyalty_profile", cascade="all, delete-orphan")


class UserQuestProgress(BaseModel):
    __tablename__ = "user_quest_progress"

    loyalty_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user_loyalty_profiles.id"), nullable=False)
    quest_key: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. 'early_bird', 'parlay_architect'
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, nullable=False)
    coin_reward_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    loyalty_profile: Mapped["UserLoyaltyProfile"] = relationship("UserLoyaltyProfile", back_populates="quests")
