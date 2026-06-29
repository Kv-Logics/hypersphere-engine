# Hypersphere Biometric Engine: Face Pipeline & Storage Report

This report documents the architectural specifications, machine learning pipeline, vector storage, and search algorithms implemented in the **Hypersphere Engine**.

---

## 1. Face Detection Models & Fallback Strategy

The engine utilizes a dual-engine strategy for face detection to ensure both precision and resilience:

| Stage | Model / Algorithm | Framework | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Primary** | **MediaPipe Face Detection** | Google MediaPipe | Ultra-lightweight, high-performance face detection delivering relative bounding boxes and 6 facial landmarks (right eye, left eye, nose tip, mouth center, right ear tragus, left ear tragus). |
| **Fallback** | **OpenCV Haar Cascade** | OpenCV (`haarcascade_frontalface_default.xml`) | Robust secondary detector. If MediaPipe is unavailable or fails to initialize, the system falls back to Haar Cascades and estimates keypoints dynamically based on facial ratio metrics. |

---

## 2. End-to-End ML Pipeline Flow

When an image is submitted (via live webcam stream or file upload), it undergoes the following sequential stages:

```
[Raw Image Payload]
       │
       ▼
[Decode BGR via OpenCV]
       │
       ▼
[Face Detector] (MediaPipe / Haar Cascade) ──(No Face)──► [422 Error]
       │
       ▼ (Face Bounding Box & Keypoints)
       ├─────────────────────────────────────────┐
       ▼                                         ▼
[2D Affine Alignment]                  [2.7x Expanded Bounding Box]
       │                                         │
       ▼                                         ▼
[112x112 RGB Crop]                     [80x80 BGR Crop]
       │                                         │
       ▼                                         ▼
[Quality Assessment]                   [MiniFASNetV2 PyTorch Model]
(Laplacian Blur & Brightness)                    │
       │                                         ▼
       ▼                                   [Liveness Score]
[ArcFace ResNet-50 ONNX]
       │
       ▼
[512-D Normalized Embedding]
```

### Key Stages Explained:
1. **Context Expansion for Liveness**: The liveness model requires background context. The face bounding box is expanded by a factor of **2.7x** before cropping.
2. **Liveness Estimation**: The 80x80 BGR crop is passed to the **MiniFASNetV2** model. The model computes a Softmax probability distribution over 3 classes. Class 1 corresponds to a real face:
   $$\text{Liveness Score} = P(\text{Class 1})$$
3. **2D Affine Alignment**: The original face is aligned using eye and nose tip landmarks mapped to standard template coordinates:
   $$\text{DST\_PTS} = \begin{bmatrix} 38.2946 & 51.6963 \\ 73.5318 & 51.5014 \\ 56.0252 & 71.7366 \end{bmatrix}$$
   The affine transformation matrix is calculated using least-squares estimation (`cv2.estimateAffinePartial2D`), and the face is warped to $112 \times 112$ pixels.
4. **Quality Gates**:
   - **Focus (Blur)**: Computed via the variance of the Laplacian of the gray-scaled aligned face. Faces below a threshold of `0.35` are rejected.
   - **Illumination**: Checks the average pixel intensity (brightness). Must be between `50` and `220` to prevent under/overexposure.
5. **Feature Extraction**: The aligned RGB crop is normalized to the $[-1.0, 1.0]$ range and passed to the **ONNX ArcFace (ResNet-50 backbone)** model, yielding a 512-dimensional vector.
6. **L2 Normalization**: The raw embedding vector $E_{\text{raw}}$ is normalized to unit length to ensure dot-product calculations yield true cosine similarity:
   $$E_{\text{norm}} = \frac{E_{\text{raw}}}{\|E_{\text{raw}}\|_2}$$

---

## 3. Database Schema & Embedding Storage

All metadata and biometric data are stored in a relational **PostgreSQL** database. 

### SQL Schema (`faculty` Table)
Biometric vectors are persisted directly inside the PostgreSQL directory table using the native `pgvector` extension:

```sql
CREATE TABLE faculty (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    emp_id VARCHAR(50),
    department VARCHAR(100),
    designation VARCHAR(100),
    face_status VARCHAR(20) NOT NULL DEFAULT 'none',
    embedding vector(512),  -- Native pgvector 512-D column
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true
);
```

### High-Performance Indexing
To support sub-millisecond vector similarity search at scale, a Hierarchical Navigable Small World (**HNSW**) index is constructed over the cosine distance operator:

```sql
CREATE INDEX IF NOT EXISTS faculty_embedding_cos_hnsw_idx 
ON faculty USING hnsw (embedding vector_cosine_ops);
```

---

## 4. Vector Search & Verification Query

During attendance verification, the query embedding $Q$ is compared against all active profiles in the database.

### The Cosine Distance Algorithm
The system uses the cosine distance operator (`<=>`) of pgvector. Cosine similarity is derived mathematically as:

$$\text{Cosine Similarity} = 1 - \text{Cosine Distance}(Q, E)$$
$$\text{Cosine Similarity} = 1 - \left( 1 - \frac{Q \cdot E}{\|Q\|_2 \|E\|_2} \right) = Q \cdot E \quad (\text{since } \|Q\|_2 = \|E\|_2 = 1)$$

### SQL Execution
The FastAPI backend runs the following optimized raw SQL query via SQL Alchemy:

```sql
SELECT 
    id, 
    name, 
    (1 - (embedding <=> CAST(:query_val AS vector(512)))) AS similarity
FROM faculty
WHERE is_active = true AND embedding IS NOT NULL
ORDER BY embedding <=> CAST(:query_val AS vector(512))
LIMIT :limit;
```

### Verification Decision Logic
1. **Liveness Gating**: If the liveness score is $< 0.40$, access is rejected immediately as a spoof attempt.
2. **Similarity Gating**: The nearest neighbor (`top_k=1`) is retrieved. If the similarity score is $\ge 0.45$ (the matching threshold), the face is **CONFIRMED** as a match.
3. **Transaction Logging**: The transaction is logged into the `attendance_records` table containing the scores, timestamp, and device ID.
