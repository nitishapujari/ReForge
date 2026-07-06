"""
ReForge — API v1 Router.

Aggregates all v1 route modules under the /api/v1 prefix.
New route modules should be registered here.
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router

v1_router = APIRouter(prefix="/api/v1")

# --- Register route modules ---
v1_router.include_router(health_router)
