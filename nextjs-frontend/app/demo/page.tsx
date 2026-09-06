"use client";

import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Wifi,
  Cpu,
  ScanFace,
  Layers,
  ShieldCheck,
  Zap,
  Database,
  MapPin,
} from "lucide-react";
import DemoHeader from "@/components/demo/DemoHeader";
import HardwareTelemetry from "@/components/demo/HardwareTelemetry";
import ScenarioControls, { SimulationMode } from "@/components/demo/ScenarioControls";
import PipelineVisualizer, { PipelineStep } from "@/components/demo/PipelineVisualizer";
import VerdictCard from "@/components/demo/VerdictCard";

export default function DemoFlowPage() {
  const [mode, setMode] = useState<SimulationMode>("idle");
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Hardware telemetry simulation
  const [cpuTemp, setCpuTemp] = useState<number>(51.4);
  const [cpuUsage, setCpuUsage] = useState<number>(18);
  const [ramUsage, setRamUsage] = useState<number>(284);

  // Latencies for Raspberry Pi 5
  const pipelineSteps: PipelineStep[] = [
    {
      id: 1,
      title: "Mobile Client (BYOD)",
      subtitle: "Smartphone Camera & GPS",
      icon: Smartphone,
      latency: "20ms",
      details: "High-res frame capture + Hardware GPS fix (lat: 10.9008, lon: 76.8997)",
      color: "border-cyan-500/40 text-cyan-400 bg-cyan-950/20",
      activeColor: "border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] bg-cyan-900/30",
    },
    {
      id: 2,
      title: "Local Campus Wi-Fi",
      subtitle: "Zero-Cloud Edge Transport",
      icon: Wifi,
      latency: "8ms",
      details: "Encrypted REST transmission directly to Raspberry Pi local IP (192.168.1.105)",
      color: "border-blue-500/40 text-blue-400 bg-blue-950/20",
      activeColor: "border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] bg-blue-900/30",
    },
    {
      id: 3,
      title: "Raspberry Pi 4/5 Gateway",
      subtitle: "ARM64 Quad-Core Host",
      icon: Cpu,
      latency: "2ms",
      details: "FastAPI ASGI ingress router with async non-blocking concurrency",
      color: "border-emerald-500/40 text-emerald-400 bg-emerald-950/20",
      activeColor: "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] bg-emerald-900/30",
    },
    {
      id: 4,
      title: "SCRFD-2.5G ONNX",
      subtitle: "ARM NEON Face Detection",
      icon: ScanFace,
      latency: "42ms",
      details: "0.67M params, 3.2MB weight. Computes bounding box & 5-point landmarks",
      color: "border-amber-500/40 text-amber-400 bg-amber-950/20",
      activeColor: "border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] bg-amber-900/30",
    },
    {
      id: 5,
      title: "Quality & 5-Pt Affine",
      subtitle: "Mathematical Normalization",
      icon: Layers,
      latency: "5ms",
      details: "Laplacian Var >= 50.0. Warps anchors to ArcFace canonical coordinates (112x112)",
      color: "border-indigo-500/40 text-indigo-400 bg-indigo-950/20",
      activeColor: "border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] bg-indigo-900/30",
    },
    {
      id: 6,
      title: "MiniFASNetV2 Liveness",
      subtitle: "Presentation Attack Defense",
      icon: ShieldCheck,
      latency: "38ms",
      details: "2.7x crop anti-spoofing. Rejects screen replays (99.12% accuracy on CASIA-SURF)",
      color: "border-rose-500/40 text-rose-400 bg-rose-950/20",
      activeColor: "border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)] bg-rose-900/30",
    },
    {
      id: 7,
      title: "ArcFace MobileFaceNet",
      subtitle: "512-D Feature Extraction",
      icon: Zap,
      latency: "32ms",
      details: "1.2M params, 13.6MB footprint. Maps aligned face onto normalized hypersphere",
      color: "border-purple-500/40 text-purple-400 bg-purple-950/20",
      activeColor: "border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] bg-purple-900/30",
    },
    {
      id: 8,
      title: "Edge Vector Match",
      subtitle: "In-Memory Cosine Similarity",
      icon: Database,
      latency: "2ms",
      details: "NumPy dot-product or pgvector HNSW index search across 730 campus profiles",
      color: "border-teal-500/40 text-teal-400 bg-teal-950/20",
      activeColor: "border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.4)] bg-teal-900/30",
    },
    {
      id: 9,
      title: "Campus Geofence Engine",
      subtitle: "Ray-Casting Point-in-Polygon",
      icon: MapPin,
      latency: "1ms",
      details: "Jordan Curve Theorem against 103 building polygons. Resolves 'Academic Block 1'",
      color: "border-green-500/40 text-green-400 bg-green-950/20",
      activeColor: "border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] bg-green-900/30",
    },
  ];

  // Run the simulation sequence
  const startSimulation = (selectedMode: SimulationMode) => {
    if (isRunning) return;
    setMode(selectedMode);
    setActiveStep(1);
    setIsRunning(true);
    setElapsedTime(0);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode("idle");
    setActiveStep(0);
    setElapsedTime(0);
  };

  useEffect(() => {
    if (!isRunning) return;

    const stepDelays = [400, 350, 250, 500, 300, 500, 450, 300, 300];

    const timer = setTimeout(() => {
      // Check for stop conditions based on mode
      if (mode === "spoof" && activeStep === 6) {
        setIsRunning(false);
        return;
      }
      if (mode === "geofence_fail" && activeStep === 9) {
        setIsRunning(false);
        return;
      }

      if (activeStep < pipelineSteps.length) {
        setActiveStep((prev) => prev + 1);
        setElapsedTime((prev) => prev + parseInt(pipelineSteps[activeStep - 1].latency));
      } else {
        setIsRunning(false);
      }
    }, stepDelays[activeStep - 1] || 400);

    return () => clearTimeout(timer);
  }, [isRunning, activeStep, mode]);

  // Subtle telemetry fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuTemp(Number((50.8 + Math.random() * 1.6).toFixed(1)));
      setCpuUsage(
        isRunning ? Math.floor(45 + Math.random() * 20) : Math.floor(14 + Math.random() * 8)
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      <DemoHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <HardwareTelemetry cpuTemp={cpuTemp} cpuUsage={cpuUsage} ramUsage={ramUsage} />

        <ScenarioControls
          mode={mode}
          isRunning={isRunning}
          activeStep={activeStep}
          onStartSimulation={startSimulation}
          onReset={handleReset}
        />

        <PipelineVisualizer steps={pipelineSteps} activeStep={activeStep} mode={mode} />

        <VerdictCard
          mode={mode}
          activeStep={activeStep}
          isRunning={isRunning}
          currentStepTitle={pipelineSteps[activeStep - 1]?.title}
        />
      </main>
    </div>
  );
}
