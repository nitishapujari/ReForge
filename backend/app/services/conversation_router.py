import re
import asyncio
from enum import Enum, auto
from pydantic import BaseModel, Field

from app.services.llm import invoke_structured
from app.utils.logger import get_logger

logger = get_logger(__name__)

class Intent(Enum):
    CONVERSATION = auto()
    KNOWLEDGE_QUERY = auto()

class LLMIntentClassification(BaseModel):
    intent: str = Field(..., description="Must be 'CONVERSATION' or 'KNOWLEDGE_QUERY'")

class ConversationRouter:
    """
    Semantic router for classifying user intents before RAG execution.
    """
    
    def __init__(self):
        # Stage 1: Fast path regexes for extremely common inputs (optimization only)
        # We only catch obvious one-word or very short greetings to save LLM calls.
        fast_patterns = [
            r"^\s*(hi|hello|hey|yo|gm|morning|good morning|what's up|how's it going)\s*$",
            r"^\s*(thanks|thank you|appreciate it|cheers)\s*$",
            r"^\s*(bye|goodbye|cya|take care|see you|good night)\s*$",
        ]
        self.compiled_fast_patterns = [re.compile(p, re.IGNORECASE) for p in fast_patterns]

    async def classify(self, query: str) -> Intent:
        """Classify the incoming query into an Intent using a layered approach."""
        # Stage 1: Fast Path Regex Optimization
        for pattern in self.compiled_fast_patterns:
            if pattern.match(query):
                logger.info("Router [Stage 1]: Regex match, returning CONVERSATION")
                return Intent.CONVERSATION
                    
        # Stage 2: Strict Binary Classification via LLM
        prompt = (
            f"You are an intent classifier. The user said: '{query}'.\n"
            "Classify this as either 'CONVERSATION' (greetings, thanks, farewells, casual chat, small talk, jokes, opinions) "
            "or 'KNOWLEDGE_QUERY' (asking for facts, information, data, summarization, or questions to be answered).\n"
            "Return only the exact category name."
        )
        
        try:
            result = await asyncio.to_thread(
                invoke_structured,
                prompt=prompt,
                response_schema=LLMIntentClassification,
                system_instruction="You are a strict intent classifier. You never generate conversational replies.",
            )
            
            if result.intent == "CONVERSATION":
                logger.info("Router [Stage 2]: LLM classified as CONVERSATION.")
                return Intent.CONVERSATION
            else:
                logger.info("Router [Stage 2]: LLM classified as KNOWLEDGE_QUERY.")
                return Intent.KNOWLEDGE_QUERY
                
        except Exception as e:
            logger.error("Router [Stage 2]: LLM classification failed: %s", str(e))
            logger.info("Router [Fallback]: Defaulting to KNOWLEDGE_QUERY")
            return Intent.KNOWLEDGE_QUERY

# Global singleton router
router = ConversationRouter()
