"""
ReForge — Chat API Routes.

POST /chat — Accept a user question, run retrieval + generation,
save to chat history, and return the grounded answer with sources.
GET /chat/{session_id}/suggestions — Provide follow-up suggestions for a session.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import json

from app.api.deps import SessionDep, CurrentUser
from app.graph import compile_graph, get_initial_state
from app.models.database import get_db_session
from app.models.schemas import ChatRequest, ChatResponse, TraceEntrySchema
from app.prompts import (
    NO_RELEVANT_DOCS_RESPONSE, 
    NO_DOCUMENTS_RESPONSE, 
    CONVERSATION_SYSTEM_PROMPT, 
    NO_RELEVANT_DOCS_AND_NO_KNOWLEDGE_RESPONSE,
    DOCUMENT_CONSTRAINT_FAILURE_RESPONSE
)
from app.services import chat_history
from app.services.llm import invoke, invoke_stream
from app.services.conversation_router import router as conversation_router, Intent
from app.services.provider_errors import get_user_facing_error
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
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    """Process a chat request through the RAG pipeline."""
    session_id_val = request.session_id.strip() if request.session_id else None
    if session_id_val and session_id_val.lower() not in ("null", "undefined", "none", ""):
        session = await chat_history.get_session(db, session_id_val, current_user.id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"success": False, "error": {"code": "NOT_FOUND", "message": f"Session {request.session_id} not found."}}
            )
        session_id = session.id
        logger.info("Continuing session: %s", session_id)
    else:
        # Create a new session with the question as the title
        title = request.question[:100]
        session = await chat_history.create_session(db, user_id=current_user.id, title=title)
        session_id = session.id
        logger.info("Created new session: %s", session_id)

    # 1. Persist the current question immediately (Original Order)
    new_msg = await chat_history.add_message(
        db=db,
        session_id=session_id,
        role="user",
        content=request.question,
    )

    # 2. Fetch the last 10 messages, explicitly excluding the one we just inserted
    chat_history_data = await chat_history.get_recent_messages(
        db, 
        session_id, 
        limit=10, 
        exclude_message_id=new_msg.id
    )
    intent = await conversation_router.classify(request.question, chat_history_data, request.document_ids)
    if intent != Intent.KNOWLEDGE_QUERY:
        logger.info("Conversational intent %s detected, bypassing graph", intent.name)
        
        history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history_data])
        prompt = f"## Conversation History\n{history_str}\n\n## User Message\n{request.question}"
        
        try:
            response_text = await asyncio.to_thread(
                invoke,
                prompt=prompt,
                system_instruction=CONVERSATION_SYSTEM_PROMPT
            )
        except Exception as e:
            logger.error("Conversational LLM failed: %s", str(e))
            response_text = "I'm having a little trouble connecting right now, but hello!"
            
        await chat_history.add_message(
            db=db,
            session_id=session_id,
            role="assistant",
            content=response_text,
            trace_data=[],
            metadata={
                "sources": [],
                "response_type": "CONVERSATION",
                "verification_status": "NONE",
                "grounded": None,
                "confidence": None,
            }
        )
        await db.commit()
        
        return ChatResponse(
            session_id=session_id,
            answer=response_text,
            sources=[],
            response_type="CONVERSATION",
            grounded=None,
            confidence=None,
            attempts=0
        )

    try:
        initial_state = get_initial_state(
            question=request.question,
            session_id=session_id,
            user_id=current_user.id,
            chat_history=chat_history_data,
            document_ids=request.document_ids,
        )
        # Execute the graph synchronously in a background thread
        result = await asyncio.to_thread(compiled_graph.invoke, initial_state)
        
        final_answer = result.get("final_answer") or result.get("answer") or "Sorry, I could not generate an answer."
        sources = result.get("sources", [])
        grounded = result.get("grounded", False)
        confidence = result.get("confidence", 0.0)
        attempts = result.get("attempts", 1)
        verification_status = result.get("verification_status", "VERIFIED")
        
        response_type = "GROUNDED"
        if final_answer == DOCUMENT_CONSTRAINT_FAILURE_RESPONSE or final_answer == NO_DOCUMENTS_RESPONSE:
            response_type = "NO_CONTEXT"
            sources = [] # Don't show irrelevant sources
            grounded = False
            confidence = 0.0        
        elif final_answer.startswith(NO_RELEVANT_DOCS_RESPONSE) or final_answer.startswith(NO_RELEVANT_DOCS_AND_NO_KNOWLEDGE_RESPONSE):
            response_type = "GENERAL_KNOWLEDGE"
            sources = []
            grounded = False
            confidence = 0.0
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
        clean_error = get_user_facing_error(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=clean_error,
        )

    await chat_history.add_message(
        db=db,
        session_id=session_id,
        role="assistant",
        content=final_answer,
        trace_data=trace_data,
        metadata={
            "sources": [s.model_dump() if hasattr(s, "model_dump") else s for s in sources],
            "response_type": response_type,
            "verification_status": verification_status,
            "grounded": grounded,
            "confidence": confidence,
            "attempts": attempts,
        }
    )

    logger.info(
        "Chat complete: session=%s, grounded=%s, confidence=%.4f, sources=%d, attempts=%d",
        session_id,
        grounded,
        confidence,
        len(sources),
        attempts
    )

    return ChatResponse(
        session_id=session_id,
        answer=final_answer,
        sources=sources,
        response_type=response_type,
        verification_status=verification_status,
        grounded=grounded,
        confidence=confidence,
        attempts=attempts,
        trace_data=trace_data,
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
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session),
):
    """Process a chat request and stream the response tokens."""
    session_id_val = request.session_id.strip() if request.session_id else None
    if session_id_val and session_id_val.lower() not in ("null", "undefined", "none", ""):
        session = await chat_history.get_session(db, session_id_val, current_user.id)
        if session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"success": False, "error": {"code": "NOT_FOUND", "message": f"Session {request.session_id} not found."}}
            )
        session_id = session.id
        logger.info("Continuing session (stream): %s", session_id)
    else:
        title = request.question[:100]
        session = await chat_history.create_session(db, user_id=current_user.id, title=title)
        session_id = session.id
        logger.info("Created new session (stream): %s", session_id)

    # Save the user message immediately, unless regenerating
    exclude_id = None
    if request.regenerate_message_id:
        await chat_history.delete_message(db, request.regenerate_message_id)
    else:
        new_msg = await chat_history.add_message(
            db=db,
            session_id=session_id,
            role="user",
            content=request.question,
        )
        exclude_id = new_msg.id
    
    await db.commit()

    chat_history_data = await chat_history.get_recent_messages(db, session_id, limit=10, exclude_message_id=exclude_id)
    if request.regenerate_message_id and chat_history_data and chat_history_data[-1].get("role") == "user" and chat_history_data[-1].get("content") == request.question:
        chat_history_data.pop()
    intent = await conversation_router.classify(request.question, chat_history_data, request.document_ids)

    async def event_generator():
        if intent != Intent.KNOWLEDGE_QUERY:
            logger.info("Conversational intent (stream) %s detected, bypassing graph", intent.name)
            
            loop = asyncio.get_running_loop()
            q = asyncio.Queue()
            
            def run_chat_in_thread(history_data: list[dict]):
                try:
                    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in history_data])
                    prompt = f"## Conversation History\n{history_str}\n\n## User Message\n{request.question}"
                    
                    response_text = ""
                    
                    def handle_retry():
                        nonlocal response_text
                        response_text = ""
                        loop.call_soon_threadsafe(q.put_nowait, {"type": "clear"})
                        
                    for chunk in invoke_stream(
                        prompt=prompt, 
                        system_instruction=CONVERSATION_SYSTEM_PROMPT,
                        on_retry=handle_retry
                    ):
                        response_text += chunk
                        loop.call_soon_threadsafe(q.put_nowait, {"type": "token", "content": chunk})
                    
                    loop.call_soon_threadsafe(q.put_nowait, {"type": "done", "result": response_text})
                except Exception as e:
                    logger.error("LLM stream failed: %s", str(e))
                    clean_error = get_user_facing_error(e)
                    loop.call_soon_threadsafe(q.put_nowait, {"type": "error", "error": clean_error})
                    
            task = asyncio.create_task(asyncio.to_thread(run_chat_in_thread, chat_history_data))
            
            response_text = ""
            try:
                while True:
                    item = await q.get()
                    if item["type"] == "token":
                        response_text += item["content"]
                        yield f"data: {json.dumps(item)}\n\n"
                    elif item["type"] == "error":
                        yield f"data: {json.dumps(item)}\n\n"
                        break
                    elif item["type"] == "done":
                        response_text = item.get("result", "")
                        break
            finally:
                await chat_history.add_message(
                    db=db,
                    session_id=session_id,
                    role="assistant",
                    content=response_text,
                    trace_data=[],
                    metadata={
                        "sources": [],
                        "response_type": "CONVERSATION",
                        "verification_status": "NONE",
                        "grounded": None,
                        "confidence": None,
                    }
                )
                await db.commit()
                
                final_event = {
                    "type": "done",
                    "session_id": session_id,
                    "response_type": "CONVERSATION",
                    "verification_status": "NONE",
                    "grounded": None,
                    "confidence": None,
                    "attempts": 0,
                    "sources": [],
                    "trace_available": False
                }
                yield f"data: {json.dumps(final_event)}\n\n"
                await db.close()
            return
            
        loop = asyncio.get_running_loop()
        q = asyncio.Queue()

        def stream_callback(event: dict):
            # Fire-and-forget push to the queue from the synchronous thread
            loop.call_soon_threadsafe(
                q.put_nowait,
                event
            )

        def run_graph_in_thread(chat_history_data: list[dict]):
            try:
                initial_state = get_initial_state(
                    question=request.question,
                    session_id=session_id,
                    user_id=current_user.id,
                    chat_history=chat_history_data,
                    document_ids=request.document_ids,
                )
                result = compiled_graph.invoke(
                    initial_state,
                    config={"configurable": {"stream_callback": stream_callback}}
                )
                loop.call_soon_threadsafe(q.put_nowait, {"type": "done", "result": result})
            except Exception as e:
                import traceback
                with open("error.log", "w") as f:
                    f.write(traceback.format_exc())
                logger.error("Streaming generation failed: %s", str(e))
                clean_error = get_user_facing_error(e)
                loop.call_soon_threadsafe(q.put_nowait, {"type": "error", "error": clean_error})
        # Use the already fetched chat history
        rag_history_data = chat_history_data
        # Start the graph execution in a background thread
        task = asyncio.create_task(asyncio.to_thread(run_graph_in_thread, rag_history_data))
        
        response_text = ""
        try:
            while True:
                item = await q.get()
                
                if item["type"] == "token":
                    # Emit a token SSE
                    response_text += item["content"]
                    yield f"data: {json.dumps(item)}\n\n"
                    
                elif item["type"] == "status":
                    # Emit a status SSE
                    yield f"data: {json.dumps(item)}\n\n"
                    
                elif item["type"] == "error":
                    # Emit an error SSE and break
                    yield f"data: {json.dumps(item)}\n\n"
                    
                    # Persist the partial text using V1 default metadata
                    await chat_history.add_message(
                        db=db,
                        session_id=session_id,
                        role="assistant",
                        content=response_text or "Sorry, I could not generate an answer.",
                        trace_data=None,
                        metadata={
                            "sources": [],
                            "response_type": "GROUNDED",
                            "verification_status": "VERIFIED",
                            "grounded": False,
                            "confidence": 0.0,
                            "attempts": 1,
                        }
                    )
                    await db.commit()
                    break
                    
                elif item["type"] == "done":
                    # The graph has finished execution.
                    result = item.get("result", {})
                    final_answer = result.get("final_answer") or result.get("answer") or "Sorry, I could not generate an answer."
                    sources = result.get("sources", [])
                    grounded = result.get("grounded", False)
                    confidence = result.get("confidence", 0.0)
                    attempts = result.get("attempts", 1)
                    verification_status = result.get("verification_status", "VERIFIED")
                    
                    response_type = "GROUNDED"
                    if final_answer == DOCUMENT_CONSTRAINT_FAILURE_RESPONSE or final_answer.startswith(NO_DOCUMENTS_RESPONSE):
                        response_type = "NO_CONTEXT"
                        sources = []
                        grounded = False
                        confidence = 0.0
                    elif NO_RELEVANT_DOCS_RESPONSE in final_answer or NO_RELEVANT_DOCS_AND_NO_KNOWLEDGE_RESPONSE in final_answer:
                        response_type = "GENERAL_KNOWLEDGE"
                        sources = []
                        grounded = False
                        confidence = 0.0                    
                    # Ensure final message is saved in DB
                    trace_data = result.get("trace")
                    
                    # Save the assistant message with trace
                    await chat_history.add_message(
                        db=db,
                        session_id=session_id,
                        role="assistant",
                        content=final_answer,
                        trace_data=trace_data,
                        metadata={
                            "sources": [s.model_dump() if hasattr(s, "model_dump") else s for s in sources],
                            "response_type": response_type,
                            "verification_status": verification_status,
                            "grounded": grounded,
                            "confidence": confidence,
                            "attempts": attempts,
                        }
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
                        "response_type": response_type,
                        "verification_status": verification_status,
                        "grounded": grounded,
                        "confidence": confidence,
                        "attempts": attempts,
                        "sources": sources_dump,
                        "trace_available": bool(trace_data),
                        "trace_data": trace_data,
                        "final_answer": final_answer
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

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "none"
        }
    )

@router.get("/initial_suggestions")
async def get_initial_suggestions(
    db: AsyncSession = Depends(get_db_session)
):
    """
    Generate 4 starter questions based on recently uploaded documents.
    """
    from sqlalchemy import select
    from app.models.document import Document
    from app.services import llm
    import json
    
    # Fallback/default generic questions
    default_suggestions = [
        "Summarize my notes",
        "Compare two documents",
        "Find important topics",
        "Explain difficult concepts"
    ]
    
    try:
        # Fetch up to 3 recently processed documents
        stmt = select(Document).where(Document.status == "completed").order_by(Document.created_at.desc()).limit(3)
        result = await db.execute(stmt)
        docs = result.scalars().all()
        
        if not docs:
            return {"suggestions": default_suggestions}
            
        filenames = [doc.filename for doc in docs]
        filenames_str = ", ".join(filenames)
        
        prompt = f"""The user has uploaded the following documents to their knowledge base:
{filenames_str}

