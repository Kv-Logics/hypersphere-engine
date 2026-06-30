"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/");
    } else {
      setMounted(true);
    }
  }, [router]);
  
  if (!mounted) return null;
  return <div className="min-h-screen bg-[#f8f9fa]">{children}</div>;
}
