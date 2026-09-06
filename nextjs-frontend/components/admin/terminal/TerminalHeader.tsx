import React from "react";
import { Shield } from "lucide-react";

export default function TerminalHeader() {
  return (
    <header className="app-bar sticky top-0 z-50">
      <div className="logo-area">
        <Shield className="w-6 h-6 text-[var(--primary)]" />
        <h1>HYPERSPHERE CONTROL PLANE</h1>
        <p>Biometric Authentication Server</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--success)]">
        <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
        Database Active
      </div>
    </header>
  );
}
