let stream = null;
const video = document.getElementById("webcamVideo");
const canvas = document.getElementById("webcamCanvas");
const ctx = canvas.getContext("2d");
const laser = document.getElementById("laserLine");
const placeholder = document.getElementById("placeholder");
const startBtn = document.getElementById("startCamBtn");
const stopBtn = document.getElementById("stopCamBtn");
const videoWrapper = document.getElementById("videoWrapper");
const livePulse = document.getElementById("livePulse");

const terminal = document.getElementById("terminal");
const facultyList = document.getElementById("facultyList");
const resultsBox = document.getElementById("resultsBox");

let faceLandmarker = null;
let isDetecting = false;
let lastDetectionTime = 0;

// Global browser error logger to print errors directly to the UI Event Log terminal
window.onerror = function(message, source, lineno, colno, error) {
    const fileName = source ? source.split('/').pop() : 'unknown';
    addLog(`JS ERROR: ${message} (in ${fileName}:${lineno})`, "error");
    return false;
};

function addLog(text, type = "info") {
    const time = new Date().toLocaleTimeString();
    const logLine = document.createElement("div");
    logLine.className = "log-line";
    
    if (type === "error") {
        logLine.className += " log-fail";
    } else if (type === "success") {
        logLine.className += " log-success";
    } else {
        logLine.className += " log-info";
    }
    
    logLine.innerHTML = `[<span class="log-time">${time}</span>] ${text}`;
    terminal.appendChild(logLine);
    terminal.scrollTop = terminal.scrollHeight;
}

// Draw face landmarks and bounding box from FaceLandmarker results
function drawFaceResults(landmarks) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!landmarks || landmarks.length === 0) return;
    
    landmarks.forEach(faceLandmarks => {
        // Calculate bounding box from landmark positions
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        faceLandmarks.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        });
        
        // Add padding around face
        const padX = (maxX - minX) * 0.15;
        const padY = (maxY - minY) * 0.15;
        minX = Math.max(0, minX - padX);
        minY = Math.max(0, minY - padY);
        maxX = Math.min(1, maxX + padX);
        maxY = Math.min(1, maxY + padY);
        
        const bx = minX * canvas.width;
        const by = minY * canvas.height;
        const bw = (maxX - minX) * canvas.width;
        const bh = (maxY - minY) * canvas.height;
        
        // Draw neon green bounding box
        ctx.strokeStyle = "#00e676";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bw, bh);
        
        // Draw corner brackets for a high-tech look
        const bracketLen = Math.min(bw, bh) * 0.15;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00e676";
        
        // Top-left
        ctx.beginPath(); ctx.moveTo(bx, by + bracketLen); ctx.lineTo(bx, by); ctx.lineTo(bx + bracketLen, by); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(bx + bw - bracketLen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bracketLen); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(bx, by + bh - bracketLen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + bracketLen, by + bh); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(bx + bw - bracketLen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - bracketLen); ctx.stroke();
        
        // Draw facial landmark dots (key points only: eyes, nose, mouth, jawline)
        // MediaPipe Face Mesh key indices
        const keyIndices = [
            // Left eye contour
            33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
            // Right eye contour
            362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
            // Lips outer
            61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185,
            // Nose bridge & tip
            168, 6, 197, 195, 5, 4, 1, 19,
            // Jawline
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ];
        
        ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
        keyIndices.forEach(i => {
            if (i < faceLandmarks.length) {
                const pt = faceLandmarks[i];
                ctx.beginPath();
                ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    });
}

async function detectionLoop(timestamp) {
    if (!stream || !stream.active) {
        isDetecting = false;
        return;
    }
    isDetecting = true;
    
    // Throttle to ~15 FPS for smooth tracking without overloading
    if (timestamp - lastDetectionTime >= 66) {
        lastDetectionTime = timestamp;
        try {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                const results = faceLandmarker.detectForVideo(video, timestamp);
                drawFaceResults(results.faceLandmarks);
            }
        } catch (err) {
            addLog("Face detection loop error: " + err.message, "error");
            isDetecting = false;
            return;
        }
    }
    
    if (stream && stream.active && isDetecting) {
        requestAnimationFrame(detectionLoop);
    }
}

