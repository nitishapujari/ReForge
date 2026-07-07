"""
ReForge — LLM Service.

Dedicated Gemini client wrapper providing:
- Initialization and configuration
- Invoke with retry and error handling
- Temperature and token limit control
- Health check for connectivity validation
"""

import time

from google import genai
from google.genai import types

from app.constants import DEFAULT_TEMPERATURE, MAX_OUTPUT_TOKENS
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Module-level singleton
_client: genai.Client | None = None
_model_name: str = ""


def init_llm(api_key: str, model: str) -> None:
    """
    Initialize the Gemini LLM client.

    Args:
        api_key: Google Gemini API key.
        model: Model name (e.g., 'gemini-2.5-flash').
    """
    global _client, _model_name

    _client = genai.Client(api_key=api_key)
    _model_name = model

    logger.info("Gemini LLM initialized: model=%s", model)


def get_client() -> genai.Client:
    """
    Get the initialized Gemini client.

    Returns:
        The Gemini client instance.

    Raises:
        RuntimeError: If the LLM has not been initialized.
    """
    if _client is None:
        raise RuntimeError("LLM not initialized. Call init_llm() first.")
    return _client


def get_model_name() -> str:
    """Get the configured model name."""
    return _model_name


def invoke(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
) -> str:
    """
    Invoke the Gemini LLM with retry logic.

    Args:
        prompt: The user/input prompt text.
        system_instruction: Optional system instruction for the model.
        temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative).
        max_output_tokens: Maximum tokens in the response.
        max_retries: Number of retry attempts on failure.

    Returns:
        The generated text response.

    Raises:
        RuntimeError: If all retries are exhausted.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )

    if system_instruction:
        config.system_instruction = system_instruction

    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            start_time = time.monotonic()

            response = client.models.generate_content(
                model=_model_name,
                contents=prompt,
                config=config,
            )

            elapsed = time.monotonic() - start_time

            # Extract text from response
            if response.text:
                logger.info(
                    "LLM invocation successful: model=%s, latency=%.2fs, "
                    "attempt=%d/%d",
                    _model_name,
                    elapsed,
                    attempt,
                    max_retries,
                )
                return response.text

            # Response exists but no text
            logger.warning(
                "LLM returned empty text: model=%s, attempt=%d/%d",
                _model_name,
                attempt,
                max_retries,
            )
            last_error = RuntimeError("LLM returned empty response")

        except Exception as e:
            elapsed = time.monotonic() - start_time
            last_error = e
            logger.warning(
                "LLM invocation failed: model=%s, attempt=%d/%d, "
                "latency=%.2fs, error=%s",
                _model_name,
                attempt,
                max_retries,
                elapsed,
                str(e),
            )

            # Exponential backoff before retry
            if attempt < max_retries:
                backoff = 2 ** (attempt - 1)
                logger.info("Retrying in %ds...", backoff)
                time.sleep(backoff)

    raise RuntimeError(
        f"LLM invocation failed after {max_retries} attempts: {last_error}"
    )


def check_health() -> bool:
    """
    Check if the Gemini LLM is accessible.

    Uses a lightweight model metadata fetch (models.get) instead of
    a test generation call. This avoids token costs, rate limits,
    and model-specific prompt issues.

    Returns:
        True if the model is accessible, False otherwise.
    """
    try:
        if _client is None:
            logger.warning("LLM health check failed: client not initialized")
            return False

        # Lightweight metadata fetch — no tokens consumed
        model_info = _client.models.get(model=_model_name)
        is_healthy = model_info is not None
        if is_healthy:
            logger.debug(
                "LLM health check passed: model=%s", _model_name
            )
        return is_healthy
    except Exception as e:
        logger.warning(
            "LLM health check failed: [%s] %s",
            type(e).__name__,
            str(e),
        )
        return False
