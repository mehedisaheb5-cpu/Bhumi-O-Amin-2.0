export type GPSStatus =
  | 'ready'          // GPS প্রস্তুত
  | 'starting'       // GPS চালু হচ্ছে...
  | 'active'         // GPS পাওয়া যাচ্ছে
  | 'weak'           // GPS দুর্বল
  | 'denied'         // GPS permission denied
  | 'unavailable'    // GPS unavailable
  | 'timeout';       // GPS timeout/error

export type AccuracyLevel = 'very_good' | 'good' | 'moderate' | 'poor' | 'unknown';

export interface GpsPoint {
  id: string;
  label: string; // A, B, C, ... Z, AA...
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  timestamp: number;
  timeStr: string;
}

export interface CurrentGpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  heading: number | null;
  speed: number | null;
  altitude: number | null;
  timestamp: number;
}

export type {
  LatLngPoint,
  GpsPolygonSegment,
  GpsPolygonValidation,
  GpsAreaResult,
  GpsAccuracyStats,
  MapReadySurveyData,
} from './gps-geometry';
