"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Camera, ShieldAlert, CheckCircle2, ShieldQuestion, UserPlus, MapPin } from "lucide-react";
import { useWebcam } from "@/hooks/useWebcam";
import { parseUTCDateTime } from "@/lib/utils";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);
  
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  
  const [statusHtml, setStatusHtml] = useState<React.ReactNode>("");
  const [pendingLock, setPendingLock] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
    insideCampus: boolean;
    buildingName: string;
    buildingId: string | null;
  }>({
    latitude: null,
    longitude: null,
    insideCampus: false,
    buildingName: "Locating...",
    buildingId: null,
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "LOCATION_UPDATE") {
        setCurrentLocation({
          latitude: event.data.latitude,
          longitude: event.data.longitude,
          insideCampus: event.data.insideCampus,
          buildingName: event.data.buildingName,
          buildingId: event.data.buildingId,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();
  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [updateMode, setUpdateMode] = useState<'upload' | 'camera'>('upload');

  const handleCameraCapture = async () => {
    if (!isActive) {
      alert("Please activate the camera on the left panel before capturing.");
      return;
    }
    try {
      const blob = await captureFrameBlob();
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        setRequestFile(file);
        if (capturePreview) {
          URL.revokeObjectURL(capturePreview);
        }
        const previewUrl = URL.createObjectURL(blob);
        setCapturePreview(previewUrl);
      } else {
        alert("Failed to capture frame from webcam. Please ensure feed is active.");
      }
    } catch (e) {
      console.error("Camera capture failed:", e);
      alert("Failed to capture from webcam.");
    }
  };
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const initTimeRef = useRef<number>(0);

  const lastFaceDetectionRef = useRef<{
    hasFace: boolean;
    faceArea: number;
    yaw: number;
    pitch: number;
    roll: number;
  }>({ hasFace: false, faceArea: 0, yaw: 0, pitch: 0, roll: 0 });

  const hasBlinkedRef = useRef(false);
  const earHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      loadLogs(parsed.id);
      checkPendingRequests(parsed.id);
    } else {
      router.push("/");
    }
  }, [router]);

  // MediaPipe Initialization
  useEffect(() => {
    let isCurrent = true;
    async function initMediaPipe() {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
      const originalConsoleLog = console.log;
      const originalConsoleInfo = console.info;
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      console.log = () => {};
      console.info = () => {};
      console.warn = () => {};
      console.error = () => {};
      
      let faceLandmarker;
      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: false,
          runningMode: "VIDEO",
          numFaces: 1
        });
      } finally {
        console.log = originalConsoleLog;
        console.info = originalConsoleInfo;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }

      if (isCurrent && faceLandmarker) {
        landmarkerRef.current = faceLandmarker;
        initTimeRef.current = Date.now();
      }
    }
    initMediaPipe();
    
    return () => {
      isCurrent = false;
      cancelAnimationFrame(animationRef.current);
      if (landmarkerRef.current) {
        const timeElapsed = Date.now() - initTimeRef.current;
        if (timeElapsed > 5000) {
          const originalConsoleError = console.error;
          console.error = () => {};
          try {
            landmarkerRef.current.close();
          } catch (e) {
            console.warn("Failed to close FaceLandmarker:", e);
          } finally {
            console.error = originalConsoleError;
          }
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  // HUD Drawing Loop
  useEffect(() => {
    if (isActive && !showSuccess) {
      animationRef.current = requestAnimationFrame(drawHUD);
    } else {
      cancelAnimationFrame(animationRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive, showSuccess]);

  const drawHUD = () => {
    if (!isActive || !videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState >= 2) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
            
            landmarks.forEach(lm => {
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            });
            
            const w = maxX - minX;
            const h = maxY - minY;
            minX = Math.max(0, minX - w * 0.15);
            maxX = Math.min(canvas.width, maxX + w * 0.15);
            minY = Math.max(0, minY - h * 0.15);
            maxY = Math.min(canvas.height, maxY + h * 0.15);
            
            const boxW = maxX - minX;
            const boxH = maxY - minY;
            const len = Math.min(boxW, boxH) * 0.2;
            
            // Gates Calculations
            const faceArea = (w * h) / (canvas.width * canvas.height);
            const nose = landmarks[4];
            const leftEyeCorner = landmarks[33];
            const rightEyeCorner = landmarks[263];
            const forehead = landmarks[10];
            const chin = landmarks[152];
            
            const yaw = Math.abs((nose.x - leftEyeCorner.x) / (rightEyeCorner.x - leftEyeCorner.x) - 0.5) * 180;
            const pitch = Math.abs((nose.y - forehead.y) / (chin.y - forehead.y) - 0.4) * 180;
            const roll = Math.abs(Math.atan2(rightEyeCorner.y - leftEyeCorner.y, rightEyeCorner.x - leftEyeCorner.x) * (180 / Math.PI));
            
            lastFaceDetectionRef.current = {
              hasFace: true,
              faceArea,
              yaw,
              pitch,
              roll
            };

            // Calculate EAR for blink detection
            const getDistance = (p1: any, p2: any) => {
              const dx = (p1.x - p2.x) * canvas.width;
              const dy = (p1.y - p2.y) * canvas.height;
              return Math.sqrt(dx * dx + dy * dy);
            };
            const getEAR = (eyeLms: any[]) => {
              const d_v1 = getDistance(eyeLms[1], eyeLms[5]);
              const d_v2 = getDistance(eyeLms[2], eyeLms[4]);
              const d_h = getDistance(eyeLms[0], eyeLms[3]);
              if (d_h === 0) return 0;
              return (d_v1 + d_v2) / (2.0 * d_h);
            };
            const leftEyeLms = [landmarks[33], landmarks[160], landmarks[158], landmarks[133], landmarks[153], landmarks[144]];
            const rightEyeLms = [landmarks[263], landmarks[385], landmarks[387], landmarks[362], landmarks[373], landmarks[380]];
            const earL = getEAR(leftEyeLms);
            const earR = getEAR(rightEyeLms);
            const avgEAR = (earL + earR) / 2.0;

            const earHistory = earHistoryRef.current;
            earHistory.push(avgEAR);
            if (earHistory.length > 25) earHistory.shift();

            let closedIndex = -1;
            for (let i = 0; i < earHistory.length; i++) {
              if (earHistory[i] < 0.14) {
                closedIndex = i;
                break;
              }
            }
            if (closedIndex > 0 && closedIndex < earHistory.length - 1) {
              let recoveryDetected = false;
              for (let j = closedIndex + 1; j < earHistory.length; j++) {
                if (earHistory[j] > 0.19) {
                  recoveryDetected = true;
                  break;
                }
              }
              if (recoveryDetected) {
                hasBlinkedRef.current = true;
              }
            }

            const isPoseOk = yaw <= 20 && pitch <= 20 && roll <= 20;
            const isAreaOk = faceArea >= 0.15;

            // Render Premium HUD UI Panel
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(16, 16, 220, 80, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isAreaOk ? "#10b981" : "#f43f5e";
            ctx.beginPath();
            ctx.arc(30, 36, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(`Distance: ${isAreaOk ? "OK" : "Too Far"} (${Math.round(faceArea * 100)}%)`, 42, 39);

            ctx.fillStyle = isPoseOk ? "#10b981" : "#f43f5e";
            ctx.beginPath();
            ctx.arc(30, 56, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(`Pose: ${isPoseOk ? "Frontal" : "Turned"} (Y:${Math.round(yaw)}° P:${Math.round(pitch)}°)`, 42, 59);

            ctx.fillStyle = hasBlinkedRef.current ? "#10b981" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(30, 76, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(`Liveness: ${hasBlinkedRef.current ? "Blink Verified" : "Please Blink Eyes"}`, 42, 79);
            
            // Draw outer corner brackets
            ctx.strokeStyle = (isPoseOk && isAreaOk && hasBlinkedRef.current) ? "#10b981" : "#f59e0b";
            ctx.lineWidth = Math.max(3, canvas.width * 0.005);
            
            ctx.beginPath(); ctx.moveTo(minX, minY + len); ctx.lineTo(minX, minY); ctx.lineTo(minX + len, minY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(maxX, minY + len); ctx.lineTo(maxX, minY); ctx.lineTo(maxX - len, minY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(minX, maxY - len); ctx.lineTo(minX, maxY); ctx.lineTo(minX + len, maxY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(maxX, maxY - len); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX - len, maxY); ctx.stroke();
          } else {
            lastFaceDetectionRef.current = { hasFace: false, faceArea: 0, yaw: 0, pitch: 0, roll: 0 };
          }
        } catch(e) { }
      }
    }
    animationRef.current = requestAnimationFrame(drawHUD);
  };

  const loadLogs = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/attendance?user_id=${userId}`);
      if (res.ok) {
        setLogs(await res.json());
        setVisibleCount(8);
      }
    } catch (e) {
      console.error("Failed to load logs", e);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequests = async (userId: string) => {
    try {
      const res = await fetch("/api/v1/face-requests?status=pending");
      if (res.ok) {
        const requests = await res.json();
        const pending = requests.some((r: any) => r.user_id === userId);
        setPendingLock(pending);
      }
    } catch (e) {}
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const updatedUser = await res.json();
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (e) {}
  };

  const handleLogout = async () => {
    try { await fetch("/api/v1/auth/logout", { method: "POST" }); } catch (e) {}
    localStorage.removeItem("user");
    router.push("/");
  };

  const toggleCam = () => {
    if (isActive) stopWebcam();
    else startWebcam();
  };

  const faceIsRegistered = user?.face_status === "registered" || user?.face_status === "approved";

  // Auto-start is disabled to allow explicit camera permission via button click
  
  // Sync statusHtml with camera active state
  useEffect(() => {
    if (isActive) {
      if (faceIsRegistered) {
        setStatusHtml(<span className="text-[var(--primary)] font-semibold">Camera is live. Scanning for face...</span>);
      } else {
        setStatusHtml(<span className="text-[var(--primary)] font-semibold">Camera started. Position face and click Register.</span>);
      }
    } else {
      setStatusHtml("");
    }
  }, [isActive, faceIsRegistered]);

  // Continuous Verification Loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runLoop = async () => {
      if (!isActive || !faceIsRegistered || pendingLock || showSuccess || isVerifying) return;
      
      setIsVerifying(true);
      await handleVerify();
      setIsVerifying(false);
      
      // Schedule next run
      timeoutId = setTimeout(runLoop, 2000);
    };

    if (isActive && faceIsRegistered && !pendingLock && !showSuccess && !isVerifying) {
      timeoutId = setTimeout(runLoop, 1000);
    }

    return () => clearTimeout(timeoutId);
  }, [isActive, faceIsRegistered, pendingLock, showSuccess, isVerifying]);

  const handleVerify = async () => {
    const faceState = lastFaceDetectionRef.current;
    
    if (!faceState.hasFace) {
      setStatusHtml(<span className="text-[var(--warning)] font-semibold">Position your face in the camera view.</span>);
      return;
    }
    
    if (faceState.faceArea < 0.15) {
      setStatusHtml(<span className="text-[var(--warning)] font-semibold">Please move closer to the camera.</span>);
      return;
    }
    
    if (faceState.yaw > 20 || faceState.pitch > 20 || faceState.roll > 20) {
      setStatusHtml(<span className="text-[var(--warning)] font-semibold">Please look straight at the camera.</span>);
      return;
    }
    
    if (!hasBlinkedRef.current) {
      setStatusHtml(<span className="text-[var(--primary)] font-semibold animate-pulse">Blink your eyes to verify liveness...</span>);
      return;
    }

    setStatusHtml(<span className="text-[var(--primary)] animate-pulse">Scanning identity &amp; liveness...</span>);
    
    const blobs: Blob[] = [];
    for (let i = 0; i < 5; i++) {
      const blob = await captureFrameBlob();
      if (blob) blobs.push(blob);
      if (i < 4) await new Promise(r => setTimeout(r, 200));
    }
    
    if (blobs.length === 0) {
      setStatusHtml(<span className="text-[var(--error)]">Camera must be running to verify.</span>);
      return;
    }
    
    const formData = new FormData();
    formData.append("device_id", "Web_Dashboard");
    if (currentLocation.buildingName && currentLocation.buildingName !== "Locating...") {
      formData.append("location_name", currentLocation.buildingName);
    }
    if (currentLocation.latitude !== null) {
      formData.append("latitude", currentLocation.latitude.toString());
    }
    if (currentLocation.longitude !== null) {
      formData.append("longitude", currentLocation.longitude.toString());
    }
    blobs.forEach((blob, idx) => {
      formData.append("files", blob, `verify_${idx}.jpg`);
    });
    
    try {
      const res = await fetch("/api/v1/verify", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      if (res.ok && data.status === "CONFIRMED") {
        if (data.candidate?.faculty_id === user?.id) {
          setShowSuccess(true);
          hasBlinkedRef.current = false; // Reset blink state for next verification
          setTimeout(() => {
            setShowSuccess(false);
            if (user) loadLogs(user.id);
          }, 4000);
        } else {
          setStatusHtml(<span className="text-[var(--warning)]">Waiting for registered user.</span>);
        }
      } else if (res.ok && data.status === "MANUAL_REVIEW" && data.candidate?.faculty_id === user?.id) {
        setStatusHtml(<span className="text-[var(--warning)]">Attendance logged (Flagged for Manual Review).</span>);
        hasBlinkedRef.current = false; // Reset blink state for next verification
        if (user) loadLogs(user.id);
        // Pause briefly before continuing
        await new Promise(r => setTimeout(r, 3000));
      } else {
        setStatusHtml(<span className="text-[var(--error)]">{data.status === "REJECTED" ? "Liveness check failed (Spoof detected)." : "Verification failed or no match found."}</span>);
      }
    } catch (e) {
      setStatusHtml(<span className="text-[var(--error)]">Connection error during verification.</span>);
    }
  };

  const handleSelfRegister = async () => {
    if (!isActive) {
      await startWebcam();
      setStatusHtml(<span className="text-[var(--primary)]">Camera started. Position your face and click &quot;Capture &amp; Register&quot;.</span>);
      return;
    }

    setStatusHtml(<span className="text-[var(--primary)] animate-pulse">Capturing face for registration...</span>);
    
    const blob = await captureFrameBlob();
    if (!blob) {
      setStatusHtml(<span className="text-[var(--error)]">Could not capture frame. Ensure camera is running.</span>);
      return;
    }
    
    const formData = new FormData();
    formData.append("faculty_id", user.id);
    formData.append("name", user.name);
    formData.append("file", blob, "registration.jpg");
    
    try {
      const res = await fetch("/api/v1/register", { method: "POST", body: formData });
      if (res.ok) {
        setStatusHtml(<span className="text-[var(--success)] font-semibold">✓ Biometrics successfully registered!</span>);
        await refreshUser();
      } else {
        const err = await res.json();
        setStatusHtml(<span className="text-[var(--error)]">Registration failed: {err.detail || "Try again"}</span>);
      }
    } catch (err) {
      setStatusHtml(<span className="text-[var(--error)]">Connection error during registration.</span>);
    }
  };

  const submitFaceRequest = async (type: string, e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("user_id", user?.id || "");
    formData.append("request_type", type);
    formData.append("message", requestText);
    if (requestFile) formData.append("file", requestFile);
    
    try {
      const res = await fetch("/api/v1/face-requests", {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        alert("Request submitted successfully.");
        setIsPhotoModalOpen(false);
        setIsIssueModalOpen(false);
        setRequestText("");
        setRequestFile(null);
        setCapturePreview(null);
        setUpdateMode('upload');
        if (user) checkPendingRequests(user.id);
      } else {
        const err = await res.json();
        alert(`Request failed: ${err.detail || "Server error"}`);
      }
    } catch (err) {
      alert("Connection failed.");
    }
  };

  if (!user) return null;

  return (
    <div className="font-[var(--font-roboto)] h-screen flex flex-col overflow-hidden bg-[#f8f9fa]">
      {/* App Bar */}
      <header className="app-bar flex justify-between items-center bg-[var(--surface)] border-b border-[var(--divider)] px-6 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-50 sticky top-0">
        <div className="logo-area flex items-center gap-3">
            <div className="text-[var(--primary)] bg-[#e3f2fd] p-1.5 rounded-lg">
                <ShieldQuestion className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <h1 className="m-0 font-[var(--font-outfit)] text-sm font-bold tracking-wider text-[var(--text-primary)]">HYPERSPHERE CONTROL PLANE</h1>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="m-0 text-xs text-[var(--text-secondary)]">NIT Trichy Attendance Portal</p>
                    <span className="text-[10px] text-[var(--divider)]">|</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      currentLocation.insideCampus 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : currentLocation.buildingName === "Locating..."
                          ? 'bg-slate-50 text-slate-500 border-slate-200 animate-pulse'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <MapPin className="w-3 h-3" />
                      Building: <strong className="font-bold">{currentLocation.buildingName}</strong>
                    </span>
                </div>
            </div>
        </div>
        <button onClick={handleLogout} className="btn btn-outlined text-xs py-1.5 px-3 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      <div className="w-full px-6 py-6 lg:h-[calc(100vh-73px)] grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 lg:overflow-hidden">
        
        {/* Left Column - Face Biometric Terminal */}
        <main className="flex flex-col lg:h-full lg:overflow-hidden">
          <div className="video-container-card flex flex-col lg:h-full bg-[var(--surface)] border border-[var(--border-color)] rounded-xl overflow-hidden relative">
            <div className="bg-[#1a1a1a] text-white p-4 flex justify-between items-center text-sm font-semibold tracking-wide border-b border-[#333]">
                <span>Biometric Attendance Terminal</span>
                {isActive && (
                    <span className="flex items-center gap-2 text-[var(--primary)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span> LIVE SCANNING
                    </span>
                )}
            </div>

            <div className="relative w-full aspect-[4/3] bg-[#0d0d0d] flex-1 flex items-center justify-center overflow-hidden">
                {pendingLock && (
                    <div className="absolute inset-0 bg-[rgba(255,255,255,0.95)] z-20 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                        <ShieldAlert className="w-12 h-12 text-[var(--warning)] mb-4" />
                        <h3 className="font-[var(--font-outfit)] text-xl text-[var(--text-primary)] mb-2">Awaiting Admin Review</h3>
                        <p className="text-sm text-[var(--text-secondary)] max-w-[320px] leading-relaxed">
                            Your uploaded face photo is currently under verification by the CDI Administrator. Camera functions are locked in this state.
                        </p>
                    </div>
                )}
                
                {showSuccess && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#2e7d32f2] to-[#1b5e20f2] text-white z-30 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                        <div className="w-[72px] h-[72px] rounded-full bg-[rgba(255,255,255,0.2)] border-4 border-white flex items-center justify-center animate-in zoom-in duration-300 delay-100">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h2 className="font-[var(--font-outfit)] text-3xl font-bold mt-4 mb-2">Attendance Logged!</h2>
                        <p className="text-lg opacity-90">Have a great day ahead.</p>
                    </div>
                )}

                <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${!isActive && 'hidden'}`} />
                <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] ${!isActive || showSuccess ? 'hidden' : 'block'}`} />
                
                {!isActive && !pendingLock && !showSuccess && (
                    <div className="text-[var(--text-secondary)] flex flex-col items-center opacity-50 relative z-10">
                        <Camera className="w-12 h-12 mb-3" />
                        <p className="text-sm text-center">Webcam is currently inactive.<br/>Start the camera to begin live face capture.</p>
                    </div>
                )}
            </div>

            <div className="p-5 flex flex-col gap-4 border-t border-[var(--divider)]">
                <div className="text-sm text-center min-h-[20px]">{statusHtml}</div>
                <div className="flex justify-center gap-4">
                    {faceIsRegistered ? (
                        isActive ? (
                            <button onClick={stopWebcam} className="btn btn-outlined font-semibold border-[rgba(211,47,47,0.3)] text-[var(--error)]">
                                Stop Camera
                            </button>
                        ) : (
                            <button onClick={startWebcam} disabled={pendingLock} className="btn btn-contained font-semibold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white">
                                Mark Attendance
                            </button>
                        )
                    ) : (
                        user.face_status !== "pending_review" && (
                            isActive ? (
                                <>
                                    <button onClick={stopWebcam} className="btn btn-outlined font-semibold">
                                        Stop Camera
                                    </button>
                                    <button onClick={handleSelfRegister} disabled={pendingLock} className="btn btn-contained font-semibold flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" /> Capture &amp; Register
                                    </button>
                                </>
                            ) : (
                                <button onClick={startWebcam} disabled={pendingLock} className="btn btn-contained font-semibold flex items-center gap-2">
                                    <UserPlus className="w-4 h-4" /> Register My Face
                                </button>
                            )
                        )
                    )}
                </div>
            </div>
          </div>
        </main>

        {/* Right Column - User Profile details & logs */}
        <aside className="flex flex-col gap-4 lg:h-full lg:overflow-hidden">
          {/* Box 1: User Profile Info */}
          <div className="section-card p-6 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl flex-shrink-0">
            <div className="text-left mb-4 border-b border-[var(--divider)] pb-3">
                <div className="text-[1.3rem] font-bold text-[var(--text-primary)] font-[var(--font-outfit)]">
                    {user.name}
                </div>
            </div>
            <div className="text-left text-sm flex flex-col gap-2 text-[var(--text-secondary)]">
                <div><span className="font-semibold text-[var(--text-primary)]">Department:</span> {user.department || "General"}</div>
                <div><span className="font-semibold text-[var(--text-primary)]">Designation:</span> {user.designation || "Faculty"}</div>
                <div><span className="font-semibold text-[var(--text-primary)]">Email:</span> <span className="break-all">{user.email || "-"}</span></div>
            </div>
          </div>

          {/* Box 2: Quick Actions / Requests */}
          <div className="section-card p-6 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl flex-shrink-0">
            <h2 className="mb-4 text-[1.1rem]">Quick Actions</h2>
            <div className="flex flex-row gap-3">
                <button onClick={() => setIsPhotoModalOpen(true)} className="btn btn-outlined text-xs py-2.5 px-4 flex items-center justify-center gap-2 font-semibold flex-1">
                    <Camera className="w-4 h-4" /> Request Photo Change
                </button>
                <button onClick={() => setIsIssueModalOpen(true)} className="btn btn-outlined text-xs py-2.5 px-4 flex items-center justify-center gap-2 font-semibold flex-1 border-[rgba(211,47,47,0.2)] text-[var(--error)] hover:bg-[#fff5f5]">
                    <ShieldAlert className="w-4 h-4" /> Report Issue
                </button>
            </div>
          </div>

          {/* Logs Card */}
          <div className="section-card flex flex-col bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-6 lg:h-full flex-grow overflow-hidden">
            <h2 className="mb-4 text-[1.1rem]">Attendance Logs</h2>
            <div className="flex-1 overflow-y-auto pr-1">
                <table className="w-full text-[0.85rem] text-left border-collapse table-fixed">
                    <thead className="sticky top-0 bg-[var(--surface)] z-20">
                        <tr>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] w-[45%]">Time</th>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-center w-[25%]">Status</th>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-right w-[30%]">Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">No logs loaded.</td></tr>
                        ) : (
                            (() => {
                                let lastDate = "";
                                const visibleLogs = logs.slice(0, visibleCount);
                                return visibleLogs.map(log => {
                                    const dt = parseUTCDateTime(log.timestamp);
                                    const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                                    const showDateHeader = dateStr !== lastDate;
                                    lastDate = dateStr;
                                    const isConfirmed = log.status === "CONFIRMED";
                                    return (
                                        <React.Fragment key={log.id}>
                                            {showDateHeader && (
                                                <tr>
                                                    <td colSpan={3} className="p-2 py-2 font-bold text-xs text-[var(--primary-dark)] bg-[var(--primary-light)] border-y border-[rgba(25,118,210,0.1)]">
                                                        {dateStr}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr>
                                                <td className="p-2 border-b border-[var(--divider)] text-[var(--text-primary)] py-3 font-mono text-xs w-[45%] truncate">
                                                    <div className="font-semibold">{dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                    {log.location_name && (
                                                        <div className="text-[10px] text-[var(--text-secondary)] font-[var(--font-roboto)] flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-2.5 h-2.5 inline" /> {log.location_name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2 border-b border-[var(--divider)] text-center w-[25%]">
                                                    <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[0.7rem] font-bold ${isConfirmed ? 'bg-[var(--success)] text-white' : 'bg-[var(--error)] text-white'}`}>
                                                        {isConfirmed ? '✓' : '✗'}
                                                    </span>
                                                </td>
                                                <td className="p-2 border-b border-[var(--divider)] text-right font-mono text-xs text-[var(--text-primary)] w-[30%]">
                                                    {log.similarity_score ? `${Math.round(log.similarity_score * 100)}%` : '-'}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                });
                            })()
                        )}
                    </tbody>
                </table>
            </div>

            {/* View More Controls */}
            {logs.length > visibleCount && (
                <div className="flex justify-center border-t border-[var(--divider)] pt-4 mt-4 flex-shrink-0">
                    <button 
                        type="button"
                        onClick={() => setVisibleCount(prev => prev + 10)} 
                        className="btn btn-outlined text-xs py-2 px-4 font-semibold w-full text-center justify-center"
                    >
                        View More
                    </button>
                </div>
            )}
          </div>
        </aside>
      </div>

      {/* Photo Request Modal */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div 
              className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] animate-in zoom-in-95 duration-200"
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
                <div className="flex justify-between items-center border-b border-[var(--divider)] pb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-[var(--font-outfit)] text-lg font-bold text-[var(--text-primary)] m-0">Request Face Update</h3>
                    <button onClick={() => { setIsPhotoModalOpen(false); setCapturePreview(null); }} className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] px-2 py-1 rounded cursor-pointer">✕</button>
                </div>
                
                {/* Mode Selector Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={() => { setUpdateMode('upload'); setRequestFile(null); setCapturePreview(null); }}
                      style={{ 
                        flex: 1, 
                        padding: '10px', 
                        fontWeight: '600', 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        border: 'none',
                        borderBottom: updateMode === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: updateMode === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      Upload File
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { setUpdateMode('camera'); setRequestFile(null); setCapturePreview(null); }}
                      style={{ 
                        flex: 1, 
                        padding: '10px', 
                        fontWeight: '600', 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        border: 'none',
                        borderBottom: updateMode === 'camera' ? '2px solid var(--primary)' : '2px solid transparent',
                        color: updateMode === 'camera' ? 'var(--primary)' : 'var(--text-secondary)',
                        backgroundColor: 'transparent'
                      }}
                    >
                      Capture From Camera
                    </button>
                </div>

                <form onSubmit={(e) => submitFaceRequest('update', e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {updateMode === 'upload' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Upload Clear Photo</label>
                          <input type="file" accept="image/*" onChange={(e) => setRequestFile(e.target.files?.[0] || null)} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa]" style={{ border: '1px solid var(--border-color)' }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]" style={{ alignSelf: 'flex-start' }}>Capture Photo from Webcam</label>
                          
                          {capturePreview ? (
                            <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#000' }}>
                              <img src={capturePreview} alt="Webcam Capture Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button 
                                type="button" 
                                onClick={() => { setCapturePreview(null); setRequestFile(null); }}
                                style={{ position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                Retake
                              </button>
                            </div>
                          ) : (
                            <div style={{ width: '100%', padding: '24px', borderRadius: '8px', border: '1px dashed var(--border-color)', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                {isActive ? "Webcam feed is active on the main dashboard." : "Please start the main dashboard camera first."}
                              </span>
                              <button 
                                type="button" 
                                onClick={handleCameraCapture}
                                disabled={!isActive}
                                className="btn btn-contained"
                                style={{ opacity: isActive ? 1 : 0.6, cursor: isActive ? 'pointer' : 'not-allowed' }}
                              >
                                <Camera className="w-4 h-4" /> Capture Frame
                              </button>
                            </div>
                          )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Reason / Note to Admin</label>
                        <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="e.g. Bad lighting in my initial capture..." rows={3} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none" style={{ border: '1px solid var(--border-color)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" onClick={() => { setIsPhotoModalOpen(false); setCapturePreview(null); }} className="btn btn-outlined">Cancel</button>
                        <button type="submit" className="btn btn-contained" disabled={!requestFile} style={{ opacity: requestFile ? 1 : 0.6, cursor: requestFile ? 'pointer' : 'not-allowed' }}>Submit Request</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Issue Report Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div 
              className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] animate-in zoom-in-95 duration-200"
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
                <div className="flex justify-between items-center border-b border-[var(--divider)] pb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="font-[var(--font-outfit)] text-lg font-bold text-[var(--text-primary)] m-0">Report Matching Issue</h3>
                    <button onClick={() => setIsIssueModalOpen(false)} className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] px-2 py-1 rounded cursor-pointer">✕</button>
                </div>
                <form onSubmit={(e) => submitFaceRequest('issue_report', e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Describe the Issue</label>
                        <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="Describe the matching problem..." rows={4} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none" style={{ border: '1px solid var(--border-color)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" onClick={() => setIsIssueModalOpen(false)} className="btn btn-outlined">Cancel</button>
                        <button 
                          type="submit" 
                          className="btn btn-contained"
                          style={{ backgroundColor: 'var(--error)', borderColor: 'transparent', color: 'white' }}
                        >
                          Submit Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Hidden Geolocation/Geofencing tracking Iframe */}
      <iframe
        src="http://localhost:8080/map/locate.html"
        allow="geolocation"
        style={{ width: "1px", height: "1px", opacity: 0, position: "absolute", pointerEvents: "none" }}
        title="NITT Geofencing Engine"
      />
    </div>
  );
}
