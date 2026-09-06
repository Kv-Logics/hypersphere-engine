"use client";

import React from "react";
import Review2Header from "@/components/review2/Review2Header";
import SystemDesignSection from "@/components/review2/SystemDesignSection";
import ModelAnalysisSection from "@/components/review2/ModelAnalysisSection";
import ProofOfConceptSimulator from "@/components/review2/ProofOfConceptSimulator";
import HardwareTelemetryPillar from "@/components/review2/HardwareTelemetryPillar";
import RubricsComplianceSection from "@/components/review2/RubricsComplianceSection";

export default function Review2DefensePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 font-sans antialiased">
      <Review2Header />

      {/* Hero Banner */}
      <header className="bg-white border-b border-zinc-200 shadow-xs w-full">
        <div className="w-full px-6 sm:px-10 lg:px-12 py-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              23ECE381 Open Lab — Review 2
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Weightage: 30%
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Status: Defense Ready
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-3">
                IoT Edge Biometric Auth &amp; Campus Geofencing
              </h1>
              <p className="text-base text-zinc-500 leading-relaxed">
                Zero-cloud, high-assurance biometric verification pipeline deployed on Raspberry Pi 5 ARM64 hardware — 
                featuring sub-140ms end-to-end latency, 23.6 MB neural footprint, and multi-vector presentation attack defense.
              </p>
            </div>

            {/* Navigation Buttons */}
            <nav className="flex flex-wrap gap-2 shrink-0">
              {[
                ["#system-design", "01 · Architecture"],
                ["#model-analysis", "02 · ML Benchmarks"],
                ["#proof-of-concept", "03 · POC Demo"],
                ["#hardware-telemetry", "04 · Telemetry"],
                ["#rubrics", "05 · Rubrics"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all shadow-2xs"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Sections — Large gap between each distinct card container */}
      <main className="w-full px-6 sm:px-10 lg:px-12 py-12 flex flex-col gap-16 md:gap-20">
        {/* Section 01 */}
        <section id="system-design" className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <SystemDesignSection />
        </section>

        {/* Section 02 */}
        <section id="model-analysis" className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <ModelAnalysisSection />
        </section>

        {/* Section 03 */}
        <section id="proof-of-concept" className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <ProofOfConceptSimulator />
        </section>

        {/* Section 04 */}
        <section id="hardware-telemetry" className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <HardwareTelemetryPillar />
        </section>

        {/* Section 05 */}
        <section id="rubrics" className="w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <RubricsComplianceSection />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 text-center text-sm font-medium text-zinc-500 mt-12">
        ECE / CCE Open Laboratory - I · NIT Tiruchirappalli
      </footer>
    </div>
  );
}
