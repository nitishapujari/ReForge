"""
ReForge — Generator Agent Node (LangGraph).

LangGraph node that reads retrieved documents from state,
builds a context-enriched prompt, calls Gemini, and writes
the generated answer and source citations back to state.

This replaces the standalone generate_answer() function from
Phase 1 with a state-aware node for the self-healing graph.
"""

import time

from app.graph.state import GraphState, TraceEntry
from app.models.schemas import SourceDocument
from app.prompts import (
    GENERATOR_SYSTEM_PROMPT,
    GENERATOR_USER_PROMPT,
    NO_DOCUMENTS_RESPONSE,
    NO_RELEVANT_DOCS_RESPONSE,
)
from app.services import llm
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Minimum similarity score to consider a document relevant
RELEVANCE_THRESHOLD: float = 0.3


def generate_node(state: GraphState) -> dict:
    """
    Generator node — builds context from retrieved docs and generates an answer.

    Reads from state:
        - question, retrieved_docs, retrieved_metadatas, similarity_scores

    Writes to state:
        - answer, sources, trace

    Args:
        state: Current graph state.

    Returns:
        Dict of state updates.
    """
    start_time = time.perf_counter()

    question = state.get("rewritten_question") or state["question"]
    docs = state.get("retrieved_docs", [])
    metas = state.get("retrieved_metadatas", [])
    scores = state.get("similarity_scores", [])
    attempt = state.get("attempts", 1)

    # Handle empty retrieval results
    if not docs:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info("No retrieved docs — returning fallback answer")

        trace_entry = TraceEntry(
            node="generate",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"question='{question[:60]}', docs=0",
            output_summary="fallback: no documents retrieved",
            attempt=attempt,
            decision=None,
        )

        return {
            "answer": NO_DOCUMENTS_RESPONSE,
            "sources": [],
            "trace": state.get("trace", []) + [trace_entry],
        }

    # Filter by relevance threshold
    relevant_docs = []
    relevant_metas = []
    relevant_scores = []

    for doc, meta, score in zip(docs, metas, scores):
        if score >= RELEVANCE_THRESHOLD:
            relevant_docs.append(doc)
            relevant_metas.append(meta)
            relevant_scores.append(score)

    if not relevant_docs:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "No docs above relevance threshold (%.2f) — fallback",
            RELEVANCE_THRESHOLD,
        )

        trace_entry = TraceEntry(
            node="generate",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"question='{question[:60]}', docs={len(docs)}",
            output_summary=f"fallback: no docs above threshold {RELEVANCE_THRESHOLD}",
            attempt=attempt,
            decision=None,
        )

        return {
            "answer": NO_RELEVANT_DOCS_RESPONSE,
            "sources": [],
            "trace": state.get("trace", []) + [trace_entry],
        }

    # Build context string
    context_parts = []
    for i, (doc, meta) in enumerate(zip(relevant_docs, relevant_metas), start=1):
        source_label = meta.get("filename", "unknown")
        page = meta.get("page_number", "?")
        context_parts.append(
            f"[Source {i}: {source_label}, Page {page}]\n{doc}"
        )
    context = "\n\n---\n\n".join(context_parts)

    # Build prompt and call LLM
    user_prompt = GENERATOR_USER_PROMPT.format(
        context=context,
        question=question,
    )

    logger.info(
        "Generating answer: question='%s', context_docs=%d, best_score=%.4f",
        question[:80],
        len(relevant_docs),
        relevant_scores[0],
    )

    answer = llm.invoke(
        prompt=user_prompt,
        system_instruction=GENERATOR_SYSTEM_PROMPT,
    )

    # Build source citations
    sources = []
    for doc, meta, score in zip(relevant_docs, relevant_metas, relevant_scores):
        preview = doc[:200] + "..." if len(doc) > 200 else doc
        sources.append(
            SourceDocument(
                filename=meta.get("filename", "unknown"),
                page_number=meta.get("page_number"),
                chunk_number=meta.get("chunk_number"),
                content_preview=preview,
                similarity_score=score,
            )
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "Answer generated: sources=%d, time=%.1fms",
        len(sources),
        elapsed_ms,
    )

    trace_entry = TraceEntry(
        node="generate",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"question='{question[:60]}', context_docs={len(relevant_docs)}",
        output_summary=f"answer_len={len(answer)}, sources={len(sources)}",
        attempt=attempt,
        decision=None,
    )

    return {
        "answer": answer,
        "sources": sources,
        "trace": state.get("trace", []) + [trace_entry],
    }
