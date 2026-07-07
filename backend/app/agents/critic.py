"""
ReForge — Critic Agent Node (LangGraph).

Evaluates the generated answer against the retrieved documents
to ensure groundedness and prevent hallucinations.
"""

import time
from pydantic import BaseModel, Field

from app.graph.state import GraphState, TraceEntry
from app.prompts import CRITIC_SYSTEM_PROMPT, CRITIC_USER_PROMPT
from app.services import llm
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CriticEvaluation(BaseModel):
    """Structured output expected from the Critic LLM."""
    grounded: bool = Field(description="True if the answer is fully supported by the context, False otherwise.")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0 indicating how well the context supports the answer.")
    feedback: str = Field(description="Explanation of the evaluation, including why the answer is or isn't grounded.")
    unsupported_claims: list[str] = Field(description="List of specific claims in the answer that are not supported by the context.")
    missing_information: list[str] = Field(description="List of information requested in the question but missing from the context.")


def critique_node(state: GraphState) -> dict:
    """
    Critic node — evaluates the answer quality and groundedness.

    Reads from state:
        - question, retrieved_docs, retrieved_metadatas, answer

    Writes to state:
        - grounded, confidence, critic_feedback, unsupported_claims, missing_information, trace

    Args:
        state: Current graph state.

    Returns:
        Dict of state updates.
    """
    start_time = time.perf_counter()

    question = state.get("rewritten_question") or state["question"]
    docs = state.get("retrieved_docs", [])
    metas = state.get("retrieved_metadatas", [])
    answer = state.get("answer", "")
    attempt = state.get("attempts", 1)

    # If no answer was generated (e.g., fallback), we don't need a deep critique
    if not answer or answer.startswith("I don't have any documents") or answer.startswith("I couldn't find any relevant"):
        logger.info("Skipping critique for fallback answer.")
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        trace_entry = TraceEntry(
            node="critique",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"answer_len={len(answer)} (fallback)",
            output_summary="skipped evaluation",
            attempt=attempt,
            decision=None,
        )
        return {
            "grounded": True,
            "confidence": 1.0,
            "critic_feedback": "Fallback answer; no critique needed.",
            "unsupported_claims": [],
            "missing_information": [],
            "trace": state.get("trace", []) + [trace_entry],
        }

    # Build context string
    context_parts = []
    for i, (doc, meta) in enumerate(zip(docs, metas), start=1):
        source_label = meta.get("filename", "unknown")
        page = meta.get("page_number", "?")
        context_parts.append(
            f"[Source {i}: {source_label}, Page {page}]\n{doc}"
        )
    context = "\n\n---\n\n".join(context_parts)

    user_prompt = CRITIC_USER_PROMPT.format(
        context=context,
        question=question,
        answer=answer,
    )

    logger.info("Critiquing answer for question='%s'", question[:80])

    try:
        evaluation = llm.invoke_structured(
            prompt=user_prompt,
            response_schema=CriticEvaluation,
            system_instruction=CRITIC_SYSTEM_PROMPT,
        )
        
        grounded = evaluation.grounded
        confidence = evaluation.confidence
        feedback = evaluation.feedback
        unsupported = evaluation.unsupported_claims
        missing = evaluation.missing_information
        
    except Exception as e:
        logger.error("Critique evaluation failed: %s", e)
        # Fallback conservatively
        grounded = False
        confidence = 0.0
        feedback = f"Error during critique: {e}"
        unsupported = []
        missing = []

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "Critique completed: grounded=%s, confidence=%.2f, time=%.1fms",
        grounded,
        confidence,
        elapsed_ms,
    )

    trace_entry = TraceEntry(
        node="critique",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"context_docs={len(docs)}, answer_len={len(answer)}",
        output_summary=f"grounded={grounded}, confidence={confidence:.2f}",
        attempt=attempt,
        decision=None,
    )

    return {
        "grounded": grounded,
        "confidence": confidence,
        "critic_feedback": feedback,
        "unsupported_claims": unsupported,
        "missing_information": missing,
        "trace": state.get("trace", []) + [trace_entry],
    }
