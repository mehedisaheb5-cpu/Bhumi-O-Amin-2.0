import { SurveyRecord, SurveyReportRecord, SurveyPoint } from '../types';
import {
  LatLngPoint,
  filterValidPoints,
  calculatePolygonArea,
  calculateAccuracyStats,
} from './gps-geometry';
import { calculateLandUnits, roundClean } from './land-units';
import { getStoredParcels } from './google-maps-types';
import { getStoredPentagraphProjects } from './mouza-map';
import { isFirebaseConfigured, db, doc, setDoc, cleanForFirestore } from './firebase';

export const REPORTS_STORAGE_KEY = 'bhumi-amin-reports';

/**
 * Retrieve saved reports from localStorage with error handling
 */
export function getStoredReports(): SurveyReportRecord[] {
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read saved reports from localStorage', err);
    return [];
  }
}

/**
 * Alias for getStoredReports
 */
export const getSavedReports = getStoredReports;

/**
 * Persist reports to localStorage
 */
export function saveStoredReports(reports: SurveyReportRecord[]): void {
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.error('Failed to write saved reports to localStorage', err);
  }
}

/**
 * Save or update an individual report in localStorage
 */
export function saveReportRecord(report: SurveyReportRecord): SurveyReportRecord[] {
  const current = getStoredReports();
  const idx = current.findIndex((r) => r.id === report.id);
  let updated: SurveyReportRecord[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = {
      ...report,
      updatedAt: Date.now(),
    };
  } else {
    updated = [report, ...current];
  }
  saveStoredReports(updated);

  if (isFirebaseConfigured && db) {
    try {
      setDoc(doc(db, 'reports', report.id), cleanForFirestore(report)).catch((err) =>
        console.warn('Firestore report save error:', err)
      );
    } catch (err) {
      console.warn('Firestore report save error:', err);
    }
  }

  return updated;
}

/**
 * Delete a report record without affecting underlying survey
 */
export function deleteReportRecord(reportId: string): SurveyReportRecord[] {
  const current = getStoredReports();
  const updated = current.filter((r) => r.id !== reportId);
  saveStoredReports(updated);
  return updated;
}

/**
 * Generate a deterministic unique report number
 * Format: BHOA-YYYYMMDD-XXXX (e.g. BHOA-20260914-0001)
 */
export function generateReportNumber(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const current = getStoredReports();
  // Count how many reports already exist for today
  const todaysReports = current.filter((r) =>
    r.reportNumber && r.reportNumber.includes(`BHOA-${dateStr}`)
  );

  const seq = todaysReports.length + 1;
  const seqStr = String(seq).padStart(4, '0');
  return `BHOA-${dateStr}-${seqStr}`;
}

/**
 * Validation result for report generation
 */
export interface SurveyValidationResult {
  isValid: boolean;
  pointCount: number;
  reasonBn: string;
  reasonEn: string;
}

/**
 * Validate whether a survey has sufficient real points for a full boundary report
 */
export function validateSurveyForReport(survey: SurveyRecord | null | undefined): SurveyValidationResult {
  if (!survey) {
    return {
      isValid: false,
      pointCount: 0,
      reasonBn: 'কোনো সার্ভে রেকর্ড নির্বাচন করা হয়নি।',
      reasonEn: 'No survey record selected.',
    };
  }

  // Check occupation survey plots
  if (survey.plots && Array.isArray(survey.plots) && survey.plots.length > 0) {
    const hasSides = survey.plots.some(
      (p) =>
        (p.northSide > 0 && p.southSide > 0 && p.eastSide > 0 && p.westSide > 0) ||
        (p.areaSqFt !== null && p.areaSqFt > 0)
    );
    if (hasSides) {
      return {
        isValid: true,
        pointCount: survey.plots.length * 4,
        reasonBn: `বাস্তব দখল জরিপ: ${survey.plots.length}টি প্লটের পরিমাপ প্রস্তুত।`,
        reasonEn: `Occupation Survey: ${survey.plots.length} plot(s) ready for report.`,
      };
    }
  }

  if (!survey.points || !Array.isArray(survey.points)) {
    return {
      isValid: false,
      pointCount: 0,
      reasonBn: 'সার্ভে রেকর্ডে কোনো জিপিএস পয়েন্ট বা প্লট পরিমাপ পাওয়া যায়নি।',
      reasonEn: 'No survey points or plot measurements found in this record.',
    };
  }

  // Convert to LatLngPoint to check validity
  const latLngPoints: LatLngPoint[] = survey.points.map((p, idx) => ({
    id: p.id || `pt-${idx}`,
    latitude: p.lat ?? (p.y ? p.y / 10000 + 23.8 : 0),
    longitude: p.lng ?? (p.x ? p.x / 10000 + 90.4 : 0),
    accuracy: p.accuracy,
    timestamp: p.timestamp,
    label: p.label || p.name,
  }));

  const validPoints = filterValidPoints(latLngPoints);

  if (validPoints.length < 3) {
    return {
      isValid: false,
      pointCount: validPoints.length,
      reasonBn: `পূর্ণ সীমানা প্রতিবেদন তৈরির জন্য কমপক্ষে ৩টি বৈধ পয়েন্ট প্রয়োজন। (বর্তমানে ${validPoints.length}টি)`,
      reasonEn: `At least 3 valid points are required to generate a boundary report. (Currently ${validPoints.length})`,
    };
  }

  return {
    isValid: true,
    pointCount: validPoints.length,
    reasonBn: 'সার্ভেটি বৈধ এবং রিপোর্ট তৈরির উপযোগী।',
    reasonEn: 'Survey is valid and ready for report generation.',
  };
}

