import React from "react";
import { Camera, ShieldAlert } from "lucide-react";

interface QuickActionsCardProps {
  setIsPhotoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsIssueModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function QuickActionsCard({
  setIsPhotoModalOpen,
  setIsIssueModalOpen,
}: QuickActionsCardProps) {
  return (
    <div className="section-card p-6 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl flex-shrink-0">
      <h2 className="mb-4 text-[1.1rem]">Quick Actions</h2>
      <div className="flex flex-row gap-3">
        <button
          onClick={() => setIsPhotoModalOpen(true)}
          className="btn btn-outlined text-xs py-2.5 px-4 flex items-center justify-center gap-2 font-semibold flex-1"
        >
          <Camera className="w-4 h-4" /> Request Photo Change
        </button>
        <button
          onClick={() => setIsIssueModalOpen(true)}
          className="btn btn-outlined text-xs py-2.5 px-4 flex items-center justify-center gap-2 font-semibold flex-1 border-[rgba(211,47,47,0.2)] text-[var(--error)] hover:bg-[#fff5f5]"
        >
          <ShieldAlert className="w-4 h-4" /> Report Issue
        </button>
      </div>
    </div>
  );
}
