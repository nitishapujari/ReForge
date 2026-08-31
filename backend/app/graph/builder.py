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
Decision & Rewrite nodes: implemented (Task 2.5).
"""

from langgraph.graph import END, StateGraph

from app.agents.critic import critique_node
from app.agents.decision import decision_node
from app.agents.generator import generate_node
from app.agents.retrieval import retrieve_node
from app.agents.rewrite import rewrite_node
from app.agents.web_search import web_search_node
from app.constants import DEFAULT_TOP_K, MAX_RETRIES
from app.graph.state import GraphState
from app.utils.logger import get_logger

logger = get_logger(__name__)


# Decision Router


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
    elif decision == "web_search":
        logger.info("Decision: WEB_SEARCH — falling back to live internet search")
        return "web_search"
    else:
        logger.warning("Unknown decision '%s' — defaulting to END", decision)
        return END


# Graph Construction


def build_graph() -> StateGraph:
    """
    Build and compile the self-healing RAG graph.

    Returns:
        A compiled LangGraph StateGraph ready for invocation.
    """
    graph = StateGraph(GraphState)

    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_node("critique", critique_node)
    graph.add_node("decision", decision_node)
    graph.add_node("rewrite", rewrite_node)
    graph.add_node("web_search", web_search_node)

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
            "web_search": "web_search",
        },
    )

    # Rewrite loops back to retrieve
    graph.add_edge("rewrite", "retrieve")
    
    # Web search routes back to generate
    graph.add_edge("web_search", "generate")

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


def get_initial_state(question: str, session_id: str, user_id: str, active_document_ids: list[str], chat_history: list[dict] | None = None, document_ids: list[str] | None = None) -> GraphState:
    """
    Create the initial state for a graph invocation.

    Args:
        question: The user's question.
        session_id: The chat session UUID.
        user_id: The user's UUID.
        chat_history: The recent conversation history.
        document_ids: Optional list of document IDs to restrict retrieval to.

    Returns:
        A new GraphState dictionary.
    """
    return {
        "question": question,
        "session_id": session_id,
        "user_id": user_id,
        "chat_history": chat_history or [],
        "document_ids": document_ids,
        "active_document_ids": active_document_ids,
        "retrieval_query": None,
        "retrieval_intent": None,
        "rewritten_question": None,
        "retrieved_docs": [],
        "retrieved_metadatas": [],
        "similarity_scores": [],
        "top_k": DEFAULT_TOP_K,
        "answer": None,
        "grounded": None,
        "confidence": None,
        "critic_feedback": None,
        "unsupported_claims": [],
        "missing_information": [],
        "verification_status": "PENDING",
        "attempts": 0,
        "max_attempts": 3,
        "decision": None,
        "final_answer": None,
        "sources": [],
        "trace": [],
    }
