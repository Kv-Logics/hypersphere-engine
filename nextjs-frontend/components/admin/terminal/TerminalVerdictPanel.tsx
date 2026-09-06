import React from "react";

interface PipelineStage {
  name: string;
  status: "completed" | "pending" | "failed";
  latency_ms?: number;
}

interface TerminalVerdictPanelProps {
  result: any;
  totalTime: number;
  simPct: number;
  livePct: number;
  qualPct: number;
  statusLabel: string;
  statusColor: string;
}

export default function TerminalVerdictPanel({
  result,
  totalTime,
  simPct,
  livePct,
  qualPct,
  statusLabel,
  statusColor,
}: TerminalVerdictPanelProps) {
  return (
    <div className="section-card">
      <h2>Verification Verdict</h2>
      <div className="rounded-lg overflow-hidden border border-[var(--border-color)]">
        <div
          className="py-2 px-4 text-center font-bold text-sm tracking-wider text-white"
          style={{ backgroundColor: result ? statusColor : "#757575" }}
        >
          VERDICT: {result ? statusLabel : "AWAITING SCAN"}
        </div>
        <div className="p-4 flex flex-col gap-3">
          {result?.candidate ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm font-[var(--font-outfit)]">
                {result.candidate.name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="font-semibold text-[var(--text-primary)]">
                {result.candidate.name}
              </div>
            </div>
          ) : (
            <div className="text-center text-[var(--text-secondary)] text-sm py-2">—</div>
          )}

          {/* Gauges */}
          {[
            {
              label: "Liveness Confidence",
              val: livePct,
              color: livePct >= 40 ? "var(--success)" : "var(--error)",
            },
            { label: "Face Similarity", val: simPct, color: "var(--primary)" },
            { label: "Frame Quality", val: qualPct, color: "var(--success)" },
          ].map((g, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">{g.label}:</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {g.val.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, g.val)}%`, backgroundColor: g.color }}
                ></div>
              </div>
            </div>
          ))}

          {result?.feedback?.length > 0 && (
            <div className="mt-2 text-xs text-[var(--text-secondary)] bg-[#fafafa] border border-[var(--border-color)] rounded p-2">
              <div className="font-semibold mb-1 text-[var(--text-primary)]">System Advice</div>
              {result.feedback.join(" ")}
            </div>
          )}

          {/* Pipeline Stepper */}
          {result?.pipeline_stages && (
            <div className="mt-3 border-t border-[var(--divider)] pt-3">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                <span>Pipeline Stepper</span>
                <span className="font-mono">{totalTime.toFixed(0)} ms</span>
              </div>
              <div className="flex flex-col gap-2">
                {result.pipeline_stages.map((s: PipelineStage, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-bold ${
                          s.status === "completed"
                            ? "text-[var(--success)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {s.status === "completed" ? "✓" : "○"}
                      </span>
                      <span className="text-[var(--text-primary)]">{s.name}</span>
                    </div>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {s.latency_ms?.toFixed(1)} ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
