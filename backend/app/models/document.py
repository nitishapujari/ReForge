"""
ReForge — Document ORM Model.

SQLAlchemy model for uploaded documents and ingestion state.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from app.models.database import Base
from app.models.chat import _generate_uuid, _utcnow


class Document(Base):
    """Represents an uploaded document and its vector store state."""

    __tablename__ = "documents"

    id: str = Column(
        String(36),
        primary_key=True,
        default=_generate_uuid,
    )
    filename: str = Column(
        String(255),
        nullable=False,
    )
    file_hash: str = Column(
        String(64),
        nullable=True,
        unique=True,
        index=True,
        doc="SHA-256 hash of the file content. NULL for legacy documents.",
    )
    chunk_count: int = Column(
        Integer,
        default=0,
    )
    status: str = Column(
        String(50),
        default="processing",
        doc="Ingestion status: processing, completed, failed",
    )
    error_message: str = Column(
        Text,
        nullable=True,
        doc="Error message if background ingestion failed.",
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

    def __repr__(self) -> str:
        return f"<Document id={self.id} filename={self.filename} status={self.status}>"
