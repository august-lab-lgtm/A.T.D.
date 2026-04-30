import type { MotionPoint } from "../types";

/**
 * Inclusive Skin Detection.
 * Scans the full spectrum of human skin tones by checking RGB ratios
 * rather than hardcoded values for specific races.
 */
function isInclusiveSkinTone(r: number, g: number, b: number): boolean {
  // 1. Basic brightness check (avoid pitch black or blown out white)
  const brightness = (r + g + b) / 3;
  if (brightness < 30 || brightness > 240) return false;

  // 2. Red Dominance (Skin is always redder than blue, usually redder than green)
  if (r < b) return false; // Blue should not be dominant
  if (r < g - 10) return false; // Green can be close, but Red usually wins

  // 3. Color Ratios (The "Skin Triangle" in RGB space)
  // This covers the spectrum from pale (high R/G, low B) to dark (lower R/G, higher B relative to R)
  const rg = r - g;
  const rb = r - b;
  
  // Typical skin has R-G between 10 and 80, and R-B between 20 and 150
  // These ranges are widened to be inclusive of all ethnicities
  if (rg < 5 || rg > 100) return false;
  if (rb < 15 || rb > 180) return false;

  return true;
}

/**
 * Clusters moving skin pixels into distinct groups (people).
 * Returns an array of targets.
 */
export function detectMultipleTargets(
  currentFrame: Uint8ClampedArray,
  previousFrame: Uint8ClampedArray | null,
  width: number,
  height: number,
  motionThreshold: number = 25,
  stride: number = 6
): MotionPoint[] {
  if (!previousFrame) return [];

  // 1. Collect all moving skin pixels
  const pixels: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;

      const r = currentFrame[index];
      const g = currentFrame[index + 1];
      const b = currentFrame[index + 2];

      // Check if skin tone
      if (!isInclusiveSkinTone(r, g, b)) continue;

      // Check if moving
      const rDiff = Math.abs(r - previousFrame[index]);
      const gDiff = Math.abs(g - previousFrame[index + 1]);
      const bDiff = Math.abs(b - previousFrame[index + 2]);
      
      if ((rDiff + gDiff + bDiff) > motionThreshold) {
        pixels.push({ x, y });
      }
    }
  }

  if (pixels.length < 20) return []; // Not enough data to form a target

  // 2. Cluster pixels into groups (Simple Distance-Based Clustering)
  const clusters: { x: number; y: number; count: number; pixels: {x: number, y: number}[] }[] = [];
  const CLUSTER_DISTANCE = 60; // Max distance to be considered the same person

  pixels.forEach((p) => {
    let added = false;
    for (const cluster of clusters) {
      const dist = Math.hypot(p.x - cluster.x, p.y - cluster.y);
      if (dist < CLUSTER_DISTANCE) {
        // Add to existing cluster
        cluster.x = (cluster.x * cluster.count + p.x) / (cluster.count + 1);
        cluster.y = (cluster.y * cluster.count + p.y) / (cluster.count + 1);
        cluster.count++;
        cluster.pixels.push(p);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({ x: p.x, y: p.y, count: 1, pixels: [p] });
    }
  });

  // 3. Filter noise and format output
  // Minimum 30 pixels to be considered a person (prevents hand-only tracking)
  const validClusters = clusters.filter(c => c.count > 30);

  return validClusters.map((c, index) => ({
    x: c.x,
    y: c.y,
    detected: true,
    confidence: Math.min(c.count / 100, 1), // Confidence based on cluster size
    id: `T-${(index + 1).toString().padStart(2, '0')}`
  }));
}