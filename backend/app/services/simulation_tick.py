"""Stateless simulation tick.

Advances the persistent football world based on wall-clock time, so it can be
driven either by the local always-on background loop (every second) or by a
Vercel Cron invocation (e.g. once a minute) and always converge to the same state.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.club import Club
from app.models.fixture import Fixture
from app.models.league import League
from app.models.odds import OddsSnapshot
from app.models.season import Season
from app.services.odds_engine import generate_fixture_markets
from engine.simulator import MATCH_DURATION_SECONDS, MatchEngine


HALFTIME_BREAK_SECONDS = 10  # 10-second tactical interval after 1st half


def get_season_pairings(clubs: list[Club], matchday: int) -> list[tuple[Club, Club]]:
    """Double round-robin generator: exactly 38 matchdays for 20 clubs, 34 for 18 clubs."""
    n = len(clubs)
    if n < 2:
        return []
    half_season = n - 1
    total_mds = half_season * 2
    md_idx = (matchday - 1) % total_mds

    rotation = list(clubs)
    rounds: list[list[tuple[Club, Club]]] = []
    # 1st half of the season
    for r in range(half_season):
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

    # 2nd half of the season: reverse home and away
    for r in range(half_season):
        pairings = [(c2, c1) for c1, c2 in rounds[r]]
        rounds.append(pairings)

    return rounds[md_idx]


async def _cleanup_duplicate_fixtures(session) -> int:
    """Purge duplicate upcoming fixtures for the same club on the same matchday if no bets exist."""
    from app.models.bet import Bet

    upcoming_res = await session.execute(
        select(Fixture)
        .where(Fixture.status == "upcoming")
        .order_by(Fixture.matchday.asc(), Fixture.created_at.asc())
    )
    all_upcoming = upcoming_res.scalars().all()
    seen_club_md: dict[tuple[int, str], Fixture] = {}
    deleted_count = 0

    for fx in all_upcoming:
        k_home = (fx.matchday, str(fx.home_club_id))
        k_away = (fx.matchday, str(fx.away_club_id))
        if k_home in seen_club_md or k_away in seen_club_md:
            bets_res = await session.execute(
                select(Bet.id).where(Bet.fixture_id == fx.id).limit(1)
            )
            has_bets = bets_res.scalar_one_or_none() is not None
            if not has_bets:
                await session.delete(fx)
                deleted_count += 1
                continue
        seen_club_md[k_home] = fx
        seen_club_md[k_away] = fx

    if deleted_count > 0:
        await session.commit()
    return deleted_count


async def _ensure_infinite_upcoming_fixtures(session, now: datetime, pre_match: int) -> list[Fixture]:
    """Ensure every league always has upcoming matchdays scheduled into the infinite future."""
    leagues_res = await session.execute(select(League))
    leagues = leagues_res.scalars().all()
    if not leagues:
        return []

    # Clean any legacy duplicate upcoming fixtures without bets
    await _cleanup_duplicate_fixtures(session)

    created_any = False
    for lg in leagues:
        # Find active season for this league
        season_res = await session.execute(
            select(Season)
            .where(Season.league_id == lg.id, Season.is_active == True)  # noqa: E712
            .order_by(Season.created_at.desc())
            .limit(1)
        )
        season = season_res.scalar_one_or_none()
        if not season:
            season_res = await session.execute(
                select(Season)
                .where(Season.league_id == lg.id)
                .order_by(Season.created_at.desc())
                .limit(1)
            )
            season = season_res.scalar_one_or_none()
            if not season:
                season = Season(
                    league_id=lg.id,
                    name=f"VFL Infinite Season",
                    year=now.year,
                    is_active=True,
                )
                session.add(season)
                await session.flush()
            else:
                season.is_active = True

        # Check upcoming fixtures for this active season
        upcoming_res = await session.execute(
            select(Fixture)
            .where(Fixture.season_id == season.id, Fixture.status == "upcoming")
        )
        upcoming_lg = upcoming_res.scalars().all()

        # If upcoming matchdays is below threshold (e.g. less than 4 upcoming matchdays), generate more
        distinct_upcoming_mds = len(set(f.matchday for f in upcoming_lg))
        if distinct_upcoming_mds < 4:
            # Find max matchday across this season
            max_md_res = await session.execute(
                select(Fixture)
                .where(Fixture.season_id == season.id)
                .order_by(Fixture.matchday.desc())
                .limit(1)
            )
            latest_fx = max_md_res.scalar_one_or_none()
            max_md = latest_fx.matchday if latest_fx else 0

            clubs_res = await session.execute(
                select(Club).where(Club.league_id == lg.id).order_by(Club.name.asc())
            )
            clubs = list(clubs_res.scalars().all())
            if len(clubs) < 2:
                continue

            # 20 clubs league: 38 matchdays per season. 18 clubs league: 34 matchdays per season.
            max_season_md = 38 if len(clubs) >= 20 else 34

            if max_md >= max_season_md:
                # Check if all fixtures in this season are completed before rolling over
                uncompleted_res = await session.execute(
                    select(Fixture.id).where(
                        Fixture.season_id == season.id,
                        Fixture.status != "completed",
                    ).limit(1)
                )
                if uncompleted_res.scalar_one_or_none() is None:
                    season.is_active = False
                    season_count_res = await session.execute(
                        select(Season).where(Season.league_id == lg.id)
                    )
                    total_seasons = len(season_count_res.scalars().all())
                    season = Season(
                        league_id=lg.id,
                        name=f"{lg.short_name} Season {total_seasons + 1}",
                        year=now.year,
                        is_active=True,
                    )
                    session.add(season)
                    await session.flush()
                    max_md = 0
                else:
                    continue

            # Determine kickoff base timestamp for new matchdays
            if latest_fx and latest_fx.status == "upcoming":
                base_time = _parse_iso(latest_fx.kickoff_at)
            else:
                base_time = now + timedelta(seconds=pre_match)

            match_cycle_seconds = MATCH_DURATION_SECONDS + HALFTIME_BREAK_SECONDS + pre_match

            # Generate additional matchdays (capped at max_season_md)
            for offset_idx in range(1, 5):
                target_md = max_md + offset_idx
                if target_md > max_season_md:
                    break

                # Check existing fixtures for target_md in this season
                existing_target_res = await session.execute(
                    select(Fixture).where(
                        Fixture.season_id == season.id,
                        Fixture.matchday == target_md,
                    )
                )
                existing_target = existing_target_res.scalars().all()
                if len(existing_target) >= len(clubs) // 2:
                    continue  # Matchday is already fully populated

                booked_clubs = {f.home_club_id for f in existing_target} | {f.away_club_id for f in existing_target}

                ko_time = base_time + timedelta(seconds=offset_idx * match_cycle_seconds)
                pairings = get_season_pairings(clubs, target_md)
                for home, away in pairings:
                    if home.id in booked_clubs or away.id in booked_clubs:
                        continue  # Already playing on this matchday

                    fx = Fixture(
                        season_id=season.id,
                        home_club_id=home.id,
                        away_club_id=away.id,
                        matchday=target_md,
                        kickoff_at=ko_time.isoformat(),
                        status="upcoming",
                    )
                    session.add(fx)
                    await session.flush()
                    booked_clubs.add(home.id)
                    booked_clubs.add(away.id)

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
                    created_any = True

    if created_any:
        await session.commit()

    # Re-query all fixtures ordered by matchday
    refreshed = await session.execute(
        select(Fixture)
        .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
        .order_by(Fixture.matchday.asc(), Fixture.created_at.asc())
    )
    return refreshed.scalars().all()


def _parse_iso(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


async def run_simulation_tick() -> dict:
    """Bring live matches up to date with the wall clock, kick off due matchdays,
    and schedule the next matchday after one completes. Idempotent."""
    if settings.SIMULATION_PAUSED:
        return {"paused": True}

    pre_match = getattr(settings, "PRE_MATCH_BREAK_SECONDS", 240)
    now = datetime.now(timezone.utc)
    advanced = kicked_off = 0

    async with AsyncSessionLocal() as session:
        # Guarantee infinite matchday pipeline: if upcoming fixtures run low or run out, auto-generate more
        fixtures = await _ensure_infinite_upcoming_fixtures(session, now, pre_match)
        if not fixtures:
            res = await session.execute(
                select(Fixture)
                .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
                .order_by(Fixture.matchday.asc(), Fixture.created_at.asc())
            )
            fixtures = res.scalars().all()
        if not fixtures:
            return {"advanced": 0, "kickedOff": 0}

        # Deduplicate fixtures in-memory so simulation engine never kicks off or advances duplicate matches on the same matchday
        seen_md_clubs: dict[int, set[str]] = {}
        unique_fixtures: list[Fixture] = []
        for f in fixtures:
            md_set = seen_md_clubs.setdefault(f.matchday, set())
            c1, c2 = str(f.home_club_id), str(f.away_club_id)
            if c1 in md_set or c2 in md_set:
                continue
            md_set.add(c1)
            md_set.add(c2)
            unique_fixtures.append(f)
        fixtures = unique_fixtures

        engine = MatchEngine(session)

        # 1. Kick off the next matchday if its kickoff time has passed and nothing is live
        live = [f for f in fixtures if f.status == "live"]
        upcoming = [f for f in fixtures if f.status == "upcoming"]
        if not live and upcoming:
            next_md = min(f.matchday for f in upcoming)
            md_fx = [f for f in upcoming if f.matchday == next_md]
            if now >= min(_parse_iso(f.kickoff_at) for f in md_fx):
                for fx in md_fx:
                    state = await engine.initialize_match(fx, fx.home_club, fx.away_club)
                    if state.status == "upcoming":
                        await engine.start_match(fx)
                        kicked_off += 1
                live = md_fx

        # 2. Advance every live match to the clock implied by elapsed wall time
        finished_at: datetime | None = None
        for fx in live:
            if fx.status != "live":
                continue
            state = await engine.get_state(fx.id)
            if state is None:
                await engine.initialize_match(fx, fx.home_club, fx.away_club)
                state = await engine.start_match(fx)
            started = _parse_iso(fx.kickoff_at)
            elapsed = int((now - started).total_seconds()) * settings.SIMULATION_SPEED_MULTIPLIER
            if elapsed < 240:
                target_sim_clock = min(240, elapsed)
            elif elapsed < 240 + HALFTIME_BREAK_SECONDS:
                # 10-second half-time interval (pinned to 45' HT)
                target_sim_clock = 240
            else:
                target_sim_clock = min(MATCH_DURATION_SECONDS, elapsed - HALFTIME_BREAK_SECONDS)

            target = max(state.clock_seconds, target_sim_clock)
            new_state = await engine.advance_tick(fx, min(MATCH_DURATION_SECONDS, target))
            advanced += 1
            if new_state.status == "completed":
                finished_at = started + timedelta(
                    seconds=(MATCH_DURATION_SECONDS + HALFTIME_BREAK_SECONDS) / max(1, settings.SIMULATION_SPEED_MULTIPLIER)
                )

        # 3. Once the whole matchday is done, schedule the following matchdays
        if finished_at is not None and not any(f.status == "live" for f in live):
            remaining = [f for f in fixtures if f.status == "upcoming"]
            if remaining:
                base = max(finished_at, now - timedelta(seconds=pre_match))
                next_md = min(f.matchday for f in remaining)
                for f in remaining:
                    offset = f.matchday - next_md
                    f.kickoff_at = (
                        base
                        + timedelta(seconds=pre_match + offset * (MATCH_DURATION_SECONDS + pre_match))
                    ).isoformat()
                await session.commit()

    return {"advanced": advanced, "kickedOff": kicked_off}
