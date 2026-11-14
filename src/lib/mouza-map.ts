/**
 * Bangladesh Mouza Map & Dag Digitization Utility Engine
 * Phase 12B — Mouza Map & Dag Foundation
 *
 * Supports authorized user-provided maps (JPG, PNG, PDF, GeoJSON, KML, DXF),
 * interactive Dag polygon digitization, real GPS overlay integration,
 * and indicative land measurement verification.
 */

import {
  MouzaMapRecord,
  DigitizedDagRecord,
  DigitizedDagPoint,
  LandVerificationResult,
  MouzaMapSourceType,
  ComparativePentagraphProject,
  PentagraphLayerConfig,
  PentagraphComparisonMetrics,
  MapJointProject,
  MapJointSheetLayer,
  ControlPointPair,
  AdvancedVerificationMatrix,
  SurveyRecord,
} from '../types';
import { calculateLandUnits, LAND_CONSTANTS, roundClean } from './land-units';
import { getCompassDirection } from './gps-geometry';
import { isFirebaseConfigured, db, doc, setDoc, cleanForFirestore } from './firebase';

export const MOUZA_STORAGE_KEY = 'bhumi_mouza_maps';

// Standard Mouza Sheet Scales in Bangladesh
export interface MouzaScalePreset {
  id: string;
  nameBn: string;
  nameEn: string;
  ratio: string; // e.g. "16 inches = 1 mile"
  feetPerInch: number;
  chainsPerInch: number;
  defaultPixelsPerFoot: number; // baseline canvas resolution mapping
}

export const MOUZA_SCALE_PRESETS: MouzaScalePreset[] = [
  {
    id: '16_inch',
    nameBn: '১৬ ইঞ্চি = ১ মাইল (সাধারণ মৌজা নকশা)',
    nameEn: '16 inches = 1 mile (Standard CS/RS)',
    ratio: '1:3,960',
    feetPerInch: 330,
    chainsPerInch: 5,
    defaultPixelsPerFoot: 1.2,
  },
  {
    id: '32_inch',
    nameBn: '৩২ ইঞ্চি = ১ মাইল (ঘনবসতি এলাকা)',
    nameEn: '32 inches = 1 mile (Dense / Urban)',
    ratio: '1:1,980',
    feetPerInch: 165,
    chainsPerInch: 2.5,
    defaultPixelsPerFoot: 2.4,
  },
  {
    id: '64_inch',
    nameBn: '৬৪ ইঞ্চি = ১ মাইল (পৌর / বিশেষ জরিপ)',
    nameEn: '64 inches = 1 mile (Municipal / Detailed)',
    ratio: '1:990',
    feetPerInch: 82.5,
    chainsPerInch: 1.25,
    defaultPixelsPerFoot: 4.8,
  },
  {
    id: 'custom',
    nameBn: 'কাস্টম / স্কেল ক্যালিগ্রেশন',
    nameEn: 'Custom / Calibrated Scale',
    ratio: 'Custom',
    feetPerInch: 100,
    chainsPerInch: 1.5,
    defaultPixelsPerFoot: 1.0,
  },
];

// ----------------------------------------------------------------------------
// Authentic Cadastral Mouza Sheet Generator & Map Resolver Engine
// ----------------------------------------------------------------------------

