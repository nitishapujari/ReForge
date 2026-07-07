import os
import sys
import unittest.mock
from fastapi.testclient import TestClient
import json

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.main

call_count = 0

def mock_invoke(prompt: str, system_instruction: str = None, **kwargs) -> str:
    if system_instruction and ("rephrase" in system_instruction.lower() or "rewrite" in system_instruction.lower()):
        return "When exactly was ReForge invented?"
    return "ReForge was invented in 2024 according to the context."

def mock_invoke_stream(prompt: str, system_instruction: str = None, **kwargs):
    text = "ReForge was invented in 2024 according to the context."
    words = text.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")

def mock_invoke_structured(prompt: str, response_schema: type, system_instruction: str = None, **kwargs):
    global call_count
    call_count += 1
    
    if system_instruction and ("evaluator" in system_instruction.lower() or "grading" in system_instruction.lower()):
        if call_count == 1:
            return response_schema(grounded=False, confidence=0.0, feedback="Not grounded", unsupported_claims=["ReForge"], missing_information=["The exact year"])
        return response_schema(grounded=True, confidence=1.0, feedback="Grounded", unsupported_claims=[], missing_information=[])
    
    return response_schema(grounded=True, confidence=1.0, feedback="", unsupported_claims=[], missing_information=[])


def test_chat_stream_endpoint_with_mock():
    print("\n--- Testing Chat API Stream with Mocked LLM ---")
    question = "What is the exact year ReForge was invented?"
    print(f"User Request: {question}")
    
    # Hard monkey-patch the LLM
    import app.services.llm
    original_invoke = app.services.llm.invoke
    original_invoke_stream = app.services.llm.invoke_stream
    original_invoke_structured = app.services.llm.invoke_structured
    
    try:
        app.services.llm.invoke = mock_invoke
        app.services.llm.invoke_stream = mock_invoke_stream
        app.services.llm.invoke_structured = mock_invoke_structured
        
        with TestClient(app.main.app) as client:
            # We must stream the response manually with TestClient
            with client.stream("POST", "/api/v1/chat/stream", json={"question": question}) as response:
                print(f"\nResponse Status: {response.status_code}")
                for line in response.iter_lines():
                    if line:
                        print(line)
    finally:
        app.services.llm.invoke = original_invoke
        app.services.llm.invoke_stream = original_invoke_stream
        app.services.llm.invoke_structured = original_invoke_structured


if __name__ == "__main__":
    test_chat_stream_endpoint_with_mock()
