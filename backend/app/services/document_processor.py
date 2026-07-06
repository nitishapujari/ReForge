"""
ReForge — Document Processor Service.

Handles file parsing (PDF, TXT) and text chunking with rich metadata.
Each chunk is tagged with document_id, filename, page_number,
chunk_number, and created_at for source attribution.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.constants import (
    ALLOWED_EXTENSIONS,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    MAX_FILE_SIZE_MB,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class DocumentProcessingError(Exception):
    """Raised when document processing fails."""

    pass


def validate_file(filename: str, file_size: int) -> None:
    """
    Validate file extension and size.

    Args:
        filename: Original filename.
        file_size: File size in bytes.

    Raises:
        DocumentProcessingError: If validation fails.
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise DocumentProcessingError(
            f"Unsupported file type: '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise DocumentProcessingError(
            f"File too large: {file_size / (1024 * 1024):.1f}MB. "
            f"Max allowed: {MAX_FILE_SIZE_MB}MB."
        )


def extract_text_from_pdf(file_content: bytes) -> list[dict[str, str | int]]:
    """
    Extract text from a PDF file, page by page.

    Args:
        file_content: Raw PDF bytes.

    Returns:
        List of dicts with 'text' and 'page_number' keys.
    """
    import io

    reader = PdfReader(io.BytesIO(file_content))
    pages = []

    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text()
        if text and text.strip():
            pages.append({"text": text.strip(), "page_number": i})

    if not pages:
        raise DocumentProcessingError(
            "Could not extract any text from the PDF. "
            "The file may be image-based or empty."
        )

    logger.info("Extracted text from %d pages", len(pages))
    return pages


def extract_text_from_txt(file_content: bytes) -> list[dict[str, str | int]]:
    """
    Extract text from a plain text file.

    Args:
        file_content: Raw text bytes.

    Returns:
        List with single dict containing all text (page_number=1).
    """
    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    text = text.strip()
    if not text:
        raise DocumentProcessingError("The text file is empty.")

    return [{"text": text, "page_number": 1}]


def process_document(
    filename: str,
    file_content: bytes,
) -> tuple[str, list[str], list[str], list[dict]]:
    """
    Process a document: extract text, chunk it, and prepare metadata.

    Args:
        filename: Original filename.
        file_content: Raw file bytes.

    Returns:
        Tuple of (document_id, chunk_ids, chunk_texts, chunk_metadatas).
    """
    # Validate
    validate_file(filename, len(file_content))

    # Generate document ID
    document_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    # Extract text based on file type
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        pages = extract_text_from_pdf(file_content)
    elif ext == ".txt":
        pages = extract_text_from_txt(file_content)
    else:
        raise DocumentProcessingError(f"Unsupported file type: {ext}")

    # Initialize the text splitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    # Chunk each page and build metadata
    chunk_ids: list[str] = []
    chunk_texts: list[str] = []
    chunk_metadatas: list[dict] = []
    chunk_counter = 0

    for page_data in pages:
        page_text = page_data["text"]
        page_number = page_data["page_number"]

        chunks = splitter.split_text(page_text)

        for chunk_text in chunks:
            chunk_counter += 1
            chunk_id = f"{document_id}_chunk_{chunk_counter}"

            chunk_ids.append(chunk_id)
            chunk_texts.append(chunk_text)
            chunk_metadatas.append({
                "document_id": document_id,
                "filename": filename,
                "page_number": page_number,
                "chunk_number": chunk_counter,
                "created_at": created_at,
            })

    logger.info(
        "Processed '%s': document_id=%s, pages=%d, chunks=%d",
        filename,
        document_id,
        len(pages),
        chunk_counter,
    )

    return document_id, chunk_ids, chunk_texts, chunk_metadatas
