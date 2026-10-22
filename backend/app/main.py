import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import admin, auth, bets, fixtures, league, matches, odds, platform, settlement, wallet
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.fixture import Fixture
from app.models.user import User
from app.schemas.user import UserOut
from engine.simulator import MATCH_DURATION_SECONDS, MatchEngine

PRE_MATCH_COUNTDOWN_SECONDS = 240  # 4 minutes between matchdays


def _parse_iso(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


async def _background_match_loop():
    """Autonomous Virtual Football Universe scheduler:
    1. Ticks all currently `live` matches forward every second.
    2. When a matchday finishes (`live` -> `completed`), schedules the next `upcoming`
       matchday to kick off exactly 4 minutes (240 seconds) later, and schedules subsequent
       matchdays in 12-minute intervals (8m match + 4m break).
    3. When `now >= kickoff_at` for the next `upcoming` matchday (and no matches are currently live),
       automatically kicks off all fixtures in that matchday simultaneously.
    """
    while True:
        try:
            if settings.SIMULATION_PAUSED:
                await asyncio.sleep(1.0)
                continue
            now = datetime.now(timezone.utc)
            async with AsyncSessionLocal() as session:
                res = await session.execute(
                    select(Fixture)
                    .options(selectinload(Fixture.home_club), selectinload(Fixture.away_club))
                    .order_by(Fixture.matchday.asc(), Fixture.created_at.asc())
                )
                all_fixtures = res.scalars().all()
                if all_fixtures:
                    engine = MatchEngine(session)
                    live_fixtures = [f for f in all_fixtures if f.status == "live"]
                    upcoming_fixtures = [f for f in all_fixtures if f.status == "upcoming"]

                    if live_fixtures:
                        just_finished_matchday = False
                        for fx in live_fixtures:
                            state = await engine.get_state(fx.id)
                            if state is None:
                                state = await engine.initialize_match(fx, fx.home_club, fx.away_club)
                                state = await engine.start_match(fx)
                            next_clock = min(
                                MATCH_DURATION_SECONDS,
                                state.clock_seconds + settings.SIMULATION_SPEED_MULTIPLIER,
                            )
                            new_state = await engine.advance_tick(fx, next_clock)
                            if new_state.status == "completed":
                                just_finished_matchday = True

                        # If all fixtures of the live matchday just completed, set the next matchday
                        # kickoff to exactly 4 minutes (240s) from now!
                        if just_finished_matchday and upcoming_fixtures:
                            still_live = [f for f in live_fixtures if f.status == "live"]
                            if not still_live:
                                finish_time = datetime.now(timezone.utc)
                                next_md = min(f.matchday for f in upcoming_fixtures)
                                for f in upcoming_fixtures:
                                    md_offset = f.matchday - next_md
                                    target_ko = finish_time + timedelta(
                                        seconds=PRE_MATCH_COUNTDOWN_SECONDS
                                        + md_offset * (MATCH_DURATION_SECONDS + PRE_MATCH_COUNTDOWN_SECONDS)
                                    )
                                    f.kickoff_at = target_ko.isoformat()
                                await session.commit()

                    elif upcoming_fixtures:
                        # No live matches right now: check the next upcoming matchday
                        next_md = min(f.matchday for f in upcoming_fixtures)
                        next_md_fixtures = [f for f in upcoming_fixtures if f.matchday == next_md]
                        earliest_ko = min(_parse_iso(f.kickoff_at) for f in next_md_fixtures)

                        if now >= earliest_ko:
                            # Kick off all fixtures in `next_md` simultaneously!
                            for fx in next_md_fixtures:
                                state = await engine.initialize_match(fx, fx.home_club, fx.away_club)
                                if state.status == "upcoming":
                                    await engine.start_match(fx)
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    if settings.ENABLE_BACKGROUND_LOOP:
        task = asyncio.create_task(_background_match_loop())
    try:
        yield
    finally:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Virtual Football Universe API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "HTTP_ERROR")
        message = exc.detail.get("message", str(exc.detail))
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": code,
                "message": message,
                "detail": exc.detail,
            },
            headers=exc.headers,
        )
    code_map = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": code_map.get(exc.status_code, "HTTP_ERROR"),
            "message": str(exc.detail),
            "detail": exc.detail,
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_msg = errors[0].get("msg", "Validation error") if errors else "Validation error"
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": first_msg,
            "detail": errors,
        },
    )


app.include_router(auth.router)
app.include_router(league.router)
app.include_router(fixtures.router)
app.include_router(matches.router)
app.include_router(odds.router)
app.include_router(bets.router)
app.include_router(settlement.router)
app.include_router(wallet.router)
app.include_router(admin.router)
app.include_router(platform.router)


@app.get("/me", response_model=UserOut, tags=["auth"])
async def root_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
