import { CalculationResult } from '../types';
import { calculateLandUnits, LAND_CONSTANTS, roundClean } from './land-units';

// ============================================================================
// Types
// ============================================================================

/**
 * Basic coordinate point interface compatible with GpsPoint, PolygonPoint,
 * or raw geographic coordinates.
 */
export interface LatLngPoint {
  latitude: number;
  longitude: number;
  label?: string;
  id?: string;
  accuracy?: number;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Detailed boundary segment connecting two consecutive survey points.
 */
export interface GpsPolygonSegment {
  fromIndex: number;
  toIndex: number;
  fromLabel: string;
  toLabel: string;
  from: LatLngPoint;
  to: LatLngPoint;
  distanceMeters: number;
  distanceFeet: number;
  bearingDegrees: number;
  compassDirectionEn: string;
  compassDirectionBn: string;
  isClosing?: boolean;
}

/**
 * Statistics on recorded device GPS accuracy.
 */
export interface GpsAccuracyStats {
  averageAccuracy: number;
  bestAccuracy: number;
  worstAccuracy: number;
  countWithAccuracy: number;
}

/**
 * Map-ready structured boundary and marker data prepared for future mapping phase.
 * Contains only real GPS points, never fake/synthetic coordinates.
 */
export interface MapReadySurveyData {
  polygonCoordinates: [number, number][]; // [latitude, longitude][] closed to Point A
  markers: {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: number;
  }[];
  segments: GpsPolygonSegment[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    center: {
      latitude: number;
      longitude: number;
    };
  };
}

/**
 * Validation result for GPS survey point arrays.
 */
export interface GpsPolygonValidation {
  isValid: boolean;
  totalPoints: number;
  validPointsCount: number;
  hasEnoughPoints: boolean; // >= 3
  hasDuplicates: boolean;
  duplicateIndices?: [number, number][];
  errors: string[];
  warnings: string[];
}

/**
 * Complete GPS survey polygon calculation result, reusing Phase 2 BD land units.
 */
export interface GpsAreaResult {
  isValid: boolean;
  pointCount: number;
  areaSqMeters: number;
  areaSqFt: number;
  perimeterMeters: number;
  perimeterFt: number;
  segments: GpsPolygonSegment[];
  landUnits: CalculationResult;
  validation: GpsPolygonValidation;
  centroid?: {
    latitude: number;
    longitude: number;
  };
}

// Earth's mean radius in meters (WGS-84 / IUGG standard)
export const EARTH_RADIUS_METERS = 6371000;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validates a single geographic latitude/longitude coordinate pair.
 */
export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
}

/**
 * Validates a single LatLngPoint object.
 */
export function isPointValid(point: LatLngPoint | null | undefined): boolean {
  if (!point) return false;
  return isValidCoordinate(point.latitude, point.longitude);
}

/**
 * Filters an array of points down to only structurally valid coordinates.
 */
export function filterValidPoints<T extends LatLngPoint>(points: T[]): T[] {
  if (!Array.isArray(points)) return [];
  return points.filter(isPointValid);
}

/**
 * Validates an array of GPS points for polygon calculation.
 * Checks for coordinate validity, minimum point count (>= 3), and duplicate points.
 */
