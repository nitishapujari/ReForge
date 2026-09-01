FROM python:3.11-slim

# Install system dependencies required for OCR and PDF processing
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir email-validator==2.1.1

# Pre-download ChromaDB default ONNX embedding model during build so it is never downloaded at runtime
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; ef = DefaultEmbeddingFunction(); ef(['warmup'])"

# Copy the rest of the application code
COPY . .

# Create the storage directory in case anything tries to write to it
RUN mkdir -p /app/storage

# Expose the API port
EXPOSE 8000

# The default command runs the FastAPI server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
