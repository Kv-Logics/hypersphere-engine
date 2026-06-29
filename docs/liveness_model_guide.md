# Silent-Face-Anti-Spoofing (Liveness Model) Developer Guide

This document explains the integration of the **Silent-Face-Anti-Spoofing** (MiniFASNetV2) liveness detection model, the code migration details, and how to execute inference.

---

## 1. Context: What is Silent Face?

**Silent-Face-Anti-Spoofing** is an open-source, lightweight face anti-spoofing framework. 
*   **Model Architecture**: `MiniFASNetV2` (specifically optimized for $80 \times 80$ pixel inputs).
*   **Task**: 3-class classification to identify presentation attacks (spoofing).
    *   **Class 0**: Printed Paper Attack (2D)
    *   **Class 1**: Real Face (Bonafide)
    *   **Class 2**: Screen/Replay Attack (3D/2D digital)

---

## 2. Decoupling & Migration Details

Previously, the project relied on a full clone of the external `SilentFace` training repository in the workspace root. The codebase loaded the model by adding the repository path dynamically at runtime:
```python
# LEGACY PATH HACK (Removed)
sys.path.append(os.path.join(os.path.dirname(__file__), 'SilentFace', 'src'))
from model_lib.MiniFASNet import MiniFASNetV2
```

### New Project Structure
To resolve dynamic path injection issues and simplify docker container builds, the `MiniFASNetV2` model definition has been consolidated into a clean, local submodule inside the backend:

```
backend/
└── app/
    └── core/
        ├── liveness/
        │   ├── __init__.py
        │   └── MiniFASNet.py   ◄── Unified PyTorch model definitions
        └── pipeline.py         ◄── Imports directly from local submodule
```

This makes the application entirely self-contained. The external `SilentFace` repository folder can be safely deleted in production deployment pipelines.

---

## 3. Preprocessing & Input Specifications

Anti-spoofing networks require **contextual background details** (such as the borders of a phone, paper, or device screen) to identify presentation attacks. A tight crop of only the eyes/nose/mouth will cause the model to fail.

### Inference Pipeline Requirements
1. **Context Bounding Box Expansion**:
   Expand the initial detected face bounding box by a factor of **2.7x** relative to its center point.
2. **Crop & Resize**:
   Crop the expanded box from the raw BGR frame and resize it to $80 \times 80$ pixels using bilinear interpolation.
3. **Format & Transpose**:
   Keep the image in **BGR** format (standard OpenCV color layout), convert to `float32`, and transpose dimensions from HWC to **CHW** (Channels, Height, Width):
   ```python
   # Transpose from (80, 80, 3) to (3, 80, 80)
   image_data = np.transpose(face_crop, (2, 0, 1))
   image_data = np.expand_dims(image_data, axis=0) # Batch size of 1 -> (1, 3, 80, 80)
   ```
4. **PyTorch Tensor**:
   Wrap the array in a `torch.FloatTensor` and send it to the active execution device (CUDA or CPU).

---

## 4. Code Usage Example

To load weights and run inference programmatically:

```python
import torch
import torch.nn.functional as F
import cv2
import numpy as np
from app.core.liveness.MiniFASNet import MiniFASNetV2

# 1. Load Model Architecture & State Dict
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
model = MiniFASNetV2(conv6_kernel=(5, 5)).to(device)

state_dict = torch.load("2.7_80x80_MiniFASNetV2.pth", map_location=device)
# Strip legacy 'module.' prefix if saved with DataParallel wrapper
new_state_dict = {k.replace("module.", ""): v for k, v in state_dict.items()}
model.load_state_dict(new_state_dict)
model.eval()

# 2. Run Inference
# Preprocess the expanded 80x80 crop (input_tensor shape: [1, 3, 80, 80])
with torch.no_grad():
    logits = model(input_tensor)
    probs = F.softmax(logits, dim=1).cpu().numpy()[0]

# Class 1 probability represents the bonafide/liveness confidence score
liveness_score = float(probs[1])
is_real = liveness_score >= 0.40  # Default system threshold
```
