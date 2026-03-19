import { HeatmapCell } from "../types";
import { getHeatmapColor } from "../utils/simulation";

interface HeatmapProps {
  grid: HeatmapCell[];
  gridSize: number;
  bounds: { width: number; height: number };
}

export function Heatmap({ grid, gridSize, bounds }: HeatmapProps) {
  const cellWidth = bounds.width / gridSize;
  const cellHeight = bounds.height / gridSize;
  
  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ width: bounds.width, height: bounds.height }}>
      <div className="absolute inset-0 bg-slate-800">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-10 grid-rows-10 h-full">
            {Array.from({ length: 100 }).map((_, i) => (
              <div key={i} className="border border-slate-600" />
            ))}
          </div>
        </div>
      </div>
      
      {/* Heatmap cells */}
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
      
      {/* Legend */}
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