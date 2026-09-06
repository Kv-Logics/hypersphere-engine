import React from "react";
import Link from "next/link";
import { Cpu, ChevronRight, Activity, ArrowLeft } from "lucide-react";

export default function Review2Header() {
  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="h-8 w-8 flex-shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 transition-colors"
          >
            <Cpu className="h-4 w-4 text-white" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-zinc-900 text-sm whitespace-nowrap tracking-tight">
                Hypersphere Engine
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
                Review 2 · POC
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 whitespace-nowrap hidden md:inline-block">
                RPi ARM64 Edge Gateway
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              System Design, Deep ML Analysis &amp; Interactive Edge Demo
            </p>
          </div>
        </div>

        {/* Right: Nav links */}
        <nav className="flex items-center gap-2 text-xs shrink-0">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Faculty Portal</span>
          </Link>
          <Link
            href="/demo"
            className="px-3 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 transition-colors flex items-center gap-1.5"
          >
            <span>Live Pipeline</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/health"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-600 transition-colors flex items-center gap-1.5"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Telemetry</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