/**
 * Construct a fresh SurveyReportRecord from an existing SurveyRecord
 * using existing geometry and land-unit functions.
 */
export function createReportFromSurvey(
  survey: SurveyRecord,
  overrides?: Partial<SurveyReportRecord>
): SurveyReportRecord {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Convert survey points to LatLngPoint array
  const latLngPoints: LatLngPoint[] = (survey.points || []).map((p, idx) => ({
    id: p.id || `pt-${idx}`,
    latitude: p.lat ?? 0,
    longitude: p.lng ?? 0,
    accuracy: p.accuracy,
    timestamp: p.timestamp,
    label: p.label || String.fromCharCode(65 + (idx % 26)),
  }));

  const validPoints = filterValidPoints(latLngPoints);

  // Compute area and perimeter using existing geometry logic
  let areaSqFt = survey.areaSqFt || 0;
  let perimeterFt = survey.perimeterFt || 0;
  let areaSqMeters = roundClean(areaSqFt / 10.7639, 2);
  let perimeterMeters = roundClean(perimeterFt * 0.3048, 2);
  let landUnits = calculateLandUnits(areaSqFt);

  // D: Hassle-free — prioritize occupation 4-sides plots total if present
  if (survey.plots && survey.plots.length > 0) {
    const plotArea = survey.plots.reduce((acc, p) => acc + (p.areaSqFt || 0), 0);
    const plotPerimeter = survey.plots.reduce((acc, p) => acc + (p.perimeterFt || 0), 0);
    if (plotArea > 0) {
      areaSqFt = plotArea;
      perimeterFt = plotPerimeter;
      areaSqMeters = roundClean(areaSqFt * 0.092903, 2);
      perimeterMeters = roundClean(perimeterFt * 0.3048, 2);
      landUnits = calculateLandUnits(areaSqFt);
    } else if (validPoints.length >= 3) {
      const areaResult = calculatePolygonArea(validPoints);
      if (areaResult.isValid) {
        areaSqFt = areaResult.areaSqFt;
        areaSqMeters = areaResult.areaSqMeters;
        perimeterFt = areaResult.perimeterFt;
        perimeterMeters = areaResult.perimeterMeters;
        landUnits = areaResult.landUnits;
      }
    }
  } else if (validPoints.length >= 3) {
    const areaResult = calculatePolygonArea(validPoints);
    if (areaResult.isValid) {
      areaSqFt = areaResult.areaSqFt;
      areaSqMeters = areaResult.areaSqMeters;
      perimeterFt = areaResult.perimeterFt;
      perimeterMeters = areaResult.perimeterMeters;
      landUnits = areaResult.landUnits;
    }
  }

  // Calculate GPS accuracy statistics
  const accuracyStats = calculateAccuracyStats(validPoints);

  const reportId = `rep-${Date.now()}`;
  const reportNumber = generateReportNumber(now);

  const dagNo = survey.dagNo || (survey.plots && survey.plots.length > 0
    ? survey.plots.map((p) => p.dagNo).filter(Boolean).join(', ')
    : '');

  const newReport: SurveyReportRecord = {
    id: reportId,
    reportNumber,
    surveyId: survey.id,
    status: 'draft',
    title: survey.title
      ? `${survey.title} — ডিজিটাল ভূমি পরিমাপ প্রতিবেদন`
      : 'ডিজিটাল ভূমি পরিমাপ প্রতিবেদন',
    reportDate: todayStr,
    surveyDate: survey.date || todayStr,

    clientName: survey.clientName || 'জমি মালিক / আবেদনকারী',
    clientPhone: '',
    district: survey.district || 'ঢাকা',
    upazila: survey.upazila || '',
    union: survey.union || '',
    mouza: survey.mouza || '',
    jlNo: survey.jlNo || '',
    dagNo,
    khatianNo: survey.khatianNo || '',
    landClass: 'নাল / ধানি',
    surveyorName: survey.surveyorName || 'মেহেদী হাসান বাবু (সনদপ্রাপ্ত আমিন)',
    notes:
      survey.notes ||
      (survey.plots && survey.plots.length > 0
        ? 'সরজমিনে পক্ষগণের উপস্থিতিতে ফিতা/টেপ পরিমাপের সাহায্যে বাস্তব সীমানা ও দখল জরিপ সম্পন্ন হয়েছে।'
        : 'সরজমিনে মোবাইল জিপিএস যন্ত্রের সাহায্যে চিহ্নিত সীমানা আইল পরিমাপ সম্পন্ন হয়েছে।'),
    drawingNotes:
      survey.plots && survey.plots.length > 0
        ? 'উক্ত নকশা বাস্তব দখল অনুযায়ী উত্তরমুখী আনুপাতিক স্কেচে প্রস্তুত। মাঠের প্রতিবন্ধকতার কারণে গড় পদ্ধতিতে প্রস্তুতকৃত আনুমানিক নকশা ও ক্ষেত্রফল।'
        : 'উক্ত নকশা সরজমিনে আমিন ও উপস্থিত পক্ষগণের উপস্থিতিতে চিহ্নিত সীমানা অনুযায়ী উত্তরমুখী আনুপাতিক স্কেলে অঙ্কিত হইয়াছে।',

    points: survey.points || [],
    areaSqFt: roundClean(areaSqFt, 2),
    areaSqMeters: roundClean(areaSqMeters, 2),
    perimeterFt: roundClean(perimeterFt, 2),
    perimeterMeters: roundClean(perimeterMeters, 2),
    decimal: roundClean(landUnits.shatangsha, 3),
    katha: roundClean(landUnits.katha, 3),
    bigha: roundClean(landUnits.bigha, 3),
    acre: roundClean(landUnits.acre, 4),

    avgAccuracy: accuracyStats && accuracyStats.averageAccuracy > 0 ? roundClean(accuracyStats.averageAccuracy, 1) : undefined,
    bestAccuracy: accuracyStats && accuracyStats.bestAccuracy > 0 ? roundClean(accuracyStats.bestAccuracy, 1) : undefined,
    worstAccuracy: accuracyStats && accuracyStats.worstAccuracy > 0 ? roundClean(accuracyStats.worstAccuracy, 1) : undefined,

    annotations: survey.annotations || [],
    plots: survey.plots || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),

    // Phase 8 & Phase 2 Cloud & Multi-device Chain Integration
    ownerId: survey.ownerId,
    bookingId: survey.bookingId,
    customerId: survey.customerId,
    aminId: survey.aminId,
    surveyRecordId: survey.id,
    pentagraphProjectId: getStoredPentagraphProjects().find(
      (p) =>
        (p.surveyId && p.surveyId === survey.id) ||
        (survey.bookingId && p.bookingId === survey.bookingId)
    )?.id,

    ...overrides,
  };

  // Phase 16B: Check if there is an existing matching Google Maps Parcel
  try {
    const parcels = getStoredParcels();
    const matchedParcel = parcels.find(
      (p) =>
        (survey.dagNo && p.dagNo === survey.dagNo) ||
        (survey.mouza && p.mouza === survey.mouza) ||
        (p.points && p.points.length === survey.points.length)
    );
    if (matchedParcel && !newReport.googleMapsParcel) {
      newReport.googleMapsParcel = {
        parcelId: matchedParcel.id,
        title: matchedParcel.title || 'গুগল ম্যাপস পার্সেল সীমানা',
        pointsCount: matchedParcel.points.length,
        areaDecimal: roundClean(matchedParcel.shatangsha, 3),
        areaSqFt: roundClean(matchedParcel.areaSqFt, 1),
        perimeterFt: roundClean(matchedParcel.perimeterFeet, 1),
        source:
          matchedParcel.source === 'google_maps_manual'
            ? 'Google Maps স্যাটেলাইট ডিজিটাইজেশন'
            : 'জিপিএস মাঠ জরিপ হতে আমদানিকৃত',
        coordinates: matchedParcel.points.map((pt) => ({
          label: pt.label,
          lat: pt.lat,
          lng: pt.lng,
        })),
      };
    }
  } catch {
    // Ignore if localStorage unavailable
  }

  // Phase 16B: Check if there is an existing Pentagraph Comparative project
  try {
    const compProjects = getStoredPentagraphProjects();
    const matchedProject = compProjects.find(
      (proj) =>
        proj.surveyId === survey.id ||
        (survey.dagNo && proj.dagId === survey.dagNo)
    );
    if (matchedProject && matchedProject.metrics && !newReport.mapComparison) {
      newReport.mapComparison = {
        mouzaMapTitle: matchedProject.title || 'মৌজা নকশা বনাম জিপিএস',
        dagNo: survey.dagNo || '—',
        mapAreaDecimal: roundClean(matchedProject.metrics.mapAreaDecimal, 3),
        gpsAreaDecimal: roundClean(matchedProject.metrics.gpsAreaDecimal, 3),
        diffDecimal: roundClean(matchedProject.metrics.diffDecimal, 3),
        variancePercent: roundClean(matchedProject.metrics.percentageVariance, 2),
        matchGrade: matchedProject.metrics.matchGrade,
        notes: matchedProject.notes,
      };
    }
  } catch {
    // Ignore if localStorage unavailable
  }

  return newReport;
}
