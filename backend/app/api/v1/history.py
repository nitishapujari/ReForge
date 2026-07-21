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


import json

def get_message_metadata_with_fallback(msg) -> dict:
    meta = msg.message_metadata or {}
    if meta and "sources" in meta and meta["sources"]:
        return meta
        
    trace_data = msg.trace_data
    if isinstance(trace_data, str):
        try:
            trace_data = json.loads(trace_data)
        except Exception:
            pass
            
    if not trace_data or not isinstance(trace_data, list):
        return meta
        
    new_meta = dict(meta) if meta else {}
    sources = []
    
    # 1. Try from generate node's retrieval_diagnostics
    for step in trace_data:
        if isinstance(step, dict) and step.get("node") == "generate":
            diagnostics = step.get("retrieval_diagnostics") or []
            for diag in diagnostics:
                if diag.get("included") and diag.get("filename"):
                    sources.append({
                        "filename": diag["filename"],
                        "document_score": diag.get("score", 0.0),
                        "chunks": [
                            {
                                "chunk_number": 1,
                                "page_number": 1,
                                "content_preview": "Snippet text not available in history log.",
                                "similarity_score": diag.get("score", 0.0)
                            }
                        ]
                    })
            if sources:
                break
                
    # 2. Try from retrieve node
    if not sources:
        for step in trace_data:
            if isinstance(step, dict) and step.get("node") == "retrieve":
                output_summary = step.get("output_summary")
                if output_summary:
                    try:
                        if isinstance(output_summary, str):
                            out_dict = json.loads(output_summary)
                        else:
                            out_dict = output_summary
                        
                        docs = out_dict.get("documents") or []
                        for doc in docs:
                            sources.append({
                                "filename": doc,
                                "document_score": out_dict.get("top_score", 0.0),
                                "chunks": [
                                    {
                                        "chunk_number": 1,
                                        "page_number": 1,
                                        "content_preview": "Snippet text not available in history log.",
                                        "similarity_score": out_dict.get("top_score", 0.0)
                                    }
                                ]
                            })
                    except Exception:
                        pass
                if sources:
                    break
                    
    if sources:
        new_meta["sources"] = sources
        if "response_type" not in new_meta:
            new_meta["response_type"] = "GROUNDED"
            
    # Check critique node for grounded/confidence
    for step in trace_data:
        if isinstance(step, dict) and step.get("node") == "critique":
            output_summary = step.get("output_summary")
            if output_summary:
                try:
                    if isinstance(output_summary, str):
                        out_dict = json.loads(output_summary)
                    else:
                        out_dict = output_summary
                    
                    if "grounded" in out_dict:
                        new_meta["grounded"] = out_dict["grounded"]
                    if "confidence" in out_dict:
                        new_meta["confidence"] = out_dict["confidence"]
                    if "verification_status" not in new_meta:
                        new_meta["verification_status"] = "VERIFIED"
                except Exception:
                    pass
                    
    return new_meta


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
            MessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                timestamp=msg.timestamp,
                metadata=get_message_metadata_with_fallback(msg)
            )
            for msg in session.messages
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
