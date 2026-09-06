import React from "react";
import Link from "next/link";
import { Cpu, ChevronRight, Activity } from "lucide-react";

export default function DemoHeader() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white text-base">HYPERSPHERE ENGINE</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                Review 2 Live Flow
              </span>
            </div>
            <p className="text-xs text-slate-400">
              IoT Edge Biometric Architecture Demo (Raspberry Pi ARM64)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center space-x-1"
          >
            <span>User Portal</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/health"
            className="px-3 py-1.5 rounded-md bg-cyan-950 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 transition-colors flex items-center space-x-1"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Admin Telemetry</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
