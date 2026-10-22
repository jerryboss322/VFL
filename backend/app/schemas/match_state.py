import uuid
from pydantic import field_validator
from app.schemas.base import DualCaseModel


class MatchStateOut(DualCaseModel):
    fixture_id: str
    status: str
    clock_seconds: int
    home_goals: int
    away_goals: int
    event_version: int
    current_events: list[dict] = []

    @field_validator("fixture_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v
