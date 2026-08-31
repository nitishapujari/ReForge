"""
ReForge - LLM Service.

Provider-agnostic LLM wrapper supporting Gemini and Groq:
- Initialization and configuration
- Invoke with retry and error handling
- Temperature and token limit control
- Health check for connectivity validation
"""

import time
import json
from typing import Any, Callable

from google import genai
from google.genai import types
try:
    import groq
except ImportError:
    groq = None

from app.constants import DEFAULT_TEMPERATURE, MAX_OUTPUT_TOKENS
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Module-level singletons
_provider: str = "gemini"
_gemini_client: genai.Client | None = None
_gemini_model: str = ""
_groq_client: Any = None
_groq_model: str = ""


def init_llm(
    provider: str,
    gemini_api_key: str | None = None,
    gemini_model: str = "gemini-2.5-flash",
    groq_api_key: str | None = None,
    groq_model: str = "llama-3.3-70b-versatile",
) -> None:
    """
    Initialize the LLM clients.
    """
    global _provider, _gemini_client, _gemini_model, _groq_client, _groq_model

    _provider = provider.lower()
    _gemini_model = gemini_model
    _groq_model = groq_model

    if _provider == "gemini":
        if not gemini_api_key:
            raise ValueError("gemini_api_key is required when provider is gemini")
        _gemini_client = genai.Client(api_key=gemini_api_key)
        logger.info("Gemini LLM initialized: model=%s", _gemini_model)
    elif _provider == "groq":
        if not groq_api_key:
            raise ValueError("groq_api_key is required when provider is groq")
        _groq_client = groq.Groq(api_key=groq_api_key)
        logger.info("Groq LLM initialized: model=%s", _groq_model)
    else:
        raise ValueError(f"Unsupported LLM provider: {_provider}")


def get_model_name() -> str:
    """Get the configured model name for the active provider."""
    return _groq_model if _provider == "groq" else _gemini_model


def invoke(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
) -> str:
    if _provider == "groq":
        return _invoke_groq(prompt, system_instruction, temperature, max_output_tokens, max_retries)
    return _invoke_gemini(prompt, system_instruction, temperature, max_output_tokens, max_retries)


def invoke_stream(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
    on_retry: Callable[[], None] | None = None,
):
    if _provider == "groq":
        yield from _invoke_stream_groq(prompt, system_instruction, temperature, max_output_tokens, max_retries, on_retry)
    else:
        yield from _invoke_stream_gemini(prompt, system_instruction, temperature, max_output_tokens, max_retries, on_retry)


def invoke_structured(
    prompt: str,
    response_schema: type,
    system_instruction: str | None = None,
    temperature: float = 0.1,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
):
    if _provider == "groq":
        return _invoke_structured_groq(prompt, response_schema, system_instruction, temperature, max_output_tokens, max_retries)
    return _invoke_structured_gemini(prompt, response_schema, system_instruction, temperature, max_output_tokens, max_retries)


def check_health() -> bool:
    if _provider == "groq":
        return _check_health_groq()
    return _check_health_gemini()

# Gemini Implementation

def _get_gemini_client() -> genai.Client:
    if _gemini_client is None:
        raise RuntimeError("Gemini LLM not initialized. Call init_llm() first.")
    return _gemini_client

