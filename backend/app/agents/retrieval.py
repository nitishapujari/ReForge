"""
ReForge — Retrieval Agent Node.

LangGraph node that queries the vector store for semantically
similar documents. Uses the rewritten question if available,
otherwise falls back to the original question.

Populates state with: retrieved_docs, retrieved_metadatas,
similarity_scores, and a trace entry.
"""

import time
import re

from app.graph.state import GraphState, TraceEntry
from app.services import retriever, llm
from app.services.vectorstore import get_collection
from app.prompts import NO_DOCUMENTS_RESPONSE, CONDENSE_SYSTEM_PROMPT, CONDENSE_USER_PROMPT
from app.utils.logger import get_logger

logger = get_logger(__name__)


def is_ambiguous(question: str) -> bool:
    """Check if a question needs contextual condensation."""
    q_lower = question.lower().strip()
    words = q_lower.split()
    
    # 1. Check for pronouns that imply prior context
    pronouns = {"it", "its", "this", "that", "these", "those", "they", "them", "he", "she", "his", "her", "theirs"}
    for word in words:
        clean_word = re.sub(r'[^\w\s]', '', word)
        if clean_word in pronouns:
            return True
            
    # 2. Check for explicit follow-up phrases
    follow_up_phrases = [
        "what about",
        "how about",
        "and ",
        "also ",
        "tell me more",
        "can you explain more",
        "why is that"
    ]
    for phrase in follow_up_phrases:
        if q_lower.startswith(phrase):
            return True
            
    # 3. Very short query without a clear subject (e.g., "why?", "how?")
    if len(words) <= 2:
        return True
        
    return False


def retrieve_node(state: GraphState) -> dict:
    """
    Retrieval node — fetches relevant documents from the vector store.

    Uses rewritten_question if available (from a rewrite loop),
    otherwise uses the original question.

    Args:
        state: Current graph state.

    Returns:
        Dict of state updates: retrieved_docs, retrieved_metadatas,
        similarity_scores, attempts (incremented), and trace entry.
    """
    start_time = time.perf_counter()

    # Determine query: rewritten (loop) -> retrieval_query (condensed) -> original
    query = state.get("rewritten_question")
    retrieval_query = state.get("retrieval_query")
    
    if not query:
        if retrieval_query:
            query = retrieval_query
        else:
            chat_history = state.get("chat_history", [])
            original_question = state["question"]
            
            if chat_history and is_ambiguous(original_question):
                # Condense the question using history
                history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history])
                user_prompt = CONDENSE_USER_PROMPT.format(history=history_str, question=original_question)
                
                condensed = llm.invoke(
                    prompt=user_prompt,
                    system_instruction=CONDENSE_SYSTEM_PROMPT,
                ).strip()
                
                query = condensed
                retrieval_query = condensed
                logger.info("Retrieval: using contextualized query ('%s')", query)
            else:
                query = original_question
                retrieval_query = query
                logger.info("Retrieval: using original question ('%s')", query)

    top_k = state.get("top_k", 5)
    attempt = state.get("attempts", 0) + 1

    logger.info(
        "Retrieval node: query='%s', top_k=%d, attempt=%d",
        query[:80],
        top_k,
        attempt,
    )

    # Check if collection has documents
    collection = get_collection()
    if collection.count() == 0:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info("No documents in collection — skipping retrieval")

        trace_entry = TraceEntry(
            node="retrieve",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"query='{query[:60]}'",
            output_summary="no documents in collection",
            attempt=attempt,
            decision=None,
        )

        return {
            "retrieval_query": retrieval_query,
            "retrieved_docs": [],
            "retrieved_metadatas": [],
            "similarity_scores": [],
            "attempts": attempt,
            "trace": state.get("trace", []) + [trace_entry],
        }

    # Perform retrieval
    results = retriever.retrieve(query=query, top_k=top_k)

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    docs = results["documents"]
    metas = results["metadatas"]
    scores = results["similarity_scores"]

    best_score = scores[0] if scores else 0.0
    worst_score = scores[-1] if scores else 0.0

    logger.info(
        "Retrieval complete: results=%d, best=%.4f, worst=%.4f, time=%.1fms",
        len(docs),
        best_score,
        worst_score,
        elapsed_ms,
    )

    trace_entry = TraceEntry(
        node="retrieve",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"query='{query[:60]}', top_k={top_k}",
        output_summary=f"found {len(docs)} docs, best_score={best_score:.4f}",
        attempt=attempt,
        decision=None,
    )

    return {
        "retrieval_query": retrieval_query,
        "retrieved_docs": docs,
        "retrieved_metadatas": metas,
        "similarity_scores": scores,
        "attempts": attempt,
        "trace": state.get("trace", []) + [trace_entry],
    }
