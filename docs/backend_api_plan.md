# Reference: Scalable Backend API Implementation Plan

This reference document outlines the directory structure, FastAPI configurations, and schemas for the Hypersphere Engine backend API.

## 1. Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application startup & routing config
│   ├── config.py               # Environment configuration
│   ├── api/
│   │   ├── __init__.py
│   │   ├── endpoints.py        # Endpoints: /register, /verify, /health
│   │   └── dependencies.py     # Injection dependencies
│   ├── core/
│   │   ├── __init__.py
│   │   └── pipeline.py         # Face pipeline execution (Preprocess -> Embed -> Liveness)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py         # Relational database mappings (SQLAlchemy)
│   │   └── vector_index.py     # FAISS vector database manager
│   └── models/
│       ├── __init__.py
│       └── schemas.py          # Pydantic schemas
├── requirements.txt            # Package dependencies
└── run.sh                      # Uvicorn start script
```

## 2. API Endpoints

### `/api/v1/register`
*   **Method**: `POST`
*   **Content-Type**: `multipart/form-data`
*   **Fields**:
    *   `faculty_id`: Unique ID string (max length 50)
    *   `name`: Full name string (max length 100)
    *   `file`: Profile portrait image
*   **Result**: Validates face crop quality, extracts embedding, saves to database, updates vector index, and returns the profile details.

### `/api/v1/verify`
*   **Method**: `POST`
*   **Content-Type**: `multipart/form-data`
*   **Fields**:
    *   `device_id`: Identifier of the client camera terminal
    *   `file`: Presentation query image
*   **Result**: Decodes image, runs alignment, extracts embedding, evaluates liveness (liveness score $\geq 0.40$), queries index (match score $\geq 0.45$), logs result to audit table, and returns access decision.
