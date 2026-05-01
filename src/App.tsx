import { useState, useEffect, useCallback, useRef, type HTMLAttributes, type PropsWithChildren } from "react";
import {
  Camera,
  CameraOff,
  AlertCircle,
  Crosshair,
  Shield,
  Clock,
  Activity,
  Radar,
  Target,
} from "lucide-react";
import {
  Person,
  SimulationState,
  MotionPoint,
  HeatmapCell,
  ActivityDataPoint,
} from "./types";
import { detectMultipleTargets } from "./utils/motionDetection";
import {
  createPerson,
  updatePeople,
  calculateHeatmap,
  generateActivityData,
  maintainActivityHistory,
} from "./utils/simulation";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

type BadgeProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  variant?: string;
};

function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = "", ...props }: CardProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ children, className = "", ...props }: CardProps) {
  return (
    <h2 className={className} {...props}>
      {children}
    </h2>
  );
}

function CardDescription({ children, className = "", ...props }: CardProps) {
  return (
    <p className={className} {...props}>
      {children}
    </p>
  );
}

function Badge({ children, className = "", ...props }: BadgeProps) {
  return (
    <span className={className} {...props}>
      {children}
    </span>
  );
}

interface AxisCameraProps {
  bounds: { width: number; height: number };
  onTrackedPositionUpdate: (points: MotionPoint[]) => void;
}

function AxisCamera({ bounds, onTrackedPositionUpdate }: AxisCameraProps) {
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

function ActivityChart({ data }: { data: ActivityDataPoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 10);
  const width = 600;
  const height = 200;
  const padding = 40;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.count / maxCount) * (height - padding * 2);
    return { x, y, ...d };
  });

  const pathD =
    points.length > 1
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
      : "";

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : "";

  return (
    <div className="bg-slate-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-200 font-semibold">Activity Timeline</h3>
        <span className="text-slate-400 text-sm">Last 5 minutes</span>
      </div>

      <svg width={width} height={height} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#334155"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          const value = Math.round(ratio * maxCount);
          return (
            <text key={ratio} x={padding - 10} y={y + 4} fill="#64748b" fontSize={12} textAnchor="end">
              {value}
            </text>
          );
        })}

        {areaD && <path d={areaD} fill="url(#gradient)" opacity={0.3} />}

        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="#0ea5e9"
            stroke="#0891b2"
            strokeWidth={2}
          />
        ))}

        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          <span className="text-slate-400 text-sm">Live</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400 text-sm">Peak: </span>
          <span className="text-cyan-400 font-semibold">{maxCount}</span>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ grid, gridSize, bounds }: { grid: HeatmapCell[]; gridSize: number; bounds: { width: number; height: number } }) {
  const cellWidth = bounds.width / gridSize;
  const cellHeight = bounds.height / gridSize;

  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ width: bounds.width, height: bounds.height }}>
      <div className="absolute inset-0 bg-slate-800">
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-10 grid-rows-10 h-full">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="border border-slate-600" />
            ))}
          </div>
        </div>
      </div>

      {grid.map((cell, index) => (
        <div
          key={index}
          className={`absolute transition-all duration-1000 ${getHeatmapColor(cell.intensity)}`}
          style={{
            left: `${cell.x * cellWidth}px`,
            top: `${cell.y * cellHeight}px`,
            width: `${cellWidth}px`,
            height: `${cellHeight}px`,
          }}
        />
      ))}

      <div className="absolute top-4 left-4 bg-slate-900/90 px-3 py-2 rounded-lg">
        <span className="text-slate-300 text-sm font-medium">Activity Heatmap</span>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/40" />
            <span className="text-slate-400 text-xs">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500/40" />
            <span className="text-slate-400 text-xs">Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/40" />
            <span className="text-slate-400 text-xs">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getHeatmapColor(intensity: number): string {
  if (intensity < 0.2) return "bg-blue-500/20";
  if (intensity < 0.4) return "bg-cyan-500/30";
  if (intensity < 0.6) return "bg-yellow-500/40";
  if (intensity < 0.8) return "bg-orange-500/50";
  return "bg-red-500/60";
}

const BOUNDS = { width: 600, height: 400 };
const GRID_SIZE = 10;

export default function App() {
  const [state, setState] = useState<SimulationState>({
    people: [],
    activityHistory: [],
    currentCount: 0,
    heatmapGrid: [],
  });
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [trackedTargets, setTrackedTargets] = useState<MotionPoint[]>([]);
  
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const shouldAdd = Math.random() < 0.1 && prev.people.length < 5;
        const newPeople = shouldAdd ? [...prev.people, createPerson(BOUNDS)] : prev.people;
        const updatedPeople = updatePeople(newPeople, BOUNDS);
        
        const allPoints = [...updatedPeople];
        // Add tracked targets to heatmap
        trackedTargets.forEach(t => {
          allPoints.push({
            id: t.id,
            position: { x: t.x, y: t.y },
            path: [],
            createdAt: Date.now(),
            opacity: 1,
          });
        });
        
        const heatmapGrid = calculateHeatmap(allPoints, GRID_SIZE, BOUNDS);
        
        return {
          ...prev,
          people: updatedPeople,
          heatmapGrid,
          currentCount: updatedPeople.length + trackedTargets.length,
        };
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [trackedTargets]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const newData = generateActivityData(prev.currentCount);
        return {
          ...prev,
          activityHistory: maintainActivityHistory(prev.activityHistory, newData),
        };
      });
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleTrackedPositionUpdate = (points: MotionPoint[]) => {
    setTrackedTargets(points);
  };
  
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              <Radar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wider">PHALANX TRACKING</h1>
              <p className="text-red-400 text-sm font-mono">Multi-Target Inclusive Spectrum Detection</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 font-mono">
              <Clock className="w-4 h-4" />
              <span>{currentTime.toLocaleTimeString()}</span>
            </div>
            <Badge variant="outline" className={trackedTargets.length > 0 ? "border-red-500 text-red-500 bg-red-950/30" : "border-slate-600 text-slate-500"}>
              <Target className="w-3 h-3 mr-2" />
              TARGETS: {trackedTargets.length}
            </Badge>
          </div>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Active Locks</p>
                <p className="text-2xl font-bold text-white">{trackedTargets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Subjects</p>
                <p className="text-2xl font-bold text-white">{state.currentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Response Time</p>
                <p className="text-2xl font-bold text-white">16ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-red-900/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <Radar className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Spectrum</p>
                <p className="text-lg font-bold text-white">FULL RGB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Radar className="w-5 h-5 text-red-500" />
              Axis Camera Display
            </CardTitle>
            <CardDescription className="text-slate-400">
              Integrated Axis camera live feed and target tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AxisCamera
              bounds={BOUNDS}
              onTrackedPositionUpdate={handleTrackedPositionUpdate}
            />
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-white">Thermal Density</CardTitle>
            <CardDescription className="text-slate-400">Concentration of targets</CardDescription>
          </CardHeader>
          <CardContent>
            <Heatmap grid={state.heatmapGrid} gridSize={GRID_SIZE} bounds={BOUNDS} />
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <ActivityChart data={state.activityHistory} />
      </div>
      
      <footer className="mt-8 pt-6 border-t border-slate-800">
        <div className="flex items-center justify-between text-slate-500 text-sm font-mono">
          <p>PHALANX v5.0 • INCLUSIVE SPECTRUM TRACKING</p>
          <p>SYSTEM STATUS: ARMED</p>
        </div>
      </footer>
    </div>
  );
}