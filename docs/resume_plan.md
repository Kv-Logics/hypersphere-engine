# Hypersphere Biometric Pipeline - Session Resume Plan

This plan documents the completed items, pending enhancements, and structural changes made during this session. It serves as a guide for resuming the development of the Hypersphere Biometric Pipeline.

---

## 🚀 Session Accomplishments

We have successfully completed the architectural transition and hardening of the core ML inference and database structures:

1. **Model Weights**:
   - Centralized all models inside the root `models/` directory.
   - Downloaded and verified `scrfd_2.5g_bnkps.onnx` (Sample-and-Compute Redistribution for Face Detection).
   - Removed external `SilentFace` repository dependencies.

2. **Detection & Alignment Overhaul (Fix 1 & 2)**:
   - Built a lightweight, pure ONNX Runtime and NumPy-based wrapper `app.core.scrfd.py` for SCRFD-2.5G face detection and 5-point landmark extraction.
   - Replaced MediaPipe and OpenCV Haar Cascade references.
   - Implemented 3D pose estimation using `cv2.solvePnP` mapping native 2D keypoints to a canonical 3D model to calculate exact roll, pitch, and yaw.

3. **Multi-Factor Quality Gates (Fix 3 & 6)**:
   - Replaced basic heuristics with multi-factor check bounds:
     - **Blur**: Laplacian variance normalized to 112x112 baseline.
     - **Illumination**: Histogram spread and average brightness bounds.
     - **Contrast**: Michelson contrast.
     - **Resolution**: Bounding box size ratio checks.
     - **Pose limits**: Hard yaw/pitch/roll checks.
   - Implemented stricter thresholds for enrollment (`is_enrollment=True`) compared to verification.
   - Checked L2 norm of the raw embedding vector against `EMBEDDING_QUALITY_THRESHOLD` before normalization.

4. **Multi-Embedding Database Table (Fix 7 & 8)**:
   - Added a dedicated `face_embeddings` table to support up to 15 face embeddings per faculty member.
   - Updated `init_db()` to automatically run HNSW index configuration and a zero-downtime data migration transferring existing embeddings.
   - Updated `VectorIndexManager` to search and write to the new table, keeping the highest similarity match per user.

5. **Security & Review Workflows (Fix 4, 5 & 14)**:
   - **Duplicate Detection**: Searches for existing faces before permitting new registration.
   - **Ambiguity Margin**: Flags matches with small similarity gaps (`< 0.03`) between top-1 and top-2 candidates as `MANUAL_REVIEW`.
   - **Borderline Liveness**: Flags live checks near the threshold as `MANUAL_REVIEW`.
   - **Drift Review Administration**: Automatically logs confirmed matches under 0.62 similarity to `face_embeddings` with `drift_review_pending = True` and added `/admin/drift-requests` approval/rejection endpoints.

---

## 🛠️ Modified & New Files

| File Path | Status | Role |
|:---|:---|:---|
| `backend/app/config.py` | Modified | Added detection parameters, duplicate thresholds, ambiguity margin. |
| `backend/app/core/scrfd.py` | **New** | SCRFD-2.5G ONNX detector class with NMS. |
| `backend/app/core/pipeline.py` | Modified | Upgraded face pipeline containing SolvePnP and quality gates. |
| `backend/app/db/database.py` | Modified | Defined `face_embeddings` table schema, index, and migrations. |
| `backend/app/db/vector_index.py` | Modified | Managed multi-vector search and write operations. |
| `backend/app/api/endpoints.py` | Modified | Updated `/register`, `/verify`, and added `/admin/drift-requests` endpoints. |
| `backend/app/api/face_requests.py` | Modified | Updated admin approval endpoint with enrollment and duplicate gates. |
| `backend/app/models/schemas.py` | Modified | Added `DriftRequestResponse` schema. |
| `scripts/download_models.py` | Modified | Registered `scrfd_2.5g_bnkps.onnx` in the download catalog. |

---

## 📋 Next Steps (Pending Work)

When resuming, focus on the remaining fixes in the blueprint:

1. **Calibration Utility (Fix 6)**:
   - Write a script to calculate dynamic `EMBEDDING_QUALITY_THRESHOLD = mean(norms) - 2 * std(norms)` using 200–500 valid captures.

2. **Multi-Frame Embedding Averaging (Fix 9)**:
   - Update frontend to send 5-7 frames in batch.
   - Process batches in `process_image` by filtering lowest quality and computing mean embedding.

3. **Adaptive Thresholds (Fix 10)**:
   - Dynamically adjust matching thresholds based on quality score:
     $$\text{Threshold}_{\text{effective}} = \text{Threshold}_{\text{base}} + (1 - \text{Quality}) \times 0.15$$

4. **Drift Admin UI Integration**:
   - Update the admin dashboard HTML/JS to list pending drift review requests and wire up approve/reject buttons.