async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: "user" } 
        });
        video.srcObject = stream;
        video.style.display = "block";
        canvas.style.display = "block";
        placeholder.style.display = "none";
        laser.style.display = "block";
        livePulse.style.display = "inline-flex";
        startBtn.style.display = "none";
        stopBtn.style.display = "inline-flex";
        addLog("Webcam video stream started.");
        
        // Initialize MediaPipe FaceLandmarker (Vision Tasks API) via dynamic import
        if (!faceLandmarker) {
            try {
                addLog("Loading MediaPipe Face Mesh model...");
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
                
                addLog("MediaPipe Face Mesh initialized successfully.");
            } catch (initErr) {
                addLog(`ERROR: Failed to initialize Face Mesh: ${initErr.message}`, "error");
                return;
            }
        }
        
        // Set canvas coordinates when stream metadata loads
        if (video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        } else {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            };
        }
        
        // Continuous frame pipeline
        if (!isDetecting) {
            requestAnimationFrame(detectionLoop);
        }
    } catch (err) {
        addLog("Could not start webcam: " + err.message, "error");
    }
}

function stopWebcam() {
    if (typeof isLiveDemoActive !== 'undefined' && isLiveDemoActive) {
        toggleLiveDemo();
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.style.display = "none";
    canvas.style.display = "none";
    placeholder.style.display = "block";
    laser.style.display = "none";
    livePulse.style.display = "none";
    startBtn.style.display = "inline-flex";
    stopBtn.style.display = "none";
    
    // Clear overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isDetecting = false;
    
    addLog("Webcam video stream terminated.");
}

function captureFrameBlob() {
    if (!stream || video.readyState < 2) {
        throw new Error("Webcam feed is not active or ready. Please wait a moment.");
    }
    
    videoWrapper.classList.remove("capture-flash");
    void videoWrapper.offsetWidth; // Trigger reflow
    videoWrapper.classList.add("capture-flash");
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, "image/jpeg", 0.95);
    });
}

async function loadFaculty() {
    try {
        const res = await fetch("/api/v1/faculty");
        const data = await res.json();
        
        if (data.length === 0) {
            facultyList.innerHTML = `<div class="empty-list">No profiles enrolled.</div>`;
            return;
        }
        
        facultyList.innerHTML = "";
        data.forEach(item => {
            const initials = item.name ? item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
            const badge = document.createElement("div");
            badge.className = "faculty-badge";
            badge.innerHTML = `
                <div class="faculty-avatar">${initials}</div>
                <div class="faculty-details" style="flex: 1;">
                    <div class="faculty-name">${item.name}</div>
                    <div class="faculty-id">${item.id}</div>
                </div>
                <button class="delete-profile-btn" onclick="deleteFaculty('${item.id}', event)" title="Delete Profile">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            `;
            facultyList.appendChild(badge);
        });
    } catch(err) {
        addLog("Failed to fetch profiles from database.", "error");
    }
}

async function deleteFaculty(facultyId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    if (!confirm(`Are you sure you want to delete profile '${facultyId}'? This will remove their profile and face embedding.`)) {
        return;
    }
    
    addLog(`Deleting Profile '${facultyId}'...`);
    
    try {
        const res = await fetch(`/api/v1/faculty/${facultyId}`, {
            method: "DELETE"
        });
        
        if (res.ok) {
            addLog(`SUCCESS: Deleted profile '${facultyId}'`, "success");
            loadFaculty();
        } else {
            const err = await res.json();
            addLog(`ERROR: ${err.detail || "Deletion failed"}`, "error");
        }
    } catch (err) {
        addLog(`Error: ${err.message}`, "error");
    }
}

// Initial load
loadFaculty();

