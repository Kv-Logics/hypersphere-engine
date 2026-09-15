"use client";

import React, { useState } from "react";
import { Smartphone, Wifi, Cpu, Layers, Database, Zap, ChevronRight } from "lucide-react";

interface SubStage {
  name: string;
  ms: string;
  desc: string;
}

interface HopConfig {
  id: string;
  num: string;
  title: string;
  role: string;
  icon: React.ComponentType<{ className?: string }>;
  latency: string;
  summary: string;
  desc: string;
  tech: string;
  input: string;
  output: string;
  subStages?: SubStage[];
}

const HOPS: HopConfig[] = [
  {
    id: "byod",
    num: "01",
    title: "BYOD Capture",
    role: "Smartphone Client",
    icon: Smartphone,
    latency: "12 ms",
    summary: "WebRTC camera frame + HTML5 GPS coordinates",
    desc: "Captures facial frame and GPS client-side. MediaPipe WASM client rejects heavy motion blur, yaw > 30°, and closed eyes before LAN transmission.",
    tech: "HTML5 Geolocation · WebRTC · WASM",
    input: "Camera 1080p stream + High-Accuracy GPS",
    output: "112×112 validated JPEG + (lat, lng) payload"
  },
  {
    id: "wifi",
    num: "02",
    title: "Amrita-Net Wi-Fi",
    role: "Private LAN Subnet",
    icon: Wifi,
    latency: "5 ms",
    summary: "Zero public internet routing over Amrita-Net 802.11ac",
    desc: "Transmits payload directly across Amrita-Net private enterprise subnet to Raspberry Pi 5 IP. Air-gapped biometric security with TLS encryption.",
    tech: "802.11ac · WPA2-Enterprise · TLS 1.3",
    input: "Encrypted HTTPS POST /api/v1/verify",
    output: "FastAPI socket stream on Pi 5 wlan0 interface"
  },
  {
    id: "rpi",
    num: "03",
    title: "RPi 5 Ingress",
    role: "ARM64 Gateway",
    icon: Cpu,
    latency: "1 ms",
    summary: "FastAPI ASGI dispatch to ONNX Runtime memory buffer",
    desc: "Uvicorn asynchronous event loop decodes image payload into contiguous FP32 tensor in RAM buffer, bypassing slow Python PIL conversions.",
    tech: "FastAPI · Uvicorn ASGI · NumPy C-API",
    input: "Raw multipart JPEG byte stream",
    output: "1×3×112×112 FP32 tensor in RAM memory"
  },
  {
    id: "ml",
    num: "04",
    title: "Edge ML Pipeline",
    role: "4× ONNX NEON SIMD",
    icon: Layers,
    latency: "117 ms",
    summary: "SCRFD → Affine → MiniFASNetV2 → ArcFace Mobile",
    desc: "Four quantized ONNX models executing sequentially on quad-core Cortex-A76 with ARM NEON SIMD acceleration. Early circuit-breaker aborts on spoofing.",
    tech: "ONNX Runtime 1.17.1 · ARM NEON · FP32",
    input: "1×3×112×112 facial tensor",
    output: "512-dimensional normalized unit vector",
    subStages: [
      { name: "SCRFD-2.5G", ms: "42 ms", desc: "Face detection & 5 landmarks" },
      { name: "5-Pt Affine", ms: "5 ms", desc: "Canonical alignment warp" },
      { name: "MiniFASNetV2", ms: "38 ms", desc: "Fourier liveness defense" },
      { name: "ArcFace Mobile", ms: "32 ms", desc: "512-D hypersphere embedding" },
    ]
  },
  {
    id: "geo",
    num: "05",
    title: "Decision Engine",
    role: "Vector + Geofence",
    icon: Database,
    latency: "3 ms",
    summary: "Cosine distance vs 730 embeddings + Jordan polygon ray-cast",
    desc: "Computes dot product against 730 pre-loaded faculty embeddings (< 0.5 ms), followed by Jordan curve theorem ray-casting against 103 Amrita polygon coordinates.",
    tech: "BLAS Dot Product · SQLite · Ray-Casting",
    input: "512-D vector + Staff ID + (lat, lng)",
    output: "Verified attendance verdict logged to SQLite",
    subStages: [
      { name: "Cosine Match", ms: "2 ms", desc: "Cosine similarity vs 730 faculty vectors" },
      { name: "Ray-Casting", ms: "1 ms", desc: "Jordan Curve vs 103 Amrita campus polygons" },
    ]
  },
];

export default function SystemDesignSection() {
  const [sel, setSel] = useState("ml");
  const hop = HOPS.find((h) => h.id === sel)!;
  const Icon = hop.icon;

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-md">
              01 · Architectural Rigor
            </span>
            <span className="text-xs text-slate-500 font-semibold">Autonomous Zero-Cloud Edge Pipeline</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            End-to-End Edge System Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Autonomous zero-cloud pipeline routing smartphone captures over Amrita-Net campus LAN to Raspberry Pi 5 with hardware circuit-breaker defense.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-2xs">
            <Zap className="h-4 w-4 text-indigo-600" />
            Neural: <strong className="text-indigo-600">117 ms</strong> · Total E2E: <strong className="text-emerald-700">138 ms</strong>
          </span>
        </div>
      </div>

      {/* Complete Visible Architecture Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5 mb-8">
        {HOPS.map((h) => {
          const active = h.id === sel;
          const HIcon = h.icon;

          return (
            <div
              key={h.id}
              onClick={() => setSel(h.id)}
              className={`rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                active
                  ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                  : "bg-slate-50/50 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div>
                {/* Card Top */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      <HIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-indigo-600">Stage {h.num}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {h.latency}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{h.title}</h3>
                <p className="text-[11px] text-slate-500 font-medium mb-1.5">{h.role}</p>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{h.summary}</p>

                {/* Visible Sub-Pipeline breakdown */}
                {h.subStages && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80 mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {h.id === "ml" ? "4× ONNX Internal Flow" : "Internal Decision Flow"}
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {h.subStages.map((sub, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-[11px] bg-white border border-slate-200/80 rounded px-2 py-1">
                          <span className="font-semibold text-slate-800">{sub.name}</span>
                          <span className="font-mono font-bold text-indigo-600">{sub.ms}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] font-medium text-indigo-600 mt-1">
                <span>{active ? "Active Spec View" : "View Hardware Spec"}</span>
                <ChevronRight className={`h-3 w-3 transition-transform ${active ? "rotate-90 text-indigo-700" : "text-slate-400"}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Stage Detailed Hardware Specification */}
      <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/50 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded">
                  STAGE {hop.num} SPECIFICATION
                </span>
                <span className="text-xs font-semibold text-slate-500">· {hop.role}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">{hop.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              Latency Contribution: {hop.latency}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4">{hop.desc}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Execution Runtime</p>
            <p className="text-xs font-mono font-semibold text-slate-800">{hop.tech}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">Input Specification</p>
            <p className="text-xs font-mono font-semibold text-slate-800">{hop.input}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Output Artifact</p>
            <p className="text-xs font-mono font-semibold text-slate-800">{hop.output}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
