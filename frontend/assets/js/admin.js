let currentUser = null;
let allUsersList = [];
let pendingRequestsList = [];

function parseUTCDateTime(dateStr) {
    if (!dateStr) return new Date();
    // If it doesn't end with Z or a timezone offset, append Z to force UTC parsing
    if (!dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.match(/-\d{2}:\d{2}$/)) {
        return new Date(dateStr + "Z");
    }
    return new Date(dateStr);
}


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
    
    // Load initial active tab
    await switchTab('tabUsers');
});

let healthInterval = null;

const loadedTabs = {};

async function loadTabContent(tabId) {
    if (loadedTabs[tabId]) return;
    const container = document.getElementById(tabId);
    if (!container) return;
    
    const componentMap = {
        'tabUsers': 'users',
        'tabRequests': 'requests',
        'tabDrifts': 'drifts',
        'tabReports': 'reports',
        'tabHealth': 'health',
        'tabTester': 'tester',
        'tabPlayground': 'playground'
    };
    
    const componentName = componentMap[tabId];
    if (!componentName) return;
    
    try {
        const res = await fetch(`/components/${componentName}.html`);
        if (res.ok) {
            container.innerHTML = await res.text();
            loadedTabs[tabId] = true;
            
            // Run initial data loading for this tab
            if (tabId === 'tabUsers') {
                await loadAllUsers();
            } else if (tabId === 'tabRequests') {
                await loadPendingRequests();
            } else if (tabId === 'tabDrifts') {
                await loadPendingDrifts();
            } else if (tabId === 'tabReports') {
                const today = new Date().toISOString().split('T')[0];
                const reportDateEl = document.getElementById("reportDate");
                if (reportDateEl) {
                     reportDateEl.value = today;
                }
                await loadDailyReport();
            } else if (tabId === 'tabHealth') {
                await loadSystemHealth();
            } else if (tabId === 'tabPlayground') {
                initPlayground();
            }
        }
    } catch (e) {
        console.error(`Failed to load component ${componentName}:`, e);
    }
}

