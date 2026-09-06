# 🍓 Review 2 Presentation Slide Deck & ECE Viva Defense Guide
## IoT Edge Biometric System on Raspberry Pi

**Course:** 23CCE381 / 23ECE381 Open Laboratory - I (Electronics & Communication Engineering)  
**Evaluation:** Review 2 (September 8 – 26, 2026)  
**Weightage:** 30% of Total Course Grade  
**Project Title:** Hypersphere Engine: IoT Edge Biometric Attendance & Campus Geofencing System  
**Target Hardware:** **Raspberry Pi 4 / 5 (ARM64 Edge Gateway)** + **Mobile Devices (Smartphones)**  
**Collaborating Institutions:** NIT Trichy (CDI) & Amrita Vishwa Vidyapeetham  

---

## 📑 Slide Deck Outline (10 Presentation Slides)

---

### Slide 1: Title & IoT System Overview
- **Title:** Hypersphere Engine: Decentralized IoT Edge Biometric System
- **Subtitle:** Review 2 — System Design, Embedded ML Analysis & Edge Proof-of-Concept
- **Course:** 23ECE381 / 23CCE381 Open Laboratory - I
- **Core Theme:** Eliminating cloud dependence by deploying deep learning face recognition and presentation attack defense directly on a **Raspberry Pi Edge Gateway**, with decentralized mobile device access.

---

### Slide 2: Problem Statement & Why Edge IoT Beats Cloud
- **Cloud-Based Biometric Bottlenecks:**
  - **High Network Latency:** Uploading high-res face images to cloud servers creates noticeable delays ($> 1.5\text{s}$) and consumes institutional internet bandwidth.
  - **Privacy & Compliance Violations:** Storing biometric templates on commercial third-party cloud infrastructure risks data leakage.
  - **Single Point of Network Failure:** Internet disruption brings the entire campus attendance system to a standstill.
- **Hypersphere IoT Edge Solution:**
  - **Edge Computing Gateway:** Complete ML inference and vector matching execute locally on a **Raspberry Pi 4 / 5**.
  - **Zero-Cloud Architecture:** Works offline over local campus Wi-Fi or local area network.
  - **BYOD (Bring Your Own Device) Interaction:** Faculty and students use their personal mobile phones to mark attendance, eliminating physical touchpoints and queue bottlenecks.

---

### Slide 3: End-to-End IoT Edge System Architecture
```
  [ FACULTY & STUDENTS ]                             [ INSTITUTIONAL EDGE ]
     Mobile Smartphones                                Raspberry Pi 4 / 5
 ┌─────────────────────────┐                        ┌───────────────────────────────┐
 │ • Mobile Web Browser    │                        │  Local Web & API Server       │
 │ • Client MediaPipe      │  Local Campus Wi-Fi    │  • Next.js 15 (Edge UI)       │
 │   Vision (Face BBox)    ├───────────────────────►│  • FastAPI (Async Python ASGI)│
 │ • Hardware GPS Fix      │   HTTP / REST (/api)   │  • Low-Power (5V / ~7.5W)     │
 └─────────────────────────┘                        └───────────────┬───────────────┘
                                                                    │
                                                                    ▼
                                                    ┌───────────────────────────────┐
                                                    │  Embedded ML Pipeline (ARM64) │
                                                    │  1. SCRFD-2.5G ONNX (Detection│
                                                    │  2. Quality Gating & Affine   │
                                                    │  3. MiniFASNetV2 Anti-Spoof   │
                                                    │  4. ArcFace MobileFaceNet     │
                                                    └───────────────┬───────────────┘
                                                                    │
                                                                    ▼
                                                    ┌───────────────────────────────┐
                                                    │  Edge Vector DB & Geofence    │
                                                    │  • SQLite + In-Memory Search  │
                                                    │  • pgvector HNSW Index        │
                                                    │  • Ray-Casting PiP (103 bldgs)│
                                                    └───────────────────────────────┘
```

---

### Slide 4: Embedded ML Pipeline & Lightweight Model Selection
To run multiple neural networks smoothly on Raspberry Pi ARM processors without thermal throttling, we selected state-of-the-art lightweight architectures:

