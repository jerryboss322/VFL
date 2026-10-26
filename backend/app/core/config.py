import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


DEFAULT_PRODUCTION_DB_URL = "postgresql://neondb_owner:npg_KjnwlDIF6b5v@ep-icy-recipe-b4giqoaz.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
EXHAUSTED_DB_HOSTS = ("b80nojoz", "aiciumdo")


def _resolve_database_url() -> str:
    # 1. Check explicit custom override
    for k in ("NEW_DATABASE_URL", "NEON_DATABASE_URL"):
        val = os.environ.get(k)
        if val and not any(bad in val for bad in EXHAUSTED_DB_HOSTS):
            return val

    # 2. Direct explicit DATABASE_URL (ignore if it points to known quota-exceeded hosts)
    raw_db_url = os.environ.get("DATABASE_URL")
    if raw_db_url and not any(bad in raw_db_url for bad in EXHAUSTED_DB_HOSTS):
        return raw_db_url

    # 3. Check Vercel Postgres / provider env variables (ignore if exhausted)
    for k in (
        "POSTGRES_URL_NON_POOLING",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
    ):
        v = os.environ.get(k)
        if v and not any(bad in v for bad in EXHAUSTED_DB_HOSTS) and "neon" in v:
            return v

    # 4. Construct from POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD if present
    pg_host = os.environ.get("POSTGRES_HOST")
    pg_user = os.environ.get("POSTGRES_USER")
    pg_pass = os.environ.get("POSTGRES_PASSWORD")
    pg_db = os.environ.get("POSTGRES_DATABASE") or "neondb"
    if pg_host and pg_user and pg_pass and not any(bad in pg_host for bad in EXHAUSTED_DB_HOSTS):
        port = "6543" if "pooler" in pg_host else "5432"
        return f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{port}/{pg_db}?sslmode=require"

    # 5. Production (Vercel) default to the active, seeded Neon database
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        return DEFAULT_PRODUCTION_DB_URL

    # 6. Fallback: local dev
    return DEFAULT_PRODUCTION_DB_URL


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = ""
    SECRET_KEY: str = os.environ.get("SECRET_KEY") or "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    def __init__(self, **values):
        super().__init__(**values)
        # Override BaseSettings env auto-population which picks stale Neon DATABASE_URL
        self.DATABASE_URL = _resolve_database_url()

    # Simulation
    MATCH_DURATION_SECONDS: int = 480  # 8 minutes wall-clock
    PRE_MATCH_BREAK_SECONDS: int = 240  # 4 minutes break between matchdays
    ENABLE_BACKGROUND_LOOP: bool = True
    SIMULATION_PAUSED: bool = False
    MAINTENANCE_MODE: bool = False
    READ_ONLY_DIAGNOSTIC_MODE: bool = False
    SIMULATION_SPEED_MULTIPLIER: int = 1  # 1 sim-second per 1 wall-second (real-time clock)

    # Wallet defaults (test money, minor units)
    INITIAL_WALLET_MINOR: int = 1000000  # 10,000.00 XTS

    # Stake limits
    MIN_STAKE_MINOR: int = 10  # 0.10 XTS
    MAX_STAKE_MINOR: int = 500000  # 5,000.00 XTS


# Ensure os.environ is synchronized and Settings uses resolved URL
_resolved_db_url = _resolve_database_url()
os.environ["DATABASE_URL"] = _resolved_db_url
settings = Settings()
settings.DATABASE_URL = _resolved_db_url
