from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_session
from app.core.security import hash_password, verify_password
from app.models.bet import Bet
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.league import League
from app.models.ledger import LedgerEntry
from app.models.match_event import MatchEvent
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.models.user import User
from app.models.wallet import Wallet
from app.services.odds_engine import compute_probability_explanation, generate_fixture_markets

router = APIRouter(tags=["platform"])


class UpdateProfileRequest(BaseModel):
    displayName: str | None = None
    currentPassword: str | None = None
    newPassword: str | None = None


@router.get("/profile")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Comprehensive Trader Profile: account info, wallet equity, performance analytics, market breakdown, and achievements."""
    w_res = await session.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = w_res.scalar_one_or_none()
    avail = wallet.available_minor if wallet else 1000000
    resv = wallet.reserved_minor if wallet else 0
    equity = avail + resv

    b_res = await session.execute(
        select(Bet).where(Bet.user_id == current_user.id).order_by(Bet.created_at.asc())
    )
    bets = b_res.scalars().all()

    total_staked = sum(b.stake_minor for b in bets)
    total_returned = sum(b.return_minor or 0 for b in bets if b.status in ("won", "void"))
    won_bets = [b for b in bets if b.status == "won"]
    lost_bets = [b for b in bets if b.status == "lost"]
    pending_bets = [b for b in bets if b.status == "pending"]
    cashed_out_bets = [b for b in bets if b.status == "void"]

    settled_cnt = len(won_bets) + len(lost_bets)
    win_rate = round((len(won_bets) / settled_cnt) * 100, 1) if settled_cnt > 0 else 0.0
    roi_pct = (
        round(((total_returned - total_staked) / total_staked) * 100, 1)
        if total_staked > 0
        else 0.0
    )
    biggest_win_minor = max((b.return_minor or 0 for b in won_bets), default=0)
    avg_odds = (
        round(sum(float(b.recorded_odds) for b in bets) / len(bets), 2) if bets else 0.0
    )

    # Calculate current & best winning streak
    cur_streak = 0
    best_streak = 0
    for b in bets:
        if b.status == "won":
            cur_streak += 1
            best_streak = max(best_streak, cur_streak)
        elif b.status == "lost":
            cur_streak = 0

    # Market breakdown
    market_counts: dict[str, int] = {}
    for b in bets:
        for s in b.selections or []:
            m = s.get("market", "match_winner")
            market_counts[m] = market_counts.get(m, 0) + 1

    # Achievements & Milestones
    achievements = [
        {
            "id": "ach-first-bet",
            "title": "First Exchange Ticket",
            "description": "Place your first simulated wager on any European fixture.",
            "unlocked": len(bets) >= 1,
        },
        {
            "id": "ach-first-win",
            "title": "Off The Mark",
            "description": "Settle a winning ticket in the Virtual Football Universe.",
            "unlocked": len(won_bets) >= 1,
        },
        {
            "id": "ach-acca",
            "title": "Accumulator Architect",
            "description": "Place a multi-match accumulator ticket with 3 or more legs.",
            "unlocked": any(len(b.selections or []) >= 3 for b in bets),
        },
        {
            "id": "ach-green",
            "title": "In The Green",
            "description": "Grow your total simulated equity above the 10,000.00 XTS starting grant.",
            "unlocked": equity > 1000000,
        },
        {
            "id": "ach-high-odds",
            "title": "Longshot Sniper",
            "description": "Place a ticket with combined decimal odds of 5.00 or higher.",
            "unlocked": any(float(b.recorded_odds) >= 5.0 for b in bets),
        },
        {
            "id": "ach-volume",
            "title": "Season Veteran",
            "description": "Place at least 5 tickets across the European exchange.",
            "unlocked": len(bets) >= 5,
        },
    ]

    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "displayName": current_user.display_name,
            "isAdmin": current_user.is_admin,
            "isVerified": getattr(current_user, "is_verified", False),
            "kycTier": getattr(current_user, "kyc_tier", "UNVERIFIED"),
            "riskFlag": getattr(current_user, "risk_flag", "NORMAL"),
            "customMaxStakeMinor": getattr(current_user, "custom_max_stake_minor", None),
            "createdAt": current_user.created_at.isoformat() if current_user.created_at else "",
        },
        "wallet": {
            "availableMinor": avail,
            "reservedMinor": resv,
            "totalEquityMinor": equity,
            "netProfitMinor": equity - 1000000,
            "currency": "XTS",
        },
        "stats": {
            "totalBets": len(bets),
            "pendingBets": len(pending_bets),
            "wonBets": len(won_bets),
            "lostBets": len(lost_bets),
            "cashedOutBets": len(cashed_out_bets),
            "winRate": win_rate,
            "roiPercent": roi_pct,
            "totalStakedMinor": total_staked,
            "totalReturnedMinor": total_returned,
            "biggestWinMinor": biggest_win_minor,
            "averageOdds": avg_odds,
            "currentStreak": cur_streak,
            "bestStreak": best_streak,
        },
        "marketBreakdown": [
            {"market": k, "count": v}
            for k, v in sorted(market_counts.items(), key=lambda x: -x[1])
        ],
        "achievements": achievements,
    }


@router.patch("/profile")
async def update_my_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update trader display name or password."""
    if body.displayName is not None:
        cleaned = body.displayName.strip()
        if len(cleaned) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Display name must be at least 2 characters",
            )
        current_user.display_name = cleaned

    if body.newPassword:
        if not body.currentPassword or not verify_password(
            body.currentPassword, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        if len(body.newPassword) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters",
            )
        current_user.password_hash = hash_password(body.newPassword)

    await session.commit()
    await session.refresh(current_user)
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "displayName": current_user.display_name,
        "isAdmin": current_user.is_admin,
    }


