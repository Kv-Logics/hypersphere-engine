"use client";

import React, { useState, useEffect } from "react";
import { parseUTCDateTime } from "@/lib/utils";

export default function DriftsTab() {
  const [drifts, setDrifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrifts();
  }, []);

  const fetchDrifts = async () => {
    try {
      const res = await fetch("/api/v1/admin/drift-requests");
      if (res.ok) {
        const data = await res.json();
        setDrifts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const processDriftRequest = async (reqId: number, decision: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/v1/admin/drift-requests/${reqId}/${decision}`, {
        method: "POST"
      });
      
      if (res.ok) {
        alert(`Drift embedding update successfully ${decision}d.`);
        fetchDrifts();
      } else {
        const err = await res.json();
        alert(`Operation failed: ${err.detail || "Error processing drift request"}`);
      }
    } catch (err) {
      alert("Operation failed: connection error.");
    }
  };

  return (
    <div className="section-card">
      <h2 style={{ marginBottom: "1.5rem" }}>Biometric Drift Reviews</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        The system flags verification attempts where matches are highly confident but slightly drifted. Approve to save the new embedding, or reject to discard.
      </p>
      
      <div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
            Loading drift requests...
          </div>
        ) : drifts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
            No pending embedding drift updates to review.
          </div>
        ) : (
          drifts.map(req => (
            <div key={req.id} className="bg-[var(--surface)] rounded-lg border border-[var(--border-color)] p-6 mb-5 flex flex-col gap-5">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--divider)", paddingBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-outfit), sans-serif", fontSize: "1.1rem", color: "var(--text-primary)" }}>
                    {req.name} (@{req.faculty_id})
                  </h3>
                  <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Model Version: {req.model_version} | Status: DRIFT REVIEW PENDING
                  </p>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  {parseUTCDateTime(req.created_at).toLocaleString()}
                </div>
              </div>
              
              <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", margin: "0.5rem 0" }}>
                <strong>Detection Info:</strong> Verification matched user but embedding started to drift. A new candidate vector has been captured.
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button 
                  onClick={() => processDriftRequest(req.id, 'reject')} 
                  className="btn btn-outlined" 
                  style={{ borderColor: "rgba(211,47,47,0.3)", color: "var(--error)" }}
                >
                  Reject & Discard
                </button>
                <button 
                  onClick={() => processDriftRequest(req.id, 'approve')} 
                  className="btn btn-contained" 
                  style={{ backgroundColor: "var(--success)" }}
                >
                  Approve & Save Embedding
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
