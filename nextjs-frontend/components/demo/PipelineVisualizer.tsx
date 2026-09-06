import React from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SimulationMode } from "./ScenarioControls";

export interface PipelineStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  latency: string;
  details: string;
  color: string;
  activeColor: string;
}

interface PipelineVisualizerProps {
  steps: PipelineStep[];
  activeStep: number;
  mode: SimulationMode;
}

export default function PipelineVisualizer({
  steps,
  activeStep,
  mode,
}: PipelineVisualizerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {steps.map((step) => {
        const isCurrent = activeStep === step.id;
        const isPast = activeStep > step.id;
        const isSpoofedAtThisStep = mode === "spoof" && step.id === 6 && activeStep >= 6;
        const isGeofenceFailedAtThisStep =
          mode === "geofence_fail" && step.id === 9 && activeStep >= 9;

        const IconComponent = step.icon;

        return (
          <div
            key={step.id}
            className={`relative rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between ${
              isSpoofedAtThisStep
                ? "border-rose-500 bg-rose-950/40 shadow-[0_0_25px_rgba(244,63,94,0.5)] ring-2 ring-rose-500"
                : isGeofenceFailedAtThisStep
                ? "border-amber-500 bg-amber-950/40 shadow-[0_0_25px_rgba(245,158,11,0.5)] ring-2 ring-amber-500"
                : isCurrent
                ? step.activeColor
                : isPast
                ? "border-slate-800 bg-slate-900/40 opacity-70"
                : "border-slate-800/60 bg-slate-950/50 opacity-40"
            }`}
          >
            {/* Step Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      isSpoofedAtThisStep
                        ? "bg-rose-500 text-white"
                        : isCurrent
                        ? "bg-cyan-500 text-white animate-pulse"
                        : isPast
                        ? "bg-slate-800 text-slate-300"
                        : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400">
                      STAGE 0{step.id}
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-tight">{step.title}</h3>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    isCurrent
                      ? "bg-cyan-950 text-cyan-300 border-cyan-700"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}
                >
                  {step.latency}
                </span>
              </div>

              <div className="text-xs font-medium text-slate-300 mb-1">{step.subtitle}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{step.details}</p>
            </div>

            {/* Status Indicator at bottom of card */}
            <div className="mt-4 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Status</span>
              {isSpoofedAtThisStep ? (
                <span className="font-bold text-rose-400 flex items-center space-x-1">
                  <ShieldAlert className="h-3 w-3" />
                  <span>SPOOF DETECTED (REJECTED)</span>
                </span>
              ) : isGeofenceFailedAtThisStep ? (
                <span className="font-bold text-amber-400 flex items-center space-x-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>OFF-CAMPUS (REJECTED)</span>
                </span>
              ) : isCurrent ? (
                <span className="font-bold text-cyan-400 flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>PROCESSING ON ARM64...</span>
                </span>
              ) : isPast ? (
                <span className="font-bold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>COMPLETED</span>
                </span>
              ) : (
                <span className="text-slate-600">STANDBY</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
