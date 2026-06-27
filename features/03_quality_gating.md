# Feature F-03: Biometric Quality Gating

## 📖 Overview
To prevent "garbage in, garbage out" scenarios, the engine runs input frames through a set of quality filters *before* running liveness or recognition inference. If the input image is too blurry, too dark, off-angle, or too far away, it is rejected, and helpful instructions are returned to the user.

---

## 🛠️ Implementation Details

The quality checks are defined in `backend/app/core/pipeline.py` inside `process_verification()` and `process_registration()`.

### 1. Blur Detection (Laplacian Variance)
*   **Method:** We compute the Laplacian of the face region and get its variance:
    $$\text{Blur Score} = \text{Var}(\Delta I)$$
*   **Threshold:** If the variance is below `50.0`, the frame is marked as **blurry**.
*   **Feedback:** `"Image is too blurry. Keep steady."`

### 2. Illumination / Brightness Check
*   **Method:** Converts the face region to grayscale and calculates the average pixel intensity.
*   **Threshold:** 
    *   If average intensity is $< 40$, it is marked as **too dark**.
    *   If average intensity is $> 230$, it is marked as **overexposed**.
*   **Feedback:** `"Lighting is too dark. Improve illumination."` or `"Lighting is too bright / overexposed."`

### 3. Face Proximity / Size Check
*   **Method:** Calculates the ratio of the face bounding box area to the total frame area.
*   **Threshold:** The face must occupy at least `10%` of the frame area.
*   **Feedback:** `"Move closer to the camera."`

### 4. Pose Check (Yaw / Rotation)
*   **Method:** Measures the horizontal symmetry of the eyes relative to the nose tip.
    $$\text{Symmetry Ratio} = \frac{|x_{\text{nose}} - x_{\text{left\_eye}}|}{x_{\text{left\_eye}} - x_{\text{right\_eye}}}$$
*   **Threshold:** The symmetry ratio must be between `0.35` and `0.65`.
*   **Feedback:** `"Look straight at the camera."`

---

## ⚡ Benefits
*   **Reduced Inference Cost:** Avoids running the heavier ArcFace model on invalid captures.
*   **Database Cleanliness:** Prevents registering low-quality templates, ensuring future match accuracy remains high.
*   **UX Guidance:** Provides actionable feedback for users in real-time.
