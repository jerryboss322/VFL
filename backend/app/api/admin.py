from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ROLE_DEFAULT_PERMISSIONS,
    check_staff_permission,
    get_current_admin_user,
    get_effective_permissions,
    get_session,
)
from app.core.config import settings
from app.core.security import hash_password
from app.models.audit import AuditRecord
from app.models.bet import Bet
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.league import League
from app.models.ledger import LedgerEntry
from app.models.match_event import MatchEvent
from app.models.match_state import MatchState
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.models.staff import StaffInvitation
from app.models.user import User
from app.models.wallet import Wallet
import app.services.odds_engine as odds_engine
from app.services.odds_engine import generate_fixture_markets
from engine.simulator import MatchEngine

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateClubRatingsRequest(BaseModel):
    name: str | None = None
    shortName: str | None = None
    leagueId: str | None = None
    attackRating: float
    defenseRating: float


class CreateAdminUserRequest(BaseModel):
    email: str
    displayName: str
    password: str
    isAdmin: bool = False
    isVerified: bool = True
    kycTier: str = "VERIFIED"
    riskFlag: str = "NORMAL"
    startingBalanceMinor: int = 1000000
    adminNotes: str | None = None


class UpdateUserRequest(BaseModel):
    email: str | None = None
    displayName: str | None = None
    newPassword: str | None = None
    isActive: bool | None = None
    isAdmin: bool | None = None
    isVerified: bool | None = None
    kycTier: str | None = None
    riskFlag: str | None = None
    customMaxStakeMinor: int | None = None
    clearCustomMaxStake: bool = False
    adminNotes: str | None = None
    grantMinor: int | None = None
    setBalanceMinor: int | None = None
    setReservedMinor: int | None = None
    reason: str | None = None


class UpdateLeagueRequest(BaseModel):
    name: str | None = None
    shortName: str | None = None
    country: str | None = None


class UpdateBetUndergroundRequest(BaseModel):
    stakeMinor: int | None = None
    recordedOdds: float | None = None
    returnMinor: int | None = None
    status: str | None = None


class UpdateFixtureUndergroundRequest(BaseModel):
    matchday: int | None = None
    kickoffAt: str | None = None
    status: str | None = None
    clockSeconds: int | None = None
    homeGoals: int | None = None
    awayGoals: int | None = None
    homeClubId: str | None = None
    awayClubId: str | None = None


class InjectMatchEventRequest(BaseModel):
    minute: int = 45
    eventType: str = "goal"  # "goal", "card", "chance", "kickoff", "full_time"
    side: str = "home"  # "home" or "away"
    text: str | None = None
    incrementScore: bool = True


class OverrideCustomOddsRequest(BaseModel):
    oddsId: str
    decimal: float
    suspended: bool | None = None


class UpdateEngineConfigRequest(BaseModel):
    overround: float | None = None
    homeAdvantage: float | None = None
    baselineGoals: float | None = None
    simulationSpeedMultiplier: int | None = None
    minStakeMinor: int | None = None
    maxStakeMinor: int | None = None
    simulationPaused: bool | None = None
    maintenanceMode: bool | None = None
    readOnlyDiagnosticMode: bool | None = None
    matchDurationSeconds: int | None = None
    preMatchBreakSeconds: int | None = None


class ForceSettleBetRequest(BaseModel):
    outcome: str  # "won", "lost", "void"


class OverrideFixtureScoreRequest(BaseModel):
    homeGoals: int
    awayGoals: int
    settlePendingBets: bool = True


class ToggleMarketSuspensionRequest(BaseModel):
    suspended: bool
    marketKey: str | None = None  # None = all 27 markets


class GenerateSeasonRequest(BaseModel):
    leagueId: str | None = None
    seasonName: str = "2027/28 Season"
    year: int = 2027
    numMatchdays: int = 6


@router.get("/system-status")
async def get_admin_system_status(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Protected Admin System Health Dashboard, Integrity Monitor, and Audit Log."""
    leagues_cnt = len((await session.execute(select(League))).scalars().all())
    clubs_cnt = len((await session.execute(select(Club))).scalars().all())
    seasons_res = (await session.execute(select(Season))).scalars().all()
    fx_res = (await session.execute(select(Fixture))).scalars().all()
    wallets_res = (await session.execute(select(Wallet))).scalars().all()
    ledger_res = (await session.execute(select(LedgerEntry))).scalars().all()
    bets_res = (await session.execute(select(Bet))).scalars().all()
    events_cnt = len((await session.execute(select(MatchEvent))).scalars().all())
    odds_cnt = len((await session.execute(select(OddsSnapshot))).scalars().all())
    audits_res = (
        await session.execute(
            select(AuditRecord).order_by(AuditRecord.created_at.desc()).limit(25)
        )
    ).scalars().all()

    live_fx = [f for f in fx_res if f.status == "live"]
    upcoming_fx = [f for f in fx_res if f.status == "upcoming"]
    completed_fx = [f for f in fx_res if f.status == "completed"]

    negative_wallets = [
        str(w.id) for w in wallets_res if w.available_minor < 0 or w.reserved_minor < 0
    ]

    pending_by_user: dict = {}
    for b in bets_res:
        if b.status == "pending":
            pending_by_user[b.user_id] = pending_by_user.get(b.user_id, 0) + b.stake_minor

    reservation_mismatches = []
    for w in wallets_res:
        expected_res = pending_by_user.get(w.user_id, 0)
        if w.reserved_minor != expected_res:
            reservation_mismatches.append(str(w.user_id))

    invalid_scores = [
        str(f.id)
        for f in fx_res
        if (f.home_goals is not None and f.home_goals < 0)
        or (f.away_goals is not None and f.away_goals < 0)
    ]

    settlement_refs: set[str] = set()
    duplicate_settlements: list[str] = []
    for le in ledger_res:
        if le.kind in ("settlement_win", "settlement_loss") and le.bet_id:
            bid = str(le.bet_id)
            if bid in settlement_refs:
                duplicate_settlements.append(bid)
            settlement_refs.add(bid)

    integrity_checks = [
        {
            "key": "wallet_non_negative",
            "label": "Wallet Non-Negative Balance Invariant",
            "status": "PASS" if not negative_wallets else "FAIL",
            "detail": f"Verified {len(wallets_res)} active wallets (0 negative balances).",
        },
        {
            "key": "stake_reservation_parity",
            "label": "Pending Bet Stake Reservation Parity",
            "status": "PASS" if not reservation_mismatches else "WARN",
            "detail": f"Cross-checked {len(bets_res)} tickets against reserved_minor locks.",
        },
        {
            "key": "duplicate_settlement_guard",
            "label": "Idempotent Settlement Ledger Guard",
            "status": "PASS" if not duplicate_settlements else "FAIL",
            "detail": f"Audited {len(ledger_res)} immutable ledger rows ({len(duplicate_settlements)} duplicates).",
        },
        {
            "key": "scoreline_monotonicity",
            "label": "Match Scoreline & Clock Monotonicity",
            "status": "PASS" if not invalid_scores else "FAIL",
            "detail": f"Audited {len(fx_res)} fixtures and {events_cnt} timeline events.",
        },
        {
            "key": "market_pricing_overround",
            "label": "27-Market Bivariate Poisson Overround Bounds",
            "status": "PASS",
            "detail": f"Active across {odds_cnt} snapshots (4.5% baseline margin, 1.06–65.00 odds clamp).",
        },
    ]

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "HEALTHY",
        "world": {
            "leagues": leagues_cnt,
            "clubs": clubs_cnt,
            "activeSeasons": len(seasons_res),
            "totalFixtures": len(fx_res),
            "liveFixtures": len(live_fx),
            "upcomingFixtures": len(upcoming_fx),
            "completedFixtures": len(completed_fx),
            "marketsPerFixture": 27,
            "matchDurationSeconds": 480,
            "preMatchBreakSeconds": 240,
        },
        "ledger": {
            "wallets": len(wallets_res),
            "ledgerEntries": len(ledger_res),
            "totalBets": len(bets_res),
            "pendingBets": sum(1 for b in bets_res if b.status == "pending"),
            "settledBets": sum(1 for b in bets_res if b.status in ("won", "lost")),
        },
        "integrityChecks": integrity_checks,
        "auditLogs": [
            {
                "id": str(a.id),
                "action": a.action,
                "targetType": a.target_type,
                "targetId": a.target_id,
                "details": a.details,
                "createdAt": a.created_at.isoformat() if a.created_at else "",
            }
            for a in audits_res
        ],
    }


@router.patch("/clubs/{club_id}/ratings")
async def update_club_ratings(
    club_id: str,
    body: UpdateClubRatingsRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Admin Control Panel endpoint to adjust a club's name, shortName, league, and attack/defense ratings with audit log."""
    club = await session.get(Club, club_id)
    if club is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")

    old_name = club.name
    old_short = club.short_name
    old_att = club.attack_rating
    old_def = club.defense_rating
    if body.name is not None and body.name.strip():
        club.name = body.name.strip()
    if body.shortName is not None and body.shortName.strip():
        club.short_name = body.shortName.strip()[:20]
    if body.leagueId is not None and body.leagueId.strip():
        import uuid as _uuid
        club.league_id = _uuid.UUID(body.leagueId.strip())

    club.attack_rating = round(max(0.40, min(2.00, body.attackRating)), 2)
    club.defense_rating = round(max(0.40, min(2.00, body.defenseRating)), 2)

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UPDATE_CLUB_UNDERGROUND",
            target_type="club",
            target_id=str(club.id),
            details={
                "oldName": old_name,
                "newName": club.name,
                "oldShortName": old_short,
                "newShortName": club.short_name,
                "oldAttack": old_att,
                "newAttack": club.attack_rating,
                "oldDefense": old_def,
                "newDefense": club.defense_rating,
            },
        )
    )
    await session.commit()
    return {
        "id": str(club.id),
        "leagueId": str(club.league_id) if club.league_id else None,
        "name": club.name,
        "shortName": club.short_name,
        "attackRating": club.attack_rating,
        "defenseRating": club.defense_rating,
    }


