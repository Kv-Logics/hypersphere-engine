import React from "react";
import { MapPin } from "lucide-react";
import { parseUTCDateTime } from "@/lib/utils";

interface AttendanceLog {
  id: string;
  timestamp: string;
  status: string;
  similarity_score?: number;
  location_name?: string;
}

interface AttendanceLogsCardProps {
  logs: AttendanceLog[];
  loading: boolean;
  visibleCount: number;
  onLoadMore: () => void;
}

export default function AttendanceLogsCard({
  logs,
  loading,
  visibleCount,
  onLoadMore,
}: AttendanceLogsCardProps) {
  let lastDateStr = "";

  return (
    <div className="section-card flex flex-col bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-6 lg:h-full flex-grow overflow-hidden">
      <h2 className="mb-4 text-[1.1rem]">Attendance Logs</h2>
      <div className="flex-1 overflow-y-auto pr-1">
        <table className="w-full text-[0.85rem] text-left border-collapse table-fixed">
          <thead className="sticky top-0 bg-[var(--surface)] z-20">
            <tr>
              <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] w-[45%]">
                Time
              </th>
              <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-center w-[25%]">
                Status
              </th>
              <th className="text-[var(--text-secondary)] font-semibold uppercase text-[0.75rem] p-2 border-b border-[var(--divider)] text-right w-[30%]">
                Match
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">
                  Loading logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-[var(--text-secondary)] p-8">
                  No logs loaded.
                </td>
              </tr>
            ) : (
              logs.slice(0, visibleCount).map((log) => {
                const dt = parseUTCDateTime(log.timestamp);
                const dateStr = dt.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const showDateHeader = dateStr !== lastDateStr;
                lastDateStr = dateStr;
                const isConfirmed = log.status === "CONFIRMED";

                return (
                  <React.Fragment key={log.id}>
                    {showDateHeader && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-2 py-2 font-bold text-xs text-[var(--primary-dark)] bg-[var(--primary-light)] border-y border-[rgba(25,118,210,0.1)]"
                        >
                          {dateStr}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="p-2 border-b border-[var(--divider)] text-[var(--text-primary)] py-3 font-mono text-xs w-[45%] truncate">
                        <div className="font-semibold">
                          {dt.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                        {log.location_name && (
                          <div className="text-[10px] text-[var(--text-secondary)] font-[var(--font-roboto)] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 inline" /> {log.location_name}
                          </div>
                        )}
                      </td>
                      <td className="p-2 border-b border-[var(--divider)] text-center w-[25%]">
                        <span
                          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[0.7rem] font-bold ${
                            isConfirmed
                              ? "bg-[var(--success)] text-white"
                              : "bg-[var(--error)] text-white"
                          }`}
                        >
                          {isConfirmed ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="p-2 border-b border-[var(--divider)] text-right font-mono text-xs text-[var(--text-primary)] w-[30%]">
                        {log.similarity_score ? `${Math.round(log.similarity_score * 100)}%` : "-"}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* View More Controls */}
      {logs.length > visibleCount && (
        <div className="flex justify-center border-t border-[var(--divider)] pt-4 mt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onLoadMore}
            className="btn btn-outlined text-xs py-2 px-4 font-semibold w-full text-center justify-center"
          >
            View More
          </button>
        </div>
      )}
    </div>
  );
}
