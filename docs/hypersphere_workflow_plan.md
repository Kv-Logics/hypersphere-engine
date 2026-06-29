# Hypersphere Engine — Complete Workflow Plan

> Faculty Biometric Attendance System for NIT Tiruchirappalli

---

## 1. System Overview

```mermaid
graph TB
    subgraph "Data Source"
        CSV["Data_Of_Users/<br/>Faculty.csv, Deans.csv,<br/>Hods.csv, Director.csv"]
    end

    subgraph "Backend (FastAPI + PostgreSQL)"
        API["REST API"]
        DB["PostgreSQL<br/>+ pgvector"]
        PIPE["Face Pipeline<br/>ArcFace + MiniFASNet"]
        CSV_LOADER["CSV User Loader<br/>(startup seed)"]
    end

    subgraph "Frontend Dashboards"
        USER_DASH["User Dashboard<br/>(Faculty Login)"]
        ADMIN_DASH["Admin Dashboard<br/>(CDI Admin)"]
    end

    CSV --> CSV_LOADER --> DB
    USER_DASH --> API
    ADMIN_DASH --> API
    API --> DB
    API --> PIPE
```

### Core Idea

| Concept | Description |
|---------|-------------|
| **Identity Source** | `Data_Of_Users/*.csv` — ~730 NITT employees with `emp_email`, `emp_name`, `emp_id` |
| **Username = Email prefix** | `jpeter@nitt.edu` → username is **`jpeter`** — this is the login/registration ID |
| **Two Dashboards** | **User** (faculty member) and **Admin** (CDI staff) |
| **Face = Attendance** | Users scan their face on their dashboard to mark attendance; no buttons, just scan |

---

## 2. Data Model (Existing → Extended)

### 2.1 Current `faculty` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `VARCHAR(50)` PK | Username (email prefix, e.g. `jpeter`) |
| `name` | `VARCHAR(100)` | Full name |
| `embedding` | `Vector(512)` | ArcFace embedding |
| `created_at` | `DATETIME` | Registration timestamp |
| `is_active` | `BOOLEAN` | Active flag |

### 2.2 Proposed Schema Changes

```mermaid
erDiagram
    users {
        varchar_50 id PK "Email prefix (username)"
        varchar_100 name "Full name from CSV"
        varchar_100 email "Full email (e.g. jpeter@nitt.edu)"
        varchar_20 role "user | admin"
        varchar_20 emp_id "Original employee ID from CSV"
        varchar_50 department "Department (from Hods/Deans CSV)"
        varchar_20 designation "faculty | hod | dean | director | registrar"
        vector_512 embedding "ArcFace 512-d vector (nullable)"
        varchar_20 face_status "none | registered | pending_review | approved"
        boolean is_active "Account active"
        datetime created_at "Auto timestamp"
        datetime updated_at "Last modified"
    }

    face_requests {
        int id PK "Auto-increment"
        varchar_50 user_id FK "→ users.id"
        varchar_20 request_type "register | update | issue_report"
        text message "User's message to admin"
        varchar_20 status "pending | approved | rejected"
        bytea uploaded_image "The image blob"
        text admin_notes "Admin's response"
        datetime created_at "Submitted at"
        datetime resolved_at "Resolved at"
    }

    attendance_records {
        int id PK "Auto-increment"
        varchar_50 user_id FK "→ users.id"
        datetime timestamp "Scan time"
        varchar_20 status "CONFIRMED | REJECTED"
        float similarity_score ""
        float liveness_score ""
        float quality_score ""
        varchar_100 device_id ""
        datetime created_at "Auto timestamp"
    }

    users ||--o{ face_requests : "submits"
    users ||--o{ attendance_records : "records"
```

> [!IMPORTANT]
> The `face_status` field on `users` drives the entire UI flow:
> - `none` → User has no face registered → Show "Register Face" prompt
> - `registered` → Admin uploaded image OR user self-registered → Face is active
> - `pending_review` → User uploaded a new image → Awaiting admin approval
> - `approved` → Admin approved user's uploaded image → Face is active

---

## 3. CSV Seeding Logic

On backend startup (or via admin command), the system loads all CSV files and upserts users:

```
Data_Of_Users/
├── Faculty.csv           → 702 users, designation="faculty"
├── Hods.csv              → 20 users,  designation="hod"
├── Deans.csv             → 6 users,   designation="dean"
└── Director and Registrar.csv → 2 users, designation="director"/"registrar"
```

### Mapping Rules

