"""
Betting service: bet placement, validation, stake reservation, and settlement.

All money operations use an auditable ledger in integer minor units with
row-level locking (SELECT ... FOR UPDATE) and exact Decimal arithmetic.
"""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.bet import Bet
from app.models.fixture import Fixture
from app.models.ledger import LedgerEntry
from app.models.odds import OddsSnapshot
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.bet import PlaceBetRequest
from app.services.odds_engine import evaluate_selection_outcome


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BettingError(Exception):
    """Raised when a bet cannot be accepted."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


async def _get_active_odds(session: AsyncSession, fixture_id: UUID) -> OddsSnapshot | None:
    result = await session.execute(
        select(OddsSnapshot)
        .where(OddsSnapshot.fixture_id == fixture_id)
        .where(OddsSnapshot.is_active == True)  # noqa: E712
        .order_by(OddsSnapshot.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


LEGACY_ODDS_ID_MAP = {
    "home_win": ("match_winner", "1x2", "home"),
    "draw": ("match_winner", "1x2", "draw"),
    "away_win": ("match_winner", "1x2", "away"),
}


def _find_selection(
    odds: OddsSnapshot, odds_id: str, version: int
) -> dict[str, Any] | None:
    for market in odds.markets or []:
        mkey = market.get("key")
        for option in market.get("options", []):
            opt_id = option.get("odds_id") or option.get("oddsId")
            opt_ver = option.get("version", odds.version)
            if opt_id == odds_id and (opt_ver == version or abs(opt_ver - version) <= 50):
                return {"market": mkey, "option": option}
            # Support legacy short IDs ("home_win", "draw", "away_win") against scoped oddsIds
            if odds_id in LEGACY_ODDS_ID_MAP:
                allowed_m1, allowed_m2, target_outcome = LEGACY_ODDS_ID_MAP[odds_id]
                if mkey in (allowed_m1, allowed_m2) and option.get("outcome") == target_outcome and (opt_ver == version or abs(opt_ver - version) <= 50):
                    return {"market": mkey, "option": option}
    return None


def _extract_fixture_id_from_odds_id(odds_id: str) -> UUID | None:
    if ":" in odds_id:
        prefix = odds_id.split(":", 1)[0]
        try:
            return UUID(prefix)
        except ValueError:
            return None
    return None


async def place_bet(
    session: AsyncSession,
    user: User,
    fixture: Fixture,
    request: PlaceBetRequest,
) -> dict[str, Any]:
    """Place a single or accumulator bet with row-locked stake reservation and ledger audit."""
    result = await session.execute(select(Bet).where(Bet.idempotency_key == request.idempotency_key))
    if result.scalar_one_or_none() is not None:
        raise BettingError("DUPLICATE_BET", "A bet with this idempotency key already exists", 409)

    if getattr(user, "is_admin", False) or getattr(user, "staff_role", "TRADER") not in ("TRADER", None, ""):
        raise BettingError(
            "ADMIN_BETTING_FORBIDDEN",
            "Administrator and staff accounts are restricted to platform monitoring and cannot place bets.",
            403,
        )

    if getattr(settings, "MAINTENANCE_MODE", False):
        raise BettingError(
            "MAINTENANCE_MODE",
            "Platform is in Maintenance Mode: new bets are temporarily disabled while active matches and settlements complete.",
            503,
        )

    if getattr(user, "risk_flag", "NORMAL") == "FROZEN":
        raise BettingError(
            "ACCOUNT_FROZEN",
            "Trading is temporarily frozen on this account by risk compliance.",
            403,
        )

    effective_max_stake = (
        user.custom_max_stake_minor
        if getattr(user, "custom_max_stake_minor", None) is not None
        else settings.MAX_STAKE_MINOR
    )
    if request.stake_minor < settings.MIN_STAKE_MINOR:
        raise BettingError(
            "STAKE_OUT_OF_RANGE",
            f"Minimum stake is {settings.MIN_STAKE_MINOR} minor units",
            409,
        )
    if request.stake_minor > effective_max_stake:
        raise BettingError(
            "STAKE_OUT_OF_RANGE",
            f"Maximum stake for your account is {effective_max_stake} minor units",
            409,
        )

    seen_fixture_ids: set[UUID] = set()
    resolved_selections: list[dict[str, Any]] = []
    combined_decimal = Decimal("1.0")

    for selection in request.selections:
        sel_fixture_id = (
            UUID(selection.fixture_id)
            if selection.fixture_id
            else _extract_fixture_id_from_odds_id(selection.odds_id) or fixture.id
        )

        if sel_fixture_id in seen_fixture_ids:
            raise BettingError(
                "DUPLICATE_MATCH_SELECTION",
                "Only one selection per match is allowed",
                409,
            )
        seen_fixture_ids.add(sel_fixture_id)

        if sel_fixture_id == fixture.id:
            sel_fixture = fixture
        else:
            fx_res = await session.execute(select(Fixture).where(Fixture.id == sel_fixture_id))
            sel_fixture = fx_res.scalar_one_or_none()
            if sel_fixture is None:
                raise BettingError("MARKET_SUSPENDED", "Fixture not found", 409)

        if sel_fixture.status not in ("upcoming", "live"):
            raise BettingError("MARKET_SUSPENDED", "Betting is closed for this fixture", 409)

        odds = await _get_active_odds(session, sel_fixture.id)
        if odds is None:
            raise BettingError("MARKET_SUSPENDED", "No odds available for this fixture", 409)

        sel = _find_selection(odds, selection.odds_id, selection.version)
        if sel is None:
            raise BettingError("ODDS_CHANGED", "The requested odds are no longer available", 409)

        option = sel["option"]
        if option.get("suspended", False):
            raise BettingError("MARKET_SUSPENDED", "This selection is suspended", 409)

        leg_odds = Decimal(str(option.get("decimal", 1.0)))
        combined_decimal *= leg_odds
        opt_id = option.get("odds_id") or option.get("oddsId") or selection.odds_id

        resolved_selections.append(
            {
                "fixture_id": str(sel_fixture.id),
                "fixtureId": str(sel_fixture.id),
                "market": sel["market"],
                "outcome": option.get("outcome"),
                "odds_id": opt_id,
                "oddsId": opt_id,
                "label": option.get("label", selection.odds_id),
                "recorded_odds": float(leg_odds.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "recordedOdds": float(leg_odds.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            }
        )

    # Row-level lock on wallet to prevent double-spend race conditions
    result = await session.execute(
        select(Wallet).where(Wallet.user_id == user.id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise BettingError("INSUFFICIENT_FUNDS", "No wallet found for user", 409)

    if wallet.available_minor < request.stake_minor:
        raise BettingError("INSUFFICIENT_FUNDS", "Insufficient available funds", 409)

    recorded_odds = float(combined_decimal.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))

    wallet.available_minor -= request.stake_minor
    wallet.reserved_minor += request.stake_minor

    bet = Bet(
        user_id=user.id,
        fixture_id=fixture.id,
        idempotency_key=request.idempotency_key,
        stake_minor=request.stake_minor,
        recorded_odds=recorded_odds,
        status="pending",
        placed_at=_now_iso(),
        selections=resolved_selections,
    )
    session.add(bet)
    await session.flush()

    labels_summary = ", ".join(s["label"] for s in resolved_selections)
    session.add(
        LedgerEntry(
            wallet_id=wallet.id,
            user_id=user.id,
            bet_id=bet.id,
            kind="stake_reserve",
            amount_minor=-request.stake_minor,
            balance_after_minor=wallet.available_minor,
            description=f"Stake reserved for bet ({labels_summary})",
            reference=request.idempotency_key,
        )
    )

    await session.commit()
    await session.refresh(bet)
    await session.refresh(wallet)

    return _format_bet_dict(bet, wallet)


def _format_bet_dict(bet: Bet, wallet: Wallet | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(bet.id),
        "status": bet.status,
        "stake_minor": bet.stake_minor,
        "stakeMinor": bet.stake_minor,
        "recorded_odds": float(bet.recorded_odds),
        "recordedOdds": float(bet.recorded_odds),
        "placed_at": bet.placed_at,
        "placedAt": bet.placed_at,
        "settled_at": bet.settled_at,
        "settledAt": bet.settled_at,
        "return_minor": bet.return_minor,
        "returnMinor": bet.return_minor,
        "selections": bet.selections,
    }
    if wallet is not None:
        out["wallet"] = {
            "available_minor": wallet.available_minor,
            "availableMinor": wallet.available_minor,
            "reserved_minor": wallet.reserved_minor,
            "reservedMinor": wallet.reserved_minor,
        }
    return out


async def settle_bet(
    session: AsyncSession,
    bet: Bet,
    fixture: Fixture | None,
    won: bool,
) -> dict[str, Any]:
    """Settle a bet: release reserved stake, credit winnings if won.

    Idempotent: if the bet is already settled, this is a safe no-op.
    """
    if bet.status != "pending":
        return {
            "id": str(bet.id),
            "status": bet.status,
            "return_minor": bet.return_minor,
            "returnMinor": bet.return_minor,
            "settled_at": bet.settled_at,
            "settledAt": bet.settled_at,
        }

    result = await session.execute(
        select(Wallet).where(Wallet.user_id == bet.user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise BettingError("INSUFFICIENT_FUNDS", "No wallet found", 409)

    wallet.reserved_minor = max(0, wallet.reserved_minor - bet.stake_minor)

    return_minor: int | None = None
    if won:
        exact_return = (
            Decimal(bet.stake_minor) * Decimal(str(bet.recorded_odds))
        ).to_integral_value(rounding=ROUND_HALF_UP)
        return_minor = int(exact_return)
        wallet.available_minor += return_minor

        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=bet.user_id,
                bet_id=bet.id,
                kind="settlement_win",
                amount_minor=return_minor,
                balance_after_minor=wallet.available_minor,
                description=f"Bet won: return {return_minor} minor units",
                reference=str(bet.id),
            )
        )
    else:
        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=bet.user_id,
                bet_id=bet.id,
                kind="settlement_loss",
                amount_minor=0,
                balance_after_minor=wallet.available_minor,
                description="Bet lost: reserved stake forfeited",
                reference=str(bet.id),
            )
        )

    bet.status = "won" if won else "lost"
    bet.return_minor = return_minor
    bet.settled_at = _now_iso()

    await session.commit()
    await session.refresh(bet)
    await session.refresh(wallet)

    return _format_bet_dict(bet, wallet)


async def cashout_bet(
    session: AsyncSession,
    user: User,
    bet: Bet,
    percentage: int = 100,
) -> dict[str, Any]:
    """Early Cash-Out for a pending bet: releases reserved stake and credits a fair buyout (full or partial)."""
    if bet.user_id != user.id:
        raise BettingError("FORBIDDEN", "Not your bet", 403)
    if bet.status != "pending":
        raise BettingError("INVALID_STATE", f"Bet is already {bet.status}", 409)
    if percentage < 1 or percentage > 100:
        raise BettingError("INVALID_PERCENTAGE", "Cashout percentage must be between 1 and 100", 400)

    result = await session.execute(
        select(Wallet).where(Wallet.user_id == bet.user_id).with_for_update()
    )
    wallet = result.scalar_one_or_none()
    if wallet is None:
        raise BettingError("INSUFFICIENT_FUNDS", "No wallet found", 409)

    cashed_stake_minor = int(
        (Decimal(bet.stake_minor) * (Decimal(percentage) / Decimal(100))).to_integral_value(rounding=ROUND_HALF_UP)
    )
    if cashed_stake_minor <= 0:
        cashed_stake_minor = 1

    # Calculate fair cash-out buyout (92% of cashed stake)
    cashout_minor = int(
        (Decimal(cashed_stake_minor) * Decimal("0.92")).to_integral_value(rounding=ROUND_HALF_UP)
    )

    wallet.reserved_minor = max(0, wallet.reserved_minor - cashed_stake_minor)
    wallet.available_minor += cashout_minor

    if percentage >= 100 or cashed_stake_minor >= bet.stake_minor:
        bet.status = "void"
        bet.return_minor = (bet.return_minor or 0) + cashout_minor
        bet.settled_at = _now_iso()
        desc = f"Early Cash-Out settled ({cashout_minor} minor units credited)"
        ref = f"cashout:{bet.id}"
    else:
        # Partial Cash-Out: deduct cashed stake, leave remaining stake pending
        bet.stake_minor -= cashed_stake_minor
        bet.return_minor = (bet.return_minor or 0) + cashout_minor
        desc = f"Partial Cash-Out ({percentage}%): {cashout_minor} credited, {bet.stake_minor} stake remains active"
        ref = f"cashout:{bet.id}:{percentage}%"

    session.add(
        LedgerEntry(
            wallet_id=wallet.id,
            user_id=bet.user_id,
            bet_id=bet.id,
            kind="cashout_settlement",
            amount_minor=cashout_minor,
            balance_after_minor=wallet.available_minor,
            description=desc,
            reference=ref,
        )
    )

    await session.commit()
    await session.refresh(bet)
    await session.refresh(wallet)
    return _format_bet_dict(bet, wallet)


async def auto_settle_fixture_bets(session: AsyncSession, fixture: Fixture) -> list[dict[str, Any]]:
    """Automatically evaluate and settle all pending bets whose legs are all completed."""
    if fixture.status != "completed":
        return []

    from app.models.match_event import MatchEvent

    result = await session.execute(select(Bet).where(Bet.status == "pending"))
    pending_bets = result.scalars().all()
    settled_results: list[dict[str, Any]] = []
    events_cache: dict[str, list[dict[str, Any]]] = {}

    async def _load_events_for_fixture(fid_str: str) -> list[dict[str, Any]]:
        if fid_str in events_cache:
            return events_cache[fid_str]
        try:
            ev_res = await session.execute(
                select(MatchEvent)
                .where(MatchEvent.fixture_id == UUID(fid_str))
                .order_by(MatchEvent.event_seq.asc())
            )
            evs = [
                {
                    "event_seq": e.event_seq,
                    "event_type": e.event_type,
                    "minute": e.minute,
                    "club_id": str(e.club_id) if e.club_id else None,
                    "payload": e.payload,
                }
                for e in ev_res.scalars().all()
            ]
        except Exception:
            evs = []
        events_cache[fid_str] = evs
        return evs

    for bet in pending_bets:
        selections = bet.selections or []
        leg_fixture_ids = {
            str(s.get("fixture_id") or s.get("fixtureId") or bet.fixture_id)
            for s in selections
        }
        if str(fixture.id) not in leg_fixture_ids and bet.fixture_id != fixture.id:
            continue

        all_completed = True
        all_won = True

        for s in selections:
            fid_str = str(s.get("fixture_id") or s.get("fixtureId") or bet.fixture_id)
            if fid_str == str(fixture.id):
                fx = fixture
            else:
                fx_res = await session.execute(select(Fixture).where(Fixture.id == UUID(fid_str)))
                fx = fx_res.scalar_one_or_none()

            if fx is None or fx.status != "completed":
                all_completed = False
                break

            fx_events = await _load_events_for_fixture(fid_str)

            leg_won = evaluate_selection_outcome(
                market_key=s.get("market", "match_winner"),
                outcome=s.get("outcome"),
                label=s.get("label", ""),
                odds_id=s.get("odds_id") or s.get("oddsId"),
                home_goals=fx.home_goals or 0,
                away_goals=fx.away_goals or 0,
                events=fx_events,
            )
            if not leg_won:
                all_won = False

        if all_completed:
            settled = await settle_bet(session, bet, fixture, won=all_won)
            settled_results.append(settled)

    return settled_results
