# 🧠 Hypersphere Engine

> **Production-grade biometric face attendance system with real-time geofencing for Amrita Vishwa Vidyapeetham**

Hypersphere Engine is a full-stack, research-to-production attendance platform that combines a deep learning facial recognition pipeline with campus-level GPS geofencing. It was designed for institutional deployment at **Amrita Vishwa Vidyapeetham, Ettimadai Campus** (Coimbatore, Tamil Nadu) with a focus on privacy, accuracy, and zero user friction.

---

## 📸 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Kiosk / Web Dashboard                      │
│         (Next.js 15 · TypeScript · Glassmorphic UI)         │
└──────────────┬──────────────────────────────────┬───────────┘
               │  HTTP POST /api/v1/verify         │ iframe
               │  HTTP POST /api/v1/register       │ postMessage
               ▼                                   ▼
┌──────────────────────────┐          ┌────────────────────────┐
│   FastAPI Backend        │          │  Amrita Geofence Map   │
│   (Python · Uvicorn)     │          │  (Leaflet.js · PiP     │
│                          │          │   Ray-Casting Engine)  │
│  ┌────────────────────┐  │          └────────────────────────┘
│  │  FacePipeline      │  │
│  │  1. SCRFD ONNX     │  │
│  │  2. MediaPipe      │  │
│  │  3. MiniFASNetV2   │  │
│  │  4. ArcFace ONNX   │  │
│  └────────┬───────────┘  │
│           │ 512-D Vector  │
│  ┌────────▼───────────┐  │
│  │  PgVectorIndex     │  │
│  │  PostgreSQL +      │  │  
│  │  pgvector          │  │
│  │  (FAISS fallback)  │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## ✨ Key Features

### 🎭 Biometric Pipeline
| Stage | Technology | Detail |
|---|---|---|
| Face Detection | **SCRFD 2.5G** (ONNX) | Sub-millisecond detection, returns keypoints for alignment |
| Face Alignment | **MediaPipe** | 5-point affine warp to canonical 112×112 face crop |
| Liveness Detection | **MiniFASNetV2** (PyTorch) | Blocks printed photos, screen replays, and 3D masks |
| Feature Extraction | **ArcFace w600k_r50** (ONNX) | 512-dimensional identity embedding, cosine similarity |
| Identity Verification | **1:1 Verification** | Restricts vector search to claimed identity, eliminates cross-identity false accepts |

### 🔐 Quality Gating (Pre-Inference Guards)
Every frame passes through strict pre-flight checks before ML inference:
- **Illumination** — Rejects underlit frames
- **Face Size** — Rejects faces too small for reliable embedding
- **Yaw Angle** — Rejects excessive side-profile poses
- **Blur Detection** — Rejects motion-blurred captures
- **Liveness Score** — Hard threshold at `0.40` (MiniFASNetV2 confidence)
- **Embedding Norm** — Dynamic `EMBEDDING_QUALITY_THRESHOLD` calibrated at boot from existing enrollment distribution

### 🗺️ Amrita Campus Geofencing
- **103 building polygons** extracted from OpenStreetMap via Overpass API
- **Ray-Casting PiP algorithm** — determines exact building from GPS coordinates in <1ms
- **GPS accuracy enforcement** — rejects IP-based fixes (>100m accuracy), demands hardware GPS
- **3-tier resolution**: `Inside Building` → `Campus Grounds` → `Off Campus`
- **Nearest building** computation via Haversine distance when outdoors

### 💻 Next.js Dashboard
- Live webcam stream with face bounding-box overlay
- Enrollment flow with liveness gate and duplicate detection
- Real-time attendance verification with location context
- Admin panel: user management, attendance logs, CSV export
- Dark glassmorphic UI with `Outfit` + `Plus Jakarta Sans` typography

---

## 🏗️ Project Structure

