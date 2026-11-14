import {
  SketchRecord,
  SketchDetectionData,
  SketchDigitalDrawing,
  SurveyRecord,
  SurveyPoint,
  DrawingAnnotation,
  DetectedPoint,
  DetectedLine,
} from '../types';
import { roundClean, LAND_CONSTANTS } from './land-units';

const STORAGE_KEY = 'bhumi_amin_sketch_records_v1';

export const SKETCH_LEGAL_DISCLAIMER_BN =
  'এআই-উৎপন্ন ডিজিটাল ড্রয়িং মূল খসড়া স্কেচের ভিত্তিতে প্রস্তুতকৃত এবং এতে অভিজ্ঞ আমিনের পুঙ্খানুপুঙ্খ রিভিউ আবশ্যক। এটি কোনো আদালত বা রাজস্ব কর্তৃপক্ষের চূড়ান্ত আইনি সীমানা দলিল নয়।';

export const SKETCH_LEGAL_DISCLAIMER_EN =
  'AI-generated drawing is based on the uploaded sketch and requires Amin/user review. It is not automatically a legal boundary document.';

/**
 * Retrieve all saved sketch records from local storage
 */
export function getStoredSketches(): SketchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load sketches from storage:', err);
    return [];
  }
}

/**
 * Save or update a sketch record
 */
export function saveSketchRecord(record: SketchRecord): void {
  try {
    const list = getStoredSketches();
    const index = list.findIndex((s) => s.id === record.id);
    if (index >= 0) {
      list[index] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('sketch_storage_updated'));
  } catch (err) {
    console.error('Failed to save sketch record:', err);
  }
}

/**
 * Retrieve a specific sketch by ID
 */
export function getSketchById(id: string): SketchRecord | null {
  const list = getStoredSketches();
  return list.find((s) => s.id === id) || null;
}

/**
 * Delete a sketch record
 */
export function deleteSketchRecord(id: string): void {
  try {
    const list = getStoredSketches().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('sketch_storage_updated'));
  } catch (err) {
    console.error('Failed to delete sketch record:', err);
  }
}

/**
 * Calculate polygon area from normalized 2D points using the Shoelace formula
 * If dimensions in feet are known, calculates real square feet, decimal, and katha
 */
export function calculateSketchPolygonMetrics(
  points: { x: number; y: number }[],
  scaleFactorFeetPerUnit = 0.1
): {
  areaSqFt: number;
  perimeterFt: number;
  decimal: number;
  katha: number;
  bigha: number;
} {
  if (points.length < 3) {
    return { areaSqFt: 0, perimeterFt: 0, decimal: 0, katha: 0, bigha: 0 };
  }

  let areaAccum = 0;
  let perimeterAccum = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    // Shoelace area
    areaAccum += p1.x * p2.y - p2.x * p1.y;

    // Euclidean distance in scaled feet
    const dx = (p2.x - p1.x) * scaleFactorFeetPerUnit;
    const dy = (p2.y - p1.y) * scaleFactorFeetPerUnit;
    perimeterAccum += Math.sqrt(dx * dx + dy * dy);
  }

  const rawAreaUnits = Math.abs(areaAccum) / 2;
  const areaSqFt = roundClean(rawAreaUnits * (scaleFactorFeetPerUnit * scaleFactorFeetPerUnit), 2);
  const perimeterFt = roundClean(perimeterAccum, 2);
  const decimal = roundClean(areaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const katha = roundClean(areaSqFt / LAND_CONSTANTS.SQFT_PER_KATHA, 3);
  const bigha = roundClean(areaSqFt / LAND_CONSTANTS.SQFT_PER_BIGHA, 4);

  return { areaSqFt, perimeterFt, decimal, katha, bigha };
}

/**
 * Convert a reviewed sketch into a Phase 5 SurveyRecord
 * This enables 1-click loading into MapDrawingScreen, SurveyReportScreen, and A4 PDF printing!
 */
