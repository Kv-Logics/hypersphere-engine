import React from "react";
import { ShieldQuestion, LogOut } from "lucide-react";

export interface CurrentLocationState {
  latitude: number | null;
  longitude: number | null;
  insideCampus: boolean;
  buildingName: string;
  buildingId: string | null;
}

interface DashboardHeaderProps {
  currentLocation: CurrentLocationState;
  onLogout: () => void;
}

export default function DashboardHeader({
  currentLocation,
  onLogout,
}: DashboardHeaderProps) {
  return (
    <header className="app-bar flex justify-between items-center bg-[var(--surface)] border-b border-[var(--divider)] px-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] z-50 flex-shrink-0">
      <div className="logo-area flex items-center gap-3">
        <div className="text-[var(--primary)] bg-[#e3f2fd] p-1.5 rounded-lg">
          <ShieldQuestion className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <h1 className="m-0 font-[var(--font-outfit)] text-sm font-bold tracking-wider text-[var(--text-primary)]">
            HYPERSPHERE CONTROL PLANE
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="m-0 text-xs text-[var(--text-secondary)]">NIT Trichy Attendance Portal</p>
            <span className="text-[10px] text-[var(--divider)]">|</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                currentLocation.insideCampus
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : currentLocation.buildingName === "Locating..."
                  ? "bg-slate-50 text-slate-500 border-slate-200 animate-pulse"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentLocation.insideCampus
                    ? "bg-emerald-500"
                    : currentLocation.buildingName === "Locating..."
                    ? "bg-slate-400"
                    : "bg-rose-500"
                }`}
              />
              {currentLocation.insideCampus ? (
                <span>Inside Campus: {currentLocation.buildingName}</span>
              ) : currentLocation.buildingName === "Locating..." ? (
                <span>Acquiring Geofence...</span>
              ) : (
                <span>Outside Campus Bounds</span>
              )}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="btn btn-outlined text-xs py-1.5 px-3 flex items-center gap-1.5"
      >
        <LogOut className="w-3.5 h-3.5" /> Logout
      </button>
    </header>
  );
}
