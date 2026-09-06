import React from "react";
import { Thermometer, Activity, Server } from "lucide-react";

interface HardwareTelemetryProps {
  cpuTemp: number;
  cpuUsage: number;
  ramUsage: number;
}

export default function HardwareTelemetry({
  cpuTemp,
  cpuUsage,
  ramUsage,
}: HardwareTelemetryProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/60 to-slate-950 p-5 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center space-x-2 text-xs text-cyan-400 font-semibold mb-1">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>23ECE381 / 23CCE381 OPEN LABORATORY - I</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">REVIEW 2 (SEPTEMBER 2026)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            IoT Edge Architecture &amp; Dataflow Demonstration
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Demonstrating full edge autonomy on Raspberry Pi 4/5 hardware. No cloud servers, no recurring subscription costs, sub-200ms end-to-end verification, and robust presentation attack defense.
          </p>
        </div>

        {/* Hardware Status Pill */}
        <div className="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 rounded-lg p-3">
          <div className="flex flex-col items-center px-2">
            <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
              <Thermometer className="h-3 w-3 text-amber-400" />
              <span>CPU Temp</span>
            </div>
            <span className="text-sm font-bold text-amber-400 mt-0.5">{cpuTemp}°C</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div className="flex flex-col items-center px-2">
            <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
              <Activity className="h-3 w-3 text-cyan-400" />
              <span>CPU Load</span>
            </div>
            <span className="text-sm font-bold text-cyan-400 mt-0.5">{cpuUsage}%</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div className="flex flex-col items-center px-2">
            <div className="flex items-center space-x-1 text-slate-400 text-[11px]">
              <Server className="h-3 w-3 text-emerald-400" />
              <span>Edge RAM</span>
            </div>
            <span className="text-sm font-bold text-emerald-400 mt-0.5">{ramUsage} MB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
