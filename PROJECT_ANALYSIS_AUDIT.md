# 🧠 Hypersphere Engine — Project Analysis & Architectural Audit

> **Document Created:** September 2026  
> **Repository:** `hypersphere-engine`  
> **Deployment Target:** Amrita Vishwa Vidyapeetham, Ettimadai Campus (Coimbatore, Tamil Nadu)  
> **Collaborators:** NITT-CDI / Amrita Vishwa Vidyapeetham / Kv-Logics  

---

## 1. Executive Summary

**Hypersphere Engine** is a full-stack, research-to-production biometric attendance platform combining deep learning facial recognition with real-time GPS campus geofencing. The platform is designed for institutional deployment with strict quality gating, presentation attack detection (anti-spoofing), multi-embedding biometric drift handling, and zero user friction.

### Primary Capabilities
- **Biometric Pipeline:** SCRFD face detection, 5-point affine landmark alignment, MiniFASNetV2 liveness verification, and ArcFace ResNet-50 512-dimensional vector embedding.
- **Vector Database:** PostgreSQL 16 with native `pgvector` extension and HNSW indexing for sub-millisecond similarity lookups.
- **Biometric Drift Engine:** Multi-embedding profile support (up to 15 vectors per user) with automated candidate capture in the $[0.45, 0.62)$ similarity drift window, governed by administrator approval.
- **Dual Frontend Architecture:** Legacy HTML5/JS/CSS prototype (mounted directly by FastAPI) and modern Next.js 15 App Router frontend with dark glassmorphic UI.
- **Campus Geofencing:** Ray-casting Point-in-Polygon (PiP) engine over 103 OpenStreetMap building polygons for Amrita campus attendance validation.

---

## 2. High-Level System Architecture

