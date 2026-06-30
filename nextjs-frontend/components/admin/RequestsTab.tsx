"use client";

import React, { useState, useEffect } from "react";
import { parseUTCDateTime } from "@/lib/utils";

export default function RequestsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reqRes, usrRes] = await Promise.all([
        fetch("/api/v1/face-requests?status=pending"),
        fetch("/api/v1/faculty")
      ]);
      
      if (reqRes.ok && usrRes.ok) {
        const reqData = await reqRes.json();
        const usrData = await usrRes.json();
        
        const map: Record<string, any> = {};
        usrData.forEach((u: any) => { map[u.id] = u; });
        
        setUsersMap(map);
        setRequests(reqData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const processRequest = async (reqId: number, decision: "approve" | "reject") => {
    const note = notes[reqId] || "";
    const formData = new FormData();
    if (note) formData.append("admin_notes", note);

    try {
      const res = await fetch(`/api/v1/face-requests/${reqId}/${decision}`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        alert(`Request successfully ${decision}d.`);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Operation failed: ${err.detail || "Error processing request"}`);
      }
    } catch (err) {
      alert("Operation failed: connection error.");
    }
  };

  return (
    <div className="section-card">
      <h2 style={{ marginBottom: "1.5rem" }}>Biometric Approval Queue</h2>
      
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
            Loading pending requests...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
            No pending face registration/update requests.
          </div>
        ) : (
          requests.map(req => {
            const user = usersMap[req.user_id] || { name: req.user_id, department: "Unknown" };
            
            return (
              <div key={req.id} className="bg-[var(--surface)] rounded-lg border border-[var(--border-color)] p-6 mb-5 flex flex-col gap-5">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--divider)", paddingBottom: "0.75rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", color: "var(--text-primary)" }}>
                      {user.name} (@{req.user_id})
                    </h3>
                    <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Department: {user.department || "General"} | Request type: {req.request_type.toUpperCase()}
                    </p>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {parseUTCDateTime(req.created_at).toLocaleString()}
                  </div>
                </div>
                
                <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  <strong>User Message:</strong> "{req.message || 'No message provided'}"
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-4">
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-secondary)" }}>CURRENT BASE FACE</div>
                    <div className="border border-dashed border-[var(--border-color)] rounded-lg aspect-[4/3] bg-[#fafafa] flex items-center justify-center overflow-hidden relative">
                      <span className="text-[0.8rem] text-[var(--text-secondary)] text-center">No existing face registered</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem", color: "var(--text-secondary)" }}>NEW SUBMITTED FACE</div>
                    <div className="border border-dashed border-[var(--border-color)] rounded-lg aspect-[4/3] bg-[#fafafa] flex items-center justify-center overflow-hidden relative">
                      {/* Using standard img tag instead of next/image to easily fetch from proxy with raw URL */}
                      <img 
                        src={`/api/v1/face-requests/${req.id}/image`} 
                        alt="Uploaded face preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                        }}
                      />
                      <span className="hidden text-[0.8rem] text-[var(--text-secondary)] text-center">Failed to load image preview</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>ADMIN RESOLUTION NOTES (OPTIONAL)</label>
                  <textarea 
                    value={notes[req.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                    placeholder="Type notes here..." 
                    rows={2} 
                    style={{ border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "6px", fontSize: "0.85rem", resize: "none", outline: "none" }}
                  />
                </div>
                
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button 
                    onClick={() => processRequest(req.id, 'reject')} 
                    className="btn btn-outlined" 
                    style={{ borderColor: "rgba(211,47,47,0.3)", color: "var(--error)" }}
                  >
                    Reject Update
                  </button>
                  <button 
                    onClick={() => processRequest(req.id, 'approve')} 
                    className="btn btn-contained" 
                    style={{ backgroundColor: "var(--success)" }}
                  >
                    Approve & Replace
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
