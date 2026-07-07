import asyncio
import json
import uuid
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models.database import get_db_session, Base
from app.models.chat import ChatMessage
from app.services import chat_history


def test_trace_api():
    with TestClient(app) as client:
        # 1. First, make a mocked chat request (using the existing chat endpoint)
        # Note: We won't use the mock here since we just want to inject trace_data manually
        # to test the Trace API endpoint in isolation.
        
        # Inject some fake data manually for testing the API
        import app.models.database as db_models
        
        async def inject_fake_trace():
            async for session in db_models.get_db_session():
                # create session
                chat_session = await chat_history.create_session(session, title="Test Trace")
                session_id = chat_session.id
                
                # create fake trace data
                fake_trace = [
                    {
                        "node": "retrieve",
                        "execution_time_ms": 150.0,
                        "input_summary": "Query: test",
                        "output_summary": "Found 3 docs",
                        "attempt": 1,
                        "decision": None
                    },
                    {
                        "node": "generate",
                        "execution_time_ms": 1200.0,
                        "input_summary": "Context and query",
                        "output_summary": "Generated answer",
                        "attempt": 1,
                        "decision": None
                    }
                ]
                
                # add message with trace
                await chat_history.add_message(
                    db=session,
                    session_id=session_id,
                    role="assistant",
                    content="Here is a trace.",
                    trace_data=fake_trace
                )
                
                await session.commit()
                return session_id

        # We must run the async function
        loop = asyncio.get_event_loop()
        session_id = loop.run_until_complete(inject_fake_trace())
        
        # 2. Call the trace API
        response = client.get(f"/api/v1/trace/{session_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        print("Trace API Response:", json.dumps(data, indent=2))
        
        assert data["session_id"] == session_id
        assert len(data["traces"]) == 1
        assert len(data["traces"][0]["trace_data"]) == 2
        
        print("\nSUCCESS: Trace API works correctly!")

if __name__ == "__main__":
    test_trace_api()
