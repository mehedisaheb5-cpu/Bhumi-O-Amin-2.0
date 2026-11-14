import { DigitizedDagPoint, VertexPointType } from '../types';
import { calculateLandUnits, LAND_CONSTANTS, roundClean } from './land-units';

export interface VertexEditMetrics {
  areaSqFt: number;
  areaDecimal: number;
  areaKatha: number;
  areaBigha: number;
  areaAcre: number;
  perimeterFt: number;
}

export interface SegmentInfo {
  index: number;
  fromIndex: number;
  toIndex: number;
  fromId: string;
  toId: string;
  lengthFt: number;
  midX: number;
  midY: number;
}

export interface SnapResult {
  x: number;
  y: number;
  isSnapped: boolean;
  snappedToPointId?: string;
  snapType?: 'vertex' | 'segment';
}

/**
 * Calculates area and perimeter metrics for a polygon of points.
 */
export function calculatePolygonMetrics(
  points: { x: number; y: number }[],
  scalePixelsPerFoot: number = 1.0
): VertexEditMetrics {
  if (!points || points.length < 3) {
    return {
      areaSqFt: 0,
      areaDecimal: 0,
      areaKatha: 0,
      areaBigha: 0,
      areaAcre: 0,
      perimeterFt: 0,
    };
  }

  let areaPx = 0;
  let perimeterPx = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    areaPx += points[i].x * points[j].y;
    areaPx -= points[j].x * points[i].y;

    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeterPx += Math.sqrt(dx * dx + dy * dy);
  }

  areaPx = Math.abs(areaPx) / 2;
  const scale = Math.max(0.0001, scalePixelsPerFoot);

  // Real world feet conversion
  const areaSqFt = areaPx / (scale * scale);
  const perimeterFt = perimeterPx / scale;

  const units = calculateLandUnits(areaSqFt, perimeterFt);
  const areaAcre = roundClean(areaSqFt / LAND_CONSTANTS.SQFT_PER_ACRE, 4);

  return {
    areaSqFt: units.sqFt,
    areaDecimal: units.shatangsha,
    areaKatha: units.katha,
    areaBigha: units.bigha,
    areaAcre,
    perimeterFt: units.perimeterFt || roundClean(perimeterFt, 2),
  };
}

/**
 * Computes individual segment lengths and midpoints.
 */
export function calculateSegmentInfos(
  points: DigitizedDagPoint[],
  scalePixelsPerFoot: number = 1.0
): SegmentInfo[] {
  if (!points || points.length < 2) return [];

  const scale = Math.max(0.0001, scalePixelsPerFoot);
  const n = points.length;
  const segments: SegmentInfo[] = [];

  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[nextIdx];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const lengthFt = roundClean(distPx / scale, 2);

    segments.push({
      index: i,
      fromIndex: i,
      toIndex: nextIdx,
      fromId: p1.id,
      toId: p2.id,
      lengthFt,
      midX: Math.round((p1.x + p2.x) / 2),
      midY: Math.round((p1.y + p2.y) / 2),
    });
  }

  return segments;
}

/**
 * Checks if target point (x, y) should snap to another vertex.
 */
export function findSnapPoint(
  x: number,
  y: number,
  allPoints: DigitizedDagPoint[],
  excludeIndex: number,
  snapDistancePx: number = 14
): SnapResult {
  for (let i = 0; i < allPoints.length; i++) {
    if (i === excludeIndex) continue;
    const pt = allPoints[i];
    const dx = pt.x - x;
    const dy = pt.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= snapDistancePx) {
      return {
        x: pt.x,
        y: pt.y,
        isSnapped: true,
        snappedToPointId: pt.id,
        snapType: 'vertex',
      };
    }
  }

  return { x, y, isSnapped: false };
}

/**
 * Inserts a new point between two existing vertices on a segment.
 */
export function insertVertexAtSegment(
  points: DigitizedDagPoint[],
  segmentIndex: number,
  coords: { x: number; y: number },
  sourceType: VertexPointType = 'manual'
): DigitizedDagPoint[] {
  const newPt: DigitizedDagPoint = {
    id: `vtx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    x: Math.round(coords.x),
    y: Math.round(coords.y),
    sourceType,
    label: `V${points.length + 1}`,
  };

  const nextPoints = [...points];
  nextPoints.splice(segmentIndex + 1, 0, newPt);
  return nextPoints;
}

/**
 * Deletes a vertex by index with minimum polygon constraint (>= 3).
 */
export function deleteVertexAtIndex(
  points: DigitizedDagPoint[],
  index: number
): { success: boolean; updatedPoints: DigitizedDagPoint[]; error?: string } {
  if (points.length <= 3) {
    return {
      success: false,
      updatedPoints: points,
      error: 'বহুভুজ সীমানা বজায় রাখতে কমপক্ষে ৩টি কোণ/পয়েন্ট থাকতে হবে।',
    };
  }

  if (index < 0 || index >= points.length) {
    return { success: false, updatedPoints: points, error: 'অবৈধ পয়েন্ট ইনডেক্স।' };
  }

  const updated = points.filter((_, i) => i !== index);
  return { success: true, updatedPoints: updated };
}

/**
 * Nudges a vertex by dx, dy.
 */
export function nudgeVertex(
  points: DigitizedDagPoint[],
  index: number,
  dx: number,
  dy: number
): DigitizedDagPoint[] {
  if (index < 0 || index >= points.length) return points;
  return points.map((p, i) => {
    if (i === index) {
      return {
        ...p,
        x: p.x + dx,
        y: p.y + dy,
        sourceType: p.sourceType === 'gps' ? p.sourceType : 'manual',
      };
    }
    return p;
  });
}

/**
 * Checks if two points arrays differ in coordinate values or count.
 */
export function arePointsDifferent(
  ptsA?: DigitizedDagPoint[] | null,
  ptsB?: DigitizedDagPoint[] | null
): boolean {
  if (!ptsA || !ptsB) return false;
  if (ptsA.length !== ptsB.length) return true;
  for (let i = 0; i < ptsA.length; i++) {
    if (ptsA[i].x !== ptsB[i].x || ptsA[i].y !== ptsB[i].y) {
      return true;
    }
  }
  return false;
}
