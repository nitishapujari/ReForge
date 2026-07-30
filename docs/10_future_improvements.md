# Future Improvements

ReForge is an actively evolving project. The following roadmap outlines planned enhancements to scale the system's capabilities, accuracy, and operational efficiency.

## Short-Term Roadmap (v1.1)

### Local Embeddings
- **Goal:** Shift from cloud-based embeddings (Gemini API) to a local model (e.g., `all-MiniLM-L6-v2` via HuggingFace).
- **Why:** Reduces API costs, prevents rate-limiting during large batch uploads, and improves privacy for sensitive documents.

### Better Chunking Strategies
- **Goal:** Implement semantic chunking rather than naive character-based or token-based splitting.
- **Why:** Ensures that conceptual blocks (like paragraphs or code functions) aren't arbitrarily cut in half, vastly improving the quality of the retrieved context.

### Robust Duplicate Detection
- **Goal:** Hash file contents at the frontend and backend levels.
- **Why:** Prevents re-vectorizing identical documents, saving compute resources and reducing noise in ChromaDB.

## Long-Term Roadmap (v2.0+)

### Hybrid Search
- **Goal:** Combine vector search (semantic similarity) with keyword search (BM25).
- **Why:** Vector search struggles with exact term matching (e.g., serial numbers, specific names). Hybrid search fuses the two approaches for highly accurate retrieval.

### Multi-LLM Support
- **Goal:** Abstract the generation layer to support Groq, Llama, OpenAI, and Anthropic seamlessly.
- **Why:** Avoids vendor lock-in and allows users to route simpler tasks to cheaper/faster models while saving powerful models for the heavy reasoning in the LangGraph orchestrator.

### Role-Based Access Control (RBAC)
- **Goal:** Implement Admin, User, and Viewer roles within NextAuth and the SQLAlchemy models.
- **Why:** Currently, documents are siloed per user. RBAC will allow team workspaces and shared document repositories.

### Semantic Caching
- **Goal:** Cache generated answers based on the semantic similarity of the user's prompt using Redis or a dedicated caching layer.
- **Why:** If two users ask variations of the exact same question, the system can instantly return the cached answer instead of running the expensive LangGraph pipeline, drastically reducing latency and API costs.
