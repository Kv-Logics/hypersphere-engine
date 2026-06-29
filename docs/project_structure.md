# Project Structure & Production Stack Specification

This document provides a map of the restructured repository and defines the required technology stack for a production-grade campus deployment.

---

## 1. Project Directory Blueprint

```
hypersphere-engine/
├── backend/                       # Core FastAPI application
│   ├── app/
│   │   ├── api/                   # Router endpoints (health, verify, register)
│   │   ├── core/                  # ML models, pipelines, and configuration
│   │   ├── db/                    # SQL Database connection and Vector Indexes
│   │   ├── models/                # Pydantic schema validation models
│   │   └── main.py                # Dashboard UI HTML delivery and server start
│   └── run.sh                     # Uvicorn startup script
├── cli/                           # Command-line enrollment tools
│   ├── advanced_registration.py   # Guided multi-pose template CLI
│   ├── register_face.py           # Simple single-snap CLI
│   └── *.json                     # Saved local test embeddings (mock db)
├── scripts/                       # Developer & diagnostic playground
│   ├── face_detection.py          # BlazeFace localization tester
│   ├── face_alignment.py          # Similarity transform alignment verification
│   ├── embedding_test.py          # ArcFace embedding extractor check
│   ├── similarity_test.py         # Distance matching verification
│   ├── anti_spoof_test.py         # Liveness model test
│   ├── anti_spoof_debug.py        # FASNet activation debugger
│   ├── check_labels.py            # Diagnostic labels inspector
│   └── final_system.py            # End-to-end standalone pipeline demo
├── references/                    # Architectural specs, blueprints, and strategies
│   ├── backend_api_plan.md
│   ├── database_vector_index.md
│   ├── ml_pipeline_inference.md
│   ├── nvidia_build_integration_strategy.md
│   ├── pgvector_architecture_blueprint.png
│   └── pgvector_migration_plan.md
├── SilentFace/                    # Local anti-spoofing module files
├── facial_attendance_architecture.md # Core architectural research spec
├── setup.sh                       # Local environment bootstrap script
└── .gitignore                     # Git ignore rules
```

---

## 2. Production Stack Requirements

To transition the local development server to a production campus network (such as NIT Trichy), the following stack is required:

### A. Infrastructure & Containerization
*   **Docker & Docker Compose:** Containerizes the application and database for isolation and reproducible deployments.
*   **NVIDIA Container Toolkit:** Maps physical GPU hardware on the host into the Docker container for GPU-accelerated face alignment and vector matching.

### B. Database Plane
*   **PostgreSQL (v15+):** Serves as the primary ACID relational database.
*   **pgvector Extension:** Replaces local FAISS/NumPy indexing, storing embeddings directly inside PostgreSQL tables.
*   **HNSW Indexing:** Enabled on the vector columns to guarantee sub-5ms lookup speeds across tens of thousands of records.

### C. Model Serving & CUDA Acceleration
*   **CUDA Toolkit & cuDNN:** Installed on the host GPU server to run model layers directly on Tensor Cores.
*   **ONNX Runtime (GPU/TensorRT Provider):** Accelerates ArcFace embedding extraction.
*   **PyTorch (CUDA Enabled):** Direct GPU serving for the MiniFASNetV2 liveness detection network.

### D. Asynchronous Pipeline (Task Queue)
*   **Redis:** Serves as a high-speed message broker and in-memory cache.
*   **Celery:** Run as background worker processes to handle non-blocking operations asynchronously (e.g. updating the SQLite/Postgres logs, sending daily attendance summaries, and executing background template updates).

### E. Gateway & Security
*   **Nginx / Traefik:** Used as a reverse proxy to handle request routing, request rate-limiting, and static file caching.
*   **Let's Encrypt Certbot:** Provisions SSL certificates for HTTPS/TLS 1.3 encryption, ensuring that biometric images/templates captured from camera nodes are encrypted in transit.
*   **Systemd / Gunicorn:** Manages and monitors FastAPI uvicorn workers (auto-restart on crash, log rotation).

### F. Production Frontend Stack (For Web Scale - Option A)
*   **Core Framework:** **Next.js** or **React.js** (for component reusability, routing, and client performance).
*   **Styling & Design:** **TailwindCSS** (utility-first styling, enabling fast adjustments while retaining a premium glassmorphic UI).
*   **Communication Protocol:** **WebSockets** (using FastAPI's native WebSocket support) to stream live authentication results and audit records to the admin dashboard instantly without AJAX polling.
*   **State Management:** **Zustand** or **Redux Toolkit** (to manage node connections, active webcams, and local transaction states).
*   **Runtime:** Standard browser client (fully optimized for Chrome/Edge/Firefox engine runtimes).

### G. Lightweight Frontend Stack (For Kiosks / Local Testing - Option B)
*   **Core Tech:** **Vanilla HTML5**, **Vanilla CSS3**, and **Vanilla ES6+ JavaScript** (zero-dependency, no bundler or `node_modules` required).
*   **Deployment:** Embedded directly inside the FastAPI application using FastAPI's `HTMLResponse` or mounted static files (requires zero additional hosting servers).
*   **Camera Integration:** Native browser **MediaDevices API** (`getUserMedia`) capturing frames to a hidden HTML `<canvas>` to generate JPG blobs.
*   **Communication:** Standard browser **Fetch API** making asynchronous `POST` requests to the REST server.
*   **State Management:** Native JavaScript variables and direct DOM operations (extremely fast initialization, zero bundle-size overhead).
