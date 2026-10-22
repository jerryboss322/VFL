import uuid
from sqlalchemy import Boolean, Integer, String, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class OddsSnapshot(BaseModel):
    __tablename__ = "odds_snapshots"

    fixture_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fixtures.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    markets: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    fixture: Mapped["Fixture"] = relationship(back_populates="odds_snapshots")