import uuid
from pydantic import Field, field_validator
from app.schemas.base import DualCaseModel


class ClubBase(DualCaseModel):
    name: str = Field(min_length=1, max_length=100)
    short_name: str = Field(min_length=1, max_length=20)
    attack_rating: float = Field(default=1.0, ge=0.5, le=2.0)
    defense_rating: float = Field(default=1.0, ge=0.5, le=2.0)


class ClubCreate(ClubBase):
    pass


class ClubOut(ClubBase):
    id: str

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v
