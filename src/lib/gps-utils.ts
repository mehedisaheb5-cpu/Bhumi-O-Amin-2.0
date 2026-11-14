import { AccuracyLevel, GPSStatus, GpsPoint } from './gps-types';

export const GPS_STORAGE_KEY = 'bhumi-amin-gps-points';

// -----------------------------------------------------------------------------
// Point labeling (A-Z, then AA, AB, etc.)
// -----------------------------------------------------------------------------
export function getPointLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index); // A to Z
  }
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return `${first}${second}`;
}

// Re-index remaining points so labels are always A, B, C, D... sequentially
export function relabelGpsPoints(points: GpsPoint[]): GpsPoint[] {
  return points.map((pt, idx) => ({
    ...pt,
    label: getPointLabel(idx),
  }));
}

// -----------------------------------------------------------------------------
// Accuracy evaluation
// -----------------------------------------------------------------------------
export function getAccuracyLevel(accuracyMeters: number): AccuracyLevel {
  if (accuracyMeters <= 0) return 'unknown';
  if (accuracyMeters <= 5) return 'very_good';
  if (accuracyMeters <= 10) return 'good';
  if (accuracyMeters <= 20) return 'moderate';
  return 'poor';
}

export function getAccuracyText(level: AccuracyLevel, lang: 'bn' | 'en' = 'bn'): string {
  if (lang === 'bn') {
    switch (level) {
      case 'very_good':
        return 'অত্যন্ত ভালো (Very Good)';
      case 'good':
        return 'ভালো (Good)';
      case 'moderate':
        return 'মোটামুটি (Moderate)';
      case 'poor':
        return 'দুর্বল সিগন্যাল (Poor)';
      default:
        return 'অজানা (Unknown)';
    }
  } else {
    switch (level) {
      case 'very_good':
        return 'Very Good (≤ 5m)';
      case 'good':
        return 'Good (5–10m)';
      case 'moderate':
        return 'Moderate (10–20m)';
      case 'poor':
        return 'Poor (> 20m)';
      default:
        return 'Unknown';
    }
  }
}

export function getAccuracyColorClass(level: AccuracyLevel): string {
  switch (level) {
    case 'very_good':
      return 'text-emerald-700 bg-emerald-50 border-emerald-300';
    case 'good':
      return 'text-teal-700 bg-teal-50 border-teal-300';
    case 'moderate':
      return 'text-amber-700 bg-amber-50 border-amber-300';
    case 'poor':
      return 'text-rose-700 bg-rose-50 border-rose-300';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-300';
  }
}

// -----------------------------------------------------------------------------
// GPS Status text & badges
// -----------------------------------------------------------------------------
export function getGpsStatusText(status: GPSStatus, lang: 'bn' | 'en' = 'bn'): string {
  if (lang === 'bn') {
    switch (status) {
      case 'ready':
        return 'GPS প্রস্তুত';
      case 'starting':
        return 'GPS চালু হচ্ছে...';
      case 'active':
        return 'GPS পাওয়া যাচ্ছে';
      case 'weak':
        return 'GPS দুর্বল';
      case 'denied':
        return 'GPS অনুমতি দেওয়া হয়নি (Permission Denied)';
      case 'unavailable':
        return 'GPS সংযোগ পাওয়া যায়নি (Unavailable)';
      case 'timeout':
        return 'GPS সময়সীমা অতিক্রান্ত (Timeout / Error)';
      default:
        return 'GPS প্রস্তুত';
    }
  } else {
    switch (status) {
      case 'ready':
        return 'GPS Ready';
      case 'starting':
        return 'Starting GPS...';
      case 'active':
        return 'GPS Active';
      case 'weak':
        return 'Weak GPS Signal';
      case 'denied':
        return 'GPS Permission Denied';
      case 'unavailable':
        return 'GPS Unavailable';
      case 'timeout':
        return 'GPS Timeout / Error';
      default:
        return 'GPS Ready';
    }
  }
}

export function getGpsStatusBadgeClass(status: GPSStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300';
    case 'weak':
      return 'bg-amber-100 text-amber-900 border-amber-300';
    case 'starting':
      return 'bg-blue-100 text-blue-900 border-blue-300 animate-pulse';
    case 'denied':
    case 'unavailable':
    case 'timeout':
      return 'bg-rose-100 text-rose-900 border-rose-300';
    case 'ready':
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

// -----------------------------------------------------------------------------
// Format coordinate helper
// -----------------------------------------------------------------------------
export function formatCoordinate(num: number, type: 'lat' | 'lng'): string {
  const dir = type === 'lat' ? (num >= 0 ? 'N' : 'S') : num >= 0 ? 'E' : 'W';
  return `${Math.abs(num).toFixed(6)}° ${dir}`;
}

export function formatTime(timestamp: number, lang: 'bn' | 'en' = 'bn'): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// -----------------------------------------------------------------------------
// Local Storage Persistence
// -----------------------------------------------------------------------------
export function getStoredGpsPoints(): GpsPoint[] {
  try {
    const raw = localStorage.getItem(GPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGpsPointsToStorage(points: GpsPoint[]): void {
  try {
    localStorage.setItem(GPS_STORAGE_KEY, JSON.stringify(points));
  } catch (e) {
    console.warn('Failed to save GPS points to localStorage', e);
  }
}

export function clearGpsPointsFromStorage(): void {
  try {
    localStorage.removeItem(GPS_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear GPS points from localStorage', e);
  }
}

// -----------------------------------------------------------------------------
// Distance & Bearing (Haversine & Geodetic Forward Azimuth)
// -----------------------------------------------------------------------------
export {
  calculateDistance,
  calculateBearing,
  calculatePerimeter,
  calculatePolygonArea,
  calculatePolygonSegments,
  calculateLocalProjectedAreaSqMeters,
  calculateSphericalExcessAreaSqMeters,
  isValidCoordinate,
  isPointValid,
  filterValidPoints,
  validatePolygonPoints,
  getCompassDirection,
  calculateCentroid,
  calculateAccuracyStats,
  getMapReadySurveyData,
} from './gps-geometry';

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}
