"""
ReForge — Decision Agent Node (LangGraph).

Evaluates the Critic's feedback and current graph state to route the 
flow: accept the answer, escalate (retrieve more), rewrite query, or fail.
"""

import time

from app.constants import CONFIDENCE_THRESHOLD
from app.graph.state import GraphState, TraceEntry
from langchain_core.runnables import RunnableConfig
from app.prompts import NO_RELEVANT_DOCS_RESPONSE, NO_DOCUMENTS_RESPONSE
from app.utils.logger import get_logger

logger = get_logger(__name__)


def decision_node(state: GraphState, config: RunnableConfig | None = None) -> dict:
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

    stream_callback = None
    if config and "configurable" in config:
        stream_callback = config["configurable"].get("stream_callback")

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
        has_web_context = "web_context" in state and state["web_context"] is not None
        if grounded and confidence >= 0.5:
            decision = "accept"
        elif not has_web_context:
            decision = "web_search"
        else:
            decision = "accept"
    else:
        # Check if we should fallback to web search because local docs are exhausted/empty
        docs = state.get("retrieved_docs", [])
        has_web_context = "web_context" in state and state["web_context"] is not None
        
        # If generator gave a fallback answer (skipping critique) and we haven't tried web search
        is_fallback_answer = (
            NO_DOCUMENTS_RESPONSE in answer or
            NO_RELEVANT_DOCS_RESPONSE in answer or
            "general knowledge fallback" in state.get("critic_feedback", "").lower()
        )
        
        # If there's missing information, we should rewrite the query to try and find it,
        # even if the current answer (e.g., "I don't know") is technically grounded.
        if (not docs or is_fallback_answer) and not has_web_context:
            logger.info("No local docs found or fallback generated, routing directly to web search.")
            decision = "web_search"
        elif missing_information:
            decision = "rewrite"
        elif not grounded or confidence < CONFIDENCE_THRESHOLD:
            if unsupported_claims:
                decision = "rewrite"
            else:
                # Not grounded but no missing/unsupported specifically called out? 
                # Escalate to fetch more documents (expand top_k).
                decision = "escalate"
        else:
            # Grounded, confident, and no missing info.
            decision = "accept"

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    conf_str = f"{confidence:.2f}" if confidence is not None else "None"

    logger.info(
        "Decision made: %s (attempts=%d/%d, grounded=%s, conf=%s)",
        decision,
        attempts,
        max_attempts,
        grounded,
        conf_str,
    )

    import json
    action_map = {
        "accept": "Deliver Response",
        "fail": "Fail Gracefully",
        "rewrite": "Rewrite Query",
        "escalate": "Retrieve More Sources"
    }
    
    output_summary = {
        "final_action": action_map.get(decision, "Unknown Action"),
        "decision": decision
    }
    
    if decision == "fail":
        output_summary["reason"] = "Maximum retries exhausted without producing a grounded answer."
    elif decision == "web_search":
        output_summary["final_action"] = "Web Search Fallback"
        output_summary["reason"] = "Maximum local retries exhausted without a grounded answer. Falling back to live web search."
    elif decision == "accept":
        if attempts >= max_attempts and missing_information:
             output_summary["reason"] = "Maximum retries exhausted. The draft was accepted as best-effort despite missing information."
        else:
             output_summary["reason"] = "The answer was successfully verified against the retrieved sources and delivered."
    elif decision == "rewrite":
        output_summary["reason"] = "The critic detected missing information. Retrying search with new keywords."
    elif decision == "escalate":
        output_summary["reason"] = "The critic detected missing information. Retrieving more documents."

    trace_entry = TraceEntry(
        node="decision",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=json.dumps({"grounded": grounded, "confidence": confidence, "attempts": attempts}),
        output_summary=json.dumps(output_summary),
        attempt=attempts,
        decision=decision,
    )

    updates = {
        "decision": decision,
        "trace": state.get("trace", []) + [trace_entry],
    }

    # If accepting or failing, set the final answer
    if decision == "fail":
        updates["final_answer"] = NO_RELEVANT_DOCS_RESPONSE
        updates["grounded"] = False
        updates["confidence"] = 0.0
        updates["sources"] = []
        if stream_callback:
            stream_callback({"type": "status", "message": "❌ Could not answer from documents. Falling back.", "status": "error"})
    elif decision == "rewrite":
        if stream_callback:
            stream_callback({"type": "status", "message": "⚠️ Hallucination detected. Rewriting query to try again...", "status": "warning"})
    elif decision == "escalate":
        if stream_callback:
            stream_callback({"type": "status", "message": "⚠️ Missing information. Retrieving more documents...", "status": "warning"})
    elif decision == "web_search":
        if stream_callback:
            stream_callback({"type": "status", "message": "⚠️ Missing information. Routing to web search...", "status": "warning"})
    elif decision == "accept":
        updates["final_answer"] = answer
        if stream_callback:
            stream_callback({"type": "status", "message": "✅ Grounded answer verified", "status": "success"})

    return updates
