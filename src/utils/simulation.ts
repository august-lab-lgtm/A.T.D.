import { Point, Person, HeatmapCell, ActivityDataPoint } from "../types";

export const generateRandomPosition = (bounds: { width: number; height: number }): Point => {
  return {
    x: Math.random() * bounds.width,
    y: Math.random() * bounds.height,
  };
};

export const generateMovementPath = (start: Point, bounds: { width: number; height: number }): Point[] => {
  const path: Point[] = [start];
  const steps = 20 + Math.floor(Math.random() * 30);
  
  for (let i = 1; i < steps; i++) {
    const prev = path[i - 1];
    const next: Point = {
      x: Math.max(0, Math.min(bounds.width, prev.x + (Math.random() - 0.5) * 40)),
      y: Math.max(0, Math.min(bounds.height, prev.y + (Math.random() - 0.5) * 40)),
    };
    path.push(next);
  }
  
  return path;
};

export const createPerson = (bounds: { width: number; height: number }): Person => {
  const start = generateRandomPosition(bounds);
  const path = generateMovementPath(start, bounds);
  
  return {
    id: `person-${Date.now()}-${Math.random()}`,
    position: start,
    path,
    createdAt: Date.now(),
    opacity: 1,
  };
};

export const updatePeople = (people: Person[], bounds: { width: number; height: number }): Person[] => {
  const now = Date.now();
  const maxAge = 10000; // 10 seconds
  
  return people
    .filter(person => now - person.createdAt < maxAge)
    .map(person => {
      const age = now - person.createdAt;
      const progress = age / maxAge;
      const pathIndex = Math.min(Math.floor(progress * person.path.length), person.path.length - 1);
      
      return {
        ...person,
        position: person.path[pathIndex],
        opacity: 1 - progress * 0.7, // Fade to 0.3 opacity
      };
    });
};

export const calculateHeatmap = (people: Person[], gridSize: number, bounds: { width: number; height: number }): HeatmapCell[] => {
  const grid: HeatmapCell[] = [];
  const cellWidth = bounds.width / gridSize;
  const cellHeight = bounds.height / gridSize;
  
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      let intensity = 0;
      
      people.forEach(person => {
        const cellX = Math.floor(person.position.x / cellWidth);
        const cellY = Math.floor(person.position.y / cellHeight);
        
        if (cellX === x && cellY === y) {
          intensity += person.opacity;
        }
      });
      
      grid.push({ x, y, intensity: Math.min(intensity, 1) });
    }
  }
  
  return grid;
};

export const getHeatmapColor = (intensity: number): string => {
  if (intensity < 0.2) return "bg-blue-500/20";
  if (intensity < 0.4) return "bg-cyan-500/30";
  if (intensity < 0.6) return "bg-yellow-500/40";
  if (intensity < 0.8) return "bg-orange-500/50";
  return "bg-red-500/60";
};

export const generateActivityData = (currentCount: number): ActivityDataPoint => {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  
  // Add some randomness to simulate realistic fluctuations
  const variation = Math.floor(Math.random() * 5) - 2;
  const count = Math.max(0, Math.min(20, currentCount + variation));
  
  return { time: timeString, count };
};

export const maintainActivityHistory = (history: ActivityDataPoint[], newData: ActivityDataPoint): ActivityDataPoint[] => {
  const updated = [...history, newData];
  // Keep last 30 data points (5 minutes at 10-second intervals)
  return updated.slice(-30);
};