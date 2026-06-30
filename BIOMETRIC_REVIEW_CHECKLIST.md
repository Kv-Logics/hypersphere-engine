# Biometric Architecture & Latency Review Checklist

This checklist tracks the resolution status and code changes implemented for the 22 architectural review items and 9 latency analysis items raised in the technical review.

## Architecture & Model Consistency Review

- [x] **Item 1: Major Contradiction: Detection Model**
  * **File Location**: `backend/app/core/pipeline.py` & `BIOMETRIC_PIPELINE_REPORT.md`
  * **Implementation**: Standardized references and code execution under **SCRFD-10G ONNX** as the primary face detector. Removed all legacy MediaPipe references.
- [x] **Item 2: Alignment Section Landmark Count**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md`
  * **Implementation**: Corrected the pipeline specification to document the **5-point landmark alignment** (Left Eye, Right Eye, Nose Tip, Left Mouth, Right Mouth) instead of the 3-point template coordinate system.
- [x] **Item 3: Landmark Template Coordinates (DST_PTS)**
  * **File Location**: `backend/app/core/pipeline.py` (lines 11–18) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 3)
  * **Implementation**: Verified that the alignment template uses the exact standard ArcFace 5-point coordinates:
    $$\text{DST\_PTS} = \begin{bmatrix} 30.2946 & 51.6963 \\ 65.5318 & 51.5014 \\ 48.0252 & 71.7366 \\ 33.5493 & 92.3655 \\ 62.7299 & 92.2041 \end{bmatrix}$$
- [x] **Item 4: Registration Flow Duplicate Check**
  * **File Location**: `backend/app/api/endpoints.py` (lines 173–182 and lines 240–249)
  * **Implementation**: Coded a duplicate search step using `vector_index.search(embedding, top_k=1)` before storing the new face. If similarity matches an existing different user at $\ge$ `settings.DUPLICATE_SEARCH_THRESHOLD` (0.45), throws an `HTTP 409 Conflict` exception.
- [x] **Item 5: Enrollment Image Count**
  * **File Location**: `backend/app/api/endpoints.py` (lines 120–152)
  * **Implementation**: Created the `process_enrollment_files` helper function. The routes `/register` and `/register-admin` now accept both `file: Optional[UploadFile]` and `files: Optional[List[UploadFile]]`. The helper averages valid frame embeddings using `np.mean` and applies L2 re-normalization to produce the final face template.
- [x] **Item 6: Registration Liveness Checks**
  * **File Location**: `backend/app/api/endpoints.py` (lines 142–146)
  * **Implementation**: Integrated liveness checking into `process_enrollment_files`. Enrollment will fail with an `HTTP 422 Unprocessable Entity` exception if the average liveness score falls below `settings.ANTISPOOF_THRESHOLD` (0.40).
- [x] **Item 7: Verification Flow End-to-End Decision**
  * **File Location**: `backend/app/api/endpoints.py` (lines 380–460) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 6)
  * **Implementation**: Documented the full decision pathway: image decoding -> face alignment -> ArcFace extraction -> pgvector Top-K lookup -> margin and matching threshold gates -> PostgreSQL transaction logging -> JSON response.
- [x] **Item 8: Security Mode Normalization Math**
  * **File Location**: `backend/app/api/endpoints.py` (lines 320–355) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 6)
  * **Implementation**: Coded multi-frame representation by extracting individual embeddings, calculating the mean vector, and applying L2 re-normalization before database vector search.
- [x] **Item 9: Top-K and Margin Checks**
  * **File Location**: `backend/app/api/endpoints.py` (lines 390–402)
  * **Implementation**: Implemented query logic returning the top $K=3$ candidate matches, enforcing matching threshold gates and verifying the ambiguity margin (`similarity_score - second_similarity >= settings.AMBIGUITY_MARGIN`) to prevent cross-matching.
- [x] **Item 10: HNSW Index Parameters**
  * **File Location**: `backend/app/db/database.py` (lines 111–120) & `backend/app/db/vector_index.py` (lines 81–87)
  * **Implementation**: Configured PostgreSQL index creation with explicit HNSW parameters `WITH (m = 16, ef_construction = 64)`. In `vector_index.py`, executing query-time queue depth limits (`SET hnsw.ef_search = 40;`) within a transaction block.
- [x] **Item 11: Similarity Threshold Selection**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 7)
  * **Implementation**: Documented calibration of the `0.45` similarity threshold based on ROC curve verification on validation datasets targeting FAR/FRR tradeoffs.
- [x] **Item 12: Liveness Threshold Calibration**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 7)
  * **Implementation**: Documented calibration of the `0.40` liveness threshold validated against CASIA-SURF and CelebA-Spoof.
- [x] **Item 13: Enrollment Quality Gates**
  * **File Location**: `backend/app/core/pipeline.py` (lines 250–290) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 5)
  * **Implementation**: Coded quality checks: Focus Blur (Laplacian variance), Illumination intensity, Contrast ratio, Face sizing bounds, Resolution limits, and Roll/Pitch/Yaw pose angles.
- [x] **Item 14: Mathematical Completeness of Averaging**
  * **File Location**: `backend/app/api/endpoints.py` (lines 142–152) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 6)
  * **Implementation**: Clarified and coded arithmetic mean calculation of multiple vectors, followed by L2 normalization back to unit length.
- [x] **Item 15: Pipeline Error Paths & API Responses**
  * **File Location**: `backend/app/api/endpoints.py` (lines 130–155, 175–205) & `BIOMETRIC_PIPELINE_REPORT.md` (Section 1)
  * **Implementation**: Mapped pipeline exceptions to correct HTTP status codes (`HTTP 422` on quality/liveness failures, `HTTP 409` on duplicate conflict, and `HTTP 500` on database index errors).
- [x] **Item 16: Database Schema Metadata**
  * **File Location**: `backend/app/db/database.py` (lines 14–33, 107–110) & `backend/app/api/endpoints.py` (lines 180–190, 248–258)
  * **Implementation**: Extended the `faculty` table schema to include `embedding_model`, `embedding_created`, `embedding_quality`, and `embedding_count`, saving metadata values upon successful registration.
- [x] **Item 17: Model Versioning**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 2)
  * **Implementation**: Defined model names and versions used (SCRFD-10G, ONNX ArcFace ResNet-50, MiniFASNetV2).
- [x] **Item 18: API Abstraction Layers**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 1)
  * **Implementation**: Documented layers mapping (Client -> FastAPI Router -> Service Pipeline -> Vector Database).
- [x] **Item 19: Latency Budgets Calibration**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Replaced static estimates with hardware-agnostic latency benchmark ranges based on CPU execution speeds.
- [x] **Item 20: Latency Variables & Assumptions**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Listed runtime variables that affect system timing (cores/concurrency, input frame dimensions, network upload bandwidth, serialization format).
- [x] **Item 21: Database Schema Integration**
  * **File Location**: `backend/app/db/database.py` & `BIOMETRIC_PIPELINE_REPORT.md` (Section 4)
  * **Implementation**: Documented the full schema schemas of the tables `faculty` and `attendance_records`.
- [x] **Item 22: System Architecture Diagram**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 1)
  * **Implementation**: Added the end-to-end flowchart from Webcam capture to attendance updates.

---

## Latency Analysis Review

- [x] **Latency Item 1: MediaPipe vs SCRFD CPU Latency Variance**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 2A)
  * **Implementation**: Labeled SCRFD performance as hardware and resolution dependent, showing standard ranges from 15ms (640x480) up to 150ms (1080p).
- [x] **Latency Item 2: Webcam Resolution & Pixel Count Impact**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Explained the pixel workload differences ($6.75\times$ more data for 1080p compared to 480p streams).
- [x] **Latency Item 3: ArcFace Inference Benchmarks**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Clarified that ResNet-50 inference is 8–20ms under single-thread conditions but scales under thread concurrency or process locks.
- [x] **Latency Item 4: "Comparing 512 dimensions" Misnomer**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 6)
  * **Implementation**: Corrected description to explain that comparison calculations occur in pgvector using cosine distance rather than during model inference.
- [x] **Latency Item 5: CPU Contention Overhead**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Added processor core saturation under concurrent HTTP socket requests as a primary timing variable.
- [x] **Latency Item 6: JPEG Encode/Upload/Decode Bottleneck**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Highlighted network serialization and raw byte decoding times as a distinct stage in the comparison budget table.
- [x] **Latency Item 7: Sequential Execution Multiplier**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Documented the multiplier effect of processing 5 sequential frames for detection, representation, and liveness steps.
- [x] **Latency Item 8: GPU Execution Provider Alternatives**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Documented alternative ONNX execution engines (`CUDAExecutionProvider`, `TensorRT`, `DirectML`) that utilize hardware acceleration to speed up verification to sub-50ms.
- [x] **Latency Item 9: MiniFASNetV2 Timing Integration**
  * **File Location**: `BIOMETRIC_PIPELINE_REPORT.md` (Section 8)
  * **Implementation**: Included MiniFASNetV2 CPU execution latency (~20–80ms per frame) in the total transaction budget table.
