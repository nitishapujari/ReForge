"""
ReForge — Documents API Routes.

Endpoints for uploading, listing, and deleting documents.
Document processing runs in the background via FastAPI BackgroundTasks.
"""

import asyncio
import hashlib
import os
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
    file_content: bytes,
    file_hash: str | None,
    is_replace: bool = False,
):
    """Background task to process the document and update DB state, shielded from cancellation and DB locks."""
    async def _execute():
        try:
            # Step 1: Process document and extract chunks (CPU bound, no DB session held)
            _, chunk_ids, chunk_texts, chunk_metadatas = await asyncio.to_thread(
                document_processor.process_document,
                document_id=document_id,
                user_id=user_id,
                filename=filename,
                file_content=file_content,
                file_hash=file_hash,
            )
            
            # Step 2: Delete existing vector chunks if replacing (no DB session held)
            if is_replace:
                await asyncio.to_thread(
                    vectorstore.delete_by_document_id,
                    document_id
                )
                
            # Step 3: Add vector embeddings (CPU/Memory bound, no DB session held)
            await asyncio.to_thread(
                vectorstore.add_documents,
                ids=chunk_ids,
                documents=chunk_texts,
                metadatas=chunk_metadatas,
            )
            
            # Step 4: ONLY NOW open a short-lived database session to update status
            factory = get_session_factory()
            async with factory() as db:
                doc = await db.get(Document, document_id)
                if doc:
                    doc.status = "completed"
                    doc.chunk_count = len(chunk_ids)
                    await db.commit()
                    logger.info(f"Document {document_id} ingestion completed successfully.")
                
        except Exception as e:
            logger.error("Document ingestion failed for %s: %s", document_id, e)
            try:
                factory = get_session_factory()
                async with factory() as db:
                    doc = await db.get(Document, document_id)
                    if doc:
                        doc.status = "failed"
                        doc.error_message = str(e)
                        await db.commit()
            except Exception as db_err:
                logger.error("Failed to update status to failed for %s: %s", document_id, db_err)

    task = asyncio.create_task(_execute())
    _fire_and_forget(task)
    try:
        await asyncio.shield(task)
    except asyncio.CancelledError:
        logger.warning(f"Background task {document_id} was cancelled by HTTP disconnect, but ingestion continues in background.")






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
    # First delete from vector store
    deleted_chunks = 0
    try:
        deleted_chunks = await asyncio.to_thread(vectorstore.delete_by_document_id, document_id)
    except Exception as e:
        logger.warning(f"Vector store delete failed or missed: {e}")
        
    # Then Soft delete from SQLite
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id or doc.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )
        
    doc.is_deleted = True
    doc.deleted_at = datetime.now(timezone.utc)
    doc.status = "deleted"
    await db.commit()

    return {
        "document_id": document_id,
        "deleted_chunks": deleted_chunks,
        "message": f"Deleted document and {deleted_chunks} chunks.",
    }
