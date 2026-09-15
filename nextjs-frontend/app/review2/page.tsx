"use client";

import React from "react";
import Review2Header from "@/components/review2/Review2Header";
import SystemDesignSection from "@/components/review2/SystemDesignSection";
import ModelAnalysisSection from "@/components/review2/ModelAnalysisSection";
import ProofOfConceptSimulator from "@/components/review2/ProofOfConceptSimulator";
import HardwareTelemetryPillar from "@/components/review2/HardwareTelemetryPillar";
import RubricsComplianceSection from "@/components/review2/RubricsComplianceSection";
import { Zap, ShieldCheck, Cpu } from "lucide-react";

export default function Review2DefensePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col items-center w-full">
      <Review2Header />

      {/* ─── Hero Section ─── */}
      <div className="bg-white border-b border-slate-200/80 w-full flex justify-center">
        <div className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 pt-8 pb-6">

          {/* Hero Header */}
          <div className="flex flex-col items-center text-center w-full max-w-5xl mx-auto mb-6">
            {/* Status Badges - Only CCE Open Lab I */}
            <div className="flex items-center justify-center mb-3">
              <span className="text-xs font-semibold px-3 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                CCE Open Lab I
              </span>
            </div>

            {/* Title - Linear & Centered Single Line */}
            <h1 className="text-xl sm:text-2xl lg:text-[28px] font-extrabold tracking-tight text-slate-900 leading-tight mb-2.5 w-full text-center whitespace-nowrap">
              AI-Powered Smart Presence using Face Recognition and Advanced Geofencing
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl mx-auto">
              Autonomous zero-cloud verification pipeline on Raspberry Pi 5 ARM64 — sub-140 ms E2E latency, presentation attack defense, and polygon campus boundary validation.
            </p>
          </div>

          {/* 3 KPI Stat Cards — Value First with Reconciled Latency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              { icon: Zap, iconColor: "text-indigo-600", iconBg: "bg-indigo-50 border-indigo-100", label: "E2E Pipeline Latency", value: "138 ms", sub: "117 ms neural + 21 ms edge (Budget: <140 ms)" },
              { icon: ShieldCheck, iconColor: "text-emerald-600", iconBg: "bg-emerald-50 border-emerald-100", label: "Attack Interception", value: "Dual Circuit Breaker", sub: "Spoof (Stage 6) + Geofence (Stage 9)" },
              { icon: Cpu, iconColor: "text-amber-600", iconBg: "bg-amber-50 border-amber-100", label: "Embedded Footprint", value: "23.6 MB", sub: "4 ONNX models · ARM64 NEON SIMD" },
            ].map((kpi, i) => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 transition-colors shadow-2xs">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{kpi.label}</p>
                  <p className="text-xl font-bold font-mono text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{kpi.sub}</p>
                </div>
                <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${kpi.iconBg} ${kpi.iconColor}`}>
                  <kpi.icon className="h-4.5 w-4.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Sticky Section Nav — Centered Mission Control Navigation Bar ─── */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-11 z-40 shadow-xs w-full py-2.5">
        <div className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 flex items-center justify-center relative">
          
          <nav className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 text-white rounded-xl p-1.5 shadow-md border border-slate-800">
            {[
              ["#system-design", "System Design", "01"],
              ["#model-analysis", "Model Benchmarks", "02"],
              ["#proof-of-concept", "POC Simulator", "03"],
              ["#hardware-telemetry", "Telemetry", "04"],
              ["#rubrics", "Rubric Compliance", "05"],
            ].map(([href, label, num]) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold text-slate-200 hover:text-white hover:bg-slate-800 active:bg-indigo-600 transition-all whitespace-nowrap"
              >
                <span className="text-[10px] sm:text-[11px] font-mono font-extrabold text-indigo-400 bg-indigo-950/90 border border-indigo-700/60 px-1.5 py-0.5 rounded">{num}</span>
                <span>{label}</span>
              </a>
            ))}
          </nav>

          <div className="hidden xl:flex items-center gap-2 absolute right-4 sm:right-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Pi 5 Hardware Active
            </span>
          </div>
        </div>
      </div>

      {/* ─── Main Content — Clean Symmetrical Padding (Half Previous Width) ─── */}
      <main className="max-w-[1340px] mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-8 flex-1">

        <section id="system-design" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <SystemDesignSection />
        </section>

        <section id="model-analysis" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <ModelAnalysisSection />
        </section>

        <section id="proof-of-concept" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <ProofOfConceptSimulator />
        </section>

        <section id="hardware-telemetry" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <HardwareTelemetryPillar />
        </section>

        <section id="rubrics" className="scroll-mt-32 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <RubricsComplianceSection />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center">
        <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Hypersphere Engine · Review 2 Defense Console</p>
      </footer>
    </div>
  );
}
