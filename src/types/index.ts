export interface Point {
  x: number;
  y: number;
}

export interface Person {
  id: string;
  position: Point;
  path: Point[];
  createdAt: number;
  opacity: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
}

export interface ActivityDataPoint {
  time: string;
  count: number;
}

export interface SimulationState {
  people: Person[];
  activityHistory: ActivityDataPoint[];
  currentCount: number;
  heatmapGrid: HeatmapCell[];
}