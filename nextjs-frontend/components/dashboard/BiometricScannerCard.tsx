import React, { RefObject } from "react";
import { Camera, ShieldAlert, CheckCircle2, UserPlus } from "lucide-react";

interface BiometricScannerCardProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  pendingLock: boolean;
  showSuccess: boolean;
  statusHtml: React.ReactNode;
  faceIsRegistered: boolean;
  userFaceStatus?: string;
  startWebcam: () => Promise<void> | void;
  stopWebcam: () => void;
  handleSelfRegister: () => Promise<void> | void;
}

export default function BiometricScannerCard({
  videoRef,
  canvasRef,
  isActive,
  pendingLock,
  showSuccess,
  statusHtml,
  faceIsRegistered,
  userFaceStatus,
  startWebcam,
  stopWebcam,
  handleSelfRegister,
}: BiometricScannerCardProps) {
  return (
    <main className="flex flex-col lg:h-full lg:overflow-hidden">
      <div className="video-container-card flex flex-col lg:h-full bg-[var(--surface)] border border-[var(--border-color)] rounded-xl overflow-hidden relative">
        <div className="bg-[#1a1a1a] text-white p-4 flex justify-between items-center text-sm font-semibold tracking-wide border-b border-[#333]">
          <span>Biometric Attendance Terminal</span>
          {isActive && (
            <span className="flex items-center gap-2 text-[var(--primary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span> LIVE
              SCANNING
            </span>
          )}
        </div>

        <div className="relative w-full aspect-[4/3] bg-[#0d0d0d] flex-1 flex items-center justify-center overflow-hidden">
          {pendingLock && (
            <div className="absolute inset-0 bg-[rgba(255,255,255,0.95)] z-20 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
              <ShieldAlert className="w-12 h-12 text-[var(--warning)] mb-4" />
              <h3 className="font-[var(--font-outfit)] text-xl text-[var(--text-primary)] mb-2">
                Awaiting Admin Review
              </h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-[320px] leading-relaxed">
                Your uploaded face photo is currently under verification by the CDI Administrator.
                Camera functions are locked in this state.
              </p>
            </div>
          )}

          {showSuccess && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#2e7d32f2] to-[#1b5e20f2] text-white z-30 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
              <div className="w-[72px] h-[72px] rounded-full bg-[rgba(255,255,255,0.2)] border-4 border-white flex items-center justify-center animate-in zoom-in duration-300 delay-100">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="font-[var(--font-outfit)] text-3xl font-bold mt-4 mb-2">
                Attendance Logged!
              </h2>
              <p className="text-lg opacity-90">Have a great day ahead.</p>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
              !isActive && "hidden"
            }`}
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1] ${
              !isActive || showSuccess ? "hidden" : "block"
            }`}
          />

          {!isActive && !pendingLock && !showSuccess && (
            <div className="text-[var(--text-secondary)] flex flex-col items-center opacity-50 relative z-10">
              <Camera className="w-12 h-12 mb-3" />
              <p className="text-sm text-center">
                Webcam is currently inactive.
                <br />
                Start the camera to begin live face capture.
              </p>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4 border-t border-[var(--divider)]">
          <div className="text-sm text-center min-h-[20px]">{statusHtml}</div>
          <div className="flex justify-center gap-4">
            {faceIsRegistered ? (
              isActive ? (
                <button
                  onClick={stopWebcam}
                  className="btn btn-outlined font-semibold border-[rgba(211,47,47,0.3)] text-[var(--error)]"
                >
                  Stop Camera
                </button>
              ) : (
                <button
                  onClick={startWebcam}
                  disabled={pendingLock}
                  className="btn btn-contained font-semibold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
                >
                  Mark Attendance
                </button>
              )
            ) : (
              userFaceStatus !== "pending_review" &&
              (isActive ? (
                <>
                  <button onClick={stopWebcam} className="btn btn-outlined font-semibold">
                    Stop Camera
                  </button>
                  <button
                    onClick={handleSelfRegister}
                    disabled={pendingLock}
                    className="btn btn-contained font-semibold flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" /> Capture &amp; Register
                  </button>
                </>
              ) : (
                <button
                  onClick={startWebcam}
                  disabled={pendingLock}
                  className="btn btn-contained font-semibold flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Register My Face
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
