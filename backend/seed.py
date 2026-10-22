"""Seed the database with the 6 European Leagues, 116 clubs, multi-matchday schedules, and odds."""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.league import League
from app.models.match_event import MatchEvent
from app.models.match_state import MatchState
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.services.odds_engine import generate_fixture_markets
from engine.simulator import MATCH_DURATION_SECONDS, _generate_match_events

PRE_MATCH_COUNTDOWN_SECONDS = 240  # 4 minutes after previous matchday ends

LEAGUE_DEFINITIONS = [
    {
        "name": "English Premier League",
        "short_name": "EPL",
        "country": "England",
        "clubs": [
            ("Arsenal", "ARS", 1.34, 1.28),
            ("Aston Villa", "AVL", 1.20, 1.14),
            ("AFC Bournemouth", "BOU", 1.04, 1.00),
            ("Brentford", "BRE", 1.06, 1.02),
            ("Brighton & Hove Albion", "BHA", 1.14, 1.08),
            ("Chelsea", "CHE", 1.24, 1.16),
            ("Coventry City", "COV", 0.90, 0.92),
            ("Crystal Palace", "CRY", 1.04, 1.06),
            ("Everton", "EVE", 0.96, 1.04),
            ("Fulham", "FUL", 1.05, 1.04),
            ("Hull City", "HUL", 0.88, 0.90),
            ("Ipswich Town", "IPS", 0.92, 0.90),
            ("Leeds United", "LEE", 1.02, 0.98),
            ("Liverpool", "LIV", 1.35, 1.26),
            ("Manchester City", "MCI", 1.36, 1.28),
            ("Manchester United", "MUN", 1.18, 1.12),
            ("Newcastle United", "NEW", 1.22, 1.16),
            ("Nottingham Forest", "NFO", 1.02, 1.05),
            ("Sunderland", "SUN", 0.90, 0.92),
            ("Tottenham Hotspur", "TOT", 1.24, 1.10),
        ],
    },
    {
        "name": "Spanish La Liga",
        "short_name": "LAL",
        "country": "Spain",
        "clubs": [
            ("Real Madrid", "RMA", 1.36, 1.28),
            ("Barcelona", "BAR", 1.35, 1.24),
            ("Atlético Madrid", "ATM", 1.26, 1.26),
            ("Athletic Club", "ATH", 1.16, 1.18),
            ("Real Sociedad", "RSO", 1.14, 1.16),
            ("Villarreal", "VIL", 1.18, 1.08),
            ("Real Betis", "BET", 1.12, 1.10),
            ("Sevilla", "SEV", 1.08, 1.06),
            ("Valencia", "VAL", 1.04, 1.06),
            ("Getafe", "GET", 0.94, 1.12),
            ("Celta Vigo", "CEL", 1.06, 0.98),
            ("Osasuna", "OSA", 1.02, 1.04),
            ("Rayo Vallecano", "RAY", 0.98, 1.02),
            ("Girona", "GIR", 1.16, 1.06),
            ("RCD Espanyol", "ESP", 0.94, 0.96),
            ("Deportivo Alavés", "ALA", 0.94, 1.00),
            ("Elche", "ELC", 0.90, 0.94),
            ("Levante", "LEV", 0.92, 0.92),
            ("Málaga", "MAL", 0.90, 0.92),
            ("Racing Santander", "RAC", 0.90, 0.90),
        ],
    },
    {
        "name": "Italian Serie A",
        "short_name": "SEA",
        "country": "Italy",
        "clubs": [
            ("Inter Milan", "INT", 1.35, 1.28),
            ("AC Milan", "MIL", 1.26, 1.18),
            ("Juventus", "JUV", 1.24, 1.26),
            ("Napoli", "NAP", 1.28, 1.22),
            ("Roma", "ROM", 1.18, 1.14),
            ("Lazio", "LAZ", 1.16, 1.12),
            ("Atalanta", "ATA", 1.28, 1.14),
            ("Fiorentina", "FIO", 1.14, 1.10),
            ("Bologna", "BOL", 1.10, 1.12),
            ("Torino", "TOR", 1.02, 1.08),
            ("Udinese", "UDI", 1.00, 1.02),
            ("Genoa", "GEN", 0.98, 1.02),
            ("Cagliari", "CAG", 0.94, 0.94),
            ("Parma", "PAR", 0.96, 0.94),
            ("Lecce", "LEC", 0.92, 0.96),
            ("Como", "COM", 0.96, 0.94),
            ("Sassuolo", "SAS", 0.98, 0.92),
            ("Verona", "VER", 0.94, 0.94),
            ("Frosinone", "FRO", 0.90, 0.90),
            ("Venezia", "VEN", 0.90, 0.90),
        ],
    },
    {
        "name": "German Bundesliga",
        "short_name": "BUN",
        "country": "Germany",
        "clubs": [
            ("Bayern Munich", "BAY", 1.36, 1.26),
            ("Borussia Dortmund", "BVB", 1.28, 1.16),
            ("Bayer Leverkusen", "B04", 1.32, 1.24),
            ("RB Leipzig", "RBL", 1.24, 1.18),
            ("Eintracht Frankfurt", "SGE", 1.18, 1.10),
            ("VfB Stuttgart", "VFB", 1.20, 1.12),
            ("Borussia Mönchengladbach", "BMG", 1.08, 1.02),
            ("VfL Wolfsburg", "WOB", 1.08, 1.06),
            ("SC Freiburg", "SCF", 1.12, 1.12),
            ("TSG Hoffenheim", "TSG", 1.08, 0.98),
            ("Werder Bremen", "SVW", 1.06, 1.00),
            ("FC Augsburg", "FCA", 0.98, 0.98),
            ("Union Berlin", "FCU", 1.00, 1.10),
            ("Mainz 05", "M05", 1.02, 1.04),
            ("Hamburger SV", "HSV", 1.00, 0.96),
            ("FC Köln", "KOE", 0.98, 0.96),
            ("Schalke 04", "S04", 0.94, 0.92),
            ("SV Elversberg", "ELV", 0.90, 0.90),
            ("Hertha Berlin", "BSC", 0.94, 0.94),
            ("SC Paderborn", "SCP", 0.90, 0.90),
        ],
    },
    {
        "name": "French Ligue 1",
        "short_name": "FL1",
        "country": "France",
        "clubs": [
            ("Paris Saint-Germain", "PSG", 1.36, 1.26),
            ("Marseille", "OM", 1.24, 1.14),
            ("Monaco", "ASM", 1.24, 1.14),
            ("Lyon", "OL", 1.18, 1.08),
            ("Lille", "LOS", 1.20, 1.18),
            ("Nice", "OGC", 1.14, 1.16),
            ("Rennes", "SRFC", 1.14, 1.08),
            ("Lens", "RCL", 1.14, 1.14),
            ("Strasbourg", "RCS", 1.04, 1.02),
            ("Toulouse", "TFC", 1.02, 1.02),
            ("Nantes", "FCN", 0.98, 1.00),
            ("Montpellier", "MHS", 0.98, 0.94),
            ("Brest", "SB29", 1.08, 1.08),
            ("Le Havre", "HAC", 0.92, 0.96),
            ("Auxerre", "AJA", 0.94, 0.94),
            ("Angers", "SCO", 0.90, 0.92),
            ("Lorient", "FCL", 0.94, 0.92),
            ("Paris FC", "PFC", 0.92, 0.94),
        ],
    },
    {
        "name": "Dutch Eredivisie",
        "short_name": "ERE",
        "country": "Netherlands",
        "clubs": [
            ("Ajax", "AJA", 1.30, 1.18),
            ("PSV Eindhoven", "PSV", 1.34, 1.24),
            ("Feyenoord", "FEY", 1.28, 1.20),
            ("AZ Alkmaar", "AZ", 1.20, 1.14),
            ("FC Twente", "TWE", 1.18, 1.12),
            ("FC Utrecht", "UTR", 1.12, 1.08),
            ("SC Heerenveen", "HEE", 1.02, 0.98),
            ("FC Groningen", "GRO", 0.98, 1.00),
            ("Sparta Rotterdam", "SPA", 1.02, 1.02),
            ("NEC Nijmegen", "NEC", 1.02, 1.00),
            ("Go Ahead Eagles", "GAE", 1.04, 1.02),
            ("PEC Zwolle", "PEC", 0.94, 0.94),
            ("Fortuna Sittard", "FOR", 0.94, 0.96),
            ("Excelsior", "EXC", 0.92, 0.90),
            ("ADO Den Haag", "ADO", 0.90, 0.92),
            ("SC Cambuur", "CAM", 0.90, 0.90),
            ("Telstar", "TEL", 0.88, 0.88),
            ("Willem II", "WIL", 0.94, 0.94),
        ],
    },
]