```
hypersphere-engine/
│
├── backend/                        # FastAPI Python backend
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py        # All API route handlers
│   │   ├── core/
│   │   │   ├── pipeline.py         # Main ML inference pipeline (FacePipeline)
│   │   │   ├── scrfd.py            # SCRFD ONNX face detector wrapper
│   │   │   ├── amrita_engine.py    # Amrita campus geofence engine
│   │   │   ├── csv_loader.py       # Faculty CSV auto-seeder on boot
│   │   │   └── liveness/           # MiniFASNetV2 anti-spoofing module
│   │   ├── db/
│   │   │   ├── database.py         # SQLAlchemy async engine + table definitions
│   │   │   └── vector_index.py     # pgvector + FAISS hybrid vector search
│   │   ├── models/
│   │   │   └── schemas.py          # Pydantic request/response schemas
│   │   ├── config.py               # Centralised settings (thresholds, paths)
│   │   └── main.py                 # FastAPI app, lifespan hooks, CORS
│   ├── requirements.txt
│   └── run.sh
│
├── nextjs-frontend/                # Next.js 15 TypeScript frontend
│   ├── app/
│   │   ├── dashboard/page.tsx      # Main kiosk dashboard
│   │   ├── login/page.tsx          # Auth page
│   │   └── globals.css             # Global design system styles
│   ├── components/                 # Reusable UI components
│   ├── public/
│   │   ├── amrita_map.html         # Geofencing map (self-contained)
│   │   └── amrita_data/            # Campus GeoJSON data files
│   └── package.json
│
├── scripts/                        # Utility & data scripts
│   ├── extract_amrita.py           # Live OSM extraction for Amrita campus
│   ├── download_models.py          # ONNX model downloader
│   ├── anti_spoof_test.py          # Liveness pipeline testing
│   ├── embedding_test.py           # ArcFace vector similarity tester
│   └── amrita_data/                # Raw + processed campus geodata
│
├── models/                         # ONNX & PyTorch model weights (gitignored)
│   ├── scrfd_2.5g_bnkps.onnx
│   ├── w600k_r50.onnx
│   └── 2.7_80x80_MiniFASNetV2.pth
│
├── features/                       # Feature registry & developer docs
│   ├── README.md                   # Architectural overview & extension guide
│   ├── 01_biometric_pipeline.md
│   ├── 02_vector_database.md
│   ├── 03_quality_gating.md
│   └── 04_kiosk_live_demo.md
│
├── docker-compose.yml              # PostgreSQL + pgvector + API stack
├── Dockerfile
└── setup.sh
```

---

## ⚙️ Configuration Reference

All tuneable parameters live in `backend/app/config.py`:

| Setting | Default | Description |
|---|---|---|
| `MATCH_THRESHOLD` | `0.60` | Minimum cosine similarity to accept a face match. Higher = stricter. |
| `AMBIGUITY_MARGIN` | `0.05` | Minimum score gap between top-2 matches; prevents ambiguous accepts. |
| `DETECTION_THRESHOLD` | `0.50` | SCRFD confidence threshold for face detection. |
| `ANTISPOOF_THRESHOLD` | `0.40` | MiniFASNetV2 live probability; below this = spoofing attempt. |
| `EMBEDDING_QUALITY_THRESHOLD` | `12.0` | Min L2 norm of embedding; calibrated dynamically at boot from enrollment data. |
| `DUPLICATE_SEARCH_THRESHOLD` | `0.70` | Similarity above which a new enrollment is flagged as a duplicate identity. |
| `BBOX_EXPANSION` | `2.7` | Face crop expansion factor for alignment headroom. |
| `VECTOR_INDEX_PATH` | `faiss_vectors.index` | Path to local FAISS fallback index. |
| `DATABASE_URL` | SQLite (dev) | Set `postgresql+asyncpg://...` for production. |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (for PostgreSQL)
- CUDA-capable GPU (optional, ONNX Runtime falls back to CPU)

### 1. Clone & Set Up

```bash
git clone https://github.com/Kv-Logics/hypersphere-engine.git
cd hypersphere-engine
```

### 2. Download ML Models

```bash
cd backend
python ../scripts/download_models.py
```

This downloads the three required model files into the `models/` directory:
- `scrfd_2.5g_bnkps.onnx` — Face detector
- `w600k_r50.onnx` — ArcFace recogniser
- `2.7_80x80_MiniFASNetV2.pth` — Liveness detector

### 3. Start the Database

```bash
docker-compose up -d postgres
```

Spins up `pgvector/pgvector:pg16` on port `5432`. The `face_attendance` database and all tables are provisioned automatically on first API startup.

### 4. Start the Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
bash run.sh
```

API will be available at `http://localhost:8000`. The Swagger docs are at `http://localhost:8000/api/v1/openapi.json`.

### 5. Start the Frontend

```bash
cd nextjs-frontend
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`.

### 6. (Optional) Full Docker Stack

```bash
docker-compose up --build
```

