import uuid
from pydantic import field_validator
from app.schemas.base import DualCaseModel


class ClubRow(DualCaseModel):
    id: str
    name: str
    short_name: str
    attack_rating: float = 1.0
    defense_rating: float = 1.0

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v


class TableRowOut(DualCaseModel):
    position: int = 1
    club: ClubRow
    played: int
    won: int
    drawn: int
    lost: int
    gf: int
    ga: int
    gd: int = 0
    points: int
    form: list[str] = []
