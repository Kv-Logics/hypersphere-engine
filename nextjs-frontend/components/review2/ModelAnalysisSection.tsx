import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const ALL_MODELS = [
  { stage: "Detection", name: "SCRFD-2.5G (ONNX NEON)", role: "chosen" as const, size: "3.2 MB", latency: "42 ms", accuracy: "94.2% WIDER", note: "Lightweight MobileNetV1 backbone, 5-pt landmarks, high recall under low light." },
  { stage: "Detection", name: "Haar Cascade (OpenCV)", role: "rejected" as const, size: "0.9 MB", latency: "180 ms", accuracy: "44.1% recall", note: "Legacy 2001 classifier — severe false positives on bearded/bespectacled faculty." },
  { stage: "Detection", name: "RetinaFace ResNet-50", role: "rejected" as const, size: "108 MB", latency: "185 ms", accuracy: "96.4% WIDER Hard", note: "Thermal throttle on Pi 5 peak load. Memory budget exceeded." },
  { stage: "Alignment", name: "5-Point Similarity Affine", role: "chosen" as const, size: "< 1 KB", latency: "5 ms", accuracy: "Sub-pixel", note: "Maps to canonical ArcFace coords. Eliminates roll and pitch distortion." },
  { stage: "Alignment", name: "3-Point Affine (Eyes+Nose)", role: "rejected" as const, size: "< 1 KB", latency: "3 ms", accuracy: "Poor yaw", note: "Insufficient for non-planar 3D head yaw — degrades cosine similarity." },
  { stage: "Anti-Spoof", name: "MiniFASNetV2 (2.7× crop)", role: "chosen" as const, size: "1.8 MB", latency: "38 ms", accuracy: "99.12% CASIA-SURF", note: "80×80 crop detects moiré, screen edges, printed paper. Circuit-breaker before ArcFace." },
  { stage: "Anti-Spoof", name: "SilentFace AntiSpoof", role: "evaluated" as const, size: "5.2 MB", latency: "76 ms", accuracy: "98.4%", note: "2× latency vs MiniFASNetV2 with no meaningful accuracy gain on edge." },
  { stage: "Anti-Spoof", name: "Eye Blink Counter", role: "rejected" as const, size: "0 MB", latency: "2 ms", accuracy: "High bypass", note: "Trivially bypassed with video replay — kept only as auxiliary UI gate." },
  { stage: "Recognition", name: "ArcFace MobileFaceNet", role: "chosen" as const, size: "13.6 MB", latency: "32 ms", accuracy: "99.40% LFW", note: "Additive Angular Margin Loss on L2-normalized hypersphere. Compact 512-D vectors." },
  { stage: "Recognition", name: "ArcFace ResNet-50", role: "rejected" as const, size: "174 MB", latency: "380 ms", accuracy: "99.82% LFW", note: "10× slower, 174 MB — exceeds 200ms latency budget for real-time attendance." },
  { stage: "Recognition", name: "FaceNet Inception-ResNet", role: "evaluated" as const, size: "92 MB", latency: "210 ms", accuracy: "99.20% LFW", note: "Triplet loss weaker angular separation than ArcFace geodesic distance." },
];

const STAGES = ["All", "Detection", "Alignment", "Anti-Spoof", "Recognition"];

const ROLE_CONFIG = {
  chosen:   { icon: CheckCircle2, label: "Selected",  classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { icon: XCircle,      label: "Rejected",  classes: "bg-rose-50 text-rose-700 border-rose-200" },
  evaluated:{ icon: AlertTriangle,label: "Evaluated", classes: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function ModelAnalysisSection() {
  const [stage, setStage] = useState("All");
  const models = stage === "All" ? ALL_MODELS : ALL_MODELS.filter(m => m.stage === stage);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
              Section 02
            </span>
            <span className="text-xs font-medium text-zinc-400">ML Optimization &amp; Trade-offs</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Candidate Model Benchmarking</h2>
          <p className="text-sm text-zinc-500 mt-1">Empirical evaluation of neural architectures for Raspberry Pi 5 ARM64 edge deployment.</p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 border border-zinc-200 rounded-xl shrink-0">
          {STAGES.map(s => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                stage === s
                  ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Model Architecture</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Pipeline Stage</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Weight Size</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">RPi 5 Latency</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Benchmark Accuracy</th>
                <th className="px-4 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider hidden xl:table-cell">Architectural Rationale</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {models.map((m, i) => {
                const cfg = ROLE_CONFIG[m.role];
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      m.role === "chosen" ? "bg-emerald-50/20 hover:bg-emerald-50/40" : "hover:bg-zinc-50/80"
                    }`}
                  >
                    <td className="px-6 py-4 font-bold text-zinc-900">
                      {m.name}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-md">
                        {m.stage}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono font-medium text-zinc-700">
                      {m.size}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-mono font-bold ${
                        m.role === "chosen" ? "text-emerald-700" : m.role === "rejected" ? "text-rose-600" : "text-amber-700"
                      }`}>
                        {m.latency}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell text-zinc-600 font-medium">
                      {m.accuracy}
                    </td>
                    <td className="px-4 py-4 hidden xl:table-cell max-w-sm">
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                        {m.note}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${cfg.classes}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
