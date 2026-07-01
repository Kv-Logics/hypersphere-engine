"use client";

import React, { useState, useEffect, useRef } from "react";
import { Settings, Shield, Camera } from "lucide-react";
import { useWebcam } from "@/hooks/useWebcam";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function BiometricTester() {
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [antispoof, setAntispoof] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [totalTimeMs, setTotalTimeMs] = useState(0);
  const [clientTotalTimeMs, setClientTotalTimeMs] = useState(0);
  
  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>(0);

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

  useEffect(() => {
    if (mode === "camera" && isActive) {
      animationRef.current = requestAnimationFrame(drawHUD);
    } else {
      cancelAnimationFrame(animationRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive, mode]);

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

  useEffect(() => {
    if (mode === "upload" && isActive) {
      stopWebcam();
    }
  }, [mode, isActive, stopWebcam]);

  useEffect(() => {
    fetch('/api/v1/config/antispoof').then(r => r.ok ? r.json() : null).then(d => {
      if (d && typeof d.enabled === 'boolean') setAntispoof(d.enabled);
    }).catch(() => {});
  }, []);

  const toggleAntispoofSetting = async (checked: boolean) => {
    setAntispoof(checked);
    try {
      await fetch('/api/v1/config/antispoof', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: checked }) });
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerify = async (blobs: Blob[]) => {
    if (!blobs || blobs.length === 0) {
      alert("No image selected or captured.");
      return;
    }
    
    setLoading(true);
    setResult(null);
    setLoadingStage(0);
    
    const clientStartTime = performance.now();
    const interval = setInterval(() => {
        setLoadingStage(s => Math.min(s + 1, 3));
    }, 400);

    const formData = new FormData();
    formData.append("device_id", "Admin_Tester");
    blobs.forEach((blob, idx) => {
        formData.append("files", blob, `verify_${idx}.jpg`);
    });
    
    const startTime = performance.now();
    
    try {
      const res = await fetch("/api/v1/verify", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      
      clearInterval(interval);
      setLoadingStage(4);
      
      if (res.ok) {
        setResult(data);
        setTotalTimeMs(performance.now() - startTime);
        setClientTotalTimeMs(performance.now() - clientStartTime);
      } else {
        alert(`Verification failed: ${data.detail || "Server error"}`);
      }
    } catch (err) {
      clearInterval(interval);
      alert("Verification failed: connection error.");
    } finally {
      setLoading(false);
    }
  };

  const runFileTester = () => {
      if (file) handleVerify([file]);
  };
  
  const runCameraTester = async () => {
    setLoading(true);
    setResult(null);
    const blobs: Blob[] = [];
    for (let i = 0; i < 5; i++) {
        const blob = await captureFrameBlob();
        if (blob) blobs.push(blob);
        if (i < 4) await new Promise(r => setTimeout(r, 200));
    }
    setLoading(false);
    if (blobs.length > 0) {
        handleVerify(blobs);
    }
  };

  const renderRunningStepper = () => (
    <div className="pipeline-stepper mt-4 pt-4 border-t border-[var(--divider)] flex flex-col gap-3">
        <div className="flex justify-between items-center text-[var(--text-secondary)] mb-1 text-xs font-bold uppercase tracking-wider font-[var(--font-outfit)]">
            <span>Pipeline Stepper (Running)</span>
            <div className="flex gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
            </div>
        </div>
        {[
            { label: "Client Frame Capture", activeAt: 0 },
            { label: "Quality Analysis", activeAt: 1 },
            { label: "Anti-Spoofing Check", activeAt: 2 },
            { label: "Vector Search Match", activeAt: 3 }
        ].map((s, i) => {
            const isDone = loadingStage > s.activeAt;
            const isActive = loadingStage === s.activeAt;
            return (
                <div key={i} className="stepper-stage relative flex items-center gap-3 text-sm opacity-90">
                    {i < 3 && <div className="absolute left-[9px] top-[20px] bottom-[-12px] w-[2px] bg-[var(--divider)] z-10" />}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-20 text-white transition-colors duration-300 ${isDone ? 'bg-[var(--success)]' : isActive ? 'bg-[var(--warning)] animate-pulse' : 'bg-gray-300'}`}>
                        {isDone ? '✓' : isActive ? '...' : '—'}
                    </div>
                    <div className={`font-medium ${isActive ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
                        {s.label}
                    </div>
                </div>
            );
        })}
    </div>
  );

  const renderPipeline = (stages: any[]) => {
      let totalPipeline = 0;
      stages.forEach(s => totalPipeline += s.latency_ms);
      
      return (
          <div className="pipeline-stepper mt-4 pt-4 border-t border-[var(--divider)] flex flex-col gap-3">
              <div className="flex justify-between items-center text-[var(--text-secondary)] mb-1 text-xs font-bold uppercase tracking-wider font-[var(--font-outfit)] flex-wrap gap-2">
                  <span>Pipeline Stepper</span>
                  <div className="flex gap-3 text-xs font-medium font-[var(--font-jetbrains)] flex-wrap">
                      <span>Pipeline: <strong className="text-[var(--text-primary)]">{totalPipeline.toFixed(1)} ms</strong></span>
                      <span>Server Total: <strong className="text-[var(--text-primary)]">{totalTimeMs.toFixed(1)} ms</strong></span>
                      <span>End-to-End: <strong className="text-[var(--text-primary)]">{clientTotalTimeMs.toFixed(1)} ms</strong></span>
                  </div>
              </div>
              {stages.map((stage, i) => (
                  <div key={i} className="stepper-stage relative flex items-center gap-3 text-sm">
                      {i < stages.length - 1 && <div className="absolute left-[9px] top-[20px] bottom-[-12px] w-[2px] bg-[var(--divider)] z-10" />}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-20 text-white ${stage.status === 'completed' ? 'bg-[var(--success)]' : stage.status === 'failed' ? 'bg-[var(--error)]' : 'bg-gray-300'}`}>
                          {stage.status === 'completed' ? '✓' : stage.status === 'failed' ? '✗' : '—'}
                      </div>
                      <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-center">
                              <span className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                                  {stage.name}
                                  {stage.is_fallback && <span className="bg-[#fff3e0] text-[#e65100] px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border border-[#ffe0b2]">Fallback Mode</span>}
                              </span>
                              <span className="font-mono text-xs text-[var(--text-secondary)]">{stage.latency_ms.toFixed(1)} ms</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] break-all mt-0.5">
                              {stage.details}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="section-card h-full">
      <h2 style={{ marginBottom: "1.5rem" }}>Biometric Match & Liveness Tester</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="flex border-b border-[var(--divider)] mb-5">
            <button 
              onClick={() => setMode("upload")} 
              className={`flex-1 p-2 font-medium text-sm outline-none transition-colors border-b-2 ${mode === "upload" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              Upload Image File
            </button>
            <button 
              onClick={() => setMode("camera")} 
              className={`flex-1 p-2 font-medium text-sm outline-none transition-colors border-b-2 ${mode === "camera" ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              Webcam Live Stream
            </button>
          </div>
          
          {mode === "upload" && (
            <div className="animate-in fade-in duration-300">
              <div className="mb-6 flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Select Face Image for Test</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa]"
                />
              </div>
              <button onClick={runFileTester} disabled={!file || loading} className="btn btn-contained w-full flex justify-center p-3 opacity-90 hover:opacity-100 disabled:opacity-50">
                {loading ? "Verifying..." : "Verify Image"}
              </button>
            </div>
          )}
          
          {mode === "camera" && (
            <div className="animate-in fade-in duration-300">
              <div className="relative w-full h-[280px] bg-[#f1f3f4] rounded-lg overflow-hidden border border-[var(--border-color)] mb-4 flex items-center justify-center">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${!isActive ? 'hidden' : 'block'}`} 
                />
                <canvas 
                  ref={canvasRef} 
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] ${!isActive ? 'hidden' : 'block'}`}
                />
                {!isActive && (
                  <div className="text-[var(--text-secondary)] flex flex-col items-center gap-2">
                    <Camera className="w-8 h-8 opacity-50" />
                    <span className="text-sm">Camera is inactive</span>
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-3 mb-4">
                <button onClick={isActive ? stopWebcam : startWebcam} className="btn btn-outlined text-xs py-1.5 px-3">
                  {isActive ? "Stop Camera" : "Start Camera"}
                </button>
                {isActive && (
                  <button onClick={runCameraTester} disabled={loading} className="btn btn-contained text-xs py-1.5 px-3 bg-[var(--success)] hover:bg-[var(--success)] disabled:opacity-50 flex items-center gap-2">
                    {loading ? <><span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> Scanning 5 Frames...</> : "Scan & Verify"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 p-5 bg-[#fafafa] border border-[var(--border-color)] rounded-lg">
            <h4 className="m-0 mb-3 font-[var(--font-outfit)] text-sm text-[var(--text-primary)] flex items-center gap-2">
              <Settings className="w-4 h-4" /> Pipeline Configuration
            </h4>
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <span className="text-sm font-medium block text-[var(--text-primary)]">Anti-Spoofing (Liveness Check)</span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-1">Disable to bypass MiniFASNet model execution and speed up processing.</span>
              </div>
              <label className="relative inline-block w-[38px] h-[20px]">
                <input type="checkbox" checked={antispoof} onChange={(e) => toggleAntispoofSetting(e.target.checked)} className="peer opacity-0 w-0 h-0" />
                <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-[var(--border-color)] transition-colors duration-300 rounded-[20px] peer-checked:bg-[var(--primary)] before:absolute before:content-[''] before:h-[14px] before:w-[14px] before:left-[3px] before:bottom-[3px] before:bg-white before:transition-transform before:duration-300 before:rounded-full peer-checked:before:translate-x-[18px]"></span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="bg-[#fafafa] border border-dashed border-[var(--border-color)] rounded-lg min-h-[320px] p-6 flex flex-col justify-center">
          {loading && !result ? (
              <div className="w-full h-full flex flex-col">
                  <h3 className="mt-0 mb-4 font-[var(--font-outfit)] text-lg text-[var(--text-primary)] text-center">Processing Request...</h3>
                  {renderRunningStepper()}
              </div>
          ) : !result ? (
            <div className="text-center text-[var(--text-secondary)] flex flex-col items-center">
              <Shield className="w-12 h-12 mb-4 opacity-50" strokeWidth={1.5} />
              <p className="m-0 text-sm">Upload a file or scan your face to see real-time verification accuracy and liveness details.</p>
            </div>
          ) : (
            <div className="w-full">
              <h3 className="mt-0 mb-4 font-[var(--font-outfit)] text-lg text-[var(--text-primary)] text-center">Scan Result</h3>
              
              <div className={`mx-auto mb-6 text-sm px-5 py-2 rounded-full flex w-fit uppercase font-semibold tracking-wide ${result.status === "CONFIRMED" ? "bg-[var(--success)] bg-opacity-10 text-[var(--success)] border border-[var(--success)]" : result.status === "MANUAL_REVIEW" ? "bg-[var(--warning)] bg-opacity-10 text-[var(--warning)] border border-[var(--warning)]" : "bg-[var(--error)] bg-opacity-10 text-[var(--error)] border border-[var(--error)]"}`}>
                {result.status}
              </div>
              
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between border-b border-[var(--divider)] pb-2">
                  <span className="text-[var(--text-secondary)] font-medium">Matched User:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{result.candidate?.faculty_id ? `@${result.candidate.faculty_id}` : 'None'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--divider)] pb-2">
                  <span className="text-[var(--text-secondary)] font-medium">Match Accuracy (Similarity):</span>
                  <span className="font-semibold font-[var(--font-jetbrains)]">{result.candidate?.similarity_score ? `${Math.round(result.candidate.similarity_score * 100)}%` : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--divider)] pb-2">
                  <span className="text-[var(--text-secondary)] font-medium">Liveness Score:</span>
                  <span className="font-semibold font-[var(--font-jetbrains)]">{result.liveness_score ? `${Math.round(result.liveness_score * 100)}%` : '-'}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--divider)] pb-2">
                  <span className="text-[var(--text-secondary)] font-medium">Image Quality:</span>
                  <span className="font-semibold font-[var(--font-jetbrains)]">{result.quality_score ? `${Math.round(result.quality_score * 100)}/100` : '-'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-secondary)] font-medium">Pipeline Logs/Feedback:</span>
                  <span className="italic text-[var(--text-secondary)] text-xs">{result.feedback || 'No additional feedback'}</span>
                </div>
                
                {result.pipeline_stages && renderPipeline(result.pipeline_stages)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
