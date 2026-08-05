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

    question: str
    session_id: str
    user_id: str
    chat_history: list[dict]
    document_ids: list[str] | None

    retrieval_query: str | None
    retrieval_intent: str | None
    rewritten_question: str | None
    retrieved_docs: list[str]
    retrieved_metadatas: list[dict]
    similarity_scores: list[float]
    top_k: int
    web_context: list[str] | None
    web_sources: list[dict] | None

    assembled_context: str | None
    answer: str | None

    grounded: bool | None
    confidence: float | None
    critic_feedback: str | None
    unsupported_claims: list[str]
    missing_information: list[str]
    verification_status: str

    attempts: int
    max_attempts: int
    decision: str | None  # "accept", "rewrite", "escalate", "fail"

    final_answer: str | None
    sources: list[SourceDocument]

    trace: list[TraceEntry]
