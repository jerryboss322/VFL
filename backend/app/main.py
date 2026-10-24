import os
import logging
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
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
from app.services.simulation_tick import run_simulation_tick

async def _background_match_loop():
    """Local/long-running hosts: drive the stateless simulation tick every second."""
    while True:
        try:
            await run_simulation_tick()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.exception("Error in background match loop: %s", e)
        await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = None
    # Serverless (Vercel) cannot keep a loop alive; Vercel Cron calls /api/cron/tick instead
    if settings.ENABLE_BACKGROUND_LOOP and not os.environ.get("VERCEL"):
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


_last_lazy_tick = 0.0


@app.middleware("http")
async def lazy_simulation_catchup(request: Request, call_next):
    """On Vercel (where background daemon loops don't exist and Hobby plans limit cron jobs),
    the simulation catches up seamlessly on any incoming request at most once every 2 seconds.
    This ensures live matches, scores, timers, and settlements remain 100% accurate without
    requiring a paid Vercel Pro cron plan."""
    global _last_lazy_tick
    p = request.url.path
    if (
        "/fixtures" in p
        or "/matches" in p
        or "/league" in p
        or "/bets" in p
        or "/admin" in p
        or "/profile" in p
        or "/leaderboard" in p
        or "/cron" in p
    ):
        import time

        now = time.monotonic()
        if now - _last_lazy_tick > 2.0:
            _last_lazy_tick = now
            try:
                await run_simulation_tick()
            except Exception as e:
                logging.exception("Error in lazy_simulation_catchup: %s", e)
    return await call_next(request)


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    err_msg = str(exc)
    logging.exception("Unhandled server exception: %s", exc)
    if "quota" in err_msg.lower():
        return JSONResponse(
            status_code=503,
            content={
                "code": "DATABASE_QUOTA_EXCEEDED",
                "message": "The Postgres database provider (Neon) has exceeded its quota limit. Upgrade your Neon plan or update DATABASE_URL with a new database in Vercel.",
                "detail": err_msg,
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": err_msg or "An unexpected server error occurred",
            "detail": err_msg,
        },
    )


for _prefix in ("", "/api"):
    _router = APIRouter(prefix=_prefix)
    _router.include_router(auth.router)
    _router.include_router(league.router)
    _router.include_router(fixtures.router)
    _router.include_router(matches.router)
    _router.include_router(odds.router)
    _router.include_router(bets.router)
    _router.include_router(settlement.router)
    _router.include_router(wallet.router)
    _router.include_router(admin.router)
    _router.include_router(platform.router)

    @_router.get("/me", response_model=UserOut, tags=["auth"])
    async def root_me(current_user: User = Depends(get_current_user)):
        return UserOut(
            id=str(current_user.id),
            email=current_user.email,
            display_name=current_user.display_name,
            is_active=current_user.is_active,
            is_admin=current_user.is_admin,
        )

    @_router.get("/cron/tick", tags=["system"])
    async def cron_tick(request: Request):
        """Invoked by Vercel Cron to advance the simulation (protected by CRON_SECRET)."""
        secret = os.environ.get("CRON_SECRET")
        if secret and request.headers.get("authorization") != f"Bearer {secret}":
            raise HTTPException(status_code=401, detail="Invalid cron secret")
        return await run_simulation_tick()

    @_router.get("/health")
    async def health():
        return {"status": "ok"}

    @_router.get("/health/db", tags=["system"])
    async def health_db():
        """Report database connectivity and whether the schema/seed data exist (no secrets exposed)."""
        from sqlalchemy import text

        from app.core.database import engine

        url = settings.DATABASE_URL
        info: dict = {
            "database_url_configured": bool(os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")),
            "env_keys_found": [k for k in ["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "SECRET_KEY"] if k in os.environ],
            "points_to_localhost": "localhost" in url or "127.0.0.1" in url,
        }
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
                info["connected"] = True
                try:
                    info["leagues"] = (await conn.execute(text("SELECT count(*) FROM leagues"))).scalar()
                except Exception as exc:  # schema missing
                    info["schema_error"] = type(exc).__name__ + ": " + str(exc).splitlines()[0][:200]
        except Exception as exc:
            info["connected"] = False
            info["error"] = type(exc).__name__ + ": " + str(exc).splitlines()[0][:200] if str(exc) else type(exc).__name__
        return info

    @_router.post("/system/init-db", tags=["system"])
    async def init_db(request: Request):
        """Auto-initialize schema and seed leagues/clubs if database is empty."""
        from app.core.database import Base, engine
        import importlib
        # Import all models to ensure they register on Base.metadata
        for mod in ["app.models.league", "app.models.club", "app.models.fixture", "app.models.season", 
                    "app.models.user", "app.models.bet", "app.models.odds", "app.models.match_state", 
                    "app.models.match_event", "app.models.financial_ledger", "app.models.audit_log"]:
            try:
                importlib.import_module(mod)
            except Exception:
                pass

        from seed import seed

        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed data
        await seed(force_reset=False)
        return {"status": "success", "message": "Database tables and seed data created successfully"}


    app.include_router(_router)
