from datetime import datetime
from typing import Any
import uuid
from sqlalchemy import Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.models.base import BaseModel


class Fixture(BaseModel):
    __tablename__ = "fixtures"
    __table_args__ = (
        UniqueConstraint("season_id", "matchday", "home_club_id", name="uq_fixture_season_md_home"),
    )

    season_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    home_club_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    away_club_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clubs.id"), nullable=False)
    matchday: Mapped[int] = mapped_column(Integer, nullable=False)
    kickoff_at: Mapped[str] = mapped_column(String(50), nullable=False)  # ISO 8601
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)  # upcoming, live, completed
    home_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clock_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    season: Mapped["Season"] = relationship(back_populates="fixtures")
    home_club: Mapped["Club"] = relationship(back_populates="home_fixtures", foreign_keys=[home_club_id])
    away_club: Mapped["Club"] = relationship(back_populates="away_fixtures", foreign_keys=[away_club_id])
    match_state: Mapped["MatchState"] = relationship(back_populates="fixture", uselist=False, cascade="all, delete-orphan")
    events: Mapped[list["MatchEvent"]] = relationship(back_populates="fixture", cascade="all, delete-orphan")
    odds_snapshots: Mapped[list["OddsSnapshot"]] = relationship(back_populates="fixture", cascade="all, delete-orphan")
    bets: Mapped[list["Bet"]] = relationship(back_populates="fixture", cascade="all, delete-orphan")

    @validates("kickoff_at")
    def _validate_kickoff_at(self, key: str, value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    @property
    def home(self) -> "Club | None":
        return self.__dict__.get("home_club")

    @property
    def away(self) -> "Club | None":
        return self.__dict__.get("away_club")

    @property
    def league_id(self) -> uuid.UUID | None:
        season = self.__dict__.get("season")
        if season is not None:
            return season.league_id
        hc = self.__dict__.get("home_club")
        if hc is not None:
            return hc.league_id
        return None
