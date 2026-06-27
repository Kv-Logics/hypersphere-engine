# Feature F-01: Biometric Verification Pipeline

## 📖 Overview
The Biometric Verification Pipeline is responsible for ingest, preprocessing, alignment, anti-spoofing validation (liveness), and extraction of unique identity embeddings from facial imagery.

---

## 🛠️ Implementation Details

### 1. Face Detection & Landmark Extraction
*   **Engine:** MediaPipe Face Detection
*   **Details:** We extract the bounding box and 3 crucial landmarks: Right Eye, Left Eye, and Nose Tip.
*   **File Location:** `backend/app/core/pipeline.py` -> `load_detection()`

### 2. Landmark Alignment (Affine Transform)
*   To achieve robust similarity matching, the raw face is aligned using a 2D Similarity Transform (rigid transformation: translation, rotation, scaling).
*   We map the extracted landmarks to standard face reference coordinates:
    *   **Right Eye:** `[38.2946, 51.6963]`
    *   **Left Eye:** `[73.5318, 51.5014]`
    *   **Nose Tip:** `[56.0252, 71.7366]`
*   **Result:** A normalized, frontal 112x112 pixel crop.

### 3. Anti-Spoofing / Liveness Check
*   **Model:** PyTorch MiniFASNetV2 (`2.7_80x80_MiniFASNetV2.pth`)
*   **Details:** 
    *   We crop the bounding box with a `2.7` expansion factor and resize to `80x80` pixels in BGR order.
    *   The model evaluates color/texture patterns and outputs a 3-class probability: `[Live, Print Spoof, Replay Spoof]`.
    *   Only frames with a `Live` probability above the configuration threshold (`ANTISPOOF_THRESHOLD = 0.40`) are cleared for recognition.
*   **File Location:** `backend/app/core/pipeline.py` -> `load_liveness()`

### 4. Feature Extraction
*   **Model:** ONNX ArcFace ResNet-50 (`w600k_r50.onnx`)
*   **Details:**
    *   Takes the 112x112 aligned face crop, normalizes the pixel values, and runs inference.
    *   Outputs a 512-dimensional float vector representing the identity fingerprint.
    *   The vector is $L_2$ normalized to enable fast cosine distance comparisons.
*   **File Location:** `backend/app/core/pipeline.py` -> `load_recognition()`

---

## ⚡ Optimizations
1.  **Lazy Model Loading:** Models are loaded once during FastAPI server startup (`lifespan` event) and kept warm in memory.
2.  **ONNX Runtime:** Uses ONNX Runtime for ArcFace inference, which runs significantly faster than vanilla PyTorch on CPU environments.
3.  **Short-Circuiting:** If a frame fails the liveness threshold or has bad quality, the system immediately rejects the presentation and bypasses the ArcFace extraction step, saving CPU cycles.