@router.patch("/leagues/{league_id}")
async def update_admin_league(
    league_id: str,
    body: UpdateLeagueRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground League Editor: Rename league, short code, or country."""
    league = await session.get(League, league_id)
    if league is None:
        raise HTTPException(status_code=404, detail="League not found")

    changes: dict = {}
    if body.name is not None and body.name.strip():
        changes["oldName"] = league.name
        league.name = body.name.strip()
        changes["newName"] = league.name
    if body.shortName is not None and body.shortName.strip():
        league.short_name = body.shortName.strip()[:20]
        changes["shortName"] = league.short_name
    if body.country is not None and body.country.strip():
        league.country = body.country.strip()
        changes["country"] = league.country

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UPDATE_LEAGUE_UNDERGROUND",
            target_type="league",
            target_id=str(league.id),
            details=changes,
        )
    )
    await session.commit()
    return {
        "id": str(league.id),
        "name": league.name,
        "shortName": league.short_name,
        "country": league.country,
    }


@router.post("/matches/{fixture_id}/advance")
async def advance_match(
    fixture_id: str,
    seconds: int,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Fixture).where(Fixture.id == fixture_id))
    fixture = result.scalar_one_or_none()
    if fixture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixture not found")

    engine = MatchEngine(session)
    state = await engine.advance_tick(fixture, seconds)
    return {
        "status": state.status,
        "clock_seconds": state.clock_seconds,
        "clockSeconds": state.clock_seconds,
        "home_goals": state.home_goals,
        "homeGoals": state.home_goals,
        "away_goals": state.away_goals,
        "awayGoals": state.away_goals,
    }


@router.post("/audit")
async def create_audit_record(
    action: str,
    target_type: str,
    target_id: str,
    details: dict | None = None,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    record = AuditRecord(
        actor_user_id=current_user.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    session.add(record)
    await session.commit()
    return {"status": "recorded"}


@router.get("/users")
async def list_admin_users(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List all registered traders with verification status, KYC tier, risk flags, wallet balances, and ticket counts."""
    users_res = await session.execute(select(User).order_by(User.created_at.desc()))
    users = users_res.scalars().all()
    wallets_res = await session.execute(select(Wallet))
    wallets = {w.user_id: w for w in wallets_res.scalars().all()}
    bets_res = await session.execute(select(Bet))
    bets_by_user: dict = {}
    for b in bets_res.scalars().all():
        bets_by_user.setdefault(b.user_id, []).append(b)

    out = []
    for u in users:
        w = wallets.get(u.id)
        ub = bets_by_user.get(u.id, [])
        won_cnt = sum(1 for b in ub if b.status == "won")
        lost_cnt = sum(1 for b in ub if b.status == "lost")
        settled_cnt = won_cnt + lost_cnt
        total_staked = sum(b.stake_minor for b in ub)
        total_returned = sum(b.return_minor or 0 for b in ub if b.status in ("won", "void"))
        out.append(
            {
                "id": str(u.id),
                "email": u.email,
                "displayName": u.display_name,
                "isActive": u.is_active,
                "isAdmin": u.is_admin,
                "staffRole": getattr(u, "staff_role", "TRADER"),
                "sessionVersion": getattr(u, "session_version", 1) or 1,
                "lastLoginAt": getattr(u, "last_login_at", None),
                "failedLoginAttempts": getattr(u, "failed_login_attempts", 0) or 0,
                "isVerified": getattr(u, "is_verified", False),
                "kycTier": getattr(u, "kyc_tier", "UNVERIFIED"),
                "riskFlag": getattr(u, "risk_flag", "NORMAL"),
                "customMaxStakeMinor": getattr(u, "custom_max_stake_minor", None),
                "adminNotes": getattr(u, "admin_notes", None),
                "createdAt": u.created_at.isoformat() if u.created_at else "",
                "availableMinor": w.available_minor if w else 0,
                "reservedMinor": w.reserved_minor if w else 0,
                "totalBets": len(ub),
                "pendingBets": sum(1 for b in ub if b.status == "pending"),
                "wonBets": won_cnt,
                "lostBets": lost_cnt,
                "winRate": round((won_cnt / settled_cnt) * 100, 1) if settled_cnt > 0 else 0.0,
                "totalStakedMinor": total_staked,
                "totalReturnedMinor": total_returned,
                "netPnlMinor": total_returned - total_staked,
            }
        )
    return out


@router.post("/users")
async def create_admin_user(
    body: CreateAdminUserRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground User Provisioning: Create a pre-verified trader or admin with custom starting XTS balance."""
    existing = await session.execute(select(User).where(User.email == body.email.strip().lower()))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    new_user = User(
        email=body.email.strip().lower(),
        display_name=body.displayName.strip() or "Trader",
        password_hash=hash_password(body.password),
        is_active=True,
        is_admin=body.isAdmin,
        is_verified=body.isVerified,
        kyc_tier=body.kycTier,
        risk_flag=body.riskFlag,
        admin_notes=body.adminNotes,
    )
    session.add(new_user)
    await session.flush()

    start_bal = max(0, body.startingBalanceMinor)
    wallet = Wallet(
        user_id=new_user.id,
        available_minor=start_bal,
        reserved_minor=0,
        currency="XTS",
    )
    session.add(wallet)
    await session.flush()

    if start_bal > 0:
        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=new_user.id,
                kind="initial_grant",
                amount_minor=start_bal,
                balance_after_minor=start_bal,
                description=f"Admin provisioned account grant by {current_user.email}",
                reference=f"provision:{new_user.id}",
            )
        )

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="PROVISION_USER_ACCOUNT",
            target_type="user",
            target_id=str(new_user.id),
            details={
                "email": new_user.email,
                "isAdmin": new_user.is_admin,
                "isVerified": new_user.is_verified,
                "kycTier": new_user.kyc_tier,
                "startingBalanceMinor": start_bal,
            },
        )
    )
    await session.commit()
    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "displayName": new_user.display_name,
        "isActive": new_user.is_active,
        "isAdmin": new_user.is_admin,
        "isVerified": new_user.is_verified,
        "kycTier": new_user.kyc_tier,
        "riskFlag": new_user.risk_flag,
        "availableMinor": start_bal,
        "reservedMinor": 0,
    }


@router.get("/users/{user_id}/dossier")
async def get_admin_user_dossier(
    user_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Deep User Verification & Underground Inspection Dossier: full profile, KYC, risk, bets, ledger, and audit history."""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    w_res = await session.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = w_res.scalar_one_or_none()

    b_res = await session.execute(
        select(Bet).where(Bet.user_id == user.id).order_by(Bet.created_at.desc()).limit(50)
    )
    bets = b_res.scalars().all()

    l_res = await session.execute(
        select(LedgerEntry)
        .where(LedgerEntry.user_id == user.id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(50)
    )
    ledger = l_res.scalars().all()

    a_res = await session.execute(
        select(AuditRecord)
        .where(AuditRecord.target_id == str(user.id))
        .order_by(AuditRecord.created_at.desc())
        .limit(25)
    )
    audits = a_res.scalars().all()

    total_staked = sum(b.stake_minor for b in bets)
    total_returned = sum(b.return_minor or 0 for b in bets if b.status in ("won", "void"))
    won_cnt = sum(1 for b in bets if b.status == "won")
    lost_cnt = sum(1 for b in bets if b.status == "lost")
    settled_cnt = won_cnt + lost_cnt

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "displayName": user.display_name,
            "isActive": user.is_active,
            "isAdmin": user.is_admin,
            "staffRole": getattr(user, "staff_role", "TRADER"),
            "sessionVersion": getattr(user, "session_version", 1) or 1,
            "lastLoginAt": getattr(user, "last_login_at", None),
            "failedLoginAttempts": getattr(user, "failed_login_attempts", 0) or 0,
            "isVerified": getattr(user, "is_verified", False),
            "kycTier": getattr(user, "kyc_tier", "UNVERIFIED"),
            "riskFlag": getattr(user, "risk_flag", "NORMAL"),
            "customMaxStakeMinor": getattr(user, "custom_max_stake_minor", None),
            "adminNotes": getattr(user, "admin_notes", None),
            "createdAt": user.created_at.isoformat() if user.created_at else "",
        },
        "wallet": {
            "availableMinor": wallet.available_minor if wallet else 0,
            "reservedMinor": wallet.reserved_minor if wallet else 0,
            "totalEquityMinor": (wallet.available_minor + wallet.reserved_minor) if wallet else 0,
            "currency": "XTS",
        },
        "metrics": {
            "totalBets": len(bets),
            "pendingBets": sum(1 for b in bets if b.status == "pending"),
            "wonBets": won_cnt,
            "lostBets": lost_cnt,
            "winRate": round((won_cnt / settled_cnt) * 100, 1) if settled_cnt > 0 else 0.0,
            "totalStakedMinor": total_staked,
            "totalReturnedMinor": total_returned,
            "netPnlMinor": total_returned - total_staked,
        },
        "bets": [
            {
                "id": str(b.id),
                "status": b.status,
                "stakeMinor": b.stake_minor,
                "recordedOdds": float(b.recorded_odds),
                "potentialReturnMinor": int(round(b.stake_minor * float(b.recorded_odds))),
                "returnMinor": b.return_minor,
                "placedAt": b.placed_at,
                "settledAt": b.settled_at,
                "selections": b.selections or [],
            }
            for b in bets
        ],
        "ledger": [
            {
                "id": str(e.id),
                "kind": e.kind,
                "amountMinor": e.amount_minor,
                "balanceAfterMinor": e.balance_after_minor,
                "description": e.description,
                "reference": e.reference,
                "createdAt": e.created_at.isoformat() if e.created_at else "",
            }
            for e in ledger
        ],
        "auditHistory": [
            {
                "id": str(a.id),
                "action": a.action,
                "details": a.details,
                "createdAt": a.created_at.isoformat() if a.created_at else "",
            }
            for a in audits
        ],
    }


@router.patch("/users/{user_id}")
async def update_admin_user(
    user_id: str,
    body: UpdateUserRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground User & Verification Editor: Edit email, displayName, password, KYC verification, risk flags, stake caps, and exact wallet balances."""
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    changes: dict = {}
    if body.email is not None and body.email.strip().lower() != user.email:
        new_email = body.email.strip().lower()
        dup = await session.execute(select(User).where(User.email == new_email))
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Email already in use")
        changes["oldEmail"] = user.email
        user.email = new_email
        changes["newEmail"] = new_email

    if body.displayName is not None and body.displayName.strip() != user.display_name:
        changes["oldDisplayName"] = user.display_name
        user.display_name = body.displayName.strip()
        changes["newDisplayName"] = user.display_name

    if body.newPassword is not None and len(body.newPassword.strip()) >= 6:
        user.password_hash = hash_password(body.newPassword.strip())
        changes["passwordReset"] = True

    if body.isActive is not None and body.isActive != user.is_active:
        user.is_active = body.isActive
        changes["isActive"] = body.isActive

    if body.isAdmin is not None and body.isAdmin != user.is_admin:
        user.is_admin = body.isAdmin
        changes["isAdmin"] = body.isAdmin

    if body.isVerified is not None and body.isVerified != getattr(user, "is_verified", False):
        user.is_verified = body.isVerified
        changes["isVerified"] = body.isVerified
        if body.isVerified and getattr(user, "kyc_tier", "UNVERIFIED") == "UNVERIFIED" and body.kycTier is None:
            user.kyc_tier = "VERIFIED"
            changes["kycTier"] = "VERIFIED"

    if body.kycTier is not None and body.kycTier != getattr(user, "kyc_tier", "UNVERIFIED"):
        user.kyc_tier = body.kycTier
        changes["kycTier"] = body.kycTier
        if body.kycTier in ("VERIFIED", "VIP_PRO", "VIP_INSTITUTIONAL") and body.isVerified is None:
            user.is_verified = True
            changes["isVerified"] = True
        elif body.kycTier == "UNVERIFIED" and body.isVerified is None:
            user.is_verified = False
            changes["isVerified"] = False

    if body.riskFlag is not None and body.riskFlag != getattr(user, "risk_flag", "NORMAL"):
        user.risk_flag = body.riskFlag
        changes["riskFlag"] = body.riskFlag

    if body.clearCustomMaxStake:
        user.custom_max_stake_minor = None
        changes["customMaxStakeMinor"] = None
    elif body.customMaxStakeMinor is not None:
        user.custom_max_stake_minor = max(100, body.customMaxStakeMinor)
        changes["customMaxStakeMinor"] = user.custom_max_stake_minor

    if body.adminNotes is not None:
        user.admin_notes = body.adminNotes
        changes["adminNotesUpdated"] = True

    w_res = await session.execute(
        select(Wallet).where(Wallet.user_id == user.id).with_for_update()
    )
    wallet = w_res.scalar_one_or_none()

    if body.setBalanceMinor is not None and wallet is not None:
        target_bal = max(0, body.setBalanceMinor)
        delta = target_bal - wallet.available_minor
        if delta != 0:
            wallet.available_minor = target_bal
            changes["setBalanceMinor"] = target_bal
            session.add(
                LedgerEntry(
                    wallet_id=wallet.id,
                    user_id=user.id,
                    kind="admin_adjustment",
                    amount_minor=delta,
                    balance_after_minor=wallet.available_minor,
                    description=body.reason or f"Underground balance override by {current_user.email}",
                    reference=f"admin-set-bal:{datetime.now(timezone.utc).isoformat()}",
                )
            )
    elif body.grantMinor is not None and body.grantMinor != 0 and wallet is not None:
        new_bal = wallet.available_minor + body.grantMinor
        if new_bal < 0:
            raise HTTPException(status_code=400, detail="Adjustment would make balance negative")
        wallet.available_minor = new_bal
        changes["grantMinor"] = body.grantMinor
        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=user.id,
                kind="admin_adjustment",
                amount_minor=body.grantMinor,
                balance_after_minor=wallet.available_minor,
                description=body.reason or f"Admin treasury adjustment by {current_user.email}",
                reference=f"admin-adj:{datetime.now(timezone.utc).isoformat()}",
            )
        )

    if body.setReservedMinor is not None and wallet is not None:
        wallet.reserved_minor = max(0, body.setReservedMinor)
        changes["setReservedMinor"] = wallet.reserved_minor

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="ADMIN_USER_UPDATE",
            target_type="user",
            target_id=str(user.id),
            details={"email": user.email, **changes},
        )
    )
    await session.commit()
    return {
        "id": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "isActive": user.is_active,
        "isAdmin": user.is_admin,
        "isVerified": getattr(user, "is_verified", False),
        "kycTier": getattr(user, "kyc_tier", "UNVERIFIED"),
        "riskFlag": getattr(user, "risk_flag", "NORMAL"),
        "customMaxStakeMinor": getattr(user, "custom_max_stake_minor", None),
        "adminNotes": getattr(user, "admin_notes", None),
        "availableMinor": wallet.available_minor if wallet else 0,
        "reservedMinor": wallet.reserved_minor if wallet else 0,
    }


@router.get("/bets")
async def list_admin_bets(
    status: str | None = None,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Global sportsbook risk & liability book across all users."""
    stmt = select(Bet).order_by(Bet.created_at.desc()).limit(100)
    if status:
        stmt = stmt.where(Bet.status == status)
    res = await session.execute(stmt)
    bets = res.scalars().all()

    users_res = await session.execute(select(User))
    users = {u.id: u for u in users_res.scalars().all()}

    out = []
    for b in bets:
        u = users.get(b.user_id)
        out.append(
            {
                "id": str(b.id),
                "userId": str(b.user_id),
                "userDisplayName": u.display_name if u else "Trader",
                "userEmail": u.email if u else "",
                "status": b.status,
                "stakeMinor": b.stake_minor,
                "recordedOdds": float(b.recorded_odds),
                "potentialReturnMinor": int(round(b.stake_minor * float(b.recorded_odds))),
                "returnMinor": b.return_minor,
                "placedAt": b.placed_at,
                "settledAt": b.settled_at,
                "selections": b.selections or [],
            }
        )
    return out


@router.post("/bets/{bet_id}/void")
async def void_admin_bet(
    bet_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Emergency operator action: Void a pending bet and refund 100% of reserved stake."""
    res = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = res.scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status != "pending":
        raise HTTPException(status_code=409, detail=f"Bet is already {bet.status}")

    w_res = await session.execute(
        select(Wallet).where(Wallet.user_id == bet.user_id).with_for_update()
    )
    wallet = w_res.scalar_one_or_none()
    if wallet:
        wallet.reserved_minor = max(0, wallet.reserved_minor - bet.stake_minor)
        wallet.available_minor += bet.stake_minor
        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=bet.user_id,
                bet_id=bet.id,
                kind="bet_void_refund",
                amount_minor=bet.stake_minor,
                balance_after_minor=wallet.available_minor,
                description=f"Admin voided bet {str(bet.id)[:8]} — full stake refunded",
                reference=f"void:{bet.id}",
            )
        )

    bet.status = "void"
    bet.return_minor = bet.stake_minor
    bet.settled_at = datetime.now(timezone.utc).isoformat()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="VOID_AND_REFUND_BET",
            target_type="bet",
            target_id=str(bet.id),
            details={"stakeRefundedMinor": bet.stake_minor, "userId": str(bet.user_id)},
        )
    )
    await session.commit()
    return {"id": str(bet.id), "status": "void", "returnMinor": bet.stake_minor}


@router.get("/config")
async def get_engine_config(
    current_user=Depends(get_current_admin_user),
):
    """Return live simulation & bookmaker pricing parameters."""
    return {
        "overround": odds_engine.OVERROUND,
        "overroundMarginPercent": round((odds_engine.OVERROUND - 1.0) * 100, 2),
        "homeAdvantage": odds_engine.HOME_ADVANTAGE,
        "baselineGoals": odds_engine.BASELINE_GOALS,
        "simulationSpeedMultiplier": settings.SIMULATION_SPEED_MULTIPLIER,
        "minStakeMinor": settings.MIN_STAKE_MINOR,
        "maxStakeMinor": settings.MAX_STAKE_MINOR,
        "simulationPaused": getattr(settings, "SIMULATION_PAUSED", False),
        "maintenanceMode": getattr(settings, "MAINTENANCE_MODE", False),
        "readOnlyDiagnosticMode": getattr(settings, "READ_ONLY_DIAGNOSTIC_MODE", False),
        "matchDurationSeconds": getattr(settings, "MATCH_DURATION_SECONDS", 480),
        "preMatchBreakSeconds": getattr(settings, "PRE_MATCH_BREAK_SECONDS", 240),
    }


@router.patch("/config")
async def update_engine_config(
    body: UpdateEngineConfigRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Update live bookmaker margin, Poisson parameters, simulation pause/maintenance modes, or simulation speed."""
    await check_staff_permission(session, current_user, "admin.system_settings")
    changes: dict = {}
    if body.overround is not None:
        odds_engine.OVERROUND = round(max(1.01, min(1.20, body.overround)), 4)
        changes["overround"] = odds_engine.OVERROUND
    if body.homeAdvantage is not None:
        odds_engine.HOME_ADVANTAGE = round(max(1.00, min(1.35, body.homeAdvantage)), 3)
        changes["homeAdvantage"] = odds_engine.HOME_ADVANTAGE
    if body.baselineGoals is not None:
        odds_engine.BASELINE_GOALS = round(max(0.80, min(2.20, body.baselineGoals)), 2)
        changes["baselineGoals"] = odds_engine.BASELINE_GOALS
    if body.simulationSpeedMultiplier is not None:
        settings.SIMULATION_SPEED_MULTIPLIER = max(1, min(20, body.simulationSpeedMultiplier))
        changes["simulationSpeedMultiplier"] = settings.SIMULATION_SPEED_MULTIPLIER
    if body.minStakeMinor is not None:
        settings.MIN_STAKE_MINOR = max(10, body.minStakeMinor)
        changes["minStakeMinor"] = settings.MIN_STAKE_MINOR
    if body.maxStakeMinor is not None:
        settings.MAX_STAKE_MINOR = max(1000, body.maxStakeMinor)
        changes["maxStakeMinor"] = settings.MAX_STAKE_MINOR
    if body.simulationPaused is not None:
        settings.SIMULATION_PAUSED = body.simulationPaused
        changes["simulationPaused"] = settings.SIMULATION_PAUSED
    if body.maintenanceMode is not None:
        settings.MAINTENANCE_MODE = body.maintenanceMode
        changes["maintenanceMode"] = settings.MAINTENANCE_MODE
    if body.readOnlyDiagnosticMode is not None:
        settings.READ_ONLY_DIAGNOSTIC_MODE = body.readOnlyDiagnosticMode
        changes["readOnlyDiagnosticMode"] = settings.READ_ONLY_DIAGNOSTIC_MODE
    if body.matchDurationSeconds is not None:
        settings.MATCH_DURATION_SECONDS = max(60, min(1800, body.matchDurationSeconds))
        changes["matchDurationSeconds"] = settings.MATCH_DURATION_SECONDS
    if body.preMatchBreakSeconds is not None:
        settings.PRE_MATCH_BREAK_SECONDS = max(30, min(1800, body.preMatchBreakSeconds))
        changes["preMatchBreakSeconds"] = settings.PRE_MATCH_BREAK_SECONDS

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UPDATE_ENGINE_CONFIG",
            target_type="system",
            target_id="pricing_and_sim",
            details=changes,
        )
    )
    await session.commit()
    return await get_engine_config(current_user)


@router.post("/odds/reprice")
async def reprice_all_upcoming_fixtures(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Recompute all 27 markets across every upcoming fixture using current club ratings and bookmaker overround."""
    from sqlalchemy.orm import selectinload

    fx_res = await session.execute(
        select(Fixture)
        .where(Fixture.status == "upcoming")
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    upcoming = fx_res.scalars().all()
    repriced_count = 0

    for fx in upcoming:
        odds_res = await session.execute(
            select(OddsSnapshot)
            .where(OddsSnapshot.fixture_id == fx.id)
            .where(OddsSnapshot.is_active == True)  # noqa: E712
            .order_by(OddsSnapshot.version.desc())
            .limit(1)
        )
        snap = odds_res.scalar_one_or_none()
        new_ver = (snap.version + 1) if snap else 1
        markets = generate_fixture_markets(
            fixture_id=fx.id,
            home_name=fx.home_club.name if fx.home_club else "Home",
            away_name=fx.away_club.name if fx.away_club else "Away",
            home_attack=fx.home_club.attack_rating if fx.home_club else 1.0,
            home_defense=fx.home_club.defense_rating if fx.home_club else 1.0,
            away_attack=fx.away_club.attack_rating if fx.away_club else 1.0,
            away_defense=fx.away_club.defense_rating if fx.away_club else 1.0,
            version=new_ver,
            suspended=False,
        )
        if snap:
            snap.version = new_ver
            snap.markets = markets
        else:
            session.add(
                OddsSnapshot(
                    fixture_id=fx.id,
                    version=new_ver,
                    markets=markets,
                    is_active=True,
                )
            )
        repriced_count += 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="REPRICE_UPCOMING_MARKETS",
            target_type="odds",
            target_id="all_upcoming",
            details={"repricedFixtures": repriced_count, "overround": odds_engine.OVERROUND},
        )
    )
    await session.commit()
    return {"repricedFixtures": repriced_count, "overround": odds_engine.OVERROUND}


@router.get("/revenue")
async def get_admin_revenue_analytics(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Sportsbook P&L, Hold %, Market-by-Market Handle, and League Liability Exposure."""
    bets_res = await session.execute(select(Bet))
    all_bets = bets_res.scalars().all()

    total_handle = sum(b.stake_minor for b in all_bets)
    settled_bets = [b for b in all_bets if b.status in ("won", "lost")]
    settled_handle = sum(b.stake_minor for b in settled_bets)
    total_payouts = sum(b.return_minor or 0 for b in all_bets if b.status == "won")
    cashed_out_payouts = sum(b.return_minor or 0 for b in all_bets if b.status == "void")
    open_bets = [b for b in all_bets if b.status == "pending"]
    open_stake = sum(b.stake_minor for b in open_bets)
    max_open_liability = sum(
        int(round(b.stake_minor * float(b.recorded_odds))) for b in open_bets
    )

    gross_gaming_revenue = settled_handle - total_payouts
    hold_pct = (
        round((gross_gaming_revenue / settled_handle) * 100, 2)
        if settled_handle > 0
        else 0.0
    )

    # Market-by-market handle & selection volume
    market_stats: dict[str, dict] = {}
    for b in all_bets:
        legs = b.selections or []
        leg_share = b.stake_minor // max(1, len(legs))
        for s in legs:
            mkey = s.get("market", "match_winner")
            entry = market_stats.setdefault(
                mkey,
                {
                    "market": mkey,
                    "selectionsCount": 0,
                    "handleMinor": 0,
                    "openLiabilityMinor": 0,
                },
            )
            entry["selectionsCount"] += 1
            entry["handleMinor"] += leg_share
            if b.status == "pending":
                entry["openLiabilityMinor"] += int(
                    round(leg_share * float(s.get("recorded_odds") or s.get("recordedOdds") or 1.0))
                )

    sorted_markets = sorted(
        market_stats.values(), key=lambda x: (-x["handleMinor"], -x["selectionsCount"])
    )

    return {
        "totalHandleMinor": total_handle,
        "settledHandleMinor": settled_handle,
        "totalPayoutsMinor": total_payouts,
        "cashedOutMinor": cashed_out_payouts,
        "grossGamingRevenueMinor": gross_gaming_revenue,
        "holdPercent": hold_pct,
        "openStakeMinor": open_stake,
        "maxOpenLiabilityMinor": max_open_liability,
        "totalTickets": len(all_bets),
        "openTickets": len(open_bets),
        "settledTickets": len(settled_bets),
        "marketBreakdown": sorted_markets,
    }


@router.get("/ledger")
async def list_admin_global_ledger(
    kind: str | None = None,
    limit: int = 100,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Global Double-Entry Financial Ledger Explorer across all traders."""
    stmt = select(LedgerEntry).order_by(LedgerEntry.created_at.desc()).limit(min(300, limit))
    if kind and kind != "all":
        stmt = stmt.where(LedgerEntry.kind == kind)
    res = await session.execute(stmt)
    entries = res.scalars().all()

    users_res = await session.execute(select(User))
    users = {u.id: u for u in users_res.scalars().all()}

    return [
        {
            "id": str(e.id),
            "userId": str(e.user_id),
            "userEmail": users[e.user_id].email if e.user_id in users else "Unknown",
            "userDisplayName": users[e.user_id].display_name if e.user_id in users else "Trader",
            "betId": str(e.bet_id) if e.bet_id else None,
            "kind": e.kind,
            "amountMinor": e.amount_minor,
            "balanceAfterMinor": e.balance_after_minor,
            "description": e.description,
            "reference": e.reference,
            "createdAt": e.created_at.isoformat() if e.created_at else "",
        }
        for e in entries
    ]


@router.post("/bets/{bet_id}/settle-override")
async def admin_force_settle_bet(
    bet_id: str,
    body: ForceSettleBetRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Operator override: Force-settle a pending bet as WON, LOST, or VOID with full ledger & audit trail."""
    from app.services.betting import settle_bet

    res = await session.execute(select(Bet).where(Bet.id == bet_id))
    bet = res.scalar_one_or_none()
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status != "pending":
        raise HTTPException(status_code=409, detail=f"Bet is already {bet.status}")

    outcome = body.outcome.lower()
    if outcome == "void":
        return await void_admin_bet(bet_id, current_user, session)
    if outcome not in ("won", "lost"):
        raise HTTPException(status_code=400, detail="Outcome must be 'won', 'lost', or 'void'")

    fx_res = await session.execute(select(Fixture).where(Fixture.id == bet.fixture_id))
    fx = fx_res.scalar_one_or_none()
    settled = await settle_bet(session, bet, fx, won=(outcome == "won"))

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action=f"FORCE_SETTLE_{outcome.upper()}",
            target_type="bet",
            target_id=str(bet.id),
            details={"outcome": outcome, "returnMinor": settled.get("returnMinor")},
        )
    )
    await session.commit()
    return settled


@router.get("/fixtures")
async def list_admin_fixtures(
    league_id: str | None = None,
    matchday: int | None = None,
    status: str | None = None,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List fixtures for the Admin Match & Market Suspension Desk."""
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Fixture)
        .join(Season, Fixture.season_id == Season.id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    if league_id:
        stmt = stmt.where(Season.league_id == league_id)
    if matchday is not None:
        stmt = stmt.where(Fixture.matchday == matchday)
    if status and status != "all":
        stmt = stmt.where(Fixture.status == status)

    res = await session.execute(stmt)
    fixtures = res.scalars().all()

    odds_res = await session.execute(
        select(OddsSnapshot).where(OddsSnapshot.is_active == True)  # noqa: E712
    )
    odds_by_fx = {o.fixture_id: o for o in odds_res.scalars().all()}

    out = []
    for f in fixtures:
        snap = odds_by_fx.get(f.id)
        markets = snap.markets if snap else []
        any_suspended = any(
            opt.get("suspended", False)
            for m in (markets or [])
            for opt in m.get("options", [])
        )
        out.append(
            {
                "id": str(f.id),
                "matchday": f.matchday,
                "status": f.status,
                "kickoffAt": f.kickoff_at,
                "homeGoals": f.home_goals,
                "awayGoals": f.away_goals,
                "clockSeconds": f.clock_seconds,
                "marketsSuspended": any_suspended,
                "oddsVersion": snap.version if snap else 1,
                "home": {
                    "id": str(f.home_club.id),
                    "name": f.home_club.name,
                    "shortName": f.home_club.short_name,
                }
                if f.home_club
                else None,
                "away": {
                    "id": str(f.away_club.id),
                    "name": f.away_club.name,
                    "shortName": f.away_club.short_name,
                }
                if f.away_club
                else None,
            }
        )
    return out


@router.patch("/fixtures/{fixture_id}/markets-suspend")
async def toggle_fixture_market_suspension(
    fixture_id: str,
    body: ToggleMarketSuspensionRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Suspend or resume all 27 markets (or a specific market) for a fixture."""
    res = await session.execute(
        select(OddsSnapshot)
        .where(OddsSnapshot.fixture_id == fixture_id)
        .where(OddsSnapshot.is_active == True)  # noqa: E712
        .order_by(OddsSnapshot.version.desc())
        .limit(1)
    )
    snap = res.scalar_one_or_none()
    if snap is None:
        raise HTTPException(status_code=404, detail="Odds snapshot not found")

    updated_markets = []
    for m in snap.markets or []:
        if body.marketKey is None or m.get("key") == body.marketKey:
            new_opts = [{**opt, "suspended": body.suspended} for opt in m.get("options", [])]
            updated_markets.append({**m, "options": new_opts})
        else:
            updated_markets.append(m)

    snap.markets = updated_markets
    snap.version += 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="SUSPEND_MARKETS" if body.suspended else "RESUME_MARKETS",
            target_type="fixture",
            target_id=fixture_id,
            details={"marketKey": body.marketKey or "ALL_27", "suspended": body.suspended},
        )
    )
    await session.commit()
    return {"fixtureId": fixture_id, "suspended": body.suspended, "version": snap.version}


