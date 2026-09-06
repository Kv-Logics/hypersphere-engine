import React, { RefObject } from "react";

export interface LogEntry {
  time: string;
  text: string;
  type?: "info" | "success" | "error" | "warning";
}

interface TerminalConsoleLogsProps {
  logs: LogEntry[];
  logRef: RefObject<HTMLDivElement | null>;
}

export default function TerminalConsoleLogs({ logs, logRef }: TerminalConsoleLogsProps) {
  return (
    <div className="section-card flex-1 flex flex-col min-h-[200px]">
      <h2>System Event Log</h2>
      <div
        ref={logRef}
        className="terminal-view flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 max-h-[360px]"
        style={{
          background: "#0a0a0a",
          color: "#90caf9",
          padding: "0.75rem",
          borderRadius: "6px",
        }}
      >
        {logs.map((l, i) => (
          <div key={i} className="log-line">
            [<span className="text-[var(--primary)]">{l.time}</span>]
            <span
              className={
                l.type === "success"
                  ? "text-[#66bb6a]"
                  : l.type === "error"
                  ? "text-[#ef5350]"
                  : l.type === "warning"
                  ? "text-[#ffa726]"
                  : "text-[#90caf9]"
              }
            >
              {" "}
              {l.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
