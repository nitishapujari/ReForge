"""
ReForge — Application Configuration.

Centralized settings loaded from environment variables via .env file.
Uses pydantic-settings for validation and type coercion.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root is the `backend/` directory
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    @property
    def active_api_key(self) -> str:
        """Returns the active API key based on the LLM_PROVIDER."""
        if self.LLM_PROVIDER == "groq":
            if not self.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
            return self.GROQ_API_KEY
        else:
            if not self.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is required when LLM_PROVIDER=gemini")
            return self.GEMINI_API_KEY

    CHROMA_HOST: str = "chroma"
    CHROMA_PORT: int = 8000
    CHROMA_COLLECTION_NAME: str = "reforge_documents"

    DATABASE_URL: str = "postgresql+asyncpg://reforge:reforge@db:5432/reforge"
    
    REDIS_URL: str = "redis://redis:6379/0"

    LOG_LEVEL: str = "INFO"

    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "reforge"

    JWT_SECRET: str = "super-secret-key-for-dev-only-change-in-prod"
    JWT_ALGORITHM: str = "HS256"

    APP_TITLE: str = "ReForge API"
    APP_DESCRIPTION: str = "The Self-Healing RAG Pipeline"
    APP_VERSION: str = "0.1.0"



def get_settings() -> Settings:
    """
    Create and return application settings.

    Raises:
        ValidationError: If required settings (e.g., GEMINI_API_KEY) are missing.
    """
    return Settings()  # type: ignore[call-arg]