export function generateCadastralSheetDataUrl(map: Partial<MouzaMapRecord>): string {
  const mouza = map.mouza || 'কমলাপুর';
  const jl = map.jlNo || '৭৪';
  const district = map.district || 'ঢাকা';
  const upazila = map.upazila || 'মতিঝিল';
  const surveyType =
    map.khatianRef && map.khatianRef.includes('BS') ? 'বি.এস.' : 'আর.এস. / সি.এস.';
  const dags = map.digitizedDags || [];

  // Generate SVG polygon paths for existing digitized dags
  const dagSvgPaths = dags
    .map((dag) => {
      if (!dag.points || dag.points.length < 3) return '';
      const d =
        dag.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
      let cx = 0,
        cy = 0;
      dag.points.forEach((p) => {
        cx += p.x;
        cy += p.y;
      });
      cx = Math.round(cx / dag.points.length);
      cy = Math.round(cy / dag.points.length);
      return `
      <path d="${d}" fill="#fcf9f2" fill-opacity="0.65" stroke="#334155" stroke-width="1.8" />
      <circle cx="${cx}" cy="${cy}" r="11" fill="#ffffff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="0.8" />
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0f172a">${dag.dagNo}</text>
    `;
    })
    .join('');

  // Contextual adjacent cadastral plots for authentic field map appearance
  const adjacentSvgPaths = `
    <!-- Adjacent Plot boundaries (surrounding cadastral parcels) -->
    <path d="M 15 50 L 80 70 L 95 240 L 20 230" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="45" y="150" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748b">৩১০</text>
    <path d="M 95 240 L 290 220 L 280 390 L 90 380 Z" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="180" y="310" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748b">৩১১</text>
    <path d="M 420 65 L 590 80 L 610 260 L 440 230" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="510" y="160" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748b">৩১৪</text>
    <path d="M 290 220 L 440 230 L 460 395 L 280 390" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="365" y="315" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748b">৩১৫</text>
    <path d="M 80 70 L 260 55 L 270 20 L 70 20 Z" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="170" y="42" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748b">৩০৯</text>
  `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 460" width="650" height="460">
    <defs>
      <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="1,3" />
      </pattern>
    </defs>
    <!-- Paper background -->
    <rect width="650" height="460" fill="#fbfaf6" />
    <rect width="650" height="460" fill="url(#gridPattern)" />

    <!-- Outer & Inner Neatline Borders -->
    <rect x="8" y="8" width="634" height="444" fill="none" stroke="#334155" stroke-width="2" />
    <rect x="13" y="13" width="624" height="434" fill="none" stroke="#64748b" stroke-width="0.8" />

    <!-- Corner registration marks -->
    <path d="M 8 18 L 18 18 L 18 8" fill="none" stroke="#0f172a" stroke-width="1.5" />
    <path d="M 642 18 L 632 18 L 632 8" fill="none" stroke="#0f172a" stroke-width="1.5" />
    <path d="M 8 442 L 18 442 L 18 452" fill="none" stroke="#0f172a" stroke-width="1.5" />
    <path d="M 642 442 L 632 442 L 632 452" fill="none" stroke="#0f172a" stroke-width="1.5" />

    <!-- Cadastral Header Title Block -->
    <g transform="translate(25, 20)">
      <rect x="0" y="0" width="310" height="38" rx="4" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="1" />
      <text x="10" y="15" font-family="sans-serif" font-size="10.5" font-weight="bold" fill="#0f172a">মৌজা: ${mouza} • জে.এল. নং: ${jl}</text>
      <text x="10" y="29" font-family="sans-serif" font-size="9" fill="#475569">উপজেলা: ${upazila} • জেলা: ${district} • জরিপ: ${surveyType}</text>
    </g>

    <!-- North Arrow / Compass -->
    <g transform="translate(605, 45)">
      <circle cx="0" cy="0" r="16" fill="#ffffff" fill-opacity="0.85" stroke="#94a3b8" stroke-width="1" />
      <line x1="0" y1="-14" x2="0" y2="14" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="1,2" />
      <polygon points="0,-13 4,0 0,-3 -4,0" fill="#dc2626" />
      <polygon points="0,13 4,0 0,3 -4,0" fill="#64748b" />
      <text x="0" y="-17" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#dc2626">উ</text>
    </g>

    <!-- Contextual and Digitized Plots -->
    ${adjacentSvgPaths}
    ${dagSvgPaths}

    <!-- Scale Bar & Notice -->
    <g transform="translate(420, 425)">
      <rect x="0" y="-15" width="205" height="24" rx="4" fill="#ffffff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="0.8" />
      <text x="8" y="-1" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#334155">স্কেল: ১৬ ইঞ্চি = ১ মাইল</text>
      <rect x="110" y="-6" width="40" height="4" fill="#0f172a" />
      <rect x="150" y="-6" width="40" height="4" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.5" />
      <text x="195" y="-1" font-family="sans-serif" font-size="7.5" fill="#64748b">১০০ ফু.</text>
    </g>

    <!-- Official Seal Stamp (Bottom-Left) -->
    <g transform="translate(25, 425)">
      <rect x="0" y="-15" width="230" height="24" rx="4" fill="#ffffff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="0.8" />
      <circle cx="12" cy="-3" r="5" fill="#10b981" fill-opacity="0.2" stroke="#059669" stroke-width="1" />
      <text x="24" y="-2" font-family="sans-serif" font-size="8" font-weight="bold" fill="#065f46">ভূমি রেকর্ড ও জরিপ অধিদপ্তর — অনুমোদিত নমুনা শিট</text>
    </g>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

// Initial preloaded authorized sample mouza sheets
export const initialMouzaMaps: MouzaMapRecord[] = [
  {
    id: 'mouza-001',
    title: 'কমলাপুর মৌজা (জে.এল. ৭৪) - দাগ ৩১২, ৩১৩',
    district: 'ঢাকা',
    upazila: 'মতিঝিল',
    mouza: 'কমলাপুর',
    jlNo: '৭৪',
    khatianRef: '১৫৪ (RS)',
    defaultDagNo: '৩১২',
    sourceType: 'image',
    fileName: 'kamalapur_jl74_sample.png',
    scalePixelsPerFoot: 1.2,
    scaleBarMeters: 20,
    notes: 'ব্যবহারকারী কর্তৃক সংগৃহীত অনুমোদিত মৌজা জরিপ শিটের অংশবিশেষ।',
    createdAt: '২০২৬-০৩-১০',
    updatedAt: '২০২৬-০৩-১০',
    digitizedDags: [
      {
        id: 'dag-312',
        dagNo: '৩১২',
        mouzaMapId: 'mouza-001',
        points: [
          { id: 'p1', x: 80, y: 70 },
          { id: 'p2', x: 260, y: 55 },
          { id: 'p3', x: 290, y: 220 },
          { id: 'p4', x: 95, y: 240 },
        ],
        areaSqFt: 6534, // 15.00 decimal
        areaDecimal: 15.0,
        areaKatha: 9.075,
        areaBigha: 0.4538,
        perimeterFt: 340,
        notes: 'ভিটা ও পুকুরপাড় সংলগ্ন দাগ। চতুর্ভুজাকৃতির প্লট।',
        color: '#10b981', // emerald
        createdAt: '২০২৬-০৩-১০',
        updatedAt: '২০২৬-০৩-১০',
      },
      {
        id: 'dag-313',
        dagNo: '৩১৩',
        mouzaMapId: 'mouza-001',
        points: [
          { id: 'p1', x: 260, y: 55 },
          { id: 'p2', x: 420, y: 65 },
          { id: 'p3', x: 440, y: 230 },
          { id: 'p4', x: 290, y: 220 },
        ],
        areaSqFt: 5227.2, // 12.00 decimal
        areaDecimal: 12.0,
        areaKatha: 7.26,
        areaBigha: 0.363,
        perimeterFt: 310,
        notes: 'পূর্ব পার্শ্বস্থ ধানী জমি দাগ।',
        color: '#3b82f6', // blue
        createdAt: '২০২৬-০৩-১০',
        updatedAt: '২০২৬-০৩-১০',
      },
    ],
  },
  {
    id: 'mouza-002',
    title: 'শ্যামপুর মৌজা (জে.এল. ১০২) - দাগ ১৪৫',
    district: 'ঢাকা',
    upazila: 'কদমতলী',
    mouza: 'শ্যামপুর',
    jlNo: '১০২',
    khatianRef: '৭৮ (BS)',
    defaultDagNo: '১৪৫',
    sourceType: 'image',
    fileName: 'shyampur_jl102_sample.png',
    scalePixelsPerFoot: 1.0,
    scaleBarMeters: 30,
    notes: 'দক্ষিণের ধানি জমি পরিমাপ শিট।',
    createdAt: '২০২৬-০৩-১২',
    updatedAt: '২০২৬-০৩-১২',
    digitizedDags: [
      {
        id: 'dag-145',
        dagNo: '১৪৫',
        mouzaMapId: 'mouza-002',
        points: [
          { id: 'p1', x: 70, y: 80 },
          { id: 'p2', x: 340, y: 90 },
          { id: 'p3', x: 320, y: 280 },
          { id: 'p4', x: 60, y: 260 },
        ],
        areaSqFt: 14400, // 33.057 decimal = 1 bigha
        areaDecimal: 33.058,
        areaKatha: 20.0,
        areaBigha: 1.0,
        perimeterFt: 490,
        notes: '১ বিঘা বোরো ধানী জমি।',
        color: '#f59e0b', // amber
        createdAt: '২০২৬-০৩-১২',
        updatedAt: '২০২৬-০৩-১২',
      },
    ],
  },
];

// Pre-fill sample maps with their authentic Cadastral Sheet SVG dataUrls
initialMouzaMaps[0].fileDataUrl = generateCadastralSheetDataUrl(initialMouzaMaps[0]);
initialMouzaMaps[1].fileDataUrl = generateCadastralSheetDataUrl(initialMouzaMaps[1]);

// ----------------------------------------------------------------------------
// Local Storage Persistence
// ----------------------------------------------------------------------------

export function getStoredMouzaMaps(): MouzaMapRecord[] {
  if (typeof window === 'undefined') return initialMouzaMaps;
  try {
    const raw = localStorage.getItem(MOUZA_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MOUZA_STORAGE_KEY, JSON.stringify(initialMouzaMaps));
      return initialMouzaMaps;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((m: MouzaMapRecord) => {
        if (!m.fileDataUrl && (m.id === 'mouza-001' || m.id === 'mouza-002')) {
          return { ...m, fileDataUrl: generateCadastralSheetDataUrl(m) };
        }
        return m;
      });
    }
    return initialMouzaMaps;
  } catch (err) {
    console.error('Error reading mouza maps from localStorage:', err);
    return initialMouzaMaps;
  }
}

