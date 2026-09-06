import React from "react";

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestText: string;
  setRequestText: (text: string) => void;
  onSubmit: (type: string, e: React.FormEvent) => void;
}

export default function ReportIssueModal({
  isOpen,
  onClose,
  requestText,
  setRequestText,
  onSubmit,
}: ReportIssueModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
      <div
        className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] animate-in zoom-in-95 duration-200"
        style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <div
          className="flex justify-between items-center border-b border-[var(--divider)] pb-3"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 className="font-[var(--font-outfit)] text-lg font-bold text-[var(--text-primary)] m-0">
            Report Matching Issue
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => onSubmit("issue_report", e)}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
              Describe the Issue
            </label>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="Describe the matching problem..."
              rows={4}
              required
              className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none"
              style={{ border: "1px solid var(--border-color)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} className="btn btn-outlined">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-contained"
              style={{
                backgroundColor: "var(--error)",
                borderColor: "transparent",
                color: "white",
              }}
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
