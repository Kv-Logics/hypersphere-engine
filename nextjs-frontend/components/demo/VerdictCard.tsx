import React from "react";
import { Terminal, CheckCircle2, ShieldAlert, AlertTriangle } from "lucide-react";
import { SimulationMode } from "./ScenarioControls";

interface VerdictCardProps {
  mode: SimulationMode;
  activeStep: number;
  isRunning: boolean;
  currentStepTitle?: string;
}

export default function VerdictCard({
  mode,
  activeStep,
  isRunning,
  currentStepTitle,
}: VerdictCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-300 ${
        mode === "genuine" && activeStep >= 9
          ? "border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
          : mode === "spoof" && activeStep >= 6
          ? "border-rose-500/60 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(244,63,94,0.25)]"
          : mode === "geofence_fail" && activeStep >= 9
          ? "border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
          : "border-slate-800 bg-slate-950/60"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-1">
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span>REAL-TIME EDGE GATEWAY DECISION ENGINE</span>
          </div>

          {mode === "genuine" && activeStep >= 9 ? (
            <div>
              <h2 className="text-xl font-bold text-emerald-400 flex items-center space-x-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <span>ATTENDANCE CONFIRMED — ACCESS GRANTED</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Verified Faculty</span>
                  <span className="font-bold text-white text-sm">Dr. K. V. (ECE)</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Resolved Building</span>
                  <span className="font-bold text-emerald-400 text-sm">Academic Block 1</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Liveness Probability</span>
                  <span className="font-bold text-cyan-400 text-sm">0.96 (Pass)</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Total Turnaround</span>
                  <span className="font-bold text-amber-400 text-sm">139ms (RPi 5)</span>
                </div>
              </div>
            </div>
          ) : mode === "spoof" && activeStep >= 6 ? (
            <div>
              <h2 className="text-xl font-bold text-rose-400 flex items-center space-x-2">
                <ShieldAlert className="h-6 w-6 text-rose-400" />
                <span>PRESENTATION ATTACK DETECTED — TRANSACTION ABORTED</span>
              </h2>
              <p className="text-xs text-rose-300/80 mt-1 max-w-2xl">
                MiniFASNetV2 detected electronic display reflection and moir&eacute; frequency patterns.
                Softmax liveness score 0.11 &lt; 0.40 threshold. The system aborted execution before running
                ArcFace to save CPU thermals.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Attack Classification</span>
                  <span className="font-bold text-rose-400 text-sm">Smartphone Video Replay</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Liveness Score</span>
                  <span className="font-bold text-rose-400 text-sm">0.11 (Threshold: 0.40)</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Action Taken</span>
                  <span className="font-bold text-white text-sm">Incident Logged &amp; Blocked</span>
                </div>
              </div>
            </div>
          ) : mode === "geofence_fail" && activeStep >= 9 ? (
            <div>
              <h2 className="text-xl font-bold text-amber-400 flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
                <span>OUTSIDE CAMPUS GEOFENCE — ATTENDANCE FLAGGED</span>
              </h2>
              <p className="text-xs text-amber-300/80 mt-1 max-w-2xl">
                User GPS coordinates (lat: 10.9250, lon: 76.9300) fell outside the NIT Trichy campus polygon.
                Hardware accuracy radius: 180m (IP spoofing rejected).
              </p>
            </div>
          ) : isRunning ? (
            <div className="py-2">
              <h3 className="text-base font-bold text-cyan-400 flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                <span>
                  Processing Pipeline Stage 0{activeStep}: {currentStepTitle}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Executing embedded neural network graph on ARM Cortex-A76 cores...
              </p>
            </div>
          ) : (
            <div className="py-2">
              <h3 className="text-base font-bold text-slate-300">Awaiting Scenario Trigger</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select one of the three demonstration scenarios above to simulate live edge execution.
              </p>
            </div>
          )}
        </div>

        {/* Architecture Metrics Pillar */}
        <div className="border-t md:border-t-0 md:border-l border-slate-800 md:pl-6 flex flex-col justify-center space-y-1 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Embedded Architecture Proof
          </span>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-slate-400">Total Weights:</span>
            <span className="font-mono font-bold text-emerald-400">&lt; 25 MB</span>
          </div>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-slate-400">Power Consumption:</span>
            <span className="font-mono font-bold text-cyan-400">~7.5W (5V/1.5A)</span>
          </div>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-slate-400">Cloud Hosting Cost:</span>
            <span className="font-mono font-bold text-emerald-400">$0.00 / month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
