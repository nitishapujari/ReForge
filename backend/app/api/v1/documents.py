"""
ReForge — Documents API Routes.

Endpoints for uploading, listing, and deleting documents.
Document processing runs in the background via FastAPI BackgroundTasks.
"""

import asyncio
import hashlib
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

from app.models.database import get_db_session, get_session_factory
from app.models.document import Document
from app.models.schemas import DocumentResponse, DocumentUploadResponse
from app.services import document_processor, vectorstore
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


async def _process_and_ingest_document(
    document_id: str,
    filename: str,
    file_content: bytes,
    file_hash: str | None,
) -> None:
    """
    Background task: process document (chunking) and add to vector store.
    Updates SQLite status upon completion or failure.
    """
    factory = get_session_factory()
    try:
        # Process document in a separate thread
        _, chunk_ids, chunk_texts, chunk_metadatas = await asyncio.to_thread(
            document_processor.process_document,
            document_id=document_id,
            filename=filename,
            file_content=file_content,
            file_hash=file_hash,
        )
        
        # Run vector store insertion in a separate thread to prevent blocking the event loop
        await asyncio.to_thread(
            vectorstore.add_documents,
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
        async with factory() as session:
            doc = await session.get(Document, document_id)
            if doc:
                doc.status = "completed"
                doc.chunk_count = len(chunk_ids)
                await session.commit()
                
    except Exception as e:
        logger.error(
            "Background ingestion failed for document_id=%s: %s",
            document_id,
            str(e),
        )
        async with factory() as session:
            doc = await session.get(Document, document_id)
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)
                await session.commit()


async def _replace_document(
    document_id: str,
    filename: str,
    file_content: bytes,
    file_hash: str | None,
) -> None:
    """
    Background task: replace an existing document's vectors and update SQLite.
    """
    factory = get_session_factory()
    try:
        # Process new document
        _, chunk_ids, chunk_texts, chunk_metadatas = await asyncio.to_thread(
            document_processor.process_document,
            document_id=document_id,
            filename=filename,
            file_content=file_content,
            file_hash=file_hash,
        )
        
        # Delete old vectors
        await asyncio.to_thread(vectorstore.delete_by_document_id, document_id)
        
        # Add new vectors
        await asyncio.to_thread(
            vectorstore.add_documents,
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
        async with factory() as session:
            doc = await session.get(Document, document_id)
            if doc:
                doc.filename = filename
                doc.file_hash = file_hash
                doc.status = "completed"
                doc.chunk_count = len(chunk_ids)
                await session.commit()
                
    except Exception as e:
        logger.error(
            "Background replacement failed for document_id=%s: %s",
            document_id,
            str(e),
        )
        async with factory() as session:
            doc = await session.get(Document, document_id)
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)
                await session.commit()


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
        (Document.file_hash == file_hash) | (Document.filename == file.filename)
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
    new_doc = Document(filename=file.filename, file_hash=file_hash, status="processing")
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    # Queue background processing and ingestion
    background_tasks.add_task(
        _process_and_ingest_document,
        document_id=new_doc.id,
        filename=file.filename,
        file_content=file_content,
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
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )

    file_content = await file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()

    doc.status = "processing"
    await db.commit()

    background_tasks.add_task(
        _replace_document,
        document_id=document_id,
        filename=file.filename,
        file_content=file_content,
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
    db: AsyncSession = Depends(get_db_session)
) -> list[dict]:
    """List all documents currently in SQLite."""
    stmt = select(Document).order_by(Document.created_at.desc())
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
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    """Delete a document and all its chunks."""
    # First delete from vector store
    deleted_chunks = 0
    try:
        deleted_chunks = await asyncio.to_thread(vectorstore.delete_by_document_id, document_id)
    except Exception as e:
        logger.warning(f"Vector store delete failed or missed: {e}")
        
    # Then delete from SQLite
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found.",
        )
        
    await db.delete(doc)
    await db.commit()

    return {
        "document_id": document_id,
        "deleted_chunks": deleted_chunks,
        "message": f"Deleted document and {deleted_chunks} chunks.",
    }