Starts both the PostgreSQL database and the API server in containers. Connect the frontend to `http://localhost:8000`.

---

## 🔌 API Reference

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Enroll a new face. Accepts `multipart/form-data` with `faculty_id`, `name`, `image`. |
| `POST` | `/verify` | Verify identity. Accepts `faculty_id` + `image`. Performs 1:1 verification. |
| `GET` | `/faculty` | List all enrolled faculty with metadata. |
| `GET` | `/attendance` | Retrieve attendance logs with optional date/user filters. |
| `DELETE` | `/faculty/{id}` | Remove a faculty member and their embeddings. |
| `GET` | `/health` | System health check (DB connectivity, model status). |

### Verify Response Schema

```json
{
  "verified": true,
  "faculty_id": "KV001",
  "name": "Kv Logics",
  "score": 0.847,
  "liveness": true,
  "liveness_score": 0.923,
  "quality_passed": true,
  "location": {
    "insideCampus": true,
    "buildingName": "Central Library"
  }
}
```

---

## 🧮 Biometric Accuracy Design

### Why 1:1 Verification (not 1:N Search)?

The system shifted from **open-set identification** (who is this?) to **closed-set verification** (is this person who they claim to be?). This is the standard production pattern for authenticated portals:

- A user logs in to the dashboard — their `faculty_id` is now known
- The `/verify` endpoint restricts the vector search to **only that identity's stored embeddings**
- This eliminates cross-identity false accepts entirely, regardless of threshold

### Threshold Tuning History

| Version | `MATCH_THRESHOLD` | Behaviour |
|---|---|---|
| v1.0 | `0.45` | Too permissive — Person A's embedding matched Person B at ~0.48 |
| v1.1 | `0.55` | Better, occasional boundary cases |
| **v2.0 (current)** | **`0.60`** | Strict — genuine match scores typically >0.75, impostors typically <0.50 |

---

## 🗺️ Amrita Campus Data

Campus spatial data is extracted from [OpenStreetMap](https://www.openstreetmap.org) via the Overpass API.

| File | Description |
|---|---|
| `amrita_buildings.geojson` | 103 building polygons |
| `amrita_attendance_polygons.json` | PiP-optimised format `{building_id, building_name, polygon, centroid}` |
| `amrita_campus_boundary.geojson` | Outer campus perimeter |
| `amrita_raw_osm.json` | Raw Overpass API response |

**Coverage:** 32 of 103 buildings are named in OSM (Central Library, Academic Block 2 & 3, Gargi/Vasishta Bhavanam hostels, Fabrication Workshop, etc.). The remaining 71 are tagged `Building_<OSM_ID>` for on-site naming.

To re-extract or refresh the campus data:

```bash
python scripts/extract_amrita.py
```

---

## 🛡️ Privacy & Security

- **No raw images stored** — Only 512-D float embeddings are persisted. Original frames are discarded immediately after inference.
- **Liveness mandatory** — Every verification attempt is blocked if MiniFASNetV2 flags the presentation as non-live.
- **Accuracy filter on GPS** — Coordinates with >100m accuracy radius are rejected to prevent IP-based location spoofing.
- **1:1 scope binding** — Vector search is hard-scoped to the authenticated user's identity.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| **ML Models** | SCRFD (ONNX), ArcFace w600k_r50 (ONNX), MiniFASNetV2 (PyTorch) |
| **Face Processing** | MediaPipe, OpenCV, ONNX Runtime |
| **Backend** | FastAPI, Uvicorn, Python 3.10+ |
| **Vector DB** | PostgreSQL 16 + pgvector, FAISS (fallback) |
| **ORM / Async** | SQLAlchemy (async), `databases`, `asyncpg` |
| **Frontend** | Next.js 15, TypeScript, React 19 |
| **Map Engine** | Leaflet.js 1.9.4, Overpass API, Nominatim |
| **Deployment** | Docker, Docker Compose, Vercel (frontend), ngrok (dev) |

---

## 🔗 Related Repositories

| Repo | Purpose |
|---|---|
| [amrita-geofence-tester](https://github.com/Kv-Logics/amrita-geofence-tester) | Standalone deployment of the Amrita geofencing map for HTTPS GPS testing |

---

## 📄 License

Research project developed under **NITT-CDI / Amrita Vishwa Vidyapeetham** collaboration.  
Campus geospatial data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) — [ODbL License](https://opendatacommons.org/licenses/odbl/).
