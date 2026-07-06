"""
ReForge — FastAPI Application.

Application factory with CORS, lifespan management, structured logging,
and Swagger/OpenAPI documentation.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.api.v1.router import v1_router
from app.models.database import init_db, close_db
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

    # Initialize database (creates tables if they don't exist)
    await init_db(settings.DATABASE_URL, settings.database_path)
    logger.info("Database initialized: %s", settings.database_path)

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
