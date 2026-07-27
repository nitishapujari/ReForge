"""
ReForge — Vector Store Service.

Manages ChromaDB persistent client, collection operations, and embeddings
using the all-MiniLM-L6-v2 sentence transformer model.
"""

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

from app.constants import EMBEDDING_MODEL
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Module-level singleton
_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None
_embedding_fn: DefaultEmbeddingFunction | None = None


def init_vectorstore(collection_name: str) -> None:
    """
    Initialize the ChromaDB HTTP client and collection.

    Args:
        collection_name: Name of the collection to use.
    """
    global _client, _collection, _embedding_fn

    _embedding_fn = DefaultEmbeddingFunction()

    from app.config import get_settings
    settings = get_settings()

    if settings.CHROMA_MODE == "persistent":
        _client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=chromadb.config.Settings(anonymized_telemetry=False)
        )
    else:
        _client = chromadb.HttpClient(
            host=settings.CHROMA_HOST,
            port=settings.CHROMA_PORT,
            settings=chromadb.config.Settings(anonymized_telemetry=False)
        )

    _collection = _client.get_or_create_collection(
        name=collection_name,
        embedding_function=_embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )

    doc_count = _collection.count()
    logger.info(
        "ChromaDB initialized via %s: collection='%s', documents=%d",
        settings.CHROMA_MODE.upper(),
        collection_name,
        doc_count,
    )


def get_collection() -> chromadb.Collection:
    """
    Get the active ChromaDB collection.

    Returns:
        The ChromaDB collection instance.

    Raises:
        RuntimeError: If vectorstore has not been initialized.
    """
    if _collection is None:
        raise RuntimeError("Vector store not initialized. Call init_vectorstore() first.")
    return _collection


def get_embedding(text: str) -> list[float]:
    """
    Get the embedding vector for a given text.

    Args:
        text: The string to embed.

    Returns:
        A list of floats representing the embedding.
    """
    if _embedding_fn is None:
        raise RuntimeError("Vector store not initialized. Call init_vectorstore() first.")
    # The SentenceTransformerEmbeddingFunction expects a list of strings and returns a list of embeddings
    embeddings = _embedding_fn([text])
    return embeddings[0]


def add_documents(
    ids: list[str],
    documents: list[str],
    metadatas: list[dict],
    batch_size: int = 15,
) -> None:
    """
    Add document chunks to the vector store in batches to prevent memory spikes.

    Args:
        ids: Unique IDs for each chunk.
        documents: Text content of each chunk.
        metadatas: Metadata dict for each chunk (document_id, filename, etc.).
        batch_size: Number of chunks to embed and insert per batch.
    """
    collection = get_collection()
    total = len(ids)
    for i in range(0, total, batch_size):
        batch_ids = ids[i : i + batch_size]
        batch_docs = documents[i : i + batch_size]
        batch_metas = metadatas[i : i + batch_size]
        collection.add(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas,
        )
        if total > batch_size:
            logger.info("Inserted batch %d-%d of %d chunks into ChromaDB", i + 1, min(i + batch_size, total), total)
    logger.info("Completed adding all %d chunks to vector store", total)


def delete_by_document_id(document_id: str) -> int:
    """
    Delete all chunks belonging to a specific document.

    Args:
        document_id: The document UUID to delete.

    Returns:
        Number of chunks deleted.
    """
    collection = get_collection()

    # Find all chunks for this document
    results = collection.get(
        where={"document_id": document_id},
    )

    chunk_ids = results["ids"]
    if not chunk_ids:
        logger.warning("No chunks found for document_id=%s", document_id)
        return 0

    collection.delete(ids=chunk_ids)
    logger.info(
        "Deleted %d chunks for document_id=%s", len(chunk_ids), document_id
    )
    return len(chunk_ids)





def check_health() -> bool:
    """
    Check if the vector store is operational.

    Returns:
        True if healthy, False otherwise.
    """
    try:
        if _collection is None:
            return False
        _collection.count()
        return True
    except Exception:
        return False
