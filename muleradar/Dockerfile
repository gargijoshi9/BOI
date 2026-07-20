FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

WORKDIR /app

# Install system utilities (e.g. curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
COPY ml_pipeline/requirements.txt /app/ml_pipeline/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend and ml_pipeline module trees
COPY backend /app/backend
COPY ml_pipeline /app/ml_pipeline

WORKDIR /app/backend

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Start server using dynamic environment variables
CMD ["sh", "-c", "uvicorn app.main:app --host ${HOST} --port ${PORT}"]
