import React from "react";
import { CheckCircle2, ShieldAlert, AlertTriangle, RotateCcw } from "lucide-react";

export type SimulationMode = "idle" | "genuine" | "spoof" | "geofence_fail";

interface ScenarioControlsProps {
  mode: SimulationMode;
  isRunning: boolean;
  activeStep: number;
  onStartSimulation: (mode: SimulationMode) => void;
  onReset: () => void;
}

export default function ScenarioControls({
  mode,
  isRunning,
  activeStep,
  onStartSimulation,
  onReset,
}: ScenarioControlsProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
            Select Interactive Demonstration Scenario:
          </span>
          <p className="text-xs text-slate-500 mt-0.5">
            Click a scenario to initiate real-time packet traversal through the embedded pipeline:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-test-genuine"
            onClick={() => onStartSimulation("genuine")}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
              mode === "genuine" && isRunning
                ? "bg-emerald-600 text-white shadow-emerald-500/25 ring-2 ring-emerald-400"
                : "bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60"
            } disabled:opacity-50`}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>1. Test Genuine Faculty Attendance</span>
          </button>

          <button
            id="btn-test-spoof"
            onClick={() => onStartSimulation("spoof")}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
              mode === "spoof" && isRunning
                ? "bg-rose-600 text-white shadow-rose-500/25 ring-2 ring-rose-400"
                : "bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60"
            } disabled:opacity-50`}
          >
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>2. Test Screen-Replay Spoof Attack</span>
          </button>

          <button
            id="btn-test-geofence"
            onClick={() => onStartSimulation("geofence_fail")}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
              mode === "geofence_fail" && isRunning
                ? "bg-amber-600 text-white shadow-amber-500/25 ring-2 ring-amber-400"
                : "bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60"
            } disabled:opacity-50`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span>3. Test Off-Campus Breach</span>
          </button>

          {(mode !== "idle" || activeStep > 0) && (
            <button
              onClick={onReset}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Reset Flow"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
