"use client";

import React from "react";
import Link from "next/link";
import { Cpu, ArrowLeft, Activity, ExternalLink } from "lucide-react";

export default function Review2Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-xs sticky top-0 z-50 w-full">
      <div className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 h-11 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/dashboard"
            className="h-7 w-7 flex-shrink-0 rounded-md bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-2xs overflow-hidden p-0.5"
            title="Amrita Vishwa Vidyapeetham"
          >
            <img src="/amrita-favicon.png" alt="Amrita Vishwa Vidyapeetham" className="h-full w-full object-contain" />
          </Link>
          <span className="font-semibold text-slate-900 text-xs sm:text-sm tracking-tight">Hypersphere Engine</span>
          <span className="text-slate-300 text-xs">/</span>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
            Review 2 · POC
          </span>
        </div>

        {/* Right */}
        <nav className="flex items-center gap-1.5 text-xs shrink-0">
          <Link
            href="/geofence"
            className="h-7 px-2.5 rounded-md border border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 text-[11px] font-semibold"
            title="Interactive Leaflet Campus Map with 103 extracted OSM buildings"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Amrita Map</span>
            <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1 py-0.2 rounded font-mono">103</span>
          </Link>
          <Link
            href="/dashboard"
            className="h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-[11px]"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline font-medium">Dashboard</span>
          </Link>
          <Link
            href="/demo"
            className="h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-[11px]"
          >
            <span className="hidden sm:inline font-medium">Live Pipeline</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/admin/health"
            className="h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white transition-colors flex items-center gap-1.5 font-medium text-xs shadow-xs"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            Telemetry
          </Link>
        </nav>
      </div>
    </header>
  );
}
