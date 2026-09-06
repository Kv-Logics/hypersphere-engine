"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import TerminalHeader from "@/components/admin/terminal/TerminalHeader";
import TerminalEnrollmentCard from "@/components/admin/terminal/TerminalEnrollmentCard";
import TerminalConsoleLogs, { LogEntry } from "@/components/admin/terminal/TerminalConsoleLogs";
import TerminalScannerCard from "@/components/admin/terminal/TerminalScannerCard";
import TerminalVerdictPanel from "@/components/admin/terminal/TerminalVerdictPanel";
import TerminalProfilesList from "@/components/admin/terminal/TerminalProfilesList";

export default function OperatorTerminal() {
  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();

  // Enrollment form
  const [regId, setRegId] = useState("");
  const [regName, setRegName] = useState("");
  const [regFile, setRegFile] = useState<File | null>(null);

  // Event log
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: fmtTime(), text: "Biometric service plane initialized.", type: "info" },
  ]);
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
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
      2,
      "0"
    )}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  function addLog(text: string, type: LogEntry["type"] = "info") {
    setLogs((prev) => [...prev.slice(-200), { time: fmtTime(), text, type }]);
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

  const verifyCapture = useCallback(
    async (isLive = false) => {
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
            addLog(
              `✓ MATCH: ${data.candidate.name} (@${data.candidate.faculty_id}) — ${(
                data.candidate.similarity_score * 100
              ).toFixed(1)}% similarity [${elapsed.toFixed(0)}ms]`,
              "success"
            );
          } else if (data.status === "MANUAL_REVIEW") {
            addLog(
              `⚠ MANUAL REVIEW: Ambiguous match or borderline liveness [${elapsed.toFixed(0)}ms]`,
              "warning"
            );
          } else {
            addLog(
              `✗ REJECTED: ${
                data.liveness_score < 0.4 ? "Spoof detected" : "No identity match"
              } [${elapsed.toFixed(0)}ms]`,
              "error"
            );
          }
        } else {
          const err = await res.json();
          addLog(`Pipeline error: ${err.detail || "Server error"}`, "error");
        }
      } catch (e) {
        addLog("Verification failed: connection error.", "error");
      }
    },
    [captureFrameBlob]
  );

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

  const statusLabel =
    result?.status === "CONFIRMED"
      ? "ACCESS CONFIRMED"
      : result?.status === "MANUAL_REVIEW"
      ? "MANUAL REVIEW"
      : "ACCESS REJECTED";

  const statusColor =
    result?.status === "CONFIRMED"
      ? "var(--success)"
      : result?.status === "MANUAL_REVIEW"
      ? "var(--warning)"
      : "var(--error)";

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-[var(--font-roboto)]">
      <TerminalHeader />

      {/* Three-Column Layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Left: Enrollment + Event Log */}
        <aside className="w-[300px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4 border-r border-[var(--divider)] bg-[var(--surface)]">
          <TerminalEnrollmentCard
            regId={regId}
            setRegId={setRegId}
            regName={regName}
            setRegName={setRegName}
            setRegFile={setRegFile}
            onRegister={registerFaculty}
          />
          <TerminalConsoleLogs logs={logs} logRef={logRef} />
        </aside>

        {/* Center: Video Viewfinder */}
        <TerminalScannerCard
          videoRef={videoRef}
          isActive={isActive}
          liveDemo={liveDemo}
          onStartCam={handleStartCam}
          onStopCam={handleStopCam}
          onVerifyCapture={() => verifyCapture(false)}
          onToggleLiveDemo={toggleLiveDemo}
        />

        {/* Right: Results + Faculty List */}
        <aside className="w-[320px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4 border-l border-[var(--divider)] bg-[var(--surface)]">
          <TerminalVerdictPanel
            result={result}
            totalTime={totalTime}
            simPct={simPct}
            livePct={livePct}
            qualPct={qualPct}
            statusLabel={statusLabel}
            statusColor={statusColor}
          />
          <TerminalProfilesList profiles={profiles} onDeleteProfile={deleteProfile} />
        </aside>
      </div>
    </div>
  );
}
