import React from "react";
import Sidebar from "@/components/admin/Sidebar";
import Header from "@/components/admin/Header";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
