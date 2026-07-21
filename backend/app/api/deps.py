"""
ReForge — API Dependencies.

FastAPI dependencies for authentication, database sessions, etc.
"""

from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db_session
from app.models.user import User
from app.utils.auth import decode_access_token


# Re-export get_db_session for convenience
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]

# We use standard OAuth2 Bearer token schema
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(token: TokenDep, db: SessionDep) -> User:
    """
    Dependency to get the current authenticated user from the JWT token.
    Raises 401 if the token is invalid or user doesn't exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "success": False,
            "error": {
                "code": "UNAUTHORIZED",
                "message": "Could not validate credentials",
            }
        },
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    return user


# Dependency type hint for routes
CurrentUser = Annotated[User, Depends(get_current_user)]
