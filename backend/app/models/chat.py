"""
ReForge — Chat ORM Models.

SQLAlchemy models for chat sessions and messages.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.database import Base


def _generate_uuid() -> str:
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Return current UTC time."""
    return datetime.now(timezone.utc)


class ChatSession(Base):
    """Represents a single chat conversation."""

    __tablename__ = "chat_sessions"

    id: str = Column(
        String(36),
        primary_key=True,
        default=_generate_uuid,
    )
    title: str = Column(
        String(255),
        nullable=True,
        default=None,
        doc="Optional session title, auto-generated from first message.",
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    # Relationship
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.timestamp",
    )

    def __repr__(self) -> str:
        return f"<ChatSession id={self.id} title={self.title}>"


class ChatMessage(Base):
    """Represents a single message within a chat session."""

    __tablename__ = "chat_messages"

    id: str = Column(
        String(36),
        primary_key=True,
        default=_generate_uuid,
    )
    session_id: str = Column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: str = Column(
        String(20),
        nullable=False,
        doc="Message role: 'user' or 'assistant'.",
    )
    content: str = Column(
        Text,
        nullable=False,
        doc="Message text content.",
    )
    timestamp: datetime = Column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )

    # Relationship
    session = relationship("ChatSession", back_populates="messages")

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} role={self.role}>"
