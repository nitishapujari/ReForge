"""
ReForge — FastAPI Application.

Application factory with CORS, lifespan management, structured logging,
and Swagger/OpenAPI documentation.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path
import os

# Note: ChromaDB emits telemetry warnings (e.g., "Failed to send telemetry event ClientStartEvent: capture() takes 1 positional argument but 3 were given")
# during startup. This is due to an upstream bug in the chromadb/posthog integration where posthog.capture signatures mismatched.
# Setting ANONYMIZED_TELEMETRY=False does not reliably suppress the error logs, so the warnings are left as-is until patched upstream.

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.api.v1.router import v1_router
from app.models.database import init_db, close_db
from app.services.llm import init_llm
from app.services.vectorstore import init_vectorstore
from app.utils.logger import configure_logging, get_logger


logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan manager.

    Handles startup and shutdown tasks:
    - Validates configuration (fail-fast on missing GEMINI_API_KEY)
    - Configures logging
    - Ensures storage directories exist
    """
    # --- Startup ---
    try:
        settings = get_settings()
    except ValidationError as e:
        # Fail fast with a clear message if required config is missing
        logger.critical("Configuration error — check your .env file:")
        logger.critical(str(e))
        raise SystemExit(1) from e

    configure_logging(settings.LOG_LEVEL)
    logger.info("Starting %s v%s", settings.APP_TITLE, settings.APP_VERSION)

    # Ensure storage directories exist
    storage_dir = Path(settings.chroma_persist_path)
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Initialize vector store
    init_vectorstore(
        persist_dir=str(settings.chroma_persist_path),
        collection_name=settings.CHROMA_COLLECTION_NAME,
    )

    # Validate that we have the key for the active provider
    try:
        _ = settings.active_api_key
    except ValueError as e:
        logger.critical("Configuration error — check your .env file:")
        logger.critical(str(e))
        raise SystemExit(1) from e

    # Initialize LLM
    init_llm(
        provider=settings.LLM_PROVIDER,
        gemini_api_key=settings.GEMINI_API_KEY,
        gemini_model=settings.GEMINI_MODEL,
        groq_api_key=settings.GROQ_API_KEY,
        groq_model=settings.GROQ_MODEL,
    )

    # Initialize database (creates tables if they don't exist)
    await init_db(settings.DATABASE_URL, settings.database_path)
    logger.info("Database initialized: %s", settings.database_path)

    # --- Migration: Legacy Documents ---
    from sqlalchemy import select
    from app.models.database import get_session_factory
    from app.models.document import Document
    from app.services.vectorstore import get_collection
    from datetime import datetime, timezone

    factory = get_session_factory()
    async with factory() as session:
        # Check if documents table is empty
        result = await session.execute(select(Document.id).limit(1))
        if not result.first():
            try:
                collection = get_collection()
                metadata_results = collection.get(include=["metadatas"])
                if metadata_results and metadata_results.get("metadatas"):
                    legacy_docs = {}
                    for meta in metadata_results["metadatas"]:
                        if not meta: continue
                        doc_id = meta.get("document_id")
                        if not doc_id: continue
                        
                        if doc_id not in legacy_docs:
                            created_str = meta.get("created_at", "")
                            try:
                                dt = datetime.fromisoformat(created_str)
                            except ValueError:
                                dt = datetime.now(timezone.utc)
                                
                            legacy_docs[doc_id] = {
                                "id": doc_id,
                                "filename": meta.get("filename", "unknown"),
                                "chunk_count": 0,
                                "created_at": dt,
                            }
                        legacy_docs[doc_id]["chunk_count"] += 1
                        
                    for doc_data in legacy_docs.values():
                        new_doc = Document(
                            id=doc_data["id"],
                            filename=doc_data["filename"],
                            file_hash=None,
                            chunk_count=doc_data["chunk_count"],
                            status="completed",
                            created_at=doc_data["created_at"],
                            updated_at=doc_data["created_at"],
                        )
                        session.add(new_doc)
                    await session.commit()
                    logger.info("Migrated %d legacy documents to SQLite", len(legacy_docs))
            except Exception as e:
                logger.error("Failed to migrate legacy documents: %s", e)

    # Store settings in app state for dependency injection
    app.state.settings = settings

    logger.info("Application startup complete")

    yield

    # --- Shutdown ---
    await close_db()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI instance.
    """
    app = FastAPI(
        title="ReForge API",
        description=(
            "**The Self-Healing RAG Pipeline**\n\n"
            "ReForge uses a LangGraph-based multi-agent workflow to detect "
            "hallucinations, critique its own answers, rewrite queries, and "
            "retry retrieval before responding."
        ),
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # Next.js dev server
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Routers ---
    app.include_router(v1_router)

    return app


# Application instance used by uvicorn
app = create_app()