```
                          ┌────────────────────────────────────────────────────────┐
                          │                   Client Applications                  │
                          │   • Vanilla UI: frontend/ (FastAPI static mount)       │
                          │   • Next.js 15: nextjs-frontend/ (Modern App Router)   │
                          └───────────────────────────┬────────────────────────────┘
                                                      │ HTTP / REST (/api/v1)
                                                      ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     FastAPI Backend (backend/app/)                                │
│                                                                                                   │
│  ┌───────────────────────────────┐     ┌───────────────────────────────────────────────────────┐  │
│  │ API Endpoints & Auth          │     │ Biometric Pipeline (FacePipeline)                     │  │
│  │ • endpoints.py                │     │ 1. SCRFD ONNX (5-Point Landmark Detection)            │  │
│  │ • auth.py                     │     │ 2. Pre-Inference Quality & Pose Gating                │  │
│  │ • face_requests.py            │     │ 3. ArcFace Affine Alignment (112x112 canonical crop)  │  │
│  └───────────────┬───────────────┘     │ 4. MiniFASNetV2 Anti-Spoofing / Liveness Check        │  │
│                  │                     │ 5. ArcFace w600k_r50 ONNX (512-D Unit Vector)         │  │
│                  │                     └──────────────────────────┬────────────────────────────┘  │
│                  ▼                                                │ Vector Search                 │
│  ┌────────────────────────────────────────────────────────────────┴────────────────────────────┐  │
│  │ Vector Database & Storage Engine (database.py, vector_index.py)                             │  │
│  │ • PostgreSQL 16 + pgvector (HNSW: m=16, ef_construction=64, ef_search=40)                   │  │
│  │ • Multi-embedding history (up to 15 vectors per user) with automated FIFO eviction           │  │
│  │ • Biometric Drift Review approval queue                                                     │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure & File Inventory

```
hypersphere-engine/
│
├── backend/                                # FastAPI Python Backend
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints.py                # Primary routes (verify, register, attendance, metrics)
│   │   │   ├── auth.py                     # Auth lookup, manual registration, session
│   │   │   └── face_requests.py            # Registration/update image request workflow
│   │   ├── core/
│   │   │   ├── pipeline.py                 # Core ML FacePipeline (detection, alignment, embedding)
│   │   │   ├── scrfd.py                    # SCRFD ONNX detector wrapper & NMS processing
│   │   │   ├── csv_loader.py               # Auto-seeder for institutional CSV user rosters
│   │   │   └── liveness/
│   │   │       └── MiniFASNet.py           # PyTorch MiniFASNetV2 model architecture
│   │   ├── db/
│   │   │   ├── database.py                 # SQLAlchemy schemas & async engine setup
│   │   │   └── vector_index.py             # pgvector search & embedding capacity manager
│   │   ├── models/
│   │   │   └── schemas.py                  # Pydantic request/response schemas
│   │   ├── config.py                       # Global settings, model paths & thresholds
│   │   └── main.py                         # FastAPI application factory, lifespan & static mounts
│   ├── requirements.txt                    # Python dependencies
│   ├── run.sh                              # Local backend launch script
│   └── .env                                # Local environment variables (DATABASE_URL)
│
├── nextjs-frontend/                        # Next.js 15 TypeScript Frontend (Target UI)
│   ├── app/
│   │   ├── page.tsx                        # Root entry / redirection
│   │   ├── layout.tsx                      # Root layout with fonts (Outfit, Roboto, JetBrains Mono)
│   │   ├── globals.css                     # Global glassmorphic styling & tokens
│   │   ├── dashboard/page.tsx              # Faculty kiosk dashboard with webcam stream
│   │   └── admin/                          # Admin HUD control plane
│   │       ├── drifts/page.tsx             # Biometric drift approval interface
│   │       ├── health/page.tsx             # Real-time system health & latency telemetry
│   │       ├── playground/page.tsx         # Live continuous biometric sandbox
│   │       ├── registry/page.tsx           # Face database registry table
│   │       ├── reports/page.tsx            # Attendance log reports & CSV export
│   │       ├── requests/page.tsx           # Registration / profile photo review feed
│   │       ├── terminal/page.tsx           # Verification test terminal
│   │       ├── tester/page.tsx             # Single-frame manual biometric evaluation
│   │       └── users/page.tsx              # Faculty roster management
│   ├── components/admin/                   # Reusable admin tab components
│   ├── hooks/useWebcam.ts                  # Custom React camera stream & canvas hook
│   ├── next.config.ts                      # Next.js compiler & server settings
│   └── postcss.config.mjs                  # PostCSS / Tailwind configuration
│
├── frontend/                               # Legacy Static HTML/JS/CSS Frontend
│   ├── index.html                          # Landing page
│   ├── login.html                          # Faculty lookup & login
│   ├── dashboard.html                      # Standalone kiosk portal
│   ├── admin.html                          # Legacy admin dashboard
│   ├── registry.html                       # Legacy registry table
│   ├── components/                         # Modular HTML components
│   └── assets/                             # Legacy CSS & JS scripts
│
├── models/                                 # Neural Network Weights (Git-ignored)
│   ├── w600k_r50.onnx                      # ArcFace ResNet-50 feature extractor (174 MB)
│   ├── w600k_mbf.onnx                      # ArcFace MobileFaceNet lightweight extractor (13.6 MB)
│   └── 2.7_80x80_MiniFASNetV2.pth          # MiniFASNetV2 anti-spoofing weights (1.8 MB)
│
├── scripts/                                # Utility & Testing Scripts
│   ├── download_models.py                  # Automated ONNX/PyTorch model downloader
│   ├── anti_spoof_test.py                  # Liveness pipeline test harness
│   ├── anti_spoof_debug.py                 # Spoofing threshold diagnostic tool
│   ├── embedding_test.py                   # ArcFace vector similarity test harness
│   ├── face_alignment.py                   # Affine alignment test script
│   ├── face_detection.py                   # SCRFD detector test script
│   └── similarity_test.py                  # Cosine distance validation
│
├── Data_Of_Users/                          # Institutional User Data Rosters (CSV)
│   ├── Faculty.csv                         # Full faculty roster (department, emp ID, email)
│   ├── Hods.csv                            # Heads of Department
│   ├── Deans.csv                           # Academic Deans
│   └── Director and Registrar.csv          # Institutional Leadership
│
├── docs/                                   # Architecture & Technical Documentation
│   ├── facial_attendance_architecture.md   # Master architectural specification (143 KB)
│   ├── BIOMETRIC_PIPELINE_REPORT.md        # Pipeline calibration & review report
│   ├── pgvector_migration_plan.md          # Vector DB migration blueprint
│   ├── hardware_specifications.md          # Server & kiosk deployment specs
│   └── nvidia_build_integration_strategy.md# GPU acceleration & TensorRT roadmap
│
├── Dockerfile                              # Python 3.10-slim backend container
├── docker-compose.yml                      # Multi-container orchestration (pgvector + API)
├── setup.sh                                # Automated Linux environment setup script
├── NEXTJS_MIGRATION_PLAN.md                # Migration guide from vanilla to Next.js
├── BIOMETRIC_DRIFT_REVIEWS.md              # Drift review design & threshold mechanics
└── BIOMETRIC_REVIEW_CHECKLIST.md           # 22-item architecture review verification checklist
```

---

## 4. Deep Dive: Biometric Pipeline & Quality Gating

### Pipeline Specification
```
Incoming Frame (JPEG/Webcam)
      │
      ▼
