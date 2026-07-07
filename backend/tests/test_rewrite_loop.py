import json
import urllib.request
import asyncio
from unittest.mock import patch

from app.config import get_settings
from app.graph import compile_graph, get_initial_state
from app.models.database import init_db
from app.services.vectorstore import init_vectorstore
from app.agents.critic import CriticEvaluation

async def init_services():
    settings = get_settings()
    init_vectorstore(
        persist_dir=str(settings.chroma_persist_path),
        collection_name=settings.CHROMA_COLLECTION_NAME,
    )
    await init_db(settings.DATABASE_URL, settings.database_path)

# Stateful mock for the critic to fail first, then pass
critic_call_count = 0

def mock_invoke_structured(*args, **kwargs):
    global critic_call_count
    critic_call_count += 1
    if critic_call_count == 1:
        return CriticEvaluation(
            grounded=False,
            confidence=0.0,
            feedback="The context does not contain the exact year.",
            unsupported_claims=[],
            missing_information=["exact year"]
        )
    else:
        return CriticEvaluation(
            grounded=True,
            confidence=1.0,
            feedback="The answer is now fully grounded.",
            unsupported_claims=[],
            missing_information=[]
        )

def mock_invoke(*args, **kwargs):
    prompt = kwargs.get("prompt", "")
    system = kwargs.get("system_instruction", "")
    # If the system prompt is for rewriting, act like the rewrite node
    if "Rewrite" in system or "rewrite" in system.lower():
        return "When exactly was ReForge invented?"
    # Otherwise act like the generator
    return "ReForge was invented in 2024, according to the documents."

@patch("app.agents.critic.llm.invoke_structured", side_effect=mock_invoke_structured)
@patch("app.agents.generator.llm.invoke", side_effect=mock_invoke)
@patch("app.agents.rewrite.llm.invoke", side_effect=mock_invoke)
def test_rewrite_loop(mock_rewrite, mock_generate, mock_critic):
    print("Initializing services...")
    asyncio.run(init_services())
    
    compiled = compile_graph()
    
    print("\n--- Testing Self-Healing Loop (Rewrite) ---")
    print("Question: 'What is the exact year ReForge was invented?'")
    print("This should trigger a rewrite because the context doesn't contain this info.\n")
    
    state = get_initial_state(question="What is the exact year ReForge was invented?", session_id="test-rewrite-loop")
    
    result = compiled.invoke(state)
    
    print(f"Attempts: {result['attempts']}")
    print(f"Final Decision: {result['decision']}")
    print(f"Rewritten Question: {result.get('rewritten_question')}")
    print("\nTrace entries:")
    for t in result["trace"]:
        print(f"  - {t['node']}: {t['output_summary']} ({t['execution_time_ms']:.1f}ms)")
        
if __name__ == "__main__":
    test_rewrite_loop()
