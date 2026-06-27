FROM python:3.10-slim

# Install system dependencies needed for OpenCV, MediaPipe, and C-compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend codebase
COPY backend /app/backend

# Copy frontend codebase
COPY frontend /app/frontend

# Copy local dependency modules (Anti-spoofing package)
COPY SilentFace /app/SilentFace

# Copy neural network model weight files (optional during build, can be mounted)
COPY w600k_r50.onnx* /app/
COPY 2.7_80x80_MiniFASNetV2.pth* /app/

# Set working directory to backend root for execution context
WORKDIR /app/backend

# Configure python path environment variable
ENV PYTHONPATH="/app/backend"
ENV DATABASE_URL="postgresql+asyncpg://postgres:password@postgres:5432/face_attendance"

# Expose API port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
