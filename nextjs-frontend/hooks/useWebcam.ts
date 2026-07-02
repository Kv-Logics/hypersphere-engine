import { useState, useRef, useCallback, useEffect } from 'react';

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopWebcam = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
    }
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsActive(true);
          setError(null);
        }
      } else {
        setError("Camera API not supported in this browser.");
      }
    } catch (err: any) {
      setError(err.message || "Could not access the camera.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  const captureFrameBlob = useCallback(async (targetWidth = 640, targetHeight = 480, quality = 0.85): Promise<Blob | null> => {
    if (!videoRef.current || !isActive) return null;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });
  }, [isActive]);

  return { videoRef, isActive, error, startWebcam, stopWebcam, captureFrameBlob };
}
