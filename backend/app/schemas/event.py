import uuid
from pydantic import computed_field, field_validator
from app.schemas.base import DualCaseModel


class MatchEventOut(DualCaseModel):
    id: str
    event_seq: int
    event_type: str
    minute: int
    club_id: str | None = None
    text: str
    payload: dict | None = None

    @field_validator("id", "club_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        if v is None:
            return None
        return str(v) if isinstance(v, uuid.UUID) else v

    @computed_field
    @property
    def type(self) -> str:
        return self.event_type
