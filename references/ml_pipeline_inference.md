# Reference: Machine Learning Inference Pipeline

This reference document explains the image preprocessing, alignment, and model inference steps utilized in the FastAPI backend service.

## 1. Unified Inference Flow

When an image payload is received by the endpoint:

```
[Raw Image Bytes]
       │
       ▼
[Decode via OpenCV] 
       │
       ▼
[MediaPipe Detection] ────(No Face)────► [HTTP 422 Exception]
       │
   (Face Found)
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
[2D Affine Alignment]                  [Expanded Crop (2.7x)]
(Eyes + Nose landmarks)                           │
       │                                          ▼
       ▼                                 [MiniFASNetV2 PyTorch]
[112x112 Face Crop]                               │
       │                                          ▼
       ├──────────────────────┐             [Liveness Score]
       ▼                      ▼
[ONNX ArcFace (512-D)]  [Blur Quality Assessment]
       │                      │
       ▼                      ▼
[Normalized Vector]     [Quality Score]
```

## 2. Model Details & Specs

### Face Recognition Model
*   **Backbone**: ResNet-50 trained on `w600k` dataset.
*   **Format**: ONNX format (`w600k_r50.onnx`).
*   **Input**: RGB 112x112 face crop, normalized to $[-1, 1]$.
*   **Output**: 512-dimensional vector.

### Face Anti-Spoofing Model
*   **Backbone**: PyTorch MiniFASNetV2.
*   **Format**: PyTorch `.pth` weights (`2.7_80x80_MiniFASNetV2.pth`).
*   **Input**: BGR 80x80 crop (built from 2.7x expanded bounding box containing background context).
*   **Output**: Softmax probability over 3 classes (Class 1 corresponds to a real face).

---

## 3. Resilience Fallback (Mock System)
To ensure the backend service starts and is fully testable without downloading large weight files immediately, a **mock inference mode** is implemented. 
If model files or frameworks fail to load:
*   **Detection**: Automatically resizes the full image to 112x112.
*   **Recognition**: Calculates a deterministic hash of the image bytes and seeds a random generator to output a stable 512-D unit vector.
*   **Liveness**: Defaults to 0.95 (Real).
*   **Quality**: Defaults to 0.85 (High).