| CSV Column | DB Column | Transform |
|------------|-----------|-----------|
| `emp_email` / `Email` | `id` | Extract prefix before `@` (e.g. `jpeter@nitt.edu` → `jpeter`) |
| `emp_email` / `Email` | `email` | Store full email |
| `emp_name` / `Name` | `name` | Direct map |
| `emp_id` | `emp_id` | Direct map (Faculty.csv only) |
| — | `role` | Default `"user"` (admins set manually) |
| — | `face_status` | Default `"none"` |
| — | `embedding` | `NULL` (no face yet) |

> [!NOTE]
> If a username already exists in DB, **do not overwrite** — only insert new records. This prevents destroying existing embeddings on restart.

---

## 4. Authentication Flow (Simplified)

Since this is an internal NITT system, authentication is kept lightweight:

```mermaid
sequenceDiagram
    actor User as Faculty Member
    participant UI as Login Page
    participant API as Backend API
    participant DB as PostgreSQL

    User->>UI: Enter username (email prefix, e.g. "jpeter")
    UI->>API: GET /api/v1/auth/lookup?username=jpeter
    API->>DB: SELECT * FROM users WHERE id = 'jpeter'
    
    alt User found in DB
        DB-->>API: { id: "jpeter", name: "A. John Peter", ... }
        API-->>UI: 200 OK — { user object }
        UI->>UI: Auto-fill name, redirect to dashboard
    else User not found
        API-->>UI: 404 — "Username not found"
        UI->>UI: Show form asking for Full Name & Email
        User->>UI: Enter name + email manually
        UI->>API: POST /api/v1/auth/register-manual
        API->>DB: INSERT new user
        API-->>UI: 201 Created — redirect to dashboard
    end
```

> [!TIP]
> No passwords needed for the PoC phase. The username alone acts as the session identifier. For production, integrate NITT's institutional SSO/LDAP.

---

## 5. User Dashboard Flow

### 5.1 Dashboard States

The user dashboard adapts based on `face_status`:

```mermaid
stateDiagram-v2
    [*] --> NoFace: face_status = "none"
    [*] --> ActiveFace: face_status = "registered" or "approved"
    [*] --> PendingReview: face_status = "pending_review"

    NoFace --> RegisterFace: User clicks "Register My Face"
    RegisterFace --> ActiveFace: Live capture → embedding saved

    ActiveFace --> ScanAttendance: Default state — scan to mark attendance
    ActiveFace --> RequestUpdate: User wants to change photo
    
    RequestUpdate --> PendingReview: Upload new photo → awaiting admin
    
    PendingReview --> ActiveFace: Admin approves
    PendingReview --> NoFace: Admin rejects

    ActiveFace --> ReportIssue: User wants to report a problem
```

