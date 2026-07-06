"""
ReForge — Structured Logging.

Provides a configured logger factory for consistent, structured logging
across all modules. Log level is controlled via the LOG_LEVEL env var.
"""

import logging
import sys
from typing import Optional


# Module-level default; overridden by configure_logging()
_log_level: int = logging.INFO


def configure_logging(level: str = "INFO") -> None:
    """
    Configure the root logging for the application.

    Should be called once during app startup.

    Args:
        level: Log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).
    """
    global _log_level
    _log_level = getattr(logging, level.upper(), logging.INFO)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(_log_level)

    # Remove existing handlers to avoid duplicates on reload
    root_logger.handlers.clear()

    # Console handler with structured format
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(_log_level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get a named logger instance.

    Args:
        name: Logger name, typically __name__ of the calling module.

    Returns:
        Configured logger instance.
    """
    logger = logging.getLogger(name or "reforge")
    return logger
