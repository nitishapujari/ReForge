"""
ReForge — Health Check Endpoint.

Reports connectivity status of all subsystems:
Gemini LLM, ChromaDB vector store, and SQLite database.
"""

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str
    gemini: str
    chromadb: str
    database: str


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
                        "gemini": "connected",
                        "chromadb": "connected",
                        "database": "connected",
                    }
                }
            },
        }
    },
)
async def health_check() -> HealthResponse:
    """
    Check the health of all subsystems.

    Returns connectivity status for Gemini, ChromaDB, and the database.
    Full connectivity checks will be wired in as services are added.
    """
    # Placeholder statuses — will be replaced with real checks
    # as services are implemented in subsequent tasks.
    gemini_status = "not_configured"
    chromadb_status = "not_configured"
    database_status = "not_configured"

    # Determine overall status
    statuses = [gemini_status, chromadb_status, database_status]
    if all(s == "connected" for s in statuses):
        overall = "healthy"
    elif any(s == "error" for s in statuses):
        overall = "degraded"
    else:
        overall = "starting"

    logger.info(
        "Health check: overall=%s gemini=%s chromadb=%s db=%s",
        overall,
        gemini_status,
        chromadb_status,
        database_status,
    )

    return HealthResponse(
        status=overall,
        gemini=gemini_status,
        chromadb=chromadb_status,
        database=database_status,
    )
