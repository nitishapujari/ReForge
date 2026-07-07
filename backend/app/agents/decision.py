"""
ReForge — Decision Agent Node (LangGraph).

Evaluates the Critic's feedback and current graph state to route the 
flow: accept the answer, escalate (retrieve more), rewrite query, or fail.
"""

import time

from app.constants import CONFIDENCE_THRESHOLD
from app.graph.state import GraphState, TraceEntry
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

    if attempts >= max_attempts:
        logger.warning("Max attempts reached (%d). Failing or accepting best effort.", max_attempts)
        # We can either fail or accept the best we have. Let's accept but maybe log a warning.
        # Wait, the prompt says fail gracefuly. Let's just output fail if not grounded, 
        # or accept if it's somewhat okay. Let's use 'fail' to trigger graceful degradation in router.
        # Actually, if attempts >= max_attempts, we should probably just return the best answer we got,
        # but the builder router handles "fail" by going to END.
        # We can just accept the best effort or fail.
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

    trace_entry = TraceEntry(
        node="decision",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=f"grounded={grounded}, conf={confidence:.2f}, attempts={attempts}",
        output_summary=f"decision={decision}",
        attempt=attempts,
        decision=decision,
    )

    updates = {
        "decision": decision,
        "trace": state.get("trace", []) + [trace_entry],
    }

    # If accepting or failing, set the final answer
    if decision in ["accept", "fail"]:
        updates["final_answer"] = answer

    return updates