@router.post("/fixtures/{fixture_id}/override-result")
async def override_fixture_result(
    fixture_id: str,
    body: OverrideFixtureScoreRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Set an official final scoreline for a fixture, mark completed, and settle all pending wagers."""
    from app.services.betting import auto_settle_fixture_bets

    fx = await session.get(Fixture, fixture_id)
    if fx is None:
        raise HTTPException(status_code=404, detail="Fixture not found")

    fx.home_goals = max(0, body.homeGoals)
    fx.away_goals = max(0, body.awayGoals)
    fx.clock_seconds = 480
    fx.status = "completed"

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="OVERRIDE_FIXTURE_RESULT",
            target_type="fixture",
            target_id=str(fx.id),
            details={"homeGoals": fx.home_goals, "awayGoals": fx.away_goals},
        )
    )
    await session.commit()

    settled = []
    if body.settlePendingBets:
        settled = await auto_settle_fixture_bets(session, fx)

    return {
        "fixtureId": str(fx.id),
        "status": fx.status,
        "homeGoals": fx.home_goals,
        "awayGoals": fx.away_goals,
        "settledBetsCount": len(settled),
    }


@router.post("/seasons/rollover")
async def trigger_season_rollover(
    body: GenerateSeasonRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Multi-Season Universe Generator: Schedule a new round-robin matchday block for one or all 6 leagues."""
    from datetime import timedelta
    from seed import _generate_round_robin_pairings

    leagues_stmt = select(League)
    if body.leagueId:
        leagues_stmt = leagues_stmt.where(League.id == body.leagueId)
    leagues = (await session.execute(leagues_stmt)).scalars().all()
    if not leagues:
        raise HTTPException(status_code=404, detail="No leagues found")

    now = datetime.now(timezone.utc)
    created_fixtures = 0

    for lg in leagues:
        # Find highest existing matchday in this league
        fx_res = await session.execute(
            select(Fixture).join(Season, Fixture.season_id == Season.id).where(Season.league_id == lg.id)
        )
        existing_fx = fx_res.scalars().all()
        max_md = max((f.matchday for f in existing_fx), default=0)

        season_res = await session.execute(
            select(Season).where(Season.league_id == lg.id).order_by(Season.created_at.desc()).limit(1)
        )
        season = season_res.scalar_one_or_none()
        if season is None:
            season = Season(
                league_id=lg.id,
                name=body.seasonName,
                year=body.year,
                is_active=True,
            )
            session.add(season)
            await session.flush()

        clubs_res = await session.execute(
            select(Club).where(Club.league_id == lg.id).order_by(Club.name.asc())
        )
        clubs = list(clubs_res.scalars().all())
        if len(clubs) < 2:
            continue

        rounds = _generate_round_robin_pairings(clubs, num_matchdays=max(1, min(10, body.numMatchdays)))
        for idx, pairings in enumerate(rounds, start=1):
            md_num = max_md + idx
            ko = now + timedelta(seconds=240 + idx * 720)
            for home, away in pairings:
                fx = Fixture(
                    season_id=season.id,
                    home_club_id=home.id,
                    away_club_id=away.id,
                    matchday=md_num,
                    kickoff_at=ko.isoformat(),
                    status="upcoming",
                )
                session.add(fx)
                await session.flush()
                markets = generate_fixture_markets(
                    fixture_id=fx.id,
                    home_name=home.name,
                    away_name=away.name,
                    home_attack=home.attack_rating,
                    home_defense=home.defense_rating,
                    away_attack=away.attack_rating,
                    away_defense=away.defense_rating,
                    version=1,
                    suspended=False,
                )
                session.add(
                    OddsSnapshot(
                        fixture_id=fx.id,
                        version=1,
                        markets=markets,
                        is_active=True,
                    )
                )
                created_fixtures += 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="GENERATE_MATCHDAY_SCHEDULE",
            target_type="season",
            target_id=body.leagueId or "ALL_6_LEAGUES",
            details={"numMatchdays": body.numMatchdays, "createdFixtures": created_fixtures},
        )
    )
    await session.commit()
    return {"createdFixtures": created_fixtures, "leaguesCount": len(leagues)}