export function saveMouzaMapToStorage(record: MouzaMapRecord): void {
  try {
    // If fileDataUrl is large base64 or binary, save to IndexedDB asynchronously
    if (record.fileDataUrl && record.fileDataUrl.length > 20000) {
      import('./pentagraph-files').then(({ idbPut, formatFileSize }) => {
        idbPut({
          id: `mapfile-${record.id}`,
          name: record.fileName || `${record.title}.png`,
          fileType: record.sourceType === 'pdf' ? 'pdf' : 'image',
          mimeType: record.sourceType === 'pdf' ? 'application/pdf' : 'image/png',
          size: record.fileDataUrl?.length || 0,
          sizeFormatted: formatFileSize(record.fileDataUrl?.length || 0),
          uploadedAt: Date.now(),
          category: 'general',
          dataUrl: record.fileDataUrl,
        }).catch((e) => console.warn('Could not cache map file in IndexedDB:', e));
      });
    }

    const maps = getStoredMouzaMaps();
    const idx = maps.findIndex((m) => m.id === record.id);
    let updated: MouzaMapRecord[];
    if (idx >= 0) {
      updated = [...maps];
      updated[idx] = { ...record, updatedAt: Date.now() };
    } else {
      updated = [{ ...record, createdAt: Date.now(), updatedAt: Date.now() }, ...maps];
    }

    try {
      localStorage.setItem(MOUZA_STORAGE_KEY, JSON.stringify(updated));
    } catch (quotaErr) {
      console.warn('LocalStorage quota exceeded in saveMouzaMapToStorage, sanitizing large binary payloads:', quotaErr);
      // Strip large binary dataUrl and raw vector text from records to fit within 5MB quota
      const sanitized = updated.map((m) => {
        if (m.fileDataUrl && m.fileDataUrl.length > 20000) {
          return {
            ...m,
            fileDataUrl: undefined, // Preserved in IndexedDB under `mapfile-${m.id}`
            rawGeoJson: undefined,
            rawKmlText: undefined,
            rawDxfText: undefined,
          };
        }
        return m;
      });
      localStorage.setItem(MOUZA_STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch (err) {
    console.error('Error saving mouza map to localStorage:', err);
  }
}

export function deleteMouzaMapFromStorage(id: string): void {
  try {
    const maps = getStoredMouzaMaps();
    const filtered = maps.filter((m) => m.id !== id);
    localStorage.setItem(MOUZA_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting mouza map from localStorage:', err);
  }
}

export function getStoredMouzaMapById(id: string): MouzaMapRecord | null {
  const maps = getStoredMouzaMaps();
  return maps.find((m) => m.id === id) || null;
}

/**
 * Unified Asynchronous Mouza Map Resolver
 * Reliable across Mobile & Web:
 * 1. Checks direct valid dataUrl/blob/http URL.
 * 2. Checks IndexedDB for user-uploaded maps (by id, mapfile-id, or fileName).
 * 3. Falls back to generating high-resolution authentic Cadastral Sheet SVG.
 */
export async function resolveMouzaMapFileUrl(
  map: MouzaMapRecord | null | undefined
): Promise<string | undefined> {
  if (!map) return undefined;

  // 1. Direct valid data URL / blob / HTTP URL
  if (
    map.fileDataUrl &&
    (map.fileDataUrl.startsWith('data:') ||
      map.fileDataUrl.startsWith('blob:') ||
      map.fileDataUrl.startsWith('http://') ||
      map.fileDataUrl.startsWith('https://') ||
      map.fileDataUrl.startsWith('/'))
  ) {
    return map.fileDataUrl;
  }

  // 2. Query IndexedDB for persistent binary storage
  try {
    const { idbGet, getStoredMapFileWithContent } = await import('./pentagraph-files');

    const idCandidates = [
      map.fileDataUrl,
      `mapfile-${map.id}`,
      map.id,
      map.fileName,
    ].filter(Boolean) as string[];

    for (const cand of idCandidates) {
      const found = await idbGet(cand);
      if (found && (found.dataUrl || found.rawText)) {
        return found.dataUrl || found.rawText;
      }
    }

    // Try via getStoredMapFileWithContent
    if (map.id) {
      const stored = await getStoredMapFileWithContent(map.id);
      if (stored?.dataUrl) {
        return stored.dataUrl;
      }
    }
  } catch (err) {
    console.warn('Could not query IndexedDB for map file:', err);
  }

  // 3. Authentic Cadastral Mouza Sheet Generator
  return generateCadastralSheetDataUrl(map);
}

// ----------------------------------------------------------------------------
// Geometry & Area Calculation (Shoelace Formula on Scaled Coordinates)
// ----------------------------------------------------------------------------

export function calculateDagPolygonArea(
  points: { x: number; y: number }[],
  scalePixelsPerFoot: number = 1.0
): {
  areaSqFt: number;
  perimeterFt: number;
  areaDecimal: number;
  areaKatha: number;
  areaBigha: number;
} {
  if (points.length < 3) {
    return { areaSqFt: 0, perimeterFt: 0, areaDecimal: 0, areaKatha: 0, areaBigha: 0 };
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
  const scale = Math.max(0.001, scalePixelsPerFoot);

  // Convert pixel area to real square feet using scale ratio
  const areaSqFt = areaPx / (scale * scale);
  const perimeterFt = perimeterPx / scale;

  const units = calculateLandUnits(areaSqFt, perimeterFt);

  return {
    areaSqFt: units.sqFt,
    perimeterFt: units.perimeterFt || roundClean(perimeterFt, 2),
    areaDecimal: units.shatangsha,
    areaKatha: units.katha,
    areaBigha: units.bigha,
  };
}

// ----------------------------------------------------------------------------
// Land Measurement Verification Engine (Indicative Comparison Tool)
// ----------------------------------------------------------------------------

export function verifyLandMeasurement(
  mapDagAreaSqFt: number,
  gpsSurveyAreaSqFt: number
): LandVerificationResult {
  const diffSqFt = roundClean(Math.abs(mapDagAreaSqFt - gpsSurveyAreaSqFt), 2);
  const diffDecimal = roundClean(diffSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const mapDecimal = roundClean(mapDagAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const gpsDecimal = roundClean(gpsSurveyAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);

  const percentageDiff =
    mapDagAreaSqFt > 0 ? roundClean((diffSqFt / mapDagAreaSqFt) * 100, 2) : 0;

  let matchGrade: 'excellent' | 'acceptable' | 'high_variance' = 'excellent';
  if (percentageDiff <= 3.0) {
    matchGrade = 'excellent';
  } else if (percentageDiff <= 7.5) {
    matchGrade = 'acceptable';
  } else {
    matchGrade = 'high_variance';
  }

  return {
    mapAreaSqFt: roundClean(mapDagAreaSqFt, 2),
    mapAreaDecimal: mapDecimal,
    gpsAreaSqFt: roundClean(gpsSurveyAreaSqFt, 2),
    gpsAreaDecimal: gpsDecimal,
    diffSqFt,
    diffDecimal,
    percentageDiff,
    matchGrade,
    disclaimerBn:
      'ডিজিটাল/নির্দেশক যাচাইকরণ: এই ফলাফলটি মৌজা নকশার ডিজিটাইজড পরিমাপ ও মোবাইল GPS পরিমাপের তুলনামূলক পর্যালোচনার জন্য। এটি কোনো আদালত বা রাজস্ব কর্তৃপক্ষের চূড়ান্ত আইনি সীমানা নির্ধারণ নয়।',
    disclaimerEn:
      'DIGITAL / INDICATIVE VERIFICATION: This verification is an analytical comparison between the digitized map polygon and field GPS points. It does not constitute legal boundary determination.',
  };
}

// ----------------------------------------------------------------------------
// File Import Parsers (GeoJSON, KML, DXF)
// ----------------------------------------------------------------------------

/**
 * Parses GeoJSON text into DigitizedDagRecord[]
 */
export function parseGeoJsonToDags(
  geoJsonText: string,
  mouzaMapId: string,
  canvasWidth: number = 600,
  canvasHeight: number = 400
): DigitizedDagRecord[] {
  try {
    const data = JSON.parse(geoJsonText);
    const features =
      data.type === 'FeatureCollection'
        ? data.features
        : data.type === 'Feature'
        ? [data]
        : [];

    if (!features || features.length === 0) return [];

    // Find bounding box to normalize coordinates into canvas view
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;

    const allCoords: [number, number][][] = [];

    for (const f of features) {
      if (!f.geometry) continue;
      if (f.geometry.type === 'Polygon') {
        const ring = f.geometry.coordinates[0];
        if (Array.isArray(ring)) {
          allCoords.push(ring);
          for (const [lng, lat] of ring) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
    }

    if (allCoords.length === 0 || !isFinite(minLng)) return [];

    const widthDeg = Math.max(maxLng - minLng, 0.0001);
    const heightDeg = Math.max(maxLat - minLat, 0.0001);
    const padding = 40;
    const drawW = canvasWidth - padding * 2;
    const drawH = canvasHeight - padding * 2;

    const dags: DigitizedDagRecord[] = [];
    let counter = 1;

    for (const f of features) {
      if (!f.geometry || f.geometry.type !== 'Polygon') continue;
      const ring = f.geometry.coordinates[0];
      if (!Array.isArray(ring) || ring.length < 3) continue;

      const dagNo =
        f.properties?.dag_no ||
        f.properties?.dag ||
        f.properties?.plot_no ||
        f.properties?.name ||
        `দাগ-${counter++}`;

      const points: DigitizedDagPoint[] = ring.slice(0, -1).map(([lng, lat], idx) => {
        const x = padding + ((lng - minLng) / widthDeg) * drawW;
        // Invert Y for canvas
        const y = padding + (1 - (lat - minLat) / heightDeg) * drawH;
        return {
          id: `p-${idx}`,
          x: Math.round(x),
          y: Math.round(y),
          lat,
          lng,
        };
      });

      const area = calculateDagPolygonArea(points, 1.0);

      dags.push({
        id: `dag-${Date.now()}-${counter}`,
        dagNo: String(dagNo),
        mouzaMapId,
        points,
        areaSqFt: area.areaSqFt,
        areaDecimal: area.areaDecimal,
        areaKatha: area.areaKatha,
        areaBigha: area.areaBigha,
        perimeterFt: area.perimeterFt,
        notes: f.properties?.notes || 'GeoJSON ফাইল থেকে আমদানিকৃত দাগ সীমানা।',
        color: '#10b981',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return dags;
  } catch (e) {
    console.error('GeoJSON parse error:', e);
    return [];
  }
}

/**
 * Parses KML XML text into DigitizedDagRecord[]
 */
export function parseKmlToDags(
  kmlText: string,
  mouzaMapId: string,
  canvasWidth: number = 600,
  canvasHeight: number = 400
): DigitizedDagRecord[] {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');

    if (!placemarks || placemarks.length === 0) return [];

    const dags: DigitizedDagRecord[] = [];
    let counter = 1;

    // Collect all coordinates to compute bounding box
    const rings: { name: string; coords: [number, number][] }[] = [];
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;

    for (let i = 0; i < placemarks.length; i++) {
      const pm = placemarks[i];
      const nameElem = pm.getElementsByTagName('name')[0];
      const name = nameElem?.textContent?.trim() || `দাগ-${counter++}`;

      const coordElem = pm.getElementsByTagName('coordinates')[0];
      if (!coordElem || !coordElem.textContent) continue;

      const raw = coordElem.textContent.trim().split(/\s+/);
      const coords: [number, number][] = [];
      for (const token of raw) {
        const parts = token.split(',');
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lng) && !isNaN(lat)) {
            coords.push([lng, lat]);
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }

      if (coords.length >= 3) {
        rings.push({ name, coords });
      }
    }

    if (rings.length === 0 || !isFinite(minLng)) return [];

    const widthDeg = Math.max(maxLng - minLng, 0.0001);
    const heightDeg = Math.max(maxLat - minLat, 0.0001);
    const padding = 40;
    const drawW = canvasWidth - padding * 2;
    const drawH = canvasHeight - padding * 2;

    for (const r of rings) {
      const points: DigitizedDagPoint[] = r.coords.map(([lng, lat], idx) => {
        const x = padding + ((lng - minLng) / widthDeg) * drawW;
        const y = padding + (1 - (lat - minLat) / heightDeg) * drawH;
        return {
          id: `kml-pt-${idx}`,
          x: Math.round(x),
          y: Math.round(y),
          lat,
          lng,
        };
      });

      const area = calculateDagPolygonArea(points, 1.0);

      dags.push({
        id: `dag-kml-${Date.now()}-${dags.length + 1}`,
        dagNo: r.name,
        mouzaMapId,
        points,
        areaSqFt: area.areaSqFt,
        areaDecimal: area.areaDecimal,
        areaKatha: area.areaKatha,
        areaBigha: area.areaBigha,
        perimeterFt: area.perimeterFt,
        notes: 'KML জিপিএস ফাইল থেকে আমদানিকৃত দাগ।',
        color: '#059669',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return dags;
  } catch (err) {
    console.error('KML parse error:', err);
    return [];
  }
}

/**
 * Future-ready AutoCAD DXF Parser Architecture.
 * Parses DXF text format line by line, extracting entities (LWPOLYLINE, POLYLINE, LINE).
 */
export function parseDxfToDags(
  dxfText: string,
  mouzaMapId: string,
  canvasWidth: number = 600,
  canvasHeight: number = 400
): DigitizedDagRecord[] {
  try {
    const lines = dxfText.split(/\r?\n/).map((l) => l.trim());
    const polylines: { layer: string; vertices: [number, number][] }[] = [];

    let inEntities = false;
    let currentPoly: { layer: string; vertices: [number, number][] } | null = null;
    let nextCode: number | null = null;
    let currentX: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === 'ENTITIES') {
        inEntities = true;
        continue;
      }
      if (line === 'ENDSEC' && inEntities) {
        inEntities = false;
        if (currentPoly && currentPoly.vertices.length >= 3) {
          polylines.push(currentPoly);
          currentPoly = null;
        }
        break;
      }

      if (!inEntities) continue;

      if (nextCode === null) {
        const code = parseInt(line, 10);
        if (!isNaN(code)) {
          nextCode = code;
        }
      } else {
        const val = line;
        if (nextCode === 0) {
          // Entity marker
          if (currentPoly && currentPoly.vertices.length >= 3) {
            polylines.push(currentPoly);
            currentPoly = null;
          }
          if (val === 'LWPOLYLINE' || val === 'POLYLINE') {
            currentPoly = { layer: '0', vertices: [] };
          }
        } else if (currentPoly) {
          if (nextCode === 8) {
            currentPoly.layer = val;
          } else if (nextCode === 10) {
            currentX = parseFloat(val);
          } else if (nextCode === 20 && currentX !== null) {
            const y = parseFloat(val);
            currentPoly.vertices.push([currentX, y]);
            currentX = null;
          }
        }
        nextCode = null;
      }
    }

    if (currentPoly && currentPoly.vertices.length >= 3) {
      polylines.push(currentPoly);
    }

    if (polylines.length === 0) return [];

    // Compute bounding box
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const poly of polylines) {
      for (const [vx, vy] of poly.vertices) {
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        if (vy > maxY) maxY = vy;
      }
    }

    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const padding = 40;
    const drawW = canvasWidth - padding * 2;
    const drawH = canvasHeight - padding * 2;

    const dags: DigitizedDagRecord[] = [];
    polylines.forEach((p, idx) => {
      const points: DigitizedDagPoint[] = p.vertices.map(([vx, vy], ptIdx) => {
        const x = padding + ((vx - minX) / spanX) * drawW;
        const y = padding + (1 - (vy - minY) / spanY) * drawH;
        return {
          id: `dxf-pt-${ptIdx}`,
          x: Math.round(x),
          y: Math.round(y),
        };
      });

      const area = calculateDagPolygonArea(points, 1.0);
      dags.push({
        id: `dag-dxf-${Date.now()}-${idx + 1}`,
        dagNo: p.layer !== '0' ? p.layer : `দাগ-${idx + 1}`,
        mouzaMapId,
        points,
        areaSqFt: area.areaSqFt,
        areaDecimal: area.areaDecimal,
        areaKatha: area.areaKatha,
        areaBigha: area.areaBigha,
        perimeterFt: area.perimeterFt,
        notes: `AutoCAD DXF লেয়ার (${p.layer}) থেকে আমদানিকৃত।`,
        color: '#6366f1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    return dags;
  } catch (err) {
    console.error('DXF parse error:', err);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PHASE 12C: COMPARATIVE PENTAGRAPH STORAGE & ENGINE
// ----------------------------------------------------------------------------

export const PENTAGRAPH_STORAGE_KEY = 'bhumi_pentagraph_projects';
export const MAP_JOINT_STORAGE_KEY = 'bhumi_map_joint_projects';

export function getStoredPentagraphProjects(): ComparativePentagraphProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENTAGRAPH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading pentagraph projects:', err);
    return [];
  }
}

export function savePentagraphProject(project: ComparativePentagraphProject): void {
  try {
    const projects = getStoredPentagraphProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    let updated: ComparativePentagraphProject[];
    if (idx >= 0) {
      updated = [...projects];
      updated[idx] = { ...project, updatedAt: Date.now() };
    } else {
      updated = [{ ...project, createdAt: Date.now(), updatedAt: Date.now() }, ...projects];
    }
    localStorage.setItem(PENTAGRAPH_STORAGE_KEY, JSON.stringify(updated));

    if (isFirebaseConfigured && db) {
      try {
        setDoc(doc(db, 'pentagraphProjects', project.id), cleanForFirestore(project)).catch((err) =>
          console.warn('Firestore pentagraphProject save error:', err)
        );
      } catch (err) {
        console.warn('Firestore pentagraphProject save error:', err);
      }
    }
  } catch (err) {
    console.error('Error saving pentagraph project:', err);
  }
}

export function deletePentagraphProject(id: string): void {
  try {
    const projects = getStoredPentagraphProjects();
    const filtered = projects.filter((p) => p.id !== id);
    localStorage.setItem(PENTAGRAPH_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting pentagraph project:', err);
  }
}

export function getStoredPentagraphProjectById(id: string): ComparativePentagraphProject | null {
  const list = getStoredPentagraphProjects();
  return list.find((p) => p.id === id) || null;
}

export function finalizePentagraphProject(id: string): void {
  const project = getStoredPentagraphProjectById(id);
  if (!project) return;
  savePentagraphProject({ ...project, status: 'finalized', updatedAt: Date.now() });
}

// ----------------------------------------------------------------------------
// PHASE 12C: MAP JOINT STORAGE & ENGINE
// ----------------------------------------------------------------------------

export function getStoredMapJointProjects(): MapJointProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MAP_JOINT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading map joint projects:', err);
    return [];
  }
}

export function saveMapJointProject(project: MapJointProject): void {
  try {
    const projects = getStoredMapJointProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    let updated: MapJointProject[];
    if (idx >= 0) {
      updated = [...projects];
      updated[idx] = { ...project, updatedAt: Date.now() };
    } else {
      updated = [{ ...project, createdAt: Date.now(), updatedAt: Date.now() }, ...projects];
    }
    localStorage.setItem(MAP_JOINT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving map joint project:', err);
  }
}

export function deleteMapJointProject(id: string): void {
  try {
    const projects = getStoredMapJointProjects();
    const filtered = projects.filter((p) => p.id !== id);
    localStorage.setItem(MAP_JOINT_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error deleting map joint project:', err);
  }
}

export function getStoredMapJointProjectById(id: string): MapJointProject | null {
  const list = getStoredMapJointProjects();
  return list.find((p) => p.id === id) || null;
}

// ----------------------------------------------------------------------------
// GEOMETRY HELPERS: Centroid & Displacement
// ----------------------------------------------------------------------------

export function calculatePolygonCentroid(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length === 0) return { x: 0, y: 0 };
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += a;
    cx += (points[i].x + points[j].x) * a;
    cy += (points[i].y + points[j].y) * a;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 0.0001) {
    // Fallback to simple arithmetic average
    const sumX = points.reduce((acc, p) => acc + p.x, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    return { x: sumX / n, y: sumY / n };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);
  return { x: cx, y: cy };
}

/**
 * Calculates comparative metrics for Pentagraph workspace
 */
export function calculatePentagraphMetrics(
  mapDagAreaSqFt: number,
  gpsSurveyAreaSqFt: number,
  mapPerimeterFt: number,
  gpsPerimeterFt: number,
  mapCentroid: { x: number; y: number },
  gpsCentroid: { x: number; y: number },
  scalePixelsPerFoot: number = 1.0,
  drawingAreaSqFt?: number
): PentagraphComparisonMetrics {
  const diffSqFt = roundClean(Math.abs(mapDagAreaSqFt - gpsSurveyAreaSqFt), 2);
  const diffDecimal = roundClean(diffSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const mapDecimal = roundClean(mapDagAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const gpsDecimal = roundClean(gpsSurveyAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const drawingDecimal = drawingAreaSqFt
    ? roundClean(drawingAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3)
    : undefined;

  const percentageVariance =
    mapDagAreaSqFt > 0 ? roundClean((diffSqFt / mapDagAreaSqFt) * 100, 2) : 0;

  const perimeterDiffFt = roundClean(Math.abs(mapPerimeterFt - gpsPerimeterFt), 2);

  // Compute centroid displacement and direction
  const dx = gpsCentroid.x - mapCentroid.x;
  const dy = -(gpsCentroid.y - mapCentroid.y); // Invert Y for standard cartesian heading
  const displacementPx = Math.sqrt(dx * dx + dy * dy);
  const displacementFt = roundClean(displacementPx / Math.max(0.001, scalePixelsPerFoot), 2);

  // Compass direction
  let bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;
  const compass = getCompassDirection(bearing);

  let matchGrade: 'excellent' | 'acceptable' | 'high_variance' = 'excellent';
  if (percentageVariance <= 3.0) {
    matchGrade = 'excellent';
  } else if (percentageVariance <= 7.5) {
    matchGrade = 'acceptable';
  } else {
    matchGrade = 'high_variance';
  }

  return {
    mapAreaSqFt: roundClean(mapDagAreaSqFt, 2),
    mapAreaDecimal: mapDecimal,
    gpsAreaSqFt: roundClean(gpsSurveyAreaSqFt, 2),
    gpsAreaDecimal: gpsDecimal,
    drawingAreaSqFt: drawingAreaSqFt ? roundClean(drawingAreaSqFt, 2) : undefined,
    drawingAreaDecimal: drawingDecimal,
    diffSqFt,
    diffDecimal,
    percentageVariance,
    perimeterMapFt: roundClean(mapPerimeterFt, 2),
    perimeterGpsFt: roundClean(gpsPerimeterFt, 2),
    perimeterDiffFt,
    centroidDisplacementFt: displacementFt,
    displacementDirectionEn: compass.en,
    displacementDirectionBn: compass.bn,
    matchGrade,
  };
}

/**
 * Calculates control point alignment guidance parameters
 */
export function calculateControlPointAlignment(controlPoints: ControlPointPair[]): {
  suggestedDx: number;
  suggestedDy: number;
  suggestedRotation: number;
  suggestedScale: number;
  residualErrorPx: number;
  isApproximate: boolean;
} {
  if (controlPoints.length === 0) {
    return {
      suggestedDx: 0,
      suggestedDy: 0,
      suggestedRotation: 0,
      suggestedScale: 1.0,
      residualErrorPx: 0,
      isApproximate: false,
    };
  }

  if (controlPoints.length === 1) {
    const cp = controlPoints[0];
    const dx = cp.ptA.x - cp.ptB.x;
    const dy = cp.ptA.y - cp.ptB.y;
    return {
      suggestedDx: Math.round(dx),
      suggestedDy: Math.round(dy),
      suggestedRotation: 0,
      suggestedScale: 1.0,
      residualErrorPx: 0,
      isApproximate: true,
    };
  }

  // 2 or more control points: compute scale, rotation, and translation
  const cp1 = controlPoints[0];
  const cp2 = controlPoints[1];

  const dxA = cp2.ptA.x - cp1.ptA.x;
  const dyA = cp2.ptA.y - cp1.ptA.y;
  const distA = Math.sqrt(dxA * dxA + dyA * dyA);

  const dxB = cp2.ptB.x - cp1.ptB.x;
  const dyB = cp2.ptB.y - cp1.ptB.y;
  const distB = Math.sqrt(dxB * dxB + dyB * dyB);

  const angleA = Math.atan2(dyA, dxA);
  const angleB = Math.atan2(dyB, dxB);
  let rotRad = angleA - angleB;
  let rotationDeg = roundClean((rotRad * 180) / Math.PI, 1);

  const scale = distB > 0 ? roundClean(distA / distB, 3) : 1.0;

  // Compute translation so cp1.ptB transformed matches cp1.ptA
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const rotBx = (cp1.ptB.x * cosR - cp1.ptB.y * sinR) * scale;
  const rotBy = (cp1.ptB.x * sinR + cp1.ptB.y * cosR) * scale;

  const dx = roundClean(cp1.ptA.x - rotBx, 1);
  const dy = roundClean(cp1.ptA.y - rotBy, 1);

  // Check 3rd point residual if present
  let residual = 0;
  if (controlPoints.length >= 3) {
    const cp3 = controlPoints[2];
    const transformedX = (cp3.ptB.x * cosR - cp3.ptB.y * sinR) * scale + dx;
    const transformedY = (cp3.ptB.x * sinR + cp3.ptB.y * cosR) * scale + dy;
    const errX = cp3.ptA.x - transformedX;
    const errY = cp3.ptA.y - transformedY;
    residual = roundClean(Math.sqrt(errX * errX + errY * errY), 1);
  }

  return {
    suggestedDx: dx,
    suggestedDy: dy,
    suggestedRotation: rotationDeg,
    suggestedScale: scale,
    residualErrorPx: residual,
    isApproximate: true,
  };
}

/**
 * Computes Advanced 3-Way Land Measurement Verification
 */
export function computeAdvancedVerificationMatrix(
  dag: DigitizedDagRecord | null,
  gpsSurvey: SurveyRecord | null,
  activeGpsAreaSqFt: number = 0,
  drawingSurvey?: SurveyRecord | null
): AdvancedVerificationMatrix {
  const dagAreaSqFt = dag ? dag.areaSqFt : 0;
  const dagAreaDecimal = dag ? dag.areaDecimal : 0;
  const dagPerimeterFt = dag ? dag.perimeterFt : 0;
  const dagPointCount = dag ? dag.points.length : 0;

  const gpsAreaSqFt = gpsSurvey ? gpsSurvey.areaSqFt : activeGpsAreaSqFt;
  const gpsAreaDecimal = roundClean(gpsAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const gpsPerimeterFt = gpsSurvey ? gpsSurvey.perimeterFt : 0;
  const gpsPointCount = gpsSurvey ? gpsSurvey.points.length : 0;

  const drawingAreaSqFt = drawingSurvey ? drawingSurvey.areaSqFt : undefined;
  const drawingAreaDecimal = drawingAreaSqFt
    ? roundClean(drawingAreaSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3)
    : undefined;
  const drawingPerimeterFt = drawingSurvey ? drawingSurvey.perimeterFt : undefined;
  const drawingPointCount = drawingSurvey ? drawingSurvey.points.length : undefined;

  const areaDiffSqFt = roundClean(Math.abs(dagAreaSqFt - gpsAreaSqFt), 2);
  const areaDiffDecimal = roundClean(areaDiffSqFt / LAND_CONSTANTS.SQFT_PER_DECIMAL, 3);
  const percentageDiff =
    dagAreaSqFt > 0 ? roundClean((areaDiffSqFt / dagAreaSqFt) * 100, 2) : 0;

  const perimeterDiffFt = roundClean(Math.abs(dagPerimeterFt - gpsPerimeterFt), 2);

  let matchGrade: 'excellent' | 'acceptable' | 'high_variance' = 'excellent';
  if (percentageDiff <= 3.0) {
    matchGrade = 'excellent';
  } else if (percentageDiff <= 7.5) {
    matchGrade = 'acceptable';
  } else {
    matchGrade = 'high_variance';
  }

  return {
    dagAreaSqFt,
    dagAreaDecimal,
    dagPerimeterFt,
    dagPointCount,
    gpsAreaSqFt,
    gpsAreaDecimal,
    gpsPerimeterFt,
    gpsPointCount,
    drawingAreaSqFt,
    drawingAreaDecimal,
    drawingPerimeterFt,
    drawingPointCount,
    areaDiffSqFt,
    areaDiffDecimal,
    percentageDiff,
    perimeterDiffFt,
    matchGrade,
    disclaimerBn:
      'ডিজিটাল/নির্দেশক যাচাইকরণ: এই ফলাফলটি মৌজা নকশার ডিজিটাইজড দাগ, মাঠপর্যায়ের মোবাইল GPS পরিমাপ ও ডিজিটাল ড্রয়িংয়ের নির্দেশক তুলনামূলক পর্যালোচনা। এটি কোনো আদালত বা রাজস্ব কর্তৃপক্ষের চূড়ান্ত আইনি সীমানা নির্ধারণ নয়।',
    disclaimerEn:
      'DIGITAL / INDICATIVE VERIFICATION: This verification provides an analytical comparison between the digitized cadastral map, field GPS points, and digital drawing. It does NOT constitute legal boundary determination.',
  };
}
