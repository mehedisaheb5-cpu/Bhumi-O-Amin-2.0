import {
  AdministrativeDivision,
  AdministrativeDistrict,
  AdministrativeUpazila,
  AdministrativeUnion,
  MouzaMetadataRecord,
  MouzaImportValidationResult,
  ScannedMouzaMapCatalogRecord,
  SurveyRecordType,
} from '../types/administrative-location';
import {
  BANGLADESH_DIVISIONS,
  BANGLADESH_DISTRICTS,
  BANGLADESH_UPAZILAS,
  STARTER_SAMPLE_MOUZAS,
} from '../data/bangladesh-administrative-data';

const IMPORTED_MOUZAS_STORAGE_KEY = 'bhumi_imported_mouza_dataset';
const SCANNED_CATALOG_STORAGE_KEY = 'bhumi_scanned_map_catalog';

// ==========================================
// ADMINISTRATIVE HIERARCHY ACCESSORS
// ==========================================

export function getDivisions(): AdministrativeDivision[] {
  return BANGLADESH_DIVISIONS;
}

export function getDivisionById(id?: string): AdministrativeDivision | undefined {
  if (!id) return undefined;
  return BANGLADESH_DIVISIONS.find((d) => d.id === id || d.code === id);
}

export function getDistricts(divisionId?: string): AdministrativeDistrict[] {
  if (!divisionId) return BANGLADESH_DISTRICTS;
  return BANGLADESH_DISTRICTS.filter((d) => d.divisionId === divisionId);
}

export function getDistrictById(id?: string): AdministrativeDistrict | undefined {
  if (!id) return undefined;
  return BANGLADESH_DISTRICTS.find(
    (d) => d.id === id || d.code === id || d.nameEn.toLowerCase() === id.toLowerCase() || d.nameBn === id
  );
}

export function findDistrictByName(name?: string): AdministrativeDistrict | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return BANGLADESH_DISTRICTS.find(
    (d) => d.nameBn === name.trim() || d.nameEn.toLowerCase() === clean
  );
}

export function getUpazilas(districtId?: string): AdministrativeUpazila[] {
  if (!districtId) return BANGLADESH_UPAZILAS;
  return BANGLADESH_UPAZILAS.filter((u) => u.districtId === districtId);
}

export function getUpazilaById(id?: string): AdministrativeUpazila | undefined {
  if (!id) return undefined;
  return BANGLADESH_UPAZILAS.find(
    (u) => u.id === id || u.code === id || u.nameEn.toLowerCase() === id.toLowerCase() || u.nameBn === id
  );
}

export function findUpazilaByName(districtId?: string, name?: string): AdministrativeUpazila | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  const pool = districtId ? getUpazilas(districtId) : BANGLADESH_UPAZILAS;
  return pool.find((u) => u.nameBn === name.trim() || u.nameEn.toLowerCase() === clean);
}

export function getUnions(upazilaId?: string): AdministrativeUnion[] {
  // Return empty list or future imported unions
  if (!upazilaId) return [];
  return [];
}

// ==========================================
// MOUZA METADATA DATABASE
// ==========================================

