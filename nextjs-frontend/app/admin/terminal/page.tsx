"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { Shield, UserPlus, Video, VideoOff, ScanFace, Play, Square, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface LogEntry { time: string; text: string; type?: "info" | "success" | "error" | "warning" }

export default function OperatorTerminal() {
  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();

  // Enrollment form
  const [regId, setRegId] = useState("");
  const [regName, setRegName] = useState("");
  const [regFile, setRegFile] = useState<File | null>(null);

  // Event log
  const [logs, setLogs] = useState<LogEntry[]>([{ time: fmtTime(), text: "Biometric service plane initialized.", type: "info" }]);
  const logRef = useRef<HTMLDivElement>(null);

  // Verification result
  const [result, setResult] = useState<any>(null);
  const [totalTime, setTotalTime] = useState(0);

  // Faculty mini-list
  const [profiles, setProfiles] = useState<any[]>([]);

  // Live demo
  const [liveDemo, setLiveDemo] = useState(false);
  const liveDemoRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => {
      if (liveDemoRef.current) clearInterval(liveDemoRef.current);
    };
  }, []);

  function fmtTime(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  function addLog(text: string, type: LogEntry["type"] = "info") {
    setLogs(prev => [...prev.slice(-200), { time: fmtTime(), text, type }]);
  }

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/v1/faculty");
      if (res.ok) setProfiles(await res.json());
    } catch (e) {}
  };

  const deleteProfile = async (id: string) => {
    if (!confirm(`Delete profile @${id}?`)) return;
    try {
      const res = await fetch(`/api/v1/faculty/${id}`, { method: "DELETE" });
      if (res.ok) {
        addLog(`Profile @${id} deleted.`, "warning");
        fetchProfiles();
      } else {
        addLog(`Failed to delete @${id}.`, "error");
      }
    } catch (e) {
      addLog("Delete failed: connection error.", "error");
    }
  };

  const registerFaculty = async () => {
    if (!regId.trim() || !regName.trim()) {
      addLog("Registration aborted: Faculty ID and Name are required.", "error");
      return;
    }

    addLog(`Starting enrollment for "${regName}" (${regId})...`);

    const formData = new FormData();
    formData.append("faculty_id", regId.trim().toLowerCase());
    formData.append("name", regName.trim());

    if (regFile) {
      formData.append("file", regFile);
      addLog("Using uploaded image file for enrollment.");
    } else if (isActive) {
      const blob = await captureFrameBlob();
      if (!blob) {
        addLog("Capture failed: Could not grab frame from webcam.", "error");
        return;
      }
      formData.append("file", blob, "webcam_capture.jpg");
      addLog("Captured live frame from webcam.");
    } else {
      addLog("No image provided: start the camera or upload a file.", "error");
      return;
    }

    try {
      const res = await fetch("/api/v1/register", { method: "POST", body: formData });
      if (res.ok) {
        addLog(`✓ Enrollment successful for "${regName}" (@${regId}).`, "success");
        setRegId("");
        setRegName("");
        setRegFile(null);
        fetchProfiles();
      } else {
        const err = await res.json();
        addLog(`✗ Enrollment failed: ${err.detail || "Server error"}`, "error");
      }
    } catch (e) {
      addLog("✗ Enrollment failed: connection error.", "error");
    }
  };

  const verifyCapture = useCallback(async (isLive = false) => {
    const blob = await captureFrameBlob();
    if (!blob) {
      if (!isLive) addLog("Capture failed: webcam not active.", "error");
      return;
    }

    if (!isLive) addLog("Captured frame. Running biometric pipeline...");

    const formData = new FormData();
    formData.append("device_id", "Operator_Terminal");
    formData.append("file", blob, "verify.jpg");

    const t0 = performance.now();
    try {
      const res = await fetch("/api/v1/verify", { method: "POST", body: formData });
      const elapsed = performance.now() - t0;
      setTotalTime(elapsed);

      if (res.ok) {
        const data = await res.json();
        setResult(data);

        if (data.status === "CONFIRMED" && data.candidate) {
          addLog(`✓ MATCH: ${data.candidate.name} (@${data.candidate.faculty_id}) — ${(data.candidate.similarity_score * 100).toFixed(1)}% similarity [${elapsed.toFixed(0)}ms]`, "success");
        } else if (data.status === "MANUAL_REVIEW") {
          addLog(`⚠ MANUAL REVIEW: Ambiguous match or borderline liveness [${elapsed.toFixed(0)}ms]`, "warning");
        } else {
          addLog(`✗ REJECTED: ${data.liveness_score < 0.4 ? "Spoof detected" : "No identity match"} [${elapsed.toFixed(0)}ms]`, "error");
        }
      } else {
        const err = await res.json();
        addLog(`Pipeline error: ${err.detail || "Server error"}`, "error");
      }
    } catch (e) {
      addLog("Verification failed: connection error.", "error");
    }
  }, [captureFrameBlob]);

  const toggleLiveDemo = () => {
    if (liveDemo) {
      if (liveDemoRef.current) clearInterval(liveDemoRef.current);
      setLiveDemo(false);
      addLog("Live demo stopped.");
    } else {
      if (!isActive) {
        addLog("Start the camera first before enabling live demo.", "error");
        return;
      }
      setLiveDemo(true);
      addLog("Live demo started (800ms interval)...");
      liveDemoRef.current = setInterval(() => verifyCapture(true), 800);
    }
  };

  // Stop live demo when webcam stops
  useEffect(() => {
    if (!isActive && liveDemo) {
      if (liveDemoRef.current) clearInterval(liveDemoRef.current);
      setLiveDemo(false);
      addLog("Live demo auto-stopped (camera off).");
    }
  }, [isActive, liveDemo]);

  const handleStartCam = async () => {
    await startWebcam();
    addLog("Webcam started.");
  };
  const handleStopCam = () => {
    stopWebcam();
    addLog("Webcam stopped.");
  };

  // Verification result rendering helpers
  const simPct = result?.candidate?.similarity_score ? result.candidate.similarity_score * 100 : 0;
  const livePct = result?.liveness_score ? result.liveness_score * 100 : 0;
  const qualPct = result?.quality_score ? result.quality_score * 100 : 0;

  const statusLabel = result?.status === "CONFIRMED" ? "ACCESS CONFIRMED" : result?.status === "MANUAL_REVIEW" ? "MANUAL REVIEW" : "ACCESS REJECTED";
  const statusColor = result?.status === "CONFIRMED" ? "var(--success)" : result?.status === "MANUAL_REVIEW" ? "var(--warning)" : "var(--error)";

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-[var(--font-roboto)]">
      {/* Header */}
      <header className="app-bar sticky top-0 z-50">
        <div className="logo-area">
          <Shield className="w-6 h-6 text-[var(--primary)]" />
          <h1>HYPERSPHERE CONTROL PLANE</h1>
          <p>Biometric Authentication Server</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--success)]">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
          Database Active
        </div>
      </header>

      {/* Three-Column Layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        {/* Left: Enrollment + Event Log */}
        <aside className="w-[300px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4 border-r border-[var(--divider)] bg-[var(--surface)]">
          <div className="section-card">
            <h2>Enroll Faculty Member</h2>
            <div className="input-field">
              <label>Faculty ID</label>
              <input type="text" value={regId} onChange={e => setRegId(e.target.value)} placeholder="e.g. FAC204" />
            </div>
            <div className="input-field" style={{ marginTop: "0.5rem" }}>
              <label>Full Name</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. Dr. Keerthi" />
            </div>
            <div className="input-field" style={{ marginTop: "0.5rem" }}>
              <label>Image File (optional)</label>
              <input type="file" accept="image/*" onChange={e => setRegFile(e.target.files?.[0] || null)} className="text-xs" />
            </div>
            <button onClick={registerFaculty} className="btn btn-contained mt-3 flex items-center gap-2 w-full justify-center">
              <UserPlus className="w-4 h-4" /> Enroll Profile
            </button>
          </div>

          <div className="section-card flex-1 flex flex-col min-h-[200px]">
            <h2>System Event Log</h2>
            <div ref={logRef} className="terminal-view flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 max-h-[360px]" style={{ background: "#0a0a0a", color: "#90caf9", padding: "0.75rem", borderRadius: "6px" }}>
              {logs.map((l, i) => (
                <div key={i} className="log-line">
                  [<span className="text-[var(--primary)]">{l.time}</span>]
                  <span className={l.type === "success" ? "text-[#66bb6a]" : l.type === "error" ? "text-[#ef5350]" : l.type === "warning" ? "text-[#ffa726]" : "text-[#90caf9]"}> {l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Video Viewfinder */}
        <main className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="video-container-card flex flex-col flex-1 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <div className="bg-[#1a1a1a] text-white p-3 flex justify-between items-center text-sm font-semibold tracking-wide border-b border-[#333]">
              <span>Live Video Capture Feed</span>
              {isActive && (
                <span className="flex items-center gap-2 text-[var(--primary)] text-xs">
                  <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span> LIVE SCANNING
                </span>
              )}
            </div>

            <div className="relative flex-1 bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] ${!isActive && "hidden"}`} />
              {!isActive && (
                <div className="text-[var(--text-secondary)] flex flex-col items-center opacity-40">
                  <Video className="w-12 h-12 mb-3" />
                  <p className="text-sm text-center">Webcam is currently inactive.<br />Start the camera to begin live face capture.</p>
                </div>
              )}
            </div>

            <div className="p-4 flex justify-center gap-3 border-t border-[var(--divider)] flex-wrap">
              {!isActive ? (
                <button onClick={handleStartCam} className="btn btn-outlined flex items-center gap-2 text-sm">
                  <Video className="w-4 h-4" /> Start Camera
                </button>
              ) : (
                <button onClick={handleStopCam} className="btn btn-outlined flex items-center gap-2 text-sm border-[rgba(211,47,47,0.3)] text-[var(--error)]">
                  <VideoOff className="w-4 h-4" /> Stop Camera
                </button>
              )}
              <button onClick={() => verifyCapture(false)} className="btn btn-contained flex items-center gap-2 text-sm">
                <ScanFace className="w-4 h-4" /> Capture & Verify
              </button>
              <button onClick={toggleLiveDemo} className={`btn ${liveDemo ? "btn-contained bg-[var(--error)]" : "btn-outlined"} flex items-center gap-2 text-sm`}>
                {liveDemo ? <><Square className="w-4 h-4" /> Stop Live Demo</> : <><Play className="w-4 h-4" /> Start Live Demo</>}
              </button>
            </div>
          </div>
        </main>

        {/* Right: Results + Faculty List */}
        <aside className="w-[320px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4 border-l border-[var(--divider)] bg-[var(--surface)]">
          {/* Verdict Panel */}
          <div className="section-card">
            <h2>Verification Verdict</h2>
            <div className="rounded-lg overflow-hidden border border-[var(--border-color)]">
              <div className="py-2 px-4 text-center font-bold text-sm tracking-wider text-white" style={{ backgroundColor: result ? statusColor : "#757575" }}>
                VERDICT: {result ? statusLabel : "AWAITING SCAN"}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {result?.candidate ? (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm font-[var(--font-outfit)]">
                      {result.candidate.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">{result.candidate.name}</div>
                  </div>
                ) : (
                  <div className="text-center text-[var(--text-secondary)] text-sm py-2">—</div>
                )}

                {/* Gauges */}
                {[
                  { label: "Liveness Confidence", val: livePct, color: livePct >= 40 ? "var(--success)" : "var(--error)" },
                  { label: "Face Similarity", val: simPct, color: "var(--primary)" },
                  { label: "Frame Quality", val: qualPct, color: "var(--success)" },
                ].map((g, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">{g.label}:</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{g.val.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, g.val)}%`, backgroundColor: g.color }}></div>
                    </div>
                  </div>
                ))}

                {result?.feedback?.length > 0 && (
                  <div className="mt-2 text-xs text-[var(--text-secondary)] bg-[#fafafa] border border-[var(--border-color)] rounded p-2">
                    <div className="font-semibold mb-1 text-[var(--text-primary)]">System Advice</div>
                    {result.feedback.join(" ")}
                  </div>
                )}

                {/* Pipeline Stepper */}
                {result?.pipeline_stages && (
                  <div className="mt-3 border-t border-[var(--divider)] pt-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                      <span>Pipeline Stepper</span>
                      <span className="font-mono">{totalTime.toFixed(0)} ms</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {result.pipeline_stages.map((s: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${s.status === "completed" ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}>
                              {s.status === "completed" ? "✓" : "○"}
                            </span>
                            <span className="text-[var(--text-primary)]">{s.name}</span>
                          </div>
                          <span className="font-mono text-[var(--text-secondary)]">{s.latency_ms?.toFixed(1)} ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enrolled Profiles Mini-List */}
          <div className="section-card flex-1 flex flex-col">
            <div className="flex justify-between items-center border-b border-[var(--divider)] pb-2 mb-3">
              <h2 className="m-0 border-none p-0">Enrolled Profiles</h2>
              <Link href="/admin/registry" className="btn btn-outlined text-[10px] py-1 px-2 uppercase flex items-center gap-1">
                View All <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]">
              {profiles.filter(p => p.face_status === "registered" || p.face_status === "approved").length === 0 ? (
                <div className="text-center text-[var(--text-secondary)] text-xs py-4">No profiles registered in DB.</div>
              ) : (
                profiles
                  .filter(p => p.face_status === "registered" || p.face_status === "approved")
                  .slice(0, 20)
                  .map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[rgba(0,0,0,0.03)] group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-[11px] font-[var(--font-outfit)] shrink-0">
                          {p.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</div>
                          <div className="text-[10px] font-mono text-[var(--text-secondary)]">@{p.id}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteProfile(p.id)} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--error)] transition-opacity p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
