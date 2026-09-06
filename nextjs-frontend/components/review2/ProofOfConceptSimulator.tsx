import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, RotateCcw, Terminal, Play, Check } from "lucide-react";

type Scenario = "idle" | "genuine" | "spoof" | "geofence";

const STEPS = [
  { id: 1, label: "BYOD Ingress",   ms: 20  },
  { id: 2, label: "Campus Wi-Fi",   ms: 8   },
  { id: 3, label: "FastAPI Router", ms: 2   },
  { id: 4, label: "SCRFD Detect",   ms: 42  },
  { id: 5, label: "Affine Norm",    ms: 5   },
  { id: 6, label: "Liveness Gate",  ms: 38  },
  { id: 7, label: "ArcFace Embed",  ms: 32  },
  { id: 8, label: "Vector Search",  ms: 2   },
  { id: 9, label: "Geofence Check", ms: 1   },
];

export default function ProofOfConceptSimulator() {
  const [scenario, setScenario] = useState<Scenario>("idle");
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  const ts = () => new Date().toLocaleTimeString();

  const trigger = (s: Scenario) => {
    setScenario(s);
    setStep(0);
    setElapsed(0);
    setLogs([`[${ts()}] ▶ Initiating ${s.toUpperCase()} edge pipeline simulation...`]);
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
      if (scenario === "spoof" && step === 5) {
        setLogs(p => [...p, `[${ts()}] 🚨 LIVENESS REJECTION · MiniFASNet score 0.11 < 0.40 threshold. Circuit breaker tripped.`]);
        setRunning(false);
        return;
      }
      if (scenario === "geofence" && step === 8) {
        setLogs(p => [...p, `[${ts()}] ⚠ GEOFENCE BREACH · GPS fix outside NITT campus polygon boundary.`]);
        setRunning(false);
        return;
      }
      setLogs(p => [...p, `[${ts()}] ✓ Stage ${step + 1} (${cur.label}) completed in ${cur.ms}ms`]);
      setElapsed(e => e + cur.ms);
      setStep(s => s + 1);
    }, cur.ms * 4 + 70);

    return () => clearTimeout(t);
  }, [running, step, scenario]);

  useEffect(() => {
    if (step >= STEPS.length && running) {
      setLogs(p => [...p, `[${ts()}] ✅ VERIFIED · Attendance recorded. Sub-140ms edge cycle complete.`]);
      setRunning(false);
    }
  }, [step, running]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const halted = (scenario === "spoof" && step >= 6) || (scenario === "geofence" && step >= 9);
  const done = !running && step >= STEPS.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
              Section 03
            </span>
            <span className="text-xs font-medium text-zinc-400">Interactive Pipeline Demonstration</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Proof-of-Concept Edge Simulator</h2>
          <p className="text-sm text-zinc-500 mt-1">Live simulation of the 9-stage zero-cloud edge verification graph under distinct operational scenarios.</p>
        </div>

        {(step > 0 || scenario !== "idle") && (
          <button
            onClick={reset}
            className="self-start sm:self-center flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 px-3.5 py-2 rounded-xl bg-zinc-50 hover:bg-white transition-all cursor-pointer shadow-2xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Simulator
          </button>
        )}
      </div>

      {/* Scenario Triggers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            s: "genuine" as Scenario,
            icon: CheckCircle2,
            label: "Scenario A: Genuine Faculty Attendance",
            desc: "Live camera capture + valid GPS on campus polygon. Passes all 9 edge stages.",
            color: "emerald",
          },
          {
            s: "spoof" as Scenario,
            icon: ShieldAlert,
            label: "Scenario B: 2D Screen Replay Attack",
            desc: "Attacker replays video on phone screen. MiniFASNetV2 aborts at Stage 6.",
            color: "red",
          },
          {
            s: "geofence" as Scenario,
            icon: AlertTriangle,
            label: "Scenario C: Off-Campus Geofence Breach",
            desc: "Valid facial biometric captured outside campus boundary. Denied at Stage 9.",
            color: "amber",
          },
        ].map(({ s, icon: Icon, label, desc, color }) => {
          const isSelected = scenario === s;
          return (
            <button
              key={s}
              onClick={() => trigger(s)}
              disabled={running}
              className={`p-5 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isSelected
                  ? color === "emerald"
                    ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-200 shadow-xs"
                    : color === "red"
                    ? "border-rose-300 bg-rose-50/80 ring-2 ring-rose-200 shadow-xs"
                    : "border-amber-300 bg-amber-50/80 ring-2 ring-amber-200 shadow-xs"
                  : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    color === "emerald"
                      ? "bg-emerald-100 text-emerald-700"
                      : color === "red"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Play className="h-3 w-3" /> Simulate
                </span>
              </div>
              <p className="text-sm font-bold text-zinc-900 leading-snug">{label}</p>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{desc}</p>
            </button>
          );
        })}
      </div>

      {/* 9-Stage Stepper Progress Card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-sm font-bold text-zinc-900">Pipeline Execution Graph</h4>
            <p className="text-xs text-zinc-500">Real-time edge hop telemetry</p>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white border border-zinc-200 text-zinc-700 shadow-2xs">
            {elapsed} ms accumulated
          </span>
        </div>

        {/* Stepper Bar */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-[700px]">
            {STEPS.map((s, i) => {
              const isPassed = step > s.id;
              const isActive = step === s.id && running;
              const isHalted =
                halted &&
                ((scenario === "spoof" && s.id === 6) || (scenario === "geofence" && s.id === 9));

              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className={`h-9 w-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                        isHalted
                          ? "border-rose-500 bg-rose-500 text-white"
                          : isActive
                          ? "border-indigo-600 bg-indigo-600 text-white animate-pulse ring-4 ring-indigo-100"
                          : isPassed
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-zinc-200 bg-white text-zinc-400"
                      }`}
                    >
                      {isPassed && !isHalted ? <Check className="h-4 w-4 stroke-[3]" /> : s.id}
                    </div>
                    <p
                      className={`text-[11px] font-semibold text-center leading-tight w-16 ${
                        isHalted
                          ? "text-rose-600 font-bold"
                          : isActive
                          ? "text-indigo-700 font-bold"
                          : isPassed
                          ? "text-emerald-700"
                          : "text-zinc-400"
                      }`}
                    >
                      {s.label}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-400">{s.ms}ms</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 mb-8 transition-all ${
                        isPassed ? "bg-emerald-400" : "bg-zinc-200"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2-Column Verdict Panel & Console Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Verdict Card */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 mb-4">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Verification Verdict</span>
              <span className="text-xs font-mono font-medium text-zinc-400">Decision Engine</span>
            </div>

            {scenario === "idle" || step === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400">
                Click any scenario button above to trigger real-time edge verification.
              </div>
            ) : scenario === "genuine" && done ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Attendance Successfully Recorded</p>
                    <p className="text-xs text-emerald-700">All biometric, liveness, and campus polygon constraints satisfied.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Faculty ID", "Dr. K.V. Ramanathan (@FAC204)"],
                    ["Verified Location", "Academic Block 1 (In Geofence)"],
                    ["Cosine Match", "98.4% Confidence (Threshold ≥ 70%)"],
                    ["Liveness Score", "0.96 Genuine (Threshold ≥ 0.40)"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white rounded-xl border border-zinc-200 p-3.5 shadow-2xs">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">{k}</p>
                      <p className="text-xs font-bold text-zinc-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : scenario === "spoof" && halted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                  <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-rose-900">Presentation Attack Intercepted</p>
                    <p className="text-xs text-rose-700">MiniFASNetV2 detected 2D screen moiré and artificial glare at Stage 6.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Attack Vector", "High-Resolution Display Replay"],
                    ["Liveness Confidence", "0.11 (Threshold ≥ 0.40)"],
                    ["Circuit Breaker", "Tripped at Stage 6 (ArcFace Aborted)"],
                    ["Cloud API Penalty", "$0.00 — Fully Isolated on Edge"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white rounded-xl border border-zinc-200 p-3.5 shadow-2xs">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">{k}</p>
                      <p className="text-xs font-bold text-zinc-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : scenario === "geofence" && halted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Geofence Boundary Violation</p>
                    <p className="text-xs text-amber-700">Jordan curve ray-casting detected GPS fix outside NITT campus bounds.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["GPS Location", "10.9250°N, 76.9300°E (Off-Campus)"],
                    ["Polygon Test", "Ray-casting: 0 Intersections"],
                    ["Biometric Status", "ArcFace Match Passed (Uncommitted)"],
                    ["Security Action", "Access Rejected & Audit Logged"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white rounded-xl border border-zinc-200 p-3.5 shadow-2xs">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">{k}</p>
                      <p className="text-xs font-bold text-zinc-800">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : running ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-indigo-600">
                <div className="h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <span className="text-xs font-bold">Executing Stage {step}: {STEPS[step - 1]?.label}...</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Real-time System Log Console */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-mono font-bold">
              <Terminal className="h-4 w-4 text-indigo-400" />
              <span>RPi5 ARM64 System Journal</span>
            </div>
            {running ? (
              <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                RUNNING
              </span>
            ) : (
              <span className="text-[10px] font-mono text-zinc-500">IDLE</span>
            )}
          </div>

          <div ref={logsRef} className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs h-56 pr-2">
            {logs.length === 0 ? (
              <p className="text-zinc-600 italic">No events recorded. Trigger a scenario to view pipeline log.</p>
            ) : (
              logs.map((line, idx) => {
                const isError = line.includes("🚨") || line.includes("REJECTION");
                const isWarn = line.includes("⚠") || line.includes("BREACH");
                const isSuccess = line.includes("✅") || line.includes("VERIFIED");
                return (
                  <p
                    key={idx}
                    className={`leading-relaxed ${
                      isError
                        ? "text-rose-400 font-semibold"
                        : isWarn
                        ? "text-amber-400 font-semibold"
                        : isSuccess
                        ? "text-emerald-400 font-semibold"
                        : "text-zinc-400"
                    }`}
                  >
                    {line}
                  </p>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
