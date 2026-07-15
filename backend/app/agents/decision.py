"""
ReForge — Decision Agent Node (LangGraph).

Evaluates the Critic's feedback and current graph state to route the 
flow: accept the answer, escalate (retrieve more), rewrite query, or fail.
"""

import time

from app.constants import CONFIDENCE_THRESHOLD
from app.graph.state import GraphState, TraceEntry
from app.prompts import NO_RELEVANT_DOCS_RESPONSE
from app.utils.logger import get_logger

logger = get_logger(__name__)


def decision_node(state: GraphState) -> dict:
    """
    Decision node — routes based on critic evaluation and attempt count.

    Reads from state:
        - grounded, confidence, missing_information, attempts, max_attempts

    Writes to state:
        - decision, final_answer, trace

    Args:
        state: Current graph state.

    Returns:
        Dict of state updates.
    """
    start_time = time.perf_counter()

    grounded = state.get("grounded", False)
    confidence = state.get("confidence", 0.0)
    missing_information = state.get("missing_information", [])
    unsupported_claims = state.get("unsupported_claims", [])
    
    attempts = state.get("attempts", 1)
    max_attempts = state.get("max_attempts", 3)
    answer = state.get("answer", "")

    decision = "accept"

    if grounded is None or confidence is None:
        logger.warning("Verification unavailable (grounded=None). Accepting best effort answer immediately.")
        decision = "accept"
    elif attempts >= max_attempts:
        logger.warning("Max attempts reached (%d). Failing or accepting best effort.", max_attempts)
        if grounded and confidence >= 0.5:
            decision = "accept"
        else:
            decision = "fail"
    else:
        if not grounded or confidence < CONFIDENCE_THRESHOLD:
            # If it's ungrounded, maybe it needs a rewrite or more docs.
            # If there's missing information, definitely rewrite.
            if missing_information:
                decision = "rewrite"
            elif unsupported_claims:
                decision = "rewrite"
            else:
                # Not grounded but no missing/unsupported specifically called out? 
                # Escalate to fetch more documents (expand top_k).
                decision = "escalate"
        else:
            # Grounded and confident.
            decision = "accept"

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "Decision made: %s (attempts=%d/%d, grounded=%s, conf=%.2f)",
        decision,
        attempts,
        max_attempts,
        grounded,
        confidence,
    )

    output_summary = f"decision={decision}"
    if decision == "fail":
        output_summary += " | Failure Reason: Maximum retries exhausted without producing a grounded answer."

    trace_entry = TraceEntry(
        node="decision",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"grounded={grounded}, conf={confidence:.2f}, attempts={attempts}",
        output_summary=output_summary,
        attempt=attempts,
        decision=decision,
    )

    updates = {
        "decision": decision,
        "trace": state.get("trace", []) + [trace_entry],
    }

    # If accepting or failing, set the final answer
    if decision == "accept":
        updates["final_answer"] = answer
    elif decision == "fail":
        updates["final_answer"] = NO_RELEVANT_DOCS_RESPONSE
        updates["grounded"] = False
        updates["confidence"] = 0.0
        updates["sources"] = []

    return updates
