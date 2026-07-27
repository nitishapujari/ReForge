"""
ReForge — Document Processor Service.

Handles file parsing (PDF, TXT, DOCX, CSV, MD, Images) and text chunking with rich metadata.
Includes OCR fallback for scanned PDFs and semantic chunking.
"""

import io
import gc
import uuid
import re
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader
import fitz  # PyMuPDF
import docx
import pandas as pd
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

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


def _parse_pdf_pypdf(file_content: bytes) -> list[dict[str, str | int]]:
    reader = PdfReader(io.BytesIO(file_content))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text()
        if text and text.strip():
            pages.append({"text": text.strip(), "page_number": i})
    return pages


def _parse_pdf_pymupdf(file_content: bytes) -> list[dict[str, str | int]]:
    doc = fitz.open(stream=file_content, filetype="pdf")
    pages = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text()
        if text and text.strip():
            pages.append({"text": text.strip(), "page_number": i})
    doc.close()
    return pages


def _parse_pdf_ocr(file_content: bytes) -> list[dict[str, str | int]]:
    """Fallback OCR parser for scanned PDFs using pdf2image and pytesseract."""
    try:
        images = convert_from_bytes(file_content, fmt='jpeg')
        pages = []
        for i, img in enumerate(images, start=1):
            text = pytesseract.image_to_string(img)
            if text and text.strip():
                pages.append({"text": text.strip(), "page_number": i})
            img.close()
        del images
        gc.collect()
        return pages
    except Exception as e:
        logger.warning(f"OCR parsing failed: {e}")
        return []


def extract_text_from_pdf(file_content: bytes) -> list[dict[str, str | int]]:
    parsers = [
        ("pypdf", _parse_pdf_pypdf),
        ("PyMuPDF", _parse_pdf_pymupdf),
        ("OCR", _parse_pdf_ocr),
    ]

    for i, (name, parser_func) in enumerate(parsers):
        logger.info("Using parser: %s", name)
        try:
            pages = parser_func(file_content)
        except Exception as e:
            logger.warning("%s encountered an error: %s", name, e)
            pages = []
            
        if pages:
            logger.info("%s extracted %d pages", name, len(pages))
            return pages
            
        logger.info("%s extracted 0 pages", name)
        
        if i < len(parsers) - 1:
            logger.info("Falling back to next parser")

    raise DocumentProcessingError(
        "Could not extract any text from the PDF. "
        "The file may be corrupted or unreadable."
    )


def extract_text_from_txt(file_content: bytes) -> list[dict[str, str | int]]:
    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    text = text.strip()
    if not text:
        raise DocumentProcessingError("The text file is empty.")

    return [{"text": text, "page_number": 1}]


def extract_text_from_docx(file_content: bytes) -> list[dict[str, str | int]]:
    try:
        doc = docx.Document(io.BytesIO(file_content))
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        if not text:
            raise DocumentProcessingError("The docx file is empty.")
        return [{"text": text, "page_number": 1}]
    except Exception as e:
        raise DocumentProcessingError(f"Failed to parse docx: {e}")


def extract_text_from_csv(file_content: bytes) -> list[dict[str, str | int]]:
    try:
        df = pd.read_csv(io.BytesIO(file_content))
        # Convert CSV rows to readable text
        text = df.to_string(index=False)
        if not text.strip():
            raise DocumentProcessingError("The csv file is empty.")
        return [{"text": text, "page_number": 1}]
    except Exception as e:
        raise DocumentProcessingError(f"Failed to parse csv: {e}")


def extract_text_from_md(file_content: bytes) -> list[dict[str, str | int]]:
    # Markdown is essentially text, just decode it.
    return extract_text_from_txt(file_content)


def extract_text_from_image(file_content: bytes) -> list[dict[str, str | int]]:
    try:
        img = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(img)
        if not text.strip():
            raise DocumentProcessingError("Could not extract any text from the image.")
        return [{"text": text.strip(), "page_number": 1}]
    except Exception as e:
        raise DocumentProcessingError(f"Failed to parse image via OCR: {e}")


def _semantic_chunk_text(text: str) -> list[str]:
    """
    Simple Semantic Chunker:
    Splits by double newline (paragraphs), and merges small paragraphs
    until they reach a reasonable CHUNK_SIZE. This preserves semantic meaning
    better than arbitrary character splits.
    """
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(current_chunk) + len(para) <= CHUNK_SIZE:
            current_chunk += ("\n\n" + para if current_chunk else para)
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If a single paragraph is larger than CHUNK_SIZE, we have to hard-split it
            if len(para) > CHUNK_SIZE:
                # hard split
                words = para.split(' ')
                sub_chunk = ""
                for word in words:
                    if len(sub_chunk) + len(word) + 1 <= CHUNK_SIZE:
                        sub_chunk += (" " + word if sub_chunk else word)
                    else:
                        chunks.append(sub_chunk)
                        sub_chunk = word
                if sub_chunk:
                    current_chunk = sub_chunk
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def process_document(
    document_id: str,
    user_id: str,
    filename: str,
    file_content: bytes,
    file_hash: str | None = None,
) -> tuple[str, list[str], list[str], list[dict]]:
    validate_file(filename, len(file_content))
    created_at = datetime.now(timezone.utc).isoformat()
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        pages = extract_text_from_pdf(file_content)
    elif ext == ".txt":
        pages = extract_text_from_txt(file_content)
    elif ext == ".docx":
        pages = extract_text_from_docx(file_content)
    elif ext == ".csv":
        pages = extract_text_from_csv(file_content)
    elif ext == ".md":
        pages = extract_text_from_md(file_content)
    elif ext in [".png", ".jpg"]:
        pages = extract_text_from_image(file_content)
    else:
        raise DocumentProcessingError(f"Unsupported file type: {ext}")

    chunk_ids: list[str] = []
    chunk_texts: list[str] = []
    chunk_metadatas: list[dict] = []
    chunk_counter = 0

    for page_data in pages:
        page_text = page_data["text"]
        page_number = page_data["page_number"]

        # Use our new semantic chunker instead of RecursiveCharacterTextSplitter
        chunks = _semantic_chunk_text(page_text)

        for chunk_text in chunks:
            chunk_counter += 1
            chunk_id = f"{document_id}_chunk_{chunk_counter}"

            chunk_ids.append(chunk_id)
            chunk_texts.append(chunk_text)
            
            meta = {
                "document_id": document_id,
                "user_id": user_id,
                "filename": filename,
                "page_number": page_number,
                "chunk_number": chunk_counter,
                "created_at": created_at,
            }
            if file_hash:
                meta["file_hash"] = file_hash
                
            chunk_metadatas.append(meta)

    logger.info(
        "Processed '%s': document_id=%s, pages=%d, chunks=%d",
        filename,
        document_id,
        len(pages),
        chunk_counter,
    )
    gc.collect()
    return document_id, chunk_ids, chunk_texts, chunk_metadatas
