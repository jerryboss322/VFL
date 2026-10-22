from app.schemas.base import DualCaseModel


class ErrorOut(DualCaseModel):
    code: str
    message: str
    detail: str | None = None
    details: dict | None = None
