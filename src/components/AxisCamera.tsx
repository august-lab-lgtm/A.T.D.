import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, AlertCircle, Crosshair, Radar } from "lucide-react";
import { detectMultipleTargets } from "../utils/motionDetection";
import type { MotionPoint } from "../types";

interface AxisCameraProps {
  bounds: { width: number; height: number };
  onTrackedPositionUpdate: (points: MotionPoint[]) => void;
}

export function AxisCamera({ bounds, onTrackedPositionUpdate }: AxisCameraProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [displayTargets, setDisplayTargets] = useState<MotionPoint[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const animationFrameRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: bounds.width },
          height: { ideal: bounds.height },
        },
      });

      setStream(mediaStream);
      streamRef.current = mediaStream;
      setIsActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Axis camera access error:", err);
      setError("Unable to access camera. Please check permissions.");
      setIsActive(false);
    }
  }, [bounds]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setIsActive(false);
    }
    previousFrameRef.current = null;
    setDisplayTargets([]);
  }, []);

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        ctx.drawImage(videoRef.current, 0, 0, bounds.width, bounds.height);
        const frameData = ctx.getImageData(0, 0, bounds.width, bounds.height);

        const detected = detectMultipleTargets(
          frameData.data,
          previousFrameRef.current,
          bounds.width,
          bounds.height,
          30,
          6
        );

        onTrackedPositionUpdate(detected);

        setDisplayTargets((prev) => {
          if (detected.length === 0) {
            return [];
          }

          return detected.map((newTarget) => {
            const prevTarget = prev.find(
              (p) => Math.hypot(p.x - newTarget.x, p.y - newTarget.y) < 100
            );

            if (prevTarget) {
              return {
                ...newTarget,
                x: prevTarget.x + (newTarget.x - prevTarget.x) * 0.8,
                y: prevTarget.y + (newTarget.y - prevTarget.y) * 0.8,
              };
            }

            return newTarget;
          });
        });

        previousFrameRef.current = frameData.data;
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, bounds, onTrackedPositionUpdate]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div
      className="relative bg-slate-900 rounded-xl overflow-hidden border border-red-900/50"
      style={{ width: bounds.width, height: bounds.height }}
    >
      <canvas ref={canvasRef} width={bounds.width} height={bounds.height} className="hidden" />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none" />

      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-20">
          {error ? (
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">Axis Camera Error</h3>
              <p className="text-slate-400 text-sm mb-4 max-w-xs">{error}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Restart Axis Feed
              </button>
            </div>
          ) : (
            <div className="text-center px-6">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500 animate-pulse">
                <Camera className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-red-500 text-lg font-bold mb-2 tracking-widest">AXIS CAMERA READY</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
                Axis camera integration is live. Start the feed to see target acquisition.
              </p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold tracking-wider transition-colors flex items-center gap-2 mx-auto shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              >
                <Camera className="w-5 h-5" />
                ACTIVATE AXIS FEED
              </button>
            </div>
          )}
        </div>
      )}

      {isActive && (
        <>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 backdrop-blur px-3 py-1.5 rounded border border-red-500/30 z-10">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <span className="text-red-500 text-xs font-bold tracking-widest">AXIS LIVE</span>
          </div>

          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={stopCamera}
              className="p-2 bg-black/80 backdrop-blur hover:bg-red-600 border border-red-500/30 text-red-500 hover:text-white rounded-lg transition-colors"
              title="Stop Axis Feed"
            >
              <CameraOff className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {isActive && displayTargets.map((target) => (
        <div
          key={target.id}
          className="absolute z-10 pointer-events-none"
          style={{
            left: `${target.x}px`,
            top: `${target.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="absolute -inset-4 border border-red-500/50 rounded-full animate-[spin_4s_linear_infinite]" />
          <div className="relative w-28 h-36 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-400" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-400" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-400" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-400" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-red-500/80" />
            </div>
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-2 py-0.5 text-[10px] font-bold tracking-widest border border-red-400 whitespace-nowrap">
            {target.id} [LOCKED]
          </div>
          <div className="absolute -right-20 top-0 text-[9px] text-red-400 font-mono leading-tight">
            X:{Math.round(target.x)}<br />
            Y:{Math.round(target.y)}<br />
            ID:{target.id}
          </div>
        </div>
      ))}
    </div>
  );
}
