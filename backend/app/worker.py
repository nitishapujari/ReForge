import asyncio
import os
import uuid
from datetime import datetime, timezone

from huey import RedisHuey

from app.models.database import get_session_factory
from app.models.document import Document
from app.services import document_processor, vectorstore
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Load config early so we can initialize Huey before @huey.on_startup
from app.config import get_settings
settings = get_settings()

# Configure Huey with Redis backend
huey = RedisHuey(url=settings.REDIS_URL)

def async_to_sync(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@huey.on_startup()
def worker_startup():
    from app.config import get_settings
    from app.models.database import init_db
    from app.services.vectorstore import init_vectorstore
    
    settings = get_settings()
    logger.info("Initializing database and vector store for Huey worker...")
    
    # Initialize database
    async_to_sync(init_db(settings.DATABASE_URL))
    
    # Initialize ChromaDB vector store
    init_vectorstore(
        collection_name=settings.CHROMA_COLLECTION_NAME,
    )
    
    logger.info("Huey worker dependencies initialized successfully.")

@huey.task()
def process_and_ingest_document_task(
    document_id: str,
    user_id: str,
    filename: str,
    file_path: str,
    file_hash: str | None,
):
    """
    Background task: process document (chunking) and add to vector store.
    """
    factory = get_session_factory()
    try:
        # Read the file content from the temporary path
        with open(file_path, "rb") as f:
            file_content = f.read()

        # Process document
        _, chunk_ids, chunk_texts, chunk_metadatas = document_processor.process_document(
            document_id=document_id,
            user_id=user_id,
            filename=filename,
            file_content=file_content,
            file_hash=file_hash,
        )
        
        # Add to vector store
        vectorstore.add_documents(
            ids=chunk_ids,
            documents=chunk_texts,
            metadatas=chunk_metadatas,
        )
        
        logger.info(
            "Background ingestion complete: document_id=%s, chunks=%d",
            document_id,
            len(chunk_ids),
        )
        
        # Update SQLite status
        async def _update():
            async with factory() as session:
                doc = await session.get(Document, document_id)
                if doc:
                    doc.status = "completed"
                    doc.chunk_count = len(chunk_ids)
                    await session.commit()
        async_to_sync(_update())
                
    except Exception as e:
        logger.error(
            "Background ingestion failed for document_id=%s: %s",
            document_id,
            str(e),
        )
        async def _fail():
            async with factory() as session:
                doc = await session.get(Document, document_id)
                if doc:
                    doc.status = "failed"
                    doc.error_message = str(e)
                    await session.commit()
        async_to_sync(_fail())
    finally:
        # Cleanup temporary file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Could not remove temporary file {file_path}: {e}")

@huey.task()
def replace_document_task(
    document_id: str,
    user_id: str,
    filename: str,
    file_path: str,
    file_hash: str | None,
):
    """
    Background task: replace an existing document's vectors and update SQLite.
    """
    factory = get_session_factory()
    try:
        # Read the file content from the temporary path
        with open(file_path, "rb") as f:
            file_content = f.read()

        # Process new document
        _, chunk_ids, chunk_texts, chunk_metadatas = document_processor.process_document(
            document_id=document_id,
            user_id=user_id,
            filename=filename,
            file_content=file_content,
            file_hash=file_hash,
        )
        
        # Delete old vectors
        vectorstore.delete_by_document_id(document_id)
        
        # Add new vectors
        vectorstore.add_documents(
            ids=chunk_ids,
            documents=chunk_texts,
            metadatas=chunk_metadatas,
        )
        
        logger.info(
            "Background replacement complete: document_id=%s, new_chunks=%d",
            document_id,
            len(chunk_ids),
        )
        
        # Update SQLite
        async def _update():
            async with factory() as session:
                doc = await session.get(Document, document_id)
                if doc:
                    doc.filename = filename
                    doc.file_hash = file_hash
                    doc.status = "completed"
                    doc.chunk_count = len(chunk_ids)
                    await session.commit()
        async_to_sync(_update())
                
    except Exception as e:
        logger.error(
            "Background replacement failed for document_id=%s: %s",
            document_id,
            str(e),
        )
        async def _fail():
            async with factory() as session:
                doc = await session.get(Document, document_id)
                if doc:
                    doc.status = "failed"
                    doc.error_message = str(e)
                    await session.commit()
        async_to_sync(_fail())
    finally:
        # Cleanup temporary file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Could not remove temporary file {file_path}: {e}")
