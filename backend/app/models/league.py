from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class League(BaseModel):
    __tablename__ = "leagues"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    short_name: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)

    seasons: Mapped[list["Season"]] = relationship(back_populates="league", cascade="all, delete-orphan")