"use client";

import React, { useState, useEffect } from "react";
import { Building2, Search, Plus, Trash2 } from "lucide-react";

export default function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/v1/faculty");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                        u.email_prefix?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "" || u.face_registered_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="section-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <h2 style={{ border: "none", padding: 0, margin: 0 }}>User Profiles</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowModal(true)} className="btn btn-contained" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
            <Plus className="w-4 h-4 mr-1" /> Add User
          </button>
          <div style={{ position: "relative" }}>
            <Search className="w-4 h-4 text-[var(--text-secondary)]" style={{ position: "absolute", left: "8px", top: "10px" }} />
            <input 
              type="text" 
              placeholder="Search by name or email prefix..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: "1px solid var(--border-color)", padding: "0.5rem 0.85rem 0.5rem 2rem", borderRadius: "6px", fontSize: "0.85rem", width: "220px", outline: "none" }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ border: "1px solid var(--border-color)", padding: "0.5rem", borderRadius: "6px", fontSize: "0.85rem" }}
          >
            <option value="">All Statuses</option>
            <option value="none">No Face</option>
            <option value="registered">Registered</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="attendance-table" style={{ fontSize: "0.9rem" }}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Building2 className="w-4 h-4" style={{ opacity: 0.8 }} />
                  Department
                </div>
              </th>
              <th>Biometrics</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
                  Loading user registry...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                let badgeColor = "var(--text-secondary)";
                let badgeText = u.face_registered_status;
                if (badgeText === "none") {
                  badgeColor = "var(--text-secondary)"; badgeText = "No Profile";
                } else if (badgeText === "registered") {
                  badgeColor = "var(--primary)"; badgeText = "Enrolled";
                } else if (badgeText === "pending_review") {
                  badgeColor = "var(--warning)"; badgeText = "Pending Review";
                } else if (badgeText === "approved") {
                  badgeColor = "var(--success)"; badgeText = "Approved";
                }
                
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="faculty-id">{u.email_prefix}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>ID: {u.faculty_id}</div>
                    </td>
                    <td className="faculty-name">{u.name}</td>
                    <td>{u.department || "General"}</td>
                    <td>
                      <span className="stage-fallback-badge" style={{ backgroundColor: badgeColor + '20', color: badgeColor, border: `1px solid ${badgeColor}40` }}>
                        {badgeText}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="delete-profile-btn" title="Delete Profile">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Add User Modal */}
      {showModal && (
        <AddUserModal onClose={() => setShowModal(false)} onRefresh={fetchUsers} />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    email_prefix: "",
    faculty_id: "",
    department: "",
    role: "user"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        alert("Failed to add user.");
      }
    } catch (err) {
      alert("Error adding user.");
    }
  };

  return (
    <div className="modal-overlay" style={{ display: "flex" }}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>Add New User</h3>
          <button type="button" className="close-modal" onClick={onClose} style={{ fontSize: "1.5rem" }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-field">
            <label>Full Name</label>
            <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ramesh Kumar" />
          </div>
          <div className="form-row">
            <div className="input-field">
              <label>Webmail / Username</label>
              <input required type="text" value={formData.email_prefix} onChange={(e) => setFormData({...formData, email_prefix: e.target.value})} placeholder="rameshk" />
            </div>
            <div className="input-field">
              <label>Employee ID</label>
              <input required type="text" value={formData.faculty_id} onChange={(e) => setFormData({...formData, faculty_id: e.target.value})} placeholder="EMP123" />
            </div>
          </div>
          <div className="form-row">
            <div className="input-field">
              <label>Department</label>
              <input type="text" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} placeholder="Computer Science" />
            </div>
            <div className="input-field">
              <label>Role</label>
              <select 
                value={formData.role} 
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                style={{ border: "1px solid var(--border-color)", padding: "0.55rem 0.75rem", borderRadius: "4px", fontSize: "0.9rem", backgroundColor: "#fafafa", outline: "none" }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="action-bar" style={{ marginTop: "1.5rem" }}>
            <button type="button" onClick={onClose} className="btn btn-outlined">Cancel</button>
            <button type="submit" className="btn btn-contained">Create User</button>
          </div>
        </form>
      </div>
    </div>
  );
}
