from app.schemas.base import DualCaseModel


class OddsOptionOut(DualCaseModel):
    odds_id: str
    version: int
    outcome: str
    label: str
    decimal: float
    suspended: bool = False


class MarketOut(DualCaseModel):
    key: str
    category: str | None = None
    label: str | None = None
    options: list[OddsOptionOut]


class FixtureOddsOut(DualCaseModel):
    fixture_id: str
    version: int = 1
    markets: list[MarketOut]
