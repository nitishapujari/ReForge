"""
ReForge — Database Engine & Session.

Async SQLAlchemy setup for SQLite. Provides:
- Async engine
- Async session factory
- Base class for ORM models
- Dependency for FastAPI route injection
"""

from pathlib import Path
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


async def init_db(database_url: str, db_path: Path) -> None:
    """
    Initialize the database engine and create all tables.

    Args:
        database_url: SQLAlchemy connection string (e.g. sqlite+aiosqlite:///...).
        db_path: Absolute path to the SQLite file (for directory creation).
    """
    global _engine, _async_session_factory

    # Ensure the directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Build absolute URL for SQLite
    absolute_url = f"sqlite+aiosqlite:///{db_path}"

    _engine = create_async_engine(
        absolute_url,
        echo=False,
        future=True,
    )

    _async_session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create all tables
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized at %s", db_path)


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
