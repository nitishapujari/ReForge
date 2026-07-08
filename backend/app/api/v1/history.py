"""
ReForge — Chat History API Routes.

Endpoints for listing sessions, retrieving session messages,
and deleting sessions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db_session
from app.models.schemas import (
    MessageResponse,
    SessionDetailResponse,
    SessionResponse,
)
from app.services import chat_history

router = APIRouter(prefix="/history", tags=["Chat History"])


@router.get(
    "",
    response_model=list[SessionResponse],
    summary="List Chat Sessions",
    description="Returns all chat sessions ordered by most recent, with message counts.",
    responses={
        200: {
            "description": "List of chat sessions",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "title": "RAG Pipeline Question",
                            "created_at": "2026-07-06T10:00:00Z",
                            "updated_at": "2026-07-06T10:05:00Z",
                            "message_count": 4,
                        }
                    ]
                }
            },
        }
    },
)
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=100, description="Max sessions"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    """List all chat sessions with message counts."""
    return await chat_history.list_sessions(db, limit=limit, offset=offset)


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
    summary="Get Session Messages",
    description="Returns a chat session with all its messages.",
    responses={
        200: {
            "description": "Session with messages",
        },
        404: {
            "description": "Session not found",
        },
    },
)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get a specific session and all its messages."""
    session = await chat_history.get_session(db, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "messages": [
            MessageResponse.model_validate(msg) for msg in session.messages
        ],
    }


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Chat Session",
    description="Deletes a chat session and all its messages.",
    responses={
        204: {"description": "Session deleted"},
        404: {"description": "Session not found"},
    },
)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a session and all associated messages."""
    deleted = await chat_history.delete_session(db, session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )


@router.delete(
    "",
    status_code=status.HTTP_200_OK,
    summary="Delete All Chat Sessions",
    description="Deletes all chat sessions and their messages.",
    responses={
        200: {"description": "All sessions deleted"},
    },
)
async def delete_all_sessions(
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Delete all sessions and all associated messages."""
    count = await chat_history.delete_all_sessions(db)
    return {"deleted_count": count, "message": f"Successfully deleted {count} sessions."}