### 5.2 User Dashboard — Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  HYPERSPHERE · Welcome, Dr. A. John Peter (jpeter)  [⚙] │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│   [Profile Card]     │   [Live Camera Feed]             │
│   ┌──────────────┐   │   ┌──────────────────────────┐   │
│   │  Avatar/      │   │   │                          │   │
│   │  Initials     │   │   │   Webcam with Face Mesh  │   │
│   │               │   │   │   landmarks + bbox       │   │
│   │  Name         │   │   │                          │   │
│   │  Department   │   │   │                          │   │
│   │  Email        │   │   └──────────────────────────┘   │
│   └──────────────┘   │                                  │
│                      │   IF face_status == "none":       │
│   [Status Card]      │     → "Register My Face" button   │
│   ┌──────────────┐   │     → Live capture + save         │
│   │  Face Status: │   │                                  │
│   │  ● Registered │   │   IF face_status == "registered":│
│   │               │   │     → Auto-scan on page load     │
│   │  Last Scan:   │   │     → Green "PRESENT" flash      │
│   │  Today 9:03am │   │     → Attendance logged          │
│   └──────────────┘   │                                  │
│                      │   IF face_status == "pending":    │
│   [Actions Card]     │     → "Awaiting Admin Review"     │
│   ┌──────────────┐   │     → Camera disabled             │
│   │ 📷 Update     │   │                                  │
│   │    Photo      │   │   [Attendance History Table]      │
│   │ ⚠️ Report     │   │   ┌──────────────────────────┐   │
│   │    Issue      │   │   │  Date   Time   Status    │   │
│   └──────────────┘   │   │  Jun 27  9:03   ✅        │   │
│                      │   │  Jun 26  9:15   ✅        │   │
│                      │   │  Jun 25  —      ❌        │   │
│                      │   └──────────────────────────┘   │
└──────────────────────┴──────────────────────────────────┘
```

### 5.3 Core User Actions

| Action | Trigger | What Happens |
|--------|---------|--------------|
| **Register Face** | Click button (only if `face_status=none`) | Opens webcam → Live capture → Sends to `/api/v1/register` → Saves embedding → `face_status='registered'` |
| **Mark Attendance** | Auto on page load (if `face_status=registered/approved`) | Webcam opens → Face mesh tracking → Auto-captures best frame → Sends to `/api/v1/verify` → Logs attendance |
| **Update Photo** | Click "Update Photo" button | Opens form with message field + file upload → Sends to `/api/v1/face-requests` → `face_status='pending_review'` |
| **Report Issue** | Click "Report Issue" button | Opens text form → Sends message to `/api/v1/face-requests` with `type=issue_report` |

---

## 6. Admin Dashboard Flow

### 6.1 Admin Dashboard — Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HYPERSPHERE ADMIN · CDI Control Panel                      [⚙] │
├───────┬─────────────────────────────────────────────────────────┤
│       │                                                         │
│ NAV   │   [Tab: User Management]                                │
│       │   ┌─────────────────────────────────────────────────┐   │
│ 👤    │   │  Search: [_______________]  Filter: [All ▼]     │   │
│ Users │   │                                                 │   │
│       │   │  ┌────────┬──────────┬────────┬───────┬──────┐  │   │
│ 📋    │   │  │ User   │ Name     │ Status │ Dept  │ Act. │  │   │
│ Requests│  │  │ jpeter │ A. John  │ ●None  │ Mech  │ [+]  │  │   │
│       │   │  │ csara  │ C. Sara  │ ✅Reg  │ ECE   │ [👁] │  │   │
│ 📊    │   │  │ pjega  │ P. Jega  │ ⏳Pend │ CSE   │ [✓✗]│  │   │
│ Attend│   │  └────────┴──────────┴────────┴───────┴──────┘  │   │
│       │   └─────────────────────────────────────────────────┘   │
│ ⚙️    │                                                         │
│ Config│   [Tab: Pending Requests]                               │
│       │   ┌─────────────────────────────────────────────────┐   │
│       │   │  jpeter requested photo update (2 hours ago)    │   │
│       │   │  ┌──────────────────────────────────────────┐   │   │
│       │   │  │  [Current Photo]  →  [Uploaded Photo]    │   │   │
│       │   │  │                                          │   │   │
│       │   │  │  Message: "Lighting was bad in my old    │   │   │
│       │   │  │  photo, uploading a better one"          │   │   │
│       │   │  │                                          │   │   │
│       │   │  │  [✅ APPROVE & REPLACE]  [❌ REJECT]     │   │   │
│       │   │  └──────────────────────────────────────────┘   │   │
│       │   └─────────────────────────────────────────────────┘   │
│       │                                                         │
│       │   [Tab: Attendance Reports]                             │
│       │   ┌─────────────────────────────────────────────────┐   │
│       │   │  Date: [Jun 27, 2026 ▼]                         │   │
│       │   │  Present: 487/702  │  Absent: 215/702           │   │
│       │   │  ┌──────┬────────┬───────┬──────────────────┐   │   │
│       │   │  │ User │ Name   │ Time  │ Status           │   │   │
│       │   │  │ ...  │ ...    │ ...   │ ...              │   │   │
│       │   │  └──────┴────────┴───────┴──────────────────┘   │   │
│       │   └─────────────────────────────────────────────────┘   │
└───────┴─────────────────────────────────────────────────────────┘
```

### 6.2 Core Admin Actions

| Action | Description |
|--------|-------------|
| **View All Users** | Paginated table of all 730+ users with face status, search, and filters |
| **Upload Face for User** | Admin selects a user → uploads their photo → runs face pipeline → saves embedding → sets `face_status='registered'` |
| **Review Pending Requests** | See user-submitted photo updates → Compare old vs new → Approve (replaces embedding) or Reject |
| **View Issue Reports** | Read user complaints about recognition failures → respond with notes |
| **Attendance Reports** | Date-based attendance view with present/absent counts and export |
| **Manage Admins** | Promote/demote users to admin role |

---

## 7. Complete API Endpoints Plan

### 7.1 Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/lookup?username={id}` | Look up user by username, auto-fetch name from DB/CSV |
| `POST` | `/api/v1/auth/register-manual` | Register a user not found in CSV (requires name + email) |

### 7.2 User Endpoints (Existing + New)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users` | List all users (admin only) |
| `GET` | `/api/v1/users/{id}` | Get user profile |
| `PUT` | `/api/v1/users/{id}` | Update user profile |
| `DELETE` | `/api/v1/users/{id}` | Delete user (admin only) |

