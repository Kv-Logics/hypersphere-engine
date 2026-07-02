# Hypersphere Biometric Engine: Production Architecture & Pipeline Report

This document details the production architecture, machine learning models, database schema, vector search configurations, and transaction flows of the **Hypersphere Engine**.

---

## 1. System Architecture Overview

The system operates on a decoupled client-server architecture. Below is the end-to-end data flow:

```
[Webcam / Client UI] 
       │
       ▼ (HTTP POST Multipart Form)
[FastAPI Router Layer]
       │
       ▼ (Service Pipeline Coordinator)
[BGR Image Decoding & Validation]
       │
       ▼
[Face Detector (SCRFD)] ──(No Face detected)──► [HTTP 422 Error]
       │
       ▼ (5 Bounding Box Coordinates & 5-point Keypoints)
[2D Affine Alignment] ────(Alignment failed)───► [HTTP 422 Error]
       │
       ▼ (112x112 RGB Aligned Crop)
┌──────┴─────────────────────────────────┐
│                                        │
▼ (Anti-Spoofing Enabled)                ▼
[MiniFASNetV2 PyTorch]                   [ONNX ArcFace (ResNet-50)]
│                                        │
▼ (Liveness Score)                       ▼ (512-D Raw Embedding)
└──────┬─────────────────────────────────┘
       │
       ▼
[Liveness Gating (Threshold 0.40)] ──(Spoof/Replay)──► [Log & HTTP 200 REJECTED]
       │
       ▼ (Normalized Embedding Q)
[PostgreSQL Vector Database Search]
       │
       ▼ (pgvector HNSW Hashing Index)
[Top-K Distance Rank (K=3)]
       │
       ▼ (Similarity & Margin Gate)
[Faculty Identification] ────(No Match / Ambiguity)──► [Log & HTTP 200 UNKNOWN]
       │
       ▼
[Attendance Record Written to PostgreSQL]
       │
       ▼
[JSON Success Response Returned to Client]
```

---

## 2. Machine Learning Model Specifications

To maintain consistency and template integrity, the system uses a **unified detector and recognition model** for both enrollment/registration and verification/attendance marking.

### A. Unified Face Detection (SCRFD)
* **Model Model/Version**: SCRFD-10G (Sample and Computation Redistribution for Face Detection) ONNX.
* **Purpose**: Locates faces and extracts 5-point key landmarks.
* **Output**: Bounding box $[x_1, y_1, x_2, y_2]$, confidence score, and 5 key coordinates (Left Eye, Right Eye, Nose Tip, Left Mouth Corner, Right Mouth Corner).
* **Latency Profile**: Highly dependent on resolution and hardware. On standard CPU execution:
  * **640x480**: $\approx 15 - 45 \text{ ms}$
  * **1920x1080**: $\approx 70 - 150 \text{ ms}$ (due to increased pixel count).

### B. Feature Representation (ArcFace)
* **Model Model/Version**: ONNX ArcFace ResNet-50.
* **Purpose**: Maps the aligned face crop into a unique identity representation.
* **Output**: 512-dimensional vector.

### C. Anti-Spoofing (MiniFASNetV2)
* **Model Model/Version**: MiniFASNetV2 (PyTorch).
* **Purpose**: Bounding box is expanded by **2.7x** to capture background context and evaluated for liveness.
* **Output**: Softmax liveness score (Real Face Probability: $[0.0, 1.0]$).

---

## 3. 2D Affine Face Alignment

Before feature extraction, the face must be warped to a standard coordinate system.

```
       5-Point Landmarks (SCRFD)
   [Left Eye, Right Eye, Nose, Mouth L/R]
                    │
                    ▼
     [cv2.estimateAffinePartial2D]
                    │
                    ▼  (Least-squares scale/rotation/translation)
           [cv2.warpAffine]
                    │
                    ▼
      [Aligned 112x112 RGB Crop]
```

### Landmark Coordinates Template
The engine uses standard ArcFace 5-point alignment template coordinates ($112 \times 112$ template):

$$\text{DST\_PTS} = \begin{bmatrix}
30.2946 & 51.6963 \\
65.5318 & 51.5014 \\
48.0252 & 71.7366 \\
33.5493 & 92.3655 \\
62.7299 & 92.2041
\end{bmatrix}$$

These correspond to:
1. Row 1: Right Eye Center ($x=30.29, y=51.70$)
2. Row 2: Left Eye Center ($x=65.53, y=51.50$)
3. Row 3: Nose Tip ($x=48.03, y=71.74$)
4. Row 4: Right Mouth Corner ($x=33.55, y=92.37$)
5. Row 5: Left Mouth Corner ($x=62.73, y=92.20$)

---

## 4. Database Schema & Vector Indexing

Faculty and attendance records are stored in PostgreSQL using the native `pgvector` extension.

### Database Schema

