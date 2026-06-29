let currentUser = null;
let allUsersList = [];
let pendingRequestsList = [];

window.addEventListener('DOMContentLoaded', async () => {
    // Session Guard via backend cookie
    try {
        const res = await fetch("/api/v1/auth/me");
        if (res.ok) {
            currentUser = await res.json();
            localStorage.setItem("user", JSON.stringify(currentUser));
            if (currentUser.role !== "admin") {
                window.location.href = "/dashboard.html";
                return;
            }
        } else {
            localStorage.removeItem("user");
            window.location.href = "/login.html";
            return;
        }
    } catch (e) {
        localStorage.removeItem("user");
        window.location.href = "/login.html";
        return;
    }
    
    // Set default date for report to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("reportDate").value = today;
    
    // Load initial tab data
    loadAllUsers();
    loadPendingRequests();
    loadDailyReport();
});

function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));
    
    // Show active tab
    document.getElementById(tabId).classList.add('active');
    
    // Highlight button
    if (tabId === 'tabUsers') document.getElementById('btnTabUsers').classList.add('active');
    if (tabId === 'tabRequests') document.getElementById('btnTabRequests').classList.add('active');
    if (tabId === 'tabReports') document.getElementById('btnTabReports').classList.add('active');
    if (tabId === 'tabTester') document.getElementById('btnTabTester').classList.add('active');

    // Automatically stop webcams when switching tabs
    if (tabId !== 'tabTester') {
        stopTesterWebcam();
    }
}

// Fetch all users
async function loadAllUsers() {
    try {
        const res = await fetch("/api/v1/faculty");
        if (!res.ok) return;
        
        allUsersList = await res.json();
        renderUserTable(allUsersList);
        
        // Update stats
        document.getElementById("statTotalUsers").innerText = allUsersList.length;
        
    } catch(err) {
        console.error("Failed to load users:", err);
    }
}

