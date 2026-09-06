import React from "react";
import { UserPlus } from "lucide-react";

interface TerminalEnrollmentCardProps {
  regId: string;
  setRegId: (id: string) => void;
  regName: string;
  setRegName: (name: string) => void;
  setRegFile: (file: File | null) => void;
  onRegister: () => void;
}

export default function TerminalEnrollmentCard({
  regId,
  setRegId,
  regName,
  setRegName,
  setRegFile,
  onRegister,
}: TerminalEnrollmentCardProps) {
  return (
    <div className="section-card">
      <h2>Enroll Faculty Member</h2>
      <div className="input-field">
        <label>Faculty ID</label>
        <input
          type="text"
          value={regId}
          onChange={(e) => setRegId(e.target.value)}
          placeholder="e.g. FAC204"
        />
      </div>
      <div className="input-field" style={{ marginTop: "0.5rem" }}>
        <label>Full Name</label>
        <input
          type="text"
          value={regName}
          onChange={(e) => setRegName(e.target.value)}
          placeholder="e.g. Dr. Keerthi"
        />
      </div>
      <div className="input-field" style={{ marginTop: "0.5rem" }}>
        <label>Image File (optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setRegFile(e.target.files?.[0] || null)}
          className="text-xs"
        />
      </div>
      <button
        onClick={onRegister}
        className="btn btn-contained mt-3 flex items-center gap-2 w-full justify-center"
      >
        <UserPlus className="w-4 h-4" /> Enroll Profile
      </button>
    </div>
  );
}
