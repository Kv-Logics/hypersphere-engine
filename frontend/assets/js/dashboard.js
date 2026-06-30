let activeUser = null;
let stream = null;
let faceLandmarker = null;
let isDetecting = false;
let lastDetectionTime = 0;
const DETECTION_INTERVAL = 1000; // Throttled verification calls: 1 second
let attendanceMarked = false;

// MediaPipe variables
const video = document.getElementById("webcam");
const canvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

// DOM elements
const statusLog = document.getElementById("statusLog");

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification via backend cookie
    try {
        const res = await fetch("/api/v1/auth/me");
        if (res.ok) {
            activeUser = await res.json();
            localStorage.setItem("user", JSON.stringify(activeUser));
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
    
    loadUserProfile();
});

async function loadUserProfile() {
    try {
        const res = await fetch("/api/v1/auth/me");
        if (!res.ok) {
            localStorage.removeItem("user");
            window.location.href = "/login.html";
            return;
        }
        
        const user = await res.json();
        activeUser = user;
        localStorage.setItem("user", JSON.stringify(user)); // Sync session
        
        // Update UI Info
        document.getElementById("profileName").innerText = user.name;
        document.getElementById("profileUsername").innerText = `@${user.id}`;
        document.getElementById("profileDept").innerText = user.department || "General / Faculty";
        document.getElementById("profileDesignation").innerText = (user.designation || "Faculty").toUpperCase();
        document.getElementById("profileEmail").innerText = user.email || `${user.id}@nitt.edu`;
        
        // Avatar Initials
        const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById("profileAvatar").innerText = initials;
        
        // Update status badge
        const badge = document.getElementById("faceStatusBadge");
        const desc = document.getElementById("faceStatusDescription");
        const regBtn = document.getElementById("registerFaceBtn");
        const pendingLock = document.getElementById("pendingLockOverlay");
        
        badge.className = "status-pill";
        regBtn.style.display = "none";
        pendingLock.style.display = "none";
        
        if (user.face_status === "none") {
            badge.classList.add("status-none");
            badge.innerText = "No Face Registered";
            desc.innerText = "You must register your face using a webcam to activate biometric verification.";
            regBtn.style.display = "inline-flex";
            statusLog.innerText = "Please click 'Register My Face' to configure your profile.";
        } else if (user.face_status === "pending_review") {
            badge.classList.add("status-pending");
            badge.innerText = "Awaiting Approval";
            desc.innerText = "Your photo update request is pending approval by the CDI Administrator.";
            pendingLock.style.display = "flex";
            statusLog.innerText = "Camera locked: request is pending review.";
            stopWebcam();
        } else {
            // registered or approved
            badge.classList.add("status-registered");
            badge.innerText = "Active Biometrics";
            desc.innerText = "Your biometric profile is active. Look at the camera to log daily attendance.";
            
            // Auto start webcam for attendance scanning
            if (!attendanceMarked) {
                initWebcamAndScan();
            }
        }
        
        // Fetch logs
        fetchAttendanceHistory(user.id);
        
    } catch(err) {
        console.error("Profile load failed:", err);
        statusLog.innerText = "Failed to sync profile: " + err.message;
    }
}

