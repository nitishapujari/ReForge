"""
ReForge — Configuration Constants.

Tunable parameters used across the application.
Centralised here to avoid hardcoded magic numbers.
"""

# --- Retrieval ---
DEFAULT_TOP_K: int = 5
EXPANDED_TOP_K: int = 10

# --- Chunking ---
CHUNK_SIZE: int = 1000
CHUNK_OVERLAP: int = 200

# --- LLM ---
DEFAULT_TEMPERATURE: float = 0.3
MAX_OUTPUT_TOKENS: int = 2048

# --- Self-Healing Loop ---
MAX_RETRIES: int = 3
CONFIDENCE_THRESHOLD: float = 0.7

# --- Embeddings ---
EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

# --- File Upload ---
ALLOWED_EXTENSIONS: set[str] = {".pdf", ".txt"}
MAX_FILE_SIZE_MB: int = 20
