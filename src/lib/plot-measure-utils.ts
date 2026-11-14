import {
  LengthUnit,
  SurveyPlotRecord,
  AdditionalSideMeasurement,
  SurveyPoint,
  PlotCalculationMethod,
} from '../types';
import { LAND_CONSTANTS } from './land-units';

export const FEET_PER_METER = LAND_CONSTANTS.FEET_PER_METER;
export const METERS_PER_FOOT = 0.3048;
export const SQFT_PER_DECIMAL = LAND_CONSTANTS.SQFT_PER_DECIMAL;
export const SQFT_PER_KATHA = LAND_CONSTANTS.SQFT_PER_KATHA;
export const SQFT_PER_BIGHA = LAND_CONSTANTS.SQFT_PER_BIGHA;
export const SQFT_PER_ACRE = LAND_CONSTANTS.SQFT_PER_ACRE;
export const SQM_PER_SQFT = 0.092903;

/**
 * Convert value to feet based on input unit
 */
export function toFeet(val: number, unit: LengthUnit): number {
  if (isNaN(val) || val <= 0) return 0;
  return unit === 'meter' ? val * FEET_PER_METER : val;
}

/**
 * Convert value from feet to target unit
 */
export function fromFeet(feetVal: number, unit: LengthUnit): number {
  if (isNaN(feetVal) || feetVal <= 0) return 0;
  return unit === 'meter' ? feetVal * METERS_PER_FOOT : feetVal;
}

/**
 * Clean floating point rounding helper
 */
