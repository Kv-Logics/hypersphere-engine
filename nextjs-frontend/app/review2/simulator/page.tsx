"use client";

import React from "react";
import Link from "next/link";
import Review2Header from "@/components/review2/Review2Header";
import VisualPipelineSimulator from "@/components/review2/VisualPipelineSimulator";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function SimulatorDedicatedPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col items-center w-full">
      <Review2Header />

      {/* Top Banner Navigation */}
      <div className="bg-white border-b border-slate-200/80 w-full flex justify-center">
        <div className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/review2"
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Review 2 Defense Console</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
              CCE Open Lab I
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Dedicated Simulation Engine
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 py-6 flex flex-col flex-1">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <VisualPipelineSimulator isStandalone={true} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center w-full">
        <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Hypersphere Engine · Standalone Verification Simulator · Amrita Vishwa Vidyapeetham
        </p>
      </footer>
    </div>
  );
}
