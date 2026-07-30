# Features

ReForge provides a robust set of features organized into distinct functional areas.

## Core Features
- **Stateful Chat:** Persistent conversation histories stored in SQLite.
- **Verification Logs:** Real-time visibility into the LangGraph workflow, showing exactly which agents are invoked, what context was retrieved, and the rationale behind each response.
- **RESTful API:** A fully documented backend API for integrating the RAG pipeline into external systems.

## AI Features
- **Self-Healing RAG Pipeline:** Automatically detects poor retrievals and reformulates queries for better results.
- **Hallucination Detection:** Built-in safeguards designed to improve the grounding of the LLM's responses in the provided document context.
- **Multi-step Reasoning:** Uses a graph-based state machine to evaluate, critique, and route tasks intelligently.

## Document Processing
- **Direct-to-Backend Uploads:** Bypasses standard Next.js payload limits to support large document uploads natively.
- **Automated Text Extraction:** Parses and cleans text from multiple document formats.
- **Semantic Chunking & Embeddings:** Chunks large documents and generates vector embeddings via the Gemini API, stored locally in ChromaDB.

## User Experience
- **Real-Time Progress Tracking:** Granular upload states (Extracting text, Generating embeddings, Indexing document) for immediate user feedback.
- **Friendly Error Handling:** Intercepts technical API errors and maps them to clean, understandable UI notifications (e.g., quota limits, network issues).
- **Responsive UI:** A modern, visually stunning frontend built with Tailwind CSS and Framer Motion for smooth micro-animations.

## Security
- **JWT Authentication:** NextAuth-backed secure session management.
- **CORS & CSP Hardening:** Strict Content Security Policies and precise CORS configurations protecting the backend API from unauthorized origins.
- **Sanitized Error Messaging:** Prevents internal server traces and raw API payloads from leaking to the frontend UI.
