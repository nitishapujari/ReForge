"""
ReForge — Semantic Retrieval Service.

Queries the ChromaDB vector store for semantically similar documents
given a user query. Returns ranked results with similarity scores.
Supports configurable top_k for adaptive retrieval depth.
"""

from app.constants import DEFAULT_TOP_K, RELEVANCE_THRESHOLD
from sqlalchemy import select
from app.models.database import get_session_factory
from app.models.document import Document
import asyncio

from app.services.vectorstore import get_collection
from app.utils.logger import get_logger

logger = get_logger(__name__)



def retrieve(
    query: str,
    user_id: str,
    active_document_ids: list[str],
    top_k: int = DEFAULT_TOP_K,
    score_threshold: float = RELEVANCE_THRESHOLD,
) -> dict:
    """
    Perform semantic search against the vector store.

    Args:
        query: The search query string.
        user_id: The UUID of the user to filter documents by.
        top_k: Number of top results to return.
        score_threshold: Minimum similarity score (0.0 to 1.0) to include a result.
        document_ids: Optional list of document IDs to restrict retrieval to.

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

    # Resolve active documents from SQLite securely
    active_ids = active_document_ids
    if not active_ids:
        logger.info("Retrieval aborted: No active documents found for user")
        return {
            "documents": [],
            "metadatas": [],
            "distances": [],
            "similarity_scores": [],
        }

    # Clamp top_k to available documents
    available = collection.count()
    effective_k = min(top_k, available)

    if len(active_ids) == 1:
        where_filter = {
            "$and": [
                {"user_id": user_id},
                {"document_id": active_ids[0]}
            ]
        }
    else:
        where_filter = {
            "$and": [
                {"user_id": user_id},
                {"document_id": {"$in": active_ids}}
            ]
        }

    results = collection.query(
        query_texts=[query],
        n_results=effective_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    # ChromaDB returns nested lists (one per query); flatten for single query
    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Convert cosine distances to similarity scores
    # ChromaDB cosine distance: 0 = identical, 2 = opposite
    # Normalized Similarity = 1 - (distance / 2) → range [0, 1]
    raw_similarity_scores = [
        float(round(1.0 - (d / 2.0), 4)) for d in distances
    ]

    # Filter by score_threshold
    filtered_documents = []
    filtered_metadatas = []
    filtered_distances = []
    similarity_scores = []

    for doc, meta, dist, score in zip(documents, metadatas, distances, raw_similarity_scores):
        if score >= score_threshold:
            filtered_documents.append(doc)
            filtered_metadatas.append(meta)
            filtered_distances.append(dist)
            similarity_scores.append(score)

    logger.info(
        "Retrieval complete: query='%s', top_k=%d, results=%d (filtered from %d), "
        "best_score=%.4f, worst_score=%.4f",
        query[:80],
        top_k,
        len(filtered_documents),
        len(documents),
        similarity_scores[0] if similarity_scores else 0.0,
        similarity_scores[-1] if similarity_scores else 0.0,
    )

    return {
        "documents": filtered_documents,
        "metadatas": filtered_metadatas,
        "distances": filtered_distances,
        "similarity_scores": similarity_scores,
    }

def retrieve_all(
    user_id: str,
    active_document_ids: list[str],
) -> dict:
    """
    Retrieve all chunks for the specified document(s), preserving chunk order.
    Bypasses semantic search completely.
    """
    collection = get_collection()
    
    if not active_document_ids:
        return {
            "documents": [],
            "metadatas": [],
            "distances": [],
            "similarity_scores": [],
        }
        
    active_ids = active_document_ids
    if not active_ids:
        logger.info("RetrieveAll aborted: No active documents found for user")
        return {
            "documents": [],
            "metadatas": [],
            "distances": [],
            "similarity_scores": [],
        }
        
    if len(active_ids) == 1:
        where_filter = {
            "$and": [
                {"user_id": user_id},
                {"document_id": active_ids[0]}
            ]
        }
    else:
        where_filter = {
            "$and": [
                {"user_id": user_id},
                {"document_id": {"$in": active_ids}}
            ]
        }
    
    # Use get() instead of query() to bypass semantic search and retrieve all matching records
    results = collection.get(
        where=where_filter,
        include=["documents", "metadatas"]
    )
    
    documents = results.get("documents", [])
    metadatas = results.get("metadatas", [])
    
    # Sort the chunks by chunk_number to preserve the original document chronological order
    combined = list(zip(documents, metadatas))
    combined.sort(key=lambda x: x[1].get("chunk_number", 0))
    
    sorted_documents = [x[0] for x in combined]
    sorted_metadatas = [x[1] for x in combined]
    
    logger.info(
        "RetrieveAll complete: retrieved %d chunks for active_document_ids=%s",
        len(sorted_documents),
        active_document_ids
    )
    
    return {
        "documents": sorted_documents,
        "metadatas": sorted_metadatas,
        "distances": [0.0] * len(sorted_documents),
        "similarity_scores": [1.0] * len(sorted_documents), # Bypass relevance thresholds downstream
    }

