import React from "react";
import { Camera } from "lucide-react";

interface UpdatePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateMode: "upload" | "camera";
  setUpdateMode: (mode: "upload" | "camera") => void;
  requestFile: File | null;
  setRequestFile: (file: File | null) => void;
  capturePreview: string | null;
  setCapturePreview: (url: string | null) => void;
  requestText: string;
  setRequestText: (text: string) => void;
  onSubmit: (type: string, e: React.FormEvent) => void;
  handleCameraCapture: () => void;
  isCameraActive: boolean;
}

export default function UpdatePhotoModal({
  isOpen,
  onClose,
  updateMode,
  setUpdateMode,
  requestFile,
  setRequestFile,
  capturePreview,
  setCapturePreview,
  requestText,
  setRequestText,
  onSubmit,
  handleCameraCapture,
  isCameraActive,
}: UpdatePhotoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center animate-in fade-in duration-200">
      <div
        className="bg-[var(--surface)] border border-[var(--border-color)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] w-full max-w-[460px] animate-in zoom-in-95 duration-200"
        style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <div
          className="flex justify-between items-center border-b border-[var(--divider)] pb-3"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 className="font-[var(--font-outfit)] text-lg font-bold text-[var(--text-primary)] m-0">
            Request Face Update
          </h3>
          <button
            onClick={() => {
              onClose();
              setCapturePreview(null);
            }}
            className="text-[var(--text-secondary)] hover:bg-[#f1f3f4] px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "8px" }}>
          <button
            type="button"
            onClick={() => {
              setUpdateMode("upload");
              setRequestFile(null);
              setCapturePreview(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer",
              border: "none",
              borderBottom:
                updateMode === "upload" ? "2px solid var(--primary)" : "2px solid transparent",
              color: updateMode === "upload" ? "var(--primary)" : "var(--text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => {
              setUpdateMode("camera");
              setRequestFile(null);
              setCapturePreview(null);
            }}
            style={{
              flex: 1,
              padding: "10px",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer",
              border: "none",
              borderBottom:
                updateMode === "camera" ? "2px solid var(--primary)" : "2px solid transparent",
              color: updateMode === "camera" ? "var(--primary)" : "var(--text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            Capture From Camera
          </button>
        </div>

        <form
          onSubmit={(e) => onSubmit("update", e)}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {updateMode === "upload" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                Upload Clear Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setRequestFile(e.target.files?.[0] || null)}
                required
                className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa]"
                style={{ border: "1px solid var(--border-color)" }}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <label
                className="text-xs font-semibold uppercase text-[var(--text-secondary)]"
                style={{ alignSelf: "flex-start" }}
              >
                Capture Photo from Webcam
              </label>

              {capturePreview ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "180px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "#000",
                  }}
                >
                  <img
                    src={capturePreview}
                    alt="Webcam Capture Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCapturePreview(null);
                      setRequestFile(null);
                    }}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Retake
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    padding: "24px",
                    borderRadius: "8px",
                    border: "1px dashed var(--border-color)",
                    backgroundColor: "#fafafa",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      textAlign: "center",
                    }}
                  >
                    {isCameraActive
                      ? "Webcam feed is active on the main dashboard."
                      : "Please start the main dashboard camera first."}
                  </span>
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    disabled={!isCameraActive}
                    className="btn btn-contained"
                    style={{
                      opacity: isCameraActive ? 1 : 0.6,
                      cursor: isCameraActive ? "pointer" : "not-allowed",
                    }}
                  >
                    <Camera className="w-4 h-4" /> Capture Frame
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
              Reason / Note to Admin
            </label>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="e.g. Bad lighting in my initial capture..."
              rows={3}
              required
              className="border border-[var(--border-color)] p-2 rounded-md text-sm w-full bg-[#fafafa] resize-none outline-none"
              style={{ border: "1px solid var(--border-color)" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                setCapturePreview(null);
              }}
              className="btn btn-outlined"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-contained"
              disabled={!requestFile}
              style={{
                opacity: requestFile ? 1 : 0.6,
                cursor: requestFile ? "pointer" : "not-allowed",
              }}
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
