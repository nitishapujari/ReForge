"""
ReForge — Chat API Routes.

POST /chat — Accept a user question, run retrieval + generation,
save to chat history, and return the grounded answer with sources.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.generator import generate_answer
from app.models.database import get_db_session
from app.models.schemas import ChatRequest, ChatResponse
from app.services import chat_history
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Chat"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat",
    description=(
        "Send a question and receive a grounded answer with source citations. "
        "Optionally provide a session_id to continue an existing conversation. "
        "If omitted, a new session is created automatically."
    ),
    responses={
        200: {
            "description": "Grounded answer with source citations",
            "content": {
                "application/json": {
                    "example": {
                        "session_id": "550e8400-e29b-41d4-a716-446655440000",
                        "answer": "RAG combines retrieval with generation...",
                        "sources": [
                            {
                                "filename": "research_paper.pdf",
                                "page_number": 3,
                                "chunk_number": 5,
                                "content_preview": "RAG combines retrieval...",
                                "similarity_score": 0.89,
                            }
                        ],
                        "grounded": True,
                        "confidence": 0.89,
                        "attempts": 1,
                    }
                }
            },
        },
        404: {"description": "Session not found"},
        500: {"description": "Generation failed"},
    },
)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    """Process a chat request through the RAG pipeline."""
    # Step 1: Resolve or create session
    if request.session_id:
        session = await chat_history.get_session(db, request.session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {request.session_id} not found.",
            )
        session_id = session.id
        logger.info("Continuing session: %s", session_id)
    else:
        # Create a new session with the question as the title
        title = request.question[:100]
        session = await chat_history.create_session(db, title=title)
        session_id = session.id
        logger.info("Created new session: %s", session_id)

    # Step 2: Save the user message
    await chat_history.add_message(
        db=db,
        session_id=session_id,
        role="user",
        content=request.question,
    )

    # Step 3: Generate answer through the RAG pipeline
    try:
        result = await generate_answer(question=request.question)
    except Exception as e:
        logger.error(
            "Generation failed for session %s: [%s] %s",
            session_id,
            type(e).__name__,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Answer generation failed: {str(e)}",
        )

    # Step 4: Save the assistant message
    await chat_history.add_message(
        db=db,
        session_id=session_id,
        role="assistant",
        content=result["answer"],
    )

    logger.info(
        "Chat complete: session=%s, grounded=%s, confidence=%.4f, sources=%d",
        session_id,
        result["grounded"],
        result["confidence"],
        len(result["sources"]),
    )

    # Step 5: Return the response
    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        sources=result["sources"],
        grounded=result["grounded"],
        confidence=result["confidence"],
        attempts=result["attempts"],
    )