export function getImportedMouzas(): MouzaMetadataRecord[] {
  try {
    const raw = localStorage.getItem(IMPORTED_MOUZAS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse imported mouzas:', err);
    return [];
  }
}

export function saveImportedMouzas(newRecords: MouzaMetadataRecord[]): void {
  try {
    const existing = getImportedMouzas();
    const existingKeys = new Set(
      existing.map((r) => `${r.upazilaId}_${r.mouzaNameBn}_${r.jlNo}_${r.surveyType}`.toLowerCase())
    );

    const merged = [...existing];
    newRecords.forEach((rec) => {
      const key = `${rec.upazilaId}_${rec.mouzaNameBn}_${rec.jlNo}_${rec.surveyType}`.toLowerCase();
      if (!existingKeys.has(key)) {
        merged.push(rec);
        existingKeys.add(key);
      }
    });

    localStorage.setItem(IMPORTED_MOUZAS_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save imported mouzas to storage:', err);
  }
}

export function clearImportedMouzas(): void {
  try {
    localStorage.removeItem(IMPORTED_MOUZAS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear imported mouzas:', err);
  }
}

export function getAllMouzas(): MouzaMetadataRecord[] {
  const imported = getImportedMouzas();
  return [...STARTER_SAMPLE_MOUZAS, ...imported];
}

export function getMouzas(upazilaId?: string, surveyType?: SurveyRecordType): MouzaMetadataRecord[] {
  const all = getAllMouzas();
  return all.filter((m) => {
    if (upazilaId && m.upazilaId !== upazilaId) return false;
    if (surveyType && m.surveyType !== surveyType) return false;
    return true;
  });
}

export function searchMouzas(query: string, upazilaId?: string): MouzaMetadataRecord[] {
  if (!query.trim()) return getMouzas(upazilaId);
  const q = query.trim().toLowerCase();
  const pool = getMouzas(upazilaId);

  return pool.filter((m) => {
    return (
      m.mouzaNameBn.includes(query.trim()) ||
      m.mouzaNameEn.toLowerCase().includes(q) ||
      m.jlNo.includes(query.trim())
    );
  });
}

// ==========================================
// VALIDATION & BULK IMPORT (CSV & JSON)
// ==========================================

const VALID_SURVEY_TYPES: SurveyRecordType[] = ['CS', 'SA', 'RS', 'BS', 'BRS', 'City', 'Diara', 'Other'];

export function validateAndImportMouzaData(
  content: string,
  format: 'json' | 'csv'
): MouzaImportValidationResult {
  const errors: string[] = [];
  const validRecords: MouzaMetadataRecord[] = [];
  let duplicatesCount = 0;

  const existingAll = getAllMouzas();
  const existingKeys = new Set(
    existingAll.map((r) => `${r.upazilaId}_${r.mouzaNameBn}_${r.jlNo}_${r.surveyType}`.toLowerCase())
  );

  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return {
        total: 0,
        imported: 0,
        rejected: 1,
        duplicates: 0,
        errors: [`JSON সিনট্যাক্স সঠিক নয়: ${(err as Error).message}`],
        records: [],
      };
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];

    items.forEach((item: any, idx: number) => {
      const lineNo = idx + 1;
      const mouzaNameBn = item.mouzaNameBn || item.mouza || item.name;
      const jlNo = item.jlNo != null ? String(item.jlNo).trim() : '';
      const surveyTypeRaw = (item.surveyType || item.survey_type || 'RS').toString().toUpperCase();

      if (!mouzaNameBn) {
        errors.push(`আইটেম #${lineNo}: মৌজার নাম (mouzaNameBn) অনুপস্থিত`);
        return;
      }
      if (!jlNo) {
        errors.push(`আইটেম #${lineNo}: জে.এল. নম্বর (jlNo) অনুপস্থিত`);
        return;
      }

      // Survey Type validation
      const surveyType = (VALID_SURVEY_TYPES.includes(surveyTypeRaw as any)
        ? surveyTypeRaw
        : 'Other') as SurveyRecordType;

      // Location resolution
      const dist =
        getDistrictById(item.districtId) ||
        findDistrictByName(item.districtNameBn || item.district);
      if (!dist) {
        errors.push(`আইটেম #${lineNo}: জেলা '${item.district || item.districtId}' শনাক্ত করা যায়নি`);
        return;
      }

      const upz =
        getUpazilaById(item.upazilaId) ||
        findUpazilaByName(dist.id, item.upazilaNameBn || item.upazila);
      if (!upz) {
        errors.push(
          `আইটেম #${lineNo}: উপজেলা '${item.upazila || item.upazilaId}' জেলা '${dist.nameBn}'-এ পাওয়া যায়নি`
        );
        return;
      }

      const div = getDivisionById(dist.divisionId);
      const key = `${upz.id}_${mouzaNameBn}_${jlNo}_${surveyType}`.toLowerCase();

      if (existingKeys.has(key)) {
        duplicatesCount++;
        return;
      }

      const newRec: MouzaMetadataRecord = {
        id: `mouza-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        divisionId: div?.id || dist.divisionId,
        divisionNameBn: div?.nameBn || '',
        districtId: dist.id,
        districtNameBn: dist.nameBn,
        upazilaId: upz.id,
        upazilaNameBn: upz.nameBn,
        unionId: item.unionId,
        unionNameBn: item.unionNameBn || item.union,
        mouzaNameEn: item.mouzaNameEn || mouzaNameBn,
        mouzaNameBn: mouzaNameBn.trim(),
        jlNo,
        surveyType,
        sheetNumber: item.sheetNumber ? String(item.sheetNumber) : undefined,
        source: 'imported_dataset',
        isDemo: false,
        lastVerifiedDate: item.lastVerifiedDate || new Date().toISOString().split('T')[0],
        notes: item.notes || 'অ্যাডমিন আমদানিকৃত মৌজা রেকর্ড',
      };

      existingKeys.add(key);
      validRecords.push(newRec);
    });

    return {
      total: items.length,
      imported: validRecords.length,
      rejected: errors.length,
      duplicates: duplicatesCount,
      errors,
      records: validRecords,
    };
  }

  // CSV Parsing
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      total: 0,
      imported: 0,
      rejected: 1,
      duplicates: 0,
      errors: ['CSV ফাইলে হেডার ও ন্যূনতম একটি ডেটা সারি থাকতে হবে'],
      records: [],
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const getCol = (row: string[], name: string): string => {
    const idx = headers.indexOf(name.toLowerCase());
    return idx >= 0 && row[idx] ? row[idx].trim().replace(/^"|"$/g, '') : '';
  };

  const dataLines = lines.slice(1);
  dataLines.forEach((line, idx) => {
    const lineNo = idx + 2;
    // Simple CSV row parser handling quoted commas
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const cleanParts = parts.map((p) => p.trim().replace(/^"|"$/g, ''));

    const mouzaNameBn =
      getCol(cleanParts, 'mouzanamebn') ||
      getCol(cleanParts, 'mouza') ||
      getCol(cleanParts, 'mouza_bn') ||
      getCol(cleanParts, 'name');
    const jlNo = getCol(cleanParts, 'jlno') || getCol(cleanParts, 'jl') || getCol(cleanParts, 'jl_no');
    const districtRaw = getCol(cleanParts, 'district') || getCol(cleanParts, 'districtnamebn');
    const upazilaRaw = getCol(cleanParts, 'upazila') || getCol(cleanParts, 'upazilanamebn');
    const surveyTypeRaw = (getCol(cleanParts, 'surveytype') || getCol(cleanParts, 'type') || 'RS').toUpperCase();

    if (!mouzaNameBn) {
      errors.push(`সারি #${lineNo}: মৌজার নাম অনুপস্থিত`);
      return;
    }
    if (!jlNo) {
      errors.push(`সারি #${lineNo}: জে.এল. নম্বর অনুপস্থিত`);
      return;
    }
    if (!districtRaw) {
      errors.push(`সারি #${lineNo}: জেলার নাম অনুপস্থিত`);
      return;
    }
    if (!upazilaRaw) {
      errors.push(`সারি #${lineNo}: উপজেলার নাম অনুপস্থিত`);
      return;
    }

    const dist = findDistrictByName(districtRaw) || getDistrictById(districtRaw);
    if (!dist) {
      errors.push(`সারি #${lineNo}: জেলা '${districtRaw}' শনাক্ত করা যায়নি`);
      return;
    }

    const upz = findUpazilaByName(dist.id, upazilaRaw) || getUpazilaById(upazilaRaw);
    if (!upz) {
      errors.push(`সারি #${lineNo}: উপজেলা '${upazilaRaw}' জেলা '${dist.nameBn}'-এ পাওয়া যায়নি`);
      return;
    }

    const surveyType = (VALID_SURVEY_TYPES.includes(surveyTypeRaw as any)
      ? surveyTypeRaw
      : 'Other') as SurveyRecordType;

    const div = getDivisionById(dist.divisionId);
    const key = `${upz.id}_${mouzaNameBn}_${jlNo}_${surveyType}`.toLowerCase();

    if (existingKeys.has(key)) {
      duplicatesCount++;
      return;
    }

    const newRec: MouzaMetadataRecord = {
      id: `mouza-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      divisionId: div?.id || dist.divisionId,
      divisionNameBn: div?.nameBn || '',
      districtId: dist.id,
      districtNameBn: dist.nameBn,
      upazilaId: upz.id,
      upazilaNameBn: upz.nameBn,
      mouzaNameEn: getCol(cleanParts, 'mouzanameen') || mouzaNameBn,
      mouzaNameBn: mouzaNameBn.trim(),
      jlNo,
      surveyType,
      sheetNumber: getCol(cleanParts, 'sheetnumber') || undefined,
      source: 'imported_dataset',
      isDemo: false,
      lastVerifiedDate: new Date().toISOString().split('T')[0],
      notes: 'CSV আমদানিকৃত রেকর্ড',
    };

    existingKeys.add(key);
    validRecords.push(newRec);
  });

  return {
    total: dataLines.length,
    imported: validRecords.length,
    rejected: errors.length,
    duplicates: duplicatesCount,
    errors,
    records: validRecords,
  };
}

export function getSampleCsvTemplate(): string {
  return `district,upazila,mouza,jlNo,surveyType,sheetNumber,mouzaNameEn
ঢাকা,সাভার,সাভার,২৪,RS,০১,Savar
ঢাকা,খিলগাঁও,খিলগাঁও,২৮৮,CS,০১,Khilgaon
ফেনী,ফেনী সদর,রামপুর,৪৫,CS,০১,Rampur
কুমিল্লা,আদর্শ সদর,কান্দিরপাড়,১২,RS,০১,Kandirpar`;
}

export function getSampleJsonTemplate(): string {
  return JSON.stringify(
    [
      {
        districtNameBn: 'ঢাকা',
        upazilaNameBn: 'সাভার',
        mouzaNameBn: 'সাভার',
        mouzaNameEn: 'Savar',
        jlNo: '২৪',
        surveyType: 'RS',
        sheetNumber: '০১',
      },
      {
        districtNameBn: 'ফেনী',
        upazilaNameBn: 'ফেনী সদর',
        mouzaNameBn: 'রামপুর',
        mouzaNameEn: 'Rampur',
        jlNo: '৪৫',
        surveyType: 'CS',
        sheetNumber: '০১',
      },
    ],
    null,
    2
  );
}

// ==========================================
// SCANNED MOUZA MAP CATALOG FOUNDATION
// ==========================================

export function getScannedMapCatalog(): ScannedMouzaMapCatalogRecord[] {
  try {
    const raw = localStorage.getItem(SCANNED_CATALOG_STORAGE_KEY);
    if (!raw) {
      // Starter sample catalog items (Clearly labeled isDemo: true)
      return [
        {
          id: 'cat-map-savar-24-rs',
          mapTitle: 'সাভার মৌজা নকশা - শীট ০১ (RS)',
          divisionId: 'div-dhaka',
          districtId: 'dist-dhaka',
          upazilaId: 'upz-savar',
          mouzaNameBn: 'সাভার',
          mouzaNameEn: 'Savar',
          jlNo: '২৪',
          surveyType: 'RS',
          sheetNumber: '০১',
          fileReference: '/assets/sample-maps/savar_sheet_01.png',
          originalFileName: 'savar_rs_sheet_01.png',
          fileSizeBytes: 2450000,
          mimeType: 'image/png',
          uploadDate: '2026-01-10T10:00:00.000Z',
          source: 'নমুনা ডিজিটাল আর্কাইভ',
          verificationStatus: 'demo',
          scale: '16" = 1 mile',
          scalePixelsPerFoot: 1.0,
          georeferencingStatus: 'affine',
          isDemo: true,
        },
        {
          id: 'cat-map-khilgaon-288-cs',
          mapTitle: 'খিলগাঁও মৌজা নকশা - শীট ০১ (CS)',
          divisionId: 'div-dhaka',
          districtId: 'dist-dhaka',
          upazilaId: 'upz-khilgaon',
          mouzaNameBn: 'খিলগাঁও',
          mouzaNameEn: 'Khilgaon',
          jlNo: '২৮৮',
          surveyType: 'CS',
          sheetNumber: '০১',
          fileReference: '/assets/sample-maps/khilgaon_cs_sheet_01.png',
          originalFileName: 'khilgaon_cs_01.png',
          fileSizeBytes: 3120000,
          mimeType: 'image/png',
          uploadDate: '2026-01-12T14:30:00.000Z',
          source: 'নমুনা ডিজিটাল আর্কাইভ',
          verificationStatus: 'demo',
          scale: '16" = 1 mile',
          scalePixelsPerFoot: 1.0,
          georeferencingStatus: 'none',
          isDemo: true,
        },
      ];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse scanned map catalog:', err);
    return [];
  }
}

export function saveScannedMapCatalogRecord(record: ScannedMouzaMapCatalogRecord): void {
  try {
    const list = getScannedMapCatalog();
    const existingIndex = list.findIndex((x) => x.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(SCANNED_CATALOG_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to save map catalog record:', err);
  }
}

export function deleteScannedMapCatalogRecord(id: string): void {
  try {
    const list = getScannedMapCatalog().filter((x) => x.id !== id);
    localStorage.setItem(SCANNED_CATALOG_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to delete map catalog record:', err);
  }
}
