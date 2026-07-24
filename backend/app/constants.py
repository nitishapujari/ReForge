"""
ReForge — Configuration Constants.

Tunable parameters used across the application.
Centralised here to avoid hardcoded magic numbers.
"""

DEFAULT_TOP_K: int = 15
MAX_CONTEXT_CHUNKS: int = 5
RELATIVE_MARGIN: float = 0.05
EXPANDED_TOP_K: int = 20
RELEVANCE_THRESHOLD: float = 0.50
STRONG_MATCH_THRESHOLD: float = 0.65

CHUNK_SIZE: int = 1000
CHUNK_OVERLAP: int = 200

DEFAULT_TEMPERATURE: float = 0.3
MAX_OUTPUT_TOKENS: int = 2048

MAX_RETRIES: int = 3
CONFIDENCE_THRESHOLD: float = 0.7

EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

ALLOWED_EXTENSIONS: set[str] = {".pdf", ".txt", ".docx", ".csv", ".md", ".png", ".jpg"}
MAX_FILE_SIZE_MB: int = 20