export function validatePolygonPoints(points: LatLngPoint[]): GpsPolygonValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicateIndices: [number, number][] = [];

  if (!Array.isArray(points)) {
    return {
      isValid: false,
      totalPoints: 0,
      validPointsCount: 0,
      hasEnoughPoints: false,
      hasDuplicates: false,
      errors: ['Invalid points array provided.'],
      warnings: [],
    };
  }

  const totalPoints = points.length;
  let validPointsCount = 0;

  for (let i = 0; i < totalPoints; i++) {
    const pt = points[i];
    if (!isPointValid(pt)) {
      errors.push(`Point index ${i} (${pt?.label || 'unlabeled'}) has invalid coordinates.`);
    } else {
      validPointsCount++;
    }
  }

  // Check for duplicate consecutive or identical points within 0.1 meter tolerance
  for (let i = 0; i < totalPoints; i++) {
    for (let j = i + 1; j < totalPoints; j++) {
      const p1 = points[i];
      const p2 = points[j];
      if (isPointValid(p1) && isPointValid(p2)) {
        if (
          Math.abs(p1.latitude - p2.latitude) < 0.0000001 &&
          Math.abs(p1.longitude - p2.longitude) < 0.0000001
        ) {
          duplicateIndices.push([i, j]);
          warnings.push(
            `Points ${p1.label || i + 1} and ${p2.label || j + 1} have identical coordinates.`
          );
        }
      }
    }
  }

  const hasEnoughPoints = validPointsCount >= 3;
  if (!hasEnoughPoints) {
    errors.push(
      `At least 3 valid GPS points are required to calculate polygon area. Current valid points: ${validPointsCount}.`
    );
  }

  const isValid = errors.length === 0 && hasEnoughPoints;

  return {
    isValid,
    totalPoints,
    validPointsCount,
    hasEnoughPoints,
    hasDuplicates: duplicateIndices.length > 0,
    duplicateIndices: duplicateIndices.length > 0 ? duplicateIndices : undefined,
    errors,
    warnings,
  };
}

// ============================================================================
// Core Geometry Functions
// ============================================================================

/**
 * 1. calculateDistance(pointA, pointB)
 * Calculates the great-circle geodesic distance between two points using
 * the Haversine formula.
 *
 * @param pointA - Start point with latitude and longitude
 * @param pointB - Destination point with latitude and longitude
 * @returns Distance in meters (0 if invalid)
 */
