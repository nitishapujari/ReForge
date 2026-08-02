"""
ReForge — Generator Agent Node (LangGraph).

LangGraph node that reads retrieved documents from state,
builds a context-enriched prompt, calls Gemini, and writes
the generated answer and source citations back to state.

This replaces the standalone generate_answer() function from
Phase 1 with a state-aware node for the self-healing graph.
"""

import time

from langchain_core.runnables.config import RunnableConfig

from app.graph.state import GraphState, TraceEntry
from app.models.schemas import SourceDocument
from app.prompts import (
    GENERATOR_SYSTEM_PROMPT,
    GENERATOR_USER_PROMPT,
    GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
    GENERAL_KNOWLEDGE_USER_PROMPT,
    NO_DOCUMENTS_RESPONSE,
    NO_RELEVANT_DOCS_RESPONSE,
)
from app.services import llm
from app.utils.logger import get_logger

logger = get_logger(__name__)

from app.constants import RELEVANCE_THRESHOLD, RELATIVE_MARGIN, MAX_CONTEXT_CHUNKS
from app.config import get_settings
from app.models.schemas import SourceDocument, ChunkPreview

def generate_node(state: GraphState, config: RunnableConfig | None = None) -> dict:
    """
    Generator node — builds context from retrieved docs and generates an answer.
    """
    stream_callback = None
    if config and "configurable" in config:
        stream_callback = config["configurable"].get("stream_callback")
        
    if stream_callback:
        stream_callback({"type": "status", "message": "📝 Drafting response...", "status": "info"})
        
    settings = get_settings()
    evidence_threshold = settings.EVIDENCE_THRESHOLD

    start_time = time.perf_counter()

    question = state["question"]
    docs = state.get("retrieved_docs", [])
    metas = state.get("retrieved_metadatas", [])
    scores = state.get("similarity_scores", [])
    attempt = state.get("attempts", 1)

    web_context_list = state.get("web_context", [])
    
    # Handle empty retrieval results
    if not docs and not web_context_list:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info("No retrieved docs and no web context — falling back to general knowledge")

        trace_entry = TraceEntry(
            node="generate",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"question='{question[:60]}', docs=0",
            output_summary="fallback: generated from general knowledge",
            attempt=attempt,
            decision=None,
            retrieval_diagnostics=[],
        )

        chat_history = state.get("chat_history", [])
        history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history]) if chat_history else "No previous conversation history."
        
        user_prompt = GENERAL_KNOWLEDGE_USER_PROMPT.format(
            history=history_str,
            question=question,
        )

        if stream_callback:
            logger.info("Using streaming LLM invocation for general knowledge fallback")
            stream_callback({"type": "clear"})
            chunks = []
            for chunk in llm.invoke_stream(
                prompt=user_prompt,
                system_instruction=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
            ):
                chunks.append(chunk)
                stream_callback({"type": "token", "content": chunk})
            answer = "".join(chunks)
        else:
            answer = llm.invoke(
                prompt=user_prompt,
                system_instruction=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
            )

        return {
            "answer": answer,
            "sources": [],
            "trace": state.get("trace", []) + [trace_entry],
        }

    # 1. Group chunks by document and apply overlap suppression
    from collections import defaultdict
    
    def is_overlapping(text1: str, text2: str, threshold: float = 0.7) -> bool:
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        if not words1 or not words2:
            return False
        return len(words1.intersection(words2)) / len(words1.union(words2)) > threshold

    doc_groups = defaultdict(list)
    for doc, meta, score in zip(docs, metas, scores):
        filename = meta.get("filename", "unknown")
        
        is_dup = False
        for i, existing in enumerate(doc_groups[filename]):
            if is_overlapping(doc, existing["doc"]):
                is_dup = True
                # Keep the strongest scoring chunk
                if score > existing["score"]:
                    doc_groups[filename][i] = {"doc": doc, "meta": meta, "score": score}
                break
                
        if not is_dup:
            doc_groups[filename].append({"doc": doc, "meta": meta, "score": score})

    # 2. Compute aggregate metrics for each document
    aggregated_docs = []
    diagnostics = []
    
    for filename, chunks in doc_groups.items():
        chunk_scores = [c["score"] for c in chunks]
        max_score = max(chunk_scores)
        avg_score = sum(chunk_scores) / len(chunk_scores)
        chunk_count = len(chunks)
        
        doc_entry = {
            "filename": filename,
            "max_score": max_score,
            "avg_score": avg_score,
            "chunk_count": chunk_count,
            "chunks": chunks,
            "document_score": max_score
        }
        
        diag = {
            "filename": filename,
            "score": max_score, # Use document score for trace
            "chunk_count": chunk_count,
            "avg_score": avg_score,
            "included": False,
            "reason": ""
        }
        
        # Absolute threshold
        if max_score < RELEVANCE_THRESHOLD:
            diag["reason"] = f"Max score below absolute threshold ({max_score:.2f} < {RELEVANCE_THRESHOLD})"
            diagnostics.append(diag)
            continue
            
        # Minimum evidence check: single weak hit
        if chunk_count == 1 and max_score < evidence_threshold:
            diag["reason"] = f"Insufficient evidence: single weak match ({max_score:.2f} < {evidence_threshold})"
            diagnostics.append(diag)
            continue
            
        aggregated_docs.append((doc_entry, diag))

    # 3. Sort documents by (max_score, chunk_count) to prioritize actual relevance
    aggregated_docs.sort(key=lambda x: (x[0]["max_score"], x[0]["chunk_count"]), reverse=True)

    # 4. Apply dynamic relative margin based on the best document
    best_doc_score = aggregated_docs[0][0]["document_score"] if aggregated_docs else 0.0
    dynamic_threshold = max(RELEVANCE_THRESHOLD, best_doc_score - RELATIVE_MARGIN)

    ranked_docs = []
    for doc_entry, diag in aggregated_docs:
        if doc_entry["document_score"] < dynamic_threshold:
            diag["reason"] = f"Below dynamic relative threshold ({doc_entry['document_score']:.2f} < {dynamic_threshold:.2f})"
        else:
            diag["included"] = True
            diag["reason"] = "Passed all filters"
            ranked_docs.append(doc_entry)
        diagnostics.append(diag)

    # 5. Cap to MAX_CONTEXT_CHUNKS and build context arrays
    context_parts = []
    flat_sources = []
    
    total_chunks = 0
    for doc_entry in ranked_docs:
        # Sort chunks internally descending by score
        doc_entry["chunks"].sort(key=lambda x: x["score"], reverse=True)
        
        for c in doc_entry["chunks"]:
            # Bypass limit if this is a document operation (e.g. summarize)
            is_doc_op = state.get("retrieval_intent") == "DOCUMENT_OPERATION"
            if not is_doc_op and total_chunks >= MAX_CONTEXT_CHUNKS:
                break
            
            total_chunks += 1
            
            preview = c["doc"][:200] + "..." if len(c["doc"]) > 200 else c["doc"]
            source_doc = SourceDocument(
                filename=doc_entry["filename"],
                document_score=c["score"],
                chunks=[
                    ChunkPreview(
                        chunk_number=c["meta"].get("chunk_number"),
                        page_number=c["meta"].get("page_number"),
                        content_preview=preview,
                        similarity_score=c["score"]
                    )
                ]
            )
            flat_sources.append(source_doc)
            source_idx = len(flat_sources)
            context_parts.append(
                f"[Source {source_idx}: {doc_entry['filename']}]\n{c['doc']}"
            )
        if not is_doc_op and total_chunks >= MAX_CONTEXT_CHUNKS:
            break
    grouped_sources = flat_sources

    if not grouped_sources and not web_context_list:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "No docs passed filters (best=%.2f, absolute=%.2f) and no web context — fallback",
            best_doc_score,
            RELEVANCE_THRESHOLD,
        )

        trace_entry = TraceEntry(
            node="generate",
            execution_time_ms=round(elapsed_ms, 2),
            input_summary=f"question='{question[:60]}', docs={len(docs)}",
            output_summary="fallback: generated from general knowledge",
            attempt=attempt,
            decision=None,
            retrieval_diagnostics=diagnostics,
        )

        chat_history = state.get("chat_history", [])
        history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history]) if chat_history else "No previous conversation history."
        
        user_prompt = GENERAL_KNOWLEDGE_USER_PROMPT.format(
            history=history_str,
            question=question,
        )

        if stream_callback:
            logger.info("Using streaming LLM invocation for general knowledge fallback")
            stream_callback({"type": "clear"})
            chunks = []
            for chunk in llm.invoke_stream(
                prompt=user_prompt,
                system_instruction=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
            ):
                chunks.append(chunk)
                stream_callback({"type": "token", "content": chunk})
            answer = "".join(chunks)
        else:
            answer = llm.invoke(
                prompt=user_prompt,
                system_instruction=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
            )

        return {
            "answer": answer,
            "sources": [],
            "trace": state.get("trace", []) + [trace_entry],
        }

    # context_parts is already built above alongside grouped_sources
    context = "\n\n---\n\n".join(context_parts)
    
    web_context_list = state.get("web_context", [])
    web_context = "\n\n---\n\n".join(web_context_list) if web_context_list else "No web search context available."

    # Build prompt and call LLM
    chat_history = state.get("chat_history", [])
    history_str = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in chat_history]) if chat_history else "No previous conversation history."
    
    user_prompt = GENERATOR_USER_PROMPT.format(
        history=history_str,
        context=context,
        web_context=web_context,
        question=question,
    )

    logger.info(
        "Generating answer: question='%s', context_docs=%d, best_score=%.4f",
        question[:80],
        len(grouped_sources),
        grouped_sources[0].document_score if grouped_sources else 0.0,
    )

    if stream_callback:
        logger.info("Using streaming LLM invocation")
        # Emit a clear event at the start of generation to handle retries
        stream_callback({"type": "clear"})
        chunks = []
        for chunk in llm.invoke_stream(
            prompt=user_prompt,
            system_instruction=GENERATOR_SYSTEM_PROMPT,
        ):
            chunks.append(chunk)
            stream_callback({"type": "token", "content": chunk})
        answer = "".join(chunks)
    else:
        answer = llm.invoke(
            prompt=user_prompt,
            system_instruction=GENERATOR_SYSTEM_PROMPT,
        )

    # Use all grouped sources that passed the relevance threshold
    sources = grouped_sources
    
    web_sources_list = state.get("web_sources", [])
    for ws in web_sources_list:
        web_src = SourceDocument(
            filename=ws["url"],
            document_score=1.0,
            chunks=[
                ChunkPreview(
                    chunk_number=None,
                    page_number=None,
                    content_preview=ws["snippet"][:200] + ("..." if len(ws["snippet"]) > 200 else ""),
                    similarity_score=1.0
                )
            ]
        )
        sources.append(web_src)

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "Answer generated: sources=%d, time=%.1fms",
        len(sources),
        elapsed_ms,
    )

    import json
    trace_entry = TraceEntry(
        node="generate",
        execution_time_ms=round(elapsed_ms, 2),
        input_summary=json.dumps({"question": question, "context_docs": len(grouped_sources)}),
        output_summary=json.dumps({
            "generation_time": round(elapsed_ms / 1000.0, 2),
            "preview": answer[:200].strip() + ("..." if len(answer) > 200 else "")
        }),
        attempt=attempt,
        decision=None,
        retrieval_diagnostics=diagnostics,
    )

    return {
        "answer": answer,
        "sources": sources,
        "trace": state.get("trace", []) + [trace_entry],
    }