@router.post("/wallet/faucet")
async def claim_wallet_faucet(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Simulated Test-Token Faucet: grants +5,000.00 XTS when total equity drops below 2,500.00 XTS."""
    if getattr(current_user, "is_admin", False) or getattr(current_user, "staff_role", "TRADER") not in ("TRADER", None, ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ADMIN_BETTING_FORBIDDEN",
                "message": "Administrator and staff accounts only monitor the platform and cannot claim trader betting tokens.",
            },
        )
    res = await session.execute(
        select(Wallet).where(Wallet.user_id == current_user.id).with_for_update()
    )
    wallet = res.scalar_one_or_none()
    if wallet is None:
        raise HTTPException(status_code=404, detail="Wallet not found")

    total_equity = wallet.available_minor + wallet.reserved_minor
    if total_equity >= 250000:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "FAUCET_THRESHOLD_NOT_MET",
                "message": "Simulated reload faucet (+5,000.00 XTS) is available when total equity is below 2,500.00 XTS.",
            },
        )

    grant_minor = 500000  # 5,000.00 XTS
    wallet.available_minor += grant_minor
    session.add(
        LedgerEntry(
            wallet_id=wallet.id,
            user_id=current_user.id,
            kind="faucet_grant",
            amount_minor=grant_minor,
            balance_after_minor=wallet.available_minor,
            description="Simulated test-token reload faucet (+5,000.00 XTS)",
            reference=f"faucet:{datetime.now(timezone.utc).isoformat()}",
        )
    )
    await session.commit()
    await session.refresh(wallet)
    return {
        "availableMinor": wallet.available_minor,
        "reservedMinor": wallet.reserved_minor,
        "currency": wallet.currency,
        "grantedMinor": grant_minor,
    }


@router.get("/fixtures/{fixture_id}/explain")
async def explain_fixture_probabilities(
    fixture_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Probability Explainer & Odds Movement Tracker for a fixture."""
    fx_res = await session.execute(
        select(Fixture)
        .where(Fixture.id == fixture_id)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
    )
    fx = fx_res.scalar_one_or_none()
    if fx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixture not found")

    home_club = fx.home_club
    away_club = fx.away_club

    # Compute recent form for both clubs across completed fixtures
    comp_res = await session.execute(
        select(Fixture)
        .where(Fixture.status == "completed")
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    completed_fixtures = comp_res.scalars().all()

    def _club_form(cid) -> list[str]:
        form: list[str] = []
        for cfx in completed_fixtures:
            if cfx.home_club_id == cid:
                hg, ag = cfx.home_goals or 0, cfx.away_goals or 0
                form.append("W" if hg > ag else ("D" if hg == ag else "L"))
            elif cfx.away_club_id == cid:
                hg, ag = cfx.home_goals or 0, cfx.away_goals or 0
                form.append("W" if ag > hg else ("D" if ag == hg else "L"))
        return form[-5:]

    home_form = _club_form(fx.home_club_id)
    away_form = _club_form(fx.away_club_id)

    explainer = compute_probability_explanation(
        home_name=home_club.name if home_club else "Home",
        away_name=away_club.name if away_club else "Away",
        home_attack=home_club.attack_rating if home_club else 1.0,
        home_defense=home_club.defense_rating if home_club else 1.0,
        away_attack=away_club.attack_rating if away_club else 1.0,
        away_defense=away_club.defense_rating if away_club else 1.0,
        home_form=home_form,
        away_form=away_form,
    )

    # Compute Opening vs Current / Live 1X2 Odds Movement
    base_markets = generate_fixture_markets(
        fixture_id=fx.id,
        home_name=home_club.name if home_club else "Home",
        away_name=away_club.name if away_club else "Away",
        home_attack=home_club.attack_rating if home_club else 1.0,
        home_defense=home_club.defense_rating if home_club else 1.0,
        away_attack=away_club.attack_rating if away_club else 1.0,
        away_defense=away_club.defense_rating if away_club else 1.0,
    )
    m_1x2 = next((m for m in base_markets if m["key"] == "match_winner"), None)
    open_home = m_1x2["options"][0]["decimal"] if m_1x2 else 2.10
    open_draw = m_1x2["options"][1]["decimal"] if m_1x2 else 3.30
    open_away = m_1x2["options"][2]["decimal"] if m_1x2 else 3.20

    # Derive simulated movement ticks from match clock & scoreline
    clock = fx.clock_seconds or 0
    hg = fx.home_goals or 0
    ag = fx.away_goals or 0
    diff = hg - ag

    if fx.status == "upcoming":
        cur_home = round(max(1.10, open_home - 0.04), 2)
        cur_draw = round(open_draw + 0.02, 2)
        cur_away = round(open_away + 0.05, 2)
        reason = "Pre-match market liquidity & home-advantage weight adjustment"
    elif diff > 0:
        cur_home = round(max(1.06, open_home * (0.55 ** diff)), 2)
        cur_draw = round(min(18.0, open_draw * (1.45 ** diff)), 2)
        cur_away = round(min(35.0, open_away * (2.10 ** diff)), 2)
        reason = f"{home_club.name if home_club else 'Home'} leads {hg}-{ag} at {max(1, round(clock * 90 / 480))}'"
    elif diff < 0:
        adiff = abs(diff)
        cur_home = round(min(35.0, open_home * (2.10 ** adiff)), 2)
        cur_draw = round(min(18.0, open_draw * (1.45 ** adiff)), 2)
        cur_away = round(max(1.06, open_away * (0.55 ** adiff)), 2)
        reason = f"{away_club.name if away_club else 'Away'} leads {hg}-{ag} at {max(1, round(clock * 90 / 480))}'"
    else:
        decay = min(0.45, (clock / 480.0) * 0.45)
        cur_home = round(open_home * (1.0 + decay * 0.35), 2)
        cur_draw = round(max(1.35, open_draw * (1.0 - decay)), 2)
        cur_away = round(open_away * (1.0 + decay * 0.35), 2)
        reason = f"Scores level ({hg}-{ag}) with time decay at {max(1, round(clock * 90 / 480))}'"

    explainer["oddsMovement"] = {
        "opening": {"home": open_home, "draw": open_draw, "away": open_away},
        "current": {"home": cur_home, "draw": cur_draw, "away": cur_away},
        "reason": reason,
    }
    return explainer


@router.get("/clubs")
async def list_clubs(
    league_id: str | None = Query(None, alias="leagueId"),
    q: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Club).order_by(Club.name.asc())
    if league_id:
        stmt = stmt.where(Club.league_id == league_id)
    res = await session.execute(stmt)
    clubs = res.scalars().all()
    if q:
        ql = q.lower()
        clubs = [c for c in clubs if ql in c.name.lower() or ql in c.short_name.lower()]
    return [
        {
            "id": str(c.id),
            "leagueId": str(c.league_id) if c.league_id else None,
            "name": c.name,
            "shortName": c.short_name,
            "attackRating": c.attack_rating,
            "defenseRating": c.defense_rating,
        }
        for c in clubs
    ]


@router.get("/clubs/{club_id}")
async def get_club_profile(
    club_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Comprehensive Club Profile: ratings, league rank, recent form, season records, and fixtures."""
    club = await session.get(Club, club_id)
    if club is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club not found")

    league = await session.get(League, club.league_id) if club.league_id else None

    fx_res = await session.execute(
        select(Fixture)
        .where((Fixture.home_club_id == club.id) | (Fixture.away_club_id == club.id))
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        .order_by(Fixture.matchday.asc(), Fixture.id.asc())
    )
    club_fixtures = fx_res.scalars().all()

    played = won = drawn = lost = gf = ga = clean_sheets = 0
    form: list[str] = []
    biggest_win_margin = 0
    biggest_win_label = "—"

    for fx in club_fixtures:
        if fx.status != "completed":
            continue
        played += 1
        is_home = fx.home_club_id == club.id
        my_g = (fx.home_goals if is_home else fx.away_goals) or 0
        op_g = (fx.away_goals if is_home else fx.home_goals) or 0
        opp_name = (
            (fx.away_club.name if is_home else fx.home_club.name)
            if (fx.away_club and fx.home_club)
            else "Opponent"
        )
        gf += my_g
        ga += op_g
        if op_g == 0:
            clean_sheets += 1
        if my_g > op_g:
            won += 1
            form.append("W")
            margin = my_g - op_g
            if margin > biggest_win_margin:
                biggest_win_margin = margin
                biggest_win_label = f"{my_g}-{op_g} vs {opp_name}"
        elif my_g == op_g:
            drawn += 1
            form.append("D")
        else:
            lost += 1
            form.append("L")

    return {
        "club": {
            "id": str(club.id),
            "leagueId": str(club.league_id) if club.league_id else None,
            "name": club.name,
            "shortName": club.short_name,
            "attackRating": club.attack_rating,
            "defenseRating": club.defense_rating,
        },
        "league": {
            "id": str(league.id),
            "name": league.name,
            "shortName": league.short_name,
            "country": league.country,
        }
        if league
        else None,
        "stats": {
            "played": played,
            "won": won,
            "drawn": drawn,
            "lost": lost,
            "gf": gf,
            "ga": ga,
            "gd": gf - ga,
            "points": won * 3 + drawn,
            "cleanSheets": clean_sheets,
            "biggestWin": biggest_win_label,
            "form": form[-5:],
        },
        "fixtures": [
            {
                "id": str(f.id),
                "matchday": f.matchday,
                "status": f.status,
                "kickoffAt": f.kickoff_at,
                "homeGoals": f.home_goals,
                "awayGoals": f.away_goals,
                "clockSeconds": f.clock_seconds,
                "home": {
                    "id": str(f.home_club.id),
                    "name": f.home_club.name,
                    "shortName": f.home_club.short_name,
                    "attackRating": f.home_club.attack_rating,
                    "defenseRating": f.home_club.defense_rating,
                }
                if f.home_club
                else None,
                "away": {
                    "id": str(f.away_club.id),
                    "name": f.away_club.name,
                    "shortName": f.away_club.short_name,
                    "attackRating": f.away_club.attack_rating,
                    "defenseRating": f.away_club.defense_rating,
                }
                if f.away_club
                else None,
            }
            for f in club_fixtures
        ],
    }


@router.get("/leaderboard")
async def get_leaderboard(session: AsyncSession = Depends(get_session)):
    """Rank traders by simulated equity, net profit, win rate, and achievements."""
    users_res = await session.execute(select(User))
    users = {u.id: u for u in users_res.scalars().all()}

    wallets_res = await session.execute(select(Wallet))
    wallets = {w.user_id: w for w in wallets_res.scalars().all()}

    bets_res = await session.execute(select(Bet))
    all_bets = bets_res.scalars().all()

    user_bets: dict = {}
    for b in all_bets:
        user_bets.setdefault(b.user_id, []).append(b)

    board: list[dict] = []
    for uid, u in users.items():
        if getattr(u, "is_admin", False) or getattr(u, "staff_role", "TRADER") not in ("TRADER", None, ""):
            continue
        w = wallets.get(uid)
        avail = w.available_minor if w else 1000000
        resv = w.reserved_minor if w else 0
        equity = avail + resv
        ub = user_bets.get(uid, [])
        won_cnt = sum(1 for b in ub if b.status == "won")
        lost_cnt = sum(1 for b in ub if b.status == "lost")
        settled_cnt = won_cnt + lost_cnt
        win_rate = round((won_cnt / settled_cnt) * 100, 1) if settled_cnt > 0 else 0.0
        profit_minor = equity - 1000000

        badges: list[str] = []
        if len(ub) >= 1:
            badges.append("First Ticket")
        if won_cnt >= 1:
            badges.append("Off the Mark")
        if any(len(b.selections or []) >= 3 for b in ub):
            badges.append("Acca Architect")
        if profit_minor > 0:
            badges.append("In The Green")

        board.append(
            {
                "userId": str(uid),
                "displayName": u.display_name,
                "totalEquityMinor": equity,
                "netProfitMinor": profit_minor,
                "totalBets": len(ub),
                "wonBets": won_cnt,
                "lostBets": lost_cnt,
                "winRate": win_rate,
                "badges": badges,
            }
        )

    # Also include realistic simulated institutional benchmark traders so leaderboard is lively
    benchmark_traders = [
        {
            "userId": "sim-1",
            "displayName": "NordicQuant_XTS",
            "totalEquityMinor": 1485200,
            "netProfitMinor": 485200,
            "totalBets": 24,
            "wonBets": 16,
            "lostBets": 8,
            "winRate": 66.7,
            "badges": ["Sharp Model", "Acca Architect", "5x Streak"],
        },
        {
            "userId": "sim-2",
            "displayName": "CruyffTurn_99",
            "totalEquityMinor": 1294000,
            "netProfitMinor": 294000,
            "totalBets": 19,
            "wonBets": 11,
            "lostBets": 8,
            "winRate": 57.9,
            "badges": ["Eredvisie Specialist", "In The Green"],
        },
        {
            "userId": "sim-3",
            "displayName": "BavariaPress_DE",
            "totalEquityMinor": 1162500,
            "netProfitMinor": 162500,
            "totalBets": 15,
            "wonBets": 9,
            "lostBets": 6,
            "winRate": 60.0,
            "badges": ["BTTS Hunter", "In The Green"],
        },
        {
            "userId": "sim-4",
            "displayName": "CalcioTactician",
            "totalEquityMinor": 1048000,
            "netProfitMinor": 48000,
            "totalBets": 12,
            "wonBets": 6,
            "lostBets": 6,
            "winRate": 50.0,
            "badges": ["Under 2.5 Pro", "First Ticket"],
        },
        {
            "userId": "sim-5",
            "displayName": "MerseySide_Value",
            "totalEquityMinor": 942000,
            "netProfitMinor": -58000,
            "totalBets": 14,
            "wonBets": 5,
            "lostBets": 9,
            "winRate": 35.7,
            "badges": ["High Roller", "Acca Architect"],
        },
    ]

    combined = board + benchmark_traders
    combined.sort(key=lambda r: (-r["totalEquityMinor"], -r["winRate"]))
    for idx, entry in enumerate(combined, start=1):
        entry["rank"] = idx

    return {
        "leaderboard": combined,
        "dailyChallenges": [
            {
                "id": "chal-1",
                "title": "European Acca Builder",
                "description": "Build and place a 3+ leg accumulator across any European leagues.",
                "rewardLabel": "+500 XP Badge",
                "target": 3,
            },
            {
                "id": "chal-2",
                "title": "Goals Specialist",
                "description": "Place a wager on any Goals or Combination market (BTTS, Over/Under, Correct Score).",
                "rewardLabel": "Goals Tactician Badge",
                "target": 1,
            },
            {
                "id": "chal-3",
                "title": "Clean Sheet Scout",
                "description": "Back a club with Defense Rating ≥ 1.20 in a Team to Score or BTTS No market.",
                "rewardLabel": "Iron Wall Badge",
                "target": 1,
            },
        ],
    }
