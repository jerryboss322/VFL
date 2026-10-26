import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


def _resolve_database_url() -> str:
    # 1. Direct explicit DATABASE_URL
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    # 2. Vercel Postgres / Neon / Supabase provider env variables
    for k in (
        "POSTGRES_URL_NON_POOLING",
        "POSTGRES_URL",
        "POSTGRES_PRISMA_URL",
        "SUPABASE_POSTGRES_URL",
        "SUPABASE_DATABASE_URL",
        "SUPABASE_DB_URL",
    ):
        val = os.environ.get(k)
        if val:
            return val

    # 3. Construct from POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD if present
    pg_host = os.environ.get("POSTGRES_HOST")
    pg_user = os.environ.get("POSTGRES_USER")
    pg_pass = os.environ.get("POSTGRES_PASSWORD")
    pg_db = os.environ.get("POSTGRES_DATABASE") or "neondb"
    if pg_host and pg_user and pg_pass:
        port = "6543" if "pooler" in pg_host else "5432"
        return f"postgresql://{pg_user}:{pg_pass}@{pg_host}:{port}/{pg_db}?sslmode=require"

    # 4. Fallback: local dev
    return "postgresql+asyncpg://postgres@localhost:5433/virtual_football"


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
