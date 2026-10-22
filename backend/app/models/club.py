import uuid
from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Club(BaseModel):
    __tablename__ = "clubs"

    league_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("leagues.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    short_name: Mapped[str] = mapped_column(String(20), nullable=False)
    attack_rating: Mapped[float] = mapped_column(
        Float, default=1.0, server_default="1.0", nullable=False
    )
    defense_rating: Mapped[float] = mapped_column(
        Float, default=1.0, server_default="1.0", nullable=False
    )

    home_fixtures: Mapped[list["Fixture"]] = relationship(
        back_populates="home_club", foreign_keys="[Fixture.home_club_id]"
    )
    away_fixtures: Mapped[list["Fixture"]] = relationship(
        back_populates="away_club", foreign_keys="[Fixture.away_club_id]"
    )

    @property
    def shortName(self) -> str:
        return self.short_name
