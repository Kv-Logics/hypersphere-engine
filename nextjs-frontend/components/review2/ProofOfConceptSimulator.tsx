"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Terminal,
  Play,
  ShieldCheck,
  Clock,
  Check,
  X,
  Zap,
  Activity,
  ChevronRight,
  Camera
} from "lucide-react";

type Scenario = "idle" | "genuine" | "spoof" | "geofence";

interface StepConfig {
  id: number;
  name: string;
  category: "Client" | "Network" | "Gateway" | "AI Detection" | "AI Alignment" | "AI Liveness" | "AI ArcFace" | "VectorDB" | "Geofence";
  sub: string;
  ms: number;
}

// Reconciled to exact 138 ms total (117 ms neural inference + 21 ms edge infrastructure)
const STEPS: StepConfig[] = [
  { id: 1, name: "BYOD Capture", category: "Client", sub: "WebRTC + GPS", ms: 12 },
  { id: 2, name: "Campus Wi-Fi", category: "Network", sub: "Private LAN", ms: 5 },
  { id: 3, name: "RPi 5 Gateway", category: "Gateway", sub: "FastAPI Ingress", ms: 1 },
  { id: 4, name: "SCRFD Detect", category: "AI Detection", sub: "Face & 5 Landmarks", ms: 42 },
  { id: 5, name: "Affine Norm", category: "AI Alignment", sub: "Canonical 112×112 Warp", ms: 5 },
  { id: 6, name: "Liveness Gate", category: "AI Liveness", sub: "MiniFASNetV2 Fourier", ms: 38 },
  { id: 7, name: "ArcFace Embed", category: "AI ArcFace", sub: "512-D Unit Hypersphere", ms: 32 },
  { id: 8, name: "Vector Search", category: "VectorDB", sub: "Cosine Match vs 730", ms: 2 },
  { id: 9, name: "Geofence Check", category: "Geofence", sub: "Jordan Ray-Casting", ms: 1 },
];

const SCENARIOS = [
  {
    id: "genuine" as Scenario,
    title: "1. Genuine Attendance",
    badge: "BENCHMARK TEST",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc: "Authorized faculty presenting live face from inside campus boundary. All 9 pipeline stages execute to completion.",
    action: "Execute Genuine Verification",
    btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
    expected: "138 ms E2E · Authorized"
  },
  {
    id: "spoof" as Scenario,
    title: "2. Screen Replay Attack",
    badge: "DEFENSE TEST",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    desc: "Adversary replays video playback. MiniFASNetV2 detects display moiré and triggers circuit breaker at Stage 06, saving compute.",
    action: "Simulate Presentation Attack",
    btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
    expected: "Circuit Breaker at 103 ms · Bypassed"
  },
  {
    id: "geofence" as Scenario,
    title: "3. Geofence Boundary Breach",
    badge: "LOCATION TEST",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    desc: "Valid facial biometric presented, but GPS coordinates lie outside Amrita campus boundary polygons. Intercepted at Stage 09.",
    action: "Simulate Boundary Breach",
    btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
    expected: "Denied at Stage 09 · Outside Campus"
  },
];

interface LogEntry {
  ts: string;
  source: string;
  level: "INFO" | "PASS" | "INTERCEPT" | "DENIED" | "SUCCESS";
  duration?: string;
  msg: string;
  detail?: string;
}

