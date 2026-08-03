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
            r"^\s*(hi|hello|hey|yo|gm|morning|good morning|what's up|how's it going|greetings)[\s\!\?\.\,]*$",
            r"^\s*(thanks|thank you|appreciate it|cheers|awesome|great work|good job)[\s\!\?\.\,]*$",
            r"^\s*(bye|goodbye|cya|take care|see you|good night)[\s\!\?\.\,]*$",
        ]
        self.compiled_fast_patterns = [re.compile(p, re.IGNORECASE) for p in fast_patterns]

    async def classify(self, query: str, chat_history_data: list[dict] = None, document_ids: list[str] = None) -> Intent:
        """Classify the incoming query into an Intent using a layered approach."""
        # Stage 1: Fast Path Regex Optimization
        for pattern in self.compiled_fast_patterns:
            if pattern.match(query):
                logger.info("Router [Stage 1]: Regex match, returning CONVERSATION")
                return Intent.CONVERSATION
                    
        # Stage 2: Strict Binary Classification via LLM
        history_str = ""
        if chat_history_data:
            history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history_data])
            
        doc_context = ""
        if document_ids and len(document_ids) > 0:
            doc_context = "The user has explicitly attached documents to this query, indicating they likely want to search them, unless this is purely a greeting.\n"

        prompt = (
            f"You are an intent classifier.\n\n"
            f"## Conversation History\n"
            f"{history_str if history_str else 'No previous conversation.'}\n\n"
            f"{doc_context}"
            f"## Current User Message\n"
            f"'{query}'\n\n"
            f"Classify the Current User Message as either 'CONVERSATION' or 'KNOWLEDGE_QUERY'.\n"
            f"- 'CONVERSATION': Greetings, thanks, farewells, casual chat, small talk, jokes, and purely opinion-based questions (e.g. 'What is your opinion on Python?').\n"
            f"- 'KNOWLEDGE_QUERY': Asking for facts, information, data, summarization, or questions to be answered. Follow-up questions related to previous document-grounded responses MUST remain KNOWLEDGE_QUERY and never bypass retrieval.\n"
            f"Return only the exact category name."
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
