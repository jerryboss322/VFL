import uuid
from pydantic import Field, field_validator
from app.schemas.base import DualCaseModel


class SeasonBase(DualCaseModel):
    league_id: str
    name: str = Field(min_length=1, max_length=100)
    year: int
    is_active: bool = False

    @field_validator("league_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v


class SeasonCreate(SeasonBase):
    pass


class SeasonOut(SeasonBase):
    id: str

    @field_validator("id", mode="before")
    @classmethod
    def _id_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v
