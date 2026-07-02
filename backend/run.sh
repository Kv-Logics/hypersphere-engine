#!/bin/bash
# Startup script for Hypersphere Face Attendance Backend
echo "Starting Hypersphere Engine FastAPI server..."

# Connects to the Docker PostgreSQL container exposed on localhost:5432
export DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/face_attendance"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
