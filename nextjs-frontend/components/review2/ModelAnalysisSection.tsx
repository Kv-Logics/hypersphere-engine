"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const PRODUCTION = [
  { stage: "Detection", model: "SCRFD-2.5G", size: "3.2 MB", latency: "42 ms", accuracy: "94.2% WIDER", reason: "5-pt landmarks, high recall on bearded faces, 4.4× faster than RetinaFace." },
  { stage: "Alignment", model: "5-Point Affine", size: "< 1 KB", latency: "5 ms", accuracy: "Sub-pixel", reason: "Canonical 112×112 normalization eliminates 2D roll/tilt distortion." },
  { stage: "Anti-Spoof", model: "MiniFASNetV2", size: "1.8 MB", latency: "38 ms", accuracy: "99.12% CASIA", reason: "Detects moiré/bezel/paper sheen. Circuit breaker aborts pipeline early." },
  { stage: "Recognition", model: "ArcFace Mobile", size: "13.6 MB", latency: "32 ms", accuracy: "99.40% LFW", reason: "Angular Margin on unit hypersphere. Compact 512-D vectors in 32 ms." },
];

interface Row { name: string; stage: string; status: "selected"|"rejected"|"evaluated"; size: string; latency: string; reason: string; }

const TABLE: Row[] = [
  { name: "SCRFD-2.5G", stage: "Detection", status: "selected", size: "3.2 MB", latency: "42 ms", reason: "High recall under poor lighting, minimal footprint." },
  { name: "Haar Cascade", stage: "Detection", status: "rejected", size: "0.9 MB", latency: "180 ms", reason: "Fails on bearded faculty and non-frontal angles." },
  { name: "RetinaFace ResNet-50", stage: "Detection", status: "rejected", size: "108 MB", latency: "185 ms", reason: "Exceeds thermal budget, triggers CPU throttling." },
  { name: "5-Point Affine Norm", stage: "Alignment", status: "selected", size: "< 1 KB", latency: "5 ms", reason: "2D affine warp to canonical coordinate space." },
  { name: "3-Point Affine Norm", stage: "Alignment", status: "rejected", size: "< 1 KB", latency: "3 ms", reason: "Poor yaw normalization, degrades cosine match." },
  { name: "MiniFASNetV2 (2.7×)", stage: "Anti-Spoof", status: "selected", size: "1.8 MB", latency: "38 ms", reason: "Fourier context detects screen/paper replays." },
  { name: "SilentFace", stage: "Anti-Spoof", status: "evaluated", size: "5.2 MB", latency: "76 ms", reason: "2× slower, no significant accuracy gain." },
  { name: "Eye Blink Heuristic", stage: "Anti-Spoof", status: "rejected", size: "0 MB", latency: "2 ms", reason: "Trivially spoofed via video playback loop." },
  { name: "ArcFace MobileFaceNet", stage: "Recognition", status: "selected", size: "13.6 MB", latency: "32 ms", reason: "Optimal angular margin vs edge latency trade-off." },
  { name: "ArcFace ResNet-50", stage: "Recognition", status: "rejected", size: "174 MB", latency: "380 ms", reason: "Violates sub-140ms budget, causes memory paging." },
  { name: "FaceNet Inception-V1", stage: "Recognition", status: "evaluated", size: "92 MB", latency: "210 ms", reason: "Weaker inter-class separation than ArcFace." },
];

export default function ModelAnalysisSection() {
  const [filter, setFilter] = useState("All");
  const rows = filter === "All" ? TABLE : TABLE.filter((r) => r.stage === filter);

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-3 py-0.5 rounded-md">
              02 · Empirical Evaluation
            </span>
            <span className="text-xs text-slate-500 font-semibold">ARM64 Silicon Benchmarking</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Edge ML Model Benchmarks &amp; Trade-offs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Empirical trade-off justification for deploying lightweight ONNX neural models over heavy server architectures on Pi 5.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs">
            Production Suite: <strong className="text-indigo-600 font-bold">23.6 MB</strong> · <strong className="text-emerald-700 font-bold">117 ms</strong>
          </span>
        </div>
      </div>

      {/* Production Suite Summary Strip (Full Vertical Expansion, No Dots/Truncation) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200/80">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Selected Production Inference Pipeline (Quad-ONNX NEON SIMD)
          </span>
          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            4 Models · 117 ms In-Memory Execution
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCTION.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wide">{p.stage}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> SELECTED
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">{p.model}</p>
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  <span>Size: <strong className="text-slate-800 font-bold">{p.size}</strong></span>
                  <span>Latency: <strong className="text-emerald-700 font-bold">{p.latency}</strong></span>
                </div>
              </div>

              {/* Complete Wording Visible - No Truncation or Ellipsis */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Metric:</span>
                  <span className="font-bold text-slate-800 font-mono text-[11px]">{p.accuracy}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{p.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candidate Comparison Matrix */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Empirical Candidate Evaluation Matrix</h3>
          <p className="text-[11px] text-slate-400">Comparing evaluated architectures against hardware thermal and latency budgets.</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100/90 rounded-md">
          {["All", "Detection", "Alignment", "Anti-Spoof", "Recognition"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-all ${filter === s ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Evaluated Model</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Stage</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase text-right">Size</th>
                <th className="px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase text-right">Pi 5 Latency</th>
                <th className="px-3.5 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Empirical Trade-off &amp; Rationale</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r, i) => (
                <tr key={i} className={`hover:bg-slate-50/80 transition-colors ${r.status === "selected" ? "border-l-2 border-emerald-500 bg-emerald-50/15" : ""}`}>
                  <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{r.stage}</span></td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600 text-right whitespace-nowrap">{r.size}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-right whitespace-nowrap" style={{ color: r.status === "selected" ? "#047857" : r.status === "rejected" ? "#dc2626" : "#d97706" }}>{r.latency}</td>
                  <td className="px-3.5 py-2.5 text-xs text-slate-600">{r.reason}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {r.status === "selected" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" /> SELECTED
                      </span>
                    ) : r.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        <XCircle className="h-3 w-3" /> REJECTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> EVALUATED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
