import { CanvasItem, Connection } from "@/components/Canvas/types";

// --- Constants ---
const BRIDGE_SIZE = 12; // Radius/Width of the jump
const BRIDGE_HEIGHT = 12; // Height of the arc control point

interface Point {
  x: number;
  y: number;
}
interface Vector {
  x: number;
  y: number;
}

// --- Helper Functions ---

import { calculateAspectFit } from "./layout";

const getGripPosition = (item: CanvasItem, gripIndex: number): Point | null => {
  if (!item.grips || gripIndex >= item.grips.length) return null;

  // Calculate the actual rendered box of the image
  const { x: renderX, y: renderY, width: renderWidth, height: renderHeight } = calculateAspectFit(
    item.width,
    item.height,
    item.naturalWidth,
    item.naturalHeight
  );

  const grip = item.grips[gripIndex];

  // Grip position is relative to the RENDERED image, plus the item's absolute position
  const x = (item.x + renderX) + (grip.x / 100) * renderWidth;
  const y = (item.y + renderY) + ((100 - grip.y) / 100) * renderHeight;

  return { x, y };
};

// Start point, End point, ID of the line, and full object for reference
interface LineSegment {
  p1: Point;
  p2: Point;
  lineId: number;
  // Normalized direction vector
  dir: Vector;
  // Length of segment
  len: number;
}

