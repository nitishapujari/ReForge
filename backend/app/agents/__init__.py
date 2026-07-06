"""
ReForge — Generator Agent.

Orchestrates the basic RAG flow:
1. Retrieve relevant documents from the vector store
2. Build a context-enriched prompt
3. Generate a grounded answer via Gemini
4. Return the answer with source citations

This is the foundational agent. The self-healing loop (Phase 2)
will wrap this agent with critic evaluation and query rewriting.
"""

from app.constants import DEFAULT_TOP_K
from app.models.schemas import SourceDocument
from app.prompts import (
    GENERATOR_SYSTEM_PROMPT,
    GENERATOR_USER_PROMPT,
    NO_DOCUMENTS_RESPONSE,
    NO_RELEVANT_DOCS_RESPONSE,
)
from app.services import llm, retriever
from app.services.vectorstore import get_collection
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Minimum similarity score to consider a document relevant
RELEVANCE_THRESHOLD: float = 0.3


async def generate_answer(
    question: str,
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    """
    Generate a grounded answer for the given question.

    Retrieves relevant documents, builds context, calls the LLM,
    and returns the answer with source citations.

    Args:
        question: The user's question.
        top_k: Number of documents to retrieve.

    Returns:
        Dict with keys: answer, sources, grounded, confidence, attempts.
    """
    # Step 1: Check if any documents exist
    collection = get_collection()
    if collection.count() == 0:
        logger.info("No documents in collection — returning fallback")
        return {
            "answer": NO_DOCUMENTS_RESPONSE,
            "sources": [],
            "grounded": False,
            "confidence": 0.0,
            "attempts": 1,
        }

    # Step 2: Retrieve relevant documents
    results = retriever.retrieve(query=question, top_k=top_k)

    if not results["documents"]:
        logger.info("Retrieval returned no documents — returning fallback")
        return {
            "answer": NO_RELEVANT_DOCS_RESPONSE,
            "sources": [],
            "grounded": False,
            "confidence": 0.0,
            "attempts": 1,
        }

    # Step 3: Filter by relevance threshold
    relevant_docs = []
    relevant_metas = []
    relevant_scores = []

    for doc, meta, score in zip(
        results["documents"],
        results["metadatas"],
        results["similarity_scores"],
    ):
        if score >= RELEVANCE_THRESHOLD:
            relevant_docs.append(doc)
            relevant_metas.append(meta)
            relevant_scores.append(score)

    if not relevant_docs:
        logger.info(
            "No documents above relevance threshold (%.2f) — returning fallback",
            RELEVANCE_THRESHOLD,
        )
        return {
            "answer": NO_RELEVANT_DOCS_RESPONSE,
            "sources": [],
            "grounded": False,
            "confidence": 0.0,
            "attempts": 1,
        }

    # Step 4: Build context string from relevant documents
    context_parts = []
    for i, (doc, meta) in enumerate(zip(relevant_docs, relevant_metas), start=1):
        source_label = meta.get("filename", "unknown")
        page = meta.get("page_number", "?")
        context_parts.append(
            f"[Source {i}: {source_label}, Page {page}]\n{doc}"
        )
    context = "\n\n---\n\n".join(context_parts)

    # Step 5: Build the prompt
    user_prompt = GENERATOR_USER_PROMPT.format(
        context=context,
        question=question,
    )

    # Step 6: Call the LLM
    logger.info(
        "Generating answer: question='%s', context_docs=%d, best_score=%.4f",
        question[:80],
        len(relevant_docs),
        relevant_scores[0],
    )

    answer = await llm.invoke(
        prompt=user_prompt,
        system_instruction=GENERATOR_SYSTEM_PROMPT,
    )

    # Step 7: Build source citations
    sources = []
    for meta, score in zip(relevant_metas, relevant_scores):
        # Find the matching document text for the preview
        idx = relevant_metas.index(meta)
        doc_text = relevant_docs[idx]
        preview = doc_text[:200] + "..." if len(doc_text) > 200 else doc_text

        sources.append(
            SourceDocument(
                filename=meta.get("filename", "unknown"),
                page_number=meta.get("page_number"),
                chunk_number=meta.get("chunk_number"),
                content_preview=preview,
                similarity_score=score,
            )
        )

    # Step 8: Calculate basic confidence (average similarity)
    avg_score = sum(relevant_scores) / len(relevant_scores)

    logger.info(
        "Answer generated: sources=%d, avg_similarity=%.4f",
        len(sources),
        avg_score,
    )

    return {
        "answer": answer,
        "sources": sources,
        "grounded": True,
        "confidence": round(avg_score, 4),
        "attempts": 1,
    }
