"""
ReForge — Chat API Routes.

POST /chat — Accept a user question, run retrieval + generation,
save to chat history, and return the grounded answer with sources.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from app.graph import compile_graph, get_initial_state
from app.models.database import get_db_session
from app.models.schemas import ChatRequest, ChatResponse
from app.services import chat_history
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Chat"])

# Compile the LangGraph self-healing RAG graph once at startup
compiled_graph = compile_graph()

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

    # Step 3: Generate answer through the LangGraph pipeline
    try:
        initial_state = get_initial_state(question=request.question, session_id=session_id)
        # Execute the graph synchronously in a background thread
        result = await asyncio.to_thread(compiled_graph.invoke, initial_state)
        
        final_answer = result.get("final_answer") or result.get("answer") or "Sorry, I could not generate an answer."
        sources = result.get("sources", [])
        grounded = result.get("grounded", False)
        confidence = result.get("confidence", 0.0)
        attempts = result.get("attempts", 1)
        
        # Convert TraceEntry models to dicts for JSON storage
        trace_entries = result.get("trace", [])
        trace_data = [t.model_dump() if hasattr(t, "model_dump") else t for t in trace_entries] if trace_entries else None
        
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
        content=final_answer,
        trace_data=trace_data,
    )

    logger.info(
        "Chat complete: session=%s, grounded=%s, confidence=%.4f, sources=%d, attempts=%d",
        session_id,
        grounded,
        confidence,
        len(sources),
        attempts
    )

    # Step 5: Return the response
    return ChatResponse(
        session_id=session_id,
        answer=final_answer,
        sources=sources,
        grounded=grounded,
        confidence=confidence,
        attempts=attempts,
    )


@router.post(
    "/chat/stream",
    status_code=status.HTTP_200_OK,
    summary="Chat Stream",
    description=(
        "Send a question and receive a streaming response via Server-Sent Events (SSE). "
        "Streams tokens as they are generated, followed by a final JSON payload."
    ),
)
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """Process a chat request and stream the response tokens."""
    if request.session_id:
        session = await chat_history.get_session(db, request.session_id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {request.session_id} not found.",
            )
        session_id = session.id
        logger.info("Continuing session (stream): %s", session_id)
    else:
        title = request.question[:100]
        session = await chat_history.create_session(db, title=title)
        session_id = session.id
        logger.info("Created new session (stream): %s", session_id)

    # Save the user message immediately
    await chat_history.add_message(
        db=db,
        session_id=session_id,
        role="user",
        content=request.question,
    )
    
    # We must await db.commit() here before spinning up the background thread 
    # to ensure the session and user message are visible, although SQLAlchemy
    # doesn't strictly need it if the async loop continues to hold the session,
    # but it is safer since add_message only flushes.
    await db.commit()

    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def stream_callback(event: dict):
        # Fire-and-forget push to the queue from the synchronous thread
        loop.call_soon_threadsafe(
            q.put_nowait,
            event
        )

    def run_graph_in_thread():
        try:
            initial_state = get_initial_state(question=request.question, session_id=session_id)
            result = compiled_graph.invoke(
                initial_state,
                config={"configurable": {"stream_callback": stream_callback}}
            )
            loop.call_soon_threadsafe(q.put_nowait, {"type": "done", "result": result})
        except Exception as e:
            logger.error("Streaming generation failed: %s", str(e))
            loop.call_soon_threadsafe(q.put_nowait, {"type": "error", "error": str(e)})

    async def event_generator():
        # Start the graph execution in a background thread
        task = asyncio.create_task(asyncio.to_thread(run_graph_in_thread))
        
        try:
            while True:
                item = await q.get()
                
                if item["type"] == "token":
                    # Emit a token SSE
                    yield f"data: {json.dumps(item)}\n\n"
                    
                elif item["type"] == "error":
                    # Emit an error SSE and break
                    yield f"data: {json.dumps(item)}\n\n"
                    break
                    
                elif item["type"] == "done":
                    # The graph has finished execution.
                    result = item["result"]
                    final_answer = result.get("final_answer") or result.get("answer") or "Sorry, I could not generate an answer."
                    sources = result.get("sources", [])
                    grounded = result.get("grounded", False)
                    confidence = result.get("confidence", 0.0)
                    attempts = result.get("attempts", 1)
                    trace_entries = result.get("trace", [])
                    trace_data = [t.model_dump() if hasattr(t, "model_dump") else t for t in trace_entries] if trace_entries else None
                    
                    # Save the assistant message with trace
                    await chat_history.add_message(
                        db=db,
                        session_id=session_id,
                        role="assistant",
                        content=final_answer,
                        trace_data=trace_data,
                    )
                    
                    # Flush and commit the message to DB immediately
                    await db.commit()

                    logger.info(
                        "Chat stream complete: session=%s, grounded=%s, confidence=%.4f",
                        session_id,
                        grounded,
                        confidence
                    )

                    # Emit the final SSE
                    sources_dump = [s.model_dump() if hasattr(s, "model_dump") else s for s in sources]
                    final_event = {
                        "type": "done",
                        "session_id": session_id,
                        "grounded": grounded,
                        "confidence": confidence,
                        "attempts": attempts,
                        "sources": sources_dump,
                        "trace_available": bool(trace_data)
                    }
                    yield f"data: {json.dumps(final_event)}\n\n"
                    break
                
                elif item["type"] == "clear":
                    # Instruct the frontend to clear the current generation buffer
                    yield f"data: {json.dumps(item)}\n\n"
                    
        except asyncio.CancelledError:
            # Client disconnected
            logger.info("Client disconnected from chat stream")
            task.cancel()
            raise
        finally:
            # Explicitly close the db session to prevent SAWarning during TestClient teardown
            await db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

