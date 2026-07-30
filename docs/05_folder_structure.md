# Folder Structure

ReForge separates concerns clearly by dividing the repository into distinct frontend and backend directories.

## Overview

```text
ReForge/
├── backend/            # Python / FastAPI server
├── frontend/           # Next.js / React application
└── docs/               # Project documentation
```

## Backend Structure (`/backend`)

The backend follows a domain-driven structure, keeping AI logic separate from standard API routes.

```text
backend/
├── app/
│   ├── agents/         # LangGraph workflows, nodes, and state definitions
│   ├── api/            # FastAPI routers (auth, chat, documents, history)
│   ├── core/           # Configuration, security, and dependencies
│   ├── models/         # SQLAlchemy ORM schemas and Pydantic models
│   ├── services/       # Core business logic (LLM integrations, Vector DB)
│   └── main.py         # FastAPI application entry point
├── storage/            # Local directory for SQLite DB and ChromaDB files
└── requirements.txt    # Python dependencies
```

## Frontend Structure (`/frontend`)

The frontend utilizes the Next.js App Router paradigm, emphasizing server-side rendering where possible and clear UI component separation.

```text
frontend/
├── src/
│   ├── app/            # Next.js App Router pages and API proxy routes
│   │   ├── api/        # NextAuth and backend proxy routes
│   │   ├── chat/       # Conversational interface
│   │   ├── upload/     # Document ingestion interface
│   │   └── ...
│   ├── components/     # Reusable React components (shadcn/ui)
│   ├── lib/            # Utility functions and API helpers
│   └── middleware.ts   # Next.js middleware for route protection and headers
├── public/             # Static assets (images, icons)
├── tailwind.config.ts  # Tailwind CSS configuration
└── package.json        # Node dependencies
```
