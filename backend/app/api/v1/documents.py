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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.models.database import get_db_session, get_session_factory
from app.models.document import Document
from app.models.schemas import DocumentResponse, DocumentUploadResponse
from app.services import document_processor, vectorstore
from app.utils.logger import get_logger
from app.worker import process_and_ingest_document_task, replace_document_task
from datetime import datetime, timezone

logger = get_logger(__name__)

TEMP_DOCS_DIR = "storage/temp_docs"
os.makedirs(TEMP_DOCS_DIR, exist_ok=True)

router = APIRouter(prefix="/documents", tags=["Documents"])





@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload Document",
    description=(
        "Upload a PDF or TXT file for ingestion. "
        "The file is chunked and indexed in the background. "
        "Returns immediately with a document ID."
    ),
)
async def upload_document(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    file: UploadFile = File(
        ..., description="PDF or TXT file to upload (max 20MB)"
    ),
    db: AsyncSession = Depends(get_db_session),
) -> DocumentUploadResponse:
    """Upload and process a document for RAG ingestion."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    # Read file content and compute hash
    file_content = await file.read()
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
    await db.refresh(new_doc)

    # Save file temporarily for the worker
    temp_file_path = os.path.join(TEMP_DOCS_DIR, f"{new_doc.id}_{uuid.uuid4().hex[:8]}")
    with open(temp_file_path, "wb") as f:
        f.write(file_content)

    # Queue background processing and ingestion in Huey
    process_and_ingest_document_task(
        document_id=new_doc.id,
        user_id=current_user.id,
        filename=file.filename,
        file_path=temp_file_path,
        file_hash=file_hash,
    )

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
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    file: UploadFile = File(
        ..., description="PDF or TXT file to upload (max 20MB)"
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
    file_hash = hashlib.sha256(file_content).hexdigest()

    doc.status = "processing"
    await db.commit()

    # Save file temporarily for the worker
    temp_file_path = os.path.join(TEMP_DOCS_DIR, f"{document_id}_{uuid.uuid4().hex[:8]}")
    with open(temp_file_path, "wb") as f:
        f.write(file_content)

    replace_document_task(
        document_id=document_id,
        user_id=current_user.id,
        filename=file.filename,
        file_path=temp_file_path,
        file_hash=file_hash,
    )

    return DocumentUploadResponse(
        document_id=document_id,
        filename=file.filename,
        status="processing",
        message="Document replacement queued for processing.",
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