1. SCRFD Face Detection
   ├── ONNX Runtime (CPUExecutionProvider)
   ├── Input Mean: 127.5, Norm: 128.0
   └── Returns: Bounding Box [x1, y1, x2, y2] + 5-Point Landmarks
      │
      ▼
2. Pre-Inference Quality Gates
   ├── Blur: Laplacian variance ≥ 50.0
   ├── Illumination: 40.0 ≤ Mean Luminance ≤ 220.0
   ├── Area Scale: 0.01 ≤ Face Area / Frame Area ≤ 0.90
   └── Head Pose: solvePnP (|yaw| ≤ 30°, |pitch| ≤ 25°)
      │
      ▼
3. 5-Point Affine Alignment
   ├── Source Points: Detected 5 landmarks
   ├── Canonical ArcFace Target Coordinates (DST_PTS):
   │   • Right Eye:   [30.2946, 51.6963]
   │   • Left Eye:    [65.5318, 51.5014]
   │   • Nose Tip:    [48.0252, 71.7366]
   │   • Right Mouth: [33.5493, 92.3655]
   │   • Left Mouth:  [62.7299, 92.2041]
   └── Output: 112×112 Canonical Face Crop
      │
      ▼
4. Liveness / Anti-Spoofing (MiniFASNetV2)
   ├── 2.7× Bounding Box Crop (80×80 RGB)
   ├── PyTorch Inference (Thread-locked)
   ├── Softmax Probability Output
   └── Gate: Live Score ≥ 0.40 (Rejects print, screen, & mask attacks)
      │
      ▼
5. Feature Extraction (ArcFace w600k_r50)
   ├── 112×112 Aligned Crop
   ├── Normalization: (Pixel - 127.5) / 127.5
   ├── Output: 512-Dimensional Vector
   ├── Norm Check: Raw Norm ≥ Calibrated Threshold (Default: 12.0)
   └── Final Unit Vector: L2-Normalized (||v|| = 1.0)
```

---

## 5. Database & Multi-Embedding Drift System

### Database Schema (PostgreSQL + pgvector)

```
  ┌─────────────────────────────────┐           ┌───────────────────────────────────┐
  │             faculty             │           │          face_embeddings          │
  ├─────────────────────────────────┤           ├───────────────────────────────────┤
  │ id (VARCHAR PK)                 │◄───┐      │ id (SERIAL PK)                    │
  │ name (VARCHAR)                  │    │      │ faculty_id (FK -> faculty.id)     │
  │ email (VARCHAR)                 │    └─────┼│ embedding (vector(512))           │
  │ role (VARCHAR: user/admin)      │           │ model_version (VARCHAR)           │
  │ emp_id (VARCHAR)                │           │ drift_review_pending (BOOLEAN)    │
  │ department (VARCHAR)            │           │ raw_norm (FLOAT)                  │
  │ designation (VARCHAR)           │           │ created_at (TIMESTAMP)            │
  │ face_status (VARCHAR)           │           └───────────────────────────────────┘
  │ embedding (vector(512) legacy)  │
  │ embedding_quality (FLOAT)       │           ┌───────────────────────────────────┐
  │ embedding_count (INTEGER)       │           │        attendance_records         │
  └─────────────────────────────────┘           ├───────────────────────────────────┤
                                                │ id (SERIAL PK)                    │
  ┌─────────────────────────────────┐           │ faculty_id (FK -> faculty.id)     │
  │          face_requests          │           │ timestamp (TIMESTAMP)             │
  ├─────────────────────────────────┤           │ status (CONFIRMED/REJECTED/MANUAL)│
  │ id (SERIAL PK)                  │           │ similarity_score (FLOAT)          │
  │ user_id (FK -> faculty.id)      │           │ liveness_score (FLOAT)            │
  │ request_type (register/update)  │           │ quality_score (FLOAT)             │
  │ status (pending/approved/rej)   │           │ device_id (VARCHAR)               │
  │ uploaded_image (BYTEA)          │           │ location_name (VARCHAR)           │
  │ message (TEXT)                  │           │ latitude (FLOAT)                  │
  │ created_at (TIMESTAMP)          │           │ longitude (FLOAT)                 │
  └─────────────────────────────────┘           └───────────────────────────────────┘
