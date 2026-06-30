"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, UserCircle, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [statusHtml, setStatusHtml] = useState<React.ReactNode>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  
  useEffect(() => {
    fetch("/api/v1/auth/me").then(res => {
      if (res.ok) {
        res.json().then(user => {
          localStorage.setItem("user", JSON.stringify(user));
          router.push(user.role === "admin" ? "/admin/users" : "/dashboard");
        });
      }
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    setShowRegister(false);
    if (!username) {
      setStatusHtml(null);
      return;
    }
    
    let cleanUser = username.trim().toLowerCase();
    if (cleanUser.includes("@")) {
      cleanUser = cleanUser.split("@")[0];
    }
    
    setStatusHtml(<span className="text-[var(--primary)] text-sm">Checking database...</span>);
    
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/auth/lookup?username=${cleanUser}`);
        if (res.status === 200) {
          const data = await res.json();
          setStatusHtml(<span className="text-[var(--success)] font-medium text-sm">✓ Welcome back, {data.name}! Redirecting...</span>);
          localStorage.setItem("user", JSON.stringify(data));
          setTimeout(() => {
            router.push(data.role === "admin" ? "/admin/users" : "/dashboard");
          }, 1000);
        } else if (res.status === 404) {
          setStatusHtml(<span className="text-[var(--warning)] text-sm">Username not found. Fill details below:</span>);
          setEmail(`${cleanUser}@nitt.edu`);
          setShowRegister(true);
        } else {
          setStatusHtml(<span className="text-[var(--warning)] text-sm">Error searching database.</span>);
        }
      } catch (e) {
        setStatusHtml(<span className="text-[var(--warning)] text-sm">Connection error.</span>);
      }
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [username, router]);

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanUser = username.trim().toLowerCase();
    if (cleanUser.includes("@")) cleanUser = cleanUser.split("@")[0];
    
    try {
      const res = await fetch('/api/v1/auth/register-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanUser, name: fullName, email })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("user", JSON.stringify(data));
        router.push(data.role === "admin" ? "/admin/users" : "/dashboard");
      } else {
        const err = await res.json();
        alert(`Registration failed: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      alert("Connection failed. Could not register profile.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 font-[var(--font-roboto)]">
      <div className="w-full max-w-[440px]">
        <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] p-10 flex flex-col gap-6 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[#00b0ff]"></div>
          
          <div className="text-center flex flex-col items-center gap-2">
            <div className="text-[var(--primary)] bg-[#e3f2fd] w-14 h-14 rounded-xl flex items-center justify-center mb-2 shadow-[0_4px_12px_rgba(25,118,210,0.15)]">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="font-[var(--font-outfit)] text-xl font-bold tracking-wide text-[var(--text-primary)] uppercase m-0">Hypersphere Control Plane</h1>
            <p className="text-sm text-[var(--text-secondary)] m-0">NITT Biometric Portal</p>
          </div>
          
          <div className="flex flex-col gap-2 relative">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Username / Email Prefix</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                <UserCircle className="w-[18px] h-[18px]" />
              </span>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jpeter" 
                className="w-full py-3.5 pr-4 pl-10 border border-[var(--border-color)] rounded-lg bg-[#fafafa] text-base text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[rgba(25,118,210,0.1)]"
              />
            </div>
            <div className="min-h-[20px] flex items-center gap-1.5 mt-1">
              {statusHtml}
            </div>
          </div>
          
          {showRegister && (
            <form onSubmit={handleManualRegister} className="flex flex-col gap-5 border-t border-[var(--divider)] pt-5 animate-in slide-in-from-top-2 duration-300">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Full Name</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                    <UserCircle className="w-[18px] h-[18px]" />
                  </span>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. A. John Peter" 
                    required 
                    className="w-full py-3.5 pr-4 pl-10 border border-[var(--border-color)] rounded-lg bg-[#fafafa] text-base text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[rgba(25,118,210,0.1)]"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">NITT Email</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none">
                    <Mail className="w-[18px] h-[18px]" />
                  </span>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jpeter@nitt.edu" 
                    required 
                    className="w-full py-3.5 pr-4 pl-10 border border-[var(--border-color)] rounded-lg bg-[#fafafa] text-base text-[var(--text-primary)] outline-none transition-all duration-200 focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[rgba(25,118,210,0.1)]"
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-contained w-full flex justify-center p-3.5 text-[0.95rem]">
                Register Profile & Login
              </button>
            </form>
          )}
        </div>
        
        <div className="text-center text-xs text-[var(--text-secondary)] mt-4">
          Department of Computer Applications, NIT Trichy
        </div>
      </div>
    </div>
  );
}
