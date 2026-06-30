"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

export default function HealthTab() {
  const [metrics, setMetrics] = useState<any>({});
  const [health, setHealth] = useState<any>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHealthData = async () => {
    try {
      const [metRes, hltRes] = await Promise.all([
        fetch("/api/v1/metrics/system"),
        fetch("/api/v1/health")
      ]);
      
      if (metRes.ok) {
        setMetrics(await metRes.json());
      }
      if (hltRes.ok) {
        setHealth(await hltRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchHealthData, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const renderStage = (name: string, isLoaded: boolean) => (
    <div className="stepper-stage flex items-center gap-4 relative py-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white z-20 ${isLoaded ? 'bg-[var(--success)]' : 'bg-[#e0e0e0]'}`}>
          {isLoaded ? '✓' : '●'}
      </div>
      <div className="flex-1 flex justify-between items-center bg-[var(--surface)] p-3 rounded-lg border border-[var(--border-color)]">
          <span className="font-semibold text-[var(--text-primary)]">{name}</span>
          <span className={`text-xs px-2 py-1 rounded font-medium border ${isLoaded ? 'bg-[rgba(76,175,80,0.1)] text-[var(--success)] border-[rgba(76,175,80,0.2)]' : 'bg-[rgba(255,152,0,0.1)] text-[var(--warning)] border-[rgba(255,152,0,0.2)]'}`}>
              {isLoaded ? 'Actual' : 'Mock (Fallback)'}
          </span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-end items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="relative inline-block w-[38px] h-[20px]">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="peer opacity-0 w-0 h-0" />
            <span className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-[var(--border-color)] transition-colors duration-300 rounded-[20px] peer-checked:bg-[var(--primary)] before:absolute before:content-[''] before:h-[14px] before:w-[14px] before:left-[3px] before:bottom-[3px] before:bg-white before:transition-transform before:duration-300 before:rounded-full peer-checked:before:translate-x-[18px]"></span>
          </label>
          <span className="text-[0.85rem] font-medium text-[var(--text-secondary)]">Auto-Refresh (3s)</span>
        </div>
        <button onClick={fetchHealthData} className="btn btn-outlined flex items-center gap-1.5 text-xs py-1.5 px-3 bg-[var(--surface)] hover:bg-[rgba(0,0,0,0.02)]">
          <RefreshCw className="w-3.5 h-3.5 opacity-80" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--primary)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">CPU Utilization</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.cpu_usage_percent ?? '-'}%</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--primary)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Memory Utilization</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.memory_usage_percent ?? '-'}%</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--primary)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">GPU Utilization</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.gpu_usage_percent ?? '-'}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[rgba(25,118,210,0.3)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">False Match Rate (FMR)</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.far !== undefined ? (metrics.far * 100).toFixed(2) : '0.00'}%</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[rgba(25,118,210,0.3)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">False Non-Match Rate (FNMR)</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.frr !== undefined ? (metrics.frr * 100).toFixed(2) : '0.00'}%</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--primary)] shadow-sm flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Avg. Face Match Similarity</h3>
          <div className="text-3xl font-bold font-[var(--font-jetbrains)] text-[var(--text-primary)]">{metrics.avg_similarity ? metrics.avg_similarity.toFixed(3) : '-'}</div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="border-none pb-2 m-0 mb-4">Biometric Model & Safety Status</h2>
        <p className="text-[0.85rem] text-[var(--text-secondary)] mb-6">
          Real-time operational state of deployed deep learning ONNX models.
        </p>
        
        <div className="flex flex-col gap-3 relative pl-3">
          <div className="absolute left-[23px] top-[24px] bottom-[24px] w-[2px] bg-[var(--divider)] z-10" />
          {renderStage("Face Detection Model (SCRFD)", true)}
          {renderStage("Biometric Encoding Model (ArcFace)", health.recognition_model_loaded)}
          {renderStage("Anti-Spoofing Model (MiniFASNetV2)", health.antispoof_model_loaded)}
        </div>
      </div>
    </div>
  );
}
