"""SQLAlchemy models for Virtual European Champions Cup and Knockout Tournaments."""

import uuid
from typing import List, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Tournament(BaseModel):
    __tablename__ = "tournaments"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    season_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("seasons.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)  # upcoming, active, completed
    current_round: Mapped[str] = mapped_column(String(30), default="ROUND_OF_16", nullable=False)
    champion_club_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("clubs.id"), nullable=True)
    outright_odds: Mapped[List[dict]] = mapped_column(JSONB, default=list, nullable=False)

    champion_club: Mapped[Optional["Club"]] = relationship("Club", foreign_keys=[champion_club_id])
    ties: Mapped[List["TournamentTie"]] = relationship("TournamentTie", back_populates="tournament", cascade="all, delete-orphan")


class TournamentTie(BaseModel):
    __tablename__ = "tournament_ties"

    tournament_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournaments.id"), nullable=False)
    round_name: Mapped[str] = mapped_column(String(30), nullable=False)  # ROUND_OF_16, QUARTER_FINALS, SEMI_FINALS, FINAL
    bracket_slot: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 to 8 for R16; 1 to 4 for QF; 1 to 2 for SF; 1 for Final
    club_a_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    club_b_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    winner_club_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("clubs.id"), nullable=True)

    # Two-legged match scores
    leg_1_home_goals: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    leg_1_away_goals: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    leg_2_home_goals: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    leg_2_away_goals: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    aggregate_a: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    aggregate_b: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resolution_type: Mapped[str] = mapped_column(String(30), default="REGULAR_TIME", nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    penalties_a: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    penalties_b: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="ties")
    club_a: Mapped["Club"] = relationship("Club", foreign_keys=[club_a_id])
    club_b: Mapped["Club"] = relationship("Club", foreign_keys=[club_b_id])
    winner_club: Mapped[Optional["Club"]] = relationship("Club", foreign_keys=[winner_club_id])