// Math Helpers
const sub = (a: Point, b: Point): Vector => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Vector): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mult = (v: Vector, s: number): Vector => ({ x: v.x * s, y: v.y * s });
const len = (v: Vector): number => Math.sqrt(v.x * v.x + v.y * v.y);
const normalize = (v: Vector): Vector => {
  const l = len(v);

  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
// Perpendicular vector (rotated 90 deg counter-clockwise: -y, x)
const perp = (v: Vector): Vector => ({ x: -v.y, y: v.x });

// Check intersection between two segments
// Returns distance 't' along seg1 (0 to seg1.len) if intersection exists
const getIntersectionT = (
  seg1: LineSegment,
  seg2: LineSegment,
): number | null => {
  // Determine if lines intersect using vector math
  // P1 + t*V1 = P2 + u*V2
  // Vector cross product approach for 2D

  const p = seg1.p1;
  const r = sub(seg1.p2, seg1.p1); // Vector of seg1 (full length)
  const q = seg2.p1;
  const s = sub(seg2.p2, seg2.p1); // Vector of seg2 (full length)

  const rXs = r.x * s.y - r.y * s.x;

  // Collinear or parallel?
  if (Math.abs(rXs) < 1e-5) return null;

  const qp = sub(q, p);
  const t = (qp.x * s.y - qp.y * s.x) / rXs;
  const u = (qp.x * r.y - qp.y * r.x) / rXs;

  const buffer = 0.001;

  if (t > buffer && t < 1 - buffer && u > buffer && u < 1 - buffer) {
    // Return actual distance along seg1, not normalized t
    return t * seg1.len;
  }

  return null;
};

// --- Main Export ---
// Returns a map of connection ID -> SVG Path Data String
// Returns a map of connection ID -> { pathData, arrowAngle, endPoint }
export interface PathMetadata {
  pathData: string;
  endPoint?: Point;
  arrowAngle?: number;
}

export const calculateManualPathsWithBridges = (
  connections: Connection[],
  items: CanvasItem[],
): Record<number, PathMetadata> => {
  // 1. Build geometry for all lines
  const rawLines: { id: number; segments: LineSegment[] }[] = [];

  for (const conn of connections) {
    const source = items.find((i) => i.id === conn.sourceItemId);
    const target = items.find((i) => i.id === conn.targetItemId);

    if (!source || !target) continue;

    const start = getGripPosition(source, conn.sourceGripIndex);
    const end = getGripPosition(target, conn.targetGripIndex);

    if (!start || !end) continue;

    // --- Standoff Logic ---
    const STANDOFF_DIST = 20;

    const sourceGrip = source.grips?.[conn.sourceGripIndex];
    const targetGrip = target.grips?.[conn.targetGripIndex];

    const getClosestSide = (g: any): "top" | "bottom" | "left" | "right" => {
      if (!g) return "bottom"; // Fallback

      const distLeft = g.x;
      const distRight = 100 - g.x;
      const distTop = 100 - g.y; // y=100 is top (0 distance)
      const distBottom = g.y;    // y=0 is bottom (0 distance)

      const min = Math.min(distLeft, distRight, distTop, distBottom);

      if (min === distLeft) return "left";
      if (min === distRight) return "right";
      if (min === distTop) return "top";
      return "bottom";
    };

    const getStandoff = (p: Point, grip: any) => {
      const side = getClosestSide(grip);
      if (!side) return p;

      if (side === "left") return { x: p.x - STANDOFF_DIST, y: p.y };
      if (side === "right") return { x: p.x + STANDOFF_DIST, y: p.y };
      if (side === "top") return { x: p.x, y: p.y - STANDOFF_DIST }; // Top is UP (negative Y in canvas)
      if (side === "bottom") return { x: p.x, y: p.y + STANDOFF_DIST }; // Bottom is DOWN (positive Y in canvas)
      return p;
    };

    const startStandoff = getStandoff(start, sourceGrip);
    const endStandoff = getStandoff(end, targetGrip);

    const points: Point[] = [start, startStandoff];

    // --- Waypoint Filtering ---
    // Remove waypoints that are likely "inside" the source or target due to import mismatches
    // OR are too close to the start/end resulting in sharp turn-backs
    const isInside = (p: Point, item: CanvasItem) => {
      const { x: rX, y: rY, width: rW, height: rH } = calculateAspectFit(
        item.width,
        item.height,
        item.naturalWidth,
        item.naturalHeight
      );
      const absX = item.x + rX;
      const absY = item.y + rY;
      // buffer to be generous
      const buffer = 10;
      return (
        p.x > absX + buffer &&
        p.x < absX + rW - buffer &&
        p.y > absY + buffer &&
        p.y < absY + rH - buffer
      );
    };

    if (conn.waypoints) {
      const validWaypoints = conn.waypoints.filter(wp => {
        // Check if inside
        if (isInside(wp, source) || isInside(wp, target)) return false;

        // Check if too close to grips (prevents "doubling back" from standoff)
        const distToStart = len(sub(wp, start));
        const distToEnd = len(sub(wp, end));

        // If waypoint is closer than our standoff, skip it to let the standoff line handle the exit
        if (distToStart < STANDOFF_DIST * 2.0) return false;
        if (distToEnd < STANDOFF_DIST * 2.0) return false;

        return true;
      });
      points.push(...validWaypoints);
    }

    points.push(endStandoff);
    points.push(end);

    const segments: LineSegment[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const diff = sub(p2, p1);
      const l = len(diff);

      if (l > 0) {
        segments.push({
          p1,
          p2,
          lineId: conn.id,
          dir: normalize(diff),
          len: l,
        });
      }
    }
    rawLines.push({ id: conn.id, segments });
  }

  // flattened list of all segments for collision checking
  const allSegments = rawLines.flatMap((r) => r.segments);

  const finalPaths: Record<number, PathMetadata> = {};

  // 2. Process each line to build SVG path
  for (const line of rawLines) {
    let pathData = "";

    // Start of the entire line
    if (line.segments.length > 0) {
      pathData += `M ${line.segments[0].p1.x} ${line.segments[0].p1.y}`;
    }

    for (const seg of line.segments) {
      // Find all intersections for this segment
      const intersections: { t: number; otherId: number }[] = [];

      for (const otherSeg of allSegments) {
        if (otherSeg.lineId === seg.lineId) continue;

        // Determine who jumps: The one with HIGHER ID jumps
        // If IDs are equal (shouldn't happen) do nothing
        if (seg.lineId < otherSeg.lineId) continue;

        const t = getIntersectionT(seg, otherSeg);

        if (t !== null) {
          intersections.push({ t, otherId: otherSeg.lineId });
        }
      }

      // Sort by distance along the segment
      intersections.sort((a, b) => a.t - b.t);

      // Reconstruct segment with jumps
      let currentT = 0; // Current distance traversed along segment

      const p1 = seg.p1;
      const dir = seg.dir;
      const normal = perp(dir); // For arc control point

      for (const inter of intersections) {
        const centerT = inter.t;
        // bridge start and end t
        const startT = Math.max(currentT, centerT - BRIDGE_SIZE);
        const endT = Math.min(seg.len, centerT + BRIDGE_SIZE);

        if (startT >= endT) continue; // Too close or invalid

        // Draw line to bridge start
        const bridgeStartPos = add(p1, mult(dir, startT));

        pathData += ` L ${bridgeStartPos.x} ${bridgeStartPos.y}`;

        // Draw Arc

        const bridgeEndPos = add(p1, mult(dir, endT));

        const centerPos = add(p1, mult(dir, centerT));
        const controlPos = add(centerPos, mult(normal, BRIDGE_HEIGHT * 2));

        pathData += ` Q ${controlPos.x} ${controlPos.y} ${bridgeEndPos.x} ${bridgeEndPos.y}`;

        currentT = endT;
      }

      // Finish the segment
      const segEnd = seg.p2;

      pathData += ` L ${segEnd.x} ${segEnd.y}`;
    }

    // Calculate arrow angle based on the last segment's direction
    let arrowAngle = 0;
    let endPoint: Point | undefined;

    if (line.segments.length > 0) {
      const lastSeg = line.segments[line.segments.length - 1];

      // Calculate offset position for the arrow (e.g., 12px back)
      // endPoint = p2 - dir * 12
      const arrowOffset = 4.5;

      endPoint = {
        x: lastSeg.p2.x - lastSeg.dir.x * arrowOffset,
        y: lastSeg.p2.y - lastSeg.dir.y * arrowOffset,
      };

      // atan2(y, x) returns angle in radians. Convert to degrees.
      // Konva rotation is in degrees.
      // RegularPolygon (triangle) points UP at 0 deg, but 0 rad is RIGHT.
      // So we add 90 degrees to align it with the vector.
      arrowAngle =
        Math.atan2(lastSeg.dir.y, lastSeg.dir.x) * (180 / Math.PI) + 90;
    }

    finalPaths[line.id] = { pathData, endPoint, arrowAngle };
  }

  return finalPaths;
};