Generate 4 short, distinct starter questions the user could ask you about these documents.
Make the questions sound natural. Do not directly quote the filenames if possible, instead ask about their likely topics (e.g. if the file is 'C++ Basics.pdf', ask 'What are the main concepts in C++?').
Return ONLY a JSON array of exactly 4 strings. Do not use markdown blocks.
"""
        
        try:
            response = llm.invoke(prompt).strip()
            if response.startswith("```json"):
                response = response[7:-3].strip()
            elif response.startswith("```"):
                response = response[3:-3].strip()
                
            suggestions = json.loads(response)
            if isinstance(suggestions, list) and len(suggestions) > 0:
                # Ensure we have exactly 4 by filling with defaults if short, or slicing if long
                final_suggestions = suggestions[:4]
                while len(final_suggestions) < 4:
                    final_suggestions.append(default_suggestions[len(final_suggestions)])
                return {"suggestions": final_suggestions}
        except Exception as e:
            logger.warning(f"Failed to generate dynamic suggestions (maybe quota limit): {e}")
            
        # Fallback to templated suggestions if LLM fails
        templates = [
            f"Can you summarize {filenames[0]}?",
            f"What are the key points in {filenames[0]}?",
            f"Explain the main concepts in {filenames[-1] if len(filenames) > 1 else filenames[0]}",
            "Can you find any specific dates or names in my files?"
        ]
        return {"suggestions": templates}
        
    except Exception as e:
        logger.error(f"Error fetching initial suggestions: {e}")
        return {"suggestions": default_suggestions}


@router.get("/{session_id}/suggestions")
async def get_chat_suggestions(
    session_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Generate 3 smart follow-up questions based on the chat history.
    """
    from app.services import llm
    
    chat_history_data = await chat_history.get_recent_messages(db, session_id, limit=4)
    if not chat_history_data or len(chat_history_data) == 0:
        return {"suggestions": []}
        
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history_data])
    
    prompt = f"""Based on the following conversation, suggest 3 short, relevant follow-up questions the user might ask next.
Return ONLY a JSON array of strings. Do not use markdown blocks.

Conversation:
{history_str}
"""
    try:
        response = llm.invoke(prompt).strip()
        if response.startswith("```json"):
            response = response[7:-3].strip()
        elif response.startswith("```"):
            response = response[3:-3].strip()
            
        import json
        suggestions = json.loads(response)
        if isinstance(suggestions, list):
            return {"suggestions": suggestions[:3]}
    except Exception as e:
        logger.error(f"Failed to generate suggestions: {e}")
        
    return {"suggestions": []}

