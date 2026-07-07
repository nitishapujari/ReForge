import os
import sys
import unittest.mock
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.main

# Create a mock LLM invoke function to simulate the self-healing loop
call_count = 0

def mock_invoke(prompt: str, system_instruction: str = None, **kwargs) -> str:
    if system_instruction and ("rephrase" in system_instruction.lower() or "rewrite" in system_instruction.lower()):
        return "When exactly was ReForge invented?"

    # Default generator response
    return "ReForge was invented in 2024 according to the context."

def mock_invoke_structured(prompt: str, response_schema: type, system_instruction: str = None, **kwargs):
    global call_count
    call_count += 1
    
    if system_instruction and ("evaluator" in system_instruction.lower() or "grading" in system_instruction.lower()):
        # First attempt: evaluate to ungrounded
        if call_count == 1:
            return response_schema(grounded=False, confidence=0.0, feedback="Not grounded", unsupported_claims=["ReForge"], missing_information=["The exact year"])
        # Second attempt: evaluate to grounded
        return response_schema(grounded=True, confidence=1.0, feedback="Grounded", unsupported_claims=[], missing_information=[])
    
    return response_schema(grounded=True, confidence=1.0, feedback="", unsupported_claims=[], missing_information=[])

def test_chat_endpoint_with_mock():
    print("\n--- Testing Chat API with Mocked LLM (Self-Healing Loop) ---")
    question = "What is the exact year ReForge was invented?"
    print(f"User Request: {question}")
    
    # Hard monkey-patch the LLM to survive cross-thread boundaries in TestClient
    import app.services.llm
    original_invoke = app.services.llm.invoke
    original_invoke_structured = app.services.llm.invoke_structured
    
    try:
        app.services.llm.invoke = mock_invoke
        app.services.llm.invoke_structured = mock_invoke_structured
        
        # We need to run the app using TestClient in a context manager to trigger lifespan events
        with TestClient(app.main.app) as client:
            response = client.post(
                "/api/v1/chat",
                json={"question": question}
            )
    finally:
        app.services.llm.invoke = original_invoke
        app.services.llm.invoke_structured = original_invoke_structured
    
    print(f"\nResponse Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Answer: {data.get('answer')}")
        print(f"Attempts: {data.get('attempts')}")
        print(f"Grounded: {data.get('grounded')}")
        print(f"Confidence: {data.get('confidence')}")
        print(f"Sources Count: {len(data.get('sources', []))}")
        print(f"Session ID: {data.get('session_id')}")
    else:
        print(f"Error: {response.text}")


if __name__ == "__main__":
    test_chat_endpoint_with_mock()