async function registerFaculty() {
    const regId = document.getElementById("regId").value.trim();
    const regName = document.getElementById("regName").value.trim();
    const fileInput = document.getElementById("regFile");
    
    if (!regId || !regName) {
        addLog("Please enter both ID and Name to enroll.", "error");
        return;
    }

    addLog(`Enrolling Profile '${regId}' (Name: ${regName})...`);
    
    try {
        let imageBlob = null;
        let filename = "capture.jpg";
        
        if (fileInput.files.length > 0) {
            imageBlob = fileInput.files[0];
            filename = imageBlob.name;
            addLog("Using uploaded local image file...");
        } else {
            imageBlob = await captureFrameBlob();
            addLog("Using live webcam capture...");
        }
        
        const formData = new FormData();
        formData.append("faculty_id", regId);
        formData.append("name", regName);
        formData.append("file", imageBlob, filename);
        
        const res = await fetch("/api/v1/register", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            addLog(`SUCCESS: Enrolled ${data.name} (${data.id})`, "success");
            document.getElementById("regId").value = "";
            document.getElementById("regName").value = "";
            fileInput.value = "";
            loadFaculty();
        } else {
            const err = await res.json();
            addLog(`ERROR: ${err.detail || "Enrollment failed"}`, "error");
        }
    } catch (err) {
        addLog(`Error: ${err.message}`, "error");
    }
}

async function verifyPresentation(silent = false) {
    const deviceIdEl = document.getElementById("verDevice");
    const deviceId = deviceIdEl ? deviceIdEl.value.trim() : "Authentication_Node_01";
    if (!silent) {
        addLog("Processing live verification capture...");
    }
    
    try {
        const imageBlob = await captureFrameBlob();
        
        const formData = new FormData();
        formData.append("device_id", deviceId);
        formData.append("file", imageBlob, "capture.jpg");
        
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            displayVerificationResult(data, silent);
        } else {
            const err = await res.json();
            if (!silent) {
                addLog(`ERROR: ${err.detail || "Verification failed"}`, "error");
            }
        }
    } catch (err) {
        if (!silent) {
            addLog(`Error: ${err.message}`, "error");
        }
    }
}

