import uuid

from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Season(BaseModel):
    __tablename__ = "seasons"

    league_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leagues.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=False, nullable=False)

    league: Mapped["League"] = relationship(back_populates="seasons")
    fixtures: Mapped[list["Fixture"]] = relationship(back_populates="season", cascade="all, delete-orphan")