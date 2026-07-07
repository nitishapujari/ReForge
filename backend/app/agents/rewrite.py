"""
ReForge — Rewrite Agent Node (LangGraph).

Rewrites the user's question to improve retrieval based on the
critic's feedback about missing or unsupported information.
"""

import time

from app.graph.state import GraphState, TraceEntry
from app.prompts import REWRITE_SYSTEM_PROMPT, REWRITE_USER_PROMPT
from app.services import llm
from app.utils.logger import get_logger

logger = get_logger(__name__)


def rewrite_node(state: GraphState) -> dict:
    """
    Rewrite node — rephrases the query for better retrieval.

    Reads from state:
        - question, rewritten_question, critic_feedback, attempts

    Writes to state:
        - rewritten_question, attempts, trace

    Args:
        state: Current graph state.

    Returns:
        Dict of state updates.
    """
    start_time = time.perf_counter()

    original_question = state.get("rewritten_question") or state["question"]
    feedback = state.get("critic_feedback", "No feedback provided.")
    attempt = state.get("attempts", 1)

    logger.info("Rewriting question (attempt %d). Original: '%s'", attempt, original_question)

    user_prompt = REWRITE_USER_PROMPT.format(
        question=original_question,
        feedback=feedback,
    )

    try:
        rewritten = llm.invoke(
            prompt=user_prompt,
            system_instruction=REWRITE_SYSTEM_PROMPT,
        )
        # Clean up any potential markdown or quotes
        rewritten = rewritten.strip().strip('"').strip("'")
    except Exception as e:
        logger.error("Failed to rewrite query: %s", e)
        # Fallback to original
        rewritten = original_question

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    logger.info("Question rewritten: '%s' (%.1fms)", rewritten, elapsed_ms)

    trace_entry = TraceEntry(
        node="rewrite",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"q='{original_question[:40]}', feedback_len={len(feedback)}",
        output_summary=f"new_q='{rewritten[:40]}'",
        attempt=attempt,
        decision=None,
    )

    return {
        "rewritten_question": rewritten,
        "trace": state.get("trace", []) + [trace_entry],
    }
