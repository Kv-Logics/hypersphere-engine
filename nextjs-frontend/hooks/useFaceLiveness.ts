"use client";

import { useRef, useEffect, useState, useCallback, RefObject } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceDetectionState {
  hasFace: boolean;
  faceArea: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export function useFaceLiveness(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isActive: boolean,
  showSuccess: boolean
) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const initTimeRef = useRef<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const lastFaceDetectionRef = useRef<FaceDetectionState>({
    hasFace: false,
    faceArea: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
  });

  const hasBlinkedRef = useRef(false);
  const earHistoryRef = useRef<number[]>([]);

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    let isCurrent = true;
    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const originalConsoleLog = console.log;
        const originalConsoleInfo = console.info;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        console.log = () => {};
        console.info = () => {};
        console.warn = () => {};
        console.error = () => {};

        let faceLandmarker: FaceLandmarker | undefined;
        try {
          faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: false,
            runningMode: "VIDEO",
            numFaces: 1,
          });
        } finally {
          console.log = originalConsoleLog;
          console.info = originalConsoleInfo;
          console.warn = originalConsoleWarn;
          console.error = originalConsoleError;
        }

        if (isCurrent && faceLandmarker) {
          landmarkerRef.current = faceLandmarker;
          initTimeRef.current = Date.now();
          setIsModelLoaded(true);
        }
      } catch (err) {
        console.warn("Failed to initialize MediaPipe FaceLandmarker:", err);
      }
    }
    initMediaPipe();

    return () => {
      isCurrent = false;
      cancelAnimationFrame(animationRef.current);
      if (landmarkerRef.current) {
        const timeElapsed = Date.now() - initTimeRef.current;
        if (timeElapsed > 5000) {
          const originalConsoleError = console.error;
          console.error = () => {};
          try {
            landmarkerRef.current.close();
          } catch (e) {
            console.warn("Failed to close FaceLandmarker:", e);
          } finally {
            console.error = originalConsoleError;
          }
        }
        landmarkerRef.current = null;
      }
    };
  }, []);

  const drawHUD = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current || !landmarkerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
          const results = landmarkerRef.current.detectForVideo(video, performance.now());
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            let minX = canvas.width,
              maxX = 0,
              minY = canvas.height,
              maxY = 0;

            landmarks.forEach((lm) => {
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            });

            const w = maxX - minX;
            const h = maxY - minY;
            minX = Math.max(0, minX - w * 0.15);
            maxX = Math.min(canvas.width, maxX + w * 0.15);
            minY = Math.max(0, minY - h * 0.15);
            maxY = Math.min(canvas.height, maxY + h * 0.15);

            const boxW = maxX - minX;
            const boxH = maxY - minY;
            const len = Math.min(boxW, boxH) * 0.2;

            // Gates Calculations
            const faceArea = (w * h) / (canvas.width * canvas.height);
            const nose = landmarks[4];
            const leftEyeCorner = landmarks[33];
            const rightEyeCorner = landmarks[263];
            const forehead = landmarks[10];
            const chin = landmarks[152];

            const yaw =
              Math.abs((nose.x - leftEyeCorner.x) / (rightEyeCorner.x - leftEyeCorner.x) - 0.5) * 180;
            const pitch =
              Math.abs((nose.y - forehead.y) / (chin.y - forehead.y) - 0.4) * 180;
            const roll = Math.abs(
              Math.atan2(rightEyeCorner.y - leftEyeCorner.y, rightEyeCorner.x - leftEyeCorner.x) *
                (180 / Math.PI)
            );

            lastFaceDetectionRef.current = {
              hasFace: true,
              faceArea,
              yaw,
              pitch,
              roll,
            };

            // Calculate EAR for blink detection
            const getDistance = (p1: any, p2: any) => {
              const dx = (p1.x - p2.x) * canvas.width;
              const dy = (p1.y - p2.y) * canvas.height;
              return Math.sqrt(dx * dx + dy * dy);
            };
            const getEAR = (eyeLms: any[]) => {
              const d_v1 = getDistance(eyeLms[1], eyeLms[5]);
              const d_v2 = getDistance(eyeLms[2], eyeLms[4]);
              const d_h = getDistance(eyeLms[0], eyeLms[3]);
              if (d_h === 0) return 0;
              return (d_v1 + d_v2) / (2.0 * d_h);
            };
            const leftEyeLms = [
              landmarks[33],
              landmarks[160],
              landmarks[158],
              landmarks[133],
              landmarks[153],
              landmarks[144],
            ];
            const rightEyeLms = [
              landmarks[263],
              landmarks[385],
              landmarks[387],
              landmarks[362],
              landmarks[373],
              landmarks[380],
            ];
            const earL = getEAR(leftEyeLms);
            const earR = getEAR(rightEyeLms);
            const avgEAR = (earL + earR) / 2.0;

            const earHistory = earHistoryRef.current;
            earHistory.push(avgEAR);
            if (earHistory.length > 25) earHistory.shift();

            let closedIndex = -1;
            for (let i = 0; i < earHistory.length; i++) {
              if (earHistory[i] < 0.14) {
                closedIndex = i;
                break;
              }
            }
            if (closedIndex > 0 && closedIndex < earHistory.length - 1) {
              let recoveryDetected = false;
              for (let j = closedIndex + 1; j < earHistory.length; j++) {
                if (earHistory[j] > 0.19) {
                  recoveryDetected = true;
                  break;
                }
              }
              if (recoveryDetected) {
                hasBlinkedRef.current = true;
              }
            }

            const isPoseOk = yaw <= 20 && pitch <= 20 && roll <= 20;
            const isAreaOk = faceArea >= 0.06;

            // Render Premium HUD UI Panel
            ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
            ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(16, 16, 220, 80, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isAreaOk ? "#10b981" : "#f43f5e";
            ctx.beginPath();
            ctx.arc(30, 36, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
            ctx.fillText(
              `Distance: ${isAreaOk ? "OK" : "Too Far"} (${Math.round(faceArea * 100)}%)`,
              42,
              39
            );

            ctx.fillStyle = isPoseOk ? "#10b981" : "#f43f5e";
            ctx.beginPath();
            ctx.arc(30, 56, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(
              `Pose: ${isPoseOk ? "Frontal" : "Turned"} (Y:${Math.round(yaw)}° P:${Math.round(pitch)}°)`,
              42,
              59
            );

            ctx.fillStyle = hasBlinkedRef.current ? "#10b981" : "#f59e0b";
            ctx.beginPath();
            ctx.arc(30, 76, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(
              `Liveness: ${hasBlinkedRef.current ? "Blink Verified" : "Please Blink Eyes"}`,
              42,
              79
            );

            // Draw outer corner brackets
            ctx.strokeStyle =
              isPoseOk && isAreaOk && hasBlinkedRef.current ? "#10b981" : "#f59e0b";
            ctx.lineWidth = Math.max(3, canvas.width * 0.005);

            ctx.beginPath();
            ctx.moveTo(minX, minY + len);
            ctx.lineTo(minX, minY);
            ctx.lineTo(minX + len, minY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(maxX, minY + len);
            ctx.lineTo(maxX, minY);
            ctx.lineTo(maxX - len, minY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(minX, maxY - len);
            ctx.lineTo(minX, maxY);
            ctx.lineTo(minX + len, maxY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(maxX, maxY - len);
            ctx.lineTo(maxX, maxY);
            ctx.lineTo(maxX - len, maxY);
            ctx.stroke();
          } else {
            lastFaceDetectionRef.current = {
              hasFace: false,
              faceArea: 0,
              yaw: 0,
              pitch: 0,
              roll: 0,
            };
          }
        } catch (e) {}
      }
    }
    animationRef.current = requestAnimationFrame(drawHUD);
  }, [isActive, videoRef, canvasRef]);

  // HUD Drawing Loop
  useEffect(() => {
    if (isActive && !showSuccess) {
      animationRef.current = requestAnimationFrame(drawHUD);
    } else {
      cancelAnimationFrame(animationRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive, showSuccess, drawHUD, canvasRef]);

  return {
    landmarkerRef,
    isModelLoaded,
    lastFaceDetectionRef,
    hasBlinkedRef,
    drawHUD,
  };
}