export function roundVal(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export interface GeometryValidationResult {
  isValid: boolean;
  isUnderdetermined: boolean;
  hasInput: boolean;
  message?: string;
  messageBn?: string;
  triangle1Valid?: boolean;
  triangle2Valid?: boolean;
}

/**
 * Validates quadrilateral boundary geometry and diagonal determinism
 */
export function validatePlotGeometry(
  north: number,
  south: number,
  east: number,
  west: number,
  unit: LengthUnit,
  diagonal?: number,
  diagonalChoice: 'AC' | 'BD' = 'AC'
): GeometryValidationResult {
  const n = toFeet(north, unit);
  const s = toFeet(south, unit);
  const e = toFeet(east, unit);
  const w = toFeet(west, unit);

  // Check if at least some sides are entered
  if (n <= 0 && s <= 0 && e <= 0 && w <= 0) {
    return {
      isValid: false,
      isUnderdetermined: true,
      hasInput: false,
      message: 'Enter side measurements to calculate boundary.',
      messageBn: 'সীমানা হিসাব করতে বাহুগুলোর পরিমাপ প্রবেশ করান।',
    };
  }

  // Check if all four standard sides are entered
  if (n <= 0 || s <= 0 || e <= 0 || w <= 0) {
    return {
      isValid: false,
      isUnderdetermined: true,
      hasInput: true,
      message: 'All 4 primary sides (North, South, East, West) are required for complete boundary.',
      messageBn: 'সম্পূর্ণ সীমানা নির্ধারণের জন্য ৪টি প্রধান বাহুর (উত্তর, দক্ষিণ, পূর্ব, পশ্চিম) পরিমাপ আবশ্যক।',
    };
  }

  // Polygon Inequality Check: Max side must be strictly less than sum of remaining sides
  const sides = [n, s, e, w];
  const maxSide = Math.max(...sides);
  const sumRemaining = sides.reduce((acc, val) => acc + val, 0) - maxSide;

  if (maxSide >= sumRemaining) {
    return {
      isValid: false,
      isUnderdetermined: true,
      hasInput: true,
      message: `Invalid geometry: Side length ${roundVal(maxSide, 1)} ft exceeds sum of other sides (${roundVal(sumRemaining, 1)} ft).`,
      messageBn: `অসম্ভব সীমানা: বৃহত্তম বাহু (${roundVal(maxSide, 1)} ফুট) অপর তিনটি বাহুর যোগফল (${roundVal(sumRemaining, 1)} ফুট) অপেক্ষা বড় হতে পারে না।`,
    };
  }

  // If no diagonal is provided: Geometry is underdetermined!
  const d = diagonal ? toFeet(diagonal, unit) : 0;
  if (!d || d <= 0) {
    return {
      isValid: true,
      isUnderdetermined: true,
      hasInput: true,
      message: 'Geometry underdetermined: 4 side lengths alone do not determine quadrilateral area. Enter a diagonal for exact area.',
      messageBn: 'অপূর্ণাঙ্গ জ্যামিতি: শুধুমাত্র ৪ বাহুর দৈর্ঘ্য দিয়ে চতুর্ভুজের ক্ষেত্রফল নির্দিষ্ট হয় না। শতভাগ সঠিক ক্ষেত্রফল পেতে কর্ণ পরিমাপ প্রবেশ করান।',
    };
  }

  // Check diagonal validity against triangles
  if (diagonalChoice === 'AC') {
    // Triangle 1: North (AB), East (BC), Diagonal (AC)
    const t1Valid = n + e > d && n + d > e && e + d > n;
    // Triangle 2: South (CD), West (DA), Diagonal (AC)
    const t2Valid = s + w > d && s + d > w && w + d > s;

    if (!t1Valid || !t2Valid) {
      return {
        isValid: false,
        isUnderdetermined: true,
        hasInput: true,
        triangle1Valid: t1Valid,
        triangle2Valid: t2Valid,
        message: `Invalid diagonal: ${roundVal(d, 1)} ft violates triangle inequality with entered sides.`,
        messageBn: `অসম্ভব কর্ণের দৈর্ঘ্য: ${roundVal(d, 1)} ফুট কর্ণ দিয়ে ত্রিভুজ অসমতা গঠিত হয় না। কর্ণ অবশ্যই বাহুগুলোর সাথে সামঞ্জস্যপূর্ণ হতে হবে।`,
      };
    }
  } else {
    // Triangle 1: East (BC), South (CD), Diagonal (BD)
    const t1Valid = e + s > d && e + d > s && s + d > e;
    // Triangle 2: West (DA), North (AB), Diagonal (BD)
    const t2Valid = w + n > d && w + d > n && n + d > w;

    if (!t1Valid || !t2Valid) {
      return {
        isValid: false,
        isUnderdetermined: true,
        hasInput: true,
        triangle1Valid: t1Valid,
        triangle2Valid: t2Valid,
        message: `Invalid diagonal: ${roundVal(d, 1)} ft violates triangle inequality with entered sides.`,
        messageBn: `অসম্ভব কর্ণের দৈর্ঘ্য: ${roundVal(d, 1)} ফুট কর্ণ দিয়ে ত্রিভুজ অসমতা গঠিত হয় না।`,
      };
    }
  }

  return {
    isValid: true,
    isUnderdetermined: false,
    hasInput: true,
    triangle1Valid: true,
    triangle2Valid: true,
    message: 'Geometry fully determined with exact triangulation.',
    messageBn: 'জ্যামিতিকভাবে শতভাগ নির্ধারিত ও নিখুঁত ত্রিকোণমিতিক পরিমাপ।',
  };
}

export interface PlotMetricsResult {
  perimeterFt: number;
  perimeterMeters: number;
  areaSqFt: number | null;
  areaSqMeters: number | null;
  decimal: number | null;
  katha: number | null;
  bigha: number | null;
  acre: number | null;
  averageLengthFt: number | null;
  averageWidthFt: number | null;
  isApproximate: boolean;
  validation: GeometryValidationResult;
}

/**
 * Calculates perimeter and area based on calculationMethod:
 * - 'average' (DEFAULT): Average length (N+S)/2 × Average width (E+W)/2.
 *   Provides approximate occupation area when field obstacles prevent diagonal measurement.
 * - 'diagonal': Exact triangulation using Heron's formula (requires valid diagonal).
 */
export function calculatePlotMetrics(
  north: number,
  south: number,
  east: number,
  west: number,
  unit: LengthUnit,
  diagonal?: number,
  diagonalChoice: 'AC' | 'BD' = 'AC',
  additionalSides: AdditionalSideMeasurement[] = [],
  calculationMethod: PlotCalculationMethod = 'average'
): PlotMetricsResult {
  const n = toFeet(north, unit);
  const s = toFeet(south, unit);
  const e = toFeet(east, unit);
  const w = toFeet(west, unit);

  // Additional sides sum
  let addFt = 0;
  for (const side of additionalSides) {
    if (side.length > 0) {
      addFt += toFeet(side.length, side.unit || unit);
    }
  }

  const perimeterFt = roundVal(n + s + e + w + addFt, 2);
  const perimeterMeters = roundVal(perimeterFt * METERS_PER_FOOT, 2);

  // METHOD 1: AVERAGE METHOD (DEFAULT FOR OCCUPATION SURVEY)
  if (calculationMethod === 'average') {
    const hasAnyInput = n > 0 || s > 0 || e > 0 || w > 0;
    const hasAllPrimarySides = n > 0 && s > 0 && e > 0 && w > 0;

    if (!hasAllPrimarySides) {
      return {
        perimeterFt,
        perimeterMeters,
        areaSqFt: null,
        areaSqMeters: null,
        decimal: null,
        katha: null,
        bigha: null,
        acre: null,
        averageLengthFt: null,
        averageWidthFt: null,
        isApproximate: true,
        validation: {
          isValid: false,
          isUnderdetermined: true,
          hasInput: hasAnyInput,
          message: 'All 4 primary sides (North, South, East, West) are required for Average Method calculation.',
          messageBn: 'গড় পদ্ধতিতে ক্ষেত্রফল পাওয়ার জন্য ৪টি প্রধান বাহুর (উত্তর, দক্ষিণ, পূর্ব ও পশ্চিম) পরিমাপ প্রবেশ করান।',
        },
      };
    }

    // Average Length & Average Width
    const avgLengthFt = roundVal((n + s) / 2, 2);
    const avgWidthFt = roundVal((e + w) / 2, 2);
    const approxAreaSqFt = roundVal(avgLengthFt * avgWidthFt, 2);
    const approxAreaSqMeters = roundVal(approxAreaSqFt * SQM_PER_SQFT, 2);
    const decimal = roundVal(approxAreaSqFt / SQFT_PER_DECIMAL, 3);
    const katha = roundVal(approxAreaSqFt / SQFT_PER_KATHA, 3);
    const bigha = roundVal(approxAreaSqFt / SQFT_PER_BIGHA, 3);
    const acre = roundVal(approxAreaSqFt / SQFT_PER_ACRE, 4);

    return {
      perimeterFt,
      perimeterMeters,
      areaSqFt: approxAreaSqFt,
      areaSqMeters: approxAreaSqMeters,
      decimal,
      katha,
      bigha,
      acre,
      averageLengthFt: avgLengthFt,
      averageWidthFt: avgWidthFt,
      isApproximate: true,
      validation: {
        isValid: true,
        isUnderdetermined: true,
        hasInput: true,
        message: 'Average method approximate calculation: based on average length × average width.',
        messageBn: 'গড় পদ্ধতিতে আনুমানিক দখলকৃত জমির পরিমাণ (এই হিসাব গড় দৈর্ঘ্য × গড় প্রস্থের ভিত্তিতে প্রস্তুত)।',
      },
    };
  }

  // METHOD 2: EXACT DIAGONAL / TRIANGULATION METHOD (ADVANCED)
  const validation = validatePlotGeometry(north, south, east, west, unit, diagonal, diagonalChoice);

  if (!validation.isValid || validation.isUnderdetermined) {
    return {
      perimeterFt,
      perimeterMeters,
      areaSqFt: null,
      areaSqMeters: null,
      decimal: null,
      katha: null,
      bigha: null,
      acre: null,
      averageLengthFt: null,
      averageWidthFt: null,
      isApproximate: false,
      validation,
    };
  }

  // Exact area using Heron's formula on both triangles
  const d = toFeet(diagonal || 0, unit);
  let a1 = 0;
  let a2 = 0;

  if (diagonalChoice === 'AC') {
    // Triangle 1 (N, E, d)
    const s1 = (n + e + d) / 2;
    a1 = Math.sqrt(Math.max(0, s1 * (s1 - n) * (s1 - e) * (s1 - d)));

    // Triangle 2 (S, W, d)
    const s2 = (s + w + d) / 2;
    a2 = Math.sqrt(Math.max(0, s2 * (s2 - s) * (s2 - w) * (s2 - d)));
  } else {
    // Triangle 1 (E, S, d)
    const s1 = (e + s + d) / 2;
    a1 = Math.sqrt(Math.max(0, s1 * (s1 - e) * (s1 - s) * (s1 - d)));

    // Triangle 2 (W, N, d)
    const s2 = (w + n + d) / 2;
    a2 = Math.sqrt(Math.max(0, s2 * (s2 - w) * (s2 - n) * (s2 - d)));
  }

  const areaSqFt = roundVal(a1 + a2, 2);
  const areaSqMeters = roundVal(areaSqFt * SQM_PER_SQFT, 2);
  const decimal = roundVal(areaSqFt / SQFT_PER_DECIMAL, 3);
  const katha = roundVal(areaSqFt / SQFT_PER_KATHA, 3);
  const bigha = roundVal(areaSqFt / SQFT_PER_BIGHA, 3);
  const acre = roundVal(areaSqFt / SQFT_PER_ACRE, 4);

  return {
    perimeterFt,
    perimeterMeters,
    areaSqFt,
    areaSqMeters,
    decimal,
    katha,
    bigha,
    acre,
    averageLengthFt: roundVal((n + s) / 2, 2),
    averageWidthFt: roundVal((e + w) / 2, 2),
    isApproximate: false,
    validation,
  };
}

export interface PlotVertex {
  label: string;
  nameBn: string;
  x: number;
  y: number;
}

/**
 * Computes 2D vertex coordinates for automatic SVG rendering
 */
export function computePlotCoordinates(
  north: number,
  south: number,
  east: number,
  west: number,
  unit: LengthUnit,
  diagonal?: number,
  diagonalChoice: 'AC' | 'BD' = 'AC'
): {
  vertices: PlotVertex[];
  isExact: boolean;
  diagonalEndpoints?: { start: PlotVertex; end: PlotVertex };
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
} {
  const n = toFeet(north, unit) || 60;
  const s = toFeet(south, unit) || 60;
  const e = toFeet(east, unit) || 80;
  const w = toFeet(west, unit) || 80;
  const d = diagonal ? toFeet(diagonal, unit) : 0;

  const validation = validatePlotGeometry(north, south, east, west, unit, diagonal, diagonalChoice);

  // If geometry is fully determined with valid diagonal:
  if (validation.isValid && !validation.isUnderdetermined && d > 0) {
    if (diagonalChoice === 'AC') {
      // Vertex A (North-West) at (0, 0)
      // Vertex B (North-East) at (n, 0)
      // Triangle ABC: Sides n, e, d
      const cosCAB = Math.max(-1, Math.min(1, (n * n + d * d - e * e) / (2 * n * d)));
      const angleCAB = Math.acos(cosCAB);

      // In SVG, positive Y is downwards. B is at (n, 0), so AC rotates downwards by angleCAB:
      const cx = d * Math.cos(angleCAB);
      const cy = d * Math.sin(angleCAB);

      // Triangle CDA: Sides d, s, w
      const cosCAD = Math.max(-1, Math.min(1, (d * d + w * w - s * s) / (2 * d * w)));
      const angleCAD = Math.acos(cosCAD);

      const totalAngleAD = angleCAB + angleCAD;
      const dx = w * Math.cos(totalAngleAD);
      const dy = w * Math.sin(totalAngleAD);

      const vertices: PlotVertex[] = [
        { label: 'A', nameBn: 'উ-প (A)', x: 0, y: 0 },
        { label: 'B', nameBn: 'উ-পূ (B)', x: n, y: 0 },
        { label: 'C', nameBn: 'দ-পূ (C)', x: cx, y: cy },
        { label: 'D', nameBn: 'দ-প (D)', x: dx, y: dy },
      ];

      const xs = vertices.map((v) => v.x);
      const ys = vertices.map((v) => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        vertices,
        isExact: true,
        diagonalEndpoints: { start: vertices[0], end: vertices[2] }, // A to C
        bounds: { minX, maxX, minY, maxY, width: maxX - minX || 1, height: maxY - minY || 1 },
      };
    } else {
      // BD diagonal: Vertex B (NE) to Vertex D (SW)
      // Vertex A at (0, 0), B at (n, 0)
      // Triangle DAB: Sides w, n, d
      const cosABD = Math.max(-1, Math.min(1, (n * n + d * d - w * w) / (2 * n * d)));
      const angleABD = Math.acos(cosABD);
      const dx = n - d * Math.cos(angleABD);
      const dy = d * Math.sin(angleABD);

      // Triangle BCD: Sides e, s, d
      const cosCBD = Math.max(-1, Math.min(1, (e * e + d * d - s * s) / (2 * e * d)));
      const angleCBD = Math.acos(cosCBD);
      const totalAngleBC = angleABD - angleCBD;
      const cx = n + e * Math.sin(totalAngleBC);
      const cy = e * Math.cos(totalAngleBC);

      const vertices: PlotVertex[] = [
        { label: 'A', nameBn: 'উ-প (A)', x: 0, y: 0 },
        { label: 'B', nameBn: 'উ-পূ (B)', x: n, y: 0 },
        { label: 'C', nameBn: 'দ-পূ (C)', x: cx, y: cy },
        { label: 'D', nameBn: 'দ-প (D)', x: dx, y: dy },
      ];

      const xs = vertices.map((v) => v.x);
      const ys = vertices.map((v) => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        vertices,
        isExact: true,
        diagonalEndpoints: { start: vertices[1], end: vertices[3] }, // B to D
        bounds: { minX, maxX, minY, maxY, width: maxX - minX || 1, height: maxY - minY || 1 },
      };
    }
  }

  // Underdetermined or invalid diagonal: Render approximate canonical quadrilateral
  // Base top edge on North (n), bottom on South (s), height on average of East and West
  const avgHeight = Math.max(20, (e + w) / 2);
  const topWidth = n;
  const bottomWidth = s;
  const xOffsetBottom = (topWidth - bottomWidth) / 2;

  const vertices: PlotVertex[] = [
    { label: 'A', nameBn: 'উ-প (A)', x: 0, y: 0 },
    { label: 'B', nameBn: 'উ-পূ (B)', x: topWidth, y: 0 },
    { label: 'C', nameBn: 'দ-পূ (C)', x: xOffsetBottom + bottomWidth, y: avgHeight },
    { label: 'D', nameBn: 'দ-প (D)', x: xOffsetBottom, y: avgHeight },
  ];

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    vertices,
    isExact: false,
    bounds: { minX, maxX, minY, maxY, width: maxX - minX || 1, height: maxY - minY || 1 },
  };
}

