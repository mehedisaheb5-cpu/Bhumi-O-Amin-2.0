import { LatLngPoint, EARTH_RADIUS_METERS, filterValidPoints, calculateCentroid } from './gps-geometry';
import { LAND_CONSTANTS, roundClean } from './land-units';

export interface ProjectedDrawingPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
  xMeters: number; // East (+)
  yMeters: number; // North (+)
  xFeet: number;
  yFeet: number;
}

export interface ProjectionBounds {
  minXMeters: number;
  maxXMeters: number;
  minYMeters: number;
  maxYMeters: number;
  widthMeters: number;
  heightMeters: number;
  centerXMeters: number;
  centerYMeters: number;
  centroidLat: number;
  centroidLng: number;
}

export interface LocalProjectionResult {
  points: ProjectedDrawingPoint[];
  bounds: ProjectionBounds;
  hasEnoughPoints: boolean;
}

/**
 * Projects real GPS coordinates to a local Cartesian plane in meters (Equirectangular / Tangent plane).
 * Origin is at the centroid of the survey points.
 * - +X is East (meters)
 * - +Y is North (meters)
 * Real latitude and longitude are fully preserved for every point.
 */
export function projectGpsPointsToLocal(points: LatLngPoint[]): LocalProjectionResult {
  const valid = filterValidPoints(points);
  if (valid.length === 0) {
    return {
      points: [],
      bounds: {
        minXMeters: 0,
        maxXMeters: 0,
        minYMeters: 0,
        maxYMeters: 0,
        widthMeters: 0,
        heightMeters: 0,
        centerXMeters: 0,
        centerYMeters: 0,
        centroidLat: 0,
        centroidLng: 0,
      },
      hasEnoughPoints: false,
    };
  }

  // Calculate centroid
  const centroid = calculateCentroid(valid) || {
    latitude: valid[0].latitude,
    longitude: valid[0].longitude,
  };

  const lat0Rad = (centroid.latitude * Math.PI) / 180;
  const lon0Rad = (centroid.longitude * Math.PI) / 180;
  const cosLat0 = Math.cos(lat0Rad);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const projectedPoints: ProjectedDrawingPoint[] = valid.map((pt, idx) => {
    const latRad = (pt.latitude * Math.PI) / 180;
    const lonRad = (pt.longitude * Math.PI) / 180;

    const xM = EARTH_RADIUS_METERS * (lonRad - lon0Rad) * cosLat0;
    const yM = EARTH_RADIUS_METERS * (latRad - lat0Rad);

    if (xM < minX) minX = xM;
    if (xM > maxX) maxX = xM;
    if (yM < minY) minY = yM;
    if (yM > maxY) maxY = yM;

    return {
      id: pt.id || `pt-${idx}`,
      label: pt.label || String.fromCharCode(65 + (idx % 26)),
      latitude: pt.latitude,
      longitude: pt.longitude,
      accuracy: pt.accuracy,
      timestamp: pt.timestamp,
      xMeters: xM,
      yMeters: yM,
      xFeet: xM * LAND_CONSTANTS.FEET_PER_METER,
      yFeet: yM * LAND_CONSTANTS.FEET_PER_METER,
    };
  });

  const widthM = Math.max(maxX - minX, 2); // Minimum 2m bounding
  const heightM = Math.max(maxY - minY, 2);

  return {
    points: projectedPoints,
    bounds: {
      minXMeters: minX,
      maxXMeters: maxX,
      minYMeters: minY,
      maxYMeters: maxY,
      widthMeters: widthM,
      heightMeters: heightM,
      centerXMeters: (minX + maxX) / 2,
      centerYMeters: (minY + maxY) / 2,
      centroidLat: centroid.latitude,
      centroidLng: centroid.longitude,
    },
    hasEnoughPoints: valid.length >= 3,
  };
}

/**
 * Calculates dynamic scale bar value in feet and meters based on effective pixel scale.
 */
export function calculateDynamicScaleBar(effectiveScalePixelsPerMeter: number): {
  distanceFt: number;
  distanceM: number;
  pixelWidth: number;
  labelEn: string;
  labelBn: string;
} {
  const pixelsPerFoot = effectiveScalePixelsPerMeter / LAND_CONSTANTS.FEET_PER_METER;

  // Nice round numbers for feet
  const niceStepsFt = [
    1, 2, 5, 10, 20, 25, 50, 100, 150, 200, 250, 500, 1000, 2000, 5000,
  ];

  const targetPixelWidth = 110;
  const targetFt = targetPixelWidth / (pixelsPerFoot || 1);

  // Find the closest nice step >= targetFt
  let chosenFt = niceStepsFt[niceStepsFt.length - 1];
  for (const step of niceStepsFt) {
    if (step * pixelsPerFoot >= 65) {
      chosenFt = step;
      break;
    }
  }

  const pixelWidth = Math.max(40, chosenFt * pixelsPerFoot);
  const distanceM = roundClean(chosenFt / LAND_CONSTANTS.FEET_PER_METER, 1);

  return {
    distanceFt: chosenFt,
    distanceM,
    pixelWidth,
    labelEn: `${chosenFt} ft (${distanceM} m)`,
    labelBn: `${chosenFt} ফুট (${distanceM} মি)`,
  };
}
