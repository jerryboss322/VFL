import uuid
from sqlalchemy import Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class MatchState(BaseModel):
    __tablename__ = "match_states"

    fixture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fixtures.id"), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="upcoming", nullable=False)  # upcoming, live, completed
    clock_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    home_goals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    away_goals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    current_events: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    # version for optimistic concurrency / event ordering
    event_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    fixture: Mapped["Fixture"] = relationship(back_populates="match_state")