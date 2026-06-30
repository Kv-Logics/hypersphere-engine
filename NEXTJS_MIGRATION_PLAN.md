# Next.js Frontend Migration Plan

This document outlines the step-by-step technical roadmap for migrating the Hypersphere Biometric Control Plane from vanilla HTML/JS/CSS to a modern **Next.js (App Router)** frontend stack.

---

## 1. Directory Structure Mapping

Moving from the flat static structures under `/frontend` to standard Next.js folders:

```
frontend/ (Current)                       nextjs-frontend/ (Target)
├── login.html                           ├── app/
├── dashboard.html                       │   ├── layout.tsx (Global HTML context)
├── admin.html                           │   ├── page.tsx (Auto redirect / login)
├── components/                          │   ├── login/
│   ├── users.html                       │   │   └── page.tsx (Login UI & checks)
│   ├── tester.html                      │   ├── dashboard/
│   │                                    │   │   └── page.tsx (Faculty portal + check-in)
│   ├── playground.html                  │   └── admin/
│   └── ...                              │       ├── layout.tsx (Admin Sidebar HUD)
└── assets/                              │       └── page.tsx (Active tab container)
    ├── js/                              ├── components/
    │   ├── admin.js                     │   ├── admin/
    │   └── dashboard.js                 │   │   ├── UsersTab.tsx
    └── css/                             │   │   ├── RequestsTab.tsx
        └── style.css                    │   │   ├── DriftsTab.tsx
                                         │   │   ├── ReportsTab.tsx
                                         │   │   ├── HealthTab.tsx
                                         │   │   ├── BiometricTester.tsx
                                         │   │   └── BiometricPlayground.tsx
                                         │   ├── ui/
                                         │   │   ├── Modal.tsx
                                         │   │   ├── ProgressBar.tsx
                                         │   │   └── StatusBadge.tsx
                                         │   └── webcam/
                                         │       └── WebcamFeed.tsx
                                         ├── hooks/
                                         │   ├── useWebcam.ts (Custom React stream controller)
                                         │   └── useAuth.ts (Authentication state hook)
                                         └── public/
                                             └── cdn-libs/ (Local fallback scripts)
```

---

## 2. Complete Feature Inventory & React Mapping

To ensure parity, every feature from the current system must be mapped to Next.js components:

### A. Authentication & Registration (`login.html`)
*   **Database User Lookup**: Input event listener that debounces input, cleans email suffixes, calls `/api/v1/auth/lookup`, and redirects on success.
*   **Manual Register Form**: Revealed slide-down container for registering user details if lookup fails, calling `/api/v1/auth/register-manual`.
*   **Next.js Implementation**: State-controlled form components in `app/login/page.tsx` utilizing a standard React debounce library.

### B. User Profile Management (`users.html`)
*   **Faculty Grid Table**: Displays user names, employee IDs, departments, designations, active roles, and biometric face registration statuses.
*   **Add User Modal**: Popup form with input validation (Username/ID, Name, Email, Employee ID, Department, and System Role) sending a payload to `POST /api/v1/faculty`.
*   **Next.js Implementation**: `components/admin/UsersTab.tsx` managing state for search inputs, table pagination, and the Add User modal toggle.

### C. Registration & Update Approvals (`requests.html`)
*   **Request Feed Card**: Displays user details, message notes, request type (Register, Update, Issue Report), and creation timestamp.
*   **Face Image Comparison**: Shows the user's currently registered biometric base photo alongside the new incoming file submission.
*   **Approve / Reject Action API**: Buttons triggering post actions to resolve the registration request.
*   **Next.js Implementation**: `components/admin/RequestsTab.tsx` displaying comparative image cards.

### D. Embedding Drift Reviews (`drifts.html`)
*   **Review Cards Grid**: Displays drifted embedding alerts showing candidate name, model version, and detection status.
*   **Save/Discard Decision**: Gated buttons allowing administrators to either:
    *   *Approve*: Incorporate the new drifted embedding into the user's active database vector pool.
    *   *Reject*: Permanently delete the candidate vector.
*   **Next.js Implementation**: `components/admin/DriftsTab.tsx`.

### E. Attendance Reports (`reports.html`)
*   **Date Filter Calendar**: Date-picker input that filters the matching biometric logs.
*   **Daily Log Table**: Displays Faculty ID, Name, Time, Status (Confirmed/Rejected), Similarity Score, and Liveness Score.
*   **Export Actions**: Buttons to trigger downloads of CSV or Excel spreadsheets.
*   **Next.js Implementation**: `components/admin/ReportsTab.tsx` utilizing dynamic table filters.

