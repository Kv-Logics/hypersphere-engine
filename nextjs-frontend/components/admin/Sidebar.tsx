"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, FileWarning, AlertTriangle, CalendarDays, Camera, ScanFace, Activity } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [driftCount, setDriftCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const reqRes = await fetch("/api/v1/face-requests?status=pending");
        if (reqRes.ok) {
          const data = await reqRes.json();
          setPendingCount(data.length || 0);
        }
        
        const driftRes = await fetch("/api/v1/admin/drift-requests");
        if (driftRes.ok) {
          const data = await driftRes.json();
          setDriftCount(data.length || 0);
        }
      } catch (e) {
        console.error("Failed to fetch notification badges", e);
      }
    };
    
    fetchCounts();
    // Poll every 10 seconds for badges
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: "User Management", path: "/admin/users", icon: <Users size={18} /> },
    { name: "Pending Requests", path: "/admin/requests", icon: <FileWarning size={18} />, badge: pendingCount, badgeColor: "var(--warning)" },
    { name: "Drift Reviews", path: "/admin/drifts", icon: <AlertTriangle size={18} />, badge: driftCount, badgeColor: "var(--error)" },
    { name: "Attendance Reports", path: "/admin/reports", icon: <CalendarDays size={18} /> },
    { name: "Biometric Tester", path: "/admin/tester", icon: <Camera size={18} /> },
    { name: "Biometric Playground", path: "/admin/playground", icon: <ScanFace size={18} /> },
    { name: "System Health", path: "/admin/health", icon: <Activity size={18} /> },
  ];

  return (
    <nav className="admin-nav">
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          href={item.path}
          className={`nav-tab-btn ${pathname === item.path ? "active" : ""}`}
        >
          {item.icon}
          {item.name}
          {item.badge !== undefined && item.badge > 0 && (
            <span 
              className="badge" 
              style={{ backgroundColor: item.badgeColor, color: "var(--surface)", display: "inline-flex" }}
            >
              {item.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