export function convertSketchToSurveyRecord(sketch: SketchRecord): SurveyRecord {
  const points: SurveyPoint[] =
    sketch.digitalDrawing?.points ||
    sketch.detectionData?.points.map((p, idx) => ({
      id: p.id || `sk-pt-${idx + 1}`,
      name: p.name || `P${idx + 1}`,
      x: p.x,
      y: p.y,
      distance: 0,
      label: p.name,
    })) ||
    [];

  const areaSqFt = sketch.digitalDrawing?.areaSqFt || 0;
  const perimeterFt = sketch.digitalDrawing?.perimeterFt || 0;

  const annotations: DrawingAnnotation[] =
    sketch.digitalDrawing?.annotations ||
    (sketch.detectionData?.lines || []).map((l, idx) => ({
      id: l.id || `ann-line-${idx}`,
      type: 'line',
      x: 0,
      y: 0,
      label: l.label || (l.distanceFt ? `${l.distanceFt} ফুট` : ''),
      color: '#059669',
    }));

  const surveyDate = new Date(sketch.uploadedAt).toISOString().split('T')[0];

  return {
    id: sketch.surveyRecordId || `survey-from-sketch-${sketch.id}`,
    title: sketch.title || `খাতার নকশা — দাগ নং ${sketch.metadata.dagNo || 'অনির্ধারিত'}`,
    mouza: sketch.metadata.mouza || 'নকশা মৌজা',
    jlNo: sketch.metadata.jlNo || '০১',
    dagNo: sketch.metadata.dagNo || '১',
    khatianNo: sketch.metadata.khatianNo || '',
    date: surveyDate,
    areaSqFt,
    perimeterFt,
    points,
    status: sketch.reviewStatus === 'approved' ? 'verified' : 'draft',
    notes: `[হাতে আঁকা খসড়া থেকে প্রস্তুত]\n${sketch.notes || ''}\nআইনি সতর্কতা: ${SKETCH_LEGAL_DISCLAIMER_BN}`,
    clientName: sketch.metadata.clientName || 'সম্মানিত ভূমি মালিক',
    surveyorName: sketch.reviewerName || sketch.metadata.surveyorName || 'সনদপ্রাপ্ত আমিন',
    district: sketch.metadata.district || '',
    upazila: sketch.metadata.upazila || '',
    annotations,
    createdAt: sketch.uploadedAt,
    updatedAt: Date.now(),
  };
}

/**
 * Interface for AI Vision / Sketch Analysis
 */
export interface ISketchVisionProvider {
  checkAiStatus(): Promise<{
    connected: boolean;
    status: 'connected' | 'integration_ready' | 'not_configured' | 'error';
    model: string | null;
    message: string;
    disclaimer: string;
  }>;
  analyzeSketch(params: {
    imageBase64: string;
    mimeType: string;
    fileName: string;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    status: 'analyzed' | 'integration_ready' | 'not_configured' | 'error';
    aiStatusText?: string;
    modelUsed?: string;
    data?: SketchDetectionData;
    message: string;
    disclaimer?: string;
  }>;
}

/**
 * Server-backed AI Vision Provider
 * Calls `/api/sketch-to-drawing/detect` which handles Gemini Vision or integration-ready mode safely
 */
export class ServerSketchVisionProvider implements ISketchVisionProvider {
  async checkAiStatus(): Promise<{
    connected: boolean;
    status: 'connected' | 'integration_ready' | 'not_configured' | 'error';
    model: string | null;
    message: string;
    disclaimer: string;
  }> {
    try {
      const response = await fetch('/api/sketch-to-drawing/status');
      if (response.ok) {
        return await response.json();
      }
      return {
        connected: false,
        status: 'integration_ready',
        model: null,
        message: 'AI configuration required (GEMINI_API_KEY not active)',
        disclaimer: SKETCH_LEGAL_DISCLAIMER_EN,
      };
    } catch {
      return {
        connected: false,
        status: 'integration_ready',
        model: null,
        message: 'AI configuration required',
        disclaimer: SKETCH_LEGAL_DISCLAIMER_EN,
      };
    }
  }

  async analyzeSketch(params: {
    imageBase64: string;
    mimeType: string;
    fileName: string;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    status: 'analyzed' | 'integration_ready' | 'not_configured' | 'error';
    aiStatusText?: string;
    modelUsed?: string;
    data?: SketchDetectionData;
    message: string;
    disclaimer?: string;
  }> {
    try {
      const response = await fetch('/api/sketch-to-drawing/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return {
          success: false,
          status: 'integration_ready',
          aiStatusText: 'AI configuration required',
          message:
            errJson.message ||
            'সার্ভার এআই ভিশন বর্তমানে ভিত্তি/ম্যানুয়াল মোডে রয়েছে। আপনি নিজে পয়েন্ট ও রেখা চিহ্নিত বা রিভিউ করতে পারবেন।',
          disclaimer: SKETCH_LEGAL_DISCLAIMER_EN,
        };
      }

      const result = await response.json();
      return result;
    } catch (err: unknown) {
      console.warn('Sketch analysis API call note:', err);
      return {
        success: false,
        status: 'integration_ready',
        aiStatusText: 'AI configuration required',
        message:
          'এআই ভিশন সার্ভিসটি ভিত্তি ও আর্কিটেকচার মোডে প্রস্তুত রয়েছে। আমিন সরাসরি পয়েন্ট স্থাপন ও ড্রয়িং সম্পাদনা করতে পারবেন।',
        disclaimer: SKETCH_LEGAL_DISCLAIMER_EN,
      };
    }
  }
}

export const defaultVisionProvider = new ServerSketchVisionProvider();
