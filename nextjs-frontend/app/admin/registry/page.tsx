"use client";

import React, { useState, useEffect } from "react";
import { Search, Trash2, Shield, Users } from "lucide-react";

export default function RegistryPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/faculty");
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteProfile = async (id: string, name: string) => {
    if (!confirm(`Delete the profile and biometric data for "${name}" (@${id})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/v1/faculty/${id}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ msg: `Profile @${id} deleted successfully.`, type: "success" });
        fetchUsers();
      } else {
        const err = await res.json();
        setToast({ msg: err.detail || "Delete failed.", type: "error" });
      }
    } catch (e) {
      setToast({ msg: "Connection error.", type: "error" });
    }
  };

  const enrolled = users.filter(u => u.face_status === "registered" || u.face_status === "approved");

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.id?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-[var(--font-roboto)]">
      {/* Header */}
      <header className="app-bar sticky top-0 z-50">
        <div className="logo-area">
          <Shield className="w-6 h-6 text-[var(--primary)]" />
          <h1>HYPERSPHERE CONTROL PLANE</h1>
          <p>Enrolled Profiles Registry</p>
        </div>
        <a href="/admin/users" className="btn btn-outlined" style={{ fontSize: "0.75rem" }}>
          ← Back to Admin
        </a>
      </header>

      <div className="max-w-[1200px] mx-auto my-8 px-6">
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border-color)] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-8">
          {/* Title Row */}
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-[var(--divider)] pb-5 mb-6">
            <div>
              <h2 className="font-[var(--font-outfit)] text-2xl font-bold text-[var(--text-primary)] m-0">Enrolled Profiles Registry</h2>
              <p className="text-[0.85rem] text-[var(--text-secondary)] m-0 mt-1">
                All faculty members seeded from CSV and those with biometric enrollments.
              </p>
            </div>
            <div className="bg-[var(--primary-light)] text-[var(--primary-dark)] font-semibold px-4 py-2 rounded-md text-[0.85rem] flex items-center gap-2">
              <Users className="w-4 h-4" />
              {enrolled.length} Enrolled / {users.length} Total
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-4 flex-wrap items-center mb-6">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, or department..."
                className="w-full border border-[var(--border-color)] rounded-lg py-3 pl-10 pr-4 text-[0.95rem] text-[var(--text-primary)] bg-[#fafafa] outline-none transition-all focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[rgba(25,118,210,0.1)]"
              />
            </div>
          </div>

          {/* Profile Grid */}
          {loading ? (
            <div className="text-center text-[var(--text-secondary)] py-12">Loading profiles...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-[var(--text-secondary)] py-12">
              {search ? "No profiles match your search." : "No profiles in the database."}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filtered.map(u => {
                const hasEmb = u.face_status === "registered" || u.face_status === "approved";
                const initials = u.name ? u.name.substring(0, 2).toUpperCase() : "?";
                return (
                  <div
                    key={u.id}
                    className="bg-[#fafafa] border border-[var(--border-color)] rounded-xl p-5 flex items-center justify-between transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[rgba(25,118,210,0.3)] hover:bg-[var(--surface)] group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg font-[var(--font-outfit)] shrink-0 ${hasEmb ? 'bg-[var(--primary)] text-white' : 'bg-[#e0e0e0] text-[var(--text-secondary)]'}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[0.9rem] text-[var(--text-primary)] truncate">{u.name}</div>
                        <div className="font-mono text-xs text-[var(--text-secondary)]">@{u.id}</div>
                        {u.department && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{u.department}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteProfile(u.id, u.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-[#ffebee] text-[var(--text-secondary)] hover:text-[var(--error)]"
                      title="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg text-sm font-medium text-white shadow-lg z-[9999] animate-in slide-in-from-bottom-4 duration-300 ${toast.type === "success" ? "bg-[var(--success)]" : "bg-[var(--error)]"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