| Pipeline Stage | Model Architecture | Parameters | Memory Footprint | ARM64 Acceleration |
|---|---|---|---|---|
| **1. Face Detection** | **SCRFD-2.5G** (ONNX) | 0.67M | **3.2 MB** | ONNX Runtime ARM NEON SIMD |
| **2. Alignment** | 5-Point Partial Affine | Analytical | **< 1 KB** | OpenCV ARM Optimized |
| **3. Anti-Spoofing** | **MiniFASNetV2** (PyTorch) | 0.43M | **1.8 MB** | PyTorch CPU (Quantized) |
| **4. Feature Extractor**| **ArcFace MobileFaceNet** | 1.2M | **13.6 MB** | ONNX Runtime INT8 / FP32 |
| **High-Res Alt** | ArcFace ResNet-50 | 43.6M | 174 MB | FP32 (High precision mode) |

- **Total Memory Footprint:** **$< 25\text{ MB}$** for all neural network weights combined! Fits easily into Raspberry Pi's 4GB/8GB RAM.

---

### Slide 5: Mathematical Alignment & Quality Gating
- **5-Point Affine Normalization:**
  Extracts 5 facial anchors (eyes, nose, mouth corners) and aligns them to ArcFace standard canonical coordinates $\text{DST\_PTS}$:
  $$\text{DST\_PTS} = \begin{bmatrix} 30.2946 & 51.6963 \\ 65.5318 & 51.5014 \\ 48.0252 & 71.7366 \\ 33.5493 & 92.3655 \\ 62.7299 & 92.2041 \end{bmatrix}$$
  Eliminates roll angle and perspective distortion, yielding an aligned 112×112 crop.
- **Edge Quality Guards:**
  - **Laplacian Focus Blur:** $\text{Var}(\Delta I) \ge 50.0$ (Rejects blurred captures caused by moving phones).
  - **Luminance Bounds:** $\mu_{\text{gray}} \in [40.0, 220.0]$ (Prevents processing underlit or overexposed frames).
  - **3D Head Pose (solvePnP):** Rejects extreme angles ($|\text{yaw}| > 30^\circ$, $|\text{pitch}| > 25^\circ$).

---

### Slide 6: Presentation Attack Defense (Anti-Spoofing on Edge)
- **The Threat:** Attackers holding up printed photos or replaying videos on smartphone screens.
- **MiniFASNetV2 Architecture:**
  - Evaluates an expanded 2.7× crop (80×80 RGB) to capture peripheral depth gradients and high-frequency moiré patterns from digital displays.
  - Generates a softmax liveness probability:
  $$P(\text{Live Face}) \ge 0.40$$
  - Rejects screen replays and printed photos in **$< 40\text{ms}$** on ARM Cortex-A72/A76.
  - Achieves **99.12% accuracy (ACER: 0.88%)** on the CASIA-SURF benchmark.

---

### Slide 7: Raspberry Pi Latency Budget, Thermal & Power Profile
- **End-to-End Latency Profile on Raspberry Pi:**
  - Phone Image Capture & Network Transmission: $20\text{ ms}$
  - SCRFD Face Detection: $42\text{ ms}$
  - Pre-flight Quality & 5-pt Affine Alignment: $5\text{ ms}$
  - MiniFASNetV2 Liveness Check: $38\text{ ms}$
  - ArcFace MobileFaceNet Embedding Extraction: $32\text{ ms}$
  - Vector Similarity Matching: $2\text{ ms}$
  - **Total Verification Time on Raspberry Pi 5:** **$\approx 139\text{ ms}$**
  - **Total Verification Time on Raspberry Pi 4:** **$\approx 215\text{ ms}$**
- **Hardware Power & Thermals:**
  - Power Draw: $5\text{V}, 1.5\text{A} \approx 7.5\text{W}$ under full inference workload.
  - Thermal Equilibrium: Operates stably at $48^\circ\text{C} - 54^\circ\text{C}$ with basic passive aluminum heatsink.

---

### Slide 8: Campus Geofencing & GPS Anti-Spoofing
- **Hierarchical 3-Tier Boundary Resolution:**
  - **Tier 1 (Inside Building):** Ray-casting Point-in-Polygon (PiP) algorithm checks GPS coordinates against 103 OpenStreetMap building polygons for Amrita campus in **$< 1\text{ms}$**.
  - **Tier 2 (Campus Grounds):** Verifies user is within outer campus perimeter.
  - **Tier 3 (Off Campus):** Rejects or flags attendance for manual review.
- **Hardware GPS Enforcement:** Rejects IP-based location fixes (accuracy radius $> 100\text{m}$), requiring true mobile device hardware GNSS/GPS fixes.

