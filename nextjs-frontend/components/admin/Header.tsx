"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Hexagon } from "lucide-react";

export default function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="app-bar">
      <div className="logo-area">
        <Hexagon className="w-6 h-6" strokeWidth={2} style={{ color: 'var(--primary)' }} />
        <h1>HYPERSPHERE CONTROL PLANE</h1>
        <p>Admin Dashboard</p>
      </div>
      <button onClick={handleLogout} className="btn btn-outlined" style={{ fontSize: "0.75rem" }}>
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </button>
    </header>
  );
}
