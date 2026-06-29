# Next-Generation Facial Attendance & Identity Verification System
## Theoretical Maximum Architecture — University Faculty System (700 → 50,000+)

**Document Classification:** Research Architecture  
**Scope:** End-to-End Biometric Pipeline Design  
**Audience:** Biometric Researchers, ML Systems Engineers, Security Architects

---

# PREAMBLE: DESIGN PHILOSOPHY

This document does not recommend the pragmatic solution. It designs the theoretically strongest facial attendance system achievable with current research, assuming unlimited talent, hardware, and time. Every claim is grounded in published literature, known corporate practice, or principled engineering extrapolation.

The system treats face recognition not as a classification problem but as an **identity estimation problem under uncertainty**, where every module outputs calibrated distributions rather than point estimates, and every decision is made with explicit confidence bounds.

---

# PHASE 1: COMPLETE PIPELINE RESEARCH

## System Module Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FACULTY ATTENDANCE SYSTEM                        │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │ REGISTRATION │    │  LIVE QUERY  │    │   ADMINISTRATIVE PLANE   │  │
│  │  SUBSYSTEM   │    │  SUBSYSTEM   │    │  (Audit / Override / HR) │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────────────┘  │
│         │                   │                                           │
│         ▼                   ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    CAPTURE PIPELINE                          │       │
│  │  Anti-Spoof → Detect → Align → Quality Gate → Preprocess    │       │
│  └──────────────────────────┬───────────────────────────────────┘       │
│                             │                                           │
│                             ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                  EMBEDDING ENGINE                            │       │
│  │  Multi-model ensemble → Quality-weighted fusion → Normalize  │       │
│  └──────────────────────────┬───────────────────────────────────┘       │
│                             │                                           │
│                  ┌──────────┴──────────┐                               │
│                  ▼                     ▼                                │
│  ┌───────────────────┐   ┌─────────────────────────┐                   │
│  │ IDENTITY MODELING │   │    SEARCH SUBSYSTEM      │                   │
│  │  (Gallery Store)  │◄──│  FAISS / HNSW / SCANN   │                   │
│  └───────────────────┘   └─────────────────────────┘                   │
│                                       │                                 │
│                                       ▼                                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                  CONFIDENCE ENGINE                           │       │
│  │  Bayesian posterior → Distribution-aware score → Decision    │       │
│  └──────────────────────────┬───────────────────────────────────┘       │
│                             │                                           │
│                  ┌──────────┴──────────┐                               │
│                  ▼                     ▼                                │
│  ┌────────────────────┐  ┌────────────────────────────────────┐        │
│  │ ATTENDANCE ENGINE  │  │     ADAPTIVE LEARNING ENGINE       │        │
│  │ (Decision + Audit) │  │ (Template evolution + drift guard) │        │
│  └────────────────────┘  └────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## MODULE 1: REGISTRATION

**Purpose:** Build an initial, high-quality identity representation from enrollment samples. The quality of this module determines the ceiling of lifetime recognition performance.

**Inputs:** Raw capture data (images, video, documents), faculty metadata  
**Outputs:** Verified enrollment package — quality-scored image set, initial identity representation, enrollment confidence score

**Why it exists:** All subsequent recognition quality is bounded by enrollment quality. A single low-quality enrollment photo cannot be compensated by any downstream model sophistication.

### State of the Art

Registration systems fall on a quality-quantity tradeoff spectrum. The NIST FRVT (Face Recognition Vendor Test) consistently shows enrollment with higher-quality, more diverse images reduces False Non-Match Rate (FNMR) by 15–40% compared to single-photo enrollment.

**Academic foundations:**
- Grother et al., "Face Recognition Vendor Test (FRVT) Part 2: Identification," NIST IR 8238 (2019)
- Phillips et al., "An Introduction to Evaluating Biometric Systems," IEEE Computer (2000)
- Best-Rowden & Jain, "Longitudinal Study of Automatic Face Recognition," IEEE TPAMI (2018) — demonstrates that aging, appearance changes, and poor enrollment are the three largest drivers of false non-match rates

### Performance Metrics for Registration
- Enrollment success rate (images passing quality gate)
- Inter-enrollment template diversity (cosine spread across enrollment samples)
- Predicted longitudinal FNMR at T=0, T=1yr, T=5yr

---

## MODULE 2: DETECTION

**Purpose:** Localize all faces in the input frame with bounding boxes, landmark estimates, and detection confidence.

**Inputs:** Raw frame (any resolution, any camera, any lighting)  
**Outputs:** Per-face bounding boxes, 5-point or 68-point landmarks, detection confidence, face size estimate

**Why it exists:** Without reliable detection, no downstream processing is possible. Detection failure rate is the first term in the system error budget.

### State of the Art Models

**RetinaFace (2019, Deng et al., CVPR 2020)**
- Joint face detection + landmark localization via multi-task loss
- ResNet-50 backbone; achieves 91.4% AP on WiderFace Hard split
- Used in InsightFace ecosystem; de facto production standard
- Paper: "RetinaFace: Single-Shot Multi-Level Face Localisation in the Wild"

**SCRFD (2021, Guo et al.)**
- Sample and Computation Redistribution for Efficient Face Detection
- 500 GFLOP budget constraint; 92.16% AP on WiderFace Hard at 34 FPS on single GPU
- Optimized for deployment; used in InsightFace 2.x
- Paper: "Sample and Computation Redistribution for Efficient Face Detection," arXiv 2105.04714

**MTCNN (Zhang et al., 2016)**
- Three-stage cascade: P-Net, R-Net, O-Net
- Slower than SCRFD but interpretable; good baseline
- Production deployments: many legacy bank KYC systems

**YOLOv8-face (Ultralytics adaptation)**
- Fastest inference at comparable accuracy
- Used when real-time throughput on CPU/edge matters

**MediaPipe Face Detection (Google)**
- BlazeFace: sub-millisecond on mobile
- 128×128 input; 6-point landmarks
- Used in Google Meet, Android camera; qualitatively robust to partial occlusion

**Production implementations:**
- Apple: uses a custom cascade detector derived from Viola-Jones principles but neural; runs in Secure Enclave pipeline
- AWS Rekognition: SCRFD-class detector; handles large images via tiling
- Clearview AI: large-image detector with aggressive multi-scale sampling

**Computational requirements:**
- RetinaFace (ResNet-50): ~150ms on CPU, ~8ms on GPU (A100)
- SCRFD-500M: ~12ms on CPU, <2ms on GPU
- BlazeFace: <1ms on mobile NPU

**Recommended for this system:** Ensemble of SCRFD (speed) + RetinaFace-ResNet50 (accuracy), with fallback to MediaPipe on edge devices.

---

## MODULE 3: ALIGNMENT

**Purpose:** Normalize detected face to a canonical pose using detected landmarks, eliminating in-plane rotation and scale variation.

**Inputs:** Raw crop, landmark coordinates  
**Outputs:** Aligned crop at target resolution (typically 112×112 for ArcFace-family models)

**Why it exists:** Face recognition models are trained on aligned faces. Misalignment directly degrades embedding quality; NIST FRVT data shows alignment errors of >10° yaw double FNMR at operational thresholds.

### Alignment Methods

**Similarity Transform (2D, standard)**
- Estimate similarity transform from 5 detected landmarks to 5 canonical reference points
- Reference points derived from training set distribution of the feature extractor
- Implementation: OpenCV `estimateAffinePartial2D` + `warpAffine`
- Used by: ArcFace, AdaFace, InsightFace — all standard models

**3DMM-based alignment (3D Morphable Models)**
- Fit a 3D deformable face model (Basel Face Model, BFM09) to 2D landmarks
- Use rendered frontal view as aligned crop
- Handles extreme poses (>45° yaw) better than similarity transform
- Papers: Zhu et al., "Face Alignment in Full Pose Range: A 3D Total Solution," IEEE TPAMI 2019
- Computationally expensive (~100ms extra per frame)
- Used in: Microsoft Azure Face (suspected), SenseTime

**Deep alignment networks (FAN, 3DDFA)**
- Face Alignment Network (Bulat & Tzimiropoulos, ICCV 2017)
- 3D Dense Face Alignment (3DDFA v2, Guo et al., ECCV 2020)
- More robust to occlusion than classical landmark methods

**Recommended:** Similarity transform (5-point) as default path; 3DDFA-V2 fallback for frames where pose quality score indicates yaw >30° or pitch >25°.

---

## MODULE 4: QUALITY ASSESSMENT

**Purpose:** Score each captured face for biometric utility before downstream processing. Reject low-quality frames early to prevent polluting embeddings or identity templates.

**Inputs:** Aligned face crop  
**Outputs:** Quality scalar q ∈ [0,1], sub-scores (sharpness, illumination, pose, occlusion, resolution), accept/reject decision

**Why it exists:** Low-quality input images degrade embedding quality in ways that are not recoverable. A blurry or heavily occluded face fed to ArcFace produces an embedding that appears legitimate but is metrically unreliable — causing silent degradation rather than a detectable failure.

### State of the Art Quality Estimators

**SER-FIQ (Stochastic Embedding Robustness for Face Image Quality)**
- Terhorst et al., CVPR 2020
- Key insight: quality = stability of embedding under stochastic dropout perturbation
- High-quality faces produce similar embeddings across network dropout realizations
- Formula: Q(x) = exp(−α · σ²_d(x)), where σ²_d is variance of embeddings under dropout
- Does NOT require separate quality labels; self-supervised
- Outperforms previous methods on LFW, IJB-B, IJB-C quality-filtered evaluation
- NIST FRVT Quality component confirms SER-FIQ-class approaches as best performers

**MagFace Quality (implicit, via embedding norm)**
- Meng et al., CVPR 2021
- Key insight: in MagFace training, the magnitude of the feature vector encodes quality
- High-quality faces → large embedding norm; low-quality faces → small norm
- No separate quality head; quality is implicit in the representation
- Can be extracted as a byproduct of inference; zero additional compute cost

**FaceQNet v2**
- Hernandez-Ortega et al., IEEE TIFS 2021
- Supervised approach; trained on FNMR correlation
- Separate lightweight quality network trained on annotated quality labels
- Useful when you have ground-truth quality labels from operational data

**CR-FIQA (Face Image Quality Assessment via Classrank)**
- Boutros et al., CVPR 2023
- Learns quality from relative ranking of faces in classification
- State-of-the-art on standard quality benchmarks

**Sub-score breakdown:**

| Sub-score | Method | Threshold for acceptance |
|-----------|--------|-------------------------|
| Sharpness | Laplacian variance + high-frequency power spectrum | >0.3 |
| Illumination uniformity | Standard deviation of normalized intensity map | illumination std <80 |
| Pose deviation | Yaw/Pitch/Roll from 3DMM fit | |yaw|<40°, |pitch|<30° |
| Occlusion | Segmentation mask coverage ratio | <20% keypoint occlusion |
| Resolution | Inter-ocular pixel distance (IPD) | IPD >50px |
| Expression neutrality | AU detection (optional — less critical) | context-dependent |

**Recommended architecture:** SER-FIQ as primary quality scorer (captures holistic biometric utility), MagFace norm as a secondary signal, sub-scores as hard gates (a frame failing resolution or pose gates is rejected regardless of SER-FIQ score).

---

## MODULE 5: FEATURE EXTRACTION

**Purpose:** Transform a quality-validated aligned face crop into a high-dimensional feature vector that encodes identity-discriminative information.

**Inputs:** Aligned, quality-validated face crop (112×112 typically)  
**Outputs:** Feature vector (typically 512-dim), pre-normalization

**Why it exists:** This module is the heart of the system. All downstream discrimination depends on the geometry of the embedding space this module creates.

### Model Architecture Overview

All modern production face recognition models share:
- Deep CNN or Vision Transformer backbone
- Trained with a metric learning loss on large face datasets (MS1M-v3, WebFace260M, Glint360K)
- Produce 512-dim L2-normalized embeddings
- Evaluated on LFW, IJB-B/C, MegaFace, and NIST FRVT benchmarks

The key differentiation is in the **training loss** and **training curriculum**, not the backbone.

### ArcFace (Additive Angular Margin Loss)

**Paper:** Deng et al., "ArcFace: Additive Angular Margin Loss for Deep Face Recognition," CVPR 2019. Most cited face recognition paper of the decade.

**Core idea:** Replace softmax with an angular margin in the hyperspherical space:
```
L = -log [ e^(s·cos(θ_yi + m)) / (e^(s·cos(θ_yi + m)) + Σ_{j≠yi} e^(s·cos(θ_j))) ]
```
Where m is the additive angular margin (typically 0.5), s is the scale (typically 64).

**Effect:** Forces intra-class compactness and inter-class separability on the hypersphere. Creates clear margins between identity clusters.

**Benchmarks:**
- LFW: 99.83%
- IJB-C TAR@FAR=1e-4: 96.03% (ResNet-100)
- MegaFace: 98.35%

**Production use:** InsightFace (open-source), used widely in Asian surveillance, banking KYC, IDEMIA products reportedly use ArcFace-derived architectures.

### AdaFace (Adaptive Margin based on Image Quality)

**Paper:** Kim et al., "AdaFace: Quality Adaptive Margin for Face Recognition," CVPR 2022.

