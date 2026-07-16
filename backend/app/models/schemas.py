"""
ReForge — Pydantic Schemas.

Request/response schemas for API validation and serialization.
Separated from ORM models to maintain clean boundaries.
"""

from datetime import datetime

from pydantic import BaseModel, Field


# =============================================================================
# Health
# =============================================================================


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(..., examples=["healthy"])
    active_provider: str = Field(..., description="The currently active LLM provider (e.g., gemini, groq)", examples=["gemini"])
    llm: str = Field(..., description="The currently active LLM model", examples=["gemini-2.5-flash"])
    llm_status: str = Field(..., examples=["connected"])
    chromadb: str = Field(..., examples=["connected"])
    database: str = Field(..., examples=["connected"])


# =============================================================================
# Chat
# =============================================================================


class ChatRequest(BaseModel):
    """Incoming chat request from the user."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The user's question.",
        examples=["What is retrieval-augmented generation?"],
    )
    session_id: str | None = Field(
        default=None,
        description="Existing session ID. If omitted, a new session is created.",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )


class ChunkPreview(BaseModel):
    """A single matching chunk within a source document."""
    chunk_number: int | None = Field(default=None, examples=[5])
    page_number: int | None = Field(default=None, examples=[3])
    content_preview: str = Field(
        ...,
        description="Brief excerpt from the source chunk.",
        examples=["RAG combines retrieval with generation..."],
    )
    similarity_score: float = Field(..., examples=[0.89])


class SourceDocument(BaseModel):
    """A grouped source document cited in the answer."""
    filename: str = Field(..., examples=["research_paper.pdf"])
    document_score: float = Field(..., description="Aggregated relevance score of the document.", examples=[0.89])
    chunks: list[ChunkPreview] = Field(
        default_factory=list,
        description="List of retrieved chunks from this document.",
    )


class ChatResponse(BaseModel):
    """Chat response returned to the user."""

    session_id: str = Field(
        ..., examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    answer: str = Field(..., description="The generated answer.")
    sources: list[SourceDocument] = Field(
        default_factory=list,
        description="Source documents cited in the answer.",
    )
    response_type: str = Field(
        default="GROUNDED",
        description="The category of the response (e.g., GROUNDED, CONVERSATION)."
    )
    verification_status: str = Field(
        default="VERIFIED",
        description="Whether verification was performed (VERIFIED or UNAVAILABLE)."
    )
    grounded: bool | None = Field(
        ..., description="Whether the answer is grounded in retrieved docs."
    )
    confidence: float | None = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Critic confidence score.",
        examples=[0.92],
    )
    attempts: int = Field(
        ..., description="Number of retrieval-generation attempts.", examples=[1]
    )
    trace_data: list[dict] | None = Field(
        default=None, description="Detailed trace execution data."
    )


# =============================================================================
# Chat History
# =============================================================================


class MessageResponse(BaseModel):
    """A single chat message in history."""

    id: str
    role: str = Field(..., examples=["user"])
    content: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    """A chat session summary."""

    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    """A chat session with all its messages."""

    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# =============================================================================
# Documents
# =============================================================================


class DocumentUploadResponse(BaseModel):
    """Response after uploading a document."""

    document_id: str = Field(
        ..., examples=["550e8400-e29b-41d4-a716-446655440000"]
    )
    filename: str = Field(..., examples=["research_paper.pdf"])
    status: str = Field(..., examples=["processing"])
    message: str = Field(
        ..., examples=["Document uploaded and queued for processing."]
    )
    duplicate: bool = Field(default=False, description="True if a document conflict was detected.")
    existing_document_id: str | None = Field(default=None, description="The ID of the existing document if a conflict was detected.")


class DocumentResponse(BaseModel):
    """Summary of an ingested document."""

    document_id: str
    filename: str
    chunk_count: int
    created_at: str
    status: str


# =============================================================================
# Traces
# =============================================================================


class TraceEntrySchema(BaseModel):
    """Schema for a single step in the execution trace."""
    node: str
    execution_time_ms: float
    input_summary: str
    output_summary: str
    attempt: int
    decision: str | None = None
    retrieval_diagnostics: list[dict] | None = None


class MessageTraceSchema(BaseModel):
    """Schema for traces associated with a specific message."""
    message_id: str
    timestamp: datetime
    trace_data: list[TraceEntrySchema]


class TraceResponse(BaseModel):
    """Response containing all traces for a session."""
    session_id: str
    traces: list[MessageTraceSchema]

