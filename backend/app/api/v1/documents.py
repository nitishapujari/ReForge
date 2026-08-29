"""
ReForge — Documents API Routes.

Endpoints for uploading, listing, and deleting documents.
Document processing runs in the background via FastAPI BackgroundTasks.
"""

import asyncio
import gc
import hashlib
import os
import time
import traceback
import uuid
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.constants import ALLOWED_EXTENSIONS
from app.models.database import get_db_session, get_session_factory
from app.models.document import Document
from app.models.schemas import DocumentResponse, DocumentUploadResponse
from app.services import document_processor, vectorstore
from app.services.document_processor import DocumentProcessingError
from app.utils.logger import get_logger
from datetime import datetime, timezone

logger = get_logger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])

_active_tasks = set()

def _fire_and_forget(task: asyncio.Task):
    """Keep a strong reference to background tasks to prevent garbage collection."""
    _active_tasks.add(task)
    task.add_done_callback(_active_tasks.discard)


async def run_ingestion_task(
    document_id: str,
    user_id: str,
    filename: str,
    file_content: bytes | None,
    file_hash: str | None,
    is_replace: bool = False,
):
    """Background task to process the document and update DB state, shielded from cancellation and DB locks."""
    async def _execute():
        nonlocal file_content
        task_start = time.perf_counter()
        logger.info("[Ingestion Task Started] Document ID: %s | Filename: '%s' | User ID: %s | Initial DB Status transition: processing", document_id, filename, user_id)
        try:
            # Step 1: Process document and extract chunks (CPU bound, no DB session held)
            step1_start = time.perf_counter()
            _, chunk_ids, chunk_texts, chunk_metadatas = await asyncio.to_thread(
                document_processor.process_document,
                document_id=document_id,
                user_id=user_id,
                filename=filename,
                file_content=file_content,
                file_hash=file_hash,
            )
            logger.info("[Step 1 Success] Parsing & Chunking completed in %.2fs | Chunks generated: %d", time.perf_counter() - step1_start, len(chunk_ids))
            
            # Free file_content from RAM before vector embedding
            file_content = None
            gc.collect()
            
            # Step 2: Delete existing vector chunks if replacing (no DB session held)
            if is_replace:
                step2_start = time.perf_counter()
                deleted_count = await asyncio.to_thread(
                    vectorstore.delete_by_document_id,
                    document_id
                )
                logger.info("[Step 2 Success] Deleted %d existing vectors for replace in %.2fs", deleted_count, time.perf_counter() - step2_start)
                
            # Step 3: Add vector embeddings asynchronously in batches (no DB session held)
            step3_start = time.perf_counter()
            await vectorstore.add_documents_async(
                ids=chunk_ids,
                documents=chunk_texts,
                metadatas=chunk_metadatas,
                batch_size=64,
            )
            logger.info("[Step 3 Success] Vector embeddings and ChromaDB insertion finished in %.2fs", time.perf_counter() - step3_start)
            
            # Step 4: ONLY NOW open a short-lived database session to update status
            factory = get_session_factory()
            async with factory() as db:
                doc = await db.get(Document, document_id)
                if doc:
                    if doc.is_deleted:
                        logger.warning(
                            "[Ingestion Aborted] Document %s deleted during processing. Cleaning up chunks.",
                            document_id,
                        )
                        await asyncio.to_thread(
                            vectorstore.delete_by_document_id,
                            document_id,
                        )
                        return

                    doc.status = "completed"
                    doc.chunk_count = len(chunk_ids)
                    doc.error_message = None
                    await db.commit()
                    logger.info("[Database Status Transition] Document ID: %s | Transition: processing -> completed | Chunk Count: %d | Total Ingestion Time: %.2fs", document_id, len(chunk_ids), time.perf_counter() - task_start)
                
        except Exception as e:
            total_fail_time = time.perf_counter() - task_start
            logger.error("[Ingestion Task Fatal Exception] Document ID: %s | Filename: '%s' failed after %.2fs.\nException: %r\nTraceback:\n%s", document_id, filename, total_fail_time, e, traceback.format_exc())
            try:
                factory = get_session_factory()
                async with factory() as db:
                    doc = await db.get(Document, document_id)
                    if doc:
                        doc.status = "failed"
                        doc.error_message = f"{type(e).__name__}: {str(e)}"
                        await db.commit()
                        logger.info("[Database Status Transition] Document ID: %s | Transition: processing -> failed | Error: %s", document_id, doc.error_message)
            except Exception as db_err:
                logger.error("[Database Fatal] Failed to update status to failed for %s.\nException: %r\nTraceback:\n%s", document_id, db_err, traceback.format_exc())

    task = asyncio.create_task(_execute())
    _fire_and_forget(task)
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        logger.warning(f"[Ingestion Task Detached] Task for document {document_id} was cancelled by HTTP disconnect, but background ingestion continues undisturbed.")






