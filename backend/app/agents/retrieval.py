"""
ReForge — Retrieval Agent Node.

LangGraph node that queries the vector store for semantically
similar documents. Uses the rewritten question if available,
otherwise falls back to the original question.

Populates state with: retrieved_docs, retrieved_metadatas,
similarity_scores, and a trace entry.
"""

import time

from app.graph.state import GraphState, TraceEntry
from app.services import retriever
from app.services.vectorstore import get_collection
from app.prompts import NO_DOCUMENTS_RESPONSE
from app.utils.logger import get_logger

logger = get_logger(__name__)


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

    # Use rewritten question if available, otherwise original
    query = state.get("rewritten_question") or state["question"]
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
        "retrieved_docs": docs,
        "retrieved_metadatas": metas,
        "similarity_scores": scores,
        "attempts": attempt,
        "trace": state.get("trace", []) + [trace_entry],
    }