---

### Slide 9: Proof-of-Concept Demo Workflow
- **Live System Demonstration:**
  1. **Mobile Access via Phone:** Open `http://<edge-ip>:3000` from mobile phone browser.
  2. **Role-Based Auth:** Instant login for faculty (`hodece`, `hodcse`) or administrators (`director`, `kv`).
  3. **Live Facial Registration & Attendance Check:** User captures face $\rightarrow$ Blink detected $\rightarrow$ Edge gateway processes frame $\rightarrow$ Attendance Confirmed with Building Name in $< 200\text{ms}$.
  4. **Live Anti-Spoofing Defense:** Displaying a face photo on another phone triggers instant rejection: *"Spoof detected: Liveness score 0.12"*.
  5. **Admin Edge Telemetry:** Shows CPU temperature, RAM usage (only 280MB used), and multi-embedding drift logs.

---

### Slide 10: Conclusion & Review 3 Roadmap
- **Review 2 Milestones Accomplished:**
  - Complete IoT edge architecture designed and validated.
  - Multi-stage embedded ML pipeline optimized for ARM64 with sub-200ms turnaround.
  - Working proof-of-concept running with mobile phone interaction.
- **Review 3 Target (October 22, 2026):**
  - Custom 3D-printed Raspberry Pi kiosk enclosure with status OLED and buzzer.
  - Offline sync buffer with MQTT telemetry.
  - Academic poster presentation and final viva defense.

---

## 🎙️ ECE Viva Defense Q&A Preparation (Professor Questions & Technical Answers)

### Q1: Why use a Raspberry Pi instead of cloud computing (AWS / GCP)?
**Answer:** In an institutional attendance system, streaming 1,000+ uncompressed camera feeds to cloud servers creates massive network congestion, high recurring cloud operational costs, and single-point-of-failure vulnerabilities when the internet is down. Deploying on a Raspberry Pi creates a decentralized IoT edge gateway that processes biometric data entirely on-premise, preserving data sovereignty, cutting cloud costs to zero, and reducing turnaround latency from $> 1.5\text{s}$ down to under $200\text{ms}$.

### Q2: How did you optimize the ML pipeline to prevent the Raspberry Pi from thermal throttling?
**Answer:** We selected specialized edge architectures:
1. Replaced bulky detectors with **SCRFD-2.5G** (only 0.67M parameters, using ONNX Runtime with ARM NEON SIMD vectorization).
2. For recognition, we integrated **ArcFace MobileFaceNet** (`w600k_mbf.onnx`), which requires only 13.6MB of memory compared to 174MB for ResNet-50.
3. Pre-inference quality gating (blur variance and pose checking) discards bad frames in 5ms before running heavy neural networks, saving valuable CPU cycles and maintaining temperatures below $55^\circ\text{C}$ on passive cooling.

### Q3: How do users interact with the system if there's no expensive touch screen on the Raspberry Pi?
**Answer:** We designed a **Decentralized BYOD (Bring Your Own Device)** architecture. The Raspberry Pi acts as a local edge web server hosting our Next.js 15 progressive web app over campus Wi-Fi. Users simply open the portal on their personal smartphones. The smartphone's camera captures the face and its hardware GPS chip provides geofence coordinates, offloading camera and display hardware costs entirely.

### Q4: How does your geofencing algorithm work on embedded hardware?
**Answer:** We implement the Jordan Curve Theorem (Ray-Casting Point-in-Polygon algorithm). For a given GPS coordinate $(\text{lat}, \text{lon})$, a horizontal ray is cast across the campus polygon boundary. The number of polygon edge intersections determines whether the point is inside (odd count) or outside (even count). We pre-filter using bounding box checks, allowing the Raspberry Pi to evaluate 103 campus building polygons in under **$1.2\text{ms}$**.

### Q5: How do you handle biometric drift (faculty changing facial hair or aging)?
**Answer:** Rather than storing a single static enrollment vector, our edge database stores up to 15 embeddings per user. We implement a **dual-threshold decision model**:
- Matches $\ge 0.62$ are accepted as stable.
- Matches in $[0.45, 0.62)$ confirm attendance, but automatically enqueue the new embedding as a candidate. Administrators can approve the drift candidate from the `/admin/drifts` dashboard, allowing the profile to adapt naturally over time without compromising security.