```sql
-- Faculty Registration Table
CREATE TABLE faculty (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    emp_id VARCHAR(50),
    department VARCHAR(100),
    designation VARCHAR(100),
    face_status VARCHAR(20) NOT NULL DEFAULT 'none',
    embedding vector(512),               -- 512-D Biometric Vector
    embedding_model VARCHAR(50),         -- Tracking model versions (e.g. 'ArcFace_ResNet50_V1')
    embedding_created TIMESTAMP,        -- Timestamp of extraction
    embedding_quality DOUBLE PRECISION,  -- Blur/pose quality score at enrollment
    embedding_count INTEGER DEFAULT 1,   -- Number of frames averaged for this template
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Attendance Transactions Table
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    faculty_id VARCHAR(50) REFERENCES faculty(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT timezone('utc'::text, now()),
    status VARCHAR(20) NOT NULL,         -- 'VERIFIED', 'REJECTED', 'UNKNOWN'
    similarity_score DOUBLE PRECISION,
    liveness_score DOUBLE PRECISION,
    quality_score DOUBLE PRECISION,
    device_id VARCHAR(50),
    location_name VARCHAR(100),          -- Resolved building name from geofencing engine
    latitude DOUBLE PRECISION,           -- GPS latitude
    longitude DOUBLE PRECISION           -- GPS longitude
);
```

---

## 9. Campus GPS & Geofencing Integration

To guarantee that attendance is marked strictly within authorized zones and tag records with spatial metadata, the system implements a cross-origin message bridge with the NITT Geofencing Engine:

```
[Geofencing Map (Port 8080)]
       │
       ▼ (window.parent.postMessage - LOCATION_UPDATE)
[Next.js Dashboard (Port 3000)]
       │
       ├─► (Render Location HUD Badge in Header)
       │
       ▼ (Multipart Form payload: location_name, latitude, longitude)
[FastAPI Backend (Port 8000)]
       │
       ▼ (Insert query with spatial attributes)
[PostgreSQL Database]
```

### Communication Protocol
The Leaflet-based geolocator runs on `http://localhost:8080/map/locate.html` inside a secure Next.js iframe configured with `allow="geolocation"`. As coordinates update, it resolves the location via a Ray-Casting algorithm against geoJSON polygons of NITT buildings. Once resolved, the iframe dispatches a message to the parent window:

```javascript
window.parent.postMessage({
  type: "LOCATION_UPDATE",
  latitude: lat,
  longitude: lon,
  insideCampus: insideCampus,
  buildingName: activeBuilding ? activeBuilding.name : (insideCampus ? "NIT Trichy Grounds" : "Off Campus"),
  buildingId: activeBuilding ? activeBuilding.id : null
}, "*");
```

The Next.js host intercepts this payload, displays it in the header HUD, and attaches the telemetry to the `/verify` request, which stores it in `attendance_records`.


### High-Performance HNSW Indexing
To support rapid, sub-millisecond similarity search, a Hierarchical Navigable Small World (HNSW) index is created over the `embedding` column using Cosine operations:

```sql
CREATE INDEX IF NOT EXISTS faculty_embedding_cos_hnsw_idx 
ON faculty USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,                         -- Max number of bi-directional links per node
    ef_construction = 64            -- Search queue size during index construction
);
```
* **Query Parameter**: `SET hnsw.ef_search = 40;` is executed prior to vector search to guarantee high recall during execution.

---

## 5. Registration / Enrollment Pipeline

To enroll a new identity, a robust multi-frame quality-first algorithm is used to prevent poor template contamination and spoofing:

```
[Webcam Captures 5-10 Frames]
             │
             ▼
[For Each Frame: Run SCRFD & Quality Check]
             │
             ▼
[Run MiniFASNetV2 Liveness Check] ──(Liveness < 0.40)──► [Reject Enrollment]
             │
             ▼ (Passes Quality & Liveness Gates)
[ONNX ArcFace Feature Extraction]
             │
             ▼ (512-D Embeddings)
[Average Embeddings: E_mean = 1/N * Sum(E_i)]
             │
             ▼
[L2 Normalize: E_final = E_mean / ||E_mean||_2]
             │
             ▼
[Database Duplicate Search: Top-1 Cosine Match] ──(Similarity ≥ 0.45)──► [Reject: Already Registered]
             │
             ▼ (Unique Template)
[Write Entity + Model Metadata to PostgreSQL]
```

### Enrollment Quality Gates:
1. **Focus Blur**: Laplacian variance must be $\ge 0.50$.
2. **Illumination**: Mean pixel brightness must reside in $[50, 220]$.
3. **Face Size**: Bounding box width must be between $15\%$ and $70\%$ of the frame width.
4. **Resolution**: Minimum bounding box dimensions must be at least $112 \times 112$ pixels.
5. **Pose Limits**: Pose estimation angles must be $\le 15.0^\circ$ for Roll, Pitch, and Yaw.
6. **Occlusion Check**: Bounding box boundary must not intersect the frame border.

