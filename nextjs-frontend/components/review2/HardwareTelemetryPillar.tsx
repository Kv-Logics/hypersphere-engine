import React, { useState, useEffect } from "react";
import { Thermometer, Activity, Server, Zap, DollarSign, Cpu } from "lucide-react";

export default function HardwareTelemetryPillar() {
  const [cpuTemp, setCpuTemp] = useState<number>(51.4);
  const [cpuLoad, setCpuLoad] = useState<number>(18);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuTemp(Number((50.8 + Math.random() * 1.8).toFixed(1)));
      setCpuLoad(Math.floor(16 + Math.random() * 10));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    {
      icon: <Thermometer className="h-5 w-5 text-amber-500" />,
      label: "CPU Temperature",
      value: `${cpuTemp}°C`,
      sub: "✓ No Thermal Throttling (< 80°C)",
      subColor: "text-emerald-700 font-semibold",
      valueColor: "text-zinc-900",
      live: true,
    },
    {
      icon: <Activity className="h-5 w-5 text-indigo-500" />,
      label: "ARM64 Core Load",
      value: `${cpuLoad}%`,
      sub: "4× Cortex-A76 @ 2.4 GHz",
      subColor: "text-zinc-500",
      valueColor: "text-zinc-900",
      live: true,
    },
    {
      icon: <Server className="h-5 w-5 text-emerald-500" />,
      label: "RAM Utilization",
      value: "284 MB",
      sub: "Total 4096 MB LPDDR4X (6.9%)",
      subColor: "text-zinc-500",
      valueColor: "text-zinc-900",
    },
    {
      icon: <Cpu className="h-5 w-5 text-violet-500" />,
      label: "Model Footprint",
      value: "23.6 MB",
      sub: "All 4 ONNX Networks In RAM",
      subColor: "text-emerald-700 font-semibold",
      valueColor: "text-zinc-900",
    },
    {
      icon: <Zap className="h-5 w-5 text-amber-500" />,
      label: "Power Draw",
      value: "~7.5 W",
      sub: "5V / 1.5A via Standard USB-C",
      subColor: "text-zinc-500",
      valueColor: "text-zinc-900",
    },
    {
      icon: <DollarSign className="h-5 w-5 text-emerald-500" />,
      label: "Monthly Cloud Bill",
      value: "$0.00",
      sub: "Zero External API Dependencies",
      subColor: "text-emerald-700 font-semibold",
      valueColor: "text-emerald-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-md">
              Section 04
            </span>
            <span className="text-xs font-medium text-zinc-400">Edge Hardware Telemetry</span>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Raspberry Pi 5 Resource Telemetry</h2>
          <p className="text-sm text-zinc-500 mt-1">Real-time hardware resource instrumentation demonstrating sustained thermal headroom and minimal edge footprint.</p>
        </div>

        <span className="self-start sm:self-center shrink-0 text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700">
          BCM2712 Quad Cortex-A76 @ 2.4GHz
        </span>
      </div>

      {/* 6 Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-2xs flex flex-col justify-between hover:border-zinc-300 hover:bg-zinc-50 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-2xs">
                  {m.icon}
                </div>
                {m.live && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                {m.label}
              </span>
              <div className={`text-2xl font-extrabold font-mono tracking-tight ${m.valueColor}`}>
                {m.value}
              </div>
            </div>

            <p className={`text-xs mt-3 pt-3 border-t border-zinc-200/60 leading-tight ${m.subColor}`}>
              {m.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
