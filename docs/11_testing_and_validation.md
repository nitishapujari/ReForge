# Testing and Validation

ReForge has undergone extensive manual testing and validation to ensure system stability, security, and a seamless user experience across local and production environments.

## 1. Authentication Testing
- **Session Management:** Verified NextAuth session creation, token attachment to outbound API requests, and proper expiration handling.
- **Route Protection:** Confirmed that unauthenticated users attempting to access `/chat` or `/upload` are correctly redirected to the login interface.

## 2. Upload Testing
- **Large File Bypassing:** Validated that direct-to-backend uploads successfully bypass the 4.5MB Vercel proxy limit, allowing files up to 20MB.
- **Multipart Data Integrity:** Ensured that `multipart/form-data` correctly transmits the file alongside the JWT Authorization headers.
- **Progress States:** Verified that the UI accurately reflects granular backend state transitions (Uploading -> Extracting -> Embedding -> Indexing).

## 3. Chat & Agent Testing
- **Streaming Reliability:** Tested Server-Sent Events (SSE) to ensure smooth token delivery without buffering delays.
- **Self-Healing Loop:** Intentionally provided poor initial prompts to trigger the LangGraph self-critique loop, verifying that the agent successfully rewrites queries and re-retrieves context rather than hallucinating.

## 4. Error Handling
- **API Quota Management:** Simulated 429 Too Many Requests errors from the Gemini API and verified that the backend safely captures the exception.
- **UI Error Interception:** Verified that backend stack traces (e.g., `RESOURCE_EXHAUSTED`) are intercepted by the frontend `getFriendlyErrorMessage` utility and masked with clean, localized notifications in the UI, preserving security and UX.

## 5. Deployment Validation
- **CORS Configuration:** Validated that the FastAPI backend strictly accepts `OPTIONS` preflight requests only from configured origins (local dev and Vercel production).
- **Content Security Policy (CSP):** Audited `next.config.ts` to ensure `connect-src` directives explicitly permit outbound connections to the Render backend, preventing browser-level blocks.

## 6. Cross-Browser Testing
- **Functionality:** Confirmed that drag-and-drop file inputs, Server-Sent Events, and CSS animations (Framer Motion) degrade gracefully or function correctly across modern versions of Chrome, Safari, and Edge.

## 7. Known Limitations
- **File Parsing Nuances:** Highly complex PDFs (e.g., multi-column academic papers with embedded charts) may occasionally lose structural formatting during text extraction.
- **Concurrent Uploads:** While multiple files can be queued, uploading more than 5 large files simultaneously may trigger rate limits from the external embedding provider on the free tier.
