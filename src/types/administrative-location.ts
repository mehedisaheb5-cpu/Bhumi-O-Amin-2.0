export type SurveyRecordType = 'CS' | 'SA' | 'RS' | 'BS' | 'BRS' | 'City' | 'Diara' | 'Other';

export interface AdministrativeDivision {
  id: string; // e.g. 'div-dhaka'
  code: string; // Official BBS code e.g. '30'
  nameEn: string;
  nameBn: string;
}

export interface AdministrativeDistrict {
  id: string; // e.g. 'dist-dhaka'
  code: string; // Official BBS code e.g. '26'
  divisionId: string;
  nameEn: string;
  nameBn: string;
}

export interface AdministrativeUpazila {
  id: string; // e.g. 'upz-savar'
  code: string; // Official BBS code
  districtId: string;
  nameEn: string;
  nameBn: string;
}

export interface AdministrativeUnion {
  id: string;
  upazilaId: string;
  nameEn: string;
  nameBn: string;
}

export type MouzaDataSource = 'verified_gov' | 'imported_dataset' | 'user_defined' | 'demo_sample';

export interface MouzaMetadataRecord {
  id: string; // Unique ID (e.g. 'mouza-dhaka-savar-24-cs')
  divisionId: string;
  divisionNameBn: string;
  districtId: string;
  districtNameBn: string;
  upazilaId: string;
  upazilaNameBn: string;
  unionId?: string;
  unionNameBn?: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  jlNo: string;
  surveyType: SurveyRecordType;
  sheetNumber?: string;
  source: MouzaDataSource;
  isDemo?: boolean;
  lastVerifiedDate?: string;
  notes?: string;
}

export interface LocationSelectionValue {
  divisionId?: string;
  divisionNameBn?: string;
  districtId?: string;
  districtNameBn?: string;
  upazilaId?: string;
  upazilaNameBn?: string;
  unionId?: string;
  unionNameBn?: string;
  mouzaNameBn?: string;
  mouzaNameEn?: string;
  jlNo?: string;
  surveyType?: SurveyRecordType;
  sheetNumber?: string;
  isCustomMouza?: boolean;
  mouzaRecordId?: string;
}

export type MapVerificationStatus = 'verified' | 'unverified' | 'user_submitted' | 'demo';
export type MapGeoreferenceStatus = 'none' | 'affine' | 'control_points' | 'full';

export interface ScannedMouzaMapCatalogRecord {
  id: string; // e.g. 'cat-map-001'
  mapTitle: string;
  divisionId: string;
  districtId: string;
  upazilaId: string;
  mouzaNameBn: string;
  mouzaNameEn?: string;
  jlNo: string;
  surveyType: SurveyRecordType;
  sheetNumber?: string;
  fileReference: string; // URL, storage reference or relative token
  originalFileName: string;
  fileSizeBytes?: number;
  mimeType?: string;
  uploadDate: string; // ISO String
  source: string; // Provenance e.g. "জেলা রেকর্ড রুম" or "ব্যবহারকারী আপলোড"
  verificationStatus: MapVerificationStatus;
  scale?: string; // e.g. '16" = 1 mile'
  scalePixelsPerFoot?: number;
  georeferencingStatus: MapGeoreferenceStatus;
  isDemo?: boolean;
}

export interface MouzaImportValidationResult {
  total: number;
  imported: number;
  rejected: number;
  duplicates: number;
  errors: string[];
  records: MouzaMetadataRecord[];
}