async function fetchAttendanceHistory(username) {
    try {
        const res = await fetch(`/api/v1/attendance?user_id=${username}`);
        if (!res.ok) return;
        
        const list = await res.json();
        const tbody = document.getElementById("attendanceHistory");
        
        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem 0;">
                        No past attendance logs found.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = "";
        list.forEach(item => {
            const dt = new Date(item.timestamp);
            const dateStr = dt.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
            const timeStr = dt.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'});
            
            const isConfirmed = item.status === "CONFIRMED";
            const matchPercent = item.similarity_score ? Math.round(item.similarity_score * 100) + "%" : "—";
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight:600;">${dateStr}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">${timeStr}</div>
                </td>
                <td style="text-align: center;">
                    <span class="status-indicator ${isConfirmed ? 'indicator-confirmed' : 'indicator-rejected'}">
                        ${isConfirmed ? '✓' : '✗'}
                    </span>
                </td>
                <td style="text-align: right; font-family:'JetBrains Mono', monospace; font-weight:500;">
                    ${matchPercent}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch(err) {
        console.error("Failed to load logs:", err);
    }
}

// Modal management
function openModal(id) {
    document.getElementById(id).style.display = "flex";
}

// Modal closing
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

async function submitFaceRequest(type, event) {
    event.preventDefault();
    if (!activeUser) return;
    
    const formData = new FormData();
    formData.append("user_id", activeUser.id);
    formData.append("request_type", type);
    
    if (type === 'update') {
        const fileInput = document.getElementById("updateFile");
        const msgInput = document.getElementById("updateMessage");
        if (fileInput.files.length === 0) return;
        
        formData.append("file", fileInput.files[0]);
        formData.append("message", msgInput.value.trim());
        closeModal("photoModal");
    } else {
        const msgInput = document.getElementById("issueMessage");
        formData.append("message", msgInput.value.trim());
        closeModal("issueModal");
    }
    
    statusLog.innerText = "Submitting request...";
    
    try {
        const res = await fetch("/api/v1/face-requests", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            statusLog.innerText = "Request submitted successfully.";
            // Reload user details
            loadUserProfile();
        } else {
            const err = await res.json();
            alert(`Submission failed: ${err.detail || "Server error"}`);
        }
    } catch (err) {
        alert("Submission failed: connection error.");
    }
}

// Camera integration
async function initWebcamAndScan() {
    if (attendanceMarked) return;
    
    statusLog.innerText = "Starting camera...";
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
            audio: false
        });
        video.srcObject = stream;
        video.play();
        
        document.getElementById("livePulse").style.display = "inline-flex";
        
        // Initialize MediaPipe FaceLandmarker via dynamic import
        if (!faceLandmarker) {
            statusLog.innerText = "Loading MediaPipe Face Mesh...";
            const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
            const { FaceLandmarker, FilesetResolver } = vision;
            
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );
            
            faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
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
        
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        };
        
        statusLog.innerText = "Position your face in front of the camera...";
        isDetecting = true;
        requestAnimationFrame(detectionLoop);
        
    } catch(err) {
        console.error("Camera startup failed:", err);
        statusLog.innerText = "Webcam error: " + err.message;
    }
}

function stopWebcam() {
    isDetecting = false;
    document.getElementById("livePulse").style.display = "none";
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Self registration flow
async function startSelfRegistration() {
    if (attendanceMarked) return;
    
    statusLog.innerText = "Initializing camera for registration...";
    await initWebcamAndScan();
    
    // Change detection mode slightly or instruct user
    statusLog.innerText = "Hold still to capture your face...";
}

async function detectionLoop() {
    if (!isDetecting || !faceLandmarker) return;
    
    // Ready state check (>= 2 means frame buffer is ready)
    if (video.readyState >= 2) {
        const timestamp = performance.now();
        const results = faceLandmarker.detectForVideo(video, timestamp);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Draw neon green corners and landmarks
            drawFaceResults(results.faceLandmarks[0]);
            
            // Check if we are ready to send verification request (throttled)
            if (timestamp - lastDetectionTime > DETECTION_INTERVAL) {
                lastDetectionTime = timestamp;
                
                if (activeUser.face_status === "none") {
                    // Registration Mode
                    registerCapture();
                } else {
                    // Attendance Verification Mode
                    verifyAttendanceCapture();
                }
            }
        } else {
            statusLog.innerText = "No face detected. Adjust your position.";
        }
    }
    
    if (isDetecting) {
        requestAnimationFrame(detectionLoop);
    }
}