def _validate_upload(filename: str, content: bytes) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 20MB.",
        )


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload Document",
    description=(
        "Upload a document for ingestion. "
        "The file is chunked and indexed in the background. "
        "Returns immediately with a document ID."
    ),
)
async def upload_document(
    current_user: CurrentUser,
    file: UploadFile = File(
        ..., description="File to upload (max 20MB)"
    ),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentUploadResponse:
    """Upload and process a document for RAG ingestion."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    file_content = await file.read()
    _validate_upload(file.filename, file_content)
        
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Check for duplicate
    stmt = select(Document).where(
        (Document.user_id == current_user.id) &
        (Document.is_deleted == False) &
        ((Document.file_hash == file_hash) | (Document.filename == file.filename))
    )
    result = await db.execute(stmt)
    existing_docs = result.scalars().all()
    
    if existing_docs:
        existing_doc = existing_docs[0]
        is_exact = existing_doc.file_hash == file_hash
        message = "This document is already in the knowledge base." if is_exact else "A document with this filename already exists, but the content is different. Do you want to replace it?"
        
        logger.info("Duplicate document upload prevented: %s", file.filename)
        return DocumentUploadResponse(
            document_id=existing_doc.id,
            filename=existing_doc.filename,
            status="duplicate",
            message=message,
            duplicate=True,
            existing_document_id=existing_doc.id
        )

    # Create new document record in SQLite
    new_doc = Document(filename=file.filename, file_hash=file_hash, status="processing", user_id=current_user.id)
    db.add(new_doc)
    await db.commit()

    # Process document in the background detached from request lifecycle
    task = asyncio.create_task(
        run_ingestion_task(
            document_id=new_doc.id,
            user_id=current_user.id,
            filename=file.filename,
            file_content=file_content,
            file_hash=file_hash,
            is_replace=False,
        )
    )
    _fire_and_forget(task)
    logger.info("[Upload Completed] Successfully created DB record %s and scheduled detached background ingestion task for file: '%s' (%d bytes)", new_doc.id, file.filename, len(file_content) if file_content else 0)

    return DocumentUploadResponse(
        document_id=new_doc.id,
        filename=file.filename,
        status="processing",
        message="Document uploaded and queued for processing.",
    )


@router.put(
    "/{document_id}",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Replace Document",
    description="Replace an existing document with a new file.",
)
async def replace_document(
    document_id: str,
    current_user: CurrentUser,
    file: UploadFile = File(
        ..., description="File to upload (max 20MB)"
    ),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentUploadResponse:
    """Replace an existing document."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id or doc.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )

    if doc.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is currently being processed. Please wait for ingestion to finish before replacing.",
        )

    file_content = await file.read()
    _validate_upload(file.filename, file_content)
    file_hash = hashlib.sha256(file_content).hexdigest()

    doc.status = "processing"
    doc.filename = file.filename
    doc.file_hash = file_hash
    await db.commit()

    # Process document in the background detached from request lifecycle
    task = asyncio.create_task(
        run_ingestion_task(
            document_id=document_id,
            user_id=current_user.id,
            filename=file.filename,
            file_content=file_content,
            file_hash=file_hash,
            is_replace=True,
        )
    )
    _fire_and_forget(task)
    logger.info("[Replace Completed] Scheduled detached background ingestion task for replacing document %s with file: '%s' (%d bytes)", document_id, file.filename, len(file_content) if file_content else 0)

    return DocumentUploadResponse(
        document_id=document_id,
        filename=file.filename,
        status="processing",
        message="Document replaced and queued for processing.",
    )


@router.get(
    "",
    response_model=list[DocumentResponse],
    summary="List Documents",
    description="List all ingested documents with chunk counts.",
)
async def list_documents(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session)
) -> list[dict]:
    """List all active documents for the current user."""
    stmt = select(Document).where(
        (Document.user_id == current_user.id) & 
        (Document.is_deleted == False)
    ).order_by(Document.created_at.desc())
    result = await db.execute(stmt)
    documents = result.scalars().all()
    
    # Release the SQLite SHARED lock immediately so background tasks can write
    await db.commit()
    
    return [
        {
            "document_id": doc.id,
            "filename": doc.filename,
            "chunk_count": doc.chunk_count,
            "created_at": doc.created_at.isoformat(),
            "status": doc.status,
            "error_message": doc.error_message,
        }
        for doc in documents
    ]


from pydantic import BaseModel

class RenameDocumentRequest(BaseModel):
    filename: str

@router.patch("/{document_id}/rename", summary="Rename Document")
async def rename_document(
    document_id: str,
    request: RenameDocumentRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id or doc.is_deleted:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    doc.filename = request.filename
    await db.commit()
    return {"status": "success", "filename": doc.filename}

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Document",
    description="Remove a document from SQLite and its chunks from the vector store.",
)
async def delete_document(
    document_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Soft Delete a document and remove all its chunks from the vector store."""
    # First check existence and ownership from SQLite
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id or doc.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )

    # Then delete from vector store
    deleted_chunks = 0
    try:
        deleted_chunks = await asyncio.to_thread(vectorstore.delete_by_document_id, document_id)
    except Exception as e:
        logger.warning(f"Vector store delete failed or missed: {e}")
        
    # Then Soft delete from SQLite
        
    doc.is_deleted = True
    doc.deleted_at = datetime.now(timezone.utc)
    doc.status = "deleted"
    await db.commit()

    return {
        "document_id": document_id,
        "deleted_chunks": deleted_chunks,
        "message": f"Deleted document and {deleted_chunks} chunks.",
    }
