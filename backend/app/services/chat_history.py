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


async def create_session(db: AsyncSession, user_id: str, title: str | None = None) -> ChatSession:
    """
    Create a new chat session.

    Args:
        db: Async database session.
        user_id: UUID of the user.
        title: Optional session title.

    Returns:
        The newly created ChatSession.
    """
    session = ChatSession(title=title, user_id=user_id)
    db.add(session)
    await db.flush()  # Populate the auto-generated id

    logger.info("Created chat session: %s for user: %s", session.id, user_id)
    return session


async def get_session(db: AsyncSession, session_id: str, user_id: str) -> ChatSession | None:
    """
    Retrieve a session by ID, including its messages, enforcing user ownership.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        user_id: UUID of the user.

    Returns:
        The ChatSession with messages loaded, or None if not found or unauthorized.
    """
    stmt = (
        select(ChatSession)
        .where(ChatSession.id == session_id)
        .where(ChatSession.user_id == user_id)
        .options(selectinload(ChatSession.messages))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_sessions(
    db: AsyncSession, user_id: str, limit: int = 50, offset: int = 0
) -> list[dict]:
    """
    List all chat sessions for a user with message counts, ordered by most recent.

    Args:
        db: Async database session.
        user_id: UUID of the user.
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
        .where(ChatSession.user_id == user_id)
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
    trace_data: list[dict] | None = None,
    metadata: dict | None = None,
) -> ChatMessage:
    """
    Add a new message to a session.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        role: "user" or "assistant".
        content: The message text.
        trace_data: Optional execution trace JSON.
        metadata: Optional metadata (e.g. sources).

    Returns:
        The newly created ChatMessage.
    """
    message = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        trace_data=trace_data,
        message_metadata=metadata,
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


async def delete_session(db: AsyncSession, session_id: str, user_id: str) -> bool:
    """
    Delete a chat session and all its messages (cascade).

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        user_id: UUID of the user (for ownership validation).

    Returns:
        True if session was found and deleted, False otherwise.
    """
    session = await get_session(db, session_id, user_id)
    if session is None:
        return False

    await db.delete(session)
    logger.info("Deleted chat session: %s", session_id)
    return True


async def rename_session(db: AsyncSession, session_id: str, user_id: str, title: str) -> ChatSession | None:
    """
    Rename a chat session.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        user_id: UUID of the user (for ownership validation).
        title: The new title for the session.

    Returns:
        The updated ChatSession, or None if not found/unauthorized.
    """
    session = await get_session(db, session_id, user_id)
    if session is None:
        return None

    session.title = title
    # DB session automatically tracks this change for flush/commit
    logger.info("Renamed chat session: %s to '%s'", session_id, title)
    return session


async def delete_all_sessions(db: AsyncSession, user_id: str) -> int:
    """
    Delete all chat sessions for a user and their messages (cascade).
    
    Args:
        db: Async database session.
        user_id: UUID of the user.
        
    Returns:
        Number of sessions deleted.
    """
    stmt = select(ChatSession).where(ChatSession.user_id == user_id)
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    
    count = len(sessions)
    for session in sessions:
        await db.delete(session)
        
    logger.info("Deleted all %d chat sessions for user %s.", count, user_id)
    return count


async def get_recent_messages(db: AsyncSession, session_id: str, limit: int = 10) -> list[dict]:
    """
    Retrieve the most recent messages for a session.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.
        limit: Maximum number of messages to retrieve.

    Returns:
        List of message dicts in chronological order.
    """
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.timestamp.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    # Reverse to return in chronological order
    messages = list(reversed(messages))

    return [
        {
            "role": msg.role,
            "content": msg.content,
        }
        for msg in messages
    ]


async def get_session_traces(db: AsyncSession, session_id: str) -> list[dict]:
    """
    Retrieve all execution traces for a given session.
    Only assistant messages will contain trace_data.

    Args:
        db: Async database session.
        session_id: UUID of the chat session.

    Returns:
        List of dicts containing message_id, timestamp, and trace_data.
    """
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.trace_data.is_not(None))
        .order_by(ChatMessage.timestamp.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()

    result_traces = []
    for msg in messages:
        if not msg.trace_data:
            continue
            
        import json
        trace_data = msg.trace_data
        if isinstance(trace_data, str):
            try:
                trace_data = json.loads(trace_data)
            except Exception:
                continue
                
        if trace_data and isinstance(trace_data, list) and len(trace_data) > 0:
            result_traces.append({
                "message_id": msg.id,
                "timestamp": msg.timestamp,
                "trace_data": trace_data,
            })

    return result_traces
