from datetime import datetime
import uuid
from pydantic import Field, field_validator
from app.schemas.base import DualCaseModel


class ClubRef(DualCaseModel):
    id: str
    league_id: str | None = None
    name: str
    short_name: str
    attack_rating: float = 1.0
    defense_rating: float = 1.0

    @field_validator("id", "league_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        if v is None:
            return None
        return str(v) if isinstance(v, uuid.UUID) else v


class FixtureBase(DualCaseModel):
    season_id: uuid.UUID
    home_club_id: uuid.UUID
    away_club_id: uuid.UUID
    matchday: int = Field(ge=1)
    kickoff_at: datetime | str


class FixtureCreate(FixtureBase):
    pass


class FixtureOut(FixtureBase):
    id: uuid.UUID
    league_id: uuid.UUID | None = None
    status: str
    home_goals: int | None = None
    away_goals: int | None = None
    clock_seconds: int | None = None
    home: ClubRef | None = None
    away: ClubRef | None = None


class FixtureDetailOut(FixtureOut):
    home: ClubRef
    away: ClubRef
