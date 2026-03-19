import { useState, useEffect, useRef } from "react";
import { Person } from "../types";
import { Camera, CameraOff, AlertCircle, Crosshair, Radar } from "lucide-react";
import { detectMultipleTargets, MotionPoint } from "../utils/motionDetection";

interface FloorPlanProps {
  people: Person[];
  bounds: { width: number; height: number };
  onTrackedPositionUpdate: (points: MotionPoint[]) => void;
}

export function FloorPlan({ people, bounds, onTrackedPositionUpdate }: FloorPlanProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  
  // State for multiple targets
  const [rawTargets, setRawTargets] = useState<MotionPoint[]>([]);
  const [displayTargets, setDisplayTargets] = useState<MotionPoint[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const animationFrameRef = useRef<number>();

  // Missile Speed: Very high smoothing factor (0.8) for instant locking
  const MISSILE_SPEED = 0.8; 

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      
      setStream(mediaStream);
      setIsActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions.");
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
    }
    previousFrameRef.current = null;
    setRawTargets([]);
    setDisplayTargets([]);
  };

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const processFrame = () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        ctx.drawImage(videoRef.current, 0, 0, bounds.width, bounds.height);
        const frameData = ctx.getImageData(0, 0, bounds.width, bounds.height);
        
        // Detect Multiple Targets
        const detected = detectMultipleTargets(
          frameData.data,
          previousFrameRef.current,
          bounds.width,
          bounds.height,
          25, 
          6 // Stride
        );

        setRawTargets(detected);
        onTrackedPositionUpdate(detected);

        // Smooth Tracking (Missile Speed)
        setDisplayTargets((prev) => {
          // Map existing targets to new targets based on ID or proximity
          // For simplicity in this demo, we just update the array length and lerp
          
          // If we have new detections, update the display targets
          if (detected.length > 0) {
            return detected.map((newTarget) => {
              // Find closest previous target to maintain smoothness
              const prevTarget = prev.find(p => Math.hypot(p.x - newTarget.x, p.y - newTarget.y) < 100);
              
              if (prevTarget) {
                return {
                  ...newTarget,
                  x: prevTarget.x + (newTarget.x - prevTarget.x) * MISSILE_SPEED,
                  y: prevTarget.y + (newTarget.y - prevTarget.y) * MISSILE_SPEED,
                };
              } else {
                return newTarget; // New target appears instantly
              }
            });
          } else {
            // No targets detected, clear display
            return [];
          }
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
  }, [isActive, bounds]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-red-900/50" style={{ width: bounds.width, height: bounds.height }}>
      <canvas ref={canvasRef} width={bounds.width} height={bounds.height} className="hidden" />
      
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Scanlines Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none" />
      
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-20">
          {error ? (
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">System Error</h3>
              <p className="text-slate-400 text-sm mb-4 max-w-xs">{error}</p>
              <button onClick={startCamera} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                Reboot System
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-500 animate-pulse">
                <Radar className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-red-500 text-lg font-bold mb-2 tracking-widest">MULTI-TARGET TRACKING</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs">
                Inclusive spectrum detection. Missile-speed response.
              </p>
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold tracking-wider transition-colors flex items-center gap-2 mx-auto shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              >
                <Radar className="w-5 h-5" />
                ENGAGE TRACKING
              </button>
            </div>
          )}
        </div>
      )}
      
      {isActive && (
        <>
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 backdrop-blur px-3 py-1.5 rounded border border-red-500/30 z-10">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <span className="text-red-500 text-xs font-bold tracking-widest">LIVE FEED</span>
          </div>
          
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={stopCamera}
              className="p-2 bg-black/80 backdrop-blur hover:bg-red-600 border border-red-500/30 text-red-500 hover:text-white rounded-lg transition-colors"
              title="Abort"
            >
              <CameraOff className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
      
      {/* Render Multiple Targets */}
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
          {/* Outer Rotating Ring */}
          <div className="absolute -inset-4 border border-red-500/50 rounded-full animate-[spin_4s_linear_infinite]" />
          
          {/* Inner Static Brackets */}
          <div className="relative w-28 h-36 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]">
            {/* Corner Accents */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-red-400" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-red-400" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-red-400" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-red-400" />
            
            {/* Center Cross */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-red-500/80" />
            </div>
          </div>
          
          {/* Target Label */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-2 py-0.5 text-[10px] font-bold tracking-widest border border-red-400 whitespace-nowrap">
            {target.id} [LOCKED]
          </div>
          
          {/* Coordinates */}
          <div className="absolute -right-20 top-0 text-[9px] text-red-400 font-mono leading-tight">
            X:{Math.round(target.x)}<br/>
            Y:{Math.round(target.y)}<br/>
            ID:{target.id}
          </div>
        </div>
      ))}
      
      {/* Background People */}
      {isActive && people.map((person) => (
        <div
          key={person.id}
          className="absolute w-2 h-2 rounded-full bg-red-500/20 shadow-lg transition-all duration-300 z-0"
          style={{
            left: `${person.position.x}px`,
            top: `${person.position.y}px`,
            opacity: person.opacity * 0.3,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}