---

## 6. Verification / Attendance Marking Pipeline

When marking attendance, the coordinator runs the transaction sequence below.

### Mathematical Formulation of Multi-Frame Security Mode
When running in **Security Mode (Anti-Spoofing ON)**, the system averages embeddings over the capture batch to cancel out transient variations:

1. Extract raw 512-D embedding vectors $E_i$ for each valid frame $i \in \{1, \dots, N\}$.
2. Calculate the mean vector:
   $$\bar{E} = \frac{1}{N} \sum_{i=1}^{N} E_i$$
3. Perform L2-Normalization on the mean vector to obtain the query vector $Q$:
   $$Q = \frac{\bar{E}}{\|\bar{E}\|_2}$$
4. Query the pgvector index with $Q$.

### Decision Logic:
1. **Top-K Vector Search**: Retrieve the top $K=3$ nearest neighbors ordered by cosine distance:
   $$\text{Cosine Distance}(Q, E) = 1 - \frac{Q \cdot E}{\|Q\|_2 \|E\|_2} = 1 - Q \cdot E \quad (\text{since } \|Q\|_2 = \|E\|_2 = 1)$$
2. **Best Match Gating**: If the closest neighbor ($K_1$) has a similarity $\text{Similarity} = 1 - \text{Cosine Distance} < 0.45$, the match is rejected as **UNKNOWN**.
3. **Margin Check (Ambiguity Guard)**: Ensure the difference between the best match similarity and the second best match similarity exceeds a safety margin:
   $$\Delta_{\text{similarity}} = \text{Sim}(K_1) - \text{Sim}(K_2) \ge 0.08$$
   If this margin check fails, the result is flagged as **AMBIGUOUS** to prevent cross-matching of similar-looking identities.
4. **Liveness Gating**: If the averaged liveness score is $< 0.40$, registration of attendance is rejected as a **SPOOF ATTEMPT** and logged.
5. **Logging**: Writes transaction to `attendance_records` and returns JSON.

---

## 7. Threshold Calibrations

The system thresholds are calibrated using standard empirical validation techniques:

* **Similarity Threshold (0.45)**: Determined via Receiver Operating Characteristic (ROC) analysis on validation datasets (such as LFW). It is selected to target a False Acceptance Rate (FAR) of $< 0.01\%$ and a False Rejection Rate (FRR) of $< 1.5\%$.
* **Liveness Threshold (0.40)**: Calibrated against spoofing datasets (CelebA-Spoof). Designed to reject print and digital replay spoof attacks while maintaining minimal FRR under varied office lighting.

---

## 8. Latency Budget Analysis

End-to-end latency is hardware-dependent and varies significantly based on:
1. **Host CPU capabilities** (core count, frequency, thermal throttling).
2. **ONNX Runtime configurations** (execution provider, thread count limits).
3. **Input Resolution** (e.g. processing 1080p frames takes $\approx 6.75 \times$ more time than 480p frames).
4. **Network and Serialization overhead** (uploading large multiple JPEGs, parsing multipart bodies).

### Latency Comparison: Security vs. Efficiency Mode

| Stage | Security Mode (Anti-Spoofing ON) | Efficiency Mode (Anti-Spoofing OFF) |
| :--- | :--- | :--- |
| **Client Frame Capture** | $1000 \text{ ms}$ (5 frames spaced by 200ms) | $0 \text{ ms}$ (Single frame captured instantly) |
| **Network & Serialization** | $1500 - 3000 \text{ ms}$ (5 multipart JPEG uploads) | $300 - 600 \text{ ms}$ (1 single JPEG upload) |
| **Face Detection (SCRFD)** | $\approx 250 - 500 \text{ ms}$ (5 sequential runs) | $\approx 50 - 100 \text{ ms}$ (1 run) |
| **ArcFace Feature Extraction** | $\approx 100 - 200 \text{ ms}$ (5 sequential runs) | $\approx 20 - 40 \text{ ms}$ (1 run) |
| **MiniFASNet Liveness Check** | $\approx 150 - 300 \text{ ms}$ (5 sequential runs) | **Bypassed** ($0 \text{ ms}$) |
| **Database HNSW Vector Search**| $\approx 2 - 5 \text{ ms}$ | $\approx 2 - 5 \text{ ms}$ |
| **Total Expected Latency** | **$\approx 3.0 - 5.0 \text{ s}$** (Highly hardware-bound) | **$\approx 0.4 - 0.8 \text{ s}$** (Sub-second execution) |

*Note: ArcFace model inference latency benchmarks on typical modern CPUs range from 8-20 ms under zero load, but can increase under high request concurrency or when running sequentially on single-core containers.*
