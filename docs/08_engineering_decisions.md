# Engineering Decisions

ReForge was designed with several deliberate architectural tradeoffs aimed at creating a robust, reliable application. This document outlines *why* these decisions were made.

## Why LangGraph over standard LangChain?
**The Problem:** Traditional RAG pipelines operate on a linear, chained architecture (Retrieve -> Prompt -> Generate). If the retrieval step fails to pull relevant context, the final generation will inevitably fail or hallucinate.
**The Decision:** We chose LangGraph to orchestrate the AI workflow as a state machine.
**The Why:** ReForge requires iterative reasoning where the system must critique its own responses and conditionally retry retrieval with rewritten queries. LangGraph naturally models cyclic workflows and state transitions, allowing the application to loop back and try again. This fundamentally shifts the architecture from "fire and forget" to an autonomous, self-correcting agent loop.

## Why bypass the Vercel Proxy for Document Uploads?
**The Problem:** Next.js API routes deployed on Vercel have a strict 4.5MB payload limit. Uploading large PDFs or CSV files through the standard frontend proxy resulted in HTTP 413 (Payload Too Large) errors.
**The Decision:** Implement direct browser-to-backend uploads exclusively for document ingestion.
**The Why:** Instead of migrating off Vercel or paying for a higher-tier enterprise plan, the frontend was refactored to send the FormData and JWT directly to the Render-hosted FastAPI server. This required carefully configuring CORS and Content Security Policies (CSP), but it preserved the benefits of Vercel's edge network for the rest of the application while completely removing file size bottlenecks.

## Why SQLite + ChromaDB (Local)?
**The Problem:** Managing cloud databases (PostgreSQL, Pinecone) during early development introduces significant network latency, deployment overhead, and complex credential management.
**The Decision:** Use SQLite (via SQLAlchemy) for relational data and ChromaDB in persistent mode for vector storage.
**The Why:** Both databases can be written directly to the local filesystem. By attaching a persistent disk volume to the Render backend service, we achieve persistent state across container restarts with minimal operational overhead. This drastically accelerates local development and simplifies the CI/CD pipeline while remaining easy to swap out for PostgreSQL/Pinecone in the future due to the ORM abstractions.

## Why Server-Sent Events (SSE) for Chat?
**The Problem:** AI generation, especially with self-healing iterations, can take several seconds. Waiting for a single JSON response causes the UI to feel unresponsive and broken.
**The Decision:** Use FastAPI's StreamingResponse with Server-Sent Events (SSE).
**The Why:** SSE allows the backend to yield verification logs (e.g., "Retrieving context...", "Critiquing answer...") and token chunks instantly as they are generated. This provides immediate visual feedback to the user, masking the latency of complex LangGraph reasoning cycles and creating a premium user experience.
