"""
ReForge — Health Check Endpoint.

Reports connectivity status of all subsystems:
Gemini LLM, ChromaDB vector store, and SQLite database.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db_session
from app.models.schemas import HealthResponse
from app.services.llm import check_health as check_llm_health
from app.services.vectorstore import check_health as check_vectorstore_health
from app.utils.logger import get_logger
from app.config import get_settings

logger = get_logger(__name__)

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health Check",
    description="Returns connectivity status of all subsystems.",
    responses={
        200: {
            "description": "System health report",
            "content": {
                "application/json": {
                    "example": {
                        "status": "healthy",
                        "active_provider": "gemini",
                        "llm_status": "connected",
                        "chromadb": "connected",
                        "database": "connected",
                    }
                }
            },
        }
    },
)
async def health_check(
    db: AsyncSession = Depends(get_db_session),
) -> HealthResponse:
    """
    Check the health of all subsystems.

    Returns connectivity status for Gemini, ChromaDB, and the database.
    """
    # -- Database check --
    try:
        await db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        database_status = "error"

    # -- ChromaDB check --
    chromadb_status = "connected" if check_vectorstore_health() else "error"

    # -- LLM check --
    llm_status = "connected" if check_llm_health() else "error"
    settings = get_settings()
    active_provider = settings.LLM_PROVIDER
    active_model = settings.GROQ_MODEL if active_provider == "groq" else settings.GEMINI_MODEL

    # Determine overall status
    statuses = [llm_status, chromadb_status, database_status]
    if all(s == "connected" for s in statuses):
        overall = "healthy"
    elif any(s == "error" for s in statuses):
        overall = "degraded"
    else:
        overall = "starting"

    logger.info(
        "Health check: overall=%s provider=%s llm=%s chromadb=%s db=%s",
        overall,
        active_provider,
        llm_status,
        chromadb_status,
        database_status,
    )

    return HealthResponse(
        status=overall,
        active_provider=active_provider,
        active_model=active_model,
        llm_status=llm_status,
        chromadb=chromadb_status,
        database=database_status,
    )
