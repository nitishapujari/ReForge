"""
ReForge — Vector Store Service.

Manages ChromaDB persistent client, collection operations, and embeddings
using the all-MiniLM-L6-v2 sentence transformer model.
"""

import asyncio
import gc
import time
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

from app.constants import EMBEDDING_MODEL
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Module-level singleton
_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None
_embedding_fn: chromadb.EmbeddingFunction | None = None


class GeminiEmbeddingFunction(chromadb.EmbeddingFunction):
    """
    ChromaDB EmbeddingFunction implementation using the google-genai SDK.
    Offloads embedding generation to Google Gemini API (e.g., gemini-embedding-001),
    preventing local memory spikes and vCPU starvation on constrained cloud instances.
    """
    def __init__(self, api_key: str, model_name: str = "gemini-embedding-001") -> None:
        from google import genai
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def __call__(self, input: list[str]) -> list[list[float]]:
        try:
            # Try embedding the batch of strings in a single API call
            response = self.client.models.embed_content(
                model=self.model_name,
                contents=input,
            )
            if response.embeddings and len(response.embeddings) == len(input):
                return [e.values for e in response.embeddings if e.values is not None]
        except Exception as e:
            logger.debug("Batch embedding failed (%s), falling back to sequential embedding.", e)
            
        # Sequential fallback for individual chunks
        embeddings: list[list[float]] = []
        for text in input:
            res = self.client.models.embed_content(
                model=self.model_name,
                contents=text,
            )
            if res.embeddings and len(res.embeddings) > 0 and res.embeddings[0].values:
                embeddings.append(res.embeddings[0].values)
            else:
                raise RuntimeError("Received empty embedding from Gemini API.")
        return embeddings


def init_vectorstore(collection_name: str) -> None:
    """
    Initialize the ChromaDB HTTP client and collection.

    Args:
        collection_name: Name of the collection to use.
    """
    global _client, _collection, _embedding_fn

    from app.config import get_settings
    settings = get_settings()

    if settings.EMBEDDING_PROVIDER.lower() == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is required when EMBEDDING_PROVIDER=gemini")
        _embedding_fn = GeminiEmbeddingFunction(
            api_key=settings.GEMINI_API_KEY,
            model_name=settings.GEMINI_EMBEDDING_MODEL,
        )
        logger.info("ChromaDB embedding provider configured: GEMINI (model='%s')", settings.GEMINI_EMBEDDING_MODEL)
    else:
        _embedding_fn = DefaultEmbeddingFunction()
        try:
            # Warm up embedding model at startup so ONNX weights are loaded before handling uploads
            logger.info("Warming up ONNX embedding model...")
            _embedding_fn(["warmup"])
            logger.info("ONNX embedding model warmed up successfully.")
        except Exception as e:
            logger.warning("Failed to warm up embedding function at startup: %s", e)
        logger.info("ChromaDB embedding provider configured: ONNX (all-MiniLM-L6-v2)")

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
    batch_size: int = 64,
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
        if (i // batch_size) % 5 == 4 or (i + batch_size >= total):
            gc.collect()
        if total > batch_size:
            logger.info("Inserted batch %d-%d of %d chunks into ChromaDB", i + 1, min(i + batch_size, total), total)
    logger.info("Completed adding all %d chunks to vector store", total)


async def add_documents_async(
    ids: list[str],
    documents: list[str],
    metadatas: list[dict],
    batch_size: int = 64,
) -> None:
    """
    Add document chunks to the vector store asynchronously in batches.
    Yields CPU to the Uvicorn event loop and runs periodic garbage collection
    to prevent memory spikes while maintaining high insertion throughput.
    """
    collection = get_collection()
    total = len(ids)
    start_time = time.perf_counter()
    logger.info("[Embedding & ChromaDB] Starting async embedding generation and insertion for %d chunks (batch_size=%d)...", total, batch_size)

    inserted_count = 0
    try:
        for i in range(0, total, batch_size):
            batch_start = time.perf_counter()
            batch_ids = ids[i : i + batch_size]
            batch_docs = documents[i : i + batch_size]
            batch_metas = metadatas[i : i + batch_size]

            try:
                await asyncio.to_thread(
                    collection.add,
                    ids=batch_ids,
                    documents=batch_docs,
                    metadatas=batch_metas,
                )
            except Exception as e:
                logger.error("[Embedding & ChromaDB Error] Failed to generate embeddings or insert batch %d-%d: %s", i + 1, min(i + batch_size, total), e, exc_info=True)
                raise

            inserted_count += len(batch_ids)
            batch_time = time.perf_counter() - batch_start

            if (i // batch_size) % 5 == 4 or (i + batch_size >= total):
                gc.collect()
            if total > batch_size or inserted_count == total:
                logger.info("[ChromaDB Insertion] Inserted batch %d-%d of %d chunks in %.2fs | Total vectors inserted: %d", i + 1, min(i + batch_size, total), total, batch_time, inserted_count)
            await asyncio.sleep(0.01)

        total_time = time.perf_counter() - start_time
        logger.info("[Embedding & ChromaDB Success] Verified %d vectors inserted into ChromaDB in %.2f seconds (%.2f chunks/sec)", inserted_count, total_time, inserted_count / total_time if total_time > 0 else 0)
    except Exception as e:
        total_time = time.perf_counter() - start_time
        logger.error("[Embedding & ChromaDB Fatal] Ingestion failed after %.2fs with %d/%d chunks inserted: %s", total_time, inserted_count, total, e, exc_info=True)
        raise


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