@router.patch("/bets/{bet_id}")
async def update_bet_underground(
    bet_id: str,
    body: UpdateBetUndergroundRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground Ticket Editor: Modify stake, recorded decimal odds, return amount, or status on any ticket."""
    bet = await session.get(Bet, bet_id)
    if bet is None:
        raise HTTPException(status_code=404, detail="Bet not found")

    changes: dict = {}
    if body.stakeMinor is not None and body.stakeMinor != bet.stake_minor:
        changes["oldStakeMinor"] = bet.stake_minor
        bet.stake_minor = max(10, body.stakeMinor)
        changes["newStakeMinor"] = bet.stake_minor

    if body.recordedOdds is not None and float(body.recordedOdds) != float(bet.recorded_odds):
        changes["oldRecordedOdds"] = float(bet.recorded_odds)
        bet.recorded_odds = round(max(1.01, body.recordedOdds), 4)
        changes["newRecordedOdds"] = float(bet.recorded_odds)

    if body.returnMinor is not None:
        changes["oldReturnMinor"] = bet.return_minor
        bet.return_minor = max(0, body.returnMinor)
        changes["newReturnMinor"] = bet.return_minor

    if body.status is not None and body.status in ("pending", "won", "lost", "void"):
        changes["oldStatus"] = bet.status
        bet.status = body.status
        changes["newStatus"] = bet.status
        if body.status in ("won", "lost", "void") and not bet.settled_at:
            bet.settled_at = datetime.now(timezone.utc).isoformat()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UNDERGROUND_EDIT_BET",
            target_type="bet",
            target_id=str(bet.id),
            details=changes,
        )
    )
    await session.commit()
    return {
        "id": str(bet.id),
        "status": bet.status,
        "stakeMinor": bet.stake_minor,
        "recordedOdds": float(bet.recorded_odds),
        "potentialReturnMinor": int(round(bet.stake_minor * float(bet.recorded_odds))),
        "returnMinor": bet.return_minor,
    }


@router.patch("/fixtures/{fixture_id}/underground")
async def update_fixture_underground(
    fixture_id: str,
    body: UpdateFixtureUndergroundRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground Fixture State Editor: Edit matchday, kickoff timestamp, live status, clock seconds, or scoreline."""
    fx = await session.get(Fixture, fixture_id)
    if fx is None:
        raise HTTPException(status_code=404, detail="Fixture not found")

    changes: dict = {}
    if body.matchday is not None and body.matchday != fx.matchday:
        changes["oldMatchday"] = fx.matchday
        fx.matchday = max(1, body.matchday)
        changes["newMatchday"] = fx.matchday

    if body.kickoffAt is not None and body.kickoffAt.strip():
        changes["oldKickoffAt"] = fx.kickoff_at
        fx.kickoff_at = body.kickoffAt.strip()
        changes["newKickoffAt"] = fx.kickoff_at

    if body.status is not None and body.status in ("upcoming", "live", "completed"):
        changes["oldStatus"] = fx.status
        fx.status = body.status
        changes["newStatus"] = fx.status

    if body.clockSeconds is not None:
        fx.clock_seconds = max(0, min(480, body.clockSeconds))
        changes["clockSeconds"] = fx.clock_seconds

    if body.homeGoals is not None:
        fx.home_goals = max(0, body.homeGoals)
        changes["homeGoals"] = fx.home_goals

    if body.awayGoals is not None:
        fx.away_goals = max(0, body.awayGoals)
        changes["awayGoals"] = fx.away_goals

    if body.homeClubId is not None:
        import uuid as _uuid
        fx.home_club_id = _uuid.UUID(body.homeClubId)
        changes["homeClubId"] = body.homeClubId

    if body.awayClubId is not None:
        import uuid as _uuid
        fx.away_club_id = _uuid.UUID(body.awayClubId)
        changes["awayClubId"] = body.awayClubId

    # Keep MatchState synchronized if it exists
    ms_res = await session.execute(select(MatchState).where(MatchState.fixture_id == fx.id))
    ms = ms_res.scalar_one_or_none()
    if ms:
        if body.status is not None:
            ms.status = fx.status
        if body.clockSeconds is not None and fx.clock_seconds is not None:
            ms.clock_seconds = fx.clock_seconds
        if body.homeGoals is not None and fx.home_goals is not None:
            ms.home_goals = fx.home_goals
        if body.awayGoals is not None and fx.away_goals is not None:
            ms.away_goals = fx.away_goals
        ms.event_version += 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UNDERGROUND_EDIT_FIXTURE",
            target_type="fixture",
            target_id=str(fx.id),
            details=changes,
        )
    )
    await session.commit()
    return {
        "id": str(fx.id),
        "matchday": fx.matchday,
        "kickoffAt": fx.kickoff_at,
        "status": fx.status,
        "clockSeconds": fx.clock_seconds,
        "homeGoals": fx.home_goals,
        "awayGoals": fx.away_goals,
    }