```

### Biometric Drift Mechanics

```mermaid
graph TD
    score[Incoming Cosine Similarity Score]
    
    score --> |"≥ 0.62"| conf["Highly Confident Match (CONFIRMED)"]
    score --> |"0.45 to 0.61"| drift["Drift Window (CONFIRMED + Drift Review Triggered)"]
    score --> |"0.37 to 0.44"| manual["Ambiguity Zone (MANUAL_REVIEW Required)"]
    score --> |"< 0.37"| reject["REJECTED (No Match)"]

    conf --> |No Action| endNode((Finished))
    drift --> |Auto-Capture Embedding| dbDrift["Saved to face_embeddings with drift_review_pending=true"]
    manual --> |Alert Admin| adminAlert["Flagged in Attendance Log for Audit"]
```

- **Capacity Management:** Each user is capped at **15 active embeddings**. When a 16th embedding is inserted, the oldest record is evicted automatically (FIFO).
- **Security Safeguard:** Drift embeddings are ignored during matching searches until explicitly approved by an administrator via `/api/v1/admin/drift-requests/{id}/approve`.

---

## 6. Critical Findings & Audit Action Items

### 1. Missing `nextjs-frontend/package.json`
- **Issue:** The Next.js application codebase (`nextjs-frontend/`) contains all pages, layouts, and components, but **`package.json` does not exist**.
- **Impact:** Running `npm install` or `npm run dev` fails immediately.
- **Remediation:** Create `nextjs-frontend/package.json` with appropriate dependencies:
  - `next`: `^15.0.0`
  - `react`, `react-dom`: `^19.0.0` (or `^18.3.0`)
  - `@mediapipe/tasks-vision`: `^0.10.14`
  - `lucide-react`: `^0.460.0`
  - `clsx`, `tailwind-merge`

### 2. Missing SCRFD Detector Model File
- **Issue:** [`backend/app/config.py`](file:///c:/Users/keert/NIT%20Projects/hypersphere-engine/backend/app/config.py#L10) specifies `models/scrfd_2.5g_bnkps.onnx`. The `models/` directory contains `w600k_r50.onnx` and `2.7_80x80_MiniFASNetV2.pth`, but **`scrfd_2.5g_bnkps.onnx` is missing**.
- **Impact:** Starting the backend triggers a fatal `FileNotFoundError` in [`pipeline.py` (lines 86-87)](file:///c:/Users/keert/NIT%20Projects/hypersphere-engine/backend/app/core/pipeline.py#L86-L87).
- **Remediation:** Execute `python scripts/download_models.py` to download the missing ONNX detector weights from Hugging Face.

### 3. Strict PostgreSQL + pgvector Dependency
- **Issue:** [`backend/app/db/database.py` (lines 9-11)](file:///c:/Users/keert/NIT%20Projects/hypersphere-engine/backend/app/db/database.py#L9-L11) throws a `RuntimeError` if `DATABASE_URL` is not PostgreSQL. However, [`backend/app/config.py` (line 34)](file:///c:/Users/keert/NIT%20Projects/hypersphere-engine/backend/app/config.py#L34) defaults to SQLite (`sqlite:///./face_attendance.db`).
- **Impact:** Booting the server without `.env` or without an active PostgreSQL service fails immediately.
- **Remediation:** Ensure PostgreSQL container is running via `docker compose up -d postgres` and [`backend/.env`](file:///c:/Users/keert/NIT%20Projects/hypersphere-engine/backend/.env) contains `DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/face_attendance`.

### 4. Amrita Geofencing Assets Status
- **Issue:** `README.md` documents `amrita_engine.py`, `scripts/extract_amrita.py`, and `amrita_map.html`. These files currently reside in the external repository [`amrita-geofence-tester`](https://github.com/Kv-Logics/amrita-geofence-tester).
- **Impact:** Geofencing calculations in the main backend currently store incoming GPS coordinates (`latitude`, `longitude`, `location_name`), but the ray-casting PiP engine is not yet embedded directly into `backend/app/core/`.
- **Remediation:** Port `amrita_engine.py` and the GeoJSON building polygons into `backend/app/core/` when geofencing validation is integrated.

---

## 7. Quick Start & Execution Guide

### Step 1: Start PostgreSQL + pgvector
```bash
docker compose up -d postgres
```

### Step 2: Download Missing Biometric Models
```bash
python scripts/download_models.py
```

### Step 3: Run FastAPI Backend
```bash
cd backend
# Windows PowerShell
$env:DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/face_attendance"
$env:PYTHONPATH="."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 4: Run Next.js Frontend (After package.json creation)
```bash
cd nextjs-frontend
npm install
npm run dev
# Dashboard accessible at http://localhost:3000/dashboard
# Admin accessible at http://localhost:3000/admin
```
