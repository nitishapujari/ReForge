"""
ReForge — Chat History Service.

CRUD operations for chat sessions and messages.
Business logic is here; the API route layer stays thin.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatMessage, ChatSession
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def create_session(db: AsyncSession, title: str | None = None) -> ChatSession:
    """
    Create a new chat session.

    Args:
        db: Async database session.
        title: Optional session title.

    Returns:
        The newly created ChatSession.
    """
    session = ChatSession(title=title)
    db.add(session)
    await db.flush()  # Populate the auto-generated id

    logger.info("Created chat session: %s", session.id)
    return session


async def get_session(db: AsyncSession, session_id: str) -> ChatSession | None:
    """
    Retrieve a session by ID, including its messages.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.

    Returns:
        The ChatSession with messages loaded, or None if not found.
    """
    stmt = (
        select(ChatSession)
        .where(ChatSession.id == session_id)
        .options(selectinload(ChatSession.messages))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_sessions(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[dict]:
    """
    List all chat sessions with message counts, ordered by most recent.

    Args:
        db: Async database session.
        limit: Max sessions to return.
        offset: Pagination offset.

    Returns:
        List of session dicts with message_count included.
    """
    # Subquery for message counts
    msg_count_subq = (
        select(
            ChatMessage.session_id,
            func.count(ChatMessage.id).label("message_count"),
        )
        .group_by(ChatMessage.session_id)
        .subquery()
    )

    stmt = (
        select(
            ChatSession,
            func.coalesce(msg_count_subq.c.message_count, 0).label(
                "message_count"
            ),
        )
        .outerjoin(
            msg_count_subq,
            ChatSession.id == msg_count_subq.c.session_id,
        )
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": row.ChatSession.id,
            "title": row.ChatSession.title,
            "created_at": row.ChatSession.created_at,
            "updated_at": row.ChatSession.updated_at,
            "message_count": row.message_count,
        }
        for row in rows
    ]


async def add_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
) -> ChatMessage:
    """
    Add a message to an existing chat session.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        role: Message role ('user' or 'assistant').
        content: Message text content.

    Returns:
        The newly created ChatMessage.
    """
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
    )
    db.add(message)
    await db.flush()

    logger.debug(
        "Added %s message to session %s (msg_id=%s)",
        role,
        session_id,
        message.id,
    )
    return message


async def delete_session(db: AsyncSession, session_id: str) -> bool:
    """
    Delete a chat session and all its messages (cascade).

    Args:
        db: Async database session.
        session_id: UUID of the chat session.

    Returns:
        True if session was found and deleted, False otherwise.
    """
    session = await get_session(db, session_id)
    if session is None:
        return False

    await db.delete(session)
    logger.info("Deleted chat session: %s", session_id)
    return True