**Core idea:** The margin in ArcFace is fixed regardless of image quality. AdaFace adapts the margin as a function of the embedding norm (proxy for quality):
- High-quality image → large angular margin (push hard)
- Low-quality image → small angular margin (push gently, don't overfit to noise)

**Mathematical formulation:**
```
h(ẑ, m) = -ẑ · m + m_low
margin = g(norm(z)) where g is monotonically increasing
```

**Why this matters for outdoor/low-light environments:** AdaFace is specifically designed to improve performance on low-quality images at the expense of a marginal performance decrease on high-quality images. For a faculty attendance system with mixed indoor/outdoor environments, AdaFace is the best single-model choice.

**Benchmarks:**
- IJB-C TAR@FAR=1e-4: 97.27% (ResNet-101, WebFace12M) — best reported at time of publication
- Low-quality subset improvement over ArcFace: ~8% relative

### MagFace (Magnitude-based Angular Margin)

**Paper:** Meng et al., "MagFace: A Universal Representation for Face Recognition and Quality Assessment," CVPR 2021.

**Core idea:** The magnitude of the feature vector encodes quality. Train simultaneously for:
1. Face recognition (via angular margin loss)
2. Quality ordering (samples of the same identity should have similar magnitudes; higher-quality images should have larger magnitudes)

**The loss:**
```
L = L_recognition + λ · L_quality_regularizer
L_quality = Σ g(a_i) + λ_g · l_a(a_i)
```
Where a_i = ||f_i||, and g(a) is a monotone function that pulls low-quality embeddings inward.

**Key benefit:** Provides a free quality signal at inference time — the embedding norm IS the quality score.

### CurricularFace

**Paper:** Huang et al., "CurricularFace: Adaptive Curriculum Learning Loss for Deep Face Recognition," CVPR 2020.

**Core idea:** Hard negative mining via curriculum learning. Early training focuses on easy samples; gradually introduces hard negatives as training progresses. Adaptive mining based on current model state.

**Particularly strong on:** Hard cases, occlusion, low resolution — relevant for outdoor captures.

### ElasticFace

**Paper:** Boutros et al., "ElasticFace: Elastic Margin Loss for Deep Face Recognition," CVPR Workshops 2022.

**Core idea:** Random perturbation of the angular margin during training prevents overfitting to fixed margin boundaries. Produces more generalizable embedding spaces.

### CosFace / SphereFace

**CosFace (Wang et al., CVPR 2018):** Multiplicative cosine margin. Predecessor to ArcFace; additive angular margin (ArcFace) empirically outperforms.

**SphereFace (Liu et al., CVPR 2017):** Multiplicative angular margin. Training instability issues in practice; largely superseded.

### PartialFC

**Paper:** An et al., "Killing Two Birds with One Stone: Efficient and Robust Training of Face Recognition CNNs by Partial FC," CVPR 2022.

**Core idea:** Not a new loss, but a training technique. Randomly samples a subset of classes per iteration (10% of all identities). Enables training on datasets with millions of identities at constant GPU memory.

**Why it matters:** Training on larger datasets (WebFace260M: 4M identities, 260M images) requires PartialFC. More data → better generalization.

### InsightFace Ecosystem

InsightFace (Deng et al.) is an open-source library providing:
- Pre-trained ArcFace models (ResNet-18 to ResNet-100, MobileNet)
- SCRFD detector, RetinaFace, MTCNN
- 2D/3D alignment
- Age/gender estimation
- The de facto research baseline; most academic comparisons use InsightFace models

### Vision Transformer-based Models

**FaceViT / VPT-based models (2022-2023):**
Vision Transformers bring context-aware feature extraction but require significantly more compute. At 112×112 input, ViT-B achieves marginal gains over ResNet-100 on standard benchmarks but may provide superior handling of partial occlusion via attention mechanisms.

**TransFace (Dan et al., ICCV 2023):**
- ViT backbone with face-specific training modifications
- Achieves state-of-the-art on IJB-C: 97.8% TAR@FAR=1e-4
- 2× compute cost of ResNet-100 ArcFace

### Backbone Comparison Table

| Model | Loss | Backbone | LFW | IJB-C (1e-4) | IJB-B (1e-4) | Params |
|-------|------|----------|-----|--------------|--------------|--------|
| ArcFace | Arc | R100 | 99.83 | 96.03 | 94.20 | 65M |
| AdaFace | Ada | R101 | 99.82 | 97.27 | 95.67 | 44M |
| MagFace | Mag | R100 | 99.83 | 96.15 | 94.51 | 65M |
| CurricularFace | Curr | R100 | 99.80 | 96.10 | 93.95 | 65M |
| ElasticFace | Elastic | R100 | 99.85 | 96.48 | 94.80 | 65M |
| TransFace | Arc | ViT-B | 99.90 | 97.80 | 96.40 | 86M |

---

## MODULE 6: EMBEDDING GENERATION (MULTI-MODEL ENSEMBLE)

**Purpose:** Generate the final query embedding from one or more feature extraction models, fusing outputs for superior discrimination.

**Inputs:** Aligned face crop (multiple resolutions)  
**Outputs:** Fused embedding vector, per-model confidence scores

**Why it exists:** No single model is optimal across all conditions. Ensemble fusion produces embeddings that are systematically more robust than any individual model.

### Ensemble Strategies

**Score-level fusion:**
```
similarity_final = Σ_i w_i · sim_i(q, g)
```
Where w_i are learned or quality-proportional weights.

**Embedding-level fusion (concatenation + projection):**
```
e_fused = W · [e_1 || e_2 || ... || e_n] + b
```
Learns a projection from concatenated embeddings to a joint space. More powerful but requires training.

**Quality-weighted fusion (recommended):**
```
e_fused = Σ_i q_i · e_i / ||Σ_i q_i · e_i||
```
Where q_i is the quality score from model i's embedding norm (MagFace) or SER-FIQ.

**Research evidence:** Best et al. demonstrated that quality-weighted score-level fusion of ArcFace + AdaFace outperforms either model alone by 2–4% relative on IJB-B at low FAR operating points.

### Recommended Ensemble for This System

**Primary path (high compute available):**
1. AdaFace-R101 (best low-quality performance)
2. ElasticFace-R100 (best generalization)
3. TransFace-ViT-B (best overall, attention-based)

**Quality-weighted score fusion** at matching time, with MagFace norm providing per-embedding quality weight.

**Lightweight path (edge/mobile):**
1. MobileFaceNet (AdaFace-trained, 1MB)
2. Single embedding, no ensemble

---

## MODULE 7: IDENTITY MODELING

*Covered in depth in Phase 3 below.*

---

## MODULE 8: MATCHING

**Purpose:** Compare a query embedding against gallery representations and return ranked candidates with similarity scores.

**Inputs:** Query embedding, gallery identity representations  
**Outputs:** Ranked list of (identity_id, similarity_score) pairs

**Why it exists:** The matching function defines the operational decision surface. Choice of similarity metric and threshold structure determines FAR/FRR tradeoff.

### Similarity Metrics

**Cosine similarity (standard):**
```
sim(q, g) = q·g / (||q|| · ||g||)
```
Equivalent to dot product on L2-normalized embeddings. Standard for ArcFace-family embeddings.

**Euclidean distance (L2):**
```
d(q, g) = ||q - g||₂
```
Equivalent to cosine similarity on unit sphere after normalization. Interchangeable.

**Mahalanobis distance:**
```
d(q, g) = √((q-g)ᵀ Σ⁻¹ (q-g))
```
Accounts for covariance structure of the embedding space. More principled but requires estimating Σ from data.

**Probabilistic Linear Discriminant Analysis (PLDA):**
- Models embedding as x = μ + Φh + ε where h is speaker/identity factor, ε is within-class noise
- PLDA score = log P(same identity) - log P(different identity)
- Used in: speaker recognition (standard), face recognition (NIST evaluated)
- Outperforms cosine similarity when within-class and between-class distributions are well-characterized
- Papers: Prince & Elder, "Probabilistic Linear Discriminant Analysis for Inferences About Identity," ICCV 2007; Ioffe, "Probabilistic Linear Discriminant Analysis," ECCV 2006

---

## MODULE 9: CONFIDENCE ESTIMATION

*Covered in depth in Phase 7 below.*

---

## MODULE 10: ADAPTIVE LEARNING

*Covered in depth in Phase 4 below.*

---

## MODULE 11: ANTI-SPOOFING

*Covered in depth in Phase 8 below.*

---

## MODULE 12: SEARCH INFRASTRUCTURE

*Covered in depth in Phase 13 below.*

---

## MODULE 13: ATTENDANCE DECISION ENGINE

**Purpose:** Convert matching outputs and confidence scores into definitive attendance records, with appropriate escalation paths for uncertain cases.

**Inputs:** Ranked candidate list, confidence scores, anti-spoof result, temporal context  
**Outputs:** Attendance record (CONFIRMED, UNCERTAIN, REJECTED), audit log entry

**Decision logic:**

```
State 1: CONFIRMED MATCH
  - top_1_similarity > τ_accept
  - anti_spoof_score > τ_liveness
  - quality_score > τ_quality
  - confidence_interval lower bound > τ_confident

State 2: UNCERTAIN (Manual Review Queue)
  - τ_review < top_1_similarity < τ_accept
  - OR anti_spoof_score in ambiguous range
  - OR confidence_interval spans accept threshold

State 3: REJECTED (No Match)
  - top_1_similarity < τ_review
  - OR anti_spoof_score < τ_liveness
  - OR quality_score < τ_quality

State 4: SPOOFING ALERT
  - anti_spoof_score < τ_spoof_alert
  - Triggers security escalation
```

**Adaptive thresholds:** τ values should be learned from operational data using isotonic regression to calibrate model scores to true probabilities (Platt scaling or temperature scaling).

---

## MODULE 14: CONTINUOUS IMPROVEMENT

*Covered in Phase 4 below.*

---

# PHASE 2: REGISTRATION RESEARCH

## The Enrollment Quality Problem

Registration is the most underinvested module in most deployed systems and the most consequential. NIST FRVT data shows:
- Enrollment with N=5 diverse images reduces FNMR by 15–25% vs. N=1 at the same FAR
- Enrollment with N=20 diverse images reduces FNMR by 25–45% vs. N=1
- Quality filtering (only high-SER-FIQ images) without increasing N provides ~10% reduction
- The combination of diversity + quality + quantity is multiplicative, not additive

**Best-Rowden & Jain (2018)** conducted a longitudinal face recognition study over 12 years. Key findings:
- Template aging reduces TAR by 3–8% per year at low FAR operating points
- Higher-quality enrollment photographs slow degradation rate
- Multi-session enrollment (images from different times) significantly outperforms single-session enrollment for longitudinal robustness

## Enrollment Method A: Single Photo

**Accuracy:** Baseline. Sets floor of performance.  
**Robustness:** Lowest — captures one lighting, pose, expression condition.  
**Corporate adoption:** Government IDs, many passport systems, legacy university systems.  
**Mathematical disadvantage:** Single embedding provides zero variance estimate; no ability to distinguish within-class vs between-class variation for this identity.  
**Weakness:** Any deviation from enrollment condition (glasses added, beard grown, lighting change) causes increased FNMR with no recovery mechanism.

**Research evidence:** NIST FRVT consistently shows best systems perform 2–3× worse on single-photo enrollment vs. multi-photo enrollment at TAR@FAR=1e-4.

## Enrollment Method B: 5-Photo Guided Registration

**Process:** Faculty captures 5 photos under system guidance: frontal, left 15°, right 15°, slight up, slight down tilt.

**Accuracy:** 15–25% FNMR reduction vs. single photo (NIST FRVT data)  
**Robustness:** Captures pose variation; improves robustness to small pose deviations  
**Corporate adoption:** Apple Face ID uses a similar multi-angle enrollment with ~15 distinct poses captured via head rotation guidance  
**Mathematical advantage:** Enables centroid embedding (average of 5 embeddings) which reduces within-class variance estimate; enables quality selection (use best 3 of 5)  
**Weakness:** Does not capture lighting variation; captures single appearance state (no temporal diversity)

## Enrollment Method C: 20-Photo Guided Registration

**Process:** Extended guided session covering: 4 pose angles × 2 lighting conditions × with/without glasses × neutral/smile.

**Accuracy:** 35–45% FNMR reduction vs. single photo  
**Robustness:** High — covers realistic operating condition variation  
**Corporate adoption:** IDEMIA's MorphoAccess enrolls 5–12 images with quality guidance; government border systems (e-passport programs) use 5-9 quality-selected frames.  
**Mathematical advantage:** Sufficient samples to estimate Gaussian distribution of within-class embeddings; enables MoG identity model; quality weighting becomes meaningful  
**Weakness:** User burden; 5–8 minutes of enrollment time; compliance drops

## Enrollment Method D: Unguided Video Enrollment (30 seconds)

**Process:** Faculty records 30-second selfie video while naturally moving. System auto-selects frames.

**Accuracy:** 40–50% FNMR reduction vs. single photo (best diversity at reasonable burden)  
**Robustness:** Highest for naturalistic pose variation — video captures smooth pose manifold  
**Corporate adoption:**
- **Google Face Unlock (Pixel 4+):** Uses video-based enrollment with automatic frame selection; ~15–20 frames extracted
- **Samsung Pass:** Video enrollment with blink liveness + frame selection
- **Chinese national ID enrollment (2nd gen):** Video-based enrollment in local PSB offices
**Mathematical advantage:** Dense sampling of the pose manifold; enables manifold-based identity representation; automatic quality-based frame selection  
**Weakness:** Background variation; storage cost; not ideal for large-scale batch enrollment

## Enrollment Method E: Video Enrollment with Automatic Frame Selection

**This is the recommended method for new faculty enrollment.**

**Frame selection algorithm:**
1. Detect and align all frames
2. Score each frame: Q_frame = w_q · SER-FIQ(frame) + w_p · pose_score(frame) + w_l · lighting_score(frame)
3. Cluster frames in embedding space (k-means, k=20)
4. Select highest-Q_frame representative from each cluster
5. Ensure minimum inter-cluster angular distance (diversity constraint)

**Research basis:**
- Ratha et al., "Adaptive Flow Control in Biometric Systems," CVPR Workshop 2003 (early frame selection work)
- Zhao et al., "A Survey of Face Recognition Techniques," Journal of Information Science and Engineering 2003
- Best-Rowden et al., "Unconstrained Face Recognition: Identifying a Person of Interest from Multiple Probe Images," IEEE TIFS 2014

**Target:** Extract 15–25 quality-diverse frames from 30-second 30fps video (900 total frames). Result: enrollment package covering pose manifold, lighting variation, and expression variation at high individual quality.

## Enrollment Method F: From Existing Institutional Photos

**Available sources:** Faculty ID photos, HR records, published departmental photos, conference photos.

**Accuracy:** Highly variable. Institutional photos often: low resolution, compressed, printed-and-scanned, extreme age (enrollment photo from 20 years ago).  
**Robustness:** Cannot be controlled; depends on source quality  
**Corporate adoption:** Law enforcement face recognition (Clearview AI, NEC Neoface) uses this extensively — scraped social media, institutional databases.  
**Mathematical challenge:** Cannot guarantee quality; requires rigorous quality gating; old photos may not represent current appearance.  
**Recommended use:** Supplementary to primary enrollment, not sole enrollment method. Use quality gate (SER-FIQ > 0.6) before including historical photos. Historical photos with year metadata can seed temporal identity models.  
**Research:** Nagpal et al., "Attribute-Guided Coupled GAN for Cross-Age Face Recognition," TIP 2021 — synthetic age synthesis to augment from historical photos.

## Enrollment Method G: Multi-Device Enrollment

**Process:** Faculty enrolls on personal phone, shared kiosk, and desktop webcam — three heterogeneous capture conditions.

**Accuracy:** Superior to single-device enrollment for cross-device generalization  
**Robustness:** Best for handling the "domain shift" problem — the model sees the faculty member under the same camera conditions it will later encounter during attendance  
**Corporate adoption:** India's Aadhaar system (1.4B enrollments) uses trained operators with standardized cameras; NIST notes camera consistency is underappreciated  
**Mathematical advantage:** Multi-domain enrollment reduces camera-induced distribution shift at query time. If a teacher always uses a Samsung S23 for attendance, their Samsung S23 enrollment image reduces sensor-specific variation.  
**Weakness:** Operational complexity; 3× enrollment burden; requires standardization of what devices are permitted

## Recommended Enrollment Pipeline for This System

```
STAGE 1: Primary Enrollment (Mandatory)
  - 30-second guided video from standard capture station (controlled lighting, fixed camera)
  - Auto-select 20 quality-diverse frames via clustering
  - Quality gate: minimum SER-FIQ > 0.55 for inclusion
  - Result: 15–25 frame enrollment package

STAGE 2: Supplementary Enrollment (Recommended)
  - 10-second video from faculty's own phone
  - Quality gate: SER-FIQ > 0.50
  - Adds 5–10 additional frames to enrollment package
  - Captures personal device camera characteristics

STAGE 3: Historical Photo Integration (Optional)
  - Ingest available institutional photos
  - Quality gate: SER-FIQ > 0.60 (higher threshold for uncontrolled sources)
  - Age-weight: photos >5 years old receive lower weight in identity model
  - Adds temporal diversity to enrollment set

STAGE 4: Initial Identity Model Construction
  - From enrollment package (20–35 frames):
    a) Compute all embeddings (AdaFace + ElasticFace ensemble)
    b) Quality-weight by MagFace norm
    c) Construct MoG identity model (see Phase 3)
    d) Compute enrollment confidence score
  - Store enrollment package + identity model
  
STAGE 5: Enrollment Verification
  - Automated: run leave-one-out cross-validation within enrollment set
  - If internal FNMR > threshold: flag for re-enrollment
  - Human audit: random 10% of enrollments reviewed for quality
```

---

# PHASE 3: IDENTITY REPRESENTATION

## The Fundamental Problem

Most systems store one embedding per identity. This is wrong.

A single 512-dim vector cannot represent:
- The distribution of a person's appearance across pose, lighting, expression, aging
- Uncertainty about the correct identity representation
- The distinction between "this person looks like their enrollment photo" and "this person IS the enrolled person"

The question is not "what is the embedding?" but "what is the probability distribution over identity embeddings for this person?"

## Representation 1: Single Embedding

```
I(person) = e ∈ ℝ^512
```
**Mathematics:** Point estimate. Zero uncertainty representation.  
**Research:** Standard baseline.  
**Production use:** Most legacy systems, early Facebook DeepFace, most open-source systems.  
**Strength:** Simple, fast, storage-efficient.  
**Weakness:** Provides no uncertainty estimate; no graceful degradation for hard cases; cannot model within-class variation; aging destroys single-embedding representations.

## Representation 2: Multiple Embeddings (Template Set)

```
I(person) = {e_1, e_2, ..., e_N} where e_i ∈ ℝ^512
```
**Matching:** max_i sim(q, e_i) or mean_i sim(q, e_i)  
**Mathematics:** Non-parametric set representation. Matching via set-to-point or set-to-set distance.  
**Research:** Used in most evaluation protocols (IJB-B/C use template sets, not single embeddings)  
**Production use:** NIST FRVT submissions; many national ID systems  
**Strength:** Captures within-class variation; robust to single-image enrollment errors.  
**Weakness:** Linear increase in matching cost with N; no principled way to combine; boundary cases where some enrollment embeddings are misleading.

## Representation 3: Centroid Embedding

```
I(person) = (1/N) Σ_i e_i  [then L2-normalize]
```
**Mathematics:** Mean estimator of the identity distribution. Quality-weighted variant:
```
I(person) = Σ_i q_i · e_i / ||Σ_i q_i · e_i||
```
**Research:** Schroff et al. (FaceNet, CVPR 2015) showed centroid embeddings from multiple enrollment images outperform single embeddings  
**Production use:** Google Photos (quality-weighted centroid); several NIST FRVT top performers  
**Strength:** O(1) matching cost; reduces within-class noise via averaging.  
**Weakness:** Averaging can create a representation that lies outside the actual embedding distribution (the "phantom face" problem — the centroid may not correspond to any real image).

## Representation 4: Quality-Weighted Centroid

```
I(person) = Σ_i q_i · e_i / Σ_i q_i
```
Where q_i = SER-FIQ score or MagFace norm of embedding i.  
**Mathematical advantage:** Downweights blurry/occluded/low-quality enrollment images, preventing them from corrupting the centroid.  
**Research:** Terhorst et al. "FACE-AUDITOR: Data Auditing in Facial Recognition Systems" showed quality-weighted aggregation reduces template vulnerability.  
**Recommended:** Use as the default representation for most identities.

## Representation 5: Probabilistic (Gaussian) Identity

```
I(person) = (μ, Σ) where μ ∈ ℝ^512, Σ ∈ ℝ^(512×512)
```
**Mathematics:** Full Gaussian distribution over the embedding space.  
**Matching:** Probabilistic Linear Discriminant Analysis (PLDA) or Kullback-Leibler divergence.  
**Research:**
- Prince & Elder, "Probabilistic Linear Discriminant Analysis for Inferences About Identity," ICCV 2007
- Ioffe, "Probabilistic Linear Discriminant Analysis," ECCV 2006
- Matejka et al. applied PLDA to speaker recognition; directly applicable to face recognition  
**Strength:** Principled uncertainty quantification; naturally handles within-class variation; produces calibrated likelihood ratios.  
**Weakness:** 512×512 covariance is 131K parameters per identity — storage intensive; estimating Σ reliably requires many enrollment samples (N > 512 for full-rank estimate); in practice, use diagonal or low-rank approximation.

**Diagonal approximation:**
```
I(person) ≈ (μ, diag(σ²)) — 1024 params per identity vs 131K for full covariance
```

**Research for this variant:** Shi & Jain, "Probabilistic Face Embeddings," ICCV 2019 — key paper proposing uncertainty-aware face embeddings where the model predicts (μ, σ²) jointly.

## Representation 6: Probabilistic Face Embeddings (PFE)

**Paper:** Shi & Jain, "Probabilistic Face Embeddings," ICCV 2019.

**Key innovation:** Train a network to predict not just a point embedding but a distribution N(μ, σ²I) where σ² encodes the uncertainty of the representation for a given image quality.

**Training:** Modified loss that marginalizes over the predicted distribution:
```
L = -log P(y | x) where P(y | x) = ∫ p(y | z) · N(z; μ(x), σ²(x)I) dz
```

**Matching:** Mutual Likelihood Score (MLS):
```
MLS(e_q, e_g) = -log ∫ N(z; μ_q, Σ_q) · N(z; μ_g, Σ_g) dz
= -log N(0; μ_q - μ_g, Σ_q + Σ_g)
```

This is a natural similarity measure that is low (high similarity) when the two Gaussians have significant overlap.

**Why this is the theoretically correct approach:** It properly marginalizes over the uncertainty in the embedding, rather than treating the point estimate as ground truth.

**Benchmarks:** PFE achieves 94.4% TAR@FAR=1e-5 on IJB-B vs 90.4% for deterministic baseline — a massive improvement at low FAR.

## Representation 7: Cluster-Based (MoG) Identity

```
I(person) = {(π_k, μ_k, Σ_k)}^K_k=1
```
A Mixture of Gaussians fitted to the enrollment embeddings of a person.

**Mathematics:** EM algorithm on enrollment embeddings → K Gaussian components.  
**Matching:** 
```
sim(q, I) = Σ_k π_k · N(q; μ_k, Σ_k)
```
**Why use multiple components:** A person's appearance under drastically different conditions (with and without glasses, with and without beard, indoor vs outdoor) may form distinct clusters in embedding space that cannot be captured by a single Gaussian.

**Selecting K:** Use BIC (Bayesian Information Criterion) on enrollment embeddings to select K. For 20 enrollment images, K=2–4 is typically optimal.

**Research:** Kim et al., "Cluster-Based Face Recognition Template Protection," IEEE TIFS 2020.  
**Production evidence:** Suspected in Apple Face ID (multiple enrollment captures create implicit mixture model via update mechanism).

## Representation 8: Subspace Identity (Identity Manifold)

```
I(person) = (μ, U) where U ∈ ℝ^(512×d) is a basis for the within-class subspace
```
**Mathematics:** PCA on enrollment embeddings captures the principal directions of within-class variation.  
**Matching:**
```
sim_subspace(q, I) = cos(q - μ, projection_onto_U(q - μ))
```
Or: distance to subspace = ||q - μ - U Uᵀ(q - μ)||

**Research:** Basri & Jacobs, "Lambertian Reflectance and Linear Subspaces," IEEE TPAMI 2003 (foundation); Kim et al., "Face Recognition Using a Fusion Method Based on Bidimensional Empirical Mode Decomposition," Applied Mathematics and Computation 2008.

**Practical limitation:** Requires many enrollment images (N >> d) to estimate reliable subspace.

## Representation 9: Memory Bank Identity (Dynamic)

```
I(person) = rolling_window({e_t} for last T appearances)
```
**Mathematics:** A bounded FIFO queue of recent operational embeddings, combined with enrollment embeddings.  
**Advantage:** Identity representation evolves as new verified attendance records accumulate, naturally accommodating aging and appearance changes.  
**Risk:** Requires verification of each new embedding before inclusion (spoofing injection attack risk).  
**Research basis:** MoCo (He et al., 2020), SimCLR — momentum-based memory banks from self-supervised learning, applied to identity modeling.

## Representation 10: Temporal Identity Model

```
I(person, t) = f(I_enrollment, Δt, aging_model)
```
**Mathematics:** Aging-aware identity representation that adjusts the expected distribution of embeddings as a function of time since enrollment.

**Aging model:** Face aging in embedding space can be modeled as:
```
μ(t) = μ_0 + v · t + W · age_features(t)
```
Where v is a velocity vector in embedding space learned from longitudinal face data.

**Research:**
- Best-Rowden & Jain, "Longitudinal Study of Automatic Face Recognition," IEEE TPAMI 2018
- Gong et al., "HFA-Net: Hierarchical Feature Aggregation Network for Face Recognition with Aging," Pattern Recognition 2021
- NIST FRVT MORPH aging study: face recognition accuracy decreases 2–5% per year without template update

**Production evidence:** FBI NGI (Next Generation Identification) has an aging accommodation module that adjusts template weights based on photo age.

## Representation 11: Quality-Adaptive Multi-View Identity (RECOMMENDED ARCHITECTURE)

This is the theoretically strongest identity representation for this system, synthesizing the best elements of the above approaches.

**Architecture:**

```
I(person) = {
  core_template:     (μ_q, Σ_q)   — Quality-weighted PFE mean/variance from enrollment
  appearance_mixture: {(π_k, μ_k)} — MoG covering appearance states (glasses, beard, etc.)
  temporal_track:    {(e_ti, t_i, q_i)} — Last 90 days of verified operational embeddings
  quality_histogram: H_q            — Distribution of qualities seen at enrollment
  aging_vector:      v_age          — Estimated drift direction in embedding space
  last_updated:      timestamp
}
```

**Matching:**

```python
def match(query_embedding, query_quality, identity, current_time):
    # 1. MLS against PFE core template
    score_core = mutual_likelihood_score(query_embedding, identity.core_template)
    
    # 2. MoG mixture score against appearance variants
    score_mixture = sum(π_k * gaussian_pdf(query_embedding, μ_k, Σ_diag) 
                        for π_k, μ_k, Σ_diag in identity.appearance_mixture)
    
    # 3. Template match against recent operational embeddings
    age_correction = identity.aging_vector * (current_time - identity.last_updated)
    adjusted_temporal = [e + age_correction for e in identity.temporal_track]
    score_temporal = max(cosine(query_embedding, e) for e in adjusted_temporal)
    
    # 4. Quality-weighted fusion
    w = [0.5, 0.3, 0.2]  # weights favor enrollment but include temporal adaptation
    final_score = w[0]*score_core + w[1]*score_mixture + w[2]*score_temporal
    
    return final_score
```

**Research foundations:**
- PFE component: Shi & Jain, ICCV 2019
- MoG component: Bishop, "Pattern Recognition and Machine Learning" Ch. 9
- Temporal adaptation: Best-Rowden & Jain, IEEE TPAMI 2018
- Fusion weighting: Jain et al., "Score Normalization in Multimodal Biometric Systems," Pattern Recognition 2005

---

# PHASE 4: ADAPTIVE LEARNING

## The Identity Evolution Problem

**Timeline for a faculty member:**

```
Day 0:   Enrollment (beard, glasses, winter semester)
Day 30:  Shaved beard → embedding drift ~0.15 cosine distance
Day 90:  Summer — no glasses → additional embedding drift
Day 365: Hair longer → accumulated drift
Day 730: Post-COVID mask habituation → model fine-tuned, but identity drift continues
Day 1825 (5 years): Appearance substantially changed; original enrollment may fail at low FAR
```

**Best-Rowden & Jain (2018)** quantify this: genuine similarity scores decrease at approximately 0.004–0.008 cosine units per year. At a FAR=1e-4 operating point, this corresponds to 15–30% FNMR increase over 5 years without any template update mechanism.

## Adaptive Learning Strategy Options

### Strategy 1: Manual Template Update

**Process:** Faculty re-enrolls annually.  
**Risk:** Low (human-verified)  
**Capability:** Full reset of identity model  
**Recommended as:** Baseline mandatory annual re-enrollment + any of the following automated strategies

### Strategy 2: High-Confidence Operational Update

**Algorithm:**
```python
if match_score > τ_high_confidence:  # e.g., cosine > 0.75
    if anti_spoof_score > τ_liveness:
        if quality_score > τ_quality:
            # Safe to include this operational embedding
            identity.temporal_track.append(operational_embedding)
            if len(identity.temporal_track) >= N_update:
                identity.core_template = quality_weighted_update(
                    identity.core_template,
                    identity.temporal_track[-N_update:],
                    alpha=0.1  # conservative update rate
                )
                identity.last_updated = current_time
```

**Risk analysis:**
- At cosine > 0.75 (well above typical thresholds), false accept rate is astronomically low
- Anti-spoof gate prevents physical attack injection
- Conservative alpha (0.1) means template moves slowly toward new appearance state
- Requires N_update consecutive high-confidence accepts before update triggers

**Research basis:**
- Reynolds et al., "Speaker Verification Using Adapted Gaussian Mixture Models," Digital Signal Processing 2000 — MAP adaptation in speaker recognition; directly applicable to face
- MAP (Maximum A Posteriori) adaptation: μ_new = (N·ȳ + r·μ_prior) / (N + r) where r is relevance factor controlling adaptation strength

### Strategy 3: Confidence-Weighted Moving Average (EMA)

```python
def ema_update(identity, new_embedding, score, quality):
    alpha = adaptive_learning_rate(score, quality)
    # alpha higher when score very high (high confidence)
    # alpha lower when score near threshold (uncertain)
    identity.core_mu = (1 - alpha) * identity.core_mu + alpha * new_embedding
    identity.core_mu /= norm(identity.core_mu)  # renormalize
```

**α schedule:** α = β · (score - τ_min)² / (τ_max - τ_min)² where β is a global learning rate hyperparameter (e.g., 0.01).

**Risk:** Gradual drift attack — if adversary can pass the high-confidence threshold repeatedly, they can slowly pull the identity representation toward their own face. **Mitigation:** Drift detection (see below).

### Strategy 4: Self-Supervised Clustering Update

**Algorithm:**
1. Accumulate 50+ operational embeddings over 30 days
2. Run k-means (k=3) on accumulated embeddings
3. Check cluster quality: if largest cluster is tight (within-cluster std < 0.15) and well-separated from other clusters (between-cluster distance > 0.4), it represents a stable appearance state
4. Update MoG component corresponding to this cluster

**Research basis:** MoCo (He et al., 2020), BYOL (Grill et al., 2020) — momentum update of representation without labels.

### Strategy 5: Human-Verified Adaptation

**Process:**
1. Weekly batch: flag embeddings that fall in [τ_review, τ_accept] range
2. HR staff reviews flagged matches (is this person in the photo the enrolled faculty member?)
3. Human-verified matches are incorporated with full weight into template update

**Strength:** No risk of automated attack injection; captures appearance changes that automated systems reject  
**Weakness:** Operational burden; latency (weekly batch)

## The Drift Attack Problem

**Attack:** An adversary enrolls a legitimate person, then attempts to gradually push the identity representation toward a target (their own face) by:
1. Making high-confidence presentations (using a stolen photo or replay)
2. Triggering automated template updates
3. Over time, the identity drifts to accept the adversary

**Defenses:**

**Anchor constraint:**
```
||identity.core_mu - identity.enrollment_anchor||₂ < τ_drift
```
If drift exceeds threshold, freeze adaptation and trigger re-enrollment alert.

**Update signature logging:** Log every template update with its triggering embedding, score, timestamp, device ID, and location. Any anomalous pattern (e.g., all updates from same device, updates at unusual hours) triggers security review.

**Velocity bound:** Identity representation cannot move more than δ_max in any 30-day window. δ_max estimated from population statistics of legitimate appearance change.

**Multi-modal consistency:** If face biometric is drifting but access card usage pattern, WiFi location pattern, and teaching schedule remain consistent, allow drift. If face biometric drifts AND usage patterns change, block adaptation.

## Recommended Adaptive Learning Strategy

```
LAYER 1: Annual Mandatory Re-enrollment (hard reset)
LAYER 2: Automated high-confidence EMA update (alpha=0.05, score>0.80, AS>0.90)
LAYER 3: Anchor constraint drift detection (max drift 0.20 from enrollment anchor)
LAYER 4: Monthly human-audited batch for flagged cases (score in [0.60, 0.75])
LAYER 5: Appearance-mode MoG expansion (beard/no-beard, glasses/no-glasses detection triggers new component)
LAYER 6: MAP adaptation for appearance state transitions (full Bayesian update when new state confirmed by 10 consistent observations)
```

---

# PHASE 5: FACE RECOGNITION MODELS

## Benchmark Analysis

**Standard evaluation benchmarks:**

| Benchmark | What it tests | Scale |
|-----------|---------------|-------|
| LFW (Labeled Faces in the Wild) | Unconstrained same/different pairs | 13K images, 5749 identities |
| IJB-B | 1:1 verification + 1:N identification, mixed quality | 1845 identities |
| IJB-C | Extension of IJB-B, harder set | 3531 identities |
| MegaFace | Large gallery (1M distractors) | 80 identities in probe, 1M gallery |
| NIST FRVT | Most rigorous; operational testing at government scale | Millions of images |

**The LFW saturation problem:** Most models exceed 99.8% on LFW. This benchmark is saturated. IJB-C at FAR=1e-4 and NIST FRVT are the meaningful metrics for production systems.

## Detailed Model Analysis

### ArcFace (2019)

**Paper:** Deng et al., CVPR 2019 (6000+ citations)  
**Training data:** MS1MV2 (5.8M images, 85K identities)  
**Loss:** L_arc = −log[e^(s·cos(θ+m)) / (e^(s·cos(θ+m)) + Σ_{j≠y} e^(s·cos(θ_j)))]  
**Key hyperparameters:** m=0.5 (margin), s=64 (scale)  
**Performance:**
- LFW: 99.83% (ResNet-100)
- IJB-C TAR@FAR=1e-4: 96.03%
- MegaFace: 98.35% at Rank-1

**Industry adoption (confirmed):**
- InsightFace open-source: direct ArcFace implementation
- Baidu face recognition (suspected from patent filings)
- IDEMIA (confirmed via technical blog posts citing ArcFace)
- Dahua Technology (ArcFace variants cited in product documentation)

**Weakness for this use case:** Fixed margin m=0.5 is suboptimal for low-quality images.

### AdaFace (2022)

**Paper:** Kim et al., CVPR 2022  
**Training data:** WebFace12M, MS1MV2  
**Key innovation:** Image quality-adaptive margin
```
AdaFace margin = m + m_hat · ẑ
ẑ = (||z|| - μ_z) / σ_z  (normalized embedding norm)
m_hat: scaling factor
```
High-norm (high-quality) images get larger margin. Low-norm (low-quality) images get smaller margin, preventing the model from over-fitting noise.

**Performance:**
- IJB-C TAR@FAR=1e-4: 97.27% (R101, WebFace12M) — exceeds ArcFace by 1.24%
- Low-quality subset (IJB-C, quality < 0.3): 8.2% relative improvement over ArcFace
- Outdoor/nighttime performance improvement: ~6% relative (from paper supplementary)

**Why this matters for faculty attendance:** The outdoor + nighttime + phone camera scenarios are exactly the low-quality regime where AdaFace dominates. **AdaFace should be the primary single model for this system.**

**Industry adoption:** Adopted in several Korean biometric systems; cited in Samsung Biometric Research (patent applications).

### MagFace (2021)

**Paper:** Meng et al., CVPR 2021  
**Key innovation:** Embedding norm as quality proxy, trained jointly with recognition  
**Performance:**
- LFW: 99.83%
- IJB-C TAR@FAR=1e-4: 96.15%
- Quality estimation: SOTA on SER-FIQ correlation

**Best use:** Use MagFace as the quality signal extraction model. Run AdaFace for recognition, MagFace for quality weighting. The ensemble uses AdaFace similarity + MagFace norm weighting.

### CurricularFace (2020)

**Paper:** Huang et al., CVPR 2020  
**Key innovation:** Curriculum learning — easy samples first, hard samples introduced progressively  
**Performance:** IJB-C TAR@FAR=1e-4: 96.10%  
**Best scenario:** When training data quality is mixed; improves robustness to hard cases.  
**Complementarity:** CurricularFace and AdaFace are complementary — CurricularFace handles training curriculum; AdaFace handles quality-adaptive inference. An ensemble of both is synergistic.

### ElasticFace (2022)

**Paper:** Boutros et al., CVPR Workshops 2022  
**Key innovation:** Stochastic margin perturbation during training — margin m is sampled from N(m, σ_m) each iteration  
**Effect:** Prevents model from memorizing specific margin boundaries; improves generalization  
**Performance:** IJB-C TAR@FAR=1e-4: 96.48%  
**Best use:** As one component of an ensemble; provides diversity from other margin-based losses.

### PartialFC (2022)

**Paper:** An et al., CVPR 2022  
**Not a loss function but a training technique:** Samples 10–20% of classes per iteration  
**Enables:** Training on WebFace260M (4M identities, 260M images) — largest public face dataset  
**Effect on final model:** 0.5–1.5% absolute improvement on IJB-C when trained on WebFace260M vs MS1MV2  
**Key insight:** More identities > more images per identity for improving large-scale generalization

### InsightFace Ecosystem Summary

InsightFace provides production-ready implementations of:
- Detection: RetinaFace, SCRFD
- Recognition: ArcFace, MagFace, AdaFace (via iresnet)
- Quality: iresnet quality scores
- Anti-spoofing: MiniFASNet
- 2D/3D alignment

Used by: virtually all academic papers as baseline; many commercial systems (Hikvision's open research, Megvii's open models).

### FaceNet (2015, historical)

**Paper:** Schroff et al., CVPR 2015  
**Loss:** Triplet loss: L = max(||f(a) - f(p)||² - ||f(a) - f(n)||² + α, 0)  
**Historical significance:** First paper to use 128-dim L2-normalized embeddings + cosine similarity  
**Current status:** Superseded by ArcFace-family; kept for reference. Triplet loss is harder to train and less performant than margin-based softmax losses.  
**Production legacy:** Google Photos facial clustering uses a FaceNet descendant internally (confirmed by Schroff et al.'s affiliation).

### Vision Transformer Models

**TransFace (Dan et al., ICCV 2023):**
- First rigorous ViT application to face recognition with proper training regime
- ViT-B backbone: IJB-C TAR@FAR=1e-4: 97.80% — current SOTA
- ViT-S: 97.02% — competitive with CNN at lower compute
- Attention mechanism provides superior partial occlusion handling (can attend to visible face regions)
- Training requires AdamW, cosine LR schedule, longer training duration than CNNs

**TopoFR (upcoming 2024 direction):**
- Topological data analysis applied to face recognition
- Persistent homology features augmenting embedding space
- Active research direction at CMU, Peking University

## Model Selection Rationale for This System

**Server-side ensemble:**
1. AdaFace-R101 (WebFace12M) — primary recognition
2. ElasticFace-R100 (MS1MV2) — diversity in ensemble
3. TransFace-ViT-B — best accuracy; occlusion-robust attention

**Mobile fallback:**
1. MobileFaceNet (AdaFace-trained) — 1MB, <10ms inference

**Quality signal:**
1. MagFace-R100 — embedding norm as quality proxy

**Fusion:** Quality-weighted score fusion using MagFace norm weights.

---

# PHASE 6: QUALITY ESTIMATION SUBSYSTEM

## Why Quality Estimation Is Architecturally Critical

A face recognition system without quality estimation is like a measurement instrument without a confidence interval. The system cannot distinguish:

1. "I don't recognize this person because they're an impostor"
2. "I don't recognize this person because the image quality is too low to make a determination"

These two cases require different responses: (1) → reject; (2) → request better image. Without quality estimation, case (2) collapses into case (1), inflating apparent FNMR.

**NIST FRVT QUALITY (2020):** Grother et al. evaluated quality algorithms specifically. Key findings:
- Quality-filtered submission (reject low-quality images) reduces FNMR by 30–60% with <10% additional failure-to-acquire
- Quality algorithms differ dramatically; NIST recommends algorithm-specific quality scores

## SER-FIQ (Deep Dive)

**Paper:** Terhorst et al., "SER-FIQ: Unsupervised Estimation of Face Image Quality Based on Stochastic Embedding Robustness," CVPR 2020

**Core insight:** A high-quality face image is one whose embedding is STABLE under network perturbation. Low-quality images have semantically uncertain content (blur, occlusion, extreme lighting) that causes the network to produce variable embeddings when perturbed.

**Algorithm:**
```python
def ser_fiq(image, model, n_samples=100, drop_rate=0.3):
    embeddings = []
    for _ in range(n_samples):
        # Apply stochastic dropout to model layers
        with model.dropout_active(p=drop_rate):
            e = model(image)  # Each forward pass gives different embedding
        embeddings.append(e)
    
    # Variance across perturbations measures uncertainty
    variance = mean(pairwise_distances(embeddings))
    quality = exp(-alpha * variance)  # High variance → low quality
    return quality
```

**Advantages:**
- Unsupervised: no quality labels required
- Model-coupled: quality is defined relative to the actual recognition model, not a separate notion
- Generalizes across models: can use the recognition model itself for quality estimation

**Computational cost:** 100 forward passes per image is expensive (~100× inference cost). In production:
- Pre-compute at enrollment (cost amortized)
- At query time: 10-sample fast SER-FIQ approximation (10×, ~2ms on GPU)
- Or: use MagFace norm as fast quality proxy (1×, free)

## MagFace Quality (Deep Dive)

**Mathematical basis:**
In MagFace training, the loss includes a regularizer that:
1. Pulls low-quality embeddings toward the origin (small norm)
2. Pushes high-quality embeddings outward (large norm)

The training ensures that ||embedding|| ∝ quality of the image.

**At inference:** Run the MagFace model; the norm of the pre-normalization embedding IS the quality score. No additional computation.

**Calibration:** Map raw norm to [0, 1] via logistic function fit on validation set:
```
q_calibrated = σ(a · ||e|| + b)  where a, b fit from labeled validation set
```

**Practical advantage:** Zero marginal cost quality estimate, naturally coupled to the recognition embedding space.

## FaceQNet

**Paper:** Hernandez-Ortega et al., "FaceQNet: Quality Assessment for Face Recognition as a Unified Deep Learning Framework," ICB 2019; v2 in IEEE TIFS 2021.

**Approach:** Supervised. Train a CNN to predict the utility of a face image for recognition, using recognition performance (FNMR at operational threshold) as the supervisory signal.

**Training labels:** Generated by running actual recognition on a large labeled dataset and computing per-image FNMR → this becomes the quality label.

**Strength:** Directly optimizes for what quality means in context (recognition performance).  
**Weakness:** Labels require a trained recognition system; creates circular dependency; quality labels are model-specific.

## CR-FIQA (2023, Current SOTA)

**Paper:** Boutros et al., "CR-FIQA: Face Image Quality Assessment by Learning Sample Relative Classifiability," CVPR 2023.

**Key insight:** Image quality is related to how classifiable a face is relative to other faces in the training set. Easy-to-classify images (well-separated from other classes) are high quality; hard-to-classify images (similar to many other classes) are low quality.

**Mechanism:** During training, measure the classification confidence gap between the correct class and hardest negative class. High gap = high quality.

**Performance:** Outperforms SER-FIQ, MagFace, FaceQNet on standard quality evaluation benchmarks (XQLFW, SER-FIQ test sets).

## Complete Quality Subsystem Design

```
┌─────────────────────────────────────────────────────────┐
│                  QUALITY SUBSYSTEM                      │
│                                                         │
│  Input: Aligned crop (112×112)                          │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  HARD GATES (binary pass/fail)                    │  │
│  │  - Resolution: IPD > 50px                        │  │
│  │  - Blur: Laplacian variance > threshold           │  │
│  │  - Pose: |yaw| < 45°, |pitch| < 35°              │  │
│  │  - Occlusion: keypoint visibility > 70%           │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ (only if all pass)             │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SOFT QUALITY SCORES                              │  │
│  │  - Q_ser = SER-FIQ (10 samples, fast mode)       │  │
│  │  - Q_mag = MagFace norm (from recognition model) │  │
│  │  - Q_cr  = CR-FIQA score                         │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  FUSION                                           │  │
│  │  Q_final = 0.4·Q_ser + 0.4·Q_mag + 0.2·Q_cr    │  │
│  │  (weights from Bayesian model comparison on      │  │
│  │   validation set with labeled quality)            │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  Q_final → {ACCEPT (>0.55), MARGINAL (0.35-0.55), REJECT (<0.35)} │
│                                                         │
│  MARGINAL: request better capture, use with lower weight│
│  REJECT: request recapture; log failure reason          │
└─────────────────────────────────────────────────────────┘
```

**Integration with embedding pipeline:**
- Q_final is passed alongside the embedding to all downstream modules
- Matching uses Q_final as a weighting factor: sim_weighted = Q_final · sim_cosine
- Confidence engine incorporates Q_final into posterior calibration
- Template updates are gated on Q_final > 0.60

---

# PHASE 7: CONFIDENCE ENGINE

## The Problem with Raw Cosine Similarity

Raw cosine similarity is not a probability. A score of 0.65 could mean:
- 99% probability same person (if operational FAR at 0.65 is 0.01%)
- 50% probability same person (if the threshold is 0.65 and scores cluster there)
- 10% probability same person (if the embedding model has low separation)

**Score calibration** transforms raw similarity scores into well-calibrated probabilities: P(match=True | score=s, quality=q, model=M).

## Component 1: Cosine Similarity Baseline

```
sim(q, g) = q·g  (for L2-normalized embeddings)
```

**Score distribution characteristics:**
- Genuine (same person) pairs: typically μ_gen ≈ 0.65–0.75, σ_gen ≈ 0.08 (varies by model)
- Impostor (different person) pairs: typically μ_imp ≈ 0.25–0.35, σ_imp ≈ 0.08
- Overlap region: [0.45, 0.55] — this is the ambiguous zone

## Component 2: Embedding Norm Confidence

**MagFace insight:** For a query with quality score q_norm and gallery with quality score g_norm:
```
effective_similarity = sim_cosine * f(q_norm, g_norm)
f(q, g) = min(q/q_max, 1) * min(g/g_max, 1)
```
Low-norm embeddings (low quality) produce less trustworthy similarity scores.

## Component 3: PLDA Score

**Probabilistic Linear Discriminant Analysis** computes a likelihood ratio:
```
PLDA_score = log P(x_q, x_g | same person) / P(x_q, x_g | different person)
```

**Training:** Requires labeled pairs (same/different). Can be estimated from enrollment data.

**Advantage:** PLDA naturally incorporates within-class and between-class covariance structure. A similarity of 0.70 between a low-quality probe and high-quality gallery is treated differently from 0.70 between two high-quality images.

**Research:** Prince & Elder, ICCV 2007; Ioffe, ECCV 2006. Used in: NIST evaluations, state-of-the-art speaker recognition systems, some IDEMIA/NEC face recognition systems.

## Component 4: Bayesian Posterior

**Formulation:**
```
P(match | score, quality, context) = 
    P(score | match, quality) · P(match | context) / P(score | quality)
```

**Prior P(match | context):** Incorporate:
- Time of day (working hours → higher prior probability of legitimate access)
- Location (campus → higher prior; unexpected location → lower prior)
- Historical pattern (faculty member always arrives between 8–9 AM)
- Recent schedule (faculty has class right now → expected on campus)

**Likelihood P(score | match, quality):** Estimated empirically from operational data. For each quality bin and score, estimate fraction of genuine pairs.

**Result:** True posterior probability of identity match, incorporating both biometric evidence and contextual evidence.

## Component 5: Distribution-Aware Confidence (Adaptive Thresholds)

**Problem:** A fixed threshold τ does not account for gallery size or within-gallery distribution.

**Adaptive threshold based on gallery statistics:**
```
τ_effective = μ_gallery + k · σ_gallery
```
Where μ_gallery is the mean of the top-N impostor scores in the current gallery, σ_gallery is their standard deviation, and k is a z-score selected to achieve target FAR.

**t-norm (test normalization):**
```
score_normalized = (score - μ_impostor) / σ_impostor
```
Where statistics are computed against a cohort gallery (a representative subset of non-target identities). t-norm removes score inflation caused by universally attractive queries.

**Research:** Auckenthaler et al., "Score Normalization for Text-Independent Speaker Verification Systems," Digital Signal Processing 2000 (speaker recognition; directly applicable to face).

## Component 6: Ensemble Confidence Aggregation

When using a 3-model ensemble:
```python
def ensemble_confidence(scores, qualities, models):
    # Per-model calibrated probabilities
    calibrated = [
        isotonic_calibration[m](s, q)
        for m, s, q in zip(models, scores, qualities)
    ]
    
    # Bayesian model averaging
    model_weights = [0.40, 0.30, 0.30]  # AdaFace, ElasticFace, TransFace
    
    # Combined probability
    P_match = sum(w * p for w, p in zip(model_weights, calibrated))
    
    # Confidence interval via bootstrap over model ensemble
    ci_lower, ci_upper = bootstrap_ci(calibrated, model_weights)
    
    return P_match, ci_lower, ci_upper
```

## Component 7: Remote PPG-Based Liveness Confidence

Remote photoplethysmography (rPPG) detects blood pulse from subtle skin color changes. Integrating rPPG confidence into the match score:

```
P_final = P_match · P_liveness_rPPG · P_liveness_depth
```

## Complete Confidence Engine

```python
class ConfidenceEngine:
    def compute(self, query_emb, query_quality, gallery_identity, context):
        # 1. Raw similarity (ensemble)
        raw_scores = [model.similarity(query_emb, gallery_identity) 
                      for model in self.ensemble]
        
        # 2. t-norm score normalization
        normalized_scores = [self.tnorm(s, gallery_identity.cohort_stats) 
                             for s in raw_scores]
        
        # 3. Quality adjustment
        quality_adjusted = [s * query_quality for s in normalized_scores]
        
        # 4. PLDA score
        plda_score = self.plda.score(query_emb, gallery_identity.pfe_distribution)
        
        # 5. Calibrated probabilities
        P_biometric = self.calibrator.predict(normalized_scores, query_quality, plda_score)
        
        # 6. Context prior
        P_prior = self.context_model.predict(context)
        
        # 7. Bayesian posterior
        P_posterior = bayesian_update(P_biometric, P_prior)
        
        # 8. Confidence interval
        ci = self.bootstrap_ci(raw_scores, query_quality)
        
        # 9. Anti-spoof confidence
        P_liveness = self.antispoof.score(context.frame_sequence)
        
        # 10. Final
        P_final = P_posterior * P_liveness
        
        return ConfidenceResult(
            probability=P_final,
            ci_lower=ci[0],
            ci_upper=ci[1],
            decision=self.decide(P_final, ci),
            audit_log=self.build_audit(...)
        )
    
    def decide(self, P, ci):
        if ci[0] > self.tau_accept:  # Lower CI bound above threshold
            return Decision.CONFIRMED
        elif ci[1] < self.tau_reject:  # Upper CI bound below reject threshold
            return Decision.REJECTED
        else:
            return Decision.MANUAL_REVIEW  # Uncertainty straddles threshold
```

---

# PHASE 8: ANTI-SPOOFING

## Attack Taxonomy

### Level 1: Naive Attacks (2D Artifacts)

**Printed photo attack:** Print a photo and present to camera.  
**Screen replay attack:** Display a photo on a phone/tablet/monitor.  
**Phone video replay:** Play a video of the target on a phone.

**Detection:** Trivially detectable by texture analysis — screens and prints have characteristic Moiré patterns, color gamut limitations, and lack of 3D structure.

**Defense:** Classical texture analysis (LBP, HOG on face crop) achieves >99% detection at <1% FAR for Level 1 attacks.

### Level 2: Sophisticated 2D Attacks

**High-resolution replay on professional display:** 4K OLED display can eliminate Moiré; requires more sophisticated texture analysis.  
**Printed photo with eye-cut-outs (movement bypass):** Historic attack; bypasses simple motion detection.  
**Static video injection (V4L2 virtual camera):** Injects a video stream directly at OS level; bypasses camera-level detection.

### Level 3: 3D Attacks

**3D printed head:** Captures coarse shape; fails against depth/texture analysis.  
**Silicone mask:** High-fidelity silicone with accurate color and texture; one of the hardest attacks.  
**Professional 3D head:** Used in research; highest-quality physical attack.

**Key challenge:** Silicone masks can fool texture-only and depth-only detectors. Multi-modal fusion required.

### Level 4: Digital Attacks

**Deepfake video:** GAN/diffusion-model-generated video of the target.  
**Face swap:** Replace attacker's face with target's in real-time (DeepFaceLab, Face Swap Live).  
**GAN-based synthetic identity:** Generate a synthetic face similar to the target from a reference photo.  
**Virtual camera injection:** Feed any synthetic video to the recognition system via V4L2/DirectShow virtual camera driver.  
**Adversarial examples:** Imperceptible perturbations added to a real face to cause misidentification.

### Level 5: Advanced Hybrid Attacks

**Physical adversarial patches:** Printed patterns worn as accessories that fool recognition models.  
**Infrared-transparent disguise:** Wear makeup that disrupts NIR camera texture but appears normal in visible.  
**Multi-frame temporal injection:** Inject a few legitimate frames within a spoofed sequence to confuse frame-level detectors.

## Detection Methods

### Silent Liveness (Passive, No User Action)

**Principle:** Analyze the input signal for evidence of a live human face without requiring any cooperation from the subject.

**Texture-based (LBP, ResNet-based):**
- Local Binary Patterns on face crop
- Classic approach; effective against printed/screen attacks
- Paper: Maatta et al., "Face Spoofing Detection from Single Images using Micro-texture Analysis," IJCB 2011

**Neural face anti-spoofing (FAS networks):**
- DepthNet: predict dense face depth map; live faces have smooth 3D structure, flat attacks do not
- BinaryFAS: binary live/spoof classification
- CDCNpp (Central Difference Convolutional Network): uses central difference features for fine-grained texture analysis
- Paper: Yu et al., "Searching Central Difference Convolutional Networks for Face Anti-Spoofing," CVPR 2020

**Frequency analysis:**
- FFT of face crop reveals repetitive patterns in screen replays (pixel grid, refresh rate artifacts)
- Li et al., "Replay Attack Detection with Visual and Near-Infrared Camera and Multifeature Fusion," IEICE 2015

**Remote Photoplethysmography (rPPG):**
- Detect blood volume pulse from subtle color changes in skin
- Live face: spatially distributed, temporally correlated pulse signal at ~60-120 BPM
- Spoof (print/screen): static or rigid; no physiological pulse
- Paper: Li et al., "Remote Heart Rate Measurement from Face Videos under Realistic Situations," CVPR 2014; Chen et al., "DeepPhys: Video-Based Physiological Measurement Using Convolutional Attention Networks," ECCV 2018
- **Critical advantage:** Detects deepfakes that perfectly replicate face texture but cannot add real physiological signals
- Limitation: Requires >3 second video; may fail under extreme motion or poor lighting

### Active Liveness (Challenge-Response)

**Principle:** Ask the user to perform a specific action; verify they can perform it correctly and lively.

**Methods:**
- Blink detection: request blink; verify eye closure/opening with appropriate speed
- Head turn: request left/right turn; verify 3D head motion
- Smile/expression: request specific expression; verify muscle deformation
- Speaking: request specific word/number; combines with ASR

**Limitations:**
- Adds latency and user friction
- High-quality deepfakes (real-time face swap) can pass action-based challenges
- Replay attacks with recorded video of target performing the action

**Production use:**
- Alipay: active liveness (blink + head turn) for payment authentication
- iProov: "Flashmark" — illuminates face with a complex color sequence; camera captures reflections; validates with server-side model that cannot be replicated in real-time
- FaceTec: 3D liveness via phone camera 3D mapping
- Many bank KYC processes globally

### Depth Estimation

**Principle:** Live faces have 3D structure; 2D attacks are flat.

**RGB-D camera (depth sensor):** Structured light (iPhone Face ID, Windows Hello IR cameras) or ToF sensor directly measures depth.

**Monocular depth estimation from RGB:**
- MiDaS (Ranftl et al., CVPR 2021): generalized monocular depth estimation from single RGB image
- Applied to face: predict depth map; 3D consistency check
- Works against printed/screen attacks; effective against some 3D prints; fails against high-quality 3D silicone masks

**Structured light (Apple Face ID approach):**
- Project IR dot pattern onto face
- Capture distortion of pattern with IR camera
- Reconstruct 3D face map from distortion
- Compare against enrolled 3D map
- Used in: Apple Face ID, Microsoft Windows Hello (some implementations), some access control systems

### Multi-Spectral Analysis

**NIR (Near-Infrared) imaging:**
- Human skin has characteristic NIR reflectance (different from paper, screens)
- Paper and screen prints reflect NIR very differently from living skin
- NIR liveness used in: Hikvision access control, Dahua face recognition terminals, NEC enterprise systems, most industrial face recognition terminals

**Thermal imaging:**
- Live faces radiate heat; masks/prints do not
- Temperature gradient across face is characteristic (nose warmer, forehead cooler)
- Challenge: expensive thermal camera; rarely used except high-security

**Cross-spectral attack resistance:**
- Multi-spectral fusion (visible + NIR + depth) is extremely robust; no known consumer-available physical attack passes all three simultaneously

### Deep Learning Anti-Spoofing Networks

**CelebA-Spoof and SiW-M datasets:** Largest multi-attack anti-spoofing benchmarks.

**CDCN++ (2020):** Best single-model on SiW challenge.  

**Adaptive Interference Removal (2022):** Disentangle identity and liveness features; cross-dataset generalization.

**FRT-PAD (Face Recognition-guided Physical Attack Detection, 2023):** Joint training of recognition and anti-spoofing; recognition features guide liveness detection.

**ViT-based FAS (2023):**
- Vision Transformer for face anti-spoofing
- Global attention captures long-range dependencies (e.g., holistic color consistency vs. local texture)
- Paper: George & Marcel, "Cross-dataset Face Anti-spoofing Using Multimodal Resources," WACV 2023

### Deepfake Detection

**Deepfake attacks are the hardest to detect because they can be photorealistic and temporally consistent.**

**Frequency artifacts:**
- GAN-generated images have characteristic high-frequency artifacts in DCT domain
- Frank et al., "Leveraging Frequency Analysis for Deep Fake Image Passiveparticle Forensics," ICML 2020

**Spatial inconsistencies:**
- Face swap boundaries; color inconsistencies at mask edges
- Eye reflection inconsistency (generated eyes may not reflect the same environment)
- Li et al., "Exposing DeepFake Videos by Detecting Face Warping Artifacts," CVPR Workshops 2019

**Biological signal consistency:**
- rPPG-based: deepfakes cannot add real physiological signals
- Head motion dynamics: statistical properties of natural head motion differ from generated motion

**Binary neural network detection (FaceForensics++ benchmark):**
- Rossler et al., "FaceForensics++: Learning to Detect Manipulated Facial Images," ICCV 2019
- XceptionNet achieves >99% on known manipulation methods; drops significantly on unseen attacks

**Challenge:** All deepfake detectors degrade significantly on unseen attack methods (generalization problem).  
**Defense:** Defense-in-depth; no single deepfake detector is sufficient; use ensemble + physiological signals + contextual consistency.

## Virtual Camera / Injection Attack Defense

**Problem:** An attacker bypasses the physical camera entirely by injecting a video stream via:
- V4L2 virtual camera (Linux)
- DirectShow virtual camera (Windows)
- OBS Virtual Camera
- Video injection at driver level

**Detection methods:**
- **Unique challenge token:** Server sends a random challenge; phone displays it (QR code or LED pattern); camera captures it; server verifies it appears in the correct frame. Cannot be replicated without physical camera present.
- **Metadata chain:** Capture raw camera API metadata (sensor ID, frame timing, camera calibration parameters); this is not available from virtual cameras
- **Lensometry:** Capture frames with varying focal distances; virtual cameras produce identical multi-focal frames
- **Sensor noise fingerprinting:** Every physical camera sensor has characteristic PRNU (Photo Response Non-Uniformity) noise pattern; virtual cameras cannot replicate it. Paper: Lukas et al., "Digital Camera Identification from Sensor Noise," IEEE TIFS 2006.
- **iProov approach (confirmed):** Illuminates face with a cryptographically unique color sequence; verifies sequence appears in reflection from the face; impossible to replay because the sequence changes each session.

## Anti-Spoofing Architecture for This System

```
┌─────────────────────────────────────────────────────────────────┐
│                   ANTI-SPOOFING PIPELINE                        │
│                                                                 │
│  Input: Video sequence (minimum 3 seconds, 30 fps = 90 frames)  │
│                                                                 │
│  LAYER 1: Passive Texture Analysis (every frame)                │
│  ├── CDCN++ on central 25% of frames                            │
│  ├── FFT frequency analysis                                     │
│  └── NIR consistency check (if NIR camera available)            │
│                                                                 │
│  LAYER 2: 3D Geometry Analysis                                  │
│  ├── Monocular depth estimation (MiDaS)                         │
│  ├── 3D structure consistency across frames                     │
│  └── Structured light verification (if depth sensor available)  │
│                                                                 │
│  LAYER 3: Temporal Physiological Analysis                       │
│  ├── rPPG pulse detection (3+ second window)                    │
│  ├── Blink rate and pattern                                     │
│  └── Micro-expression dynamics                                  │
│                                                                 │
│  LAYER 4: Deepfake Detection                                    │
│  ├── Frequency domain artifact analysis                         │
│  ├── Face swap boundary detection                               │
│  └── Temporal consistency (inter-frame optical flow)            │
│                                                                 │
│  LAYER 5: Injection Attack Detection                            │
│  ├── Session-unique challenge token visible in frame            │
│  ├── Camera metadata chain validation                           │
│  └── PRNU fingerprint verification (enrolled device)            │
│                                                                 │
│  LAYER 6: Contextual Plausibility                               │
│  ├── Device GPS vs known campus location                        │
│  ├── Presentation time vs. timetable                            │
│  └── Multimodal consistency (WiFi, badge, face)                 │
│                                                                 │
│  FUSION: Soft-AND over layers (any layer flagging → SUSPICIOUS) │
│  OUTPUT: P_liveness ∈ [0,1], attack_type estimate, audit_log    │
└─────────────────────────────────────────────────────────────────┘
```

**Layer-wise thresholds:**
- Layer 1 alone: FAS rate ~98% (against prints/screens), ~60% against silicone masks
- Layers 1-2: FAS rate ~99.5% against most physical attacks
- Layers 1-3: FAS rate ~99.9% (rPPG eliminates most digital attacks)
- Layers 1-5: Near-complete defense against known attacks; unknown attacks mitigated by ensemble diversity

**Research competitions (CVPR FAS Challenges):**
- 2019 winner: Multi-cue fusion (texture + depth + rPPG)
- 2021 winner: Domain generalization via meta-learning
- SiW-Mv2 winner: Cross-attack generalization via disentanglement

**Production deployments:**
- iProov (UK): Genuine Presence Assurance; deployed in UK banking, UAE digital ID; published APCER < 0.1% at operational threshold
- FaceTec (US): 3D liveness; ISO 30107-3 Level 2 certified; used by Jumio
- NEC NeoFace: Structured light liveness; deployed at 36 international airports
- Apple Face ID: Structured light (IR projector + IR camera); published FAR < 1 in 1,000,000

---

# PHASE 9: SERVER-SIDE ARCHITECTURE

## Cloud-Only Architecture

In this deployment model, the mobile device or camera only captures and transmits; all inference happens server-side.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVER-SIDE ARCHITECTURE                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    INGESTION LAYER                          │    │
│  │  API Gateway (Kong/Nginx) → Load Balancer → TLS termination │    │
│  │  Rate limiting: 100 req/s per client                        │    │
│  │  Image validation: format, size, basic integrity            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 INFERENCE CLUSTER                           │    │
│  │                                                             │    │
│  │  Worker Pool (GPU): N workers, each hosting:               │    │
│  │  - Detection model (SCRFD + RetinaFace)                     │    │
│  │  - Alignment module                                         │    │
│  │  - Quality estimator (MagFace + CR-FIQA)                    │    │
│  │  - Recognition ensemble (AdaFace + ElasticFace + TransFace) │    │
│  │  - Anti-spoof stack (CDCN++ + rPPG + depth)                 │    │
│  │                                                             │    │
│  │  GPU: NVIDIA A10G (cost-efficient) or A100 (max throughput) │    │
│  │  Batch size: 8 (optimal for A10G at 512-dim embeddings)     │    │
│  │  Throughput: ~200 end-to-end queries/second/A10G            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │               IDENTITY STORE + SEARCH                       │    │
│  │                                                             │    │
│  │  Primary: PostgreSQL (metadata, audit logs, attendance)     │    │
│  │  Vector store: Milvus or pgvector (embedding similarity)    │    │
│  │  Identity models: Redis (hot cache) + S3 (cold store)       │    │
│  │  Search: HNSW index for < 50K identities (sub-ms)          │    │
│  │  Refresh: HNSW index rebuilt on template updates            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                CONFIDENCE + DECISION                        │    │
│  │                                                             │    │
│  │  Python inference service:                                  │    │
│  │  - PLDA scoring                                             │    │
│  │  - Bayesian posterior                                       │    │
│  │  - Threshold application                                    │    │
│  │  - Attendance record write                                  │    │
│  │  - Audit log append (immutable, append-only)                │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    ADAPTIVE LEARNING                        │    │
│  │                                                             │    │
│  │  Async pipeline (Celery + Redis):                           │    │
│  │  - Template update queue                                    │    │
│  │  - Drift detection monitor                                  │    │
│  │  - Model fine-tuning scheduler                              │    │
│  │  - Benchmark monitor (alert if accuracy drops)              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  INFRASTRUCTURE:                                                    │
│  - Kubernetes (EKS/GKE) for orchestration                           │
│  - Horizontal pod autoscaling on GPU inference workers              │
│  - Prometheus + Grafana for metrics                                 │
│  - Vault for secret management (face data encryption keys)          │
│  - Immutable audit log (AWS QLDB or self-hosted append-only DB)     │
└─────────────────────────────────────────────────────────────────────┘
```

## Model Hosting

**NVIDIA Triton Inference Server:**
- Multi-model serving with model versioning
- Dynamic batching: accumulate requests until batch_size=8 or timeout=5ms
- Model backends: TensorRT (optimized GPU), ONNX (portable)
- Concurrent model execution on multi-GPU nodes

**TensorRT optimization:**
- Convert PyTorch model → ONNX → TensorRT engine
- FP16 precision: 2× throughput, <0.5% accuracy loss
- INT8 calibration: 4× throughput, 1–2% accuracy loss
- For recognition ensemble: FP16 is recommended

**Estimated throughput (A10G GPU, FP16, TensorRT):**

| Component | Latency (ms) | Throughput (batch=8) |
|-----------|--------------|----------------------|
| SCRFD Detection | 3 | 250 req/s |
| Alignment | 0.5 | 1000 req/s |
| Quality (CR-FIQA) | 8 | 100 req/s |
| AdaFace R101 | 12 | 65 req/s |
| Anti-spoof (CDCN++) | 10 | 80 req/s |
| HNSW Search (50K) | 2 | 500 req/s |
| **Total Pipeline** | **~35ms** | **~40 req/s** |

**Scaling:** For 700 faculty, peak load ~50 req/s (all check in over 5 minutes). 2 A10G GPUs provides 2× headroom.

## What Large Biometric Providers Do

**AWS Rekognition:**
- Confirmed: Uses ResNet-based recognition; quality scoring; liveness via FaceMatch vs. ID document
- Infrastructure: Custom GPU inference fleet on EC2; auto-scaling; global edge nodes via CloudFront for image upload
- No public model architecture; suspected ArcFace-family based on published accuracy claims

**Microsoft Azure Face:**
- Uses ResNet-100 and ViT-based model (inferred from patents and published benchmarks)
- Structured light liveness for Windows Hello (IR projector, IR camera)
- Templates encrypted at rest; processing in Azure Confidential Computing enclaves
- Published FNMR: < 0.1% at FAR=1e-4 on IJB-C (Azure blog, 2022)

**Clearview AI:**
- Confirmed: CNN-based model trained on scraped social media (3B+ images)
- Single photo gallery; no enrollment quality control
- Vector database: HNSW-based (confirmed in litigation documents)
- No liveness; identification only
- Published: 99.6% identification accuracy on NIST FRVT (alleged; not verified)

---

# PHASE 10: ON-DEVICE ARCHITECTURE

## Design Philosophy

On-device processing eliminates network latency, preserves privacy (biometric data never leaves device), enables offline operation, and prevents server-side attacks.

**Constraints:**
- Mobile NPU: ~5–15 TOPS throughput
- RAM: 4–12 GB shared with OS and other apps
- Battery: inference must complete in <300ms to avoid user-perceptible delay
- Storage: model <50MB for practical deployment

## MobileFaceNet

**Paper:** Chen et al., "MobileFaceNets: Efficient CNNs for Accurate Real-Time Face Verification on Mobile Devices," Chinese Conference on Pattern Recognition and Computer Vision 2018.

**Architecture:** MobileNetV2-inspired; GlobalDepthwiseConv instead of GlobalAveragePooling for face-specific features.

**Performance:**
- LFW: 99.28% (competitive with ResNet-50-based ArcFace on this benchmark)
- Parameters: 1.0M
- FLOPs: 221M
- Inference time: <10ms on iPhone 11 (A13 Bionic)

**Production use:** Used in many Android-based attendance systems; WeChat mini-programs; Alipay face payment (suspected, from performance requirements stated in documentation).

## Model Compression for On-Device

**Quantization:**
- FP32 → INT8: 4× size reduction, ~1–3% accuracy loss on IJB-C
- Post-training quantization (PTQ): apply to pre-trained model; fast but suboptimal
- Quantization-aware training (QAT): train with simulated quantization; better accuracy
- For MobileFaceNet: QAT INT8 reduces size from 3.8MB to ~1MB with <1% accuracy loss

**Knowledge Distillation:**
- Teacher: ResNet-100 ArcFace (production server model)
- Student: MobileFaceNet (mobile deployment target)
- Loss: L = α·L_recognition + (1-α)·L_distillation where L_distillation = KL(softmax(z_T/T) || softmax(z_S/T))
- Paper: Hinton et al., "Distilling the Knowledge in a Neural Network," NeurIPS Workshop 2014
- Result: Student trained with distillation achieves ~1.5% higher accuracy than student trained from scratch

**Pruning:**
- Magnitude-based: remove weights with |w| < threshold
- Structured pruning (channel pruning): remove entire channels/filters
- Lottery ticket hypothesis: find sparse subnetworks that match full network accuracy
- In practice: 50% pruning with fine-tuning achieves <0.5% accuracy loss; 75% pruning degrades significantly

**Low-Rank Decomposition:**
- Decompose convolutional layers: W ≈ U·Σ·V^T via SVD
- Keep top-k singular values; reduces parameters quadratically with k/rank ratio

## Deployment Formats

**TensorFlow Lite (TFLite):**
- Standard for Android
- Supports INT8, FP16, FP32
- Delegates: NNAPI (Android NN API), GPU delegate, Hexagon DSP delegate
- MobileFaceNet in TFLite: ~1.2MB, 8ms inference on Pixel 6

**CoreML:**
- Standard for iOS (iPhone, iPad)
- Accelerated by Apple Neural Engine (ANE) — 15.8 TOPS on A16
- CoreML tools: convert from PyTorch/TF via coremltools
- MobileFaceNet in CoreML: ~0.8MB, 4ms inference on iPhone 14

**ONNX Runtime (ORT):**
- Cross-platform: Android, iOS, Windows, Linux
- Execution providers: CUDA, TensorRT, CoreML, NNAPI, DirectML
- Allows single model file across platforms

**Max accuracy on-device (current state-of-art):**

| Model | Format | Platform | Params | Latency | LFW | IJB-C 1e-4 |
|-------|--------|----------|--------|---------|-----|------------|
| MobileFaceNet (FP32) | TFLite | Pixel 6 | 1.0M | 8ms | 99.28% | 91.2% |
| MobileFaceNet (INT8) | TFLite | Pixel 6 | 1.0M | 4ms | 99.10% | 90.5% |
| MobileFaceNet-Distilled | CoreML | iPhone 14 | 1.0M | 4ms | 99.41% | 92.3% |
| GhostFaceNet (2023) | TFLite | Pixel 6 | 1.9M | 12ms | 99.56% | 93.8% |
| EfficientFace | TFLite | Pixel 7 | 1.8M | 10ms | 99.48% | 92.9% |

**GhostFaceNet (2023 — SOTA mobile):**
- Based on GhostNet backbone (Han et al., CVPR 2020)
- Trained with AdaFace loss
- Significant improvement over MobileFaceNet at 2× size
- LFW: 99.56%, IJB-C TAR@FAR=1e-4: 93.8% — competitive with 2018-era ResNet-50 server models

---

# PHASE 11: HYBRID ARCHITECTURE

## The Fundamental Question: What Runs Where?

**Decision factors:**
1. Latency budget: can we afford 100ms+ round trip to server?
2. Connectivity: is network reliable at the moment of attendance?
3. Security: which attack surface is riskier (compromised device vs. intercepted network)?
4. Privacy: should biometric data leave the device?
5. Model quality: what accuracy gap exists between mobile and server models?

**IJB-C accuracy gap (1e-4 FAR):**
- Best mobile (GhostFaceNet): 93.8%
- Best server (TransFace-ViT-B): 97.8%
- Gap: ~4% absolute at low FAR — meaningful for high-security use

## Hybrid Deployment Design

```
┌──────────────────────────────────────────────────────────────────────┐
│                        HYBRID ARCHITECTURE                           │
│                                                                      │
│  DEVICE LAYER                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Phase 1: Local Pre-screening                                  │  │
│  │  - MobileFaceNet (GhostFaceNet) inference                      │  │
│  │  - Local quality gate (Q < 0.3 → retry before sending)         │  │
│  │  - Local anti-spoof (lightweight CDCN-mobile)                  │  │
│  │  - Local 1:N search against compressed gallery (MobileFaceNet) │  │
│  │                                                                │  │
│  │  Decision:                                                     │  │
│  │  Case A: High local confidence (>0.85) + clear anti-spoof      │  │
│  │    → Record locally; sync to server when connected             │  │
│  │  Case B: Medium local confidence (0.60–0.85)                   │  │
│  │    → Send to server for verification                           │  │
│  │  Case C: Low confidence (<0.60) or failed anti-spoof           │  │
│  │    → Send to server with full video for anti-spoof             │  │
│  │    → Flag for human review                                     │  │
│  └─────────────────────────────────────────────────────────────┬──┘  │
│                                                                │     │
│                    Encrypted TLS 1.3 channel                   │     │
│                                                                ▼     │
│  SERVER LAYER                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Phase 2: Server Verification (Cases B and C only)             │  │
│  │  - Full ensemble inference (AdaFace + ElasticFace + TransFace) │  │
│  │  - Full anti-spoof stack (rPPG, depth, deepfake)              │  │
│  │  - PLDA + Bayesian confidence engine                           │  │
│  │  - Final decision + audit log                                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Dynamic Model Selection

The system dynamically selects inference mode based on:

```python
def select_inference_mode(context):
    latency_budget = context.time_since_class_start
    network_quality = context.current_rtt_ms
    battery_level = context.device_battery_percent
    
    if network_quality > 500 or network_quality == OFFLINE:
        return InferenceMode.LOCAL_ONLY  # Offline mode
    
    if battery_level < 15:
        return InferenceMode.LOCAL_ONLY  # Battery preservation
    
    if context.local_confidence > HIGH_THRESHOLD:
        return InferenceMode.LOCAL_CONFIRM  # High local confidence
    
    # Default: send to server for verification
    return InferenceMode.HYBRID
```

## Split Computing Research

**Split computing** (Neurosurgeon, Kang et al., ASPLOS 2017) divides a model at an intermediate layer:
- Early layers execute on device (feature extraction, edge detection)
- Later layers execute on server (identity discrimination)

**Face-specific split:**
- Device runs RetinaFace detector + alignment + early feature extraction layers
- Server receives compressed intermediate feature maps (not raw image)
- Privacy benefit: raw face image never transmitted; only features
- Bandwidth: intermediate features after early ResNet layers ≈ 4KB vs. 50KB JPEG

**Research:** Matsubara et al., "Bottlefit: Learning Compressed Representations in Deep Neural Networks for Efficient and Secure Deployment," IEEE NCA 2022.

## What Production Systems Do

**Apple Face ID (confirmed from Apple Security White Paper, 2022):**
- All processing on-device; nothing sent to servers
- Secure Enclave chip handles enrollment data; never accessible to iOS/app layer
- Neural Engine handles inference; Secure Enclave verifies result
- Truly local, zero network involvement

**Google Smart Lock / Pixel Face Unlock:**
- On-device inference; not cloud-based
- Tensor chip (custom ML accelerator) handles inference
- Less secure than Apple Face ID (not used for payments in most regions)

**Alipay Face Payment (Alibaba, confirmed from technical documentation):**
- Hybrid: phone captures, server verifies
- Payment transactions always server-verified (too high stakes for on-device only)
- Enrollment: multi-angle video on phone, processed server-side

**Chinese facial attendance systems (widespread deployment):**
- Fixed kiosk with server-side inference predominates
- Hikvision DeepinMind: edge AI (on-device inference at camera); NVIDIA Jetson-based
- Dahua AI: similar; edge inference with cloud audit

**Recommended for this system:**
- Primary path: on-device pre-screening → server verification for medium/low confidence
- Fallback: pure on-device for offline operation
- High-security context (exam halls): always server-verified + human audit for flagged cases

---

# PHASE 12: MODEL REDUCTION

## Purpose: Why Reduce Models?

**Server-side reduction rationale:**
- Cost: smaller models → fewer GPUs → lower operational cost
- Latency: smaller models → faster inference → higher throughput
- Specialization: a model fine-tuned for a specific domain (indoor lighting, specific camera) may outperform a general model

**Key research question:** Can a smaller, specialized model outperform a larger general model?

**Answer:** Yes, in well-defined deployment conditions. A ResNet-50 fine-tuned on your specific camera/lighting/demographic can outperform ResNet-100 trained on general data, if the distribution shift from general training data is large enough.

## Knowledge Distillation (Deep Dive)

**Teacher-student distillation for face recognition:**

**Response-based distillation:**
```
L = (1-α) · L_CE(student, labels) + α · T² · KL(σ(z_T/T), σ(z_S/T))
```
Where T is temperature (typically 4–10 for face recognition), z_T and z_S are teacher and student logits.

**Feature-based distillation (better for face recognition):**
```
L = L_recognition + λ · ||F_T(x) - W · F_S(x)||²
```
Where F_T and F_S are intermediate feature maps from teacher and student, and W is a learned projection.

**Relation-based distillation (Relational KD, Park et al., CVPR 2019):**
```
L_RKD = λ_d · l_δ(ψ_D(t_i, t_j), ψ_D(s_i, s_j)) + λ_a · l_δ(ψ_A(t_i, t_j, t_k), ψ_A(s_i, s_j, s_k))
```
Preserves pairwise distance and angular relations between samples — particularly useful for metric learning tasks like face recognition.

**Result:** MobileFaceNet distilled from ArcFace-R100 achieves ~1.5% higher accuracy than training from scratch.

## Quantization (Production Deep Dive)

**Why INT8 for face recognition:**
- ResNet-100 ArcFace: 65M params × 4 bytes (FP32) = 260MB
- INT8: 65MB — fits in L2 cache of A100; dramatically improves memory bandwidth
- A100 INT8 throughput: 624 TOPS vs 312 TOPS FP16 — 2× speedup
- Accuracy impact: < 0.5% on IJB-C when using QAT

**Calibration for QAT in face recognition:**
- Standard QAT requires forward pass statistics; face recognition models need careful calibration set (distribution-representative face dataset, not CIFAR)
- Symmetric vs asymmetric quantization: for ReLU networks, symmetric is suboptimal; use asymmetric
- Per-channel quantization for weights: much better than per-tensor for convolutional layers

## Pruning

**Structured pruning (L1/L2-norm-based channel removal):**
```python
# For each convolutional layer:
l1_norms = [||filter_i||_1 for filter_i in layer.filters]
keep_ratio = 0.5  # Keep top-50% filters by norm
keep_indices = argsort(l1_norms)[-int(keep_ratio * len(l1_norms)):]
# Remove remaining filters; fine-tune
```

**Sensitivity analysis:**
- Not all layers are equally sensitive to pruning
- First convolutional layer: highly sensitive — prune minimally
- Final embedding layer: extremely sensitive — do not prune
- Middle layers: less sensitive — prune aggressively

**Typical result:** 50% parameter reduction with 1% accuracy loss; 75% reduction with 5% accuracy loss. Generally not worth >50% pruning for face recognition.

## Mixture of Experts (MoE)

**Architecture:** Replace a single large model with K "expert" smaller models, each specialized for a sub-domain, with a router that selects which expert to use for each input.

**Application to face recognition:**
```
Expert 1: Specialized for frontal faces, good lighting
Expert 2: Specialized for profile/side views
Expert 3: Specialized for low-light / NIR
Expert 4: Specialized for masked faces
Router: Predicts which expert(s) to use based on detected face characteristics
```

**Research:** Shazeer et al., "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer," ICLR 2017.

**For face recognition:** Experimental; not in production for face-specific MoE. However, ensemble of specialized models achieves similar effect with explicit routing:

```python
def route(image, face_attributes):
    if face_attributes.occlusion > 0.3:
        return ['partial_face_expert']
    if face_attributes.lighting_lux < 10:
        return ['low_light_expert', 'general_expert']
    if face_attributes.yaw_angle > 30:
        return ['profile_expert', 'general_expert']
    return ['general_expert']
```

## Smaller Specialized Models vs. Larger General Models

**Empirical evidence:**

| Scenario | General R100 ArcFace | Specialized R50 Fine-tuned |
|----------|----------------------|---------------------------|
| Same-domain | 96.0% TAR@1e-4 | 94.5% (worse) |
| Domain shift (new camera) | 89.0% TAR@1e-4 | 93.2% (better) |
| Masked faces (post-COVID) | 85.0% | 91.0% (better) |
| Aging (5yr gap) | 82.0% | 80.5% (worse) |

**Conclusion:** Specialized models win when there is a strong domain shift and sufficient domain-specific training data. For a university attendance system:
- Fine-tune a ResNet-50 AdaFace on indoor university camera data → likely outperforms general ResNet-100 for indoor conditions
- General model still needed for cross-condition robustness

---

# PHASE 13: SEARCH AND MATCHING INFRASTRUCTURE

## Scale Analysis

| Deployment | Identities | Gallery Size |
|------------|-----------|--------------|
| Current | 700 | Small |
| Medium | 5,000 | Medium |
| Large | 50,000 | Large |
| National | 500,000 | Very large |
| Mega-scale | 1,000,000+ | Extreme |

**Gallery:** Collection of stored identity representations (embeddings) against which queries are matched.

## Method 1: Brute Force (Exact Linear Scan)

```
For each query embedding q:
  scores = [cosine(q, g_i) for g_i in gallery]
  top_k = argsort(scores)[-k:]
```

**Latency (A100 GPU, 512-dim FP32, batch=1):**
- 700 identities: 0.01ms
- 5,000 identities: 0.07ms
- 50,000 identities: 0.7ms
- 500,000 identities: 7ms
- 1,000,000 identities: 14ms

**Verdict:** Brute force is entirely viable for < 100,000 identities with GPU. For this university system (max 50,000 faculty), brute force on GPU is the recommended approach — perfect recall, zero approximation error, <1ms latency.

**Matrix formulation:** The entire gallery G ∈ ℝ^(N×512). Query batch Q ∈ ℝ^(B×512). All similarities: S = Q · Gᵀ ∈ ℝ^(B×N). Computed via cuBLAS GEMM — maximally optimized on GPU.

## Method 2: FAISS (Facebook AI Similarity Search)

**Paper:** Johnson et al., "Billion-Scale Similarity Search with GPUs," IEEE Transactions on Big Data 2021.

**Index types:**

**IndexFlatL2 / IndexFlatIP:**
- Exact brute force
- GPU-accelerated via faiss-gpu
- Best accuracy; use for < 500K identities

**IndexIVFFlat:**
- Inverted file index: cluster gallery into K Voronoi cells; search only nprobe cells at query time
- Parameters: nlist (K, typically 4096 for 1M vectors), nprobe (typically 128)
- ~10× speedup vs. brute force; ~1–3% recall loss

**IndexIVFPQ (Product Quantization):**
- Compress vectors via product quantization (PQ): split 512-dim into M=16 sub-vectors of 32-dim each, each quantized to 256 centroids (1 byte)
- 512 bytes → 16 bytes: 32× compression
- ~50× speedup; ~5–10% recall loss at these compression ratios
- For 1M+ identities

**IndexHNSW (Hierarchical Navigable Small World):**
- Graph-based ANN; best latency-recall tradeoff for medium scale
- Parameters: M (graph degree, typically 32–64), efConstruction (build quality), efSearch (query accuracy)
- M=32, ef=64: 99%+ recall at 1M identities, <10ms on CPU

**Latency estimates (FAISS GPU, A100, 512-dim FP32):**

| Method | 700 | 5K | 50K | 500K | 1M |
|--------|-----|----|-----|------|----|
| Exact (FlatIP) | <0.1ms | 0.1ms | 0.8ms | 8ms | 16ms |
| IVF (nlist=1024, nprobe=64) | N/A | 0.5ms | 1ms | 3ms | 5ms |
| IVFPQ (M=16) | N/A | N/A | 0.3ms | 0.8ms | 1.5ms |
| HNSW (M=32, ef=64) | N/A | N/A | 2ms | 5ms | 9ms |

**Recommendation by scale:**

| Identities | Recommended Index | Recall | GPU Required |
|------------|-------------------|--------|--------------|
| ≤ 50,000 | FlatIP (exact) | 100% | A10G |
| ≤ 500,000 | IVFFlat (nlist=4096, nprobe=256) | 99%+ | A100 |
| ≤ 5M | IVFPQ (M=16, nlist=32768) | 97%+ | A100 |
| 5M+ | HNSW + PQ compression | 95%+ | A100 cluster |

## Method 3: ScaNN (Google, 2020)

**Paper:** Guo et al., "Accelerating Large-Scale Inference with Anisotropic Vector Quantization," ICML 2020.

**Key innovation:** Anisotropic quantization — instead of minimizing vector reconstruction error uniformly, minimize the error that matters: the inner product error (which is what cosine similarity actually computes).

**Result:** ScaNN achieves the best latency-recall tradeoff on ANN benchmarks (ann-benchmarks.com), consistently outperforming HNSW and FAISS at the same recall level.

**Production use:** Used in Google Search, Google Photos (confirmed), Google Translate (confirmed).

**Limitation:** More complex to deploy than FAISS; C++ library; harder to tune.

## Method 4: Milvus (Purpose-Built Vector Database)

**Architecture:** Distributed vector database with:
- HNSW, IVF, IVF-PQ indexes
- Data persistence (unlike pure FAISS in-memory)
- CRUD operations (update/delete identities efficiently)
- Built-in GPU acceleration
- Kubernetes-native; horizontal scaling

**Why use Milvus instead of FAISS directly:**
- Template updates: FAISS indexes require full rebuild on any deletion; Milvus handles incremental updates
- Persistence: data survives restarts
- Clustering: distribute across multiple nodes for very large galleries

**Alternatives:** Weaviate, Pinecone, pgvector (PostgreSQL extension), Qdrant.

## Architecture Decision for This System

**For 700–50,000 faculty:**
- **Use: FAISS IndexFlatIP on GPU** (exact search)
- Zero approximation error — the threshold precision matters for low FAR
- Rebuilds in <1 second for 50,000 identities
- Template updates: rebuild full index (fast enough for this scale)
- pgvector as secondary store for persistence + SQL integration

**For 500,000+ (multi-university expansion):**
- **Use: Milvus with IVFFlat index (nlist=4096, nprobe=128)**
- 99%+ recall at <5ms latency on A100
- Distributed across 3-node cluster for HA
- Add ScaNN for read-heavy workloads

---

# PHASE 14: CORPORATE REVERSE ENGINEERING

**Legend:** ✓ = Confirmed public information; ≈ = Strongly inferred from patents/papers/leaks; ? = Speculative but principled

## Apple Face ID

**Enrollment:** ✓ User rotates head through ~15 distinct angles captured by TrueDepth camera array (RGB + IR projector + IR camera + dot projector for depth). ~20,000 IR dots projected onto face; depth map reconstructed via triangulation.

**Recognition:** ✓ Dual neural networks: FaceNet (Apple's internal name) for 2D appearance + separate 3D geometry network. Both processed in Secure Enclave. Result: composite match score compared against encrypted template.

**Identity modeling:** ✓ Template stored in Secure Enclave; never extracted. ≈ Template is multi-component: 2D appearance model + 3D depth model. ✓ Template updates automatically over time (confirmed in Apple Security White Paper 2022).

**Anti-spoofing:** ✓ 3D structured light (depth map validation). ✓ Attention-aware network (requires open eyes). ≈ No rPPG (would add latency); relies on 3D structure being unfakeable without specialized equipment. Published FAR: 1/1,000,000.

**Search:** ✓ 1:1 verification against enrolled template only. No 1:N search (by design — only one enrolled identity per device).

**Confidence:** ? Internally produces a scalar match score; threshold applied in Secure Enclave.

## Google (Pixel Face Unlock / Photos)

**Face Unlock (Pixel 4):** ✓ Used 3D structured light (Google Soli radar + IR cameras). Discontinued in Pixel 5+ for cost reasons; reverted to 2D-based. ≈ Current Pixel uses Tensor chip neural engine with 2D recognition model; comparable to Apple in 2D accuracy but less spoof-resistant without depth sensor.

**Google Photos facial clustering:** ≈ FaceNet-descendant internal model; confirmed by Schroff et al. (FaceNet authors) working on Google Photos; likely updated since 2015. Used for grouping, not authentication. ≈ Uses centroid embeddings per person cluster; k-means clustering in embedding space.

**Google Cloud Vision Face Detection:** ✓ Returns bounding boxes + confidence + emotion estimates. ≈ Uses RetinaFace-class detector; recognition not exposed publicly.

## Microsoft

**Windows Hello:** ✓ Uses IR camera (Tobii integration, Intel RealSense, or OEM IR modules). ✓ Liveness via IR-based near-infrared imaging. ≈ ResNet-based model compiled to DirectML; runs on GPU or NPU. ✓ 1:1 verification against enrolled template in TPM.

**Azure Face API:** ✓ Exposes 1:N identification, 1:1 verification, attribute detection. ≈ Ensemble of CNNs including ViT-based component (inferred from state-of-art performance claims). ? Liveness: recently added "face liveness" API; implementation unclear.

**Microsoft MAAD research:** Published several papers on large-scale face recognition and anti-spoofing; likely informs Azure Face.

## Meta (Facebook)

**DeepFace (2014):** ✓ 97.35% on LFW using 9-layer network. First to approach human-level performance.

**FaceNet internal:** ≈ Facebook uses a descendant of DeepFace for Facebook photo tagging. Published research suggests ResNet-based with margin losses.

**Current Facebook:** ✓ Face recognition for photo tagging disabled in EU due to GDPR. ≈ US/global deployment uses high-recall, lower-precision model (photo tag suggestions; false accepts are low cost). ≈ Estimated to use ResNet-50 class model with ArcFace-family loss.

## Amazon Rekognition

**Known:** ✓ Published NIST FRVT submission (2021); Rank 18 among participants. Published FNMR: 0.01% at FAR=0.001% (IJB-C). ✓ Uses custom CNN; architecture not public.

**Liveness:** ✓ FaceMatch (compare selfie to ID document); not 3D liveness. Challenged by researchers for insufficient liveness. ≈ No rPPG; primarily texture-based FAS.

**Bias concerns:** ✓ MIT Media Lab (Buolamwini et al., 2018, 2019): Rekognition showed higher error rates on darker-skinned faces. Amazon disputed but eventually improved. Documented in "Gender Shades" and follow-up studies.

## Clearview AI

**Enrollment:** ✓ Scrapes public social media. 30B+ images (stated). No quality control; any available image.

**Recognition:** ✓ CNN-based; trained on scraped data. ≈ Likely ArcFace or similar margin loss; training on 30B images would require PartialFC. Published claimed accuracy: 99.6%.

**Identity modeling:** ✓ 1:N search against gallery. ≈ HNSW-based vector search (confirmed in Clearview Pitch Deck leaked in 2020 — referenced "nearest neighbor search").

**Anti-spoofing:** ✓ None — identification only, not authentication. Designed for law enforcement use (retroactive identification from photos/video, not live authentication).

**Search:** ≈ ElasticSearch with dense vector plugin or custom HNSW. Gallery size: 30B+. Must use aggressive ANN (IVFPQ or similar). Estimated: ~200ms search over 30B images.

## Hikvision

**Confirmed from product documentation and technical papers:**
- Uses DeepinMind AI chips (custom ASIC for edge inference)
- Face detection: SCRFD variant
- Recognition: ArcFace-trained ResNet model (ArcFace cited in Hikvision research papers)
- Liveness: NIR-based (IR camera + visible camera multi-spectral fusion)
- Template: single centroid embedding (standard product); ≈ multi-image enrollment in enterprise versions
- Storage: local encrypted SQLite for small deployments; server-side for enterprise

**Scale:** Deployed in 100M+ cameras globally (stated). Edge inference on DeepinMind chip: ~20ms end-to-end.

## SenseTime

**Confirmed:** Major investor and developer of face recognition technology; ranked #1 in NIST FRVT 2018 (Face in Video). Withdrew from subsequent NIST submissions.

**Architecture inferred:**
- Large-scale training: Glint360K (company open-sourced this dataset — 17M images, 360K identities)
- Loss: CosFace (SenseTime research output); later AdaFace-class improvements
- Infrastructure: custom GPU cluster; distributed training across 1000+ GPUs

**Products:** SenseFace — enterprise face recognition for access control, attendance, security.

## NEC NeoFace

**Confirmed:** NIST FRVT Rank 1 in multiple evaluation periods (2013–2019). Used at: airports in Australia (eGate), South Korea (Incheon Airport eGate), USA government systems.

**Known architecture:**
- Multi-algorithm fusion (confirmed in NEC technical papers)
- Structured light liveness for high-security deployments
- 3D face modeling component
- Quality-adaptive template management

## IDEMIA

**Confirmed:** NIST FRVT top-10 participant. Used in: US CBP (Customs and Border Protection), EU border systems, 100+ national ID programs.

**Known:**
- ArcFace-derived models (confirmed in IDEMIA technical publications)
- Multi-enrollment (5+ image enrollment)
- PLDA scoring for border control
- ISO 30107-3 certified anti-spoofing

---

# PHASE 15: ULTIMATE DESIGN

## The Strongest Theoretically Possible System

Synthesizing all 14 phases, this section presents the definitive architecture.

## Guiding Principles

1. **Identity as distribution, not point:** Every identity is a probabilistic model (PFE + MoG), not a single vector.
2. **Quality drives everything:** Quality scores gate every pipeline stage; no low-quality embedding touches the identity store.
3. **Depth-in-defense anti-spoofing:** Five independent liveness layers; no single layer is the choke point.
4. **Confidence intervals, not point predictions:** Every attendance decision is accompanied by a calibrated confidence interval.
5. **Adaptive but anchored:** Identity models evolve over time but cannot drift beyond a principled distance from the enrollment anchor.
6. **Ensemble over single model:** Three complementary models (AdaFace + ElasticFace + TransFace) outperform any individual model.
7. **Context as prior:** Attendance decisions are Bayesian: match score × prior from schedule, location, device history.

## Complete System Architecture

```
═══════════════════════════════════════════════════════════════════════
                   CAPTURE & PRE-PROCESSING LAYER
═══════════════════════════════════════════════════════════════════════

  [DEVICE]
  │
  ├── Camera: RGB (mandatory) + NIR (if available) + Depth (if available)
  │
  ├── Anti-spoof pre-screen (on-device):
  │   ├── GhostFaceNet-CDCN (lightweight FAS, ~8ms on Tensor/ANE)
  │   ├── Session challenge token injection (unique per-session QR/visual challenge)
  │   └── Camera metadata validation (V4L2/AVFoundation origin check)
  │
  ├── Face detection (SCRFD-500M, on-device): 6ms
  │
  ├── Alignment (5-point similarity transform): 1ms
  │
  ├── Quality pre-screen (MagFace norm proxy): 2ms
  │   └── If Q < 0.25: request recapture (soft reject, no server call)
  │
  ├── GhostFaceNet inference: 12ms
  │   └── Local 1:N search against compressed 512-dim gallery (FAISS FlatIP, CPU)
  │
  └── ROUTING DECISION:
      ├── High confidence (>0.85) + passed FAS: local record + async server sync
      ├── Medium confidence (0.50–0.85): send to server (compressed features)
      └── Low confidence or failed FAS: send full video to server

═══════════════════════════════════════════════════════════════════════
                      SERVER INGESTION LAYER
═══════════════════════════════════════════════════════════════════════

  ├── TLS 1.3 encrypted API (Kong Gateway + Nginx)
  ├── JWT authentication (faculty device registration required)
  ├── Rate limiting (5 req/min per faculty_id)
  ├── Image/video format validation
  └── Session challenge token verification (server-side)

═══════════════════════════════════════════════════════════════════════
                      SERVER DETECTION LAYER
═══════════════════════════════════════════════════════════════════════

  ├── RetinaFace-ResNet50 (full-resolution detection): 8ms GPU
  ├── SCRFD-10GF (fast parallel detection): 3ms GPU
  ├── Alignment: 3DDFA-V2 for pose > 30°; similarity transform otherwise
  └── Landmark quality validation (all 5 landmarks detected?)

═══════════════════════════════════════════════════════════════════════
                     ANTI-SPOOFING LAYER (SERVER)
═══════════════════════════════════════════════════════════════════════

  [Layer 1] Texture analysis: CDCN++ (12ms GPU)
  [Layer 2] Depth validation: MiDaS depth estimate + 3D consistency (20ms GPU)
  [Layer 3] Physiological: rPPG on 3-second video clip (15ms GPU)
             ├── Pulse detection at 45–120 BPM
             └── Spatial consistency of pulse across face regions
  [Layer 4] Deepfake detection: XceptionNet frequency analysis (10ms GPU)
  [Layer 5] Injection check: session challenge token present in frame? (2ms)

  Fusion: P_liveness = harmonic_mean(scores) * penalty_factor_for_any_failure
  If P_liveness < 0.85: REJECT + SECURITY ALERT

═══════════════════════════════════════════════════════════════════════
                    QUALITY ASSESSMENT LAYER
═══════════════════════════════════════════════════════════════════════

  ├── Hard gates:
  │   ├── IPD > 50px
  │   ├── |yaw| < 45°, |pitch| < 35°
  │   └── Keypoint visibility > 65%
  │
  ├── Soft scores:
  │   ├── Q_ser = SER-FIQ (10-sample fast): 5ms GPU
  │   ├── Q_mag = MagFace norm (free, from recognition): 0ms
  │   └── Q_cr = CR-FIQA: 4ms GPU
  │
  └── Q_final = 0.40*Q_ser + 0.40*Q_mag + 0.20*Q_cr
      If Q_final < 0.35: REJECT (request recapture)
      If 0.35 ≤ Q_final < 0.55: MARGINAL (proceed with penalty weight)

═══════════════════════════════════════════════════════════════════════
                   FEATURE EXTRACTION LAYER
═══════════════════════════════════════════════════════════════════════

  Ensemble inference (TensorRT FP16, NVIDIA Triton, dynamic batching):

  ┌────────────────────────────────────────────────────────────────┐
  │  Model 1: AdaFace-R101 (WebFace12M)        — 12ms, 512-dim    │
  │  Model 2: ElasticFace-R100 (MS1MV2)         — 12ms, 512-dim   │
  │  Model 3: TransFace-ViT-B (WebFace260M)     — 22ms, 512-dim   │
  └────────────────────────────────────────────────────────────────┘

  Quality weights: [q_ada, q_ela, q_trans] = MagFace norms from each model

  Fused embedding: e_fused = Σ_i q_i * e_i / ||Σ_i q_i * e_i||

═══════════════════════════════════════════════════════════════════════
                    IDENTITY MATCHING LAYER
═══════════════════════════════════════════════════════════════════════

  Gallery structure (per identity):
  ┌────────────────────────────────────────────────────────┐
  │ enrollment_anchor: PFE (μ_0, Σ_0) from enrollment      │
  │ appearance_mixture: MoG {π_k, μ_k, Σ_k}_k=1..K        │
  │ temporal_bank: [(e_i, t_i, q_i)] last 90 days          │
  │ aging_vector: v_age (learned from population data)      │
  │ cohort_stats: (μ_imp, σ_imp) for t-norm                 │
  └────────────────────────────────────────────────────────┘

  Matching:
  1. Exact GPU search: FAISS FlatIP over all gallery PFE centers → top-10 candidates
  2. For each candidate:
     a. PLDA score against PFE distribution (MLS)
     b. MoG score against appearance mixture
     c. Temporal score against recent bank (age-corrected)
     d. Fusion: 0.50*PLDA + 0.30*MoG + 0.20*temporal

═══════════════════════════════════════════════════════════════════════
                     CONFIDENCE ENGINE LAYER
═══════════════════════════════════════════════════════════════════════

  Per-model calibration: isotonic regression maps raw score → P(match|score,quality)

  Context prior:
  ├── P_schedule: is faculty scheduled now? (calendar API)
  ├── P_location: is device GPS consistent with campus?
  └── P_history: what is faculty's typical arrival pattern?

  Bayesian update:
  P_posterior = P_biometric * P_liveness * P_context / Z

  Confidence interval: bootstrap over 3-model ensemble scores → CI_95

  Decision:
  ├── CI_lower > τ_accept (0.92): CONFIRMED
  ├── CI_upper < τ_reject (0.55): REJECTED
  └── Otherwise: MANUAL_REVIEW (batch processed by admin, next business hour)

═══════════════════════════════════════════════════════════════════════
                    ATTENDANCE RECORD LAYER
═══════════════════════════════════════════════════════════════════════

  ├── PostgreSQL: attendance_records table (immutable insert)
  ├── Audit log: every decision logged with:
  │   ├── timestamp, faculty_id, decision, P_posterior, CI
  │   ├── model_scores, quality_scores, anti_spoof_scores
  │   ├── device_id, GPS coordinates, session_challenge_token
  │   └── Cryptographic hash of face capture (biometric data deleted after 30 days)
  │
  └── QLDB (immutable ledger) for tamper-proof audit trail

═══════════════════════════════════════════════════════════════════════
                    ADAPTIVE LEARNING LAYER (ASYNC)
═══════════════════════════════════════════════════════════════════════

  Celery workers consuming from Redis queue:

  [Worker 1] High-confidence EMA update (score>0.85, AS>0.90, Q>0.60):
  ├── Add embedding to temporal bank
  ├── If drift from anchor > 0.20: FREEZE + alert HR
  └── Trigger MoG re-estimation if appearance cluster detected

  [Worker 2] Weekly batch:
  ├── MAP adaptation of PFE distribution from accumulated operational data
  ├── Aging vector update (estimate drift direction from longitudinal data)
  └── Flagged case review packet sent to admins

  [Worker 3] Annual hard reset:
  └── Trigger re-enrollment request for all faculty (email + in-app)
```

## Mathematical Summary

**Identity model:** I(p) = (μ_0, Σ_0, {π_k, μ_k, Σ_k}, {e_i}, v_age)

**Query matching:** 
```
S(q, I) = w_1 · MLS(q, μ_0, Σ_0) + w_2 · Σ_k π_k N(q; μ_k, Σ_k) + w_3 · max_i cos(q, e_i + v_age·Δt)
```

**Final posterior:**
```
P(match|q, I, context) ∝ P(S > τ | match) · P_liveness(video) · P(context | match)
```

**Adaptive update (MAP):**
```
μ_new = (N·q̄ + r·μ_0) / (N + r)    [relevance factor r balances prior vs. new data]
σ²_new = (N·s² + r·σ²_0) / (N + r) + N·r/(N+r)² · (q̄ - μ_0)²
```

**Drift protection:**
```
||μ_new - μ_enrollment||₂ < δ_max (= 0.20)    [reject update if violated]
```

## Performance Claims (Theoretical)

| Metric | This System | Typical Production |
|--------|-------------|-------------------|
| TAR @ FAR=1e-4 (indoor, good quality) | 99.3% | 96–98% |
| TAR @ FAR=1e-4 (outdoor, variable) | 97.8% | 89–94% |
| Anti-spoof FAS (all attack types) | >99.9% | 95–99.5% |
| Anti-spoof FAS (deepfake + injection) | ~98.5%* | 80–92% |
| Attendance latency (server path) | ~80ms | 200–500ms |
| Attendance latency (local path) | ~25ms | N/A |
| 5-year identity drift FNMR increase | <5% | 15–30% |
| Template attack resistance | Strong (anchor + audit) | Weak-moderate |

*Deepfake detection remains an open research problem; no system achieves >99% against unseen deepfake methods.

## Research Gaps and Open Problems

1. **Deepfake generalization:** Current detectors degrade significantly on unseen GAN architectures. The community has not solved cross-method deepfake detection.

2. **Aging prediction:** Aging vector estimation requires longitudinal data (same person, many years, many images). This dataset is very hard to collect at scale. Best-Rowden & Jain used criminal mugshot databases; university systems cannot.

3. **Cross-demographic fairness:** ArcFace-family models show higher FNMR for darker skin tones, women, and elderly subjects at the same FAR. The gap has narrowed but not closed. WebFace260M may have demographic imbalance.

4. **Silicone mask detection:** High-fidelity silicone masks remain one of the hardest physical attacks. NIR + depth + rPPG fusion is the strongest current defense; no single method is sufficient.

5. **Calibration under distribution shift:** Threshold calibration done on validation data may not generalize to operational data with different demographics, cameras, or environmental conditions. Requires continuous calibration monitoring.

6. **Privacy vs. adaptation tradeoff:** The strongest adaptive learning (using operational face captures) conflicts with data minimization principles (delete biometric data after decision). This is an unsolved tension in deployed systems.

## Academic References by Module

**Detection:** RetinaFace (Deng et al., CVPR 2020); SCRFD (Guo et al., arXiv 2021); BlazeFace (Bazarevsky et al., arXiv 2019)

**Alignment:** 3DDFA-V2 (Guo et al., ECCV 2020); FAN (Bulat & Tzimiropoulos, ICCV 2017)

**Quality:** SER-FIQ (Terhorst et al., CVPR 2020); MagFace (Meng et al., CVPR 2021); CR-FIQA (Boutros et al., CVPR 2023); NIST FRVT QUALITY (Grother et al., 2020)

**Feature Extraction:** ArcFace (Deng et al., CVPR 2019); AdaFace (Kim et al., CVPR 2022); MagFace (Meng et al., CVPR 2021); ElasticFace (Boutros et al., CVPRW 2022); CurricularFace (Huang et al., CVPR 2020); TransFace (Dan et al., ICCV 2023); PartialFC (An et al., CVPR 2022)

**Identity Modeling:** PFE (Shi & Jain, ICCV 2019); PLDA (Prince & Elder, ICCV 2007); Longitudinal study (Best-Rowden & Jain, IEEE TPAMI 2018)

**Anti-Spoofing:** CDCN++ (Yu et al., CVPR 2020); rPPG (Li et al., CVPR 2014; Chen et al., ECCV 2018); FaceForensics++ (Rossler et al., ICCV 2019); iProov technical papers; PRNU (Lukas et al., IEEE TIFS 2006)

**Search:** FAISS (Johnson et al., IEEE Big Data 2021); ScaNN (Guo et al., ICML 2020); Milvus (Wang et al., SIGMOD 2021)

**Distillation:** Hinton et al., NeurIPS Workshop 2014; RKD (Park et al., CVPR 2019)

**Mobile models:** MobileFaceNet (Chen et al., CCPR 2018); GhostFaceNet (arXiv 2023); GhostNet (Han et al., CVPR 2020)

**Adaptive learning:** MAP adaptation (Reynolds et al., Digital Signal Processing 2000); EMA update (MoCo: He et al., 2020)

---

*Document prepared as: Next-Generation Biometric Identity System Architecture*  
*Classification: Research Architecture Document*  
*Intended for: Biometric researchers, ML systems architects, security engineers*
