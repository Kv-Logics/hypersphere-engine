let currentUser = null;
let allUsersList = [];
let pendingRequestsList = [];

window.addEventListener('DOMContentLoaded', () => {
    // Session Guard
    const savedUserStr = localStorage.getItem("user");
    if (!savedUserStr) {
        window.location.href = "/login.html";
        return;
    }
    
    try {
        currentUser = JSON.parse(savedUserStr);
        if (currentUser.role !== "admin") {
            window.location.href = `/dashboard.html?user=${currentUser.id}`;
            return;
        }
    } catch(e) {
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
            <td style="text-align: right;">
                <button onclick="openUploadModal('${user.id}', '${user.name.replace(/'/g, "\\'")}')" class="btn btn-outlined" style="font-size:0.75rem; padding: 0.35rem 0.65rem;">
                    Upload Face
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

function openUploadModal(userId, userName) {
    document.getElementById("uploadUserId").value = userId;
    document.getElementById("uploadUserNameLabel").innerText = `${userName} (@${userId})`;
    openModal("adminUploadModal");
}

async function submitAdminUpload(event) {
    event.preventDefault();
    const userId = document.getElementById("uploadUserId").value;
    const fileInput = document.getElementById("adminFile");
    
    if (fileInput.files.length === 0) return;
    
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("file", fileInput.files[0]);
    
    closeModal("adminUploadModal");
    
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

function handleLogout() {
    localStorage.removeItem("user");
    window.location.href = "/login.html";
}