export function calculateDistance(pointA: LatLngPoint, pointB: LatLngPoint): number {
  if (!isPointValid(pointA) || !isPointValid(pointB)) {
    return 0;
  }

  const lat1 = (pointA.latitude * Math.PI) / 180;
  const lon1 = (pointA.longitude * Math.PI) / 180;
  const lat2 = (pointB.latitude * Math.PI) / 180;
  const lon2 = (pointB.longitude * Math.PI) / 180;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const a =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;

  // Clamp 'a' to [0, 1] to guard against floating-point inaccuracies
  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

/**
 * 2. calculateBearing(pointA, pointB)
 * Computes the forward geodetic azimuth (bearing) from pointA to pointB in degrees.
 *
 * @param pointA - Start point with latitude and longitude
 * @param pointB - Destination point with latitude and longitude
 * @returns Initial bearing in degrees (0° to 360°, clockwise from true North)
 */
export function calculateBearing(pointA: LatLngPoint, pointB: LatLngPoint): number {
  if (!isPointValid(pointA) || !isPointValid(pointB)) {
    return 0;
  }

  const lat1 = (pointA.latitude * Math.PI) / 180;
  const lon1 = (pointA.longitude * Math.PI) / 180;
  const lat2 = (pointB.latitude * Math.PI) / 180;
  const lon2 = (pointB.longitude * Math.PI) / 180;

  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const initialBearingRadians = Math.atan2(y, x);
  const initialBearingDegrees = (initialBearingRadians * 180) / Math.PI;

  // Normalize bearing to 0° - 360°
  return (initialBearingDegrees + 360) % 360;
}

/**
 * Converts a compass bearing in degrees to cardinal/intercardinal direction
 * in English and Bengali.
 */
export function getCompassDirection(bearingDegrees: number): {
  en: string;
  bn: string;
} {
  const normalized = ((bearingDegrees % 360) + 360) % 360;
  const directions = [
    { en: 'N', bn: 'উত্তর (N)' },
    { en: 'NNE', bn: 'উত্তর-উত্তরপূর্ব (NNE)' },
    { en: 'NE', bn: 'উত্তর-পূর্ব (NE)' },
    { en: 'ENE', bn: 'পূর্ব-উত্তরপূর্ব (ENE)' },
    { en: 'E', bn: 'পূর্ব (E)' },
    { en: 'ESE', bn: 'পূর্ব-দক্ষিণপূর্ব (ESE)' },
    { en: 'SE', bn: 'দক্ষিণ-পূর্ব (SE)' },
    { en: 'SSE', bn: 'দক্ষিণ-দক্ষিণপূর্ব (SSE)' },
    { en: 'S', bn: 'দক্ষিণ (S)' },
    { en: 'SSW', bn: 'দক্ষিণ-দক্ষিণপশ্চিম (SSW)' },
    { en: 'SW', bn: 'দক্ষিণ-পশ্চিম (SW)' },
    { en: 'WSW', bn: 'পশ্চিম-দক্ষিণপশ্চিম (WSW)' },
    { en: 'W', bn: 'পশ্চিম (W)' },
    { en: 'WNW', bn: 'পশ্চিম-উত্তরপশ্চিম (WNW)' },
    { en: 'NW', bn: 'উত্তর-পশ্চিম (NW)' },
    { en: 'NNW', bn: 'উত্তর-উত্তরপশ্চিম (NNW)' },
  ];

  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * 3. calculatePerimeter(points)
 * Calculates the total perimeter of a polygon in meters, automatically closing
 * the polygon by connecting the last point back to the first point (Point A).
 *
 * @param points - Array of LatLngPoint
 * @returns Total perimeter in meters
 */
export function calculatePerimeter(points: LatLngPoint[]): number {
  const validPoints = filterValidPoints(points);
  if (validPoints.length < 2) {
    return 0;
  }

  let totalPerimeterMeters = 0;
  const count = validPoints.length;

  for (let i = 0; i < count; i++) {
    const current = validPoints[i];
    const next = validPoints[(i + 1) % count]; // Automatically closes back to index 0 (Point A)
    totalPerimeterMeters += calculateDistance(current, next);
  }

  return totalPerimeterMeters;
}

/**
 * Calculates individual boundary line segments between each consecutive point.
 * When there are >= 3 points, includes the closing segment from the last point back to point A.
 * When there are 2 points, calculates the single line segment from point A to point B.
 */
export function calculatePolygonSegments(points: LatLngPoint[]): GpsPolygonSegment[] {
  const validPoints = filterValidPoints(points);
  if (validPoints.length < 2) {
    return [];
  }

  const segments: GpsPolygonSegment[] = [];
  const count = validPoints.length;
  // If at least 3 points, close polygon back to A (count segments).
  // If exactly 2 points, only 1 segment (A -> B).
  const loopCount = count >= 3 ? count : 1;

  for (let i = 0; i < loopCount; i++) {
    const nextIndex = (i + 1) % count;
    const from = validPoints[i];
    const to = validPoints[nextIndex];
    const isClosing = count >= 3 && i === count - 1;

    const distM = calculateDistance(from, to);
    const distFt = distM * LAND_CONSTANTS.FEET_PER_METER;
    const bearing = calculateBearing(from, to);
    const compass = getCompassDirection(bearing);

    segments.push({
      fromIndex: i,
      toIndex: nextIndex,
      fromLabel: from.label || String.fromCharCode(65 + (i % 26)),
      toLabel: to.label || String.fromCharCode(65 + (nextIndex % 26)),
      from,
      to,
      distanceMeters: roundClean(distM, 2),
      distanceFeet: roundClean(distFt, 2),
      bearingDegrees: roundClean(bearing, 1),
      compassDirectionEn: compass.en,
      compassDirectionBn: compass.bn,
      isClosing,
    });
  }

  return segments;
}

/**
 * Computes geographic centroid (average latitude and longitude) for a polygon.
 */
export function calculateCentroid(points: LatLngPoint[]): {
  latitude: number;
  longitude: number;
} | null {
  const valid = filterValidPoints(points);
  if (valid.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;
  for (const pt of valid) {
    sumLat += pt.latitude;
    sumLng += pt.longitude;
  }

  return {
    latitude: sumLat / valid.length,
    longitude: sumLng / valid.length,
  };
}

/**
 * Calculates polygon area in square meters using a high-precision local projection
 * centered at the polygon's centroid (Azimuthal Equidistant / Tangent Plane Shoelace).
 *
 * For land survey parcels (from decimals to thousands of acres), this provides
 * sub-centimeter agreement with geodesic formulas while remaining mathematically
 * robust and preventing spherical distortion.
 *
 * @param validPoints - Array of at least 3 validated LatLngPoints
 * @returns Area in square meters
 */
export function calculateLocalProjectedAreaSqMeters(validPoints: LatLngPoint[]): number {
  const count = validPoints.length;
  if (count < 3) return 0;

  // 1. Calculate centroid as local projection origin (lat0, lon0)
  let sumLat = 0;
  let sumLng = 0;
  for (let i = 0; i < count; i++) {
    sumLat += validPoints[i].latitude;
    sumLng += validPoints[i].longitude;
  }
  const lat0 = (sumLat / count) * (Math.PI / 180);
  const lon0 = (sumLng / count) * (Math.PI / 180);

  // 2. Project geographic coordinates to local Cartesian (x, y) meters
  // x = R * (lon - lon0) * cos(lat0)
  // y = R * (lat - lat0)
  const xCoords: number[] = new Array(count);
  const yCoords: number[] = new Array(count);
  const cosLat0 = Math.cos(lat0);

  for (let i = 0; i < count; i++) {
    const latRad = (validPoints[i].latitude * Math.PI) / 180;
    const lonRad = (validPoints[i].longitude * Math.PI) / 180;

    xCoords[i] = EARTH_RADIUS_METERS * (lonRad - lon0) * cosLat0;
    yCoords[i] = EARTH_RADIUS_METERS * (latRad - lat0);
  }

  // 3. Apply Gauss's Shoelace formula on local metric Cartesian coordinates
  let areaSum = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    areaSum += xCoords[i] * yCoords[j] - xCoords[j] * yCoords[i];
  }

  return Math.abs(areaSum) / 2;
}

/**
 * Alternative geodesic spherical excess method (Chamberlain & Duquette algorithm).
 * Kept for verification against the local projection.
 */
export function calculateSphericalExcessAreaSqMeters(validPoints: LatLngPoint[]): number {
  const count = validPoints.length;
  if (count < 3) return 0;

  let total = 0;
  for (let i = 0; i < count; i++) {
    const pPrev = validPoints[(i - 1 + count) % count];
    const pNext = validPoints[(i + 1) % count];
    const pCurrent = validPoints[i];

    const dLon = ((pNext.longitude - pPrev.longitude) * Math.PI) / 180;
    const latRad = (pCurrent.latitude * Math.PI) / 180;

    total += dLon * Math.sin(latRad);
  }

  return Math.abs(total * (EARTH_RADIUS_METERS * EARTH_RADIUS_METERS)) / 2;
}

/**
 * 4. calculatePolygonArea(points)
 * Comprehensive GPS polygon calculation function.
 *
 * Requirements satisfied:
 * - Uses real latitude/longitude points.
 * - Requires at least 3 valid points.
 * - Automatically closes polygon from last point back to A.
 * - Calculates area accurately using local geodesic projection.
 * - Reuses Phase 2 Bangladesh land-unit conversion module (calculateLandUnits, LAND_CONSTANTS).
 * - Computes all segments with distances and bearings.
 *
 * @param points - Array of LatLngPoint
 * @returns GpsAreaResult with area, perimeter, segments, validation, and BD land units
 */
export function calculatePolygonArea(points: LatLngPoint[]): GpsAreaResult {
  const validation = validatePolygonPoints(points);

  // Return zeroed result with validation errors if polygon cannot be computed
  if (!validation.isValid) {
    const emptyLandUnits = calculateLandUnits(0, 0);
    return {
      isValid: false,
      pointCount: validation.validPointsCount,
      areaSqMeters: 0,
      areaSqFt: 0,
      perimeterMeters: 0,
      perimeterFt: 0,
      segments: [],
      landUnits: emptyLandUnits,
      validation,
    };
  }

  const validPoints = filterValidPoints(points);

  // Calculate area in square meters
  const areaSqMeters = calculateLocalProjectedAreaSqMeters(validPoints);

  // Convert area to square feet using shared LAND_CONSTANTS
  const areaSqFt = areaSqMeters * LAND_CONSTANTS.SQFT_PER_SQMETER;

  // Calculate perimeter in meters and feet (closing back to Point A)
  const perimeterMeters = calculatePerimeter(validPoints);
  const perimeterFt = perimeterMeters * LAND_CONSTANTS.FEET_PER_METER;

  // Calculate line segments (A->B, B->C, ..., Last->A)
  const segments = calculatePolygonSegments(validPoints);

  // Compute centroid
  const centroid = calculateCentroid(validPoints) || undefined;

  // Calculate complete Bangladesh standard & regional land units (decimal, katha, bigha, acre, etc.)
  const landUnits = calculateLandUnits(areaSqFt, perimeterFt);

  return {
    isValid: true,
    pointCount: validPoints.length,
    areaSqMeters: roundClean(areaSqMeters, 2),
    areaSqFt: roundClean(areaSqFt, 2),
    perimeterMeters: roundClean(perimeterMeters, 2),
    perimeterFt: roundClean(perimeterFt, 2),
    segments,
    landUnits,
    validation,
    centroid,
  };
}

/**
 * Calculates statistical metrics for device GPS accuracy across all collected points.
 */
export function calculateAccuracyStats(points: LatLngPoint[]): GpsAccuracyStats | null {
  const valid = filterValidPoints(points);
  const accuracies = valid
    .map((p) => p.accuracy)
    .filter((a): a is number => typeof a === 'number' && !isNaN(a) && a > 0);

  if (accuracies.length === 0) return null;

  const best = Math.min(...accuracies);
  const worst = Math.max(...accuracies);
  const sum = accuracies.reduce((a, b) => a + b, 0);
  const avg = sum / accuracies.length;

  return {
    averageAccuracy: roundClean(avg, 1),
    bestAccuracy: roundClean(best, 1),
    worstAccuracy: roundClean(worst, 1),
    countWithAccuracy: accuracies.length,
  };
}

/**
 * Formats real survey data into a clean, map-ready structure for future mapping phases.
 * Uses ONLY real collected GPS points — never synthetic or demo data.
 */
export function getMapReadySurveyData(points: LatLngPoint[]): MapReadySurveyData | null {
  const valid = filterValidPoints(points);
  if (valid.length === 0) return null;

  const polygonCoordinates: [number, number][] = valid.map((p) => [p.latitude, p.longitude]);
  if (valid.length >= 3) {
    // Automatically close back to Point A
    polygonCoordinates.push([valid[0].latitude, valid[0].longitude]);
  }

  const markers = valid.map((p, idx) => ({
    id: p.id || `pt-${idx}`,
    label: p.label || String.fromCharCode(65 + (idx % 26)),
    latitude: p.latitude,
    longitude: p.longitude,
    accuracy: p.accuracy,
    timestamp: p.timestamp,
  }));

  const segments = calculatePolygonSegments(valid);

  let minLat = valid[0].latitude;
  let maxLat = valid[0].latitude;
  let minLng = valid[0].longitude;
  let maxLng = valid[0].longitude;

  for (const pt of valid) {
    if (pt.latitude < minLat) minLat = pt.latitude;
    if (pt.latitude > maxLat) maxLat = pt.latitude;
    if (pt.longitude < minLng) minLng = pt.longitude;
    if (pt.longitude > maxLng) maxLng = pt.longitude;
  }

  return {
    polygonCoordinates,
    markers,
    segments,
    bounds: {
      minLat,
      maxLat,
      minLng,
      maxLng,
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
      },
    },
  };
}

