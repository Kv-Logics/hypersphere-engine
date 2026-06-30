"use client";

import React, { useState, useEffect } from "react";
import { parseUTCDateTime } from "@/lib/utils";

export default function ReportsTab() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Get YYYY-MM-DD in local time
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attRes, usrRes] = await Promise.all([
        fetch("/api/v1/attendance"),
        fetch("/api/v1/faculty")
      ]);
      
      if (attRes.ok && usrRes.ok) {
        const attData = await attRes.json();
        const usrData = await usrRes.json();
        
        const map: Record<string, any> = {};
        usrData.forEach((u: any) => { map[u.id] = u; });
        
        setUsersMap(map);
        setLogs(attData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const dailyLogs = logs.filter(log => {
      const dt = parseUTCDateTime(log.timestamp);
      const logDate = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      return logDate === selectedDate;
  });

  const presentUserIds = new Set(dailyLogs.filter(l => l.status === "CONFIRMED").map(l => l.faculty_id));
  const totalCount = Object.keys(usersMap).length || 0;
  const presentCount = presentUserIds.size;
  const absentCount = Math.max(0, totalCount - presentCount);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--primary)] shadow-sm flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total Faculty</h3>
            <div className="text-3xl font-bold font-mono text-[var(--text-primary)]">{totalCount || "-"}</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--success)] shadow-sm flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Present Today</h3>
            <div className="text-3xl font-bold font-mono text-[var(--success)]">{presentCount}</div>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 border-l-4 border-[var(--error)] shadow-sm flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Absent Today</h3>
            <div className="text-3xl font-bold font-mono text-[var(--error)]">{absentCount}</div>
        </div>
      </div>

      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <h2 style={{ border: "none", padding: 0, margin: 0 }}>Daily Log</h2>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "6px", fontSize: "0.85rem", outline: "none" }}
            />
        </div>

        <div style={{ overflowX: "auto" }}>
            <table className="attendance-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Log Time</th>
                        <th>Status</th>
                        <th>Similarity</th>
                        <th>Liveness</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                      <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                              Loading reports...
                          </td>
                      </tr>
                    ) : !selectedDate ? (
                      <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                              Select a date to generate report.
                          </td>
                      </tr>
                    ) : dailyLogs.length === 0 ? (
                      <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                              No biometric scans logged on this date.
                          </td>
                      </tr>
                    ) : (
                      dailyLogs.map(log => {
                        const user = usersMap[log.faculty_id] || { name: log.faculty_id || "Guest / Unknown" };
                        const isConfirmed = log.status === "CONFIRMED";
                        const timeStr = parseUTCDateTime(log.timestamp).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                        
                        let badgeColor = isConfirmed ? "var(--success)" : "var(--error)";
                        
                        return (
                          <tr key={log.id}>
                            <td style={{ fontFamily: "var(--font-jetbrains), monospace", fontWeight: 600 }}>{log.faculty_id || "—"}</td>
                            <td style={{ fontWeight: 500 }}>{user.name}</td>
                            <td>{timeStr}</td>
                            <td>
                              <span className="stage-fallback-badge" style={{ backgroundColor: badgeColor + '20', color: badgeColor, border: `1px solid ${badgeColor}40`, margin: 0, padding: "0.2rem 0.5rem" }}>
                                  {log.status}
                              </span>
                            </td>
                            <td style={{ fontFamily: "var(--font-jetbrains), monospace" }}>{log.similarity_score ? Math.round(log.similarity_score * 100) + "%" : "—"}</td>
                            <td style={{ fontFamily: "var(--font-jetbrains), monospace" }}>{log.liveness_score ? Math.round(log.liveness_score * 100) + "%" : "—"}</td>
                          </tr>
                        );
                      })
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
