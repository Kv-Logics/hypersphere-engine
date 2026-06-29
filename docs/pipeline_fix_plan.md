# Hypersphere Pipeline Fix Plan (v2.0)

Prioritized implementation plan addressing all 22 issues from [task.md](file:///home/kv/Projects/NITT-CDI/hypersphere-engine/task.md) and refined based on the [task2.0-sugesstion.md](file:///home/kv/Projects/NITT-CDI/hypersphere-engine/task2.0-sugesstion.md) design review.

---

## Priority Classification

| Priority | Meaning | Timeline |
|:---|:---|:---|
| 🔴 **P0 – Critical** | Directly degrades accuracy or security. Fix first. | Immediate |
| 🟡 **P1 – Important** | Significant quality/robustness gaps. Fix next. | This sprint |
| 🟢 **P2 – Hardening** | Production polish. Can ship without, but should add. | Next sprint |
| ⚪ **P3 – Future** | Architectural improvements for scale. | Backlog |

---

## Phase 1: Detection & Alignment Overhaul (P0)

These are the root-cause issues. Everything downstream depends on accurate detection and alignment.

### Fix 1 — Replace MediaPipe + Haar Cascade with SCRFD-2.5G
> Issues addressed: **#1 (MediaPipe weakness), #2 (Haar Cascade removal), #3 (Fake mouth landmarks), #8 (No confidence filter), #9 (Single face selection)**

**What changes:**

| File | Change |
|:---|:---|
| `backend/app/core/pipeline.py` | Replace `load_detection()` entirely. Remove MediaPipe and Haar imports. Load SCRFD-2.5G ONNX session. |
| `backend/app/config.py` | Add `DETECTION_MODEL_PATH = "models/scrfd_2.5g_bnkps.onnx"` and `DETECTION_THRESHOLD = 0.50`. |
| `setup.sh` | Add SCRFD-2.5G weight download step. |

**Why SCRFD-2.5G:**
- Single ONNX file, same inference pattern as ArcFace.
- Returns **5-point landmarks** natively (both eye centers, nose, both mouth corners) — eliminates fake landmark estimation entirely.
- Returns detection **confidence score** per face.
- We select the face with the largest area that matches `confidence > DETECTION_THRESHOLD`.
- Works reliably at large pose, distance, and occlusion.

### Fix 2 — Proper Pose Estimation via SolvePnP
> Issues addressed: **#4 (Heuristic pose estimation)**

**What changes:**

| File | Change |
|:---|:---|
| `backend/app/core/pipeline.py` | Replace roll/yaw/pitch heuristics with `cv2.solvePnP` mapping native 2D keypoints to a canonical 3D face model. |

**Implementation:**
```python
# 3D reference model (generic frontal face proportions)
FACE_3D_MODEL = np.array([
    [-30.0,  32.0, -10.0],  # Right eye
    [ 30.0,  32.0, -10.0],  # Left eye
    [  0.0,   0.0,   0.0],  # Nose
    [-25.0, -28.0,  -5.0],  # Right mouth
    [ 25.0, -28.0,  -5.0],  # Left mouth
], dtype=np.float64)

# Camera matrix (approximated from image dimensions)
focal_length = w
camera_matrix = np.array([
    [focal_length, 0, w/2],
    [0, focal_length, h/2],
    [0, 0, 1]
], dtype=np.float64)

_, rvec, tvec = cv2.solvePnP(FACE_3D_MODEL, landmarks_2d, camera_matrix, None)
rmat, _ = cv2.Rodrigues(rvec)
# Extract Euler angles -> Yaw, Pitch, Roll in degrees
```

**Thresholds (configurable in `config.py`):**
*   `MAX_YAW: float = 35.0`
*   `MAX_PITCH: float = 30.0`
*   `MAX_ROLL: float = 25.0`

---

## Phase 2: Quality Assessment Upgrade (P0–P1)

### Fix 3 — Comprehensive Quality Gates
> Issues addressed: **#5 (Blur threshold), #6 (Brightness check), #10 (Occlusion), #17 (Enrollment verification)**

**What changes:**

| File | Change |
|:---|:---|
| `backend/app/core/pipeline.py` | Replace simple blur+brightness with multi-factor quality scoring. |
| `backend/app/config.py` | Add quality threshold settings. |

**Quality factors (computed from the aligned 112×112 crop):**

| Factor | Method | Reject When |
|:---|:---|:---|
| **Blur** | Laplacian variance, normalized by image area | `score < dynamic_threshold` |
| **Illumination** | Histogram spread (std of grayscale) | `std < 25` (poor lighting) |
| **Contrast** | `(max - min) / (max + min)` Michelson contrast | `contrast < 0.15` |
| **Face Size** | Bounding box pixel area relative to frame | `box_w < 80px` or `box_w < 0.08 * frame_w` |
| **Resolution** | Ratio of `source_crop_size / 112` | `ratio < 0.75` (upscaled from < 84px) |
| **Pose** | SolvePnP angles (from Fix 2) | Exceeds yaw/pitch/roll thresholds |
| **Occlusion** | Lower-face landmark visibility ratio | Estimated from mouth/nose distances |

**Enrollment-specific stricter gates** (addresses #17):
*   `ENROLL_MIN_QUALITY = 0.50` (stricter than verify `0.35`)
*   `ENROLL_MAX_YAW = 20.0`, `ENROLL_MAX_PITCH = 15.0`, `ENROLL_MAX_ROLL = 15.0` (must be frontal)

---

## Phase 3: Verification Logic Hardening (P1)

### Fix 4 — Score Margin / Ambiguous Match Detection
> Issues addressed: **#15 (No score margin)**

**What changes:**

| File | Change |
|:---|:---|
| `backend/app/api/endpoints.py` | Fetch `top_k=3` instead of `top_k=1`. Check margin between top-1 and top-2 matches. |
| `backend/app/models/schemas.py` | Add `MANUAL_REVIEW` as a possible status. |
| `backend/app/config.py` | Add `AMBIGUITY_MARGIN = 0.03`. |

```python
results = await vector_index.search(embedding, top_k=3)
if len(results) >= 2:
    top_sim = results[0][1]
    second_sim = results[1][1]
    # Flag as ambiguous if the difference between the two closest matches is narrow
    if top_sim >= MATCH_THRESHOLD and (top_sim - second_sim) < AMBIGUITY_MARGIN:
        decision_status = "MANUAL_REVIEW"
```

### Fix 5 — Duplicate Search Before Enrollment
> Issues addressed: **#14 (No duplicate search)**

**What changes:**

| File | Change |
|:---|:---|
| `backend/app/api/endpoints.py` | Run `vector_index.search(embedding, top_k=1)`. If similarity > `DUPLICATE_SEARCH_THRESHOLD` (default 0.70), reject enrollment. |

```python
dup_results = await vector_index.search(embedding, top_k=1)
if dup_results and dup_results[0][1] > settings.DUPLICATE_SEARCH_THRESHOLD:
    dup_id = dup_results[0][0]
    if dup_id != faculty_id:
        raise HTTPException(409, f"This face is already registered under ID '{dup_id}'.")
```

### Fix 6 — Embedding Quality Gate (Calibrated)
> Issues addressed: **#12 (No embedding quality check)**

**What changes:**
*   To avoid hardcoding an arbitrary threshold, run a **calibration step** at startup using 200–500 valid face captures to find:
    $$\text{Threshold} = \text{mean}(\text{norms}) - 2 \times \text{std}(\text{norms})$$
*   Store this in configuration as `EMBEDDING_QUALITY_THRESHOLD`.
*   During inference, reject if `np.linalg.norm(embedding) < EMBEDDING_QUALITY_THRESHOLD`.

---

## Phase 4: Enrollment Robustness (P1–P2)

### Fix 7 — Multi-Embedding Enrollment Table
> Issues addressed: **#13 (Single embedding)**

**What changes:**
*   **Discard Running Centroids**: Centroids lose useful variation.
*   **Database Table**: Create a dedicated table `face_embeddings`:
    `id (PK)`, `faculty_id (FK)`, `embedding (vector(512))`, `model_version`, `created_at`
*   Allow storing up to **15 embeddings** per faculty member.
*   At search time, fetch all candidate embeddings, and calculate cosine similarity against all of them. Use the highest individual similarity score. 
*   *Storage footprint*: ~21 MB total database size for 700 users — negligible.

### Fix 8 — Model Version Tracking
> Issues addressed: **#18 (No model version tracking)**

**What changes:**
*   Store `embedding_model = "arcface_w600k_r50_v1"` in the `face_embeddings` table.
*   Prevent loading or matching index features from mismatched model versions.

---

## Phase 5: Liveness & Multi-Frame (P2)

### Fix 9 — Multi-Frame Embedding Averaging
> Issues addressed: **#7 (Single frame), #11 (Liveness weakness)**

**What changes:**
*   **Frontend**: Capture a stream of 5 to 7 frames over ~1.5s. Send them as a multipart batch.
*   **Backend Processing**:
    1. Extract embeddings for all frames.
    2. Drop the frame with the lowest quality score.
    3. Calculate the **mean embedding vector** of the remaining frames.
    4. Normalize the averaged embedding, then execute vector search.
*   **Liveness Score**: Average the liveness prediction scores from `MiniFASNetV2` across all frames to filter out transient video/replay attack frames.

### Fix 10 — Adaptive Thresholds
> Issues addressed: **#16 (Fixed threshold)**

**What changes:**
*   Adjust matching threshold dynamically based on face pose and lighting quality:
    $$\text{Threshold}_{\text{effective}} = \text{Threshold}_{\text{base}} + (1 - \text{Quality}) \times 0.15$$
    *(This demands a tighter similarity limit for noisy/poor quality inputs).*

---

## Phase 6: Runtime & Concurrency (P2–P3)

### Fix 11 — Persistent Detector Instance
> Issues addressed: **#21 (Memory efficiency)**
*   The SCRFD detector ONNX Session is loaded once at startup and run persistently (no per-request creation overhead).

### Fix 12 — Thread Concurrency Setup
> Issues addressed: **#22 (Thread safety)**
*   **ONNX Concurrency**: Do **not** use `threading.Lock` around ONNX `session.run()` (recognition and detection). ONNX Runtime is optimized for concurrent read threads.
*   **PyTorch Concurrency**: Only wrap `MiniFASNetV2` inference with a thread lock if performance/stress testing shows thread issues in the PyTorch CPU/GPU environment.

---

## Phase 7: Drift & Maintenance (P3 – Backlog)

### Fix 14 — Embedding Drift Refresh with Admin Approval
> Issues addressed: **#19 (No drift update)**
*   **No Auto-Drift**: Automated drift updates risk database corruption (e.g. accepting a relative).
*   **Drift Review**: If a verification match is highly confident (e.g., similarity $> 0.88$) but slightly drifted from the baseline profile, queue a `drift_review_pending` flag in the DB.
*   **Admin Console**: Provide a tab in the admin panel to allow administrators to review and approve/reject profile refreshes.

---

## Model Recommendation Stack

*   **Detection**: **SCRFD-2.5G** (ONNX, ~4 MB) — provides native 5-point landmark extraction with high speed.
*   **Recognition**: **ArcFace w600k_r50** (ONNX, ~170 MB) — kept as-is.
*   **Liveness**: **MiniFASNetV2** (PyTorch, ~1.8 MB) — kept + upgraded with multi-frame averaging.
*   **Quality**: **MagFace approximation** (uses ArcFace embedding vector norm, 0 MB overhead).