### 7.3 Face Registration & Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/register` | Register face via live capture (user self-register) |
| `POST` | `/api/v1/register-admin` | Admin uploads a photo for a specific user |
| `POST` | `/api/v1/verify` | Scan face → match → log attendance |

### 7.4 Face Request Endpoints (New)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/face-requests` | User submits a photo update or issue report |
| `GET` | `/api/v1/face-requests` | List all requests (admin) or user's own requests |
| `GET` | `/api/v1/face-requests/{id}` | Get single request details + image |
| `PUT` | `/api/v1/face-requests/{id}/approve` | Admin approves → replaces old embedding |
| `PUT` | `/api/v1/face-requests/{id}/reject` | Admin rejects → keeps old embedding |

### 7.5 Attendance Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/attendance?user_id={id}` | Get attendance history for a user |
| `GET` | `/api/v1/attendance/report?date={date}` | Admin: daily attendance summary |

### 7.6 CSV Data Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/admin/seed-csv` | Trigger CSV import (admin only) |

---

## 8. Frontend Pages

| Page | Route | Audience | Description |
|------|-------|----------|-------------|
| Login | `/login.html` | All | Enter username → auto-lookup → redirect |
| User Dashboard | `/dashboard.html` | Faculty | Face scan, attendance, profile, requests |
| Admin Dashboard | `/admin.html` | Admin | User management, request review, reports |
| Registry (existing) | `/registry.html` | Admin | Full profile grid (already built) |

---

## 9. End-to-End User Journeys

### Journey 1: First-Time Faculty Registration (Self)

```mermaid
sequenceDiagram
    actor F as Faculty (jpeter)
    participant Login as Login Page
    participant API as Backend
    participant Dash as User Dashboard

    F->>Login: Types "jpeter"
    Login->>API: GET /auth/lookup?username=jpeter
    API-->>Login: 200 { name: "A. John Peter", face_status: "none" }
    Login->>Dash: Redirect → /dashboard.html?user=jpeter
    
    Note over Dash: face_status = "none"<br/>Shows "Register My Face" prompt
    
    F->>Dash: Clicks "Register My Face"
    Dash->>Dash: Opens webcam with Face Mesh overlay
    Dash->>Dash: User positions face inside guide box
    Dash->>API: POST /register { user_id: jpeter, image: blob }
    API->>API: Face Pipeline → extract embedding
    API-->>Dash: 201 { face_status: "registered" }
    
    Note over Dash: Dashboard switches to<br/>Attendance Scan mode
```

### Journey 2: Admin Bulk-Registers a Faculty Member

```mermaid
sequenceDiagram
    actor A as Admin
    participant Admin as Admin Dashboard
    participant API as Backend

    A->>Admin: Opens User Management tab
    A->>Admin: Searches for "jpeter"
    Admin-->>A: Shows jpeter — face_status: "none"
    A->>Admin: Clicks "Upload Face" on jpeter's row
    Admin->>Admin: File picker opens
    A->>Admin: Selects jpeter_photo.jpg
    Admin->>API: POST /register-admin { user_id: jpeter, file: jpeter_photo.jpg }
    API->>API: Face Pipeline → extract embedding
    API-->>Admin: 200 { face_status: "registered" }
    
    Note over Admin: jpeter's status updates to ✅ Registered<br/>Next time jpeter logs in, they go straight to scan
```

### Journey 3: Daily Attendance Scan

```mermaid
sequenceDiagram
    actor F as Faculty (jpeter)
    participant Dash as User Dashboard
    participant API as Backend

    F->>Dash: Opens dashboard (already logged in)
    Note over Dash: face_status = "registered"<br/>Auto-opens webcam

    Dash->>Dash: Face Mesh detects face → draws landmarks
    Dash->>Dash: Auto-captures best quality frame
    Dash->>API: POST /verify { user_id: jpeter, image: blob }
    API->>API: Liveness check → PASS
    API->>API: Embedding match → jpeter (95% similarity)
    API-->>Dash: { status: "CONFIRMED", name: "A. John Peter" }
    
    Note over Dash: Green flash ✅ "ATTENDANCE MARKED"<br/>Shows time: 9:03 AM
```

### Journey 4: User Requests Photo Update

