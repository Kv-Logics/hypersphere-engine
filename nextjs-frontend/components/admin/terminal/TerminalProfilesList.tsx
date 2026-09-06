import React from "react";
import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";

interface FacultyProfile {
  id: string;
  name: string;
  face_status?: string;
}

interface TerminalProfilesListProps {
  profiles: FacultyProfile[];
  onDeleteProfile: (id: string) => void;
}

export default function TerminalProfilesList({
  profiles,
  onDeleteProfile,
}: TerminalProfilesListProps) {
  const registeredProfiles = profiles.filter(
    (p) => p.face_status === "registered" || p.face_status === "approved"
  );

  return (
    <div className="section-card flex-1 flex flex-col">
      <div className="flex justify-between items-center border-b border-[var(--divider)] pb-2 mb-3">
        <h2 className="m-0 border-none p-0">Enrolled Profiles</h2>
        <Link
          href="/admin/registry"
          className="btn btn-outlined text-[10px] py-1 px-2 uppercase flex items-center gap-1"
        >
          View All <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px]">
        {registeredProfiles.length === 0 ? (
          <div className="text-center text-[var(--text-secondary)] text-xs py-4">
            No profiles registered in DB.
          </div>
        ) : (
          registeredProfiles.slice(0, 20).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[rgba(0,0,0,0.03)] group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-[11px] font-[var(--font-outfit)] shrink-0">
                  {p.name?.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {p.name}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-secondary)]">@{p.id}</div>
                </div>
              </div>
              <button
                onClick={() => onDeleteProfile(p.id)}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--error)] transition-opacity p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
