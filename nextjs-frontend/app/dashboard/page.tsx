"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWebcam } from "@/hooks/useWebcam";
import { useFaceLiveness } from "@/hooks/useFaceLiveness";
import DashboardHeader, { CurrentLocationState } from "@/components/dashboard/DashboardHeader";
import BiometricScannerCard from "@/components/dashboard/BiometricScannerCard";
import UserProfileCard from "@/components/dashboard/UserProfileCard";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";
import AttendanceLogsCard from "@/components/dashboard/AttendanceLogsCard";
import UpdatePhotoModal from "@/components/dashboard/UpdatePhotoModal";
import ReportIssueModal from "@/components/dashboard/ReportIssueModal";

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [requestFile, setRequestFile] = useState<File | null>(null);

  const [statusHtml, setStatusHtml] = useState<React.ReactNode>("");
  const [pendingLock, setPendingLock] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<CurrentLocationState>({
    latitude: null,
    longitude: null,
    insideCampus: false,
    buildingName: "Locating...",
    buildingId: null,
  });

  const { videoRef, isActive, startWebcam, stopWebcam, captureFrameBlob } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { lastFaceDetectionRef, hasBlinkedRef } = useFaceLiveness(
    videoRef,
    canvasRef,
    isActive,
    showSuccess
  );

  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [updateMode, setUpdateMode] = useState<"upload" | "camera">("upload");

  // Location listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "LOCATION_UPDATE") {
        setCurrentLocation({
          latitude: event.data.latitude,
          longitude: event.data.longitude,
          insideCampus: event.data.insideCampus,
          buildingName: event.data.buildingName,
          buildingId: event.data.buildingId,
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // User session initialization
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      loadLogs(parsed.id);
      checkPendingRequests(parsed.id);
    } else {
      router.push("/");
    }
  }, [router]);

  const loadLogs = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/attendance?user_id=${userId}`);
      if (res.ok) {
        setLogs(await res.json());
        setVisibleCount(8);
      }
    } catch (e) {
      console.error("Failed to load logs", e);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequests = async (userId: string) => {
    try {
      const res = await fetch("/api/v1/face-requests?status=pending");
      if (res.ok) {
        const requests = await res.json();
        const pending = requests.some((r: any) => r.user_id === userId);
        setPendingLock(pending);
      }
    } catch (e) {}
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (res.ok) {
        const updatedUser = await res.json();
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    } catch (e) {}
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("user");
    router.push("/");
  };

  const faceIsRegistered =
    user?.face_status === "registered" || user?.face_status === "approved";

  // Sync statusHtml with camera active state
  useEffect(() => {
    if (isActive) {
      if (faceIsRegistered) {
        setStatusHtml(
          <span className="text-[var(--primary)] font-semibold">
            Camera is live. Scanning for face...
          </span>
        );
      } else {
        setStatusHtml(
          <span className="text-[var(--primary)] font-semibold">
            Camera started. Position face and click Register.
          </span>
        );
      }
    } else {
      setStatusHtml("");
    }
  }, [isActive, faceIsRegistered]);

  const handleVerify = useCallback(async () => {
    const faceState = lastFaceDetectionRef.current;

    if (!faceState.hasFace) {
      setStatusHtml(
        <span className="text-[var(--warning)] font-semibold">
          Position your face in the camera view.
        </span>
      );
      return;
    }

    if (faceState.faceArea < 0.06) {
      setStatusHtml(
        <span className="text-[var(--warning)] font-semibold">
          Please move closer to the camera.
        </span>
      );
      return;
    }

    if (faceState.yaw > 20 || faceState.pitch > 20 || faceState.roll > 20) {
      setStatusHtml(
        <span className="text-[var(--warning)] font-semibold">
          Please look straight at the camera.
        </span>
      );
      return;
    }

    if (!hasBlinkedRef.current) {
      setStatusHtml(
        <span className="text-[var(--primary)] font-semibold animate-pulse">
          Blink your eyes to verify liveness...
        </span>
      );
      return;
    }

    setStatusHtml(
      <span className="text-[var(--primary)] animate-pulse">
        Scanning identity &amp; liveness...
      </span>
    );

    const blobs: Blob[] = [];
    for (let i = 0; i < 5; i++) {
      const blob = await captureFrameBlob();
      if (blob) blobs.push(blob);
      if (i < 4) await new Promise((r) => setTimeout(r, 200));
    }

    if (blobs.length === 0) {
      setStatusHtml(
        <span className="text-[var(--error)]">Camera must be running to verify.</span>
      );
      return;
    }

    const formData = new FormData();
    formData.append("device_id", "Web_Dashboard");
    if (currentLocation.buildingName && currentLocation.buildingName !== "Locating...") {
      formData.append("location_name", currentLocation.buildingName);
    }
    if (currentLocation.latitude !== null) {
      formData.append("latitude", currentLocation.latitude.toString());
    }
    if (currentLocation.longitude !== null) {
      formData.append("longitude", currentLocation.longitude.toString());
    }
    blobs.forEach((blob, idx) => {
      formData.append("files", blob, `verify_${idx}.jpg`);
    });

    try {
      const res = await fetch("/api/v1/verify", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.status === "CONFIRMED") {
        if (data.candidate?.faculty_id === user?.id) {
          setShowSuccess(true);
          hasBlinkedRef.current = false;
          setTimeout(() => {
            setShowSuccess(false);
            if (user) loadLogs(user.id);
          }, 4000);
        } else {
          setStatusHtml(
            <span className="text-[var(--warning)]">Waiting for registered user.</span>
          );
        }
      } else if (
        res.ok &&
        data.status === "MANUAL_REVIEW" &&
        data.candidate?.faculty_id === user?.id
      ) {
        setStatusHtml(
          <span className="text-[var(--warning)]">
            Attendance logged (Flagged for Manual Review).
          </span>
        );
        hasBlinkedRef.current = false;
        if (user) loadLogs(user.id);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        setStatusHtml(
          <span className="text-[var(--error)]">
            {data.status === "REJECTED"
              ? "Liveness check failed (Spoof detected)."
              : "Verification failed or no match found."}
          </span>
        );
      }
    } catch (e) {
      setStatusHtml(
        <span className="text-[var(--error)]">Connection error during verification.</span>
      );
    }
  }, [
    captureFrameBlob,
    currentLocation,
    hasBlinkedRef,
    lastFaceDetectionRef,
    user,
  ]);

  // Continuous Verification Loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runLoop = async () => {
      if (!isActive || !faceIsRegistered || pendingLock || showSuccess || isVerifying) return;

      setIsVerifying(true);
      await handleVerify();
      setIsVerifying(false);

      timeoutId = setTimeout(runLoop, 2000);
    };

    if (isActive && faceIsRegistered && !pendingLock && !showSuccess && !isVerifying) {
      timeoutId = setTimeout(runLoop, 1000);
    }

    return () => clearTimeout(timeoutId);
  }, [isActive, faceIsRegistered, pendingLock, showSuccess, isVerifying, handleVerify]);

  const handleSelfRegister = async () => {
    if (!isActive) {
      await startWebcam();
      setStatusHtml(
        <span className="text-[var(--primary)]">
          Camera started. Position your face and click &quot;Capture &amp; Register&quot;.
        </span>
      );
      return;
    }

    setStatusHtml(
      <span className="text-[var(--primary)] animate-pulse">
        Capturing face for registration...
      </span>
    );

    const blob = await captureFrameBlob();
    if (!blob) {
      setStatusHtml(
        <span className="text-[var(--error)]">
          Could not capture frame. Ensure camera is running.
        </span>
      );
      return;
    }

    const formData = new FormData();
    formData.append("faculty_id", user.id);
    formData.append("name", user.name);
    formData.append("file", blob, "registration.jpg");

    try {
      const res = await fetch("/api/v1/register", { method: "POST", body: formData });
      if (res.ok) {
        setStatusHtml(
          <span className="text-[var(--success)] font-semibold">
            ✓ Biometrics successfully registered!
          </span>
        );
        await refreshUser();
      } else {
        const err = await res.json();
        setStatusHtml(
          <span className="text-[var(--error)]">
            Registration failed: {err.detail || "Try again"}
          </span>
        );
      }
    } catch (err) {
      setStatusHtml(
        <span className="text-[var(--error)]">Connection error during registration.</span>
      );
    }
  };

  const handleCameraCapture = async () => {
    if (!isActive) {
      alert("Please activate the camera on the left panel before capturing.");
      return;
    }
    try {
      const blob = await captureFrameBlob();
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        setRequestFile(file);
        if (capturePreview) {
          URL.revokeObjectURL(capturePreview);
        }
        const previewUrl = URL.createObjectURL(blob);
        setCapturePreview(previewUrl);
      } else {
        alert("Failed to capture frame from webcam. Please ensure feed is active.");
      }
    } catch (e) {
      console.error("Camera capture failed:", e);
      alert("Failed to capture from webcam.");
    }
  };

  const submitFaceRequest = async (type: string, e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("user_id", user?.id || "");
    formData.append("request_type", type);
    formData.append("message", requestText);
    if (requestFile) formData.append("file", requestFile);

    try {
      const res = await fetch("/api/v1/face-requests", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        alert("Request submitted successfully.");
        setIsPhotoModalOpen(false);
        setIsIssueModalOpen(false);
        setRequestText("");
        setRequestFile(null);
        setCapturePreview(null);
        setUpdateMode("upload");
        if (user) checkPendingRequests(user.id);
      } else {
        const err = await res.json();
        alert(`Request failed: ${err.detail || "Server error"}`);
      }
    } catch (err) {
      alert("Connection failed.");
    }
  };

  if (!user) return null;

  return (
    <div className="font-[var(--font-roboto)] h-screen flex flex-col overflow-hidden">
      {/* App Bar */}
      <DashboardHeader currentLocation={currentLocation} onLogout={handleLogout} />

      {/* Main Grid Layout */}
      <div className="w-full px-6 py-6 lg:h-[calc(100vh-64px)] grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 lg:overflow-hidden flex-1">
        {/* Left Column - Face Biometric Terminal */}
        <BiometricScannerCard
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={isActive}
          pendingLock={pendingLock}
          showSuccess={showSuccess}
          statusHtml={statusHtml}
          faceIsRegistered={faceIsRegistered}
          userFaceStatus={user.face_status}
          startWebcam={startWebcam}
          stopWebcam={stopWebcam}
          handleSelfRegister={handleSelfRegister}
        />

        {/* Right Column - User Profile details & logs */}
        <aside className="flex flex-col gap-4 lg:h-full lg:overflow-hidden">
          <UserProfileCard user={user} />
          <QuickActionsCard
            setIsPhotoModalOpen={setIsPhotoModalOpen}
            setIsIssueModalOpen={setIsIssueModalOpen}
          />
          <AttendanceLogsCard
            logs={logs}
            loading={loading}
            visibleCount={visibleCount}
            onLoadMore={() => setVisibleCount((prev) => prev + 10)}
          />
        </aside>
      </div>

      {/* Modals */}
      <UpdatePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        updateMode={updateMode}
        setUpdateMode={setUpdateMode}
        requestFile={requestFile}
        setRequestFile={setRequestFile}
        capturePreview={capturePreview}
        setCapturePreview={setCapturePreview}
        requestText={requestText}
        setRequestText={setRequestText}
        onSubmit={submitFaceRequest}
        handleCameraCapture={handleCameraCapture}
        isCameraActive={isActive}
      />

      <ReportIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        requestText={requestText}
        setRequestText={setRequestText}
        onSubmit={submitFaceRequest}
      />

      {/* Hidden Geolocation/Geofencing tracking Iframe */}
      <iframe
        src="http://localhost:8080/map/locate.html"
        allow="geolocation"
        style={{
          width: "1px",
          height: "1px",
          opacity: 0,
          position: "absolute",
          pointerEvents: "none",
        }}
        title="NITT Geofencing Engine"
      />
    </div>
  );
}
