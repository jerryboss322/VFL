from datetime import datetime
import uuid
from pydantic import Field, field_validator
from app.schemas.base import DualCaseModel


class BetSelectionIn(DualCaseModel):
    odds_id: str
    version: int = 1
    fixture_id: str | None = None


class PlaceBetRequest(DualCaseModel):
    selections: list[BetSelectionIn] = Field(min_length=1, max_length=10)
    stake_minor: int = Field(ge=1)
    idempotency_key: str = Field(min_length=1)


class CashoutRequest(DualCaseModel):
    percentage: int = Field(default=100, ge=1, le=100)


class BetSelectionOut(DualCaseModel):
    fixture_id: str
    market: str
    outcome: str | None = None
    odds_id: str | None = None
    label: str
    recorded_odds: float
    status: str | None = None

    @field_validator("fixture_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v


class BetOut(DualCaseModel):
    id: str
    status: str
    stake_minor: int
    recorded_odds: float
    placed_at: datetime | str
    settled_at: datetime | str | None = None
    return_minor: int | None = None
    selections: list[BetSelectionOut]

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v
