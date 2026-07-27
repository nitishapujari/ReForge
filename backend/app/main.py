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
from app.utils.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

import uuid
from fastapi import Request
from fastapi.responses import JSONResponse


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
    try:
        settings = get_settings()
    except ValidationError as e:
        # Fail fast with a clear message if required config is missing
        logger.critical("Configuration error — check your .env file:")
        logger.critical(str(e))
        raise SystemExit(1) from e

    configure_logging(settings.LOG_LEVEL)
    logger.info("Starting %s v%s", settings.APP_TITLE, settings.APP_VERSION)

    # Initialize vector store
    init_vectorstore(
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

    from sqlalchemy import select, text
    from sqlalchemy.exc import OperationalError
    import app.models.database as db_mod
    from app.models.document import Document
    from app.models.chat import ChatSession
    from app.models.user import User
    from datetime import datetime, timezone
    import uuid

    # Initialize database (creates tables if they don't exist)
    await init_db(settings.DATABASE_URL)

    factory = db_mod.get_session_factory()
    async with factory() as session:
        # 1. Manual Schema Migrations (since we don't use Alembic)
        try:
            # Check if user_id exists on documents
            await session.execute(text("SELECT user_id FROM documents LIMIT 1"))
        except OperationalError:
            logger.info("Migrating schema: Adding missing columns to documents and chat_sessions")
            async with db_mod._engine.begin() as conn:
                try:
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN user_id VARCHAR(36)"))
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN is_deleted BOOLEAN DEFAULT 0 NOT NULL"))
                    await conn.execute(text("ALTER TABLE documents ADD COLUMN deleted_at DATETIME"))
                    await conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id VARCHAR(36)"))
                except Exception as e:
                    logger.warning("Schema migration error (might be already applied): %s", e)

        # 2. Create Default Admin User
        admin_email = "admin@reforge.local"
        result = await session.execute(select(User).where(User.email == admin_email))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                provider="credentials",
                # bcrypt hash for "admin" -> $2b$12$NqL.yQ0D2/G0H./N6yK/UeBv3sI5x4M.Gq4V7uG0.
                # But since we haven't installed passlib yet, we leave it None or a dummy for now.
                # The user can't login via credentials until we install bcrypt, but they can still own docs.
                hashed_password=None, 
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Created default admin user (UUID: %s)", admin_user.id)

        # 3. Migrate Legacy Data (Assign orphaned records to admin)
        try:
            # Update documents
            docs_updated = await session.execute(
                text("UPDATE documents SET user_id = :admin_id WHERE user_id IS NULL"),
                {"admin_id": admin_user.id}
            )
            # Update chat sessions
            chats_updated = await session.execute(
                text("UPDATE chat_sessions SET user_id = :admin_id WHERE user_id IS NULL"),
                {"admin_id": admin_user.id}
            )
            await session.commit()
            
            # 4. Migrate ChromaDB legacy docs if documents table is completely empty
            result = await session.execute(select(Document.id).limit(1))
            if not result.first():
                from app.services.vectorstore import get_collection
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
                            user_id=admin_user.id,
                            chunk_count=doc_data["chunk_count"],
                            status="completed",
                            is_deleted=False,
                            created_at=doc_data["created_at"],
                            updated_at=doc_data["created_at"],
                        )
                        session.add(new_doc)
                    await session.commit()
                    logger.info("Migrated %d legacy ChromaDB documents to SQL Database for user %s", len(legacy_docs), admin_user.id)
        except Exception as e:
            logger.error("Failed to migrate legacy data: %s", e)

    # Store settings in app state for dependency injection
    app.state.settings = settings

    logger.info("Application startup complete")

    yield

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
        docs_url="/docs" if get_settings().ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if get_settings().ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if get_settings().ENVIRONMENT != "production" else None,
    )
    
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        correlation_id = str(uuid.uuid4())
        logger.error("Unhandled exception: %s | Correlation ID: %s", str(exc), correlation_id, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred.",
                "correlation_id": correlation_id
            }
        )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[get_settings().FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(v1_router)

    return app


# Application instance used by uvicorn
app = create_app()
