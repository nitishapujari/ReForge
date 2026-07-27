# ReForge — Backend

The Self-Healing RAG Pipeline — Backend API.

## Prerequisites

- Python 3.12+
- pip

## Setup

1. **Create a virtual environment:**

   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**

   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   **CRITICAL:** You must edit `.env` and set your `GEMINI_API_KEY`, `JWT_SECRET`, and `DATABASE_URL`. The application will not start without them.

   > **Warning - Git History:** Secrets were previously hardcoded in this codebase. If you used this project in a production environment prior to this update, those old secrets (such as the JWT fallback) are still stored in your Git history. **Rotate any previously hardcoded secrets immediately.**

## Running the Server

```bash
uvicorn app.main:app --reload --port 8000
```

The server starts at `http://localhost:8000`.

## API Documentation

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Endpoints

| Method | Path             | Description                 |
|--------|------------------|-----------------------------|
| GET    | `/api/v1/health` | System health check         |
