"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Camera, ShieldAlert, CheckCircle2, ShieldQuestion, UserPlus } from "lucide-react";
import { useWebcam } from "@/hooks/useWebcam";
import { parseUTCDateTime } from "@/lib/utils";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  
  const [statusHtml, setStatusHtml] = useState<React.ReactNode>(<span className="text-[var(--text-secondary)] italic">Camera is inactive.</span>);
  const [pendingLock, setPendingLock] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>(0);

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
      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 1
      });
      if (isCurrent) {
        landmarkerRef.current = faceLandmarker;
      } else {
        faceLandmarker.close();
      }
    }
    initMediaPipe();
    
    return () => {
      isCurrent = false;
      cancelAnimationFrame(animationRef.current);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
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
            
            ctx.strokeStyle = "#00e676";
            ctx.lineWidth = Math.max(3, canvas.width * 0.005);
            
            ctx.beginPath(); ctx.moveTo(minX, minY + len); ctx.lineTo(minX, minY); ctx.lineTo(minX + len, minY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(maxX, minY + len); ctx.lineTo(maxX, minY); ctx.lineTo(maxX - len, minY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(minX, maxY - len); ctx.lineTo(minX, maxY); ctx.lineTo(minX + len, maxY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(maxX, maxY - len); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX - len, maxY); ctx.stroke();
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
          setTimeout(() => {
            setShowSuccess(false);
            if (user) loadLogs(user.id);
          }, 4000);
        } else {
          setStatusHtml(<span className="text-[var(--warning)]">Waiting for registered user.</span>);
        }
      } else if (res.ok && data.status === "MANUAL_REVIEW" && data.candidate?.faculty_id === user?.id) {
        setStatusHtml(<span className="text-[var(--warning)]">Attendance logged (Flagged for Manual Review).</span>);
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
    <div className="font-[var(--font-roboto)]">
      {/* App Bar */}
      <header className="app-bar flex justify-between items-center bg-[var(--surface)] border-b border-[var(--divider)] px-6 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-50 sticky top-0">
        <div className="logo-area flex items-center gap-3">
            <div className="text-[var(--primary)] bg-[#e3f2fd] p-1.5 rounded-lg">
                <ShieldQuestion className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <h1 className="m-0 font-[var(--font-outfit)] text-sm font-bold tracking-wider text-[var(--text-primary)]">HYPERSPHERE CONTROL PLANE</h1>
                <p className="m-0 text-xs text-[var(--text-secondary)]">NIT Trichy Attendance Portal</p>
            </div>
        </div>
        <button onClick={handleLogout} className="btn btn-outlined text-xs py-1.5 px-3 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Logout
        </button>
      </header>

      <div className="max-w-[1280px] mx-auto my-8 px-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_340px] gap-6">
        
        {/* Left Column */}
        <aside className="flex flex-col gap-6">
          <div className="section-card text-center p-6 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl">
            <div className="w-[72px] h-[72px] rounded-full bg-[var(--primary-light)] text-[var(--primary-dark)] flex items-center justify-center font-bold text-2xl mx-auto mb-4 border-[3px] border-[rgba(25,118,210,0.15)] font-[var(--font-outfit)]">
                {user.name?.substring(0, 2).toUpperCase() || <User />}
            </div>
            <h2 className="text-[1.15rem] border-none p-0 m-0 mb-1">{user.name}</h2>
            <div className="font-mono text-xs text-[var(--text-secondary)] mb-4">@{user.id}</div>
            
            <div className="text-left mt-4 border-t border-[var(--divider)] pt-4 text-[0.85rem] flex flex-col gap-2">
                <div><span className="text-[var(--text-secondary)] font-semibold">Department:</span> {user.department || "General"}</div>
                <div><span className="text-[var(--text-secondary)] font-semibold">Designation:</span> {user.designation || "Faculty"}</div>
                <div><span className="text-[var(--text-secondary)] font-semibold">Email:</span> <span className="break-all">{user.email || "-"}</span></div>
            </div>
          </div>

          <div className="section-card text-center bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="mb-3 text-[1.1rem]">Face Registration</h2>
            {faceIsRegistered ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[#e8f5e9] text-[var(--success)]">
                    ✓ Face Registered
                </div>
            ) : user.face_status === "pending_review" ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[#fff3e0] text-[var(--warning)]">
                    ⏳ Pending Admin Review
                </div>
            ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[#ffebee] text-[var(--error)]">
                    No Face Registered
                </div>
            )}
            <p className="text-xs text-[var(--text-secondary)] mt-3">
                {faceIsRegistered 
                    ? "Your biometric template is securely stored and ready for verification." 
                    : user.face_status === "pending_review"
                    ? "Your face photo is currently under admin review."
                    : "Register your face using the webcam to activate biometric verification."}
            </p>
          </div>

          <div className="section-card bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="mb-4 text-[1.1rem]">Quick Actions</h2>
            <div className="flex flex-col gap-3">
                <button onClick={() => setIsPhotoModalOpen(true)} className="btn btn-outlined justify-start gap-2 text-[0.85rem] py-2.5">
                    <Camera className="w-4 h-4" /> Request Photo Update
                </button>
                <button onClick={() => setIsIssueModalOpen(true)} className="btn btn-outlined justify-start gap-2 text-[0.85rem] py-2.5 border-[rgba(211,47,47,0.2)] text-[var(--error)] hover:bg-[#fff5f5]">
                    <ShieldAlert className="w-4 h-4" /> Report Matching Issue
                </button>
            </div>
          </div>
        </aside>

        {/* Center Column */}
        <main className="flex flex-col h-full">
          <div className="video-container-card flex flex-col h-full bg-[var(--surface)] border border-[var(--border-color)] rounded-xl overflow-hidden relative">
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

        {/* Right Column */}
        <aside className="flex flex-col">
          <div className="section-card flex flex-col bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-6 h-[480px]">
            <h2 className="mb-4 text-[1.1rem]">Attendance Logs</h2>
            <div className="flex-1 overflow-y-auto pr-1">
                <table className="w-full text-[0.85rem] text-left border-collapse">
                    <thead className="sticky top-0 bg-[var(--surface)] z-10">
                        <tr>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)]">Date/Time</th>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-center">Status</th>
                            <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-right">Match</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">No logs loaded.</td></tr>
                        ) : (
                            logs.slice(0, 15).map(log => {
                                const dt = parseUTCDateTime(log.timestamp);
                                const isConfirmed = log.status === "CONFIRMED";
                                return (
                                    <tr key={log.id}>
                                        <td className="p-2 border-b border-[var(--divider)] text-[var(--text-primary)] py-3">
                                            {dt.toLocaleDateString()}<br/>
                                            <span className="text-xs text-[var(--text-secondary)] font-mono">{dt.toLocaleTimeString()}</span>
                                        </td>
                                        <td className="p-2 border-b border-[var(--divider)] text-center">
                                            <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[0.7rem] font-bold ${isConfirmed ? 'bg-[var(--success)] text-white' : 'bg-[var(--error)] text-white'}`}>
                                                {isConfirmed ? '✓' : '✗'}
                                            </span>
                                        </td>
                                        <td className="p-2 border-b border-[var(--divider)] text-right font-mono text-xs text-[var(--text-primary)]">
                                            {log.similarity_score ? `${Math.round(log.similarity_score * 100)}%` : '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </aside>
      </div>

      {/* Photo Request Modal */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] p-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-[var(--divider)] pb-3">
                    <h3 className="font-[var(--font-outfit)] text-xl font-bold text-[var(--text-primary)] m-0">Request Face Update</h3>
                    <button onClick={() => setIsPhotoModalOpen(false)} className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] p-1 rounded">✕</button>
                </div>
                <form onSubmit={(e) => submitFaceRequest('update', e)} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Upload Clear Photo</label>
                        <input type="file" accept="image/*" onChange={(e) => setRequestFile(e.target.files?.[0] || null)} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa]" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Reason / Note to Admin</label>
                        <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="e.g. Bad lighting in my initial capture..." rows={3} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none" />
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <button type="button" onClick={() => setIsPhotoModalOpen(false)} className="btn btn-outlined">Cancel</button>
                        <button type="submit" className="btn btn-contained">Submit Request</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Issue Report Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] p-8 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 border-b border-[var(--divider)] pb-3">
                    <h3 className="font-[var(--font-outfit)] text-xl font-bold text-[var(--text-primary)] m-0">Report Matching Issue</h3>
                    <button onClick={() => setIsIssueModalOpen(false)} className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] p-1 rounded">✕</button>
                </div>
                <form onSubmit={(e) => submitFaceRequest('issue_report', e)} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">Describe the Issue</label>
                        <textarea value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="Describe the matching problem..." rows={4} required className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none" />
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <button type="button" onClick={() => setIsIssueModalOpen(false)} className="btn btn-outlined">Cancel</button>
                        <button type="submit" className="btn btn-contained bg-[var(--error)] hover:bg-[#d32f2f] border-transparent">Submit Report</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
