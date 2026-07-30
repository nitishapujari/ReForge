# System Design

ReForge relies on a carefully orchestrated system design to ensure document security, responsive user interfaces, and reliable AI generation.

## 1. Authentication Lifecycle
- **Login:** Users authenticate via NextAuth on the frontend.
- **Session:** NextAuth generates a JWT session token.
- **Verification:** For every protected API call, the frontend attaches this JWT as a Bearer token. The FastAPI backend decodes and validates the token before processing the request.

## 2. Document Ingestion Pipeline
To handle large documents effectively, ReForge bypasses traditional proxying limits:
1. **Direct Upload:** The Next.js frontend sends multipart form data (the document) directly to the FastAPI backend, bypassing the Vercel 4.5MB payload limit.
2. **Parsing:** FastAPI extracts text from the document (PDF, TXT, MD, CSV, DOCX).
3. **Chunking & Embedding:** The extracted text is split into semantic chunks. The Gemini API generates vector embeddings for each chunk.
4. **Storage:** Vectors are stored in ChromaDB; metadata and job status are saved in SQLite.
5. **Real-time Polling:** The frontend polls the backend to update the user on the ingestion progress (Extracting text -> Generating embeddings -> Indexing document).

## 3. Conversational State Machine
Chat requests are not handled linearly. They are routed through a LangGraph state machine:
- **State Definition:** A Pydantic schema holds the current question, chat history, retrieved documents, and the draft answer.
- **Nodes (Agents):** 
  - `retrieve_node`: Fetches vectors from ChromaDB.
  - `generate_node`: Constructs an answer using the Gemini API.
  - `grade_documents_node`: Checks if retrieved documents are actually relevant to the question.
  - `rewrite_query_node`: Modifies the user's question if better search terms are needed.
- **Edges (Conditional Logic):** The graph routes execution between nodes based on the output. If the `grade_documents_node` determines the context is poor, execution routes to `rewrite_query_node`, then loops back to `retrieve_node`.

## 4. Error Handling Strategy
- **Backend Isolation:** FastAPI catches exceptions and returns standardized JSON error models (e.g., `{"detail": "Error message"}`).
- **Frontend Interception:** Next.js intercepts these HTTP errors. Instead of surfacing raw Python stack traces or API limits to the user, it maps them to friendly UI messages (e.g., mapping a 429 status to "Embedding service quota reached").
