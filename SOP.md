# Standard Operating Procedure (SOP)
## Hypersphere Engine — Smart Presence & Campus Geofencing System
**Amrita Vishwa Vidyapeetham, Ettimadai Campus**

---

### 1. Purpose
This Standard Operating Procedure (SOP) provides a simple, step-by-step guide to launch, operate, and verify the Hypersphere Engine biometric attendance and spatial geofencing system.

---

### 2. System Requirements
- **Hardware**: Raspberry Pi 5 ARM64 (or laptop / local workstation)
- **Network**: Local Campus LAN (Amrita-Net) — Zero cloud dependency
- **Software**: Python 3.10+, Node.js 18+

---

### 3. Step-by-Step Startup Procedure

Open two terminal windows:

#### Step 1: Start Backend Engine (FastAPI)
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- **Verification**: Terminal shows `Uvicorn running on http://127.0.0.1:8000`

#### Step 2: Start Frontend Console (Next.js)
```bash
cd nextjs-frontend
npm run dev
```
- **Verification**: Terminal shows `Ready in http://localhost:3000`

---

### 4. Application Links

| Interface | URL | Purpose |
| :--- | :--- | :--- |
| **Review 2 Defense Console** | [`http://localhost:3000/review2`](http://localhost:3000/review2) | Main presentation dashboard & architecture |
| **Visual Pipeline Simulator** | [`http://localhost:3000/review2/simulator`](http://localhost:3000/review2/simulator) | Live 9-stage pipeline execution & benchmark |
| **Amrita Campus Geofence Map** | [`http://localhost:3000/geofence`](http://localhost:3000/geofence) | 103 OSM extracted buildings & live location test |

---

### 5. How to Test the System (3 Simple Scenarios)

In the simulator ([`http://localhost:3000/review2/simulator`](http://localhost:3000/review2/simulator)):

#### Test 1: Genuine Attendance Verification
1. Click **"Benchmark Demo"** (or use live camera / upload photo).
2. The system executes all 9 stages:
   - Detects face and extracts 5 facial landmarks (SCRFD).
   - Verifies liveness (MiniFASNet).
   - Matches 512-D ArcFace embedding with database faculty (Cosine ≥ 0.650).
   - Confirms location inside campus boundary (Jordan Curve Algorithm).
3. **Outcome**: `ACCESS GRANTED` — Recorded in SQLite in **138 ms**.

#### Test 2: Spoof Attack Prevention
1. Click **"Spoof Attack"** (or present a screen/photo replay).
2. MiniFASNet detects display glare and screen texture at Stage 06.
3. **Outcome**: `SPOOF REJECTED` — Circuit breaker immediately stops downstream processing to save CPU.

#### Test 3: Geofence Boundary Check
1. Click **"Out-of-Bounds"** (sets location outside Amrita campus).
2. Biometric matches, but coordinates fail the campus boundary polygon test.
3. **Outcome**: `OUTSIDE PERIMETER` — Attendance rejected.

---

### 6. Shutdown Procedure
Press `Ctrl + C` in both terminal windows to stop the servers.
