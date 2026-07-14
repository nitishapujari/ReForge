"""
ReForge — LangGraph State Definition.

TypedDict defining the state that flows through the self-healing
RAG graph. Each node reads from and writes to this shared state.
"""

from typing import TypedDict

from app.models.schemas import SourceDocument


class TraceEntry(TypedDict):
    """A single step in the execution trace."""

    node: str
    execution_time_ms: float
    input_summary: str
    output_summary: str
    attempt: int
    decision: str | None
    retrieval_diagnostics: list[dict] | None


class GraphState(TypedDict):
    """
    State flowing through the ReForge self-healing RAG graph.

    Fields are grouped by the node that primarily writes them.
    """

    # --- Input (set once at graph entry) ---
    question: str
    session_id: str
    chat_history: list[dict]

    # --- Retrieval node ---
    retrieval_query: str | None
    rewritten_question: str | None
    retrieved_docs: list[str]
    retrieved_metadatas: list[dict]
    similarity_scores: list[float]
    top_k: int

    # --- Generator node ---
    answer: str | None

    # --- Critic node ---
    grounded: bool
    confidence: float
    critic_feedback: str | None
    unsupported_claims: list[str]
    missing_information: list[str]

    # --- Decision / Loop control ---
    attempts: int
    max_attempts: int
    decision: str | None  # "accept", "rewrite", "escalate", "fail"

    # --- Final output ---
    final_answer: str | None
    sources: list[SourceDocument]

    # --- Observability ---
    trace: list[TraceEntry]