function renderUserTable(list) {
    const tbody = document.getElementById("userTableBody");
    tbody.innerHTML = "";
    
    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 2rem 0; color: var(--text-secondary);">
                    No matching users found.
                </td>
            </tr>
        `;
        return;
    }
    
    list.forEach(user => {
        let statusClass = "status-none";
        let statusLabel = "No Face";
        
        if (user.face_status === "registered") { statusClass = "status-registered"; statusLabel = "Registered"; }
        else if (user.face_status === "approved") { statusClass = "status-registered"; statusLabel = "Approved"; }
        else if (user.face_status === "pending_review") { statusClass = "status-pending"; statusLabel = "Pending Review"; }
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-family:'JetBrains Mono', monospace; font-weight:600;">${user.id}</td>
            <td style="font-weight:500;">${user.name}</td>
            <td style="text-transform:uppercase; font-size:0.8rem; font-weight:600;">${user.role}</td>
            <td>${user.department || "General"}</td>
            <td>
                <span class="status-pill ${statusClass}" style="margin:0; font-size:0.75rem; padding: 0.25rem 0.6rem;">
                    ${statusLabel}
                </span>
            </td>
            <td style="text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button onclick="openUploadModal('${user.id}', '${user.name.replace(/'/g, "\\'")}')" class="btn btn-outlined" style="font-size:0.75rem; padding: 0.35rem 0.65rem;">
                    Upload Face
                </button>
                <button onclick="deleteUser('${user.id}')" class="btn btn-outlined" style="font-size:0.75rem; padding: 0.35rem 0.65rem; border-color: rgba(211,47,47,0.3); color: var(--error);">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers() {
    const query = document.getElementById("userSearch").value.toLowerCase().trim();
    const role = document.getElementById("roleFilter").value;
    const status = document.getElementById("statusFilter").value;
    
    const filtered = allUsersList.filter(user => {
        const matchesQuery = user.name.toLowerCase().includes(query) || user.id.toLowerCase().includes(query);
        const matchesRole = role ? user.role === role : true;
        const matchesStatus = status ? user.face_status === status : true;
        return matchesQuery && matchesRole && matchesStatus;
    });
    
    renderUserTable(filtered);
}

// Fetch pending approval queue
async function loadPendingRequests() {
    try {
        const res = await fetch("/api/v1/face-requests?status=pending");
        if (!res.ok) return;
        
        pendingRequestsList = await res.json();
        
        // Update badge
        const badge = document.getElementById("pendingBadge");
        badge.innerText = pendingRequestsList.length;
        badge.style.display = pendingRequestsList.length > 0 ? "inline-flex" : "none";
        
        renderRequests(pendingRequestsList);
        
    } catch(err) {
        console.error("Failed to load requests:", err);
    }
}

function renderRequests(list) {
    const container = document.getElementById("requestsContainer");
    container.innerHTML = "";
    
    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 3rem 0; color: var(--text-secondary);">
                No pending face registration/update requests.
            </div>
        `;
        return;
    }
    
    list.forEach(req => {
        const card = document.createElement("div");
        card.className = "request-card";
        
        // Find matching user from user list
        const user = allUsersList.find(u => u.id === req.user_id) || { name: req.user_id, department: "Unknown" };
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1px solid var(--divider); padding-bottom: 0.75rem;">
                <div>
                    <h3 style="margin:0; font-family:'Outfit', sans-serif; font-size:1.1rem; color:var(--text-primary);">${user.name} (@${req.user_id})</h3>
                    <p style="margin:0.2rem 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Department: ${user.department || "General"} | Request type: ${req.request_type.toUpperCase()}</p>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${new Date(req.created_at).toLocaleString()}</div>
            </div>
            
            <div style="font-size: 0.9rem; color:var(--text-primary);">
                <strong>User Message:</strong> "${req.message || 'No message provided'}"
            </div>
            
            <div class="comparison-view">
                <div>
                    <div style="font-size:0.8rem; font-weight:600; margin-bottom:0.4rem; color:var(--text-secondary);">CURRENT BASE FACE</div>
                    <div class="photo-box">
                        <span class="placeholder-label">No existing face registered</span>
                    </div>
                </div>
                <div>
                    <div style="font-size:0.8rem; font-weight:600; margin-bottom:0.4rem; color:var(--text-secondary);">NEW SUBMITTED FACE</div>
                    <div class="photo-box">
                        <img src="/api/v1/face-requests/${req.id}/image" alt="Uploaded face preview" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <span class="placeholder-label" style="display:none;">Failed to load image preview</span>
                    </div>
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">ADMIN RESOLUTION NOTES (OPTIONAL)</label>
                <textarea id="note_${req.id}" placeholder="Type notes here..." rows="2" style="border:1px solid var(--border-color); padding:0.5rem; border-radius:6px; font-size:0.85rem; resize:none; outline:none;"></textarea>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                <button onclick="processRequest(${req.id}, 'reject')" class="btn btn-outlined" style="border-color: rgba(211,47,47,0.3); color:var(--error);">
                    Reject Update
                </button>
                <button onclick="processRequest(${req.id}, 'approve')" class="btn btn-contained" style="background-color: var(--success);">
                    Approve & Replace
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function processRequest(reqId, decision) {
    const notesInput = document.getElementById(`note_${reqId}`);
    const notes = notesInput ? notesInput.value.trim() : "";
    
    const formData = new FormData();
    if (notes) {
        formData.append("admin_notes", notes);
    }
    
    try {
        const res = await fetch(`/api/v1/face-requests/${reqId}/${decision}`, {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            alert(`Request successfully ${decision}d.`);
            // Reload all
            loadPendingRequests();
            loadAllUsers();
        } else {
            const err = await res.json();
            alert(`Operation failed: ${err.detail || "Error processing request"}`);
        }
    } catch(err) {
        alert("Operation failed: connection error.");
    }
}

// Attendance Reports
async function loadDailyReport() {
    const selectedDate = document.getElementById("reportDate").value;
    if (!selectedDate) return;
    
    try {
        // Fetch all attendance logs
        // Wait, backend /attendance endpoint has a limit of 50. Let's make sure we query for reports
        // If we want a specific day, let's pass a date query. We'll filter on the frontend for now,
        // or query GET /api/v1/attendance
        const res = await fetch(`/api/v1/attendance`);
        if (!res.ok) return;
        
        const logs = await res.json();
        
        // Filter logs for selectedDate (YYYY-MM-DD)
        const dailyLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp).toISOString().split('T')[0];
            return logDate === selectedDate;
        });
        
        // Calculate Present/Absent
        const presentUserIds = new Set(dailyLogs.filter(l => l.status === "CONFIRMED").map(l => l.faculty_id));
        const totalCount = allUsersList.length || 730; // Fallback
        const presentCount = presentUserIds.size;
        const absentCount = Math.max(0, totalCount - presentCount);
        
        document.getElementById("statPresentToday").innerText = presentCount;
        document.getElementById("statAbsentToday").innerText = absentCount;
        
        // Render daily log table
        const tbody = document.getElementById("reportTableBody");
        tbody.innerHTML = "";
        
        if (dailyLogs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">
                        No biometric scans logged on this date.
                    </td>
                </tr>
            `;
            return;
        }
        
        dailyLogs.forEach(log => {
            // Find name
            const user = allUsersList.find(u => u.id === log.faculty_id) || { name: log.faculty_id || "Guest / Unknown" };
            const timeStr = new Date(log.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', second:'2-digit'});
            
            const isConfirmed = log.status === "CONFIRMED";
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-family:'JetBrains Mono', monospace; font-weight:600;">${log.faculty_id || "—"}</td>
                <td style="font-weight:500;">${user.name}</td>
                <td>${timeStr}</td>
                <td>
                    <span class="status-pill ${isConfirmed ? 'status-registered' : 'status-none'}" style="margin:0; font-size:0.75rem; padding: 0.2rem 0.5rem;">
                        ${log.status}
                    </span>
                </td>
                <td style="font-family:'JetBrains Mono', monospace;">${log.similarity_score ? Math.round(log.similarity_score*100)+"%" : "—"}</td>
                <td style="font-family:'JetBrains Mono', monospace;">${log.liveness_score ? Math.round(log.liveness_score*100)+"%" : "—"}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch(err) {
        console.error("Failed to load report:", err);
    }
}

// Modal handling
function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

let adminStream = null;
let adminFaceLandmarker = null;
let isAdminDetecting = false;
let adminRegMode = "upload"; // "upload" or "camera"

function setRegMode(mode) {
    adminRegMode = mode;
    const btnUpload = document.getElementById("btnModeUpload");
    const btnCamera = document.getElementById("btnModeCamera");
    const sectionUpload = document.getElementById("regSectionUpload");
    const sectionCamera = document.getElementById("regSectionCamera");
    const fileInput = document.getElementById("adminFile");
    const submitBtn = document.getElementById("btnSubmitAdminReg");

    if (mode === "upload") {
        btnUpload.classList.add("active");
        btnUpload.style.borderBottom = "2px solid var(--primary)";
        btnUpload.style.fontWeight = "600";
        btnUpload.style.color = "var(--primary)";

        btnCamera.classList.remove("active");
        btnCamera.style.borderBottom = "2px solid transparent";
        btnCamera.style.fontWeight = "500";
        btnCamera.style.color = "var(--text-secondary)";

        sectionUpload.style.display = "block";
        sectionCamera.style.display = "none";
        fileInput.required = true;
        submitBtn.style.display = "inline-flex";
        stopAdminWebcam();
    } else {
        btnCamera.classList.add("active");
        btnCamera.style.borderBottom = "2px solid var(--primary)";
        btnCamera.style.fontWeight = "600";
        btnCamera.style.color = "var(--primary)";

        btnUpload.classList.remove("active");
        btnUpload.style.borderBottom = "2px solid transparent";
        btnUpload.style.fontWeight = "500";
        btnUpload.style.color = "var(--text-secondary)";

        sectionUpload.style.display = "none";
        sectionCamera.style.display = "block";
        fileInput.required = false;
        fileInput.value = "";
        submitBtn.style.display = "none";
    }
}

function openUploadModal(userId, userName) {
    document.getElementById("uploadUserId").value = userId;
    document.getElementById("uploadUserNameLabel").innerText = `${userName} (@${userId})`;
    setRegMode('upload');
    openModal("adminUploadModal");
}

function closeAdminModal() {
    stopAdminWebcam();
    closeModal('adminUploadModal');
}

// Admin webcam capture functions
async function toggleAdminCam() {
    const btn = document.getElementById("btnStartAdminCam");
    const status = document.getElementById("adminCamStatus");

    if (adminStream) {
        stopAdminWebcam();
    } else {
        status.innerText = "Starting camera...";
        btn.innerText = "Stop Camera";
        try {
            adminStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            });
            const videoEl = document.getElementById("adminWebcam");
            videoEl.srcObject = adminStream;
            videoEl.play();

            const canvasEl = document.getElementById("adminOverlayCanvas");
            videoEl.onloadedmetadata = () => {
                canvasEl.width = videoEl.videoWidth;
                canvasEl.height = videoEl.videoHeight;
            };

            if (!adminFaceLandmarker) {
                status.innerText = "Loading MediaPipe Face Mesh...";
                const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
                const { FaceLandmarker, FilesetResolver } = vision;
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                adminFaceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
            }

            status.innerText = "Look directly at the camera...";
            isAdminDetecting = true;
            document.getElementById("btnCaptureAdminFace").style.display = "inline-flex";
            requestAnimationFrame(adminDetectionLoop);
        } catch (err) {
            console.error("Admin webcam failed:", err);
            status.innerText = "Camera error: " + err.message;
            stopAdminWebcam();
        }
    }
}

function stopAdminWebcam() {
    isAdminDetecting = false;
    const startBtn = document.getElementById("btnStartAdminCam");
    if (startBtn) startBtn.innerText = "Start Camera";
    
    const capBtn = document.getElementById("btnCaptureAdminFace");
    if (capBtn) capBtn.style.display = "none";
    
    const status = document.getElementById("adminCamStatus");
    if (status) status.innerText = "Camera is inactive.";

    if (adminStream) {
        adminStream.getTracks().forEach(track => track.stop());
        adminStream = null;
    }
    const videoEl = document.getElementById("adminWebcam");
    if (videoEl) videoEl.srcObject = null;

    const canvasEl = document.getElementById("adminOverlayCanvas");
    if (canvasEl) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
}

function adminDetectionLoop() {
    if (!isAdminDetecting || !adminFaceLandmarker) return;

    const videoEl = document.getElementById("adminWebcam");
    const canvasEl = document.getElementById("adminOverlayCanvas");

    if (videoEl && videoEl.readyState >= 2) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);

        const results = adminFaceLandmarker.detectForVideo(videoEl, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            drawAdminFaceResults(ctxEl, canvasEl.width, canvasEl.height, results.faceLandmarks[0]);
        }
    }

    if (isAdminDetecting) {
        requestAnimationFrame(adminDetectionLoop);
    }
}

function drawAdminFaceResults(ctxEl, width, height, landmarks) {
    let minX = width, maxX = 0, minY = height, maxY = 0;
    landmarks.forEach(lm => {
        const x = lm.x * width;
        const y = lm.y * height;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    minX = Math.max(0, minX - boxW * 0.15);
    maxX = Math.min(width, maxX + boxW * 0.15);
    minY = Math.max(0, minY - boxH * 0.2);
    maxY = Math.min(height, maxY + boxH * 0.1);

    ctxEl.strokeStyle = "#00e676";
    ctxEl.lineWidth = 3;
    const len = Math.min(maxX - minX, maxY - minY) * 0.2;

    ctxEl.beginPath();
    ctxEl.moveTo(minX, minY + len);
    ctxEl.lineTo(minX, minY);
    ctxEl.lineTo(minX + len, minY);
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(maxX - len, minY);
    ctxEl.lineTo(maxX, minY);
    ctxEl.lineTo(maxX, minY + len);
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(minX, minY + (maxY - minY) - len);
    ctxEl.lineTo(minX, minY + (maxY - minY));
    ctxEl.lineTo(minX + len, minY + (maxY - minY));
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(maxX - len, minY + (maxY - minY));
    ctxEl.lineTo(maxX, minY + (maxY - minY));
    ctxEl.lineTo(maxX, minY + (maxY - minY) - len);
    ctxEl.stroke();
}

async function captureAdminFace() {
    const videoEl = document.getElementById("adminWebcam");
    const userId = document.getElementById("uploadUserId").value;
    const status = document.getElementById("adminCamStatus");

    if (!videoEl || videoEl.readyState < 2) return;

    status.innerText = "Capturing face frame...";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

    tempCanvas.toBlob(async (blob) => {
        if (!blob) {
            status.innerText = "Frame capture failed.";
            return;
        }

        const formData = new FormData();
        formData.append("user_id", userId);
        formData.append("file", blob, "webcam_admin_register.jpg");

        status.innerText = "Registering face to database...";
        try {
            const res = await fetch("/api/v1/register-admin", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                alert(`Face biometrics registered successfully for ${userId}.`);
                closeAdminModal();
                loadAllUsers();
            } else {
                const err = await res.json();
                status.innerText = `Registration failed: ${err.detail || "Server error"}`;
            }
        } catch (err) {
            status.innerText = "Registration failed: connection error.";
        }
    }, "image/jpeg", 0.95);
}

async function submitAdminUpload(event) {
    event.preventDefault();
    const userId = document.getElementById("uploadUserId").value;
    const fileInput = document.getElementById("adminFile");
    
    if (fileInput.files.length === 0) return;
    
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("file", fileInput.files[0]);
    
    closeAdminModal();
    
    try {
        const res = await fetch("/api/v1/register-admin", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            alert(`Face registration successfully saved for user ${userId}.`);
            loadAllUsers();
        } else {
            const err = await res.json();
            alert(`Face upload failed: ${err.detail || "Server error"}`);
        }
    } catch(err) {
        alert("Face upload failed: connection error.");
    }
}

async function deleteUser(userId) {
    if (!confirm(`Are you sure you want to delete user ${userId}? This will remove their profile and all biometric data.`)) {
        return;
    }
    
    try {
        const res = await fetch(`/api/v1/faculty/${userId}`, {
            method: "DELETE"
        });
        
        if (res.ok) {
            alert(`User ${userId} deleted successfully.`);
            loadAllUsers();
        } else {
            const err = await res.json();
            alert(`Failed to delete user: ${err.detail || "Server error"}`);
        }
    } catch(err) {
        alert("Failed to delete user: connection error.");
    }
}

async function handleLogout() {
    try {
        await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("user");
    window.location.href = "/login.html";
}

// Verification Tester Tab Logic
let testerStream = null;
let testerFaceLandmarker = null;
let isTesterDetecting = false;
let testerRegMode = "upload"; // "upload" or "camera"

function setTesterMode(mode) {
    testerRegMode = mode;
    const btnUpload = document.getElementById("btnTesterModeUpload");
    const btnCamera = document.getElementById("btnTesterModeCamera");
    const sectionUpload = document.getElementById("testerSectionUpload");
    const sectionCamera = document.getElementById("testerSectionCamera");
    const fileInput = document.getElementById("testerFile");

    if (mode === "upload") {
        btnUpload.classList.add("active");
        btnUpload.style.borderBottom = "2px solid var(--primary)";
        btnUpload.style.fontWeight = "600";
        btnUpload.style.color = "var(--primary)";

        btnCamera.classList.remove("active");
        btnCamera.style.borderBottom = "2px solid transparent";
        btnCamera.style.fontWeight = "500";
        btnCamera.style.color = "var(--text-secondary)";

        sectionUpload.style.display = "block";
        sectionCamera.style.display = "none";
        fileInput.required = true;
        stopTesterWebcam();
    } else {
        btnCamera.classList.add("active");
        btnCamera.style.borderBottom = "2px solid var(--primary)";
        btnCamera.style.fontWeight = "600";
        btnCamera.style.color = "var(--primary)";

        btnUpload.classList.remove("active");
        btnUpload.style.borderBottom = "2px solid transparent";
        btnUpload.style.fontWeight = "500";
        btnUpload.style.color = "var(--text-secondary)";

        sectionUpload.style.display = "none";
        sectionCamera.style.display = "block";
        fileInput.required = false;
        fileInput.value = "";
    }
}

async function toggleTesterCam() {
    const btn = document.getElementById("btnStartTesterCam");
    const status = document.getElementById("testerCamStatus");

    if (testerStream) {
        stopTesterWebcam();
    } else {
        status.innerText = "Starting camera...";
        btn.innerText = "Stop Camera";
        try {
            testerStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            });
            const videoEl = document.getElementById("testerWebcam");
            videoEl.srcObject = testerStream;
            videoEl.play();

            const canvasEl = document.getElementById("testerOverlayCanvas");
            videoEl.onloadedmetadata = () => {
                canvasEl.width = videoEl.videoWidth;
                canvasEl.height = videoEl.videoHeight;
            };

            if (!testerFaceLandmarker) {
                status.innerText = "Loading MediaPipe Face Mesh...";
                const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
                const { FaceLandmarker, FilesetResolver } = vision;
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                testerFaceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numFaces: 1,
                    minFaceDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });
            }

            status.innerText = "Position your face in the box...";
            isTesterDetecting = true;
            document.getElementById("btnVerifyTesterFace").style.display = "inline-flex";
            requestAnimationFrame(testerDetectionLoop);
        } catch (err) {
            console.error("Tester webcam failed:", err);
            status.innerText = "Camera error: " + err.message;
            stopTesterWebcam();
        }
    }
}

function stopTesterWebcam() {
    isTesterDetecting = false;
    const startBtn = document.getElementById("btnStartTesterCam");
    if (startBtn) startBtn.innerText = "Start Camera";
    
    const verifyBtn = document.getElementById("btnVerifyTesterFace");
    if (verifyBtn) verifyBtn.style.display = "none";
    
    const status = document.getElementById("testerCamStatus");
    if (status) status.innerText = "Camera is inactive.";

    if (testerStream) {
        testerStream.getTracks().forEach(track => track.stop());
        testerStream = null;
    }
    const videoEl = document.getElementById("testerWebcam");
    if (videoEl) videoEl.srcObject = null;

    const canvasEl = document.getElementById("testerOverlayCanvas");
    if (canvasEl) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
}

function testerDetectionLoop() {
    if (!isTesterDetecting || !testerFaceLandmarker) return;

    const videoEl = document.getElementById("testerWebcam");
    const canvasEl = document.getElementById("testerOverlayCanvas");

    if (videoEl && videoEl.readyState >= 2) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);

        const results = testerFaceLandmarker.detectForVideo(videoEl, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            drawTesterFaceResults(ctxEl, canvasEl.width, canvasEl.height, results.faceLandmarks[0]);
        }
    }

    if (isTesterDetecting) {
        requestAnimationFrame(testerDetectionLoop);
    }
}

function drawTesterFaceResults(ctxEl, width, height, landmarks) {
    let minX = width, maxX = 0, minY = height, maxY = 0;
    landmarks.forEach(lm => {
        const x = lm.x * width;
        const y = lm.y * height;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    minX = Math.max(0, minX - boxW * 0.15);
    maxX = Math.min(width, maxX + boxW * 0.15);
    minY = Math.max(0, minY - boxH * 0.2);
    maxY = Math.min(height, maxY + boxH * 0.1);

    ctxEl.strokeStyle = "#00e676";
    ctxEl.lineWidth = 3;
    const len = Math.min(maxX - minX, maxY - minY) * 0.2;

    ctxEl.beginPath();
    ctxEl.moveTo(minX, minY + len);
    ctxEl.lineTo(minX, minY);
    ctxEl.lineTo(minX + len, minY);
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(maxX - len, minY);
    ctxEl.lineTo(maxX, minY);
    ctxEl.lineTo(maxX, minY + len);
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(minX, minY + (maxY - minY) - len);
    ctxEl.lineTo(minX, minY + (maxY - minY));
    ctxEl.lineTo(minX + len, minY + (maxY - minY));
    ctxEl.stroke();

    ctxEl.beginPath();
    ctxEl.moveTo(maxX - len, minY + (maxY - minY));
    ctxEl.lineTo(maxX, minY + (maxY - minY));
    ctxEl.lineTo(maxX, minY + (maxY - minY) - len);
    ctxEl.stroke();
}

function displayTesterResult(data) {
    document.getElementById("testerResultPlaceholder").style.display = "none";
    document.getElementById("testerResultDetails").style.display = "block";

    const userEl = document.getElementById("testerResultUser");
    const accuracyEl = document.getElementById("testerResultAccuracy");
    const livenessEl = document.getElementById("testerResultLiveness");
    const qualityEl = document.getElementById("testerResultQuality");
    const feedbackEl = document.getElementById("testerResultFeedback");
    const statusPill = document.getElementById("testerResultStatusPill");

    if (data.match_found && data.candidate) {
        userEl.innerText = `${data.candidate.name} (@${data.candidate.faculty_id})`;
        accuracyEl.innerText = `${Math.round(data.candidate.similarity_score * 100)}% (Confidence)`;
        
        statusPill.innerText = "MATCH CONFIRMED";
        statusPill.style.backgroundColor = "var(--success)";
        statusPill.style.color = "var(--surface)";
    } else {
        userEl.innerText = "Unknown Guest / No Match";
        accuracyEl.innerText = "N/A";
        
        statusPill.innerText = "NO MATCH";
        statusPill.style.backgroundColor = "var(--error)";
        statusPill.style.color = "var(--surface)";
    }

    const liveScore = data.liveness_score !== undefined ? Math.round(data.liveness_score * 100) : 0;
    livenessEl.innerText = `${liveScore}% (${liveScore > 50 ? "Real Face" : "Spoof Warning"})`;
    
    const qualScore = data.quality_score !== undefined ? Math.round(data.quality_score * 100) : 0;
    qualityEl.innerText = `${qualScore}%`;
    
    feedbackEl.innerText = data.feedback && data.feedback.length > 0 ? data.feedback.join(". ") : "No quality issues detected.";
}

async function captureAndVerifyTester() {
    const videoEl = document.getElementById("testerWebcam");
    const status = document.getElementById("testerCamStatus");

    if (!videoEl || videoEl.readyState < 2) return;

    status.innerText = "Capturing face scan...";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

    tempCanvas.toBlob(async (blob) => {
        if (!blob) {
            status.innerText = "Frame capture failed.";
            return;
        }

        const formData = new FormData();
        formData.append("device_id", "Admin_Webcam_Tester");
        formData.append("file", blob, "tester_capture.jpg");

        status.innerText = "Testing verification...";
        try {
            const res = await fetch("/api/v1/verify", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                displayTesterResult(data);
                status.innerText = "Scan completed successfully.";
            } else {
                const err = await res.json();
                status.innerText = `Scan failed: ${err.detail || "Server error"}`;
            }
        } catch (err) {
            status.innerText = "Scan failed: connection error.";
        }
    }, "image/jpeg", 0.95);
}

async function runFileTester() {
    const fileInput = document.getElementById("testerFile");
    if (fileInput.files.length === 0) {
        alert("Please select a face image file to test.");
        return;
    }

    const formData = new FormData();
    formData.append("device_id", "Admin_File_Tester");
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            displayTesterResult(data);
        } else {
            const err = await res.json();
            alert(`File verification failed: ${err.detail || "Server error"}`);
        }
    } catch (err) {
        alert("File verification failed: connection error.");
    }
}
