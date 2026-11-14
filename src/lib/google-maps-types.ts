import { LandAreaUnit } from '../types';
import { GpsPoint } from './gps-types';

/**
 * Phase 15 Parcel Boundary Point (A-Z)
 */
export interface ParcelBoundaryPoint {
  id: string;
  label: string; // 'A', 'B', 'C', ...
  lat: number;
  lng: number;
  altitude?: number | null;
  createdAt: number;
}

/**
 * Phase 15 Saved Parcel Data Structure (ready for Phase 15B)
 */
export interface SavedParcelRecord {
  id: string;
  title: string;
  district: string;
  upazila: string;
  union?: string;
  mouza: string;
  jlNo: string;
  dagNo: string;
  khatianNo: string;
  notes?: string;
  
  // Boundary Points (A-Z)
  points: ParcelBoundaryPoint[];
  
  // Calculated metrics
  perimeterMeters: number;
  perimeterFeet: number;
  areaSqMeters: number;
  areaSqFt: number;
  shatangsha: number;
  katha: number;
  bigha: number;
  acre: number;

  // Source info
  source: 'google_maps_manual' | 'gps_survey_import';
  createdAt: number;
  updatedAt: number;
}

/**
 * View / Layer display configuration for Google Maps view
 */
export interface GoogleMapsLayerConfig {
  showGpsSurveyOverlay: boolean;
  showManualParcelOverlay: boolean;
  showPointLabels: boolean;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
}

export const PARCELS_STORAGE_KEY = 'bhumi-amin-google-parcels';

/**
 * Generate alphabet point label (A, B, ... Z, A1, B1, ...)
 */
export function getPointLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  const cycle = Math.floor(index / 26);
  const remainder = index % 26;
  return `${String.fromCharCode(65 + remainder)}${cycle}`;
}

/**
 * Retrieve saved parcels from localStorage
 */
export function getStoredParcels(): SavedParcelRecord[] {
  try {
    const raw = localStorage.getItem(PARCELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read saved parcels from localStorage', err);
    return [];
  }
}

/**
 * Save or update a parcel record in localStorage
 */
export function saveParcelToStorage(parcel: SavedParcelRecord): SavedParcelRecord[] {
  try {
    const current = getStoredParcels();
    const idx = current.findIndex((p) => p.id === parcel.id);
    let updated: SavedParcelRecord[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = {
        ...parcel,
        updatedAt: Date.now(),
      };
    } else {
      updated = [parcel, ...current];
    }
    localStorage.setItem(PARCELS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save parcel to localStorage', err);
    return [];
  }
}

/**
 * Delete a parcel record from localStorage
 */
export function deleteParcelFromStorage(id: string): SavedParcelRecord[] {
  try {
    const current = getStoredParcels();
    const updated = current.filter((p) => p.id !== id);
    localStorage.setItem(PARCELS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to delete parcel from localStorage', err);
    return [];
  }
}

