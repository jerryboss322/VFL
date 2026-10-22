import uuid
from sqlalchemy import Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class MatchEvent(BaseModel):
    __tablename__ = "match_events"

    fixture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fixtures.id"), nullable=False)
    event_seq: Mapped[int] = mapped_column(Integer, nullable=False)  # sequence within match
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)  # kickoff, goal, card, chance, full_time
    minute: Mapped[int] = mapped_column(Integer, nullable=False)
    club_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clubs.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    fixture: Mapped["Fixture"] = relationship(back_populates="events")