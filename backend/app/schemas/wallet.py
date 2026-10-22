from datetime import datetime
import uuid
from pydantic import field_validator
from app.schemas.base import DualCaseModel


class WalletOut(DualCaseModel):
    available_minor: int
    reserved_minor: int
    currency: str = "XTS"
    simulated: bool = True


class TransactionOut(DualCaseModel):
    id: str
    kind: str
    amount_minor: int
    balance_after_minor: int | None = None
    created_at: str
    description: str
    reference: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v

    @field_validator("created_at", mode="before")
    @classmethod
    def _dt_to_str(cls, v):
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)
