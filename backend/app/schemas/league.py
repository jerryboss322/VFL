import uuid
from pydantic import Field, field_validator
from app.schemas.base import DualCaseModel


class LeagueBase(DualCaseModel):
    name: str = Field(min_length=1, max_length=100)
    short_name: str = Field(min_length=1, max_length=20)
    country: str = Field(min_length=1, max_length=100)


class LeagueCreate(LeagueBase):
    pass


class LeagueOut(LeagueBase):
    id: str

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v
