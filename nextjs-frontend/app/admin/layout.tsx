"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const user = await res.json();
        localStorage.setItem("user", JSON.stringify(user));
        if (user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setAuthorized(true);
      } catch (e) {
        router.replace("/");
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-[var(--text-secondary)] text-sm animate-pulse">
          Verifying admin session...
        </div>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <>
      <Header />
      <div className="admin-container flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
        <Sidebar />
        <main className="admin-content flex-1 overflow-y-auto p-6 bg-[#f8f9fa]">
          {children}
        </main>
      </div>
    </>
  );
}