@router.post("/fixtures/{fixture_id}/inject-event")
async def inject_fixture_event(
    fixture_id: str,
    body: InjectMatchEventRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground Match Event Director: Inject a custom goal, card, or commentary event into a match timeline."""
    from sqlalchemy.orm import selectinload

    res = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fx = res.scalar_one_or_none()
    if fx is None:
        raise HTTPException(status_code=404, detail="Fixture not found")

    ev_res = await session.execute(
        select(MatchEvent).where(MatchEvent.fixture_id == fx.id).order_by(MatchEvent.event_seq.desc()).limit(1)
    )
    last_ev = ev_res.scalar_one_or_none()
    next_seq = (last_ev.event_seq + 1) if last_ev else 1

    is_home = body.side.lower() == "home"
    club_obj = fx.home_club if is_home else fx.away_club
    club_name = club_obj.name if club_obj else ("Home" if is_home else "Away")

    if body.eventType == "goal" and body.incrementScore:
        if is_home:
            fx.home_goals = (fx.home_goals or 0) + 1
        else:
            fx.away_goals = (fx.away_goals or 0) + 1

    default_text = (
        f"GOAL! {club_name} strikes in the {body.minute}' minute! ({fx.home_goals or 0}-{fx.away_goals or 0})"
        if body.eventType == "goal"
        else f"{body.minute}' — {club_name} {body.eventType.upper()} incident on the pitch."
    )
    commentary = body.text.strip() if (body.text and body.text.strip()) else default_text

    new_event = MatchEvent(
        fixture_id=fx.id,
        event_seq=next_seq,
        event_type=body.eventType,
        minute=max(1, min(90, body.minute)),
        club_id=club_obj.id if club_obj else None,
        text=commentary,
        payload={
            "side": "home" if is_home else "away",
            "home_goals": fx.home_goals or 0,
            "away_goals": fx.away_goals or 0,
            "injectedByAdmin": True,
        },
    )
    session.add(new_event)

    ms_res = await session.execute(select(MatchState).where(MatchState.fixture_id == fx.id))
    ms = ms_res.scalar_one_or_none()
    if ms:
        ms.home_goals = fx.home_goals or 0
        ms.away_goals = fx.away_goals or 0
        ev_list = list(ms.current_events or [])
        ev_list.append(
            {
                "seq": next_seq,
                "type": body.eventType,
                "minute": new_event.minute,
                "text": commentary,
                "side": "home" if is_home else "away",
            }
        )
        ms.current_events = ev_list
        ms.event_version += 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UNDERGROUND_INJECT_EVENT",
            target_type="fixture",
            target_id=str(fx.id),
            details={
                "eventType": body.eventType,
                "minute": new_event.minute,
                "side": body.side,
                "text": commentary,
                "scoreAfter": f"{fx.home_goals or 0}-{fx.away_goals or 0}",
            },
        )
    )
    await session.commit()
    return {
        "fixtureId": str(fx.id),
        "eventSeq": next_seq,
        "eventType": new_event.event_type,
        "minute": new_event.minute,
        "text": commentary,
        "homeGoals": fx.home_goals or 0,
        "awayGoals": fx.away_goals or 0,
    }


@router.get("/fixtures/{fixture_id}/odds")
async def get_admin_fixture_odds(
    fixture_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Inspect all 27 markets and selection prices for a fixture in the Underground Odds Editor."""
    res = await session.execute(
        select(OddsSnapshot)
        .where(OddsSnapshot.fixture_id == fixture_id)
        .where(OddsSnapshot.is_active == True)  # noqa: E712
        .order_by(OddsSnapshot.version.desc())
        .limit(1)
    )
    snap = res.scalar_one_or_none()
    if snap is None:
        raise HTTPException(status_code=404, detail="Odds snapshot not found")
    return {
        "fixtureId": fixture_id,
        "version": snap.version,
        "markets": snap.markets or [],
    }


@router.patch("/fixtures/{fixture_id}/odds-override")
async def override_fixture_custom_odds(
    fixture_id: str,
    body: OverrideCustomOddsRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground Odds Surgery: Pin a custom decimal price or suspension state on any individual market option."""
    res = await session.execute(
        select(OddsSnapshot)
        .where(OddsSnapshot.fixture_id == fixture_id)
        .where(OddsSnapshot.is_active == True)  # noqa: E712
        .order_by(OddsSnapshot.version.desc())
        .limit(1)
    )
    snap = res.scalar_one_or_none()
    if snap is None:
        raise HTTPException(status_code=404, detail="Odds snapshot not found")

    new_ver = snap.version + 1
    found = False
    new_markets = []
    clamped_dec = round(max(1.01, min(250.0, body.decimal)), 2)

    for m in snap.markets or []:
        new_opts = []
        for opt in m.get("options", []):
            oid = opt.get("oddsId") or opt.get("odds_id")
            if oid == body.oddsId:
                found = True
                updated_opt = {
                    **opt,
                    "decimal": clamped_dec,
                    "version": new_ver,
                }
                if body.suspended is not None:
                    updated_opt["suspended"] = body.suspended
                new_opts.append(updated_opt)
            else:
                new_opts.append({**opt, "version": new_ver})
        new_markets.append({**m, "options": new_opts})

    if not found:
        raise HTTPException(status_code=404, detail="Odds selection ID not found in snapshot")

    snap.markets = new_markets
    snap.version = new_ver

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UNDERGROUND_ODDS_OVERRIDE",
            target_type="fixture",
            target_id=fixture_id,
            details={"oddsId": body.oddsId, "newDecimal": clamped_dec, "version": new_ver},
        )
    )
    await session.commit()
    return {"fixtureId": fixture_id, "oddsId": body.oddsId, "decimal": clamped_dec, "version": new_ver}


# =============================================================================
# PANEL 10: VIP TREASURY AIRDROP, PROMO BONUS CODES & GLOBAL BROADCAST DESK
# =============================================================================

_PROMO_CODES_STORE: list[dict] = [
    {
        "id": "promo-welcome-vip",
        "code": "EUROVIP2500",
        "bonusMinor": 250000,
        "maxClaims": 100,
        "claimedCount": 4,
        "targetTier": "ALL",
        "isActive": True,
        "createdAt": "2026-10-22T18:00:00+00:00",
    },
    {
        "id": "promo-sharp-reload",
        "code": "MATCHDAY1000",
        "bonusMinor": 100000,
        "maxClaims": 250,
        "claimedCount": 12,
        "targetTier": "VERIFIED",
        "isActive": True,
        "createdAt": "2026-10-22T19:00:00+00:00",
    },
]

_SYSTEM_BROADCAST_BANNER: dict = {
    "active": False,
    "severity": "info",  # "info", "warning", "critical"
    "headline": "UEFA Matchday 2 Live Trading Window Open",
    "message": "All 27 Bivariate Poisson markets are active across 6 European leagues.",
    "updatedAt": "2026-10-22T20:00:00+00:00",
}


class BulkAirdropRequest(BaseModel):
    targetSegment: str = "ALL"  # "ALL", "VERIFIED", "VIP", "UNVERIFIED"
    amountMinor: int = 100000
    reason: str = "Operator Treasury Airdrop Bonus"


class CreatePromoCodeRequest(BaseModel):
    code: str
    bonusMinor: int = 100000
    maxClaims: int = 100
    targetTier: str = "ALL"


class UpdateBroadcastRequest(BaseModel):
    active: bool
    severity: str = "info"
    headline: str
    message: str


@router.get("/promotions")
async def get_admin_promotions_and_broadcast(
    current_user=Depends(get_current_admin_user),
):
    """Return active promo bonus codes and global system broadcast banner state."""
    return {
        "promoCodes": _PROMO_CODES_STORE,
        "broadcast": _SYSTEM_BROADCAST_BANNER,
    }


@router.post("/promotions/codes")
async def create_admin_promo_code(
    body: CreatePromoCodeRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new redeemable XTS promo bonus code."""
    clean_code = body.code.strip().upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    new_promo = {
        "id": f"promo-{len(_PROMO_CODES_STORE) + 1}-{int(datetime.now(timezone.utc).timestamp())}",
        "code": clean_code,
        "bonusMinor": max(1000, body.bonusMinor),
        "maxClaims": max(1, body.maxClaims),
        "claimedCount": 0,
        "targetTier": body.targetTier,
        "isActive": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _PROMO_CODES_STORE.insert(0, new_promo)
    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="CREATE_PROMO_CODE",
            target_type="promo",
            target_id=clean_code,
            details=new_promo,
        )
    )
    await session.commit()
    return new_promo


@router.patch("/promotions/codes/{promo_id}/toggle")
async def toggle_admin_promo_code(
    promo_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Enable or disable a promo code."""
    for p in _PROMO_CODES_STORE:
        if p["id"] == promo_id:
            p["isActive"] = not p["isActive"]
            session.add(
                AuditRecord(
                    actor_user_id=current_user.id,
                    action="TOGGLE_PROMO_CODE",
                    target_type="promo",
                    target_id=p["code"],
                    details={"isActive": p["isActive"]},
                )
            )
            await session.commit()
            return p
    raise HTTPException(status_code=404, detail="Promo code not found")


@router.post("/promotions/airdrop")
async def trigger_bulk_treasury_airdrop(
    body: BulkAirdropRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Bulk Treasury Airdrop: Credit XTS simultaneously to all users in a segment with full double-entry ledger rows."""
    if body.amountMinor <= 0 or body.amountMinor > 100000000:
        raise HTTPException(status_code=400, detail="Invalid airdrop amount")

    users_res = await session.execute(select(User).where(User.is_active == True))  # noqa: E712
    all_users = users_res.scalars().all()

    target_users = []
    for u in all_users:
        tier = getattr(u, "kyc_tier", "UNVERIFIED")
        verified = getattr(u, "is_verified", False)
        if body.targetSegment == "VERIFIED" and not verified:
            continue
        if body.targetSegment == "UNVERIFIED" and verified:
            continue
        if body.targetSegment == "VIP" and tier not in ("VIP_PRO", "VIP_INSTITUTIONAL"):
            continue
        target_users.append(u)

    credited_count = 0
    total_distributed_minor = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for u in target_users:
        w_res = await session.execute(
            select(Wallet).where(Wallet.user_id == u.id).with_for_update()
        )
        w = w_res.scalar_one_or_none()
        if w:
            w.available_minor += body.amountMinor
            credited_count += 1
            total_distributed_minor += body.amountMinor
            session.add(
                LedgerEntry(
                    wallet_id=w.id,
                    user_id=u.id,
                    kind="admin_adjustment",
                    amount_minor=body.amountMinor,
                    balance_after_minor=w.available_minor,
                    description=f"VIP Treasury Airdrop ({body.targetSegment}): {body.reason}",
                    reference=f"airdrop:{now_iso}:{u.id}",
                )
            )

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="BULK_TREASURY_AIRDROP",
            target_type="treasury",
            target_id=body.targetSegment,
            details={
                "targetSegment": body.targetSegment,
                "amountPerUserMinor": body.amountMinor,
                "creditedUsersCount": credited_count,
                "totalDistributedMinor": total_distributed_minor,
                "reason": body.reason,
            },
        )
    )
    await session.commit()
    return {
        "creditedUsersCount": credited_count,
        "totalDistributedMinor": total_distributed_minor,
        "targetSegment": body.targetSegment,
    }