def _invoke_gemini(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
) -> str:
    client = _get_gemini_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    if system_instruction:
        config.system_instruction = system_instruction

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            start_time = time.monotonic()
            response = client.models.generate_content(
                model=_gemini_model,
                contents=prompt,
                config=config,
            )
            elapsed = time.monotonic() - start_time
            if response.text:
                logger.info("Gemini invocation successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return response.text
            logger.warning("Gemini returned empty text (attempt %d/%d)", attempt, max_retries)
            last_error = RuntimeError("Gemini returned empty response")
        except Exception as e:
            elapsed = time.monotonic() - start_time
            last_error = e
            logger.warning("Gemini invocation failed: attempt=%d/%d, latency=%.2fs, error=%s", attempt, max_retries, elapsed, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Gemini invocation failed after {max_retries} attempts: {last_error}")


def _invoke_stream_gemini(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
    on_retry: Callable[[], None] | None = None,
):
    client = _get_gemini_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    if system_instruction:
        config.system_instruction = system_instruction

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1 and on_retry:
                on_retry()
            
            start_time = time.monotonic()
            response_stream = client.models.generate_content_stream(
                model=_gemini_model,
                contents=prompt,
                config=config,
            )
            has_yielded = False
            for chunk in response_stream:
                if chunk.text:
                    has_yielded = True
                    yield chunk.text
                if chunk.candidates and chunk.candidates[0].finish_reason:
                    reason = chunk.candidates[0].finish_reason
                    if str(reason).endswith("MAX_TOKENS") or reason == "MAX_TOKENS":
                        raise TimeoutError("LLM response reached maximum token limit.")
            elapsed = time.monotonic() - start_time
            if has_yielded:
                logger.info("Gemini stream successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return
            logger.warning("Gemini stream returned empty text (attempt %d/%d)", attempt, max_retries)
            last_error = RuntimeError("Gemini stream returned empty response")
        except TimeoutError:
            raise
        except Exception as e:
            elapsed = time.monotonic() - start_time
            last_error = e
            logger.warning("Gemini stream failed: attempt=%d/%d, latency=%.2fs, error=%s", attempt, max_retries, elapsed, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Gemini stream failed after {max_retries} attempts: {last_error}")


def _invoke_structured_gemini(
    prompt: str,
    response_schema: type,
    system_instruction: str | None = None,
    temperature: float = 0.1,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
):
    client = _get_gemini_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens,
        response_mime_type="application/json",
        response_schema=response_schema,
    )
    if system_instruction:
        config.system_instruction = system_instruction

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            start_time = time.monotonic()
            response = client.models.generate_content(
                model=_gemini_model,
                contents=prompt,
                config=config,
            )
            elapsed = time.monotonic() - start_time
            if hasattr(response, "parsed") and response.parsed is not None:
                logger.info("Gemini structured successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return response.parsed
            
            if response.text:
                parsed_json = json.loads(response.text)
                parsed_response = response_schema.model_validate(parsed_json)
                logger.info("Gemini structured successful (manual parse): latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return parsed_response

            raise RuntimeError("Gemini returned empty response.")
        except Exception as e:
            last_error = e
            logger.warning("Gemini structured failed (attempt %d/%d): %s", attempt, max_retries, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Gemini structured failed after {max_retries} retries. Last error: {last_error}")


def _check_health_gemini() -> bool:
    try:
        if _gemini_client is None:
            return False
        model_info = _gemini_client.models.get(model=_gemini_model)
        return model_info is not None
    except Exception as e:
        logger.warning("Gemini health check failed: %s", e)
        return False


# Groq Implementation

def _get_groq_client() -> groq.Groq:
    if _groq_client is None:
        raise RuntimeError("Groq LLM not initialized. Call init_llm() first.")
    return _groq_client


def _build_groq_messages(prompt: str, system_instruction: str | None = None) -> list[dict[str, str]]:
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})
    return messages


def _invoke_groq(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
) -> str:
    client = _get_groq_client()
    messages = _build_groq_messages(prompt, system_instruction)
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            start_time = time.monotonic()
            response = client.chat.completions.create(
                model=_groq_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_output_tokens,
            )
            elapsed = time.monotonic() - start_time
            if response.choices and response.choices[0].message.content:
                logger.info("Groq invocation successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return response.choices[0].message.content
            
            logger.warning("Groq returned empty text (attempt %d/%d)", attempt, max_retries)
            last_error = RuntimeError("Groq returned empty response")
        except Exception as e:
            elapsed = time.monotonic() - start_time
            last_error = e
            logger.warning("Groq invocation failed: attempt=%d/%d, latency=%.2fs, error=%s", attempt, max_retries, elapsed, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Groq invocation failed after {max_retries} attempts: {last_error}")


def _invoke_stream_groq(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = DEFAULT_TEMPERATURE,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
    on_retry: Callable[[], None] | None = None,
):
    client = _get_groq_client()
    messages = _build_groq_messages(prompt, system_instruction)
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1 and on_retry:
                on_retry()
            
            start_time = time.monotonic()
            response_stream = client.chat.completions.create(
                model=_groq_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_output_tokens,
                stream=True,
            )
            has_yielded = False
            for chunk in response_stream:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    has_yielded = True
                    yield chunk.choices[0].delta.content
                if chunk.choices and chunk.choices[0].finish_reason in ("length", "max_tokens"):
                    raise TimeoutError("LLM response reached maximum token limit.")
            elapsed = time.monotonic() - start_time
            if has_yielded:
                logger.info("Groq stream successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return
            logger.warning("Groq stream returned empty text (attempt %d/%d)", attempt, max_retries)
            last_error = RuntimeError("Groq stream returned empty response")
        except TimeoutError:
            raise
        except Exception as e:
            elapsed = time.monotonic() - start_time
            last_error = e
            logger.warning("Groq stream failed: attempt=%d/%d, latency=%.2fs, error=%s", attempt, max_retries, elapsed, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Groq stream failed after {max_retries} attempts: {last_error}")


def _invoke_structured_groq(
    prompt: str,
    response_schema: type,
    system_instruction: str | None = None,
    temperature: float = 0.1,
    max_output_tokens: int = MAX_OUTPUT_TOKENS,
    max_retries: int = 3,
):
    client = _get_groq_client()
    
    # Instruct model to output JSON according to the schema
    schema_json = json.dumps(response_schema.model_json_schema(), indent=2)
    sys_instr = system_instruction or ""
    sys_instr += f"\n\nYou MUST reply in valid JSON format that adheres to the following JSON schema:\n{schema_json}\n"
    
    messages = _build_groq_messages(prompt, sys_instr)
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            start_time = time.monotonic()
            response = client.chat.completions.create(
                model=_groq_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_output_tokens,
                response_format={"type": "json_object"},
            )
            elapsed = time.monotonic() - start_time
            
            if response.choices and response.choices[0].message.content:
                text_content = response.choices[0].message.content
                parsed_json = json.loads(text_content)
                parsed_response = response_schema.model_validate(parsed_json)
                logger.info("Groq structured successful: latency=%.2fs, attempt=%d/%d", elapsed, attempt, max_retries)
                return parsed_response
                
            raise RuntimeError("Groq returned empty response.")
        except Exception as e:
            last_error = e
            logger.warning("Groq structured failed (attempt %d/%d): %s", attempt, max_retries, str(e))
            if attempt < max_retries:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Groq structured failed after {max_retries} retries. Last error: {last_error}")


def _check_health_groq() -> bool:
    try:
        if _groq_client is None:
            return False
        # Lightweight check for Groq
        models = _groq_client.models.list()
        return any(m.id == _groq_model for m in models.data)
    except Exception as e:
        logger.warning("Groq health check failed: %s", e)
        return False
