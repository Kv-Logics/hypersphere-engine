# System Workflow Plan: Face Registration & Verification

This document specifies the step-by-step operational workflows for enrolling new identities and verifying attendance transactions.

---

## 1. Verification (Attendance Check-in) Workflow

This workflow represents the low-latency path executed when a user attempts to verify their identity at a kiosk.

```mermaid
sequenceDiagram
    autonumber
    actor User as Faculty Member
    participant UI as Kiosk Frontend
    participant API as FastAPI Backend
    participant Pipe as ML Pipeline (pipeline.py)
    participant DB as Relational Database
    participant Index as Vector Search (FAISS/pgvector)

    User->>UI: Triggers capture (Verify Button)
    UI->>UI: Captures webcam frame to JPEG blob
    UI->>API: POST /api/v1/verify (file + device_id)
    API->>Pipe: process_image(contents)
    
    Note over Pipe: Step 1: Detect face & extract keypoints (MediaPipe)
    Note over Pipe: Step 2: Crop & Align face (OpenCV Similarity Transform)
    
    alt Quality Gates Fail
        Pipe-->>API: Returns low-quality quality_score & Quality Advice list
        API-->>UI: 422 Unprocessable Entity (with advice)
        UI->>User: Displays alert: "Image too blurry" / "Turn to face camera"
    else Quality Gates Pass
        Note over Pipe: Step 3: Run Liveness check (MiniFASNetV2)
        Note over Pipe: Step 4: Extract 512-D Embedding (ArcFace ONNX)
        Pipe-->>API: Returns (embedding, liveness_score, quality_score, empty_feedback)
        
        alt Liveness Check Fails (liveness_score < 0.40)
            API->>DB: Log Transaction (status="REJECTED", reason="SPOOF")
            API-->>UI: Returns status="REJECTED", liveness_score
            UI->>User: Displays red access-denied indicator
        else Liveness Check Passes
            API->>Index: search(embedding, top_k=1)
            Index-->>API: Returns (matched_id, similarity_score)
            
            alt Match threshold not met (similarity_score < 0.45)
                API->>DB: Log Transaction (status="REJECTED", reason="UNKNOWN")
                API-->>UI: Returns status="REJECTED", match_found=false
                UI->>User: Displays "No matched candidate" (Access Denied)
            else Match threshold met (similarity_score >= 0.45)
                API->>DB: Log Transaction (status="CONFIRMED", faculty_id=matched_id)
                API-->>UI: Returns status="CONFIRMED", candidate_details
                UI->>User: Displays "CONFIRMED ACCESS" + Name (Access Granted)
            end
        end
    end
```

---

## 2. Registration (Enrollment) Workflow

This workflow represents the gateway path for adding a new faculty member's identity representation to the system.

```mermaid
flowchart TD
    Start([Start Registration]) --> GetInput[Admin enters Faculty ID & Name]
    GetInput --> Capture[Snaps webcam photo]
    Capture --> Submit[POST /api/v1/register]
    
    subgraph Quality Guard
        Submit --> Detect{Face Detected?}
        Detect -- No --> ErrNoFace[Raise 422: No face detected]
        Detect -- Yes --> Align[Perform Affine Alignment]
        Align --> QualityCheck{Quality >= 0.35 & Pose asymmetry < 0.30?}
        QualityCheck -- No --> ErrLowQuality[Raise 422: Quality too low + Advice]
    end
    
    subgraph Persistence
        QualityCheck -- Yes --> SaveSQL[Insert record into SQL 'faculty' table]
        SaveSQL --> Extract[Extract 512-D embedding via ArcFace]
        Extract --> IndexUpdate[Add vector to FAISS / pgvector index]
    end

    ErrNoFace --> ShowError[Show error message to user]
    ErrLowQuality --> ShowError
    IndexUpdate --> Success([Success: Faculty Enrolled])
```
