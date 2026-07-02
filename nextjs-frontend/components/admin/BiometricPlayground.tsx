"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, ShieldCheck, ShieldAlert, FileQuestion } from "lucide-react";

export default function BiometricPlayground() {
  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [antispoof, setAntispoof] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [totalLatency, setTotalLatency] = useState(0);
  
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const loopRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeRef = useRef<number>(0);

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
      if (loopRef.current) clearInterval(loopRef.current);
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

  useEffect(() => {
    fetch('/api/v1/config/antispoof').then(r => r.ok ? r.json() : null).then(d => {
      if (d && typeof d.enabled === 'boolean') setAntispoof(d.enabled);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isActive) {
      animationRef.current = requestAnimationFrame(drawHUD);
      loopRef.current = setInterval(runInferenceLoop, 500);
    } else {
      cancelAnimationFrame(animationRef.current);
      if (loopRef.current) clearInterval(loopRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [isActive]);

  const toggleAntispoofSetting = async (checked: boolean) => {
    setAntispoof(checked);
    try {
      await fetch('/api/v1/config/antispoof', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: checked }) });
    } catch (e) {
      console.error(e);
    }
  };

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
              // Canvas is visually flipped via CSS scaleX(-1) so draw original coordinates
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

  const runInferenceLoop = async () => {
    const blob = await captureFrameBlob();
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
      setTotalLatency(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {}
  };

  const togglePlaygroundCam = () => {
    if (isActive) stopWebcam();
    else startWebcam();
  };

  // UI mapping logic
  const renderResultCard = () => {
    if (!result) {
      return (
        <div className="flex flex-col items-center text-[var(--text-secondary)]">
          <Camera className="w-12 h-12 mb-2 opacity-50" />
          <div className="font-medium text-[0.95rem]">Awaiting video loop initialization...</div>
        </div>
      );
    }
    
    if (result.status === "CONFIRMED" && result.match_found && result.candidate) {
      const initials = result.candidate.name.substring(0, 2).toUpperCase();
      return (
        <div className="flex items-center gap-5 w-full bg-[#4CAF5014] border border-[#4CAF504D] rounded-xl p-6 transition-all duration-300">
            <div className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xl font-[var(--font-outfit)]">
                {initials}
            </div>
            <div className="flex flex-col gap-1">
                <div className="font-bold text-lg text-[var(--success)] flex items-center gap-2">
                    VERIFIED: {result.candidate.name}
                    <span className="text-xs bg-[var(--success)] text-white px-2 py-0.5 rounded">LIVE</span>
                </div>
                <div className="text-[0.85rem] text-[var(--text-secondary)]">Faculty ID: <strong>{result.candidate.faculty_id}</strong></div>
                <div className="text-[0.8rem] text-[var(--text-secondary)]">Similarity: <strong>{(result.candidate.similarity_score * 100).toFixed(2)}%</strong></div>
            </div>
        </div>
      );
    }
    
    if (result.status === "REJECTED" && result.liveness_score < 0.40) {
      return (
        <div className="flex items-center gap-5 w-full bg-[#f4433614] border border-[#f443364D] rounded-xl p-6 transition-all duration-300">
            <div className="w-14 h-14 rounded-full bg-[var(--error)] text-white flex items-center justify-center">
                <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1">
                <div className="font-bold text-[1.2rem] text-[var(--error)]">SPOOF DETECTED (REJECTED)</div>
                <div className="text-[0.85rem] text-[var(--text-secondary)]">Anti-spoofing algorithm flagged this profile as spoof/replay.</div>
                <div className="text-[0.8rem] text-[var(--text-secondary)]">Liveness Probability: <strong>{(result.liveness_score * 100).toFixed(2)}%</strong> (Threshold: 40%)</div>
            </div>
        </div>
      );
    }
    
    if (result.status === "MANUAL_REVIEW") {
      return (
        <div className="flex items-center gap-5 w-full bg-[#ff980014] border border-[#ff98004D] rounded-xl p-6 transition-all duration-300">
            <div className="w-14 h-14 rounded-full bg-[var(--warning)] text-white flex items-center justify-center">
                <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1">
                <div className="font-bold text-[1.15rem] text-[var(--warning)]">MANUAL REVIEW REQUIRED</div>
                <div className="text-[0.85rem] text-[var(--text-secondary)]">Biometric ambiguity or borderline liveness score.</div>
                <div className="text-[0.8rem] text-[var(--text-secondary)]">Match: <strong>{result.candidate ? result.candidate.name : "Unknown"}</strong></div>
            </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-5 w-full bg-[rgba(0,0,0,0.03)] border border-[var(--border-color)] rounded-xl p-6 transition-all duration-300">
          <div className="w-14 h-14 rounded-full bg-[#757575] text-white flex items-center justify-center font-bold text-2xl">
              <FileQuestion className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-1">
              <div className="font-bold text-[1.15rem] text-[var(--text-secondary)]">UNKNOWN VISITOR (NO MATCH)</div>
              <div className="text-[0.85rem] text-[var(--text-secondary)]">Liveness test passed, but no matching identity was found.</div>
          </div>
      </div>
    );
  };

  const simPct = result?.candidate?.similarity_score ? (result.candidate.similarity_score * 100) : 0;
  const livePct = result?.liveness_score ? (result.liveness_score * 100) : 0;
  const qualPct = result?.quality_score ? (result.quality_score * 100) : 0;

  return (
    <div className="section-card">
      <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
        <div className="flex flex-col gap-1">
            <h2 className="border-none p-0 m-0 font-[var(--font-outfit)]">Biometric Evaluation Playground</h2>
            <p className="m-0 text-[0.85rem] text-[var(--text-secondary)]">Real-time continuous inference loop checking identity and liveness.</p>
        </div>
        <div className="flex items-center gap-3 bg-[rgba(0,0,0,0.03)] py-2 px-4 rounded-lg border border-[var(--border-color)]">
            <span className="text-[0.85rem] font-medium text-[var(--text-primary)]">Anti-Spoofing (MiniFASNet):</span>
            <label className="relative inline-block w-[44px] h-[22px]">
              <input type="checkbox" checked={antispoof} onChange={(e) => toggleAntispoofSetting(e.target.checked)} className="peer opacity-0 w-0 h-0" />
              <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-[#ccc] transition-colors duration-400 rounded-[34px] peer-checked:bg-[var(--primary)] before:absolute before:content-[''] before:h-[16px] before:w-[16px] before:left-[3px] before:bottom-[3px] before:bg-white before:transition-transform before:duration-300 before:rounded-full peer-checked:before:translate-x-[22px]"></span>
            </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        
        <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-[4/3] bg-[#1a1a1a] rounded-xl overflow-hidden border border-[var(--border-color)] shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]">
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!isActive && 'hidden'}`}></video>
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"></canvas>
                
                <div className={`absolute top-4 left-4 ${isActive ? 'bg-[rgba(76,175,80,0.85)]' : 'bg-[rgba(255,61,0,0.85)]'} text-white px-3 py-1.5 rounded-md text-xs font-bold font-mono flex items-center gap-2 tracking-wide backdrop-blur-sm transition-colors`}>
                    <span className={`w-2 h-2 rounded-full bg-white inline-block ${isActive && 'animate-pulse'}`}></span>
                    <span>{isActive ? 'LIVE SCANNING' : 'CAMERA OFF'}</span>
                </div>
            </div>
            
            <div className="flex gap-3 justify-center">
                <button onClick={togglePlaygroundCam} className="btn btn-contained min-w-[160px] font-semibold">
                    {isActive ? "Stop Live Loop" : "Start Live Loop"}
                </button>
            </div>
        </div>

        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-center min-h-[120px]">
                {renderResultCard()}
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                <h3 className="m-0 text-[0.9rem] font-[var(--font-outfit)] uppercase text-[var(--text-secondary)] tracking-wide border-b border-[var(--divider)] pb-2">Pipeline Confidence Ratings</h3>
                
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-[var(--text-primary)]">Liveness Probability (Real vs Spoof):</span>
                        <span className="font-mono font-bold">{livePct.toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${result?.liveness_score >= 0.40 ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} style={{ width: `${livePct}%` }}></div>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-[var(--text-primary)]">Vector Match Similarity:</span>
                        <span className="font-mono font-bold">{simPct.toFixed(2)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${simPct}%` }}></div>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-[var(--text-primary)]">Face Sharpness (Quality):</span>
                        <span className="font-mono font-bold">{(result?.quality_score || 0).toFixed(3)}</span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--success)] transition-all duration-300" style={{ width: `${Math.min(100, qualPct)}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3 border-b border-[var(--divider)] pb-2">
                    <h3 className="m-0 text-[0.9rem] font-[var(--font-outfit)] uppercase text-[var(--text-secondary)] tracking-wide">Live Execution Telemetry</h3>
                    <div className="font-mono text-[0.8rem] text-[var(--text-secondary)] font-semibold">Total: {totalLatency.toFixed(1)} ms</div>
                </div>
                <div className="flex flex-col gap-2">
                    {!result?.pipeline_stages ? (
                        <div className="text-[0.8rem] text-[var(--text-secondary)] text-center italic py-4">Awaiting execution data...</div>
                    ) : (
                        result.pipeline_stages.map((stage: any, i: number) => {
                          const isDone = stage.status === "completed" || stage.status === "passed";
                          return (
                            <div key={i} className="flex justify-between items-center text-xs px-3 py-1.5 bg-[rgba(0,0,0,0.02)] rounded border border-[var(--border-color)]">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold ${isDone ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>{isDone ? '✓' : '○'}</span>
                                    <span className="font-semibold text-[var(--text-primary)]">{stage.name}</span>
                                </div>
                                <div className="font-mono text-[var(--text-secondary)]">
                                    {stage.latency_ms !== null ? `${stage.latency_ms.toFixed(1)} ms` : 'N/A'}
                                </div>
                            </div>
                          );
                        })
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