async function switchTab(tabId) {
    // Ensure tab content is loaded
    await loadTabContent(tabId);

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));
    
    // Show active tab
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
        tabEl.classList.add('active');
    }
    
    // Highlight button
    if (tabId === 'tabUsers') document.getElementById('btnTabUsers').classList.add('active');
    if (tabId === 'tabRequests') document.getElementById('btnTabRequests').classList.add('active');
    if (tabId === 'tabDrifts') document.getElementById('btnTabDrifts').classList.add('active');
    if (tabId === 'tabReports') document.getElementById('btnTabReports').classList.add('active');
    if (tabId === 'tabTester') document.getElementById('btnTabTester').classList.add('active');
    if (tabId === 'tabPlayground') document.getElementById('btnTabPlayground').classList.add('active');
    if (tabId === 'tabHealth') document.getElementById('btnTabHealth').classList.add('active');

    // Automatically stop webcams when switching tabs
    if (tabId !== 'tabTester') {
        stopTesterWebcam();
    } else {
        loadAntispoofConfig();
    }
    
    if (tabId !== 'tabPlayground') {
        stopPlaygroundWebcam();
    } else {
        loadPlaygroundAntispoofConfig();
    }
    
    // Manage system health monitoring polling
    if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
    }
    if (tabId === 'tabHealth') {
        loadSystemHealth();
        const autoRefreshEl = document.getElementById("healthAutoRefresh");
        if (!autoRefreshEl || autoRefreshEl.checked) {
            healthInterval = setInterval(loadSystemHealth, 3000);
        }
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
                <td colspan="5" style="text-align:center; padding: 2rem 0; color: var(--text-secondary);">
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
            <td>
                <div style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-secondary); font-size: 0.85rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;">
                        <path d="M4 22V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18"></path>
                        <line x1="9" y1="18" x2="9" y2="18.01"></line>
                        <line x1="15" y1="18" x2="15" y2="18.01"></line>
                        <line x1="9" y1="14" x2="9" y2="14.01"></line>
                        <line x1="15" y1="14" x2="15" y2="14.01"></line>
                        <line x1="9" y1="10" x2="9" y2="10.01"></line>
                        <line x1="15" y1="10" x2="15" y2="10.01"></line>
                        <line x1="9" y1="6" x2="9" y2="6.01"></line>
                        <line x1="15" y1="6" x2="15" y2="6.01"></line>
                    </svg>
                    ${user.department || "General"}
                </div>
            </td>
            <td>
                <span class="status-pill ${statusClass}" style="margin:0; font-size:0.75rem; padding: 0.25rem 0.6rem;">
                    ${statusLabel}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button onclick="openUploadModal('${user.id}', '${user.name.replace(/'/g, "\\'")}')" class="btn btn-outlined" style="font-size:0.75rem; padding: 0.35rem 0.65rem;">
                        Upload Face
                    </button>
                    <button onclick="deleteUser('${user.id}')" class="btn btn-outlined" style="font-size:0.75rem; padding: 0.35rem 0.65rem; border-color: rgba(211,47,47,0.3); color: var(--error);">
                        Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers() {
    const query = document.getElementById("userSearch").value.toLowerCase().trim();
    const status = document.getElementById("statusFilter").value;
    
    const filtered = allUsersList.filter(user => {
        const matchesQuery = user.name.toLowerCase().includes(query) || user.id.toLowerCase().includes(query);
        const matchesStatus = status ? user.face_status === status : true;
        return matchesQuery && matchesStatus;
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

// Fetch pending drift review queue
async function loadPendingDrifts() {
    try {
        const res = await fetch("/api/v1/admin/drift-requests");
        if (!res.ok) return;
        
        const driftRequests = await res.json();
        
        // Update badge
        const badge = document.getElementById("driftBadge");
        if (badge) {
            badge.innerText = driftRequests.length;
            badge.style.display = driftRequests.length > 0 ? "inline-flex" : "none";
        }
        
        renderDriftRequests(driftRequests);
        
    } catch(err) {
        console.error("Failed to load drift requests:", err);
    }
}

function renderDriftRequests(list) {
    const container = document.getElementById("driftsContainer");
    if (!container) return;
    container.innerHTML = "";
    
    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 3rem 0; color: var(--text-secondary);">
                No pending embedding drift updates to review.
            </div>
        `;
        return;
    }
    
    list.forEach(req => {
        const card = document.createElement("div");
        card.className = "request-card";
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1px solid var(--divider); padding-bottom: 0.75rem;">
                <div>
                    <h3 style="margin:0; font-family:'Outfit', sans-serif; font-size:1.1rem; color:var(--text-primary);">${req.name} (@${req.faculty_id})</h3>
                    <p style="margin:0.2rem 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Model Version: ${req.model_version} | Status: DRIFT REVIEW PENDING</p>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${parseUTCDateTime(req.created_at).toLocaleString()}</div>
            </div>
            
            <div style="font-size: 0.9rem; color:var(--text-primary); margin: 0.5rem 0;">
                <strong>Detection Info:</strong> Verification matched user but embedding started to drift. A new candidate vector has been captured.
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top: 1rem;">
                <button onclick="processDriftRequest(${req.id}, 'reject')" class="btn btn-outlined" style="border-color: rgba(211,47,47,0.3); color:var(--error);">
                    Reject & Discard
                </button>
                <button onclick="processDriftRequest(${req.id}, 'approve')" class="btn btn-contained" style="background-color: var(--success);">
                    Approve & Save Embedding
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function processDriftRequest(reqId, decision) {
    try {
        const res = await fetch(`/api/v1/admin/drift-requests/${reqId}/${decision}`, {
            method: "POST"
        });
        
        if (res.ok) {
            alert(`Drift embedding update successfully ${decision}d.`);
            loadPendingDrifts();
            loadAllUsers();
        } else {
            const err = await res.json();
            alert(`Operation failed: ${err.detail || "Error processing drift request"}`);
        }
    } catch(err) {
        alert("Operation failed: connection error.");
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
                <div style="font-size:0.8rem; color:var(--text-secondary);">${parseUTCDateTime(req.created_at).toLocaleString()}</div>
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

function openAddUserModal() {
    document.getElementById("addUserForm").reset();
    openModal("addUserModal");
}

function closeAddUserModal() {
    closeModal("addUserModal");
}

async function submitAddUser(event) {
    event.preventDefault();
    const userId = document.getElementById("newUserId").value.trim().toLowerCase();
    const name = document.getElementById("newUserName").value.trim();
    const email = document.getElementById("newUserEmail").value.trim() || null;
    const empId = document.getElementById("newUserEmpId").value.trim() || null;
    const department = document.getElementById("newUserDept").value.trim() || null;
    const role = document.getElementById("newUserRole").value;

    const payload = {
        id: userId,
        name: name,
        email: email,
        emp_id: empId,
        department: department,
        role: role
    };

    try {
        const res = await fetch("/api/v1/faculty", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert(`User profile for ${name} created successfully.`);
            closeAddUserModal();
            await loadAllUsers();
        } else {
            const err = await res.json();
            alert(`Failed to create user: ${err.detail || "Server error"}`);
        }
    } catch (err) {
        alert("Failed to create user: network error.");
    }
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

window.stepperAnimationInterval = null;

function startRunningStepperAnimation() {
    if (window.stepperAnimationInterval) {
        clearInterval(window.stepperAnimationInterval);
    }
    
    // Hide placeholder and show results block in "Running" state
    const placeholder = document.getElementById("testerResultPlaceholder");
    if (placeholder) placeholder.style.display = "none";
    
    const details = document.getElementById("testerResultDetails");
    if (details) details.style.display = "block";
    
    // Check if liveness is disabled
    const antispoofEnabled = document.getElementById("toggleAntispoofCheck") 
        ? document.getElementById("toggleAntispoofCheck").checked 
        : true;
    
    document.getElementById("testerResultUser").innerText = "Running analysis...";
    document.getElementById("testerResultAccuracy").innerText = "Calculating similarity...";
    document.getElementById("testerResultLiveness").innerText = antispoofEnabled ? "Scanning facial liveness..." : "Bypassed (Disabled)";
    document.getElementById("testerResultQuality").innerText = "Evaluating quality metrics...";
    document.getElementById("testerResultFeedback").innerText = "Running biometric pipeline execution...";
    
    const statusPill = document.getElementById("testerResultStatusPill");
    if (statusPill) {
        statusPill.innerText = "RUNNING";
        statusPill.style.backgroundColor = "var(--warning)";
        statusPill.style.color = "var(--surface)";
    }
    
    const stepperEl = document.getElementById("testerPipelineStepper");
    const stagesContainerEl = document.getElementById("testerStepperStagesContainer");
    const totalTimeEl = document.getElementById("testerPipelineTotalTime");
    
    if (stepperEl) stepperEl.style.display = "block";
    if (totalTimeEl) totalTimeEl.innerText = "Running...";
    if (stagesContainerEl) {
        stagesContainerEl.innerHTML = "";
    }
    
    const stageNames = [
        "Face Detection (SCRFD)",
        "Quality Gates & Pose",
        "Biometric Encoding (ArcFace)",
        "Anti-Spoofing (MiniFASNet)"
    ];
    
    let currentMockStage = 0;
    const maxMockStage = antispoofEnabled ? 3 : 2; // if disabled, only animate up to stage 2 (ArcFace)
    
    function updateStepperUI() {
        if (!stagesContainerEl) return;
        stagesContainerEl.innerHTML = "";
        stageNames.forEach((name, idx) => {
            const stageDiv = document.createElement("div");
            stageDiv.className = "stepper-stage";
            
            let iconHtml = "";
            let statusText = "";
            let detailsText = "";
            
            if (idx === 3 && !antispoofEnabled) {
                // Skipped (Liveness disabled)
                iconHtml = `<div class="stage-icon" style="background-color: #eee; color: #999;">—</div>`;
                statusText = "Skipped";
                detailsText = "Disabled by Admin.";
            } else if (idx < currentMockStage) {
                iconHtml = `<div class="stage-icon completed">✓</div>`;
                statusText = "Completed";
                detailsText = "Stage processed successfully.";
            } else if (idx === currentMockStage) {
                iconHtml = `<div class="stage-icon pending" style="animation: pulse 0.8s infinite alternate; background-color: var(--primary); color: white;">●</div>`;
                statusText = "Running...";
                detailsText = "Evaluating input frame features...";
            } else {
                iconHtml = `<div class="stage-icon" style="background-color: #eee; color: #999;">—</div>`;
                statusText = "Pending";
                detailsText = "Awaiting preceding stages.";
            }
            
            stageDiv.innerHTML = `
                ${iconHtml}
                <div class="stage-body">
                    <div class="stage-header">
                        <div>
                            <span class="stage-name" style="${idx === currentMockStage ? 'font-weight: 600; color: var(--primary);' : ''}">${name}</span>
                        </div>
                        <span class="stage-time" style="font-style: italic; font-size: 0.75rem; color: var(--text-secondary);">${statusText}</span>
                    </div>
                    <div class="stage-details">${detailsText}</div>
                </div>
            `;
            stagesContainerEl.appendChild(stageDiv);
        });
    }
    
    updateStepperUI();
    
    window.stepperAnimationInterval = setInterval(() => {
        if (currentMockStage < maxMockStage) {
            currentMockStage++;
            updateStepperUI();
        } else {
            clearInterval(window.stepperAnimationInterval);
            window.stepperAnimationInterval = null;
        }
    }, 250);
}

function displayTesterResult(data, startTime) {
    if (window.stepperAnimationInterval) {
        clearInterval(window.stepperAnimationInterval);
        window.stepperAnimationInterval = null;
    }

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
    
    // Render pipeline stepper
    const stepperEl = document.getElementById("testerPipelineStepper");
    const stagesContainerEl = document.getElementById("testerStepperStagesContainer");
    const totalTimeEl = document.getElementById("testerPipelineTotalTime");
    renderPipelineStepper(stepperEl, stagesContainerEl, totalTimeEl, data.pipeline_stages);

    // End-to-end client latency
    const clientTimeEl = document.getElementById("testerClientTotalTime");
    if (clientTimeEl && startTime) {
        const diff = performance.now() - startTime;
        clientTimeEl.innerText = `${diff.toFixed(1)} ms`;
    }
}

async function captureAndVerifyTester() {
    const videoEl = document.getElementById("testerWebcam");
    const status = document.getElementById("testerCamStatus");

    if (!videoEl || videoEl.readyState < 2) return;

    const antispoofEnabled = document.getElementById("toggleAntispoofCheck") 
        ? document.getElementById("toggleAntispoofCheck").checked 
        : true;

    status.innerText = antispoofEnabled 
        ? "Capturing multi-frame samples (Hold still)..."
        : "Capturing face sample...";
    startRunningStepperAnimation();
    const startTime = performance.now();

    try {
        const blobs = [];
        const frameCount = antispoofEnabled ? 5 : 1;
        
        for (let i = 0; i < frameCount; i++) {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = videoEl.videoWidth;
            tempCanvas.height = videoEl.videoHeight;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);
            const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, "image/jpeg", 0.95));
            if (blob) {
                blobs.push(blob);
            }
            if (i < frameCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        if (blobs.length === 0) {
            status.innerText = "Frame capture failed.";
            if (window.stepperAnimationInterval) {
                clearInterval(window.stepperAnimationInterval);
                window.stepperAnimationInterval = null;
            }
            return;
        }

        const formData = new FormData();
        formData.append("device_id", "Admin_Webcam_Tester");
        blobs.forEach((blob, idx) => {
            formData.append("files", blob, `tester_capture_${idx}.jpg`);
        });

        status.innerText = "Testing verification...";
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            displayTesterResult(data, startTime);
            status.innerText = `Scan completed successfully (Status: ${data.status}).`;
        } else {
            const err = await res.json();
            status.innerText = `Scan failed: ${err.detail || "Server error"}`;
            if (window.stepperAnimationInterval) {
                clearInterval(window.stepperAnimationInterval);
                window.stepperAnimationInterval = null;
            }
        }
    } catch (err) {
        status.innerText = "Scan failed: connection error.";
        if (window.stepperAnimationInterval) {
            clearInterval(window.stepperAnimationInterval);
            window.stepperAnimationInterval = null;
        }
    }
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

    startRunningStepperAnimation();
    const startTime = performance.now();

    try {
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            displayTesterResult(data, startTime);
        } else {
            const err = await res.json();
            alert(`File verification failed: ${err.detail || "Server error"}`);
            if (window.stepperAnimationInterval) {
                clearInterval(window.stepperAnimationInterval);
                window.stepperAnimationInterval = null;
            }
        }
    } catch (err) {
        alert("File verification failed: connection error.");
        if (window.stepperAnimationInterval) {
            clearInterval(window.stepperAnimationInterval);
            window.stepperAnimationInterval = null;
        }
    }
}

function renderPipelineStepper(stepperEl, stagesContainerEl, totalTimeEl, stages) {
    if (!stepperEl || !stagesContainerEl || !stages || stages.length === 0) {
        if (stepperEl) stepperEl.style.display = "none";
        return;
    }
    
    stepperEl.style.display = "block";
    stagesContainerEl.innerHTML = "";
    
    let totalTime = 0;
    stages.forEach(stage => {
        totalTime += stage.latency_ms;
    });
    if (totalTimeEl) {
        totalTimeEl.innerText = `${totalTime.toFixed(1)} ms`;
    }
    
    let cumulativeTime = 0;
    stages.forEach((stage, idx) => {
        cumulativeTime += stage.latency_ms;
        
        const stageDiv = document.createElement("div");
        stageDiv.className = "stepper-stage";
        
        let iconHtml = "";
        if (stage.status === "completed") {
            iconHtml = `<div class="stage-icon completed">✓</div>`;
        } else if (stage.status === "failed") {
            iconHtml = `<div class="stage-icon failed">✗</div>`;
        } else if (stage.status === "skipped") {
            iconHtml = `<div class="stage-icon" style="background-color: #eee; color: #999;">—</div>`;
        } else {
            iconHtml = `<div class="stage-icon pending">●</div>`;
        }
        
        const fallbackClass = stage.is_fallback ? "mock" : "actual";
        const fallbackText = stage.is_fallback ? "⚠️ Fallback (Mock)" : "Actual";
        
        let fallbackWarning = "";
        if (stage.is_fallback) {
            fallbackWarning = `<div style="color: #e65100; font-size: 0.65rem; font-weight: 500; margin-top: 2px; display: flex; align-items: center; gap: 0.2rem;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Warning: Mock fallback model active
            </div>`;
        }
        
        // Calculate transition time to the next stage if not the last stage
        let transitionHtml = "";
        if (idx < stages.length - 1) {
            transitionHtml = ` <span style="opacity: 0.5; margin-left: 0.5rem; font-size: 0.7rem;">(Next: +${stages[idx+1].latency_ms.toFixed(1)}ms)</span>`;
        }
        
        stageDiv.innerHTML = `
            ${iconHtml}
            <div class="stage-body">
                <div class="stage-header">
                    <div>
                        <span class="stage-name">${stage.name}</span>
                        <span class="stage-fallback-badge ${fallbackClass}">${fallbackText}</span>
                    </div>
                    <span class="stage-time">${stage.latency_ms.toFixed(1)} ms</span>
                </div>
                <div class="stage-details">
                    ${stage.details || ""}
                    ${fallbackWarning}
                    <span style="display: block; opacity: 0.6; font-size: 0.65rem; margin-top: 2px;">
                        Cumulative: ${cumulativeTime.toFixed(1)} ms${transitionHtml}
                    </span>
                </div>
            </div>
        `;
        stagesContainerEl.appendChild(stageDiv);
    });
}

async function toggleAntispoofSetting(enabled) {
    try {
        const res = await fetch("/api/v1/config/antispoof", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled })
        });
        if (res.ok) {
            const data = await res.json();
            console.log("Anti-spoofing configured to:", data.enabled);
        }
    } catch (err) {
        console.error("Failed to update anti-spoofing setting:", err);
    }
}

async function loadAntispoofConfig() {
    try {
        const res = await fetch("/api/v1/config/antispoof");
        if (res.ok) {
            const data = await res.json();
            const checkbox = document.getElementById("toggleAntispoofCheck");
            if (checkbox) {
                checkbox.checked = data.enabled;
            }
        }
    } catch (err) {
        console.error("Failed to load anti-spoofing config:", err);
    }
}

async function loadSystemHealth() {
    try {
        // 1. Fetch system metrics
        const metricsRes = await fetch("/api/v1/metrics/system");
        if (metricsRes.ok) {
            const data = await metricsRes.json();
            document.getElementById("healthCpu").innerText = `${data.cpu_usage_percent}%`;
            document.getElementById("healthMemory").innerText = `${data.memory_usage_percent}%`;
            document.getElementById("healthGpu").innerText = `${data.gpu_usage_percent}%`;
            document.getElementById("healthFmr").innerText = `${(data.far * 100).toFixed(2)}%`;
            document.getElementById("healthFnmr").innerText = `${(data.frr * 100).toFixed(2)}%`;
            document.getElementById("healthAvgSim").innerText = data.avg_similarity ? data.avg_similarity.toFixed(3) : "0.000";
        }
        
        // 2. Fetch basic health
        const healthRes = await fetch("/api/v1/health");
        if (healthRes.ok) {
            const health = await healthRes.json();
            
            // Detection Model
            const detEl = document.getElementById("healthDetStatus");
            detEl.className = "stage-fallback-badge actual";
            detEl.innerText = "Actual";
            document.getElementById("healthDetIcon").className = "stage-icon completed";
            document.getElementById("healthDetIcon").innerText = "✓";
            
            // Recognition Model
            const recEl = document.getElementById("healthRecStatus");
            if (health.recognition_model_loaded) {
                recEl.className = "stage-fallback-badge actual";
                recEl.innerText = "Actual";
                document.getElementById("healthRecIcon").className = "stage-icon completed";
                document.getElementById("healthRecIcon").innerText = "✓";
            } else {
                recEl.className = "stage-fallback-badge mock";
                recEl.innerText = "Mock (Fallback)";
                document.getElementById("healthRecIcon").className = "stage-icon pending";
                document.getElementById("healthRecIcon").innerText = "●";
            }
            
            // Liveness Model
            const liveEl = document.getElementById("healthLiveStatus");
            if (health.antispoof_model_loaded) {
                liveEl.className = "stage-fallback-badge actual";
                liveEl.innerText = "Actual";
                document.getElementById("healthLiveIcon").className = "stage-icon completed";
                document.getElementById("healthLiveIcon").innerText = "✓";
            } else {
                liveEl.className = "stage-fallback-badge mock";
                liveEl.innerText = "Mock (Fallback)";
                document.getElementById("healthLiveIcon").className = "stage-icon pending";
                document.getElementById("healthLiveIcon").innerText = "●";
            }
        }
    } catch (e) {
        console.error("Failed to load system health:", e);
    }
}

function toggleHealthAutoRefresh() {
    const checkbox = document.getElementById("healthAutoRefresh");
    if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
    }
    if (checkbox && checkbox.checked) {
        healthInterval = setInterval(loadSystemHealth, 3000);
    }
}

// ==========================================
// BIOMETRIC PLAYGROUND IMPLEMENTATION
// ==========================================

let playgroundStream = null;
let isPlaygroundLooping = false;
let playgroundFaceLandmarker = null;
let isPlaygroundDetecting = false;
let playgroundInferenceInterval = null;

function initPlayground() {
    console.log("Initializing playground tab...");
    const badgeText = document.getElementById("playgroundBadgeText");
    if (badgeText) badgeText.innerText = "CAMERA OFF";
    const badge = document.getElementById("playgroundPulsingBadge");
    if (badge) badge.style.backgroundColor = "rgba(255, 61, 0, 0.85)";
}

async function loadPlaygroundAntispoofConfig() {
    try {
        const res = await fetch("/api/v1/config/antispoof");
        if (res.ok) {
            const data = await res.json();
            const checkbox = document.getElementById("playgroundAntispoofToggle");
            if (checkbox) {
                checkbox.checked = data.enabled;
            }
        }
    } catch (err) {
        console.error("Failed to load playground anti-spoof config:", err);
    }
}

async function togglePlaygroundAntispoof() {
    const checkbox = document.getElementById("playgroundAntispoofToggle");
    if (!checkbox) return;
    
    try {
        const res = await fetch("/api/v1/config/antispoof", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ enabled: checkbox.checked })
        });
        if (res.ok) {
            console.log("Anti-spoof config updated to:", checkbox.checked);
        }
    } catch (err) {
        console.error("Failed to toggle anti-spoof config:", err);
    }
}

async function togglePlaygroundCam() {
    const btn = document.getElementById("btnStartPlaygroundCam");
    const badgeText = document.getElementById("playgroundBadgeText");
    const badge = document.getElementById("playgroundPulsingBadge");

    if (playgroundStream) {
        stopPlaygroundWebcam();
    } else {
        if (btn) btn.innerText = "Stop Live Loop";
        if (badgeText) badgeText.innerText = "STARTING CAMERA...";
        if (badge) badge.style.backgroundColor = "rgba(25, 118, 210, 0.85)";
        
        try {
            playgroundStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false
            });
            const videoEl = document.getElementById("playgroundWebcam");
            if (videoEl) {
                videoEl.srcObject = playgroundStream;
                videoEl.play();
            }

            const canvasEl = document.getElementById("playgroundOverlayCanvas");
            if (videoEl && canvasEl) {
                videoEl.onloadedmetadata = () => {
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                };
            }

            if (badgeText) badgeText.innerText = "ACTIVE SCANNING";
            if (badge) badge.style.backgroundColor = "rgba(76, 175, 80, 0.85)";

            // Load MediaPipe FaceLandmarker for guiding HUD overlays if not loaded
            if (!playgroundFaceLandmarker) {
                if (badgeText) badgeText.innerText = "LOADING HUD...";
                const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
                const { FaceLandmarker, FilesetResolver } = vision;
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                playgroundFaceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
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

            if (badgeText) badgeText.innerText = "LIVE SCANNING";
            isPlaygroundDetecting = true;
            requestAnimationFrame(playgroundDetectionLoop);

            // Start continuous background inference loop (every 500ms)
            isPlaygroundLooping = true;
            playgroundInferenceInterval = setInterval(runPlaygroundInference, 500);

        } catch (err) {
            console.error("Playground webcam start failed:", err);
            if (badgeText) badgeText.innerText = "CAMERA ERROR";
            if (badge) badge.style.backgroundColor = "rgba(244, 67, 54, 0.85)";
            stopPlaygroundWebcam();
        }
    }
}

function stopPlaygroundWebcam() {
    isPlaygroundDetecting = false;
    isPlaygroundLooping = false;
    
    if (playgroundInferenceInterval) {
        clearInterval(playgroundInferenceInterval);
        playgroundInferenceInterval = null;
    }

    const btn = document.getElementById("btnStartPlaygroundCam");
    if (btn) btn.innerText = "Start Live Loop";
    
    const badgeText = document.getElementById("playgroundBadgeText");
    if (badgeText) badgeText.innerText = "CAMERA OFF";
    const badge = document.getElementById("playgroundPulsingBadge");
    if (badge) badge.style.backgroundColor = "rgba(255, 61, 0, 0.85)";

    if (playgroundStream) {
        playgroundStream.getTracks().forEach(track => track.stop());
        playgroundStream = null;
    }
    const videoEl = document.getElementById("playgroundWebcam");
    if (videoEl) videoEl.srcObject = null;

    const canvasEl = document.getElementById("playgroundOverlayCanvas");
    if (canvasEl) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
}

function playgroundDetectionLoop() {
    if (!isPlaygroundDetecting || !playgroundFaceLandmarker) return;

    const videoEl = document.getElementById("playgroundWebcam");
    const canvasEl = document.getElementById("playgroundOverlayCanvas");

    if (videoEl && videoEl.readyState >= 2) {
        const ctxEl = canvasEl.getContext("2d");
        ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);

        const results = playgroundFaceLandmarker.detectForVideo(videoEl, performance.now());
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Draw a high-tech cornered face guide bounding box
            const landmarks = results.faceLandmarks[0];
            let minX = canvasEl.width, maxX = 0, minY = canvasEl.height, maxY = 0;
            
            landmarks.forEach(lm => {
                const x = lm.x * canvasEl.width;
                const y = lm.y * canvasEl.height;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            });

            // Add margin
            const w = maxX - minX;
            const h = maxY - minY;
            minX = Math.max(0, minX - w * 0.15);
            maxX = Math.min(canvasEl.width, maxX + w * 0.15);
            minY = Math.max(0, minY - h * 0.15);
            maxY = Math.min(canvasEl.height, maxY + h * 0.15);
            
            const boxW = maxX - minX;
            const boxH = maxY - minY;

            // Draw HUD target box
            ctxEl.strokeStyle = "#4CAF50";
            ctxEl.lineWidth = 2.5;
            ctxEl.setLineDash([]);
            
            // Draw bracket corners
            const len = Math.min(boxW, boxH) * 0.2;
            
            // Top Left
            ctxEl.beginPath();
            ctxEl.moveTo(minX, minY + len);
            ctxEl.lineTo(minX, minY);
            ctxEl.lineTo(minX + len, minY);
            ctxEl.stroke();

            // Top Right
            ctxEl.beginPath();
            ctxEl.moveTo(maxX, minY + len);
            ctxEl.lineTo(maxX, minY);
            ctxEl.lineTo(maxX - len, minY);
            ctxEl.stroke();

            // Bottom Left
            ctxEl.beginPath();
            ctxEl.moveTo(minX, maxY - len);
            ctxEl.lineTo(minX, maxY);
            ctxEl.lineTo(minX + len, maxY);
            ctxEl.stroke();

            // Bottom Right
            ctxEl.beginPath();
            ctxEl.moveTo(maxX, maxY - len);
            ctxEl.lineTo(maxX, maxY);
            ctxEl.lineTo(maxX - len, maxY);
            ctxEl.stroke();
        }
    }

    if (isPlaygroundDetecting) {
        requestAnimationFrame(playgroundDetectionLoop);
    }
}

async function runPlaygroundInference() {
    if (!isPlaygroundLooping) return;

    const videoEl = document.getElementById("playgroundWebcam");
    if (!videoEl || videoEl.readyState < 2) return;

    // Grab single frame using hidden canvas
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 640;
    tempCanvas.height = 480;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

    tempCanvas.toBlob(async (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append("device_id", "Playground_Continuous_Scanner");
        formData.append("file", blob, "frame.jpg");

        const startTime = performance.now();

        try {
            const res = await fetch("/api/v1/verify", {
                method: "POST",
                body: formData
            });

            const latency = (performance.now() - startTime).toFixed(1);
            const totalLatencyEl = document.getElementById("playgroundTotalLatency");
            if (totalLatencyEl) {
                totalLatencyEl.innerText = `Total: ${latency} ms`;
            }

            if (res.ok) {
                const data = await res.json();
                updatePlaygroundUI(data);
            } else {
                const err = await res.json();
                console.warn("Playground verification failed:", err);
            }
        } catch (err) {
            console.error("Playground fetch connection error:", err);
        }
    }, "image/jpeg", 0.85);
}

function updatePlaygroundUI(data) {
    const resultCard = document.getElementById("playgroundResultCard");
    const livenessVal = document.getElementById("playgroundLivenessVal");
    const livenessBar = document.getElementById("playgroundLivenessBar");
    const similarityVal = document.getElementById("playgroundSimilarityVal");
    const similarityBar = document.getElementById("playgroundSimilarityBar");
    const qualityVal = document.getElementById("playgroundQualityVal");
    const qualityBar = document.getElementById("playgroundQualityBar");
    const stagesContainer = document.getElementById("playgroundStagesContainer");

    if (!resultCard) return;

    // 1. Update Decision / Result Card
    let cardHTML = "";
    let statusBg = "var(--surface)";
    let borderCol = "var(--border-color)";

    if (data.status === "CONFIRMED" && data.match_found && data.candidate) {
        statusBg = "rgba(76, 175, 80, 0.08)";
        borderCol = "rgba(76, 175, 80, 0.3)";
        const initials = data.candidate.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        cardHTML = `
            <div style="display: flex; align-items: center; gap: 1.25rem; width: 100%;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem; font-family: 'Outfit', sans-serif;">
                    ${initials}
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-weight: 700; font-size: 1.15rem; color: var(--success); display: flex; align-items: center; gap: 0.5rem;">
                        VERIFIED: ${data.candidate.name}
                        <span style="font-size: 0.75rem; background: var(--success); color: white; padding: 0.15rem 0.4rem; border-radius: 4px;">LIVE</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Faculty ID: <strong>${data.candidate.faculty_id}</strong></div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Similarity: <strong>${(data.candidate.similarity_score * 100).toFixed(2)}%</strong></div>
                </div>
            </div>
        `;
    } else if (data.status === "REJECTED" && data.liveness_score < 0.40) {
        statusBg = "rgba(244, 67, 54, 0.08)";
        borderCol = "rgba(244, 67, 54, 0.3)";
        cardHTML = `
            <div style="display: flex; align-items: center; gap: 1.25rem; width: 100%;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background-color: var(--error); color: white; display: flex; align-items: center; justify-content: center;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-weight: 700; font-size: 1.2rem; color: var(--error);">
                        SPOOF DETECTED (REJECTED)
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Anti-spoofing algorithm flagged this profile as spoof/replay.</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Liveness Probability: <strong>${(data.liveness_score * 100).toFixed(2)}%</strong> (Threshold: 40%)</div>
                </div>
            </div>
        `;
    } else if (data.status === "MANUAL_REVIEW") {
        statusBg = "rgba(255, 152, 0, 0.08)";
        borderCol = "rgba(255, 152, 0, 0.3)";
        cardHTML = `
            <div style="display: flex; align-items: center; gap: 1.25rem; width: 100%;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background-color: var(--warning); color: white; display: flex; align-items: center; justify-content: center;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-weight: 700; font-size: 1.15rem; color: var(--warning);">
                        MANUAL REVIEW REQUIRED
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Biometric ambiguity or borderline liveness score.</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Match: <strong>${data.candidate ? data.candidate.name : "Unknown"}</strong></div>
                </div>
            </div>
        `;
    } else {
        statusBg = "rgba(0, 0, 0, 0.03)";
        borderCol = "rgba(0, 0, 0, 0.12)";
        cardHTML = `
            <div style="display: flex; align-items: center; gap: 1.25rem; width: 100%;">
                <div style="width: 56px; height: 56px; border-radius: 50%; background-color: #757575; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                    ?
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-secondary);">
                        UNKNOWN VISITOR (NO MATCH)
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Liveness test passed, but no matching identity was found.</div>
                </div>
            </div>
        `;
    }

    resultCard.style.backgroundColor = statusBg;
    resultCard.style.borderColor = borderCol;
    resultCard.innerHTML = cardHTML;

    // 2. Update Gauges
    if (livenessVal && livenessBar) {
        const livePct = (data.liveness_score * 100).toFixed(2);
        livenessVal.innerText = `${livePct}%`;
        livenessBar.style.width = `${livePct}%`;
        livenessBar.style.backgroundColor = data.liveness_score >= 0.40 ? "var(--success)" : "var(--error)";
    }

    if (similarityVal && similarityBar) {
        const simScore = data.candidate ? data.candidate.similarity_score : 0;
        const simPct = (simScore * 100).toFixed(2);
        similarityVal.innerText = `${simPct}%`;
        similarityBar.style.width = `${simPct}%`;
    }

    if (qualityVal && qualityBar) {
        const qualVal = data.quality_score || 0;
        qualityVal.innerText = qualVal.toFixed(3);
        qualityBar.style.width = `${Math.min(100, qualVal * 100)}%`;
    }

    // 3. Update Live Telemetry Stages
    if (stagesContainer && data.pipeline_stages && data.pipeline_stages.length > 0) {
        stagesContainer.innerHTML = "";
        data.pipeline_stages.forEach(stage => {
            const stageDiv = document.createElement("div");
            stageDiv.style.display = "flex";
            stageDiv.style.justifyContent = "space-between";
            stageDiv.style.alignItems = "center";
            stageDiv.style.fontSize = "0.8rem";
            stageDiv.style.padding = "0.35rem 0.65rem";
            stageDiv.style.background = "rgba(0,0,0,0.02)";
            stageDiv.style.borderRadius = "4px";
            stageDiv.style.border = "1px solid var(--border-color)";

            const leftSide = document.createElement("div");
            leftSide.style.display = "flex";
            leftSide.style.alignItems = "center";
            leftSide.style.gap = "0.5rem";

            const isDone = stage.status === "completed" || stage.status === "passed";
            const iconColor = isDone ? "var(--success)" : "var(--text-secondary)";
            const iconText = isDone ? "✓" : "○";

            leftSide.innerHTML = `
                <span style="font-weight:700; color:${iconColor};">${iconText}</span>
                <span style="font-weight:600; color:var(--text-primary);">${stage.name}</span>
            `;

            const rightSide = document.createElement("div");
            rightSide.style.fontFamily = "'JetBrains Mono', monospace";
            rightSide.style.color = "var(--text-secondary)";
            rightSide.innerText = stage.latency_ms !== null ? `${stage.latency_ms.toFixed(1)} ms` : "N/A";

            stageDiv.appendChild(leftSide);
            stageDiv.appendChild(rightSide);
            stagesContainer.appendChild(stageDiv);
        });
    }
}

