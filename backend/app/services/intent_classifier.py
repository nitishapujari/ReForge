"""
ReForge — Intent Classifier.

Lightweight rule-based intent classification for routing
between semantic retrieval and document-level operations.
"""

import re
from enum import Enum

class RetrievalIntent(Enum):
    SEMANTIC_SINGLE = "semantic_single"
    SEMANTIC_GLOBAL = "semantic_global"
    DOCUMENT_OPERATION = "document_operation"

def classify_retrieval_intent(query: str, document_ids: list[str] = None) -> RetrievalIntent:
    """
    Determine if the query is a document-level operation (summarize, overview, etc.)
    or a standard semantic question, and factor in document attachment state.
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
            
    if document_ids and len(document_ids) > 0:
        return RetrievalIntent.SEMANTIC_SINGLE
    
    return RetrievalIntent.SEMANTIC_GLOBAL
