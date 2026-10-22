"""Migration tests: verify all expected tables exist after migrations."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

EXPECTED_TABLES = [
    "users",
    "wallets",
    "clubs",
    "leagues",
    "seasons",
    "fixtures",
    "odds_snapshots",
    "bets",
    "ledger_entries",
    "match_states",
    "match_events",
    "alembic_version",
]


async def test_all_tables_exist(client, db_session: AsyncSession):
    result = await db_session.execute(
        text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
    )
    tables = {row[0] for row in result.fetchall()}
    for expected in EXPECTED_TABLES:
        assert expected in tables, f"Missing table: {expected}"


async def test_tables_empty_initially(client, db_session: AsyncSession):
    """Tables exist but contain no seed data (per project state)."""
    result = await db_session.execute(text("SELECT count(*) FROM users"))
    assert result.scalar() == 0
    result = await db_session.execute(text("SELECT count(*) FROM fixtures"))
    assert result.scalar() == 0