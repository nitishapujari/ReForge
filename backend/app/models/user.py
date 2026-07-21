"""
ReForge — User ORM Model.

SQLAlchemy model for user accounts and future OAuth integrations.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean

from app.models.database import Base
from app.models.chat import _generate_uuid, _utcnow


class User(Base):
    """Represents a registered user or OAuth account."""

    __tablename__ = "users"

    id: str = Column(
        String(36),
        primary_key=True,
        default=_generate_uuid,
    )
    email: str = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    first_name: str = Column(
        String(255),
        nullable=True,
    )
    last_name: str = Column(
        String(255),
        nullable=True,
    )
    hashed_password: str = Column(
        String(255),
        nullable=True, # Nullable for OAuth-only users
        doc="Bcrypt hashed password",
    )
    
    # OAuth / Future Proofing fields
    provider: str = Column(
        String(50),
        default="credentials",
        nullable=False,
        doc="e.g., 'credentials', 'google', 'github'"
    )
    provider_account_id: str = Column(
        String(255),
        nullable=True,
        doc="The unique ID from the OAuth provider"
    )
    email_verified: datetime = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Timestamps
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
        return f"<User id={self.id} email={self.email} provider={self.provider}>"
