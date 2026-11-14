import { SurveyRecordType } from './administrative-location';

export type MapCatalogStatus =
  | 'Uploaded'
  | 'Verified'
  | 'Needs Review'
  | 'Missing File'
  | 'Archived';

export type MapStorageProvider =
  | 'firebase_storage'
  | 'indexeddb_offline'
  | 'sample_asset'
  | 'external_ref'
  | 'none';

export interface MouzaMapUploaderInfo {
  uid: string;
  name: string;
  email?: string;
  role: string;
}

export interface MouzaMapVerifierInfo {
  uid: string;
  name: string;
  email?: string;
  date: string;
  notes?: string;
}

export interface MouzaMapLibraryItem {
  id: string; // Unique Map ID e.g. "map-dhaka-savar-24-rs-01-uuid"
  mapTitle: string;
  divisionId: string;
  divisionNameBn: string;
  districtId: string;
  districtNameBn: string;
  upazilaId: string;
  upazilaNameBn: string;
  unionId?: string;
  unionNameBn?: string;
  mouzaNameBn: string;
  mouzaNameEn?: string;
  jlNo: string;
  surveyType: SurveyRecordType; // 'CS' | 'SA' | 'RS' | 'BS' | 'BRS' | 'Other'
  sheetNumber: string; // e.g. '০১', '১', 'Sheet 1'
  originalFileName: string;
  fileType: 'pdf' | 'image';
  mimeType?: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  uploadDate: string; // ISO date string e.g. "2026-09-21T04:00:00.000Z"
  uploadedBy: MouzaMapUploaderInfo;
  source: string; // Provenance e.g. "জেলা রেকর্ড রুম থেকে সংগৃহীত", "সার্ভেয়ারের নিজস্ব কপি"
  verificationStatus: MapCatalogStatus;
  verifiedBy?: MouzaMapVerifierInfo;
  notes?: string;
  fileReference: string; // Firebase Storage download URL, object URL, or IndexedDB storage reference
  storageUrl?: string; // Direct Firebase Storage URL or file URL from Firestore document
  fileRef?: string; // Storage reference path or bucket pointer from Firestore document
  downloadUrl?: string; // Explicit download URL if stored separately
  storageBucketPath?: string; // e.g. "mouza_maps/map-xxx.pdf"
  storageProvider: MapStorageProvider;
  scale?: string; // e.g. '16" = 1 mile'
  scalePixelsPerFoot?: number;
  georeferencingStatus?: 'none' | 'affine' | 'control_points' | 'full';
  isDemo?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ExternalMapSourceRecord {
  id: string;
  sourceName: string;
  websiteUrl: string;
  accessType: 'External Link';
  notes: string;
  lastCheckedDate: string;
  isVerifiedPublicPortal?: boolean;
}

export interface BulkMapMetadataRowInput {
  divisionNameBn?: string;
  districtNameBn: string;
  upazilaNameBn: string;
  mouzaNameBn: string;
  jlNo: string;
  surveyType: string;
  sheetNumber: string;
  unionNameBn?: string;
  mapTitle?: string;
  source?: string;
  fileReference?: string;
  notes?: string;
}

export interface BulkMapImportValidationResult {
  total: number;
  validCount: number;
  rejectedCount: number;
  duplicateCount: number;
  missingFileCount: number;
  errors: string[];
  records: MouzaMapLibraryItem[];
}

export interface MapSearchFilterCriteria {
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  mouzaNameBn?: string;
  jlNo?: string;
  surveyType?: string;
  sheetNumber?: string;
  verificationStatus?: string;
  searchQuery?: string;
}
