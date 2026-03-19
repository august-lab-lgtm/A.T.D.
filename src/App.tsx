import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { FloorPlan } from "../components/FloorPlan";
import { Heatmap } from "../components/Heatmap";
import { ActivityChart } from "../components/ActivityChart";
import { Person, SimulationState, MotionPoint } from "../types";
import {
  createPerson,
  updatePeople,
  calculateHeatmap,
  generateActivityData,
  maintainActivityHistory,
} from "../utils/simulation";
import { Shield, Clock, Activity, Radar, Target } from "lucide-react";

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
              Tactical Display
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time multi-target acquisition
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FloorPlan 
              people={state.people} 
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