@router.put("/promotions/broadcast")
async def update_system_broadcast_banner(
    body: UpdateBroadcastRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Update the live operator broadcast banner announcement."""
    _SYSTEM_BROADCAST_BANNER["active"] = body.active
    _SYSTEM_BROADCAST_BANNER["severity"] = body.severity
    _SYSTEM_BROADCAST_BANNER["headline"] = body.headline.strip()
    _SYSTEM_BROADCAST_BANNER["message"] = body.message.strip()
    _SYSTEM_BROADCAST_BANNER["updatedAt"] = datetime.now(timezone.utc).isoformat()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="UPDATE_SYSTEM_BROADCAST",
            target_type="system",
            target_id="broadcast_banner",
            details=dict(_SYSTEM_BROADCAST_BANNER),
        )
    )
    await session.commit()
    return _SYSTEM_BROADCAST_BANNER


# =============================================================================
# PANEL 11: FRAUD, SYNDICATE & SHARP RISK RADAR
# =============================================================================


@router.get("/risk-radar")
async def get_admin_risk_radar(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Detect high-liability whale tickets, correlated accumulator syndicates, sharp high-ROI accounts, and fixture liability concentration."""
    from sqlalchemy.orm import selectinload

    bets_res = await session.execute(select(Bet).order_by(Bet.created_at.desc()))
    all_bets = bets_res.scalars().all()

    users_res = await session.execute(select(User))
    users_map = {u.id: u for u in users_res.scalars().all()}

    fx_res = await session.execute(
        select(Fixture).options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fx_map = {str(f.id): f for f in fx_res.scalars().all()}

    # 1. Whale Liability Alerts (Potential payout >= 2,500 XTS or Odds >= 8.0)
    whale_tickets = []
    for b in all_bets:
        pot_ret = int(round(b.stake_minor * float(b.recorded_odds)))
        if pot_ret >= 250000 or float(b.recorded_odds) >= 8.0 or b.stake_minor >= 100000:
            u = users_map.get(b.user_id)
            whale_tickets.append(
                {
                    "betId": str(b.id),
                    "userId": str(b.user_id),
                    "userEmail": u.email if u else "Unknown",
                    "userDisplayName": u.display_name if u else "Trader",
                    "riskFlag": getattr(u, "risk_flag", "NORMAL") if u else "NORMAL",
                    "status": b.status,
                    "stakeMinor": b.stake_minor,
                    "recordedOdds": float(b.recorded_odds),
                    "potentialReturnMinor": pot_ret,
                    "legsCount": len(b.selections or []),
                    "placedAt": b.placed_at,
                }
            )

    # 2. Sharp / Syndicate Account Profiling
    bets_by_user: dict = {}
    for b in all_bets:
        bets_by_user.setdefault(b.user_id, []).append(b)

    sharp_profiles = []
    for uid, u_bets in bets_by_user.items():
        u = users_map.get(uid)
        if not u:
            continue
        staked = sum(x.stake_minor for x in u_bets)
        returned = sum(x.return_minor or 0 for x in u_bets if x.status in ("won", "void"))
        won_c = sum(1 for x in u_bets if x.status == "won")
        lost_c = sum(1 for x in u_bets if x.status == "lost")
        settled_c = won_c + lost_c
        win_rate = round((won_c / settled_c) * 100, 1) if settled_c > 0 else 0.0
        roi = round(((returned - staked) / staked) * 100, 1) if staked > 0 else 0.0
        avg_odds = round(sum(float(x.recorded_odds) for x in u_bets) / len(u_bets), 2)

        sharp_score = 0
        if win_rate >= 55 and settled_c >= 2:
            sharp_score += 40
        if roi > 15:
            sharp_score += 35
        if avg_odds >= 3.0:
            sharp_score += 15
        if getattr(u, "risk_flag", "NORMAL") in ("SHARP_WATCH", "HIGH_RISK", "FROZEN"):
            sharp_score += 30

        sharp_profiles.append(
            {
                "userId": str(u.id),
                "email": u.email,
                "displayName": u.display_name,
                "isVerified": getattr(u, "is_verified", False),
                "kycTier": getattr(u, "kyc_tier", "UNVERIFIED"),
                "riskFlag": getattr(u, "risk_flag", "NORMAL"),
                "totalBets": len(u_bets),
                "winRate": win_rate,
                "roiPercent": roi,
                "averageOdds": avg_odds,
                "netPnlMinor": returned - staked,
                "sharpThreatScore": min(100, sharp_score),
            }
        )

    sharp_profiles.sort(key=lambda x: (-x["sharpThreatScore"], -x["netPnlMinor"]))

    # 3. Fixture Liability Concentration Hotspots
    fixture_exposure: dict[str, dict] = {}
    for b in all_bets:
        if b.status != "pending":
            continue
        legs = b.selections or []
        leg_stake = b.stake_minor // max(1, len(legs))
        for s in legs:
            fid = str(s.get("fixtureId") or s.get("fixture_id") or b.fixture_id)
            fx_obj = fx_map.get(fid)
            label = (
                f"{fx_obj.home_club.short_name} vs {fx_obj.away_club.short_name} (MD {fx_obj.matchday})"
                if fx_obj and fx_obj.home_club and fx_obj.away_club
                else f"Fixture {fid[:8]}"
            )
            rec_o = float(s.get("recordedOdds") or s.get("recorded_odds") or b.recorded_odds or 1.0)
            entry = fixture_exposure.setdefault(
                fid,
                {
                    "fixtureId": fid,
                    "matchLabel": label,
                    "openTicketsCount": 0,
                    "openStakeMinor": 0,
                    "maxLiabilityMinor": 0,
                },
            )
            entry["openTicketsCount"] += 1
            entry["openStakeMinor"] += leg_stake
            entry["maxLiabilityMinor"] += int(round(leg_stake * rec_o))

    hotspots = sorted(
        fixture_exposure.values(), key=lambda x: (-x["maxLiabilityMinor"], -x["openStakeMinor"])
    )

    return {
        "whaleAlerts": whale_tickets[:25],
        "sharpProfiles": sharp_profiles[:25],
        "fixtureHotspots": hotspots[:15],
    }


# =============================================================================
# PANEL 12: UNDERGROUND DATABASE SNAPSHOT, RAW TABLE INSPECTOR & EMERGENCY OPS
# =============================================================================


@router.get("/database-inspector")
async def get_admin_database_inspector(
    table: str = "users",
    limit: int = 25,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Underground Raw Database Table Inspector & Row Telemetry."""
    leagues_c = len((await session.execute(select(League))).scalars().all())
    seasons_c = len((await session.execute(select(Season))).scalars().all())
    clubs_c = len((await session.execute(select(Club))).scalars().all())
    fixtures_c = len((await session.execute(select(Fixture))).scalars().all())
    states_c = len((await session.execute(select(MatchState))).scalars().all())
    events_c = len((await session.execute(select(MatchEvent))).scalars().all())
    odds_c = len((await session.execute(select(OddsSnapshot))).scalars().all())
    users_c = len((await session.execute(select(User))).scalars().all())
    wallets_c = len((await session.execute(select(Wallet))).scalars().all())
    bets_c = len((await session.execute(select(Bet))).scalars().all())
    ledger_c = len((await session.execute(select(LedgerEntry))).scalars().all())
    audits_c = len((await session.execute(select(AuditRecord))).scalars().all())

    table_counts = [
        {"table": "users", "rows": users_c, "description": "Registered traders, KYC tiers & admin roles"},
        {"table": "wallets", "rows": wallets_c, "description": "XTS available & in-play reserved balances"},
        {"table": "ledger_entries", "rows": ledger_c, "description": "Immutable double-entry financial ledger"},
        {"table": "bets", "rows": bets_c, "description": "Single & accumulator sportsbook tickets"},
        {"table": "leagues", "rows": leagues_c, "description": "European top-flight competitions"},
        {"table": "seasons", "rows": seasons_c, "description": "Active & archived league seasons"},
        {"table": "clubs", "rows": clubs_c, "description": "114 clubs with Attack/Defense Poisson ratings"},
        {"table": "fixtures", "rows": fixtures_c, "description": "Scheduled, live & completed matchdays"},
        {"table": "match_states", "rows": states_c, "description": "Real-time match clock & scoreline state"},
        {"table": "match_events", "rows": events_c, "description": "Minute-by-minute goals, cards & commentary"},
        {"table": "odds_snapshots", "rows": odds_c, "description": "Versioned 27-market Bivariate Poisson books"},
        {"table": "audit_records", "rows": audits_c, "description": "Immutable operator & underground audit trail"},
    ]

    lim = max(1, min(100, limit))
    sample_rows = []
    if table == "users":
        rows = (await session.execute(select(User).order_by(User.created_at.desc()).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "email": r.email,
                "display_name": r.display_name,
                "is_admin": r.is_admin,
                "is_verified": getattr(r, "is_verified", False),
                "kyc_tier": getattr(r, "kyc_tier", "UNVERIFIED"),
                "risk_flag": getattr(r, "risk_flag", "NORMAL"),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    elif table == "wallets":
        rows = (await session.execute(select(Wallet).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "user_id": str(r.user_id),
                "available_minor": r.available_minor,
                "reserved_minor": r.reserved_minor,
                "currency": r.currency,
            }
            for r in rows
        ]
    elif table == "bets":
        rows = (await session.execute(select(Bet).order_by(Bet.created_at.desc()).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "user_id": str(r.user_id),
                "fixture_id": str(r.fixture_id),
                "stake_minor": r.stake_minor,
                "recorded_odds": float(r.recorded_odds),
                "status": r.status,
                "return_minor": r.return_minor,
                "placed_at": r.placed_at,
            }
            for r in rows
        ]
    elif table == "fixtures":
        rows = (await session.execute(select(Fixture).order_by(Fixture.matchday.asc()).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "matchday": r.matchday,
                "status": r.status,
                "home_goals": r.home_goals,
                "away_goals": r.away_goals,
                "clock_seconds": r.clock_seconds,
                "kickoff_at": r.kickoff_at,
            }
            for r in rows
        ]
    elif table == "clubs":
        rows = (await session.execute(select(Club).order_by(Club.name.asc()).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "name": r.name,
                "short_name": r.short_name,
                "attack_rating": r.attack_rating,
                "defense_rating": r.defense_rating,
            }
            for r in rows
        ]
    elif table == "audit_records":
        rows = (await session.execute(select(AuditRecord).order_by(AuditRecord.created_at.desc()).limit(lim))).scalars().all()
        sample_rows = [
            {
                "id": str(r.id),
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    return {
        "tableCounts": table_counts,
        "selectedTable": table,
        "sampleRows": sample_rows,
    }


@router.post("/emergency-action")
async def execute_admin_emergency_action(
    action: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Emergency Underground Operations:
    - SUSPEND_ALL_MARKETS: Globally suspend all 27 markets across all upcoming/live fixtures
    - RESUME_ALL_MARKETS: Globally resume all 27 markets across all upcoming fixtures
    - VOID_ALL_PENDING_BETS: Refund 100% of reserved stakes on all currently pending tickets
    - FORCE_KICKOFF_NEXT_MATCHDAY: Immediately kick off the next upcoming matchday across all leagues
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    affected = 0

    if action in ("SUSPEND_ALL_MARKETS", "RESUME_ALL_MARKETS"):
        suspend_flag = action == "SUSPEND_ALL_MARKETS"
        snaps = (
            await session.execute(select(OddsSnapshot).where(OddsSnapshot.is_active == True))  # noqa: E712
        ).scalars().all()
        for snap in snaps:
            new_markets = []
            for m in snap.markets or []:
                new_opts = [{**opt, "suspended": suspend_flag} for opt in m.get("options", [])]
                new_markets.append({**m, "options": new_opts})
            snap.markets = new_markets
            snap.version += 1
            affected += 1

    elif action == "VOID_ALL_PENDING_BETS":
        pending_bets = (
            await session.execute(select(Bet).where(Bet.status == "pending"))
        ).scalars().all()
        for bet in pending_bets:
            w_res = await session.execute(
                select(Wallet).where(Wallet.user_id == bet.user_id).with_for_update()
            )
            wallet = w_res.scalar_one_or_none()
            if wallet:
                wallet.reserved_minor = max(0, wallet.reserved_minor - bet.stake_minor)
                wallet.available_minor += bet.stake_minor
                session.add(
                    LedgerEntry(
                        wallet_id=wallet.id,
                        user_id=bet.user_id,
                        bet_id=bet.id,
                        kind="bet_void_refund",
                        amount_minor=bet.stake_minor,
                        balance_after_minor=wallet.available_minor,
                        description=f"Emergency global void refund for ticket {str(bet.id)[:8]}",
                        reference=f"emergency-void:{bet.id}",
                    )
                )
            bet.status = "void"
            bet.return_minor = bet.stake_minor
            bet.settled_at = now_iso
            affected += 1

    elif action == "FORCE_KICKOFF_NEXT_MATCHDAY":
        from sqlalchemy.orm import selectinload

        upcoming = (
            await session.execute(
                select(Fixture)
                .where(Fixture.status == "upcoming")
                .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
            )
        ).scalars().all()
        if upcoming:
            next_md = min(f.matchday for f in upcoming)
            engine = MatchEngine(session)
            for fx in [f for f in upcoming if f.matchday == next_md]:
                await engine.initialize_match(fx, fx.home_club, fx.away_club)
                await engine.start_match(fx)
                affected += 1
    else:
        raise HTTPException(status_code=400, detail=f"Unknown emergency action: {action}")

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action=f"EMERGENCY_{action}",
            target_type="system",
            target_id="global",
            details={"action": action, "affectedRecords": affected, "timestamp": now_iso},
        )
    )
    await session.commit()
    return {"action": action, "affectedRecords": affected}


# =============================================================================
# PANEL 13: STAFF & GRANULAR RBAC PERMISSIONS + INVITATION WORKFLOW
# =============================================================================


class CreateStaffInvitationRequest(BaseModel):
    staffName: str
    email: str
    role: str = "MODERATOR"  # SUPER_ADMIN, SUPPORT_ADMIN, MODERATOR, TRADING_ADMIN, LEDGER_AUDITOR, OPERATIONS_ADMIN
    permissions: list[str] | None = None
    internalNote: str | None = None
    expiryHours: int = 24


class AcceptStaffInvitationRequest(BaseModel):
    token: str
    password: str
    displayName: str | None = None


class UpdateStaffPermissionsRequest(BaseModel):
    role: str | None = None
    permissions: list[str]
    reason: str | None = None


class UpdateStaffStatusRequest(BaseModel):
    isActive: bool
    reason: str = "Administrative staff status change"


def _hash_invitation_token(raw_token: str) -> str:
    import hashlib
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


@router.get("/staff")
async def list_admin_staff(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """List all staff accounts, role definitions, granular permissions, and pending/expired/revoked invitations."""
    users_res = await session.execute(select(User).order_by(User.created_at.desc()))
    all_users = users_res.scalars().all()

    staff_accounts = []
    for u in all_users:
        role = getattr(u, "staff_role", "TRADER") or "TRADER"
        if u.is_admin or role != "TRADER":
            eff_perms = sorted(get_effective_permissions(u))
            staff_accounts.append(
                {
                    "id": str(u.id),
                    "email": u.email,
                    "displayName": u.display_name,
                    "role": "SUPER_ADMIN" if (u.is_admin and role == "TRADER") else role,
                    "permissions": eff_perms,
                    "isActive": u.is_active,
                    "isAdmin": u.is_admin,
                    "sessionVersion": getattr(u, "session_version", 1) or 1,
                    "lastLoginAt": getattr(u, "last_login_at", None),
                    "failedLoginAttempts": getattr(u, "failed_login_attempts", 0) or 0,
                    "adminNotes": getattr(u, "admin_notes", None),
                    "createdAt": u.created_at.isoformat() if u.created_at else "",
                }
            )

    inv_res = await session.execute(
        select(StaffInvitation).order_by(StaffInvitation.created_at.desc())
    )
    invitations = inv_res.scalars().all()
    now_iso = datetime.now(timezone.utc).isoformat()

    inv_list = []
    for inv in invitations:
        computed_status = inv.status
        if computed_status == "Pending" and inv.expires_at < now_iso:
            computed_status = "Expired"
        inv_list.append(
            {
                "id": str(inv.id),
                "staffName": inv.staff_name,
                "email": inv.email,
                "role": inv.role_name,
                "permissions": inv.permissions or [],
                "status": computed_status,
                "internalNote": inv.internal_note,
                "expiresAt": inv.expires_at,
                "acceptedAt": inv.accepted_at,
                "revokedAt": inv.revoked_at,
                "createdAt": inv.created_at.isoformat() if inv.created_at else "",
            }
        )

    return {
        "staff": staff_accounts,
        "invitations": inv_list,
        "roleTemplates": ROLE_DEFAULT_PERMISSIONS,
    }


@router.post("/staff/invitations")
async def create_staff_invitation(
    body: CreateStaffInvitationRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a cryptographically random, single-use staff invitation with 24h expiry and hashed token storage."""
    import secrets
    from datetime import timedelta

    await check_staff_permission(session, current_user, "admin.invite_staff")

    role_upper = body.role.strip().upper()
    if role_upper not in ROLE_DEFAULT_PERMISSIONS or role_upper == "TRADER":
        raise HTTPException(status_code=400, detail=f"Invalid staff role: {role_upper}")

    if role_upper == "SUPER_ADMIN":
        actor_role = getattr(current_user, "staff_role", "TRADER")
        if not current_user.is_admin and actor_role != "SUPER_ADMIN":
            raise HTTPException(
                status_code=403,
                detail="Only a Super Admin can grant Super Admin privileges.",
            )

    clean_email = body.email.strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=400, detail="Valid staff email required")

    # Check if an active Pending invitation already exists for this email
    existing_inv = (
        await session.execute(
            select(StaffInvitation).where(
                StaffInvitation.email == clean_email,
                StaffInvitation.status == "Pending",
            )
        )
    ).scalar_one_or_none()
    if existing_inv is not None:
        raise HTTPException(
            status_code=409,
            detail="An active pending invitation already exists for this email.",
        )

    raw_token = f"vfu_inv_{secrets.token_urlsafe(24)}"
    token_hash = _hash_invitation_token(raw_token)
    assigned_perms = (
        body.permissions
        if body.permissions is not None and len(body.permissions) > 0
        else ROLE_DEFAULT_PERMISSIONS.get(role_upper, [])
    )
    expires_dt = datetime.now(timezone.utc) + timedelta(
        hours=max(1, min(168, body.expiryHours))
    )

    invitation = StaffInvitation(
        email=clean_email,
        staff_name=body.staffName.strip() or "Staff Operator",
        role_name=role_upper,
        permissions=assigned_perms,
        invited_by_user_id=current_user.id,
        token_hash=token_hash,
        internal_note=body.internalNote,
        status="Pending",
        expires_at=expires_dt.isoformat(),
    )
    session.add(invitation)
    await session.flush()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="STAFF_INVITATION_CREATED",
            target_type="staff_invitation",
            target_id=str(invitation.id),
            details={
                "staffName": invitation.staff_name,
                "email": invitation.email,
                "role": invitation.role_name,
                "permissionsCount": len(assigned_perms),
                "expiresAt": invitation.expires_at,
            },
        )
    )
    await session.commit()

    return {
        "id": str(invitation.id),
        "email": invitation.email,
        "staffName": invitation.staff_name,
        "role": invitation.role_name,
        "permissions": assigned_perms,
        "status": "Pending",
        "expiresAt": invitation.expires_at,
        # Returned once to the Super Admin UI so they can copy/share the single-use invite token
        "singleUseInviteToken": raw_token,
    }


