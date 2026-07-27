"""
ReForge — Application Configuration.

Centralized settings loaded from environment variables via .env file.
Uses pydantic-settings for validation and type coercion.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


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

    EMBEDDING_PROVIDER: str = "gemini"  # 'gemini' or 'onnx'
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"

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

    CHROMA_MODE: str = "http"  # 'http' or 'persistent'
    CHROMA_HOST: str = "chroma"
    CHROMA_PORT: int = 8000
    CHROMA_PERSIST_DIR: str = "storage/chromadb"
    CHROMA_COLLECTION_NAME: str = "reforge_documents"

    DATABASE_URL: str
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql://", 1)
            if v.startswith("postgresql://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if not v:
            raise ValueError("DATABASE_URL is required in the environment.")
        return v
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    LOG_LEVEL: str = "INFO"

    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "reforge"

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"

    APP_TITLE: str = "ReForge API"
    APP_DESCRIPTION: str = "The Self-Healing RAG Pipeline"
    APP_VERSION: str = "0.1.0"
    
    EVIDENCE_THRESHOLD: float = 0.50




def get_settings() -> Settings:
    """
    Create and return application settings.

    Raises:
        ValidationError: If required settings (e.g., GEMINI_API_KEY) are missing.
    """
    return Settings()  # type: ignore[call-arg]
