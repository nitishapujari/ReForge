"""
ReForge — LangGraph Graph Builder.

Constructs the self-healing RAG graph with the following flow:

    START → retrieve → generate → critique → decision
                                                │
                ┌───────────────────────────────┘
                │
          ┌─────┴──────┐
          │   accept    │──→ END
          │  escalate   │──→ retrieve (with expanded top_k)
          │  rewrite    │──→ rewrite → retrieve
          │   fail      │──→ END (graceful failure)
          └────────────┘

Nodes are implemented progressively across Tasks 2.2-2.5.
Retrieve node: implemented (Task 2.2).
Generate node: implemented (Task 2.3).
Critic node: implemented (Task 2.4).
"""

from langgraph.graph import END, StateGraph

from app.agents.critic import critique_node
from app.agents.generator import generate_node
from app.agents.retrieval import retrieve_node
from app.constants import DEFAULT_TOP_K, MAX_RETRIES
from app.graph.state import GraphState
from app.utils.logger import get_logger

logger = get_logger(__name__)


# =============================================================================
# Node Stubs (replaced with real implementations as tasks progress)
# =============================================================================


def decision_node(state: GraphState) -> dict:
    """
    Decision node — routes based on critic evaluation.

    Stub: always accepts.
    Will be implemented in Task 2.5.
    """
    logger.info("[STUB] decision_node called")
    return {
        "decision": "accept",
        "final_answer": state.get("answer", ""),
    }


def rewrite_node(state: GraphState) -> dict:
    """
    Rewrite node — rephrases the query for better retrieval.

    Stub: returns the original question unchanged.
    Will be implemented in Task 2.5.
    """
    logger.info("[STUB] rewrite_node called")
    return {
        "rewritten_question": state.get("question", ""),
    }


# =============================================================================
# Decision Router
# =============================================================================


def route_decision(state: GraphState) -> str:
    """
    Conditional edge router after the decision node.

    Routes to:
        - END if decision is "accept" or "fail"
        - "rewrite" if decision is "rewrite"
        - "retrieve" if decision is "escalate" (expanded top_k)
    """
    decision = state.get("decision", "accept")

    if decision == "accept":
        logger.info("Decision: ACCEPT — returning final answer")
        return END
    elif decision == "fail":
        logger.info("Decision: FAIL — max attempts exhausted")
        return END
    elif decision == "escalate":
        logger.info("Decision: ESCALATE — expanding retrieval depth")
        return "retrieve"
    elif decision == "rewrite":
        logger.info("Decision: REWRITE — rephrasing query")
        return "rewrite"
    else:
        logger.warning("Unknown decision '%s' — defaulting to END", decision)
        return END


# =============================================================================
# Graph Construction
# =============================================================================


def build_graph() -> StateGraph:
    """
    Build and compile the self-healing RAG graph.

    Returns:
        A compiled LangGraph StateGraph ready for invocation.
    """
    graph = StateGraph(GraphState)

    # --- Register nodes ---
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_node("critique", critique_node)
    graph.add_node("decision", decision_node)
    graph.add_node("rewrite", rewrite_node)

    # --- Define edges ---
    # Entry point
    graph.set_entry_point("retrieve")

    # Linear flow: retrieve → generate → critique → decision
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "critique")
    graph.add_edge("critique", "decision")

    # Conditional routing from decision
    graph.add_conditional_edges(
        "decision",
        route_decision,
        {
            END: END,
            "retrieve": "retrieve",
            "rewrite": "rewrite",
        },
    )

    # Rewrite loops back to retrieve
    graph.add_edge("rewrite", "retrieve")

    logger.info("Self-healing RAG graph built successfully")
    return graph


def compile_graph():
    """
    Build and compile the graph for execution.

    Returns:
        A compiled graph that can be invoked with .invoke(state).
    """
    graph = build_graph()
    compiled = graph.compile()
    logger.info("Self-healing RAG graph compiled successfully")
    return compiled


def get_initial_state(question: str, session_id: str) -> GraphState:
    """
    Create the initial state for a graph invocation.

    Args:
        question: The user's question.
        session_id: The chat session UUID.

    Returns:
        A fully initialized GraphState dict.
    """
    return GraphState(
        question=question,
        session_id=session_id,
        rewritten_question=None,
        retrieved_docs=[],
        retrieved_metadatas=[],
        similarity_scores=[],
        top_k=DEFAULT_TOP_K,
        answer=None,
        grounded=False,
        confidence=0.0,
        critic_feedback=None,
        unsupported_claims=[],
        missing_information=[],
        attempts=0,
        max_attempts=MAX_RETRIES,
        decision=None,
        final_answer=None,
        sources=[],
        trace=[],
    )