### F. System Health & Performance Monitoring (`health.html`)
*   **Database & Indexing Telemetry**: Live indicators of PostgreSQL connection and PGVector HNSW index status.
*   **Model Initialized States**: Icons representing loaded states for detection (SCRFD), recognition (ArcFace), and liveness (MiniFASNet) algorithms.
*   **System Performance Gauges**: Telemetry cards reading real-time metrics (`/api/v1/metrics/system`) including CPU, Memory, GPU usage, False Acceptance Rate (FAR), False Rejection Rate (FRR), and average matching similarity.
*   **Auto-Refresh Logic**: State-controlled toggle checkbox to clear or establish a 3-second interval polling function.
*   **Next.js Implementation**: `components/admin/HealthTab.tsx` running a periodic `setInterval` poll matching the current tab focus.

### G. Biometric Tester & Evaluation Sandbox (`tester.html` & `playground.html`)
*   **Manual Tester**: Single frame verification using image file uploads or camera snapshots.
*   **Real-time Playground Loop**: Continuous webcam loop polling `/api/v1/verify` every 500ms, displaying matching name profiles, warning frames for spoofs, and multi-stage latency telemetry.
*   **Anti-spoofing Control**: Active toggle switch in the sandbox layout calling `POST /api/v1/config/antispoof` to control liveness testing on the fly.
*   **Next.js Implementation**: `components/admin/BiometricTester.tsx` and `components/admin/BiometricPlayground.tsx`.

### H. Faculty Dashboard & Attendance Portal (`dashboard.html`)
*   **Self-Enrollment Capture**: Integrated interface guiding new users to record their baseline profile photo.
*   **Multi-Frame Verification**: Frame-sampling array (capturing 5 frames sequentially spaced by 200ms) to submit averaged vectors and gate liveness.
*   **Personal Scans Log**: History list showing dates, confirmation status indicators, and match similarity percentages.
*   **Next.js Implementation**: `app/dashboard/page.tsx` displaying the webcam portal and attendance stats.

---

## 3. UI & Styling Preservation Guidelines

To guarantee the Next.js frontend looks **identical** to the existing polished design, follow these styling constraints:

### 1. Global CSS Token Inheritance
All CSS custom properties from `/frontend/assets/css/style.css` must be retained in the Next.js `app/globals.css`:
*   **Theme Colors**:
    *   `--primary`: `#1976d2`
    *   `--primary-light`: `rgba(25, 118, 210, 0.08)`
    *   `--background`: `#f8f9fa`
    *   `--surface`: `#ffffff`
    *   `--text-primary`: `#212529`
    *   `--text-secondary`: `#6c757d`
    *   `--border-color`: `#e9ecef`
    *   `--divider`: `#e9ecef`
    *   `--success`: `#2e7d32`
    *   `--error`: `#c62828`
    *   `--warning`: `#ed6c02`
*   **Fonts**: Outfit (headings), Roboto (body text), and JetBrains Mono (monospaced telemetry logs).

### 2. Layout Structure & UI Cards
*   **Sidebar Layout**: Keep the same 260px wide sidebar with identical icon spacing, hover states, active class styling (`.active` background), and background gradients.
*   **Sidebar Notification Badges**: Real-time count bubbles for Pending Requests (warning yellow) and Drift Reviews (error red) that disappear if the count is zero.
*   **Glassmorphic Overlays**: Cards must preserve their exact `border-radius: 12px` (or `16px`), `box-shadow` values, and light grey borders.

### 3. Webcam HUD Canvas Rendering
The canvas HUD drawing code in React must match the canvas context coordinates and styles of the current project:
*   **Pulsing Status Badges**: Colored camera state badges (e.g. green "LIVE SCANNING", orange "LOADING HUD...", blue "STARTING CAMERA...") on the video frame container.
*   **Bounding Box corners**: Neon green (`#00e676`), width 3px, length of 20% of box size.
*   **Key points**: Soft neon blue (`rgba(0, 176, 255, 0.7)`), 3px radius circle dots at eyes, nose, mouth corners, and chin index mappings.
*   **Liveness warnings**: Bold red bounding boxes (`#ff1744`) when spoofing is flagged.

---

## 4. Tech Stack Advantages & Improvements

1. **Performance**: Server-side rendering (SSR) for static layouts, client-side hydration (CSR) for webcam canvas overlays and telemetry.
2. **Type Safety**: TypeScript integration for pipeline endpoints models matching the FastAPI Pydantic schema schemas.
3. **Webcam Lifecycle Hook**: Explicit React `useEffect` cleanups prevent issues where video streams continue to run in the background after switching tabs.
4. **Local SDK Imports**: Replace dynamic CDN loads of the Google MediaPipe packages with local npm `@mediapipe/tasks-vision` module compilation, boosting speed and offline reliability.
