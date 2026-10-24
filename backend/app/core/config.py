import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


def _resolve_database_url() -> str:
    # 1. Supabase-specific env variables provided by Vercel Supabase integration
    for k in (
        "SUPABASE_POSTGRES_URL",
        "SUPABASE_DATABASE_URL",
        "SUPABASE_DB_URL",
        "POSTGRES_URL_NON_POOLING",
    ):
        val = os.environ.get(k)
        if val:
            return val

    # 2. Check if POSTGRES_URL or DATABASE_URL point to Supabase
    p_url = os.environ.get("POSTGRES_URL")
    d_url = os.environ.get("DATABASE_URL")
    if p_url and "supabase" in p_url:
        return p_url
    if d_url and "supabase" in d_url:
        return d_url

    # 3. Construct from POSTGRES_HOST / POSTGRES_USER / POSTGRES_PASSWORD if set by Supabase integration
    pg_host = os.environ.get("POSTGRES_HOST")
    pg_user = os.environ.get("POSTGRES_USER")
    pg_pass = os.environ.get("POSTGRES_PASSWORD")
    pg_db = os.environ.get("POSTGRES_DATABASE") or "postgres"
    if pg_host and pg_user and pg_pass and "supabase" in pg_host:
        return f"postgresql://{pg_user}:{pg_pass}@{pg_host}:6543/{pg_db}?sslmode=require"

    # 4. Standard fallback: prefer POSTGRES_URL if DATABASE_URL points to old Neon
    if p_url and d_url and "neon" in d_url and "neon" not in p_url:
        return p_url
    return d_url or p_url or "postgresql+asyncpg://postgres@localhost:5433/virtual_football"


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = _resolve_database_url()
    SECRET_KEY: str = os.environ.get("SECRET_KEY") or "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days


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


settings = Settings()
