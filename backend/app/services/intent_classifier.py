"""
ReForge — Intent Classifier.

Lightweight rule-based intent classification for routing
between semantic retrieval and document-level operations.
"""

import re
from enum import Enum

class RetrievalIntent(Enum):
    SEMANTIC = "semantic"
    DOCUMENT_OPERATION = "document_operation"

def classify_retrieval_intent(query: str) -> RetrievalIntent:
    """
    Determine if the query is a document-level operation (summarize, overview, etc.)
    or a standard semantic question.
    """
    patterns = [
        r"\bsummaris[e|ing]\b",
        r"\bsummariz[e|ing]\b",
        r"\boverview\b",
        r"\bkey points\b",
        r"\btl;dr\b",
        r"\bexplain this document\b",
        r"\bsummary\b"
    ]
    
    query_lower = query.lower()
    
    for pattern in patterns:
        if re.search(pattern, query_lower):
            return RetrievalIntent.DOCUMENT_OPERATION
            
    return RetrievalIntent.SEMANTIC
