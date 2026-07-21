"""
ReForge — Execution Trace API Routes.

GET /trace/{session_id} — Fetch detailed execution trace for a specific chat session.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db_session
from app.models.schemas import TraceResponse
from app.services import chat_history
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Trace"])

from app.api.deps import CurrentUser

@router.get(
    "/trace/{session_id}",
    response_model=TraceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get execution trace",
    description="Retrieve the execution traces for all assistant messages in a specific chat session.",
    responses={
        404: {"description": "Session not found"},
    },
)
async def get_session_traces(
    session_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session),
) -> TraceResponse:
    """Fetch traces for a session."""
    # Validate session exists
    session = await chat_history.get_session(db, session_id, current_user.id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )
    
    # Retrieve messages with traces
    trace_records = await chat_history.get_session_traces(db, session_id)
    
    logger.info("Fetched %d traces for session %s", len(trace_records), session_id)
    
    return TraceResponse(
        session_id=session_id,
        traces=trace_records,
    )
