import React from "react";

interface UserProfileCardProps {
  user: {
    name: string;
    department?: string;
    designation?: string;
    email?: string;
  };
}

export default function UserProfileCard({ user }: UserProfileCardProps) {
  if (!user) return null;

  return (
    <div className="section-card p-6 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl flex-shrink-0">
      <div className="text-left mb-4 border-b border-[var(--divider)] pb-3">
        <div className="text-[1.3rem] font-bold text-[var(--text-primary)] font-[var(--font-outfit)]">
          {user.name}
        </div>
      </div>
      <div className="text-left text-sm flex flex-col gap-2 text-[var(--text-secondary)]">
        <div>
          <span className="font-semibold text-[var(--text-primary)]">Department:</span>{" "}
          {user.department || "General"}
        </div>
        <div>
          <span className="font-semibold text-[var(--text-primary)]">Designation:</span>{" "}
          {user.designation || "Faculty"}
        </div>
        <div>
          <span className="font-semibold text-[var(--text-primary)]">Email:</span>{" "}
          <span className="break-all">{user.email || "-"}</span>
        </div>
      </div>
    </div>
  );
}