/**
 * Creates a fresh default plot record
 */
export function createDefaultPlotRecord(order: number, defaultDag: string = '১২৪'): SurveyPlotRecord {
  const num = order + 1;
  const plotName = `প্লট ${num.toString().padStart(2, '0')} (দাগ ${defaultDag})`;
  const now = Date.now();

  return {
    id: `plot-${now}-${Math.random().toString(36).substring(2, 7)}`,
    plotName,
    dagNo: defaultDag,
    khatianNo: '',
    unit: 'feet',
    calculationMethod: 'average',
    northSide: 0,
    southSide: 0,
    eastSide: 0,
    westSide: 0,
    northNotes: '',
    southNotes: '',
    eastNotes: '',
    westNotes: '',
    additionalSides: [],
    diagonal: undefined,
    diagonalChoice: 'AC',
    diagonalNotes: '',
    notes: '',
    perimeterFt: 0,
    perimeterMeters: 0,
    areaSqFt: null,
    areaSqMeters: null,
    decimal: null,
    katha: null,
    bigha: null,
    acre: null,
    averageLengthFt: null,
    averageWidthFt: null,
    isApproximate: true,
    isGeometryValid: false,
    isGeometryUnderdetermined: true,
    geometryValidationMessage: 'বাহুগুলোর পরিমাপ প্রবেশ করান',
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Recalculates all metrics on a plot record
 */
export function recalculatePlot(plot: SurveyPlotRecord): SurveyPlotRecord {
  const method = plot.calculationMethod || 'average';
  const metrics = calculatePlotMetrics(
    plot.northSide,
    plot.southSide,
    plot.eastSide,
    plot.westSide,
    plot.unit,
    plot.diagonal,
    plot.diagonalChoice || 'AC',
    plot.additionalSides || [],
    method
  );

  return {
    ...plot,
    calculationMethod: method,
    perimeterFt: metrics.perimeterFt,
    perimeterMeters: metrics.perimeterMeters,
    areaSqFt: metrics.areaSqFt,
    areaSqMeters: metrics.areaSqMeters,
    decimal: metrics.decimal,
    katha: metrics.katha,
    bigha: metrics.bigha,
    acre: metrics.acre,
    averageLengthFt: metrics.averageLengthFt,
    averageWidthFt: metrics.averageWidthFt,
    isApproximate: metrics.isApproximate,
    isGeometryValid: metrics.validation.isValid,
    isGeometryUnderdetermined: metrics.validation.isUnderdetermined,
    geometryValidationMessage: metrics.validation.messageBn,
    updatedAt: Date.now(),
  };
}

/**
 * Converts plots into standard SurveyPoint[] for compatibility with existing survey records, CAD maps & A4 reports
 */
export function convertPlotsToSurveyPoints(plots: SurveyPlotRecord[]): SurveyPoint[] {
  const points: SurveyPoint[] = [];
  const baseLat = 23.8103;
  const baseLng = 90.4125;

  for (const plot of plots) {
    const coords = computePlotCoordinates(
      plot.northSide,
      plot.southSide,
      plot.eastSide,
      plot.westSide,
      plot.unit,
      plot.diagonal,
      plot.diagonalChoice || 'AC'
    );

    coords.vertices.forEach((v) => {
      // 1 degree latitude ~ 111,132 meters = 364,606 feet
      const latOffset = (v.y * 0.3048) / 111132;
      const lngOffset = (v.x * 0.3048) / (111132 * Math.cos((baseLat * Math.PI) / 180));

      points.push({
        id: `pt-plot-${plot.id}-${v.label}`,
        name: `${plot.dagNo}-${v.label}`,
        x: v.x,
        y: v.y,
        lat: Number.isFinite(latOffset) ? baseLat + latOffset : baseLat,
        lng: Number.isFinite(lngOffset) ? baseLng + lngOffset : baseLng,
        label: `${plot.dagNo}-${v.label}`,
        distance: undefined,
        timestamp: plot.updatedAt,
      });
    });
  }

  return points;
}