async function verifyUploadedImage() {
    const fileInput = document.getElementById("verFile");
    if (fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    addLog(`Processing uploaded verification file: ${file.name}...`);
    
    const deviceIdEl = document.getElementById("verDevice");
    const deviceId = deviceIdEl ? deviceIdEl.value.trim() : "Authentication_Node_01";
    
    try {
        const formData = new FormData();
        formData.append("device_id", deviceId);
        formData.append("file", file, file.name);
        
        const res = await fetch("/api/v1/verify", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            displayVerificationResult(data, false);
            fileInput.value = ""; // clear file input
        } else {
            const err = await res.json();
            addLog(`ERROR: ${err.detail || "Verification failed"}`, "error");
        }
    } catch (err) {
        addLog(`Error: ${err.message}`, "error");
    }
}

function displayVerificationResult(data, silent = false) {
    resultsBox.style.display = "block";
    const resStatus = document.getElementById("resStatus");
    const resName = document.getElementById("resName");
    const resLiveness = document.getElementById("resLiveness");
    const resSimilarity = document.getElementById("resSimilarity");
    const resQuality = document.getElementById("resQuality");
    const resFeedbackRow = document.getElementById("resFeedbackRow");
    const resFeedback = document.getElementById("resFeedback");
    const resAvatar = document.getElementById("resAvatar");
    
    const livenessPercent = Math.round(data.liveness_score * 100);
    const qualityPercent = Math.round(data.quality_score * 100);
    
    resLiveness.innerText = `${livenessPercent}%`;
    resQuality.innerText = `${qualityPercent}%`;
    
    const livFill = document.getElementById("livenessProgress");
    const qualFill = document.getElementById("qualityProgress");
    const simFill = document.getElementById("similarityProgress");
    
    livFill.style.width = `${livenessPercent}%`;
    qualFill.style.width = `${qualityPercent}%`;
    
    livFill.style.backgroundColor = data.liveness_score >= 0.40 ? "var(--success)" : "var(--error)";
    qualFill.style.backgroundColor = data.quality_score >= 0.35 ? "var(--success)" : "var(--error)";
    
    let similarityPercent = 0;
    if (data.candidate && data.candidate.similarity_score !== undefined) {
        similarityPercent = Math.round(data.candidate.similarity_score * 100);
        resSimilarity.innerText = `${similarityPercent}%`;
        simFill.style.width = `${similarityPercent}%`;
        simFill.style.backgroundColor = data.candidate.similarity_score >= settings_match_threshold_percent() ? "var(--success)" : "var(--error)";
    } else {
        resSimilarity.innerText = "0%";
        simFill.style.width = "0%";
        simFill.style.backgroundColor = "var(--error)";
    }
    
    if (data.feedback && data.feedback.length > 0) {
        resFeedbackRow.style.display = "block";
        resFeedback.innerText = data.feedback.join(" ");
    } else {
        resFeedbackRow.style.display = "none";
    }
    
    if (data.status === "CONFIRMED") {
        resStatus.innerText = "ACCESS CONFIRMED";
        resStatus.style.backgroundColor = "rgba(46, 125, 50, 0.15)";
        resStatus.style.color = "var(--success)";
        resName.innerText = `${data.candidate.name} (${data.candidate.faculty_id})`;
        const initials = data.candidate.name ? data.candidate.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
        resAvatar.innerText = initials;
        resAvatar.style.backgroundColor = "var(--primary)";
        
        if (!silent) {
            addLog(`SUCCESS: Verified identity ${data.candidate.name} (Sim: ${similarityPercent}%, Live: ${livenessPercent}%)`, "success");
        }
    } else {
        resStatus.innerText = "ACCESS REJECTED";
        resStatus.style.backgroundColor = "rgba(211, 47, 47, 0.15)";
        resStatus.style.color = "var(--error)";
        resName.innerText = "No match / Spoof detected";
        resAvatar.innerText = "?";
        resAvatar.style.backgroundColor = "var(--error)";
        
        if (!silent) {
            addLog(`REJECTED: Verification failed (Live: ${livenessPercent}%, Similarity: ${similarityPercent}%, Qual: ${qualityPercent}%)`, "error");
        }
    }
    
    // Render pipeline stepper
    const stepperEl = document.getElementById("pipelineStepper");
    const stagesContainerEl = document.getElementById("stepperStagesContainer");
    const totalTimeEl = document.getElementById("pipelineTotalTime");
    renderPipelineStepper(stepperEl, stagesContainerEl, totalTimeEl, data.pipeline_stages);
}

// Helper to determine threshold
function settings_match_threshold_percent() {
    return 60; 
}

let isLiveDemoActive = false;
let liveDemoTimeout = null;

async function toggleLiveDemo() {
    const liveDemoBtn = document.getElementById("liveDemoBtn");
    
    if (isLiveDemoActive) {
        isLiveDemoActive = false;
        if (liveDemoTimeout) {
            clearTimeout(liveDemoTimeout);
            liveDemoTimeout = null;
        }
        liveDemoBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            Start Live Demo
        `;
        liveDemoBtn.classList.remove("btn-live-active");
        addLog("Live Detection Demo stopped.");
    } else {
        if (!stream) {
            addLog("Please start camera before launching Live Demo.", "error");
            return;
        }
        isLiveDemoActive = true;
        liveDemoBtn.innerHTML = `
            <span class="live-indicator-dot" id="liveDot"></span>
            &nbsp;Stop Live Demo
        `;
        liveDemoBtn.classList.add("btn-live-active");
        addLog("Live Detection Demo started.");
        runLiveDemoLoop();
    }
}

async function runLiveDemoLoop() {
    if (!isLiveDemoActive) return;
    
    try {
        await verifyPresentation(true);
    } catch (e) {
        // Suppress frame errors in live loop
    }
    
    if (isLiveDemoActive) {
        liveDemoTimeout = setTimeout(runLiveDemoLoop, 800);
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
        const fallbackText = stage.is_fallback ? "Mock" : "Actual";
        
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
                    <span style="display: block; opacity: 0.6; font-size: 0.65rem; margin-top: 2px;">
                        Cumulative: ${cumulativeTime.toFixed(1)} ms${transitionHtml}
                    </span>
                </div>
            </div>
        `;
        stagesContainerEl.appendChild(stageDiv);
    });
}
