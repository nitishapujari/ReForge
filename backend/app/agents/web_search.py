"""
ReForge — Web Search Node.

Performs a fallback web search using DuckDuckGo when internal documents lack
the necessary context to answer the user's question.
"""

import time
import json
from langchain_core.runnables import RunnableConfig
from duckduckgo_search import DDGS

from app.graph.state import GraphState, TraceEntry
from app.utils.logger import get_logger

logger = get_logger(__name__)


def web_search_node(state: GraphState, config: RunnableConfig | None = None) -> dict:
    """
    Web search node — performs a web search using DDGS.

    Reads from state:
        - question
        - retrieval_query

    Writes to state:
        - web_context
        - web_sources
        - trace
    """
    start_time = time.perf_counter()

    stream_callback = None
    if config and "configurable" in config:
        stream_callback = config["configurable"].get("stream_callback")

    query = state.get("retrieval_query") or state.get("question", "")

    if stream_callback:
        stream_callback({
            "type": "status", 
            "message": "🌐 Searching the web for additional context...", 
            "status": "warning"
        })

    logger.info("Executing web search for query: '%s'", query)
    
    web_context = []
    web_sources = []
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            
            for res in results:
                content = res.get("body", "")
                href = res.get("href", "")
                title = res.get("title", "")
                
                if content and href:
                    context_str = f"Source: {title} ({href})\nContent: {content}"
                    web_context.append(context_str)
                    
                    web_sources.append({
                        "id": href,
                        "title": title,
                        "url": href,
                        "snippet": content
                    })
                    
        logger.info("Web search returned %d results", len(web_sources))
    except Exception as e:
        logger.error("Web search failed: %s", e)
        if stream_callback:
            stream_callback({
                "type": "status", 
                "message": f"❌ Web search failed: {str(e)}", 
                "status": "error"
            })
            
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    trace_entry = TraceEntry(
        node="web_search",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=json.dumps({"query": query}),
        output_summary=json.dumps({"results_found": len(web_sources)}),
        attempt=state.get("attempts", 1),
        decision=None,
    )

    return {
        "web_context": web_context,
        "web_sources": web_sources,
        "trace": state.get("trace", []) + [trace_entry]
    }
