# Architecture

ReForge is built on a decoupled, client-server architecture, splitting the responsibilities between a React-based frontend and a Python-based AI backend.

## High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Frontend [Next.js Client]
        UI[User Interface]
        NA[NextAuth]
        Proxy[Next.js API Proxy]
    end

    subgraph Backend [FastAPI Server]
        API[REST Endpoints]
        Auth[JWT Middleware]
        
        subgraph AI Core
            LG[LangGraph Orchestrator]
            Agents[Specialized Agents]
        end
        
        subgraph Storage
            SQL[(SQLite / SQLAlchemy)]
            VDB[(ChromaDB)]
        end
    end
    
    subgraph External
        Gemini[Google Gemini API]
    end

    UI <-->|Uploads (Bypass Proxy)| API
    UI <-->|Standard Requests| Proxy
    Proxy <-->|Authenticated Fetch| API
    NA -->|Issues JWT| UI
    
    API <--> Auth
    Auth <--> SQL
    API <--> LG
    
    LG <--> Agents
    Agents <--> VDB
    Agents <--> Gemini
```

> **Note on Routing:** Standard application requests flow through the Next.js proxy, while document uploads bypass it and connect directly to the FastAPI backend. This architecture intentionally avoids Vercel's request-size limitations while maintaining secure, authenticated access.

## Component Responsibilities

### 1. Next.js Frontend
- **Presentation Layer:** Renders the chat interface, upload portals, and real-time verification logs.
- **Session Management:** Handles user sessions and token lifecycle via NextAuth.
- **API Proxy:** Routes standard API calls (chat, history) through Next.js server actions to prevent exposing the backend URL to the client. *Note: Multipart uploads bypass this proxy due to Vercel payload limits.*

### 2. FastAPI Backend
- **API Gateway:** Exposes endpoints for document ingestion, chat processing, and history retrieval.
- **Data Persistence:** Manages relational data (users, chat threads, messages) via SQLAlchemy and SQLite.
- **Vector Storage:** Manages document embeddings via ChromaDB.

### 3. LangGraph Orchestrator
- **State Management:** Maintains the conversational state and retrieved context during a single chat turn.
- **Agent Routing:** Determines whether to retrieve context, generate an answer, critique the answer, or rewrite the query based on the current state.

## Data Flow

### Chat Execution Flow
1. **Request:** User submits a prompt in the Next.js UI.
2. **Proxy:** Next.js attaches the JWT session token and proxies the request to FastAPI.
3. **Authentication:** FastAPI validates the JWT against the SQLite database.
4. **Orchestration:** The request enters the LangGraph workflow.
5. **Retrieval:** An agent queries ChromaDB for relevant document chunks.
6. **Generation:** An agent constructs a prompt with the retrieved context and calls the Gemini API.
7. **Critique:** The generated answer is evaluated. If hallucinated, the query is rewritten and the flow loops back to Retrieval.
8. **Response:** The final, verified answer is streamed back through FastAPI and Next.js to the user.

## Deployment Architecture
- **Frontend (Vercel):** The Next.js application is deployed on Vercel, utilizing edge functions for NextAuth and optimized static asset delivery.
- **Backend (Render):** The FastAPI server runs as a Web Service on Render, backed by a persistent disk volume to ensure SQLite and ChromaDB data survives container restarts.
