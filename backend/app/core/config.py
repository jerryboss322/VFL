import os
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or "postgresql+asyncpg://postgres@localhost:5433/virtual_football"
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
