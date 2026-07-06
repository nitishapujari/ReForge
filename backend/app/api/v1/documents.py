"""
ReForge — Documents API Routes.

Endpoints for uploading, listing, and deleting documents.
Document processing runs in the background via FastAPI BackgroundTasks.
"""

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    UploadFile,
    status,
)

from app.models.schemas import DocumentResponse, DocumentUploadResponse
from app.services import document_processor, vectorstore
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


def _ingest_document(
    document_id: str,
    chunk_ids: list[str],
    chunk_texts: list[str],
    chunk_metadatas: list[dict],
) -> None:
    """
    Background task: add chunks to the vector store.

    Args:
        document_id: UUID of the document.
        chunk_ids: List of chunk IDs.
        chunk_texts: List of chunk text contents.
        chunk_metadatas: List of chunk metadata dicts.
    """
    try:
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
    except Exception as e:
        logger.error(
            "Background ingestion failed for document_id=%s: %s",
            document_id,
            str(e),
        )


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
    responses={
        202: {
            "description": "Document accepted for processing",
            "content": {
                "application/json": {
                    "example": {
                        "document_id": "550e8400-e29b-41d4-a716-446655440000",
                        "filename": "research_paper.pdf",
                        "status": "processing",
                        "message": "Document uploaded. 12 chunks queued for indexing.",
                    }
                }
            },
        },
        400: {"description": "Invalid file type or processing error"},
        413: {"description": "File too large"},
    },
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(
        ..., description="PDF or TXT file to upload (max 20MB)"
    ),
) -> DocumentUploadResponse:
    """Upload and process a document for RAG ingestion."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    # Read file content
    file_content = await file.read()

    # Process document (validate, extract text, chunk)
    try:
        document_id, chunk_ids, chunk_texts, chunk_metadatas = (
            document_processor.process_document(
                filename=file.filename,
                file_content=file_content,
            )
        )
    except document_processor.DocumentProcessingError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Queue background ingestion into vector store
    background_tasks.add_task(
        _ingest_document,
        document_id=document_id,
        chunk_ids=chunk_ids,
        chunk_texts=chunk_texts,
        chunk_metadatas=chunk_metadatas,
    )

    return DocumentUploadResponse(
        document_id=document_id,
        filename=file.filename,
        status="processing",
        message=f"Document uploaded. {len(chunk_ids)} chunks queued for indexing.",
    )


@router.get(
    "",
    response_model=list[DocumentResponse],
    summary="List Documents",
    description="List all ingested documents with chunk counts.",
    responses={
        200: {
            "description": "List of documents",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "document_id": "550e8400-e29b-41d4-a716-446655440000",
                            "filename": "research_paper.pdf",
                            "chunk_count": 12,
                            "created_at": "2026-07-06T10:00:00Z",
                        }
                    ]
                }
            },
        }
    },
)
async def list_documents() -> list[dict]:
    """List all documents currently in the vector store."""
    return vectorstore.list_documents()


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Document",
    description="Remove a document and all its chunks from the vector store.",
    responses={
        200: {"description": "Document deleted with chunk count"},
        404: {"description": "Document not found"},
    },
)
async def delete_document(document_id: str) -> dict:
    """Delete a document and all its chunks."""
    deleted_count = vectorstore.delete_by_document_id(document_id)

    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chunks found for document_id={document_id}.",
        )

    return {
        "document_id": document_id,
        "deleted_chunks": deleted_count,
        "message": f"Deleted {deleted_count} chunks.",
    }
