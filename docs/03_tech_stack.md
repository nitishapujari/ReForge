# Technology Stack

The ReForge technology stack was chosen to balance rapid development on the frontend with high-performance, specialized AI orchestration on the backend.

## Core Technologies

| Technology | Purpose & Rationale |
| :--- | :--- |
| **Next.js (App Router)** | Powers the frontend. Chosen for its optimized rendering, file-based routing, and built-in API proxying capabilities. |
| **FastAPI** | High-performance Python backend. Chosen for its native asynchronous support, auto-generated OpenAPI documentation, and seamless integration with Python AI ecosystems. |
| **LangGraph** | Stateful AI workflow orchestration. Chosen because ReForge requires iterative reasoning (self-critique, conditional retries). LangGraph naturally models these cyclic workflows and state transitions better than linear chain-based approaches. |
| **ChromaDB** | Vector search and storage. Chosen for its lightweight, local-first architecture which avoids the overhead of managing a separate cloud vector database during early development. |
| **Gemini API** | LLM inference and embedding generation for the current implementation. Chosen for its fast inference speed, generous free-tier limits, and strong reasoning capabilities. |
| **SQLite (SQLAlchemy)** | Relational data persistence (users, chats, tasks). Chosen for operational simplicity—requiring zero infrastructure setup while still providing robust ACID compliance via SQLAlchemy ORM. |
| **NextAuth.js** | Authentication and session management. Chosen for its seamless Next.js integration and flexibility in handling custom credential providers and JWT strategies. |
| **Tailwind CSS & Framer Motion** | UI styling and animation. Chosen to deliver a premium, modern, and highly interactive user experience with minimal bundle size overhead. |
