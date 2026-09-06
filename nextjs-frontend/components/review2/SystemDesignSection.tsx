import React, { useState } from "react";
import { Smartphone, Wifi, Cpu, Layers, Database, ChevronRight } from "lucide-react";

const nodes = [
  {
    id: "byod", step: "01", title: "BYOD Client", badge: "Edge Camera", icon: Smartphone, latency: "~20ms",
    headline: "Faculty Smartphone (Android / iOS)",
    body: "Captures live camera frame and client-side GNSS fix. Client MediaPipe WASM pose gate rejects blurry or extreme-pitch frames before transmitting over LAN.",
    input: "Camera 1080p Stream + HTML5 Geolocation API",
    output: "JPEG Blob + Lat/Lon Coordinates",
  },
  {
    id: "wifi", step: "02", title: "Campus Wi-Fi", badge: "Private LAN", icon: Wifi, latency: "6–10ms",
    headline: "Private Subnet — Zero Cloud Dependency",
    body: "Routes directly to Raspberry Pi static IP via campus WPA2-Enterprise LAN. Operates 100% offline without external internet, preventing data leakage and eliminating cloud costs.",
    input: "Encrypted HTTP Multipart Request",
    output: "FastAPI ASGI Request Stream",
  },
  {
    id: "rpi", step: "03", title: "RPi 5 Gateway", badge: "ARM64 Edge", icon: Cpu, latency: "2ms",
    headline: "BCM2712 Cortex-A76 @ 2.4GHz Gateway",
    body: "Asynchronous FastAPI runtime with ONNX Runtime ARM NEON SIMD acceleration. Delivers 3.5× higher inference throughput than standard PyTorch on a 7.5W low-power profile.",
    input: "REST /api/v1/verify Payload",
    output: "Preprocessed FP32 Tensor Stream",
  },
  {
    id: "ml", step: "04", title: "ML Pipeline", badge: "< 25MB Weights", icon: Layers, latency: "117ms",
    headline: "Four-Stage Neural Inference Graph",
    body: "SCRFD-2.5G (Face Detect) → 5-Pt Affine Warp (Normalize) → MiniFASNetV2 (Anti-Spoofing Gate) → ArcFace MobileFaceNet (512-D Embedding). MiniFASNet acts as an early circuit breaker.",
    input: "Preprocessed RGB Tensor (1280×720)",
    output: "L2-Normalized 512-Dimensional Vector",
  },
  {
    id: "geo", step: "05", title: "VectorDB + Geo", badge: "In-Memory RAM", icon: Database, latency: "< 3ms",
    headline: "Cosine Similarity + Ray-Casting Polygon Geofence",
    body: "Computes dot-product cosine similarity against 730 pre-indexed faculty embeddings in RAM. Simultaneously executes Jordan Curve ray-casting across 103 NITT campus building polygons.",
    input: "512-D Feature Vector + GPS Coordinates",
    output: "Faculty ID, Matched Building, Verification Status",
  },
];

export default function SystemDesignSection() {
  const [sel, setSel] = useState("rpi");
  const selected = nodes.find(n => n.id === sel)!;
  const Icon = selected.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
              Section 01
            </span>
            <span className="text-xs font-medium text-zinc-400">System Architecture</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">End-to-End System Topology</h2>
          <p className="text-sm text-zinc-500 mt-1">Zero-cloud IoT edge biometric pipeline on Raspberry Pi 5 — each hop executed locally.</p>
        </div>
        <span className="self-start sm:self-center shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shadow-2xs">
          Pipeline Latency: &lt; 140 ms
        </span>
      </div>

      {/* 5-Node Flow Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {nodes.map((n, i) => {
          const N = n.icon;
          const active = sel === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setSel(n.id)}
              className={`relative text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group ${
                active
                  ? "border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-200/80 shadow-xs"
                  : "border-zinc-200 bg-zinc-50/40 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {i < nodes.length - 1 && (
                <ChevronRight className="absolute -right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-300 z-10 hidden lg:block" />
              )}
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${
                active ? "bg-indigo-600 text-white shadow-xs" : "bg-white border border-zinc-200 text-zinc-600 group-hover:text-zinc-900"
              }`}>
                <N className="h-5 w-5" />
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${active ? "text-indigo-600" : "text-zinc-400"}`}>
                Hop {n.step}
              </p>
              <p className={`text-sm font-bold leading-tight ${active ? "text-indigo-950" : "text-zinc-900"}`}>
                {n.title}
              </p>
              <p className={`text-xs mt-1 font-medium ${active ? "text-indigo-600" : "text-zinc-500"}`}>
                {n.badge}
              </p>
              <div className="mt-4 pt-3 border-t border-zinc-200/60 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">Latency</span>
                <span className={`text-xs font-mono font-bold ${active ? "text-indigo-700" : "text-zinc-700"}`}>
                  {n.latency}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Node Details Card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">
              Hop Detail · {selected.step}
            </span>
            <h3 className="text-lg font-bold text-zinc-900">{selected.headline}</h3>
            <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed max-w-3xl">
              {selected.body}
            </p>
          </div>
        </div>

        {/* Input/Output Data Contracts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Inbound Ingress Contract</span>
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">INPUT</span>
            </div>
            <p className="font-mono text-xs font-semibold text-zinc-800 break-all">{selected.input}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Outbound Egress Contract</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">OUTPUT</span>
            </div>
            <p className="font-mono text-xs font-semibold text-zinc-800 break-all">{selected.output}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
