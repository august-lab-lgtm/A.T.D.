import { ActivityDataPoint } from "../types";

interface ActivityChartProps {
  data: ActivityDataPoint[];
}

export function ActivityChart({ data }: ActivityChartProps) {
  const maxCount = Math.max(...data.map(d => d.count), 10);
  const width = 600;
  const height = 200;
  const padding = 40;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.count / maxCount) * (height - padding * 2);
    return { x, y, ...d };
  });
  
  const pathD = points.length > 1
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
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
        {/* Grid lines */}
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
        
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          const value = Math.round(ratio * maxCount);
          return (
            <text
              key={ratio}
              x={padding - 10}
              y={y + 4}
              fill="#64748b"
              fontSize={12}
              textAnchor="end"
            >
              {value}
            </text>
          );
        })}
        
        {/* Area fill */}
        {areaD && (
          <path
            d={areaD}
            fill="url(#gradient)"
            opacity={0.3}
          />
        )}
        
        {/* Line */}
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
        
        {/* Data points */}
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
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Current stats */}
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