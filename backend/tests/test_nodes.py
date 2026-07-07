from app.graph.state import GraphState
from app.agents.decision import decision_node

def test_decision_node():
    print("Testing Decision Node:")
    
    # Test 1: Grounded and confident -> accept
    state1 = GraphState(grounded=True, confidence=0.9, attempts=1, max_attempts=3)
    res1 = decision_node(state1)
    print(f"  Test 1 (Grounded/Confident): Decision = {res1['decision']}")
    assert res1["decision"] == "accept"
    
    # Test 2: Missing information -> rewrite
    state2 = GraphState(grounded=False, confidence=0.0, missing_information=["Needs year"], attempts=1, max_attempts=3)
    res2 = decision_node(state2)
    print(f"  Test 2 (Missing Info): Decision = {res2['decision']}")
    assert res2["decision"] == "rewrite"
    
    # Test 3: Max attempts reached -> fail (or accept if somewhat grounded)
    state3 = GraphState(grounded=False, confidence=0.0, attempts=3, max_attempts=3)
    res3 = decision_node(state3)
    print(f"  Test 3 (Max Attempts Reached): Decision = {res3['decision']}")
    assert res3["decision"] == "fail"

    print("Decision Node passed!\n")

from app.agents.rewrite import rewrite_node
from app.services.llm import init_llm
from app.config import get_settings

def test_rewrite_node():
    print("Testing Rewrite Node:")
    settings = get_settings()
    init_llm(api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL)
    
    state = GraphState(
        question="What is the exact year ReForge was invented?",
        critic_feedback="The context does not contain the exact year ReForge was invented. It only mentions the 2020s.",
        attempts=1
    )
    
    res = rewrite_node(state)
    print(f"  Rewritten Question: '{res['rewritten_question']}'")
    assert res["rewritten_question"] != state["question"], "Question should be modified"
    
    print("Rewrite Node passed!\n")

if __name__ == "__main__":
    test_decision_node()
    test_rewrite_node()
