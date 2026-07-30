# API Overview

ReForge exposes a comprehensive REST API powered by FastAPI. Below are the key endpoints critical to the application's functionality.

## Authentication
`POST /api/v1/auth/register`
- **Description:** Creates a new user account.
- **Payload:** `email`, `password`, `name`.

`POST /api/v1/auth/login`
- **Description:** Authenticates a user and returns an access token.
- **Payload:** OAuth2 Password Request Form (`username`, `password`).

## Documents (Ingestion & Retrieval)
`POST /api/v1/documents/upload`
- **Description:** Accepts a multipart form upload for processing and vectorization.
- **Authentication:** Requires Bearer JWT.
- **Note:** Called directly by the browser to bypass Vercel proxy limits.

`GET /api/v1/documents`
- **Description:** Retrieves a list of all documents belonging to the authenticated user, including their current indexing status.

`PUT /api/v1/documents/{document_id}`
- **Description:** Replaces an existing document and triggers re-indexing.

`DELETE /api/v1/documents/{document_id}`
- **Description:** Removes the document from both SQLite and ChromaDB.

## Chat & History
`POST /api/v1/chat`
- **Description:** Primary endpoint for conversational queries. Initiates the LangGraph RAG pipeline.
- **Payload:** `query`, `chat_id` (optional).
- **Response:** Server-Sent Events (SSE) stream containing chunks of the generated answer and verification metadata.

`GET /api/v1/history`
- **Description:** Retrieves all past conversation threads for the user.

`GET /api/v1/history/{chat_id}`
- **Description:** Retrieves the exact message history for a specific conversation thread.