export default function ProofOfConceptSimulator() {
  const [scenario, setScenario] = useState<Scenario>("idle");
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  const getTs = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  const trigger = (s: Scenario) => {
    setScenario(s);
    setStep(0);
    setElapsed(0);
    setLogs([
      {
        ts: getTs(),
        source: "INGRESS",
        level: "INFO",
        msg: `ARM64 pipeline armed for test: ${s.toUpperCase()}`,
        detail: "FastAPI ASGI worker initialized on Raspberry Pi 5 core 0"
      }
    ]);
    setRunning(true);
  };

  const reset = () => {
    setScenario("idle");
    setStep(0);
    setElapsed(0);
    setLogs([]);
    setRunning(false);
  };

  useEffect(() => {
    if (!running || step >= STEPS.length) return;
    const cur = STEPS[step];
    const t = setTimeout(() => {
      // Circuit breaker for spoof at Stage 6 (index 5)
      if (scenario === "spoof" && step === 5) {
        setLogs((prev) => [
          ...prev,
          {
            ts: getTs(),
            source: "LIVENESS",
            level: "INTERCEPT",
            duration: "38 ms",
            msg: "MiniFASNetV2 computed liveness score: 0.112 (Threshold: >= 0.400)",
            detail: "Display pixel grid & moiré detected. Classification: SCREEN_REPLAY"
          },
          {
            ts: getTs(),
            source: "BREAKER",
            level: "INTERCEPT",
            duration: "0 ms",
            msg: "🚨 Circuit breaker tripped at Stage 06. ArcFace bypassed.",
            detail: "Stages 07, 08, 09 skipped. Saved 35 ms & ~15% ARM64 CPU compute budget"
          }
        ]);
        setRunning(false);
        return;
      }

      // Geofence denial at Stage 9 (index 8)
      if (scenario === "geofence" && step === 8) {
        setLogs((prev) => [
          ...prev,
          {
            ts: getTs(),
            source: "GEOFENCE",
            level: "DENIED",
            duration: "1 ms",
            msg: "Coordinates (10.9250°N, 76.9300°E) evaluated via Jordan ray-casting",
            detail: "Ray intersections: 0. Point lies outside Amrita campus boundary"
          }
        ]);
        setRunning(false);
        return;
      }

      setLogs((prev) => [
        ...prev,
        {
          ts: getTs(),
          source: `STAGE 0${step + 1}`,
          level: "PASS",
          duration: `${cur.ms} ms`,
          msg: `${cur.name} executed successfully`,
          detail: cur.sub
        }
      ]);
      setElapsed((e) => e + cur.ms);
      setStep((s) => s + 1);
    }, cur.ms * 4 + 60);

    return () => clearTimeout(t);
  }, [running, step, scenario]);

  useEffect(() => {
    if (step >= STEPS.length && running) {
      setLogs((prev) => [
        ...prev,
        {
          ts: getTs(),
          source: "DECISION",
          level: "SUCCESS",
          duration: "138 ms",
          msg: "✅ Dr. K.V. (@FAC204) verified. Attendance committed to SQLite.",
          detail: "Total E2E latency: 138 ms (117 ms neural + 21 ms edge) · Budget: <140 ms [PASSED]"
        }
      ]);
      setRunning(false);
    }
  }, [step, running]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const isSpoofHalted = scenario === "spoof" && step >= 6;
  const isGeofenceHalted = scenario === "geofence" && step >= 9;
  const isCompleteSuccess = scenario === "genuine" && step >= 9 && !running;

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-md">
              03 · Verification Console
            </span>
            <span className="text-xs text-slate-500 font-semibold">Hardware-in-the-Loop Edge Pipeline Simulator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            End-to-End Edge Verification Console
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Execute real-time pipeline benchmarks demonstrating genuine authentication, presentation attack circuit breaker, and polygon geofence verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <Link
            href="/review2/simulator"
            className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            title="Open Dedicated Fullscreen Live Webcam & Face Landmark Tracking Simulator"
          >
            <Camera className="h-3.5 w-3.5 text-indigo-600" />
            <span>Live Webcam Simulator</span>
          </Link>
          {scenario !== "idle" && (
            <button
              onClick={reset}
              className="px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="h-3 w-3 text-slate-400" />
              Reset Console
            </button>
          )}
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
            Pipeline Clock: <strong className="text-indigo-600 font-bold">{elapsed} ms</strong> <span className="text-[11px] text-slate-400 font-normal">/ 138 ms</span>
          </span>
        </div>
      </div>

      {/* Top Test Scenario Selector Bar */}
      <div className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCENARIOS.map((scen) => {
            const isSelected = scenario === scen.id;
            return (
              <div
                key={scen.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isSelected
                    ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${scen.badgeClass}`}>
                      {scen.badge}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {scen.expected}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    {scen.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    {scen.desc}
                  </p>
                </div>

                <button
                  onClick={() => trigger(scen.id)}
                  disabled={running}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${scen.btnColor} ${
                    running ? "opacity-60 cursor-not-allowed" : "hover:shadow-xs"
                  }`}
                >
                  {isSelected && running ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                      Executing Pipeline...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 fill-current" />
                      {scen.action}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9-Stage Pipeline Stepper with Authoritative States */}
      <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              9-Stage Hardware Execution Pipeline
            </span>
            <span className="text-[11px] font-mono text-slate-400">· 117 ms Neural + 21 ms Edge = 138 ms E2E</span>
          </div>

          {running ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
              Stage {step + 1} of 9 Active
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">
              {scenario === "idle" ? "Standby" : "Execution Finished"}
            </span>
          )}
        </div>

        {/* Dense 9 Steps Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
          {STEPS.map((s) => {
            const isCurrent = step === s.id && running;
            const isPassed = step > s.id;
            const isHaltedAtSpoof = isSpoofHalted && s.id === 6;
            const isHaltedAtGeo = isGeofenceHalted && s.id === 9;
            const isBypassed = (isSpoofHalted && s.id > 6) || (isGeofenceHalted && s.id > 9);

            return (
              <div
                key={s.id}
                className={`rounded-lg border p-2 flex flex-col items-center text-center transition-all ${
                  isHaltedAtSpoof || isHaltedAtGeo
                    ? "bg-rose-50 border-rose-400 ring-2 ring-rose-400/40 text-rose-800 shadow-2xs"
                    : isBypassed
                    ? "border-dashed border-slate-300 bg-slate-100/70 opacity-60 text-slate-400"
                    : isCurrent
                    ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/40 shadow-2xs text-indigo-900"
                    : isPassed
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center mb-1 transition-transform ${
                    isHaltedAtSpoof || isHaltedAtGeo
                      ? "bg-rose-600 text-white"
                      : isBypassed
                      ? "bg-slate-300 text-slate-600"
                      : isCurrent
                      ? "bg-indigo-600 text-white scale-105"
                      : isPassed
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isHaltedAtSpoof || isHaltedAtGeo ? (
                    <X className="h-3.5 w-3.5" />
                  ) : isPassed ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : (
                    s.id
                  )}
                </div>

                <p className="text-xs font-bold leading-tight">
                  {s.name}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5 leading-tight">
                  {s.sub}
                </p>

                <div className="mt-1.5 flex items-center gap-1">
                  <span className="font-mono text-[10px] font-bold bg-white/90 border border-slate-200/80 px-1 py-0.2 rounded">
                    {s.ms} ms
                  </span>
                </div>

                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                  {isHaltedAtSpoof || isHaltedAtGeo
                    ? "BLOCKED"
                    : isBypassed
                    ? "BYPASSED"
                    : isCurrent
                    ? "RUNNING"
                    : isPassed
                    ? "PASSED"
                    : "PENDING"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Circuit Breaker Callout Banner on Spoof Attack */}
      {isSpoofHalted && (
        <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-950 uppercase tracking-wide flex items-center gap-2">
                Hardware Circuit Breaker Tripped at Stage 06 (Liveness Gate)
              </p>
              <p className="text-xs text-rose-800 mt-0.5">
                MiniFASNetV2 flagged screen replay (score: 0.112 &lt; threshold 0.400). ArcFace, Vector Search, and Geofence were safely bypassed.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-rose-900 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto shadow-2xs">
            35 ms &amp; ~15% CPU Saved
          </span>
        </div>
      )}

      {/* 2-Column Observability & Verdict Console */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Mission-Control Verdict Console */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-indigo-600" />
                Pi 5 Verification Verdict
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ARM64 Decision Gateway
              </span>
            </div>

            {scenario === "idle" || (step === 0 && !running) ? (
              <div className="py-10 text-center">
                <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Awaiting Test Trigger</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click one of the 3 test actions above to execute real-time authentication on the Raspberry Pi 5.
                </p>
              </div>
            ) : running ? (
              <div className="py-10 text-center space-y-3">
                <div className="inline-block p-3 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 animate-spin">
                  <Clock className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">
                    Executing Stage 0{step + 1} of 9
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {STEPS[step]?.name} ({STEPS[step]?.sub}) · {STEPS[step]?.ms} ms
                  </p>
                </div>
              </div>
            ) : isCompleteSuccess ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-white border border-emerald-200 px-2 py-0.2 rounded">
                      VERDICT: AUTHORIZED
                    </span>
                    <h4 className="text-base font-bold text-emerald-950 mt-0.5">
                      Biometric Attendance Verified
                    </h4>
                    <p className="text-xs text-emerald-800">
                      Identity confirmed on unit hypersphere &amp; geofenced inside campus boundary.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Verified Staff</span>
                    <span className="text-sm font-bold text-slate-900">Dr. K.V. (@FAC204)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Cosine Distance</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">0.984 (Match &ge; 0.65)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Liveness Score</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">0.988 (Genuine &ge; 0.40)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Geofence Venue</span>
                    <span className="text-sm font-bold text-slate-900">Academic Block 1</span>
                  </div>
                </div>
              </div>
            ) : isSpoofHalted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="h-10 w-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-white border border-rose-200 px-2 py-0.2 rounded">
                      VERDICT: INTERCEPTED
                    </span>
                    <h4 className="text-base font-bold text-rose-950 mt-0.5">
                      Presentation Attack Blocked
                    </h4>
                    <p className="text-xs text-rose-800">
                      Circuit breaker tripped at Stage 06 (MiniFASNetV2).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Attack Artifact</span>
                    <span className="text-xs font-bold text-rose-700">Smartphone Display Replay</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Liveness Score</span>
                    <span className="text-xs font-bold font-mono text-rose-700">0.112 (Threshold: &ge; 0.400)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 col-span-2">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Defense Action</span>
                    <span className="text-xs font-semibold text-emerald-800">
                      ArcFace inference bypassed. Saved 35 ms &amp; ~15% ARM64 CPU compute budget.
                    </span>
                  </div>
                </div>
              </div>
            ) : isGeofenceHalted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="h-10 w-10 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-white border border-amber-200 px-2 py-0.2 rounded">
                      VERDICT: DENIED
                    </span>
                    <h4 className="text-base font-bold text-amber-950 mt-0.5">
                      Geofence Boundary Breach
                    </h4>
                    <p className="text-xs text-amber-800">
                      Rejected at Stage 09 by Jordan Curve Ray-Casting.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Biometric Match</span>
                    <span className="text-xs font-bold text-emerald-700">Valid Dr. K.V. (0.984)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Ray Intersections</span>
                    <span className="text-xs font-bold font-mono text-amber-700">0 (Outside Polygons)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 col-span-2">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase">Defense Action</span>
                    <span className="text-xs font-semibold text-rose-700">
                      Attendance rejected. Subject GPS lies outside Amrita campus boundary polygon.
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>FastAPI ASGI Handler: <code className="font-mono text-slate-700">POST /api/v1/verify</code></span>
            <span>Target Budget: <strong className="text-emerald-700 font-mono font-bold">&lt; 140 ms</strong></span>
          </div>
        </div>

        {/* Right: Structured Observability Log Terminal */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-2xs font-mono text-xs text-slate-200">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500/90" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/90" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/90" />
                </div>
                <span className="text-xs text-slate-400 font-semibold ml-1.5 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-slate-400" />
                  rpi5-gateway: journalctl -u hypersphere -f
                </span>
              </div>

              {running ? (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE STREAM
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-bold">IDLE</span>
              )}
            </div>

            {/* Structured Log Container with Left Padding */}
            <div
              ref={logsRef}
              className="h-56 overflow-y-auto space-y-2 text-[11px] leading-relaxed pl-3.5 pr-2.5 py-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 font-mono shadow-inner"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-6 text-center text-xs">
                  # System standing by. Click an execution test above to stream live Pi 5 events...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-slate-500 shrink-0 select-none text-[10px] mt-0.5">{log.ts}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 bg-slate-800 text-slate-300">
                      {log.source}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                      log.level === "SUCCESS" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                      log.level === "INTERCEPT" ? "bg-rose-950 text-rose-400 border border-rose-800" :
                      log.level === "DENIED" ? "bg-amber-950 text-amber-400 border border-amber-800" :
                      log.level === "PASS" ? "bg-slate-800 text-emerald-400" : "bg-slate-800 text-indigo-400"
                    }`}>
                      {log.level}
                    </span>
                    {log.duration && (
                      <span className="text-slate-400 font-mono text-[10px] shrink-0">
                        [{log.duration}]
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${
                        log.level === "SUCCESS" ? "text-emerald-300" :
                        log.level === "INTERCEPT" ? "text-rose-300" :
                        log.level === "DENIED" ? "text-amber-300" : "text-slate-200"
                      }`}>
                        {log.msg}
                      </p>
                      {log.detail && (
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                          {log.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>ONNX Runtime 1.17.1 (ARM64 NEON SIMD)</span>
            <span>Memory RSS: 284 MB / 4,096 MB</span>
          </div>
        </div>
      </div>
    </div>
  );
}

