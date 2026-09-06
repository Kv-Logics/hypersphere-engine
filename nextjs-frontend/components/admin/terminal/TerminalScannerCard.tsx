import React, { RefObject } from "react";
import { Video, VideoOff, ScanFace, Square, Play } from "lucide-react";

interface TerminalScannerCardProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  liveDemo: boolean;
  onStartCam: () => void;
  onStopCam: () => void;
  onVerifyCapture: () => void;
  onToggleLiveDemo: () => void;
}

export default function TerminalScannerCard({
  videoRef,
  isActive,
  liveDemo,
  onStartCam,
  onStopCam,
  onVerifyCapture,
  onToggleLiveDemo,
}: TerminalScannerCardProps) {
  return (
    <main className="flex-1 flex flex-col p-4 overflow-hidden">
      <div className="video-container-card flex flex-col flex-1 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="bg-[#1a1a1a] text-white p-3 flex justify-between items-center text-sm font-semibold tracking-wide border-b border-[#333]">
          <span>Live Video Capture Feed</span>
          {isActive && (
            <span className="flex items-center gap-2 text-[var(--primary)] text-xs">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span> LIVE
              SCANNING
            </span>
          )}
        </div>

        <div className="relative flex-1 bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${!isActive && "hidden"}`}
          />
          {!isActive && (
            <div className="text-[var(--text-secondary)] flex flex-col items-center opacity-40">
              <Video className="w-12 h-12 mb-3" />
              <p className="text-sm text-center">
                Webcam is currently inactive.
                <br />
                Start the camera to begin live face capture.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 flex justify-center gap-3 border-t border-[var(--divider)] flex-wrap">
          {!isActive ? (
            <button
              onClick={onStartCam}
              className="btn btn-outlined flex items-center gap-2 text-sm"
            >
              <Video className="w-4 h-4" /> Start Camera
            </button>
          ) : (
            <button
              onClick={onStopCam}
              className="btn btn-outlined flex items-center gap-2 text-sm border-[rgba(211,47,47,0.3)] text-[var(--error)]"
            >
              <VideoOff className="w-4 h-4" /> Stop Camera
            </button>
          )}
          <button
            onClick={onVerifyCapture}
            className="btn btn-contained flex items-center gap-2 text-sm"
          >
            <ScanFace className="w-4 h-4" /> Capture &amp; Verify
          </button>
          <button
            onClick={onToggleLiveDemo}
            className={`btn ${
              liveDemo ? "btn-contained bg-[var(--error)]" : "btn-outlined"
            } flex items-center gap-2 text-sm`}
          >
            {liveDemo ? (
              <>
                <Square className="w-4 h-4" /> Stop Live Demo
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Live Demo
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