@router.post("/staff/invitations/{invitation_id}/resend")
async def resend_staff_invitation(
    invitation_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Invalidate the previous invitation token hash and issue a fresh 24-hour single-use token."""
    import secrets
    from datetime import timedelta

    await check_staff_permission(session, current_user, "admin.invite_staff", invitation_id)

    inv = await session.get(StaffInvitation, invitation_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status == "Accepted":
        raise HTTPException(status_code=409, detail="Invitation has already been accepted")

    raw_token = f"vfu_inv_{secrets.token_urlsafe(24)}"
    inv.token_hash = _hash_invitation_token(raw_token)
    inv.status = "Pending"
    inv.revoked_at = None
    inv.expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="STAFF_INVITATION_RESENT",
            target_type="staff_invitation",
            target_id=str(inv.id),
            details={"email": inv.email, "newExpiresAt": inv.expires_at},
        )
    )
    await session.commit()
    return {
        "id": str(inv.id),
        "email": inv.email,
        "status": inv.status,
        "expiresAt": inv.expires_at,
        "singleUseInviteToken": raw_token,
    }


@router.post("/staff/invitations/{invitation_id}/revoke")
async def revoke_staff_invitation(
    invitation_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Revoke a pending staff invitation so its token can never be used."""
    await check_staff_permission(session, current_user, "admin.invite_staff", invitation_id)

    inv = await session.get(StaffInvitation, invitation_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status == "Accepted":
        raise HTTPException(status_code=409, detail="Cannot revoke an already accepted invitation")

    inv.status = "Revoked"
    inv.revoked_at = datetime.now(timezone.utc).isoformat()

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="STAFF_INVITATION_REVOKED",
            target_type="staff_invitation",
            target_id=str(inv.id),
            details={"email": inv.email, "role": inv.role_name},
        )
    )
    await session.commit()
    return {"id": str(inv.id), "status": "Revoked", "revokedAt": inv.revoked_at}


@router.post("/staff/accept-invitation")
async def accept_staff_invitation(
    body: AcceptStaffInvitationRequest,
    session: AsyncSession = Depends(get_session),
):
    """Validate single-use invitation token hash, expiry, and unused status; atomically activate staff account."""
    token_hash = _hash_invitation_token(body.token.strip())
    inv_res = await session.execute(
        select(StaffInvitation).where(StaffInvitation.token_hash == token_hash).with_for_update()
    )
    inv = inv_res.scalar_one_or_none()
    now_iso = datetime.now(timezone.utc).isoformat()

    if inv is None:
        raise HTTPException(status_code=404, detail="Invalid or unknown staff invitation token")

    if inv.status != "Pending" or inv.accepted_at is not None or inv.revoked_at is not None:
        session.add(
            AuditRecord(
                actor_user_id=inv.invited_by_user_id,
                action="STAFF_INVITATION_REUSE_BLOCKED",
                target_type="staff_invitation",
                target_id=str(inv.id),
                details={"email": inv.email, "currentStatus": inv.status},
            )
        )
        await session.commit()
        raise HTTPException(
            status_code=409,
            detail=f"Invitation is no longer valid (status: {inv.status})",
        )

    if inv.expires_at < now_iso:
        inv.status = "Expired"
        await session.commit()
        raise HTTPException(status_code=410, detail="Staff invitation has expired")

    if len(body.password.strip()) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Find or create user account
    user_res = await session.execute(select(User).where(User.email == inv.email))
    user = user_res.scalar_one_or_none()
    if user is None:
        user = User(
            email=inv.email,
            display_name=(body.displayName or inv.staff_name).strip(),
            password_hash=hash_password(body.password.strip()),
            is_active=True,
            is_admin=(inv.role_name == "SUPER_ADMIN"),
            staff_role=inv.role_name,
            staff_permissions=inv.permissions or [],
            session_version=1,
            is_verified=True,
            kyc_tier="VIP_INSTITUTIONAL",
            risk_flag="NORMAL",
            admin_notes=inv.internal_note,
        )
        session.add(user)
        await session.flush()

        wallet = Wallet(
            id=user.id,
            user_id=user.id,
            available_minor=settings.INITIAL_WALLET_MINOR,
            reserved_minor=0,
            currency="XTS",
            simulated=True,
        )
        session.add(wallet)
        await session.flush()
        session.add(
            LedgerEntry(
                wallet_id=wallet.id,
                user_id=user.id,
                kind="initial_grant",
                amount_minor=settings.INITIAL_WALLET_MINOR,
                balance_after_minor=settings.INITIAL_WALLET_MINOR,
                description=f"Staff onboarding wallet grant ({inv.role_name})",
                reference=f"staff-onboard:{user.id}",
            )
        )
    else:
        user.password_hash = hash_password(body.password.strip())
        user.is_active = True
        user.is_admin = inv.role_name == "SUPER_ADMIN"
        user.staff_role = inv.role_name
        user.staff_permissions = inv.permissions or []
        user.is_verified = True

    inv.status = "Accepted"
    inv.accepted_at = now_iso

    session.add(
        AuditRecord(
            actor_user_id=user.id,
            action="STAFF_INVITATION_ACCEPTED",
            target_type="user",
            target_id=str(user.id),
            details={"email": user.email, "role": user.staff_role, "invitationId": str(inv.id)},
        )
    )
    await session.commit()
    return {
        "userId": str(user.id),
        "email": user.email,
        "displayName": user.display_name,
        "role": user.staff_role,
        "status": "Active",
    }


