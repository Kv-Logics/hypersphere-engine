# Hypersphere Biometric Engine - Current Flow Architecture

This document outlines the current end-to-end flow of the Hypersphere Biometric Engine following the security hardening and quality-assurance refactoring.

---

## 1. System Initialization & Calibration

When the FastAPI backend starts up, it calibrates the system quality baseline:

```mermaid
graph TD
    Start[Lifespan Startup] --> InitDB[Initialize DB & HNSW Indices]
    InitDB --> QueryNorms[Query raw_norm from face_embeddings]
    QueryNorms --> CheckCount{embeddings >= 10?}
    CheckCount -- Yes --> ComputeStats[Compute mean and standard deviation of norms]
    ComputeStats --> CalibrateThresh[Set EMBEDDING_QUALITY_THRESHOLD = mean - 2 * std]
    CalibrateThresh --> Clamp[Clamp threshold between 5.0 and 15.0]
    Clamp --> Done[System Ready]
    CheckCount -- No --> DefaultThresh[Use default EMBEDDING_QUALITY_THRESHOLD = 12.0]
    DefaultThresh --> Done
```

> [!NOTE]
> Clamping the calibrated threshold between 5.0 and 15.0 prevents mathematical outliers from compromising overall biometric security.

---

## 2. Enrollment / Self-Registration Flow

Enrollment enforces **high-strictness quality gates** to ensure optimal database template vectors.

```mermaid
sequenceDiagram
    autonumber
    actor User as User/Admin
    participant FE as Frontend Dashboard
    participant API as Backend API (/register)
    participant Pipe as Face Pipeline
    participant DB as PostgreSQL (pgvector)

    User->>FE: Click Register & Capture Face
    FE->>API: Send base64 image + user_id
    API->>Pipe: process_image(contents, is_enrollment=True)
    
    rect rgb(240, 248, 255)
        Note over Pipe: Quality Gating
        Pipe->>Pipe: Check Blur (Normalized Laplacian >= baseline)
        Pipe->>Pipe: Check Illumination (Gray mean: 40-200, Hist std >= 20)
        Pipe->>Pipe: Check Contrast (Michelson >= 0.2)
        Pipe->>Pipe: Check Pose (SolvePnP yaw/pitch/roll <= 15°)
        Pipe->>Pipe: Check Embedding Norm (norm >= quality_threshold)
    end

    alt Quality Gate Fails
        Pipe-->>API: Return quality feedback details
        API-->>FE: HTTP 422 (Gating details)
        FE-->>User: Display guidance (e.g., "Too dark", "Turn head straight")
    else Quality Gate Passes
        Pipe-->>API: Return aligned embedding & norm
        API->>DB: Check duplicates (Similarity >= 0.70)
        alt Duplicate Detected
            DB-->>API: Match found
            API-->>FE: HTTP 409 (Conflict - Duplicate Face)
            FE-->>User: Show alert: "This face is already registered"
        else Unique Face
            API->>DB: Save vector (drift_review_pending=False, raw_norm=norm)
            API->>DB: Update faculty status to 'registered'
            DB-->>API: Success
            API-->>FE: HTTP 200 (Success)
            FE-->>User: Show Confirmation
        end
    end
```

---

## 3. Verification & Multi-Frame Averaging Flow

Verification happens in daily attendance marking and testing. It features **multi-frame sampling** and **quality-adaptive matching thresholds**.

```mermaid
sequenceDiagram
    autonumber
    actor User as Faculty Member
    participant FE as Frontend (/verify UI)
    participant API as Backend API (/verify)
    participant Pipe as Face Pipeline
    participant DB as PostgreSQL (pgvector)

    User->>FE: Trigger Attendance Scan
    FE->>FE: Capture 5 frames over 1 second (200ms spacing)
    FE->>API: Send multipart form with 5 files
    API->>Pipe: Extract features & quality scores for each frame
    Note over API: Multi-Frame Decision Logic
    API->>API: 1. Drop frame with lowest quality score
    API->>API: 2. Calculate mean vector of remaining frames & normalize
    API->>API: 3. Calculate average liveness score (Anti-Spoof)
    API->>API: 4. Calculate average quality score
    
    alt Liveness Score < 0.40 (Spoof Detected)
        API->>DB: Log REJECTED record
        API-->>FE: Return Spoof Warning
    else Liveness Score >= 0.40 (Real Face)
        API->>DB: Search HNSW index (Top-k similarity)
        Note over API: Adaptive Threshold: MATCH_THRESHOLD + (1 - Quality) * 0.15
        alt Top Similarity < Adaptive Threshold
            API->>DB: Log REJECTED record
            API-->>FE: Return No Match Found
        else Top Similarity >= Adaptive Threshold
            alt Ambiguity Gap < 0.03 OR Liveness < 0.55 (Borderline)
                API->>DB: Log MANUAL_REVIEW record
                API-->>FE: Return MANUAL_REVIEW (Log check-in pending audit)
            else High Confidence Match (Similarity >= 0.62)
                API->>DB: Log CONFIRMED record
                API-->>FE: Return CONFIRMED
            else Borderline Drift Match (Adaptive Threshold <= Similarity < 0.62)
                API->>DB: Log CONFIRMED record
                API->>DB: Add drifted vector to face_embeddings (drift_review_pending=True)
                API-->>FE: Return CONFIRMED
            end
        end
    end
```

---

## 4. Biometric Drift Review Flow

Embedding drift is self-corrected over time via administrator supervision:

```mermaid
graph TD
    Trigger[Borderline Match: Threshold <= Similarity < 0.62] --> SavePending[Save drift candidate to DB: drift_review_pending = True]
    SavePending --> AdminPanel[Admin navigates to Drift Reviews tab]
    AdminPanel --> LoadDrifts[Fetch /api/v1/admin/drift-requests]
    
    AdminPanel -- Approve --> ApproveAPI[Post /api/v1/admin/drift-requests/{id}/approve]
    ApproveAPI --> ApproveAction[Set drift_review_pending = False, adding it to the user's active vectors]
    
    AdminPanel -- Reject --> RejectAPI[Post /api/v1/admin/drift-requests/{id}/reject]
    RejectAPI --> RejectAction[Delete drift request record from face_embeddings]
```

> [!TIP]
> The database retains a maximum of **15 embeddings** per user. If an approved drift causes the number of embeddings to exceed 15, the oldest verified embedding is automatically retired.