function drawFaceResults(landmarks) {
    const width = canvas.width;
    const height = canvas.height;
    
    // Calculate bounding box bounds
    let minX = width, maxX = 0, minY = height, maxY = 0;
    landmarks.forEach(lm => {
        const x = lm.x * width;
        const y = lm.y * height;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    
    // Add margin
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    minX = Math.max(0, minX - boxW * 0.15);
    maxX = Math.min(width, maxX + boxW * 0.15);
    minY = Math.max(0, minY - boxH * 0.2);
    maxY = Math.min(height, maxY + boxH * 0.1);
    
    const finalW = maxX - minX;
    const finalH = maxY - minY;
    
    // Draw box corners (Neon green)
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 3;
    const len = Math.min(finalW, finalH) * 0.2;
    
    // Top Left corner
    ctx.beginPath();
    ctx.moveTo(minX, minY + len);
    ctx.lineTo(minX, minY);
    ctx.lineTo(minX + len, minY);
    ctx.stroke();
    
    // Top Right corner
    ctx.beginPath();
    ctx.moveTo(maxX - len, minY);
    ctx.lineTo(maxX, minY);
    ctx.lineTo(maxX, minY + len);
    ctx.stroke();
    
    // Bottom Left corner
    ctx.beginPath();
    ctx.moveTo(minX, minY + finalH - len);
    ctx.lineTo(minX, minY + finalH);
    ctx.lineTo(minX + len, minY + finalH);
    ctx.stroke();
    
    // Bottom Right corner
    ctx.beginPath();
    ctx.moveTo(maxX - len, minY + finalH);
    ctx.lineTo(maxX, minY + finalH);
    ctx.lineTo(maxX, minY + finalH - len);
    ctx.stroke();
    
    // Draw key facial landmarks (dots)
    ctx.fillStyle = "rgba(0, 176, 255, 0.7)";
    const keyIndices = [33, 263, 1, 61, 291, 199]; // Eyes, nose, mouth corners, chin
    keyIndices.forEach(idx => {
        const pt = landmarks[idx];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
}

async function captureFrameBlob() {
    return new Promise((resolve, reject) => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext("2d");
        
        // Draw frame
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Get blob
        tempCanvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("Blob generation failed"));
        }, "image/jpeg", 0.95);
    });
}

async function registerCapture() {
    statusLog.innerText = "Capturing face for registration...";
    try {
        const blob = await captureFrameBlob();
        const formData = new FormData();
        formData.append("faculty_id", activeUser.id);
        formData.append("name", activeUser.name);
        formData.append("file", blob, "registration.jpg");
        
        const res = await fetch("/api/v1/register", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            statusLog.innerText = "Biometrics successfully registered!";
            stopWebcam();
            attendanceMarked = true;
            
            // Reload user state
            setTimeout(() => {
                loadUserProfile();
            }, 1500);
        } else {
            const err = await res.json();
            statusLog.innerText = `Registration failed: ${err.detail || "Try again"}`;
        }
    } catch(err) {
        statusLog.innerText = "Error: " + err.message;
    }
}

async function verifyAttendanceCapture() {
    statusLog.innerText = "Capturing multi-frame samples (Hold still)...";
    try {
        const blobs = [];
        for (let i = 0; i < 5; i++) {
            const blob = await captureFrameBlob();
            blobs.push(blob);
            // Wait 200ms between frames to capture variation
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        statusLog.innerText = "Analyzing liveness & biometric matches...";
        const formData = new FormData();
        formData.append("device_id", "Webcam_Dashboard");
        blobs.forEach((blob, idx) => {
            formData.append("files", blob, `verify_${idx}.jpg`);
        });
        
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            
            // Match verify decision
            if (data.status === "CONFIRMED" && data.candidate && data.candidate.faculty_id === activeUser.id) {
                statusLog.innerText = "Verification Confirmed!";
                attendanceMarked = true;
                
                // Show giant green check overlay
                const successOverlay = document.getElementById("attendanceSuccessOverlay");
                successOverlay.style.display = "flex";
                
                // Stop webcam
                stopWebcam();
                
                // Refresh attendance logs
                fetchAttendanceHistory(activeUser.id);
                
                // Hide overlay after 4 seconds
                setTimeout(() => {
                    successOverlay.style.display = "none";
                }, 4000);
            } else if (data.status === "MANUAL_REVIEW" && data.candidate && data.candidate.faculty_id === activeUser.id) {
                statusLog.innerText = "Check-in logged (Flagged for Manual Review).";
                attendanceMarked = true;
                stopWebcam();
                fetchAttendanceHistory(activeUser.id);
            } else {
                statusLog.innerText = "Face mismatch or liveness rejected. Retrying...";
            }
        } else {
            const err = await res.json();
            statusLog.innerText = `Verification failed: ${err.detail || "Server error"}`;
        }
    } catch(err) {
        statusLog.innerText = "Error: " + err.message;
    }
}

async function handleLogout() {
    try {
        await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("user");
    window.location.href = "/login.html";
}
