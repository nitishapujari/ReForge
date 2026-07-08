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

    # --- LLM ---
    GEMINI_API_KEY: str  # Required — app will fail fast if missing
    GEMINI_MODEL: str = "gemini-2.5-flash"
    USE_MOCK_LLM: bool = False

    # --- ChromaDB ---
    CHROMA_PERSIST_DIR: str = "storage/chromadb"
    CHROMA_COLLECTION_NAME: str = "reforge_documents"

    # --- Database ---
    DATABASE_URL: str = "sqlite+aiosqlite:///storage/reforge.db"

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    # --- LangSmith (Optional) ---
    LANGSMITH_API_KEY: str | None = None
    LANGSMITH_PROJECT: str = "reforge"

    # --- Server ---
    APP_TITLE: str = "ReForge API"
    APP_DESCRIPTION: str = "The Self-Healing RAG Pipeline"
    APP_VERSION: str = "0.1.0"

    @property
    def chroma_persist_path(self) -> Path:
        """Resolved absolute path for ChromaDB persistence."""
        path = Path(self.CHROMA_PERSIST_DIR)
        if not path.is_absolute():
            path = _BACKEND_DIR / path
        return path

    @property
    def database_path(self) -> Path:
        """Resolved absolute path for the SQLite database."""
        # Extract path from sqlite URL (after `///`)
        db_path_str = self.DATABASE_URL.split("///", 1)[-1]
        path = Path(db_path_str)
        if not path.is_absolute():
            path = _BACKEND_DIR / path
        return path


def get_settings() -> Settings:
    """
    Create and return application settings.

    Raises:
        ValidationError: If required settings (e.g., GEMINI_API_KEY) are missing.
    """
    return Settings()  # type: ignore[call-arg]
