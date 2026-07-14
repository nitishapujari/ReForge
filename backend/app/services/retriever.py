"""
ReForge — Semantic Retrieval Service.

Queries the ChromaDB vector store for semantically similar documents
given a user query. Returns ranked results with similarity scores.
Supports configurable top_k for adaptive retrieval depth.
"""

from app.constants import DEFAULT_TOP_K
from app.services.vectorstore import get_collection
from app.utils.logger import get_logger

logger = get_logger(__name__)


def retrieve(
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> dict:
    """
    Perform semantic search against the vector store.

    Args:
        query: The search query string.
        top_k: Number of top results to return.

    Returns:
        Dict with keys:
            - documents: list of document text chunks
            - metadatas: list of metadata dicts per chunk
            - distances: list of distance scores (lower = more similar for cosine)
            - similarity_scores: list of similarity scores (higher = more similar)
    """
    collection = get_collection()

    # Check if collection has any documents
    if collection.count() == 0:
        logger.warning("Retrieval attempted on empty collection")
        return {
            "documents": [],
            "metadatas": [],
            "distances": [],
            "similarity_scores": [],
        }

    # Clamp top_k to available documents
    available = collection.count()
    effective_k = min(top_k, available)

    results = collection.query(
        query_texts=[query],
        n_results=effective_k,
        include=["documents", "metadatas", "distances"],
    )

    # ChromaDB returns nested lists (one per query); flatten for single query
    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Convert cosine distances to similarity scores
    # ChromaDB cosine distance: 0 = identical, 2 = opposite
    # Normalized Similarity = 1 - (distance / 2) → range [0, 1]
    similarity_scores = [
        round(1.0 - (d / 2.0), 4) for d in distances
    ]

    logger.info(
        "Retrieval complete: query='%s', top_k=%d, results=%d, "
        "best_score=%.4f, worst_score=%.4f",
        query[:80],
        top_k,
        len(documents),
        similarity_scores[0] if similarity_scores else 0.0,
        similarity_scores[-1] if similarity_scores else 0.0,
    )

    return {
        "documents": documents,
        "metadatas": metadatas,
        "distances": distances,
        "similarity_scores": similarity_scores,
    }