```mermaid
sequenceDiagram
    actor F as Faculty (jpeter)
    participant Dash as User Dashboard
    participant API as Backend
    actor A as Admin
    participant Admin as Admin Dashboard

    F->>Dash: Clicks "Update Photo"
    Dash->>Dash: Shows upload form + message box
    F->>Dash: Uploads new photo + writes "Bad lighting in old photo"
    Dash->>API: POST /face-requests { type: update, image: blob, message: "..." }
    API-->>Dash: 201 { status: "pending" }
    
    Note over Dash: face_status → "pending_review"<br/>Shows "Awaiting Admin Review"

    Note over Admin: Notification badge shows "1 pending"
    A->>Admin: Opens Pending Requests tab
    Admin->>API: GET /face-requests?status=pending
    Admin-->>A: Shows jpeter's request with side-by-side comparison
    
    A->>Admin: Clicks "Approve & Replace"
    Admin->>API: PUT /face-requests/{id}/approve
    API->>API: Runs face pipeline on new image
    API->>API: Replaces old embedding with new one
    API-->>Admin: 200 { face_status: "approved" }
    
    Note over Dash: Next visit — jpeter's dashboard<br/>shows "approved" → auto-scan mode
```

### Journey 5: User Reports an Issue

```mermaid
sequenceDiagram
    actor F as Faculty (csara)
    participant Dash as User Dashboard
    participant API as Backend
    actor A as Admin

    F->>Dash: Clicks "Report Issue"
    Dash->>Dash: Shows message form
    F->>Dash: Types "System keeps rejecting my face in the morning"
    Dash->>API: POST /face-requests { type: issue_report, message: "..." }
    API-->>Dash: 201 Created
    
    Note over A: Admin sees issue in dashboard
    A->>API: PUT /face-requests/{id}/resolve { notes: "Re-enroll with better lighting" }
```

---

## 10. Implementation Phases

### Phase 1 — Database & CSV Seeding *(Backend)*
- [x] Extend `users` table schema (add `email`, `role`, `designation`, `department`, `face_status`)
- [x] Create `face_requests` table
- [x] Build CSV loader that parses all 4 CSV files and upserts into `users`
- [x] Add `/api/v1/auth/lookup` endpoint
- [x] Add `/api/v1/admin/seed-csv` endpoint
- [x] Migrate existing `faculty` data to new `users` schema

### Phase 2 — Login Page *(Frontend)*
- [x] Build `/login.html` with username input
- [x] Auto-lookup on input → show name + redirect
- [x] Handle "not found" → manual registration form
- [x] Store session in `localStorage` (user ID + role)

### Phase 3 — User Dashboard *(Frontend)*
- [x] Build `/dashboard.html` with adaptive layout based on `face_status`
- [x] Profile card (name, dept, email, status)
- [x] Face registration flow (webcam → capture → register)
- [x] Attendance scan flow (auto-capture → verify → log)
- [x] Attendance history table
- [x] Photo update request form
- [x] Issue report form

### Phase 4 — Admin Dashboard *(Frontend + Backend)*
- [x] Build `/admin.html` with tabbed interface
- [x] User Management tab (search, filter, upload face for user)
- [x] Pending Requests tab (approve/reject with side-by-side comparison)
- [x] Attendance Reports tab (date picker, present/absent counts)
- [x] Add `/api/v1/register-admin`, `/api/v1/face-requests/*` endpoints

### Phase 5 — Polish & Production
- [ ] Add role-based access control middleware
- [ ] Add email notifications for request status changes
- [ ] Add attendance export (CSV download)
- [ ] Performance optimization for 700+ users
- [ ] Mobile-responsive layouts

---

## 11. File Structure (Proposed)

```
frontend/
├── index.html          → Redirect to login
├── login.html          → Username entry page
├── dashboard.html      → User dashboard (attendance + profile)
├── admin.html          → Admin dashboard (management + reports)
├── registry.html       → Full user registry grid (existing)
├── style.css           → Shared design system
├── login.js            → Login page logic
├── dashboard.js        → User dashboard logic
├── admin.js            → Admin dashboard logic
└── main.js             → Legacy (original demo page, keep for reference)

backend/app/
├── main.py             → FastAPI app
├── config.py           → Settings
├── api/
│   ├── endpoints.py    → Existing endpoints (register, verify, faculty)
│   ├── auth.py         → NEW: Login lookup + manual registration
│   ├── face_requests.py → NEW: User requests + admin review
│   └── attendance.py   → NEW: Attendance reports
├── core/
│   ├── pipeline.py     → Face processing pipeline
│   └── csv_loader.py   → NEW: CSV parsing + DB seeding
├── db/
│   ├── database.py     → Schema definitions (extended)
│   └── vector_index.py → pgvector operations
└── models/
    └── schemas.py      → Pydantic models (extended)
```

---

> [!CAUTION]
> This plan assumes no institutional SSO/LDAP integration for now. The username-only auth is suitable for the PoC/hackathon phase. For production deployment at NITT, integrate with the institutional identity provider.