def _generate_round_robin_pairings(
    clubs: list[Club], num_matchdays: int = 6
) -> list[list[tuple[Club, Club]]]:
    """Circle-method round-robin generator for even number of clubs."""
    n = len(clubs)
    rotation = list(clubs)
    rounds: list[list[tuple[Club, Club]]] = []

    for r in range(num_matchdays):
        pairings: list[tuple[Club, Club]] = []
        for i in range(n // 2):
            c1 = rotation[i]
            c2 = rotation[n - 1 - i]
            if r % 2 == 0:
                pairings.append((c1, c2))
            else:
                pairings.append((c2, c1))
        rounds.append(pairings)
        rotation = [rotation[0]] + [rotation[-1]] + rotation[1:-1]

    return rounds


async def seed(force_reset: bool = False):
    async with AsyncSessionLocal() as session:
        existing_leagues = (await session.execute(select(League))).scalars().all()
        if len(existing_leagues) == 6 and not force_reset:
            now = datetime.now(timezone.utc)
            fx_res = await session.execute(
                select(Fixture).where(Fixture.status == "upcoming").order_by(Fixture.matchday.asc())
            )
            upcoming = fx_res.scalars().all()
            if upcoming:
                next_md = min(f.matchday for f in upcoming)
                for f in upcoming:
                    md_offset = f.matchday - next_md
                    ko = now + timedelta(
                        seconds=PRE_MATCH_COUNTDOWN_SECONDS
                        + md_offset * (MATCH_DURATION_SECONDS + PRE_MATCH_COUNTDOWN_SECONDS)
                    )
                    f.kickoff_at = ko.isoformat()
                await session.commit()
                print(f"Synchronized Matchday {next_md} kickoff across all 6 leagues to 4 minutes from now.")
            return

        if existing_leagues:
            await session.execute(
                text(
                    "TRUNCATE ledger_entries, bets, match_events, match_states, "
                    "odds_snapshots, fixtures, seasons, clubs, leagues CASCADE"
                )
            )
            await session.commit()

        now = datetime.now(timezone.utc)
        total_clubs = 0
        total_fixtures = 0

        for ldef in LEAGUE_DEFINITIONS:
            league = League(
                name=ldef["name"],
                short_name=ldef["short_name"],
                country=ldef["country"],
            )
            session.add(league)
            await session.flush()

            season = Season(
                league_id=league.id,
                name="2026/27 Season",
                year=2026,
                is_active=True,
            )
            session.add(season)
            await session.flush()

            clubs: list[Club] = []
            for cname, cshort, att, dfn in ldef["clubs"]:
                club = Club(
                    league_id=league.id,
                    name=cname,
                    short_name=cshort,
                    attack_rating=att,
                    defense_rating=dfn,
                )
                session.add(club)
                clubs.append(club)
            await session.flush()
            total_clubs += len(clubs)

            rounds = _generate_round_robin_pairings(clubs, num_matchdays=6)

            for md_idx, pairings in enumerate(rounds, start=1):
                if md_idx == 1:
                    kickoff = now - timedelta(minutes=8)
                else:
                    md_offset = md_idx - 2
                    kickoff = now + timedelta(
                        seconds=PRE_MATCH_COUNTDOWN_SECONDS
                        + md_offset * (MATCH_DURATION_SECONDS + PRE_MATCH_COUNTDOWN_SECONDS)
                    )

                for home, away in pairings:
                    is_md1 = md_idx == 1
                    fixture = Fixture(
                        season_id=season.id,
                        home_club_id=home.id,
                        away_club_id=away.id,
                        matchday=md_idx,
                        kickoff_at=kickoff.isoformat(),
                        status="completed" if is_md1 else "upcoming",
                    )
                    session.add(fixture)
                    await session.flush()

                    markets = generate_fixture_markets(
                        fixture_id=fixture.id,
                        home_name=home.name,
                        away_name=away.name,
                        home_attack=home.attack_rating,
                        home_defense=home.defense_rating,
                        away_attack=away.attack_rating,
                        away_defense=away.defense_rating,
                        version=1,
                        suspended=is_md1,
                    )
                    session.add(
                        OddsSnapshot(
                            fixture_id=fixture.id,
                            version=1,
                            markets=markets,
                            is_active=True,
                        )
                    )

                    if is_md1:
                        rng = random.Random(str(fixture.id))
                        events_data = _generate_match_events(str(fixture.id), home, away, rng)
                        hg = sum(
                            1
                            for ev in events_data
                            if ev["event_type"] == "goal"
                            and (ev["payload"] or {}).get("side") == "home"
                        )
                        ag = sum(
                            1
                            for ev in events_data
                            if ev["event_type"] == "goal"
                            and (ev["payload"] or {}).get("side") == "away"
                        )
                        fixture.home_goals = hg
                        fixture.away_goals = ag
                        fixture.clock_seconds = MATCH_DURATION_SECONDS

                        current_evs = []
                        for ev in events_data:
                            session.add(
                                MatchEvent(
                                    fixture_id=fixture.id,
                                    event_seq=ev["event_seq"],
                                    event_type=ev["event_type"],
                                    minute=ev["minute"],
                                    club_id=ev["club_id"],
                                    text=ev["text"],
                                    payload=ev["payload"],
                                )
                            )
                            current_evs.append(
                                {
                                    "event_seq": ev["event_seq"],
                                    "event_type": ev["event_type"],
                                    "minute": ev["minute"],
                                    "club_id": ev["club_id"],
                                    "text": ev["text"],
                                    "payload": ev["payload"],
                                }
                            )

                        session.add(
                            MatchState(
                                fixture_id=fixture.id,
                                status="completed",
                                clock_seconds=MATCH_DURATION_SECONDS,
                                home_goals=hg,
                                away_goals=ag,
                                current_events=current_evs,
                                event_version=len(current_evs),
                            )
                        )

                    total_fixtures += 1

        await session.commit()

        # Ensure default private admin user exists
        from app.core.security import hash_password
        from app.models.ledger import LedgerEntry
        from app.models.user import User
        from app.models.wallet import Wallet

        admin_res = await session.execute(select(User).where(User.email == "admin@vfn.eu"))
        if admin_res.scalar_one_or_none() is None:
            admin_user = User(
                email="admin@vfn.eu",
                display_name="VFN Chief Operator",
                password_hash=hash_password("yoursister'sfullname"),
                is_active=True,
                is_admin=True,
            )
            session.add(admin_user)
            await session.flush()
            admin_wallet = Wallet(
                id=admin_user.id,
                user_id=admin_user.id,
                available_minor=1000000,
                reserved_minor=0,
                currency="XTS",
                simulated=True,
            )
            session.add(admin_wallet)
            await session.flush()
            session.add(
                LedgerEntry(
                    wallet_id=admin_wallet.id,
                    user_id=admin_user.id,
                    kind="initial_grant",
                    amount_minor=1000000,
                    balance_after_minor=1000000,
                    description="Initial admin wallet grant",
                    reference=f"signup:{admin_user.id}",
                )
            )
            await session.commit()

        print(
            f"Seeded: {len(LEAGUE_DEFINITIONS)} European leagues, {total_clubs} clubs, "
            f"{total_fixtures} fixtures (Matchday 1 completed, Matchday 2 kicks off in 4 minutes)."
        )


if __name__ == "__main__":
    asyncio.run(seed())
