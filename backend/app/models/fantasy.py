"""SQLAlchemy models for Virtual Fantasy Football and Trader League Subsystem."""

import uuid
from typing import Any, List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class FantasyLeague(BaseModel):
    __tablename__ = "fantasy_leagues"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    admin_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_league_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("leagues.id"), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    budget_cap_minor: Mapped[int] = mapped_column(Integer, default=100_000_000, nullable=False)  # 100.0M
    entry_fee_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_managers: Mapped[int] = mapped_column(Integer, default=100, nullable=False)

    admin_user: Mapped["User"] = relationship("User", foreign_keys=[admin_user_id])
    target_league: Mapped[Optional["League"]] = relationship("League", foreign_keys=[target_league_id])
    rosters: Mapped[List["FantasyRoster"]] = relationship("FantasyRoster", back_populates="fantasy_league", cascade="all, delete-orphan")


class FantasyRoster(BaseModel):
    __tablename__ = "fantasy_rosters"

    fantasy_league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fantasy_leagues.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    matchday: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    team_name: Mapped[str] = mapped_column(String(60), nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    matchday_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    formation: Mapped[str] = mapped_column(String(10), default="4-4-2", nullable=False)
    captain_player_id: Mapped[str] = mapped_column(String(50), nullable=False)
    vice_captain_player_id: Mapped[str] = mapped_column(String(50), nullable=False)
    transfers_made: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    free_transfers_remaining: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bank_balance_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Starting XI and Bench rosters stored as JSON array of player structures
    # [{ "playerId": "...", "name": "...", "clubId": "...", "position": "FWD", "priceMinor": 12000000, "points": 8 }]
    starting_xi: Mapped[List[dict]] = mapped_column(JSONB, default=list, nullable=False)
    bench: Mapped[List[dict]] = mapped_column(JSONB, default=list, nullable=False)

    fantasy_league: Mapped["FantasyLeague"] = relationship("FantasyLeague", back_populates="rosters")
    user: Mapped["User"] = relationship("User")


class FantasyGameweekScore(BaseModel):
    __tablename__ = "fantasy_gameweek_scores"

    player_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    player_name: Mapped[str] = mapped_column(String(100), nullable=False)
    matchday: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    fixture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fixtures.id"), nullable=False)
    club_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    position: Mapped[str] = mapped_column(String(10), nullable=False)  # GK, DEF, MID, FWD

    minutes_played: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    goals_scored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assists: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clean_sheet: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    goals_conceded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    saves: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    penalties_saved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    penalties_missed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    yellow_cards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    red_cards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    own_goals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bonus_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class FantasyPlayerValuation(BaseModel):
    __tablename__ = "fantasy_player_valuations"

    player_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    club_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    position: Mapped[str] = mapped_column(String(10), nullable=False)  # GK, DEF, MID, FWD
    base_price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    current_price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    form_rating: Mapped[float] = mapped_column(Numeric(5, 2), default=5.0, nullable=False)
    selected_by_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    total_season_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