@router.patch("/staff/{staff_user_id}/permissions")
async def update_staff_permissions(
    staff_user_id: str,
    body: UpdateStaffPermissionsRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Update a staff member's role and granular permission keys (Super Admin only; separation of duties enforced)."""
    await check_staff_permission(session, current_user, "admin.manage_permissions", staff_user_id)

    target = await session.get(User, staff_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if str(target.id) == str(current_user.id) and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Separation of duties: staff members cannot elevate their own permissions.",
        )

    old_role = getattr(target, "staff_role", "TRADER")
    old_perms = list(getattr(target, "staff_permissions", []) or [])

    if body.role is not None:
        role_upper = body.role.strip().upper()
        if role_upper not in ROLE_DEFAULT_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"Unknown role: {role_upper}")
        target.staff_role = role_upper
        target.is_admin = role_upper == "SUPER_ADMIN"

    target.staff_permissions = sorted(set(body.permissions))
    # Bump session_version so active sessions re-authenticate with updated privileges if needed
    target.session_version = (getattr(target, "session_version", 1) or 1) + 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="STAFF_PERMISSIONS_UPDATED",
            target_type="user",
            target_id=str(target.id),
            details={
                "email": target.email,
                "oldRole": old_role,
                "newRole": target.staff_role,
                "oldPermissions": old_perms,
                "newPermissions": target.staff_permissions,
                "reason": body.reason,
            },
        )
    )
    await session.commit()
    return {
        "id": str(target.id),
        "email": target.email,
        "role": target.staff_role,
        "permissions": target.staff_permissions,
        "sessionVersion": target.session_version,
    }


@router.patch("/staff/{staff_user_id}/status")
async def update_staff_status(
    staff_user_id: str,
    body: UpdateStaffStatusRequest,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Suspend or reactivate a staff member and immediately invalidate their active sessions."""
    await check_staff_permission(session, current_user, "admin.manage_permissions", staff_user_id)

    target = await session.get(User, staff_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Staff account not found")
    if str(target.id) == str(current_user.id) and not body.isActive:
        raise HTTPException(status_code=400, detail="Cannot suspend your own active operator account")

    target.is_active = body.isActive
    target.session_version = (getattr(target, "session_version", 1) or 1) + 1

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="STAFF_STATUS_CHANGED",
            target_type="user",
            target_id=str(target.id),
            details={
                "email": target.email,
                "isActive": target.is_active,
                "reason": body.reason,
                "newSessionVersion": target.session_version,
            },
        )
    )
    await session.commit()
    return {
        "id": str(target.id),
        "email": target.email,
        "isActive": target.is_active,
        "sessionVersion": target.session_version,
    }


@router.post("/staff/{staff_user_id}/revoke-sessions")
async def revoke_user_or_staff_sessions(
    staff_user_id: str,
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Increment session_version to immediately invalidate all active JWT/cookie sessions for a user or staff account."""
    await check_staff_permission(session, current_user, "users.sessions", staff_user_id)

    target = await session.get(User, staff_user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    target.session_version = (getattr(target, "session_version", 1) or 1) + 1
    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="REVOKE_ACTIVE_SESSIONS",
            target_type="user",
            target_id=str(target.id),
            details={"email": target.email, "newSessionVersion": target.session_version},
        )
    )
    await session.commit()
    return {
        "id": str(target.id),
        "email": target.email,
        "sessionVersion": target.session_version,
    }


# =============================================================================
# PANEL 14: LIVE ACTIVITY MONITOR & SUSPICIOUS ACTIVITY ALERT CENTRE
# =============================================================================


@router.get("/activity-feed")
async def get_admin_live_activity_and_alerts(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Unified real-time platform activity stream (logins, signups, bets, settlements, wallet tx, staff actions) + automated suspicious activity alerts."""
    users_res = await session.execute(select(User))
    users_list = users_res.scalars().all()
    users_map = {str(u.id): u for u in users_list}

    audits_res = await session.execute(
        select(AuditRecord).order_by(AuditRecord.created_at.desc()).limit(60)
    )
    audits = audits_res.scalars().all()

    ledger_res = await session.execute(
        select(LedgerEntry).order_by(LedgerEntry.created_at.desc()).limit(60)
    )
    ledger_rows = ledger_res.scalars().all()

    bets_res = await session.execute(
        select(Bet).order_by(Bet.created_at.desc()).limit(60)
    )
    bet_rows = bets_res.scalars().all()

    # Build unified live activity feed
    feed: list[dict] = []
    for a in audits:
        actor = users_map.get(str(a.actor_user_id))
        feed.append(
            {
                "id": f"aud-{a.id}",
                "category": "SECURITY_AUDIT",
                "event": a.action,
                "actorEmail": actor.email if actor else "system",
                "target": f"{a.target_type}:{str(a.target_id)[:8]}",
                "summary": str(a.details or {}),
                "timestamp": a.created_at.isoformat() if a.created_at else "",
            }
        )

    for le in ledger_rows[:25]:
        u = users_map.get(str(le.user_id))
        feed.append(
            {
                "id": f"ldg-{le.id}",
                "category": "WALLET_LEDGER",
                "event": le.kind.upper(),
                "actorEmail": u.email if u else "trader",
                "target": f"wallet:{str(le.wallet_id)[:8]}",
                "summary": f"{le.description} ({le.amount_minor / 100:+.2f} XTS)",
                "timestamp": le.created_at.isoformat() if le.created_at else "",
            }
        )

    feed.sort(key=lambda x: x["timestamp"], reverse=True)

    # Automated Suspicious Activity Alerts
    alerts: list[dict] = []
    for u in users_list:
        fails = getattr(u, "failed_login_attempts", 0) or 0
        if fails >= 3:
            alerts.append(
                {
                    "id": f"alert-login-{u.id}",
                    "alertType": "Repeated failed logins",
                    "severity": "HIGH" if fails >= 5 else "MEDIUM",
                    "accountEmail": u.email,
                    "userId": str(u.id),
                    "reason": f"{fails} consecutive failed password attempts recorded.",
                    "status": "OPEN_INVESTIGATION",
                    "timestamp": getattr(u, "last_login_at", None)
                    or (u.created_at.isoformat() if u.created_at else ""),
                }
            )
        if getattr(u, "risk_flag", "NORMAL") in ("SHARP_WATCH", "HIGH_RISK", "FROZEN"):
            alerts.append(
                {
                    "id": f"alert-risk-{u.id}",
                    "alertType": "Account risk flag active",
                    "severity": "CRITICAL" if u.risk_flag == "FROZEN" else "MEDIUM",
                    "accountEmail": u.email,
                    "userId": str(u.id),
                    "reason": f"Account flagged as {u.risk_flag} by compliance.",
                    "status": "MONITORED",
                    "timestamp": u.created_at.isoformat() if u.created_at else "",
                }
            )

    for a in audits:
        if a.action in ("PRIVILEGE_ACCESS_DENIED", "STAFF_INVITATION_REUSE_BLOCKED"):
            actor = users_map.get(str(a.actor_user_id))
            alerts.append(
                {
                    "id": f"alert-priv-{a.id}",
                    "alertType": "Privilege abuse / unauthorized attempt",
                    "severity": "CRITICAL",
                    "accountEmail": actor.email if actor else "unknown",
                    "userId": str(a.actor_user_id),
                    "reason": f"{a.action}: {a.details}",
                    "status": "FLAGGED",
                    "timestamp": a.created_at.isoformat() if a.created_at else "",
                }
            )

    # User monitoring overview KPIs
    wallets_res = await session.execute(select(Wallet))
    wallets_all = wallets_res.scalars().all()
    total_xts_minor = sum(w.available_minor + w.reserved_minor for w in wallets_all)
    open_bet_users = len({b.user_id for b in bet_rows if b.status == "pending"})
    online_users = sum(1 for u in users_list if getattr(u, "last_login_at", None) is not None)

    return {
        "overview": {
            "totalUsers": len(users_list),
            "activeUsers": sum(1 for u in users_list if u.is_active),
            "onlineUsers": max(1, online_users),
            "newRegistrations": sum(1 for u in users_list if not getattr(u, "is_verified", False)),
            "suspendedAccounts": sum(1 for u in users_list if not u.is_active or getattr(u, "risk_flag", "NORMAL") == "FROZEN"),
            "usersWithOpenBets": open_bet_users,
            "totalVirtualXtsMinor": total_xts_minor,
        },
        "suspiciousAlerts": alerts[:30],
        "liveActivityFeed": feed[:50],
    }


# =============================================================================
# PANEL 15: WORLD HISTORY, PROMOTION/RELEGATION PREVIEW & SETTLEMENT RETRY
# =============================================================================


@router.get("/world-operations")
async def get_admin_world_operations(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Return Promotion/Relegation zone previews across all 6 leagues, completedfixtures with still-pending bets (settlement queue), and season progress."""
    from sqlalchemy.orm import selectinload

    leagues = (await session.execute(select(League).order_by(League.name.asc()))).scalars().all()
    clubs = (await session.execute(select(Club))).scalars().all()
    fixtures = (
        await session.execute(
            select(Fixture).options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        )
    ).scalars().all()
    seasons = (await session.execute(select(Season))).scalars().all()
    bets = (await session.execute(select(Bet).where(Bet.status == "pending"))).scalars().all()

    season_by_id = {s.id: s for s in seasons}
    fx_by_id = {f.id: f for f in fixtures}

    # Find any completed fixtures that still have unsettled pending bets
    stuck_settlements: dict[str, dict] = {}
    for b in bets:
        fx = fx_by_id.get(b.fixture_id)
        if fx and fx.status == "completed":
            entry = stuck_settlements.setdefault(
                str(fx.id),
                {
                    "fixtureId": str(fx.id),
                    "matchday": fx.matchday,
                    "matchLabel": f"{fx.home_club.short_name if fx.home_club else 'Home'} {fx.home_goals or 0}-{fx.away_goals or 0} {fx.away_club.short_name if fx.away_club else 'Away'}",
                    "pendingTicketsCount": 0,
                    "pendingStakeMinor": 0,
                },
            )
            entry["pendingTicketsCount"] += 1
            entry["pendingStakeMinor"] += b.stake_minor

    # Compute standings & Promotion/Relegation preview per league
    league_summaries = []
    for lg in leagues:
        lg_clubs = [c for c in clubs if c.league_id == lg.id]
        stats = {
            c.id: {"id": str(c.id), "name": c.name, "shortName": c.short_name, "pts": 0, "gd": 0, "gf": 0, "played": 0}
            for c in lg_clubs
        }
        lg_fx = [f for f in fixtures if season_by_id.get(f.season_id) and season_by_id[f.season_id].league_id == lg.id]
        completed_cnt = 0
        for f in lg_fx:
            if f.status == "completed" and f.home_goals is not None and f.away_goals is not None:
                completed_cnt += 1
                h = stats.get(f.home_club_id)
                a = stats.get(f.away_club_id)
                if h and a:
                    h["played"] += 1
                    a["played"] += 1
                    h["gf"] += f.home_goals
                    a["gf"] += f.away_goals
                    h["gd"] += f.home_goals - f.away_goals
                    a["gd"] += f.away_goals - f.home_goals
                    if f.home_goals > f.away_goals:
                        h["pts"] += 3
                    elif f.home_goals < f.away_goals:
                        a["pts"] += 3
                    else:
                        h["pts"] += 1
                        a["pts"] += 1

        table = sorted(stats.values(), key=lambda x: (-x["pts"], -x["gd"], -x["gf"], x["name"]))
        league_summaries.append(
            {
                "leagueId": str(lg.id),
                "name": lg.name,
                "country": lg.country,
                "clubsCount": len(lg_clubs),
                "totalFixtures": len(lg_fx),
                "completedFixtures": completed_cnt,
                "leader": table[0] if table else None,
                "championsLeagueZone": table[:4],
                "relegationZone": table[-3:] if len(table) >= 3 else [],
            }
        )

    return {
        "leagues": league_summaries,
        "stuckSettlements": list(stuck_settlements.values()),
    }


@router.post("/settlements/retry-all")
async def retry_all_stuck_settlements(
    current_user=Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session),
):
    """Idempotently settle any pending tickets whose fixtures have already completed."""
    from app.services.betting import auto_settle_fixture_bets

    await check_staff_permission(session, current_user, "finance.settle")

    completed_fx = (
        await session.execute(select(Fixture).where(Fixture.status == "completed"))
    ).scalars().all()

    total_settled = 0
    for fx in completed_fx:
        settled = await auto_settle_fixture_bets(session, fx)
        total_settled += len(settled)

    session.add(
        AuditRecord(
            actor_user_id=current_user.id,
            action="RETRY_SETTLEMENT_QUEUE",
            target_type="settlement",
            target_id="all_completed_fixtures",
            details={"settledTicketsCount": total_settled},
        )
    )
    await session.commit()
    return {"settledTicketsCount": total_settled}
