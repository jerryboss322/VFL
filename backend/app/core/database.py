import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _normalize_db_url(raw: str) -> tuple[str, dict]:
    """Accept plain Neon/Vercel Postgres URLs and adapt them for asyncpg."""
    url = raw
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    connect_args: dict = {}
    # asyncpg does not understand libpq-only params such as sslmode / channel_binding
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = "require"
    url = urlunsplit(parts._replace(query=urlencode(query)))
    return url, connect_args


_db_url, _connect_args = _normalize_db_url(settings.DATABASE_URL)
_is_serverless = bool(os.environ.get("VERCEL"))

engine = create_async_engine(
    _db_url,
    echo=False,
    future=True,
    connect_args=_connect_args,
    # Serverless functions must not hold pooled connections across invocations
    poolclass=NullPool if _is_serverless else None,
) if _is_serverless else create_async_engine(
    _db_url, echo=False, future=True, connect_args=_connect_args
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
