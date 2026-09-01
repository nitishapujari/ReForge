"""
ReForge — Database Engine & Session.

Async SQLAlchemy setup for PostgreSQL (and SQLite for local dev). Provides:
- Async engine
- Async session factory
- Base class for ORM models
- Dependency for FastAPI route injection
"""


from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.utils.logger import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


# Module-level engine and session factory — initialized via init_db()
_engine = None
_async_session_factory = None


async def init_db(database_url: str) -> None:
    """
    Initialize the database engine and create all tables.

    Args:
        database_url: SQLAlchemy connection string (e.g. postgresql+asyncpg://...).
    """
    global _engine, _async_session_factory

    _engine = create_async_engine(
        database_url,
        echo=False,
        future=True,
    )

    _async_session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


    logger.info("Database initialized with URL: %s", database_url.split('@')[-1] if '@' in database_url else database_url)


async def close_db() -> None:
    """Dispose the database engine on shutdown."""
    global _engine
    if _engine is not None:
        await _engine.dispose()
        logger.info("Database connection closed")


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async database session.

    Usage:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db_session)):
            ...
    """
    if _async_session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_session_factory():
    """Get the raw session factory for background tasks."""
    if _async_session_factory is None:
        raise RuntimeError("Database not initialized.")
    return _async_session_factory
