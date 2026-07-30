# Challenges & Solutions

Building a production-ready, full-stack AI application involves navigating numerous technical hurdles. Below are the most significant challenges encountered during the development of ReForge.

## 1. Document Uploads Failing in Production

**Problem**  
Users could upload large PDFs in local development, but uploads consistently failed with a 413 error in production.

**Root Cause**  
The Next.js frontend is deployed on Vercel, which enforces a hard 4.5MB payload limit on Serverless Functions and API routes. Because the frontend proxy routed all requests to the backend, files larger than 4.5MB were immediately rejected by Vercel before ever reaching the FastAPI server.

**Solution**  
We refactored the upload process to bypass the Vercel proxy entirely. The frontend upload component now reads the backend URL directly from the environment (`NEXT_PUBLIC_BACKEND_URL`), attaches the user's JWT from the session, and sends the `multipart/form-data` payload directly to the Render-hosted FastAPI server.

**Outcome**  
Document uploads are no longer constrained by Vercel's serverless limits, allowing users to reliably upload 20MB+ files while keeping the rest of the application's API securely proxied.

---

## 2. Browser Blocking Direct Uploads (CORS & CSP)

**Problem**  
After implementing the direct-upload solution, the browser blocked the requests with "Failed to fetch" and "Blocked by Content Security Policy" errors.

**Root Cause**  
Two separate security mechanisms rejected the request:
1. **CSP:** Next.js middleware enforces strict Content Security Policies that blocked outbound network requests to unknown domains (the Render backend).
2. **CORS:** FastAPI rejected the browser's preflight `OPTIONS` request because the `Origin` header (Vercel) did not match the backend's allowed origins.

**Solution**  
1. Updated the `next.config.ts` to explicitly allow the Render backend URL in the `connect-src` CSP directive.
2. Updated FastAPI's `CORSMiddleware` to dynamically read allowed origins from environment variables, ensuring it accepted requests from both `localhost` and the production Vercel domain.

**Outcome**  
The browser successfully completes the CORS preflight and executes the POST request securely, maintaining strict security boundaries without breaking functionality.

---

## 3. Masking Raw Backend Errors in the UI

**Problem**  
When the Gemini API quota was exceeded or a network timeout occurred, the UI displayed massive, unreadable Python stack traces (e.g., `ClientError: 429 RESOURCE_EXHAUSTED...`) directly to the user.

**Root Cause**  
The frontend polling mechanism blindly read the `error_message` string from the backend database when a document indexing task failed, assuming it was safe to display.

**Solution**  
Implemented a centralized `getFriendlyErrorMessage` interceptor on the frontend. This function analyzes error strings and HTTP status codes, mapping known technical traces (429, 413, 415, Failed to fetch) to clean, localized user notifications (e.g., "Embedding service quota reached. Please try again later."). The raw trace is instead logged to `console.error` for developer debugging.

**Outcome**  
Users experience a polished, professional interface that clearly explains *why* an action failed without exposing sensitive internal API structures.
