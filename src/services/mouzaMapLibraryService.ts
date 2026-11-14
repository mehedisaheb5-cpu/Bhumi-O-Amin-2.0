import {
  MouzaMapLibraryItem,
  MapCatalogStatus,
  ExternalMapSourceRecord,
  BulkMapImportValidationResult,
  MapSearchFilterCriteria,
} from '../types/mouza-server-library';
import { SurveyRecordType } from '../types/administrative-location';
import {
  db,
  storage,
  storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  isFirebaseConfigured,
  isFirebaseStorageConfigured,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from '../lib/firebase';
import {
  getDivisions,
  getDistricts,
  getUpazilas,
  getDistrictById,
  findDistrictByName,
  getUpazilaById,
  findUpazilaByName,
  getDivisionById,
} from '../lib/mouza-database-service';
import {
  formatFileSize,
  saveMapFile,
  getStoredMapFiles,
  getStoredMapFileWithContent,
  deleteMapFile,
  idbPut,
} from '../lib/pentagraph-files';
export { formatFileSize };
import { UploadedMapFile } from '../types';

const LOCAL_MAP_LIBRARY_KEY = 'bhumi_mouza_map_library_v1';
const EXTERNAL_SOURCES_KEY = 'bhumi_external_map_sources_v1';

// Initial verified external sources as instructed in prompt
export const INITIAL_EXTERNAL_SOURCES: ExternalMapSourceRecord[] = [
  {
    id: 'ext-dlrms-gov',
    sourceName: 'ডিজিটাল ল্যান্ড রেকর্ড ম্যানেজমেন্ট সিস্টেম (DLRMS)',
    websiteUrl: 'https://dlrmslandgovbd.com/mouza-map',
    accessType: 'External Link',
    notes: 'ভূমি রেকর্ড ও জরিপ অধিদপ্তর (DLRS) সরকারি মৌজা ম্যাপ পোর্টাল।',
    lastCheckedDate: '2026-09-20',
    isVerifiedPublicPortal: true,
  },
  {
    id: 'ext-mouzamap-tech',
    sourceName: 'মৌজা ম্যাপ টেক (MouzaMap.tech)',
    websiteUrl: 'https://free.mouzamap.tech/',
    accessType: 'External Link',
    notes: 'উন্মুক্ত কমিউনিটি রেফারেন্স মৌজা নকশা ব্রাউজার।',
    lastCheckedDate: '2026-09-18',
    isVerifiedPublicPortal: false,
  },
  {
    id: 'ext-mouza-bd',
    sourceName: 'মৌজা বিডি পাবলিক পোর্টাল (Mouza.bd)',
    websiteUrl: 'https://mouza.bd/en/mouza-maps',
    accessType: 'External Link',
    notes: 'পাবলিক অনলাইন সার্ভে মৌজা ইনডেক্স ও শিট রেফারেন্স।',
    lastCheckedDate: '2026-09-15',
    isVerifiedPublicPortal: false,
  },
];

// Seed sample map records for initial demonstration (marked as demo, no broken image URL paths)
const INITIAL_STARTER_MAPS: MouzaMapLibraryItem[] = [
  {
    id: 'map-dhaka-savar-24-rs-01',
    mapTitle: 'সাভার মৌজা নকশা - শীট ০১ (RS) [নমুনা]',
    divisionId: 'div-dhaka',
    divisionNameBn: 'ঢাকা',
    districtId: 'dist-dhaka',
    districtNameBn: 'ঢাকা',
    upazilaId: 'upz-savar',
    upazilaNameBn: 'সাভার',
    mouzaNameBn: 'সাভার',
    mouzaNameEn: 'Savar',
    jlNo: '২৪',
    surveyType: 'RS',
    sheetNumber: '০১',
    originalFileName: 'savar_rs_sheet_01_demo.png',
    fileType: 'image',
    mimeType: 'image/png',
    fileSizeBytes: 2457600,
    fileSizeFormatted: '2.45 MB',
    uploadDate: '2026-01-10T10:00:00.000Z',
    uploadedBy: {
      uid: 'admin-seed-01',
      name: 'সিস্টেম ডেমো',
      email: 'admin@bhumi-amin.gov.bd',
      role: 'admin',
    },
    source: 'জেলা রেকর্ড রুম সংগ্রহ (নমুনা ডেমো কপি)',
    verificationStatus: 'Verified',
    verifiedBy: {
      uid: 'admin-seed-01',
      name: 'সুপার অ্যাডমিন',
      date: '2026-01-12',
      notes: 'নকশার সীমানা ও সিএস-আরএস মিল যাচাইকৃত।',
    },
    notes: 'সাভার বাজার ও পৌরসভা এলাকার সংলগ্ন আরএস জরিপ নকশা নমুনা।',
    fileReference: '',
    storageProvider: 'sample_asset',
    scale: '16" = 1 mile',
    scalePixelsPerFoot: 1.0,
    georeferencingStatus: 'affine',
    isDemo: true,
    createdAt: 1768000000000,
    updatedAt: 1768000000000,
  },
  {
    id: 'map-dhaka-khilgaon-288-cs-01',
    mapTitle: 'খিলগাঁও মৌজা নকশা - শীট ০১ (CS) [নমুনা]',
    divisionId: 'div-dhaka',
    divisionNameBn: 'ঢাকা',
    districtId: 'dist-dhaka',
    districtNameBn: 'ঢাকা',
    upazilaId: 'upz-khilgaon',
    upazilaNameBn: 'খিলগাঁও',
    mouzaNameBn: 'খিলগাঁও',
    mouzaNameEn: 'Khilgaon',
    jlNo: '২৮৮',
    surveyType: 'CS',
    sheetNumber: '০১',
    originalFileName: 'khilgaon_cs_sheet_01_demo.png',
    fileType: 'image',
    mimeType: 'image/png',
    fileSizeBytes: 3145728,
    fileSizeFormatted: '3.14 MB',
    uploadDate: '2026-01-12T14:30:00.000Z',
    uploadedBy: {
      uid: 'admin-seed-01',
      name: 'সিস্টেম ডেমো',
      email: 'admin@bhumi-amin.gov.bd',
      role: 'admin',
    },
    source: 'ডিজিটাল ল্যান্ড রেকর্ড আর্কাইভ (নমুনা কপি)',
    verificationStatus: 'Verified',
    verifiedBy: {
      uid: 'admin-seed-01',
      name: 'সুপার অ্যাডমিন',
      date: '2026-01-14',
      notes: 'সিএস জরিপ শীট সম্পূর্ণ পাঠযোগ্য।',
    },
    notes: 'ঐতিহাসিক সিএস দাগ ও সীমানা রেখা সম্বলিত স্ক্যানড ক্যাটালগ নকশা নমুনা।',
    fileReference: '',
    storageProvider: 'sample_asset',
    scale: '16" = 1 mile',
    scalePixelsPerFoot: 1.0,
    georeferencingStatus: 'none',
    isDemo: true,
    createdAt: 1768200000000,
    updatedAt: 1768200000000,
  },
];

// ==========================================
// 1. LOCAL CACHE HELPERS & DOCUMENT NORMALIZATION
// ==========================================

export function normalizeMouzaMapDocument(data: any, docId?: string): MouzaMapLibraryItem {
  const id = data.id || docId || `map-${Date.now()}`;
  const directRef =
    data.storageUrl ||
    data.fileReference ||
    data.fileRef ||
    data.downloadUrl ||
    data.storageBucketPath ||
    '';

  const isPdf =
    Boolean(data.mimeType?.toLowerCase().includes('pdf')) ||
    data.fileType === 'pdf' ||
    Boolean(data.originalFileName?.toLowerCase().endsWith('.pdf')) ||
    Boolean(directRef.toLowerCase().endsWith('.pdf')) ||
    Boolean(directRef.startsWith('data:application/pdf'));

  const fileType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image';
  const mimeType = data.mimeType || (isPdf ? 'application/pdf' : 'image/png');

  // Location normalization
  let districtNameBn = data.districtNameBn || data.district || 'ঢাকা';
  let districtId = data.districtId || 'dist-dhaka';
  let upazilaNameBn = data.upazilaNameBn || data.upazila || 'সাভার';
  let upazilaId = data.upazilaId || 'upz-savar';
  let divisionNameBn = data.divisionNameBn || data.division || 'ঢাকা';
  let divisionId = data.divisionId || 'div-dhaka';

  if (districtNameBn) {
    const dObj = findDistrictByName(districtNameBn);
    if (dObj) {
      districtId = dObj.id;
      divisionId = dObj.divisionId;
      const divObj = getDivisionById(dObj.divisionId);
      if (divObj) divisionNameBn = divObj.nameBn;
    }
  }

  if (upazilaNameBn) {
    const uObj = findUpazilaByName(upazilaNameBn, districtId);
    if (uObj) upazilaId = uObj.id;
  }

  const hasFile = Boolean(directRef);

  return {
    ...data,
    id,
    mapTitle: data.mapTitle || `${data.mouzaNameBn || 'মৌজা'} নকশা`,
    divisionId,
    divisionNameBn,
    districtId,
    districtNameBn,
    upazilaId,
    upazilaNameBn,
    mouzaNameBn: data.mouzaNameBn || upazilaNameBn || 'মৌজা',
    jlNo: data.jlNo || '০১',
    surveyType: data.surveyType || 'RS',
    sheetNumber: data.sheetNumber || '০১',
    originalFileName: data.originalFileName || `${id}.${isPdf ? 'pdf' : 'png'}`,
    fileType,
    mimeType,
    fileSizeBytes: data.fileSizeBytes || data.size || 0,
    fileSizeFormatted: data.fileSizeFormatted || formatFileSize(data.fileSizeBytes || data.size || 0),
    fileReference: directRef || data.fileReference || id,
    storageUrl: data.storageUrl || (directRef.startsWith('http') || directRef.startsWith('data:') ? directRef : undefined),
    fileRef: data.fileRef || directRef,
    downloadUrl: data.downloadUrl || (directRef.startsWith('http') ? directRef : undefined),
    storageProvider: data.storageProvider || (directRef.startsWith('http') ? 'firebase_cloud' : 'indexeddb_offline'),
    verificationStatus: data.verificationStatus || (hasFile ? 'Verified' : 'Missing File'),
    isDemo: Boolean(data.isDemo),
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function getLocalMapLibrary(): MouzaMapLibraryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_MAP_LIBRARY_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_MAP_LIBRARY_KEY, JSON.stringify(INITIAL_STARTER_MAPS));
      return INITIAL_STARTER_MAPS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => normalizeMouzaMapDocument(item, item.id));
    }
    return INITIAL_STARTER_MAPS;
  } catch (err) {
    console.error('Failed to read local map library cache:', err);
    return INITIAL_STARTER_MAPS;
  }
}

export function saveLocalMapLibrary(items: MouzaMapLibraryItem[]): void {
  try {
    localStorage.setItem(LOCAL_MAP_LIBRARY_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save map library to local storage:', err);
  }
}

// ==========================================
// 2. FETCH MAP LIBRARY (Firestore + Local fallback + Pentagraph Bridge)
// ==========================================

export async function fetchMouzaMapLibrary(): Promise<MouzaMapLibraryItem[]> {
  let localItems = getLocalMapLibrary();

  // BRIDGE: Check getStoredMapFiles() for non-sample uploaded files that may have been
  // uploaded via the pentagraph file modal or prior sessions
  try {
    const storedFiles = getStoredMapFiles();
    const nonSampleStored = storedFiles.filter(
      (f) => f && typeof f.id === 'string' && !f.id.startsWith('sample-')
    );

    let hasNewBridged = false;
    for (const sf of nonSampleStored) {
      // Check if already represented in localItems
      const existing = localItems.find(
        (li) =>
          li.id === sf.id ||
          li.fileReference === sf.id ||
          li.fileReference === `offline-${sf.id}` ||
          li.id === sf.id.replace(/^offline-/, '') ||
          li.originalFileName === sf.name
      );

      if (!existing) {
        const cleanName = sf.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        const isCs = sf.category === 'cs_map' || /cs/i.test(sf.name);
        const isBs = sf.category === 'bs_map' || /bs/i.test(sf.name);
        const isSa = /sa/i.test(sf.name);
        const surveyType: SurveyRecordType = isCs ? 'CS' : isBs ? 'BS' : isSa ? 'SA' : 'RS';

        // Extract administrative location metadata from notes or name
        let districtNameBn = 'ঢাকা';
        let districtId = 'dist-dhaka';
        let upazilaNameBn = 'সাভার';
        let upazilaId = 'upz-savar';
        let divisionNameBn = 'ঢাকা';
        let divisionId = 'div-dhaka';
        let mouzaNameBn = 'সাভার';
        let jlNo = '০১';
        let sheetNumber = '০১';

        if (sf.notes) {
          const match = sf.notes.match(
            /^(.*?)\s*-\s*(.*?)\s*-\s*(.*?)\s*\(জে\.এল\.\s*(.*?),\s*শীট\s*(.*?)\)/
          );
          if (match) {
            districtNameBn = match[1].trim();
            upazilaNameBn = match[2].trim();
            mouzaNameBn = match[3].trim();
            jlNo = match[4].trim();
            sheetNumber = match[5].trim();
          }
        }

        const nameLower = sf.name.toLowerCase();
        if (nameLower.includes('panchagarh') || sf.name.includes('পঞ্চগড়')) {
          districtNameBn = 'পঞ্চগড়';
          upazilaNameBn = 'পঞ্চগড় সদর';
          mouzaNameBn = 'পঞ্চগড়';
        } else if (nameLower.includes('tetulia') || sf.name.includes('তেঁতুলিয়া')) {
          districtNameBn = 'পঞ্চগড়';
          upazilaNameBn = 'তেঁতুলিয়া';
          mouzaNameBn = 'তেঁতুলিয়া';
        } else if (nameLower.includes('kamalapur') || sf.name.includes('কমলাপুর')) {
          districtNameBn = 'ঢাকা';
          upazilaNameBn = 'মতিঝিল';
          mouzaNameBn = 'কমলাপুর';
          jlNo = '৭৪';
        } else if (nameLower.includes('shyampur') || sf.name.includes('শ্যামপুর')) {
          districtNameBn = 'ঢাকা';
          upazilaNameBn = 'কদমতলী';
          mouzaNameBn = 'শ্যামপুর';
          jlNo = '১০২';
        }

        const dObj = findDistrictByName(districtNameBn);
        if (dObj) {
          districtId = dObj.id;
          divisionId = dObj.divisionId;
          const divObj = getDivisionById(dObj.divisionId);
          if (divObj) divisionNameBn = divObj.nameBn;
        }
        const uObj = findUpazilaByName(upazilaNameBn, districtId);
        if (uObj) upazilaId = uObj.id;

        const mapTitle = `${mouzaNameBn} মৌজা নকশা - শীট ${sheetNumber} (${surveyType})`;

        const bridged: MouzaMapLibraryItem = {
          id: sf.id,
          mapTitle,
          divisionId,
          divisionNameBn,
          districtId,
          districtNameBn,
          upazilaId,
          upazilaNameBn,
          mouzaNameBn,
          jlNo,
          surveyType,
          sheetNumber,
          originalFileName: sf.name,
          fileType: (sf.fileType === 'pdf' ? 'pdf' : 'image') as 'image' | 'pdf',
          mimeType: sf.mimeType,
          fileSizeBytes: sf.size,
          fileSizeFormatted: sf.sizeFormatted || formatFileSize(sf.size),
          uploadDate:
            typeof sf.uploadedAt === 'number'
              ? new Date(sf.uploadedAt).toISOString()
              : String(sf.uploadedAt || new Date().toISOString()),
          uploadedBy: {
            uid: 'local-user',
            name: 'ব্যবহারকারী (আপলোডকৃত)',
            role: 'admin',
          },
          source: 'সরাসরি আপলোডকৃত ফাইল',
          verificationStatus: 'Uploaded',
          notes: sf.notes || 'ব্যবহারকারীর আপলোডকৃত মৌজা নকশা ফাইল',
          fileReference: sf.id,
          storageUrl: undefined,
          fileRef: sf.id,
          storageProvider: 'indexeddb_offline',
          scale: '16" = 1 mile',
          scalePixelsPerFoot: 1.0,
          georeferencingStatus: 'none',
          isDemo: false,
          createdAt: typeof sf.uploadedAt === 'number' ? sf.uploadedAt : Date.now(),
          updatedAt: typeof sf.uploadedAt === 'number' ? sf.uploadedAt : Date.now(),
        };

        localItems = [bridged, ...localItems];
        hasNewBridged = true;
      }
    }

    if (hasNewBridged) {
      saveLocalMapLibrary(localItems);
    }
  } catch (err) {
    console.warn('Error bridging pentagraph files to mouza library:', err);
  }

  // Ensure title integrity: user uploaded maps must never display demo titles
  const cleanedItems = localItems.map((item) => {
    if (
      !item.isDemo &&
      (item.mapTitle === 'সাভার মৌজা নকশা - শীট ০১ (RS)' ||
        item.mapTitle === 'সাভার মৌজা নকশা - শীট ০১ (RS) [নমুনা]') &&
      item.originalFileName !== 'savar_rs_sheet_01_demo.png' &&
      item.originalFileName !== 'savar_rs_sheet_01.png'
    ) {
      return {
        ...item,
        mapTitle: `${item.mouzaNameBn || 'মৌজা'} নকশা - ${item.originalFileName}`,
      };
    }
    return item;
  });

  // Sort: Real uploaded maps (!isDemo) ALWAYS come first; demo maps appear at the end
  const sorted = [...cleanedItems].sort((a, b) => {
    if (Boolean(a.isDemo) !== Boolean(b.isDemo)) {
      return a.isDemo ? 1 : -1;
    }
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });

  if (isFirebaseConfigured && db) {
    try {
      const colRef = collection(db, 'mouzaMaps');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const cloudItems: MouzaMapLibraryItem[] = [];
        snap.forEach((d) => {
          cloudItems.push(normalizeMouzaMapDocument(d.data(), d.id));
        });

        // Merge cloud items with local items (cloud takes precedence for matching IDs)
        const cloudIds = new Set(cloudItems.map((i) => i.id));
        const merged = [...cloudItems, ...sorted.filter((i) => !cloudIds.has(i.id))];
        saveLocalMapLibrary(merged);
        return merged;
      }
    } catch (err) {
      console.warn('Firestore mouzaMaps read error, falling back to local dataset:', err);
    }
  }

  return sorted;
}

// ==========================================
// 3. UPLOAD MAP FILE TO SERVER (Firebase Storage + Firestore)
// ==========================================

export type UploadStatus =
  | 'Waiting'
  | 'Uploading'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface UploadProgressEvent {
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  status: UploadStatus;
  message?: string;
  error?: string;
  cloudStorage?: boolean;
}

export type UploadProgressCallback = (progress: UploadProgressEvent) => void;

export interface UploadCancellationToken {
  isCancelled: boolean;
  cancel: () => void;
}

export interface MapUploadPayload {
  file: File;
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
  surveyType: SurveyRecordType;
  sheetNumber: string;
  source: string;
  notes?: string;
  scale?: string;
  scalePixelsPerFoot?: number;
  uploadedBy: {
    uid: string;
    name: string;
    email?: string;
    role: string;
  };
  onProgress?: UploadProgressCallback;
  cancellationToken?: UploadCancellationToken;
}

export interface MapUploadResult {
  success: boolean;
  item?: MouzaMapLibraryItem;
  error?: string;
  cloudStorage: boolean;
  messageBn: string;
  messageEn: string;
}

/**
 * Reads a File in chunk slices, reporting real-time bytes read without fake timers.
 */
export async function readBlobInChunksWithProgress(
  file: File,
  onProgress?: (bytesRead: number, totalBytes: number) => void,
  cancellationToken?: UploadCancellationToken
): Promise<string> {
  const chunkSize = 256 * 1024; // 256 KB slices
  const totalBytes = file.size;
  let bytesRead = 0;
  const chunks: ArrayBuffer[] = [];

  while (bytesRead < totalBytes) {
    if (cancellationToken?.isCancelled) {
      throw new Error('Upload cancelled by user');
    }
    const end = Math.min(bytesRead + chunkSize, totalBytes);
    const slice = file.slice(bytesRead, end);
    const buffer = await slice.arrayBuffer();
    chunks.push(buffer);
    bytesRead = end;
    if (onProgress) {
      onProgress(bytesRead, totalBytes);
    }
  }

  const fullBlob = new Blob(chunks, { type: file.type || 'application/octet-stream' });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fullBlob);
  });
}

export async function uploadMouzaMapFile(
  payload: MapUploadPayload
): Promise<MapUploadResult> {
  const { file, uploadedBy } = payload;

  if (!file) {
    return {
      success: false,
      cloudStorage: false,
      error: 'No file provided',
      messageBn: 'কোনো ফাইল নির্বাচন করা হয়নি।',
      messageEn: 'No file was provided.',
    };
  }

  // Enforce security: Only Admin can upload maps
  if (uploadedBy.role !== 'admin') {
    return {
      success: false,
      cloudStorage: false,
      error: 'Permission denied: Only Admin can upload official mouza maps',
      messageBn: 'অনুমতি নেই: শুধু অনুমোদিত অ্যাডমিন মৌজা নকশা আপলোড করতে পারেন।',
      messageEn: 'Permission denied: Only authorized Admin can upload official mouza maps.',
    };
  }

  // Validate file extension
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = extension === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);

  if (!isPdf && !isImage) {
    return {
      success: false,
      cloudStorage: false,
      error: 'Invalid file format. Only PDF, JPG, JPEG, PNG are supported.',
      messageBn: 'অসমর্থিত ফাইল ফরম্যাট। শুধু PDF, JPG, JPEG, PNG ফাইল আপলোড করা যাবে।',
      messageEn: 'Unsupported file format. Only PDF, JPG, JPEG, and PNG files are supported.',
    };
  }

  const mapId = `map-${payload.districtId}-${payload.upazilaId}-${payload.jlNo}-${payload.surveyType}-${payload.sheetNumber}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '_');

  const fileSizeBytes = file.size;
  const fileSizeFormatted = formatFileSize(fileSizeBytes);
  const uploadDate = new Date().toISOString();

  // Initial Waiting notification
  payload.onProgress?.({
    fileId: mapId,
    fileName: file.name,
    fileSizeBytes,
    fileSizeFormatted,
    bytesTransferred: 0,
    totalBytes: fileSizeBytes,
    percentage: 0,
    status: 'Waiting',
  });

  // Attempt Firebase Cloud Storage upload if configured
  if (isFirebaseStorageConfigured && storage && storageRef && uploadBytesResumable && getDownloadURL) {
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `mouza_maps/${mapId}_${sanitizedName}`;
      const fileRef = storageRef(storage, path);

      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: 0,
        totalBytes: fileSizeBytes,
        percentage: 0,
        status: 'Uploading',
        cloudStorage: true,
      });

      const uploadTask = uploadBytesResumable(fileRef, file, {
        contentType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
        customMetadata: {
          mouzaName: payload.mouzaNameBn,
          jlNo: payload.jlNo,
          surveyType: payload.surveyType,
          sheetNumber: payload.sheetNumber,
          uploadedBy: uploadedBy.uid,
        },
      });

      if (payload.cancellationToken) {
        payload.cancellationToken.cancel = () => {
          if (payload.cancellationToken) {
            payload.cancellationToken.isCancelled = true;
          }
          try {
            uploadTask.cancel();
          } catch (cancelErr) {
            console.warn('Upload cancel warning:', cancelErr);
          }
        };
      }

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (payload.cancellationToken?.isCancelled) return;
            const bytesTransferred = snapshot.bytesTransferred;
            const total = snapshot.totalBytes || fileSizeBytes;
            const pct = total > 0 ? Math.min(100, Math.round((bytesTransferred / total) * 100)) : 0;
            payload.onProgress?.({
              fileId: mapId,
              fileName: file.name,
              fileSizeBytes,
              fileSizeFormatted,
              bytesTransferred,
              totalBytes: total,
              percentage: pct,
              status: pct === 100 ? 'Processing' : 'Uploading',
              message: pct === 100
                ? 'ক্লাউড স্টোরেজে ফাইল আপলোড সফল। মেটাডাটা প্রসেস করা হচ্ছে...'
                : undefined,
              cloudStorage: true,
            });
          },
          (storageErr) => {
            reject(storageErr);
          },
          () => {
            resolve();
          }
        );
      });

      if (payload.cancellationToken?.isCancelled) {
        payload.onProgress?.({
          fileId: mapId,
          fileName: file.name,
          fileSizeBytes,
          fileSizeFormatted,
          bytesTransferred: 0,
          totalBytes: fileSizeBytes,
          percentage: 0,
          status: 'Cancelled',
          error: 'Upload cancelled by user',
          cloudStorage: true,
        });
        return {
          success: false,
          cloudStorage: true,
          error: 'Upload cancelled by user',
          messageBn: 'আপলোড বাতিল করা হয়েছে।',
          messageEn: 'Upload cancelled.',
        };
      }

      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: fileSizeBytes,
        totalBytes: fileSizeBytes,
        percentage: 100,
        status: 'Processing',
        message: 'ক্লাউড স্টোরেজে ফাইল আপলোড সফল। Firestore মেটাডাটা সংরক্ষণ করা হচ্ছে...',
        cloudStorage: true,
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

      const record: MouzaMapLibraryItem = {
        id: mapId,
        mapTitle: payload.mapTitle || `${payload.mouzaNameBn} মৌজা নকশা - শীট ${payload.sheetNumber} (${payload.surveyType})`,
        divisionId: payload.divisionId,
        divisionNameBn: payload.divisionNameBn,
        districtId: payload.districtId,
        districtNameBn: payload.districtNameBn,
        upazilaId: payload.upazilaId,
        upazilaNameBn: payload.upazilaNameBn,
        unionId: payload.unionId,
        unionNameBn: payload.unionNameBn,
        mouzaNameBn: payload.mouzaNameBn.trim(),
        mouzaNameEn: payload.mouzaNameEn?.trim(),
        jlNo: payload.jlNo.trim(),
        surveyType: payload.surveyType,
        sheetNumber: payload.sheetNumber.trim(),
        originalFileName: file.name,
        fileType: isPdf ? 'pdf' : 'image',
        mimeType: file.type,
        fileSizeBytes,
        fileSizeFormatted,
        uploadDate,
        uploadedBy,
        source: payload.source.trim() || 'জেলা রেকর্ড রুম / নিজস্ব সংগ্রহ',
        verificationStatus: 'Uploaded',
        notes: payload.notes?.trim(),
        fileReference: downloadUrl,
        storageBucketPath: path,
        storageProvider: 'firebase_storage',
        scale: payload.scale || '16" = 1 mile',
        scalePixelsPerFoot: payload.scalePixelsPerFoot || 1.0,
        georeferencingStatus: 'none',
        isDemo: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save document to Firestore
      if (db) {
        await setDoc(doc(db, 'mouzaMaps', mapId), record);
      }

      // Also update local cache
      const currentLocal = getLocalMapLibrary();
      saveLocalMapLibrary([record, ...currentLocal]);

      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: fileSizeBytes,
        totalBytes: fileSizeBytes,
        percentage: 100,
        status: 'Completed',
        message: 'ক্লাউড স্টোরেজ ও মেটাডাটা উভয়ই সফলভাবে সংরক্ষিত হয়েছে।',
        cloudStorage: true,
      });

      return {
        success: true,
        item: record,
        cloudStorage: true,
        messageBn: 'মৌজা নকশাটি সফলভাবে Firebase ক্লাউড স্টোরেজে আপলোড ও সংরক্ষিত হয়েছে।',
        messageEn: 'Mouza map successfully uploaded and saved to Firebase Cloud Storage.',
      };
    } catch (storageErr: any) {
      if (payload.cancellationToken?.isCancelled || storageErr?.code === 'storage/canceled') {
        payload.onProgress?.({
          fileId: mapId,
          fileName: file.name,
          fileSizeBytes,
          fileSizeFormatted,
          bytesTransferred: 0,
          totalBytes: fileSizeBytes,
          percentage: 0,
          status: 'Cancelled',
          error: 'Upload cancelled by user',
          cloudStorage: true,
        });
        return {
          success: false,
          cloudStorage: true,
          error: 'Upload cancelled by user',
          messageBn: 'আপলোড বাতিল করা হয়েছে।',
          messageEn: 'Upload cancelled.',
        };
      }

      console.warn('Firebase Storage upload encountered error:', storageErr);

      let friendlyErrorBn = 'Firebase ক্লাউড স্টোরেজে ফাইল আপলোড সম্পন্ন করা যায়নি।';
      let friendlyErrorEn = 'Failed to upload file to Firebase Cloud Storage.';
      if (storageErr?.code === 'storage/unauthorized') {
        friendlyErrorBn = 'ক্লাউড স্টোরেজে আপলোডের অনুমতি নেই (Permission Denied)।';
        friendlyErrorEn = 'Permission denied for Firebase Cloud Storage.';
      } else if (storageErr?.code === 'storage/quota-exceeded') {
        friendlyErrorBn = 'ক্লাউড স্টোরেজ কোটা শেষ হয়ে গেছে।';
        friendlyErrorEn = 'Firebase Storage quota exceeded.';
      } else if (storageErr?.code === 'storage/retry-limit-exceeded') {
        friendlyErrorBn = 'নেটওয়ার্ক সংযোগ বিঘ্নিত হয়েছে। পুনরায় চেষ্টা করুন।';
        friendlyErrorEn = 'Network connection timed out. Please retry.';
      } else if (storageErr?.message) {
        friendlyErrorBn = `আপলোড ব্যর্থ: ${storageErr.message}`;
        friendlyErrorEn = `Upload failed: ${storageErr.message}`;
      }

      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: 0,
        totalBytes: fileSizeBytes,
        percentage: 0,
        status: 'Failed',
        error: friendlyErrorBn,
        cloudStorage: true,
      });

      return {
        success: false,
        cloudStorage: true,
        error: friendlyErrorBn,
        messageBn: friendlyErrorBn,
        messageEn: friendlyErrorEn,
      };
    }
  }

  // Fallback to local IndexedDB storage for offline field work and quota-safe storage
  try {
    if (payload.cancellationToken?.isCancelled) {
      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: 0,
        totalBytes: fileSizeBytes,
        percentage: 0,
        status: 'Cancelled',
        error: 'Upload cancelled by user',
        cloudStorage: false,
      });
      return {
        success: false,
        cloudStorage: false,
        error: 'Upload cancelled by user',
        messageBn: 'আপলোড বাতিল করা হয়েছে।',
        messageEn: 'Upload cancelled.',
      };
    }

    payload.onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes,
      fileSizeFormatted,
      bytesTransferred: 0,
      totalBytes: fileSizeBytes,
      percentage: 0,
      status: 'Uploading',
      cloudStorage: false,
    });

    const fileId = `offline-${mapId}`;
    const uploadedMapFile: UploadedMapFile = {
      id: fileId,
      name: file.name,
      fileType: isPdf ? 'pdf' : 'image',
      mimeType: file.type,
      size: fileSizeBytes,
      sizeFormatted: fileSizeFormatted,
      uploadedAt: uploadDate,
      category: payload.surveyType === 'CS' || payload.surveyType === 'SA' ? 'cs_map' : 'bs_map',
      notes: `${payload.districtNameBn} - ${payload.upazilaNameBn} - ${payload.mouzaNameBn} (জে.এল. ${payload.jlNo}, শীট ${payload.sheetNumber})`,
    };

    // Read file in chunks with actual byte progress
    const dataUrl = await readBlobInChunksWithProgress(
      file,
      (bytesRead, totalBytes) => {
        const pct = totalBytes > 0 ? Math.min(99, Math.round((bytesRead / totalBytes) * 100)) : 0;
        payload.onProgress?.({
          fileId: mapId,
          fileName: file.name,
          fileSizeBytes,
          fileSizeFormatted,
          bytesTransferred: bytesRead,
          totalBytes,
          percentage: pct,
          status: 'Uploading',
          cloudStorage: false,
        });
      },
      payload.cancellationToken
    );
    uploadedMapFile.dataUrl = dataUrl;

    if (payload.cancellationToken?.isCancelled) {
      payload.onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes,
        fileSizeFormatted,
        bytesTransferred: 0,
        totalBytes: fileSizeBytes,
        percentage: 0,
        status: 'Cancelled',
        error: 'Upload cancelled by user',
        cloudStorage: false,
      });
      return {
        success: false,
        cloudStorage: false,
        error: 'Upload cancelled by user',
        messageBn: 'আপলোড বাতিল করা হয়েছে।',
        messageEn: 'Upload cancelled.',
      };
    }

    payload.onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes,
      fileSizeFormatted,
      bytesTransferred: fileSizeBytes,
      totalBytes: fileSizeBytes,
      percentage: 99,
      status: 'Processing',
      message: 'সুরক্ষিত IndexedDB লোকাল ডেটাবেসে ফাইল ও মেটাডাটা সংরক্ষণ করা হচ্ছে...',
      cloudStorage: false,
    });

    // Store binary in IndexedDB without localStorage Base64 pollution
    await saveMapFile(uploadedMapFile);
    await idbPut({ ...uploadedMapFile, id: mapId });

    const record: MouzaMapLibraryItem = {
      id: mapId,
      mapTitle: payload.mapTitle || `${payload.mouzaNameBn} মৌজা নকশা - শীট ${payload.sheetNumber} (${payload.surveyType})`,
      divisionId: payload.divisionId,
      divisionNameBn: payload.divisionNameBn,
      districtId: payload.districtId,
      districtNameBn: payload.districtNameBn,
      upazilaId: payload.upazilaId,
      upazilaNameBn: payload.upazilaNameBn,
      unionId: payload.unionId,
      unionNameBn: payload.unionNameBn,
      mouzaNameBn: payload.mouzaNameBn.trim(),
      mouzaNameEn: payload.mouzaNameEn?.trim(),
      jlNo: payload.jlNo.trim(),
      surveyType: payload.surveyType,
      sheetNumber: payload.sheetNumber.trim(),
      originalFileName: file.name,
      fileType: isPdf ? 'pdf' : 'image',
      mimeType: file.type,
      fileSizeBytes,
      fileSizeFormatted,
      uploadDate,
      uploadedBy,
      source: payload.source.trim() || 'অফলাইন ব্রাউজার সংগ্রহ',
      verificationStatus: 'Uploaded',
      notes: payload.notes?.trim(),
      fileReference: fileId, // References IndexedDB stored file
      storageProvider: 'indexeddb_offline',
      scale: payload.scale || '16" = 1 mile',
      scalePixelsPerFoot: payload.scalePixelsPerFoot || 1.0,
      georeferencingStatus: 'none',
      isDemo: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const currentLocal = getLocalMapLibrary();
    saveLocalMapLibrary([record, ...currentLocal]);

    payload.onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes,
      fileSizeFormatted,
      bytesTransferred: fileSizeBytes,
      totalBytes: fileSizeBytes,
      percentage: 100,
      status: 'Completed',
      message: 'ফাইল ও মেটাডাটা সফলভাবে IndexedDB-তে সংরক্ষিত হয়েছে।',
      cloudStorage: false,
    });

    return {
      success: true,
      item: record,
      cloudStorage: false,
      messageBn:
        'ক্লাউড স্টোরেজ সংযোগ না থাকায় ফাইলটি সুরক্ষিতভাবে ব্রাউজারের অফলাইন IndexedDB-তে সংরক্ষিত হয়েছে (কোনো অসত্য ক্লাউড আপলোড দাবি করা হয়নি)।',
      messageEn:
        'Saved to secure local IndexedDB as cloud storage is not connected (no fake cloud upload claimed).',
    };
  } catch (offlineErr: any) {
    const isCancelled = payload.cancellationToken?.isCancelled || offlineErr?.message?.includes('cancelled');
    const errMsg = offlineErr instanceof Error ? offlineErr.message : String(offlineErr);

    payload.onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes,
      fileSizeFormatted,
      bytesTransferred: 0,
      totalBytes: fileSizeBytes,
      percentage: 0,
      status: isCancelled ? 'Cancelled' : 'Failed',
      error: errMsg,
      cloudStorage: false,
    });

    return {
      success: false,
      cloudStorage: false,
      error: errMsg,
      messageBn: isCancelled ? 'আপলোড বাতিল করা হয়েছে।' : 'ফাইল সংরক্ষণ ব্যর্থ হয়েছে। নেটওয়ার্ক ও মেমোরি পরীক্ষা করুন।',
      messageEn: isCancelled ? 'Upload cancelled.' : 'Failed to store map file.',
    };
  }
}

// ==========================================
// 4. VERIFICATION STATUS MANAGEMENT
// ==========================================

export async function updateMapVerificationStatus(
  mapId: string,
  status: MapCatalogStatus,
  verifier: { uid: string; name: string; email?: string; role: string },
  verificationNotes?: string
): Promise<{ success: boolean; error?: string }> {
  // Enforce security: Only Admin can verify or change status
  if (verifier.role !== 'admin') {
    return {
      success: false,
      error: 'Only an authorized Admin can verify or modify map status.',
    };
  }

  const verifierInfo = {
    uid: verifier.uid,
    name: verifier.name,
    email: verifier.email,
    date: new Date().toISOString().split('T')[0],
    notes: verificationNotes || undefined,
  };

  // Update in Firestore if available
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'mouzaMaps', mapId);
      await updateDoc(docRef, {
        verificationStatus: status,
        verifiedBy: verifierInfo,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Firestore update status failed, updating local copy:', err);
    }
  }

  // Update local cache
  const items = getLocalMapLibrary();
  const idx = items.findIndex((x) => x.id === mapId);
  if (idx >= 0) {
    items[idx] = {
      ...items[idx],
      verificationStatus: status,
      verifiedBy: verifierInfo,
      updatedAt: Date.now(),
    };
    saveLocalMapLibrary(items);
  }

  return { success: true };
}

// ==========================================
// 5. DELETE MAP LIBRARY ITEM
// ==========================================

export async function deleteMapLibraryItem(
  item: MouzaMapLibraryItem,
  user: { uid: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  if (user.role !== 'admin') {
    return {
      success: false,
      error: 'Permission denied: Only Admin can delete library maps.',
    };
  }

  // 1. Delete from Firebase Storage if path exists
  if (item.storageBucketPath && storage && deleteObject && storageRef) {
    try {
      const ref = storageRef(storage, item.storageBucketPath);
      await deleteObject(ref);
    } catch (err) {
      console.warn('Firebase Storage delete warning:', err);
    }
  }

  // 2. Delete from IndexedDB if stored locally
  if (item.storageProvider === 'indexeddb_offline' && item.fileReference) {
    try {
      await deleteMapFile(item.fileReference);
    } catch (err) {
      console.warn('IndexedDB delete warning:', err);
    }
  }

  // 3. Delete from Firestore
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'mouzaMaps', item.id));
    } catch (err) {
      console.warn('Firestore delete warning:', err);
    }
  }

  // 4. Delete from local cache
  const filtered = getLocalMapLibrary().filter((x) => x.id !== item.id);
  saveLocalMapLibrary(filtered);

  return { success: true };
}

// ==========================================
// 6. EXTERNAL SOURCE DIRECTORY
// ==========================================

export function getExternalMapSources(): ExternalMapSourceRecord[] {
  try {
    const raw = localStorage.getItem(EXTERNAL_SOURCES_KEY);
    if (!raw) {
      localStorage.setItem(EXTERNAL_SOURCES_KEY, JSON.stringify(INITIAL_EXTERNAL_SOURCES));
      return INITIAL_EXTERNAL_SOURCES;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_EXTERNAL_SOURCES;
  }
}

export function saveExternalMapSource(
  source: ExternalMapSourceRecord,
  user: { role: string }
): { success: boolean; error?: string } {
  if (user.role !== 'admin') {
    return { success: false, error: 'Only Admin can modify external source links.' };
  }

  try {
    const list = getExternalMapSources();
    const idx = list.findIndex((x) => x.id === source.id);
    if (idx >= 0) {
      list[idx] = source;
    } else {
      list.push(source);
    }
    localStorage.setItem(EXTERNAL_SOURCES_KEY, JSON.stringify(list));
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to save source.' };
  }
}

export function deleteExternalMapSource(
  id: string,
  user: { role: string }
): { success: boolean; error?: string } {
  if (user.role !== 'admin') {
    return { success: false, error: 'Only Admin can remove external source links.' };
  }

  try {
    const list = getExternalMapSources().filter((x) => x.id !== id);
    localStorage.setItem(EXTERNAL_SOURCES_KEY, JSON.stringify(list));
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to delete source.' };
  }
}

// ==========================================
// 7. BULK METADATA IMPORT ARCHITECTURE
// ==========================================

export function validateAndParseBulkMapMetadata(
  content: string,
  format: 'csv' | 'json',
  user: { uid: string; name: string; role: string }
): BulkMapImportValidationResult {
  const errors: string[] = [];
  const records: MouzaMapLibraryItem[] = [];
  let duplicatesCount = 0;
  let missingFileCount = 0;

  if (user.role !== 'admin') {
    return {
      total: 0,
      validCount: 0,
      rejectedCount: 1,
      duplicateCount: 0,
      missingFileCount: 0,
      errors: ['অনুমতি নেই: শুধু অ্যাডমিন বাল্ক মেটাডাটা ইম্পোর্ট করতে পারেন।'],
      records: [],
    };
  }

  const existingItems = getLocalMapLibrary();
  const existingKeys = new Set(
    existingItems.map((r) =>
      `${r.districtId}_${r.upazilaId}_${r.mouzaNameBn}_${r.jlNo}_${r.surveyType}_${r.sheetNumber}`.toLowerCase()
    )
  );

  const VALID_SURVEY_TYPES: SurveyRecordType[] = [
    'CS',
    'SA',
    'RS',
    'BS',
    'BRS',
    'City',
    'Diara',
    'Other',
  ];

  if (format === 'json') {
    let rawItems: any[] = [];
    try {
      rawItems = JSON.parse(content);
      if (!Array.isArray(rawItems)) rawItems = [rawItems];
    } catch (e) {
      return {
        total: 0,
        validCount: 0,
        rejectedCount: 1,
        duplicateCount: 0,
        missingFileCount: 0,
        errors: ['অবৈধ JSON ফরম্যাট। অনুগ্রহ করে সঠিক JSON তালিকা প্রদান করুন।'],
        records: [],
      };
    }

    rawItems.forEach((item, index) => {
      const lineNo = index + 1;
      const districtName = item.districtNameBn || item.district;
      const upazilaName = item.upazilaNameBn || item.upazila;
      const mouzaNameBn = item.mouzaNameBn || item.mouza;
      const jlNo = String(item.jlNo || item.jl || '').trim();
      const sheetNumber = String(item.sheetNumber || item.sheet || '০১').trim();
      const surveyTypeRaw = (item.surveyType || item.type || 'RS').toUpperCase();

      if (!districtName || !upazilaName || !mouzaNameBn || !jlNo) {
        errors.push(`আইটেম #${lineNo}: জেলা, উপজেলা, মৌজা এবং জে.এল. নম্বর আবশ্যক।`);
        return;
      }

      const dist = findDistrictByName(districtName) || getDistrictById(districtName);
      if (!dist) {
        errors.push(`আইটেম #${lineNo}: জেলা '${districtName}' সনাক্ত করা যায়নি।`);
        return;
      }

      const upz = findUpazilaByName(dist.id, upazilaName) || getUpazilaById(upazilaName);
      if (!upz) {
        errors.push(`আইটেম #${lineNo}: উপজেলা '${upazilaName}' জেলা '${dist.nameBn}'-এ পাওয়া যায়নি।`);
        return;
      }

      const surveyType = (VALID_SURVEY_TYPES.includes(surveyTypeRaw as any)
        ? surveyTypeRaw
        : 'Other') as SurveyRecordType;

      const div = getDivisionById(dist.divisionId);
      const key = `${dist.id}_${upz.id}_${mouzaNameBn}_${jlNo}_${surveyType}_${sheetNumber}`.toLowerCase();

      if (existingKeys.has(key)) {
        duplicatesCount++;
        return;
      }

      const hasFileRef = Boolean(item.fileReference && String(item.fileReference).trim().length > 0);
      if (!hasFileRef) {
        missingFileCount++;
      }

      const mapId = `map-imp-${dist.id}-${upz.id}-${jlNo}-${surveyType}-${sheetNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '_');

      const rec: MouzaMapLibraryItem = {
        id: mapId,
        mapTitle:
          item.mapTitle ||
          `${mouzaNameBn} মৌজা নকশা - শীট ${sheetNumber} (${surveyType})`,
        divisionId: div?.id || dist.divisionId,
        divisionNameBn: div?.nameBn || '',
        districtId: dist.id,
        districtNameBn: dist.nameBn,
        upazilaId: upz.id,
        upazilaNameBn: upz.nameBn,
        unionNameBn: item.unionNameBn || item.union,
        mouzaNameBn: mouzaNameBn.trim(),
        mouzaNameEn: item.mouzaNameEn?.trim(),
        jlNo,
        surveyType,
        sheetNumber,
        originalFileName: item.originalFileName || `${mouzaNameBn}_${surveyType}_${sheetNumber}.png`,
        fileType: item.fileType === 'pdf' ? 'pdf' : 'image',
        mimeType: item.fileType === 'pdf' ? 'application/pdf' : 'image/png',
        fileSizeBytes: item.fileSizeBytes || 0,
        fileSizeFormatted: item.fileSizeBytes ? formatFileSize(item.fileSizeBytes) : 'ফাইল অনুপস্থিত',
        uploadDate: new Date().toISOString(),
        uploadedBy: {
          uid: user.uid,
          name: user.name,
          role: user.role,
        },
        source: item.source || 'বাল্ক মেটাডাটা আমদানি',
        // CRITICAL: If no file attached, mark status as Missing File!
        verificationStatus: hasFileRef ? 'Needs Review' : 'Missing File',
        notes: item.notes || (hasFileRef ? 'আমদানিকৃত মেটাডাটা' : 'ফাইল সংযুক্তিহীন মেটাডাটা (Missing File)'),
        fileReference: item.fileReference || '',
        storageProvider: hasFileRef ? 'external_ref' : 'none',
        scale: item.scale || '16" = 1 mile',
        scalePixelsPerFoot: item.scalePixelsPerFoot || 1.0,
        georeferencingStatus: 'none',
        isDemo: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      existingKeys.add(key);
      records.push(rec);
    });

    return {
      total: rawItems.length,
      validCount: records.length,
      rejectedCount: errors.length,
      duplicateCount: duplicatesCount,
      missingFileCount,
      errors,
      records,
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
      validCount: 0,
      rejectedCount: 1,
      duplicateCount: 0,
      missingFileCount: 0,
      errors: ['CSV ফাইলে হেডার ও ন্যূনতম একটি ডেটা সারি আবশ্যক।'],
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
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const cleanParts = parts.map((p) => p.trim().replace(/^"|"$/g, ''));

    const districtName = getCol(cleanParts, 'district') || getCol(cleanParts, 'districtnamebn');
    const upazilaName = getCol(cleanParts, 'upazila') || getCol(cleanParts, 'upazilanamebn');
    const mouzaNameBn = getCol(cleanParts, 'mouza') || getCol(cleanParts, 'mouzanamebn');
    const jlNo = getCol(cleanParts, 'jlno') || getCol(cleanParts, 'jl');
    const sheetNumber = getCol(cleanParts, 'sheetnumber') || getCol(cleanParts, 'sheet') || '০১';
    const surveyTypeRaw = (getCol(cleanParts, 'surveytype') || getCol(cleanParts, 'type') || 'RS').toUpperCase();
    const fileReference = getCol(cleanParts, 'filereference') || getCol(cleanParts, 'file');

    if (!districtName || !upazilaName || !mouzaNameBn || !jlNo) {
      errors.push(`সারি #${lineNo}: জেলা, উপজেলা, মৌজা এবং জে.এল. নম্বর আবশ্যক।`);
      return;
    }

    const dist = findDistrictByName(districtName) || getDistrictById(districtName);
    if (!dist) {
      errors.push(`সারি #${lineNo}: জেলা '${districtName}' সনাক্ত করা যায়নি।`);
      return;
    }

    const upz = findUpazilaByName(dist.id, upazilaName) || getUpazilaById(upazilaName);
    if (!upz) {
      errors.push(`সারি #${lineNo}: উপজেলা '${upazilaName}' জেলা '${dist.nameBn}'-এ পাওয়া যায়নি।`);
      return;
    }

    const surveyType = (VALID_SURVEY_TYPES.includes(surveyTypeRaw as any)
      ? surveyTypeRaw
      : 'Other') as SurveyRecordType;

    const div = getDivisionById(dist.divisionId);
    const key = `${dist.id}_${upz.id}_${mouzaNameBn}_${jlNo}_${surveyType}_${sheetNumber}`.toLowerCase();

    if (existingKeys.has(key)) {
      duplicatesCount++;
      return;
    }

    const hasFileRef = Boolean(fileReference && fileReference.trim().length > 0);
    if (!hasFileRef) {
      missingFileCount++;
    }

    const mapId = `map-imp-${dist.id}-${upz.id}-${jlNo}-${surveyType}-${sheetNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '_');

    const rec: MouzaMapLibraryItem = {
      id: mapId,
      mapTitle: `${mouzaNameBn} মৌজা নকশা - শীট ${sheetNumber} (${surveyType})`,
      divisionId: div?.id || dist.divisionId,
      divisionNameBn: div?.nameBn || '',
      districtId: dist.id,
      districtNameBn: dist.nameBn,
      upazilaId: upz.id,
      upazilaNameBn: upz.nameBn,
      unionNameBn: getCol(cleanParts, 'union') || undefined,
      mouzaNameBn: mouzaNameBn.trim(),
      mouzaNameEn: getCol(cleanParts, 'mouzanameen') || undefined,
      jlNo,
      surveyType,
      sheetNumber,
      originalFileName: `${mouzaNameBn}_${surveyType}_${sheetNumber}.png`,
      fileType: 'image',
      fileSizeBytes: 0,
      fileSizeFormatted: hasFileRef ? 'রেফারেন্স ফাইল' : 'ফাইল অনুপস্থিত',
      uploadDate: new Date().toISOString(),
      uploadedBy: {
        uid: user.uid,
        name: user.name,
        role: user.role,
      },
      source: getCol(cleanParts, 'source') || 'CSV বাল্ক মেটাডাটা আমদানি',
      verificationStatus: hasFileRef ? 'Needs Review' : 'Missing File',
      notes: getCol(cleanParts, 'notes') || (hasFileRef ? 'CSV আমদানিকৃত রেকর্ড' : 'ফাইল সংযুক্তিহীন মেটাডাটা (Missing File)'),
      fileReference: fileReference || '',
      storageProvider: hasFileRef ? 'external_ref' : 'none',
      scale: '16" = 1 mile',
      scalePixelsPerFoot: 1.0,
      georeferencingStatus: 'none',
      isDemo: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    existingKeys.add(key);
    records.push(rec);
  });

  return {
    total: dataLines.length,
    validCount: records.length,
    rejectedCount: errors.length,
    duplicateCount: duplicatesCount,
    missingFileCount,
    errors,
    records,
  };
}

export function saveBulkImportedMapRecords(
  records: MouzaMapLibraryItem[]
): void {
  const current = getLocalMapLibrary();
  saveLocalMapLibrary([...records, ...current]);
}

export function getBulkMapCsvTemplate(): string {
  return `district,upazila,mouza,jlNo,surveyType,sheetNumber,fileReference,notes
ঢাকা,সাভার,সাভার,২৪,RS,০১,,সাভার বাজার এলাকা
ঢাকা,খিলগাঁও,খিলগাঁও,২৮৮,CS,০১,,খিলগাঁও মৌজা
ফেনী,ফেনী সদর,রামপুর,৪৫,CS,০১,,রামপুর মৌজা
কুমিল্লা,আদর্শ সদর,কান্দিরপাড়,১২,RS,০১,,কান্দিরপাড় মৌজা`;
}

export function getBulkMapJsonTemplate(): string {
  return JSON.stringify(
    [
      {
        districtNameBn: 'ঢাকা',
        upazilaNameBn: 'সাভার',
        mouzaNameBn: 'সাভার',
        jlNo: '২৪',
        surveyType: 'RS',
        sheetNumber: '০১',
        fileReference: '',
        notes: 'সাভার বাজার সংলগ্ন আরএস জরিপ',
      },
      {
        districtNameBn: 'ফেনী',
        upazilaNameBn: 'ফেনী সদর',
        mouzaNameBn: 'রামপুর',
        jlNo: '৪৫',
        surveyType: 'CS',
        sheetNumber: '০১',
        fileReference: '',
        notes: 'রামপুর সিএস নকশা',
      },
    ],
    null,
    2
  );
}

// ==========================================
// 8. RELINK / REPLACE MAP FILE (Preserving Mouza/JL Metadata)
// ==========================================

export async function relinkMapFile(
  mapId: string,
  file: File,
  user: { uid: string; name: string; role: string },
  onProgress?: UploadProgressCallback,
  cancellationToken?: UploadCancellationToken
): Promise<{ success: boolean; item?: MouzaMapLibraryItem; error?: string }> {
  try {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = extension === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);

    if (!isPdf && !isImage) {
      return {
        success: false,
        error: 'অসমর্থিত ফরম্যাট। শুধু PDF, JPG, JPEG, PNG ফাইল রিলিংক করা যাবে।',
      };
    }

    onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeFormatted: formatFileSize(file.size),
      bytesTransferred: 0,
      totalBytes: file.size,
      percentage: 0,
      status: 'Uploading',
    });

    const dataUrl = await readBlobInChunksWithProgress(
      file,
      (bytesRead, totalBytes) => {
        const pct = totalBytes > 0 ? Math.min(99, Math.round((bytesRead / totalBytes) * 100)) : 0;
        onProgress?.({
          fileId: mapId,
          fileName: file.name,
          fileSizeBytes: file.size,
          fileSizeFormatted: formatFileSize(file.size),
          bytesTransferred: bytesRead,
          totalBytes,
          percentage: pct,
          status: 'Uploading',
        });
      },
      cancellationToken
    );

    onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeFormatted: formatFileSize(file.size),
      bytesTransferred: file.size,
      totalBytes: file.size,
      percentage: 99,
      status: 'Processing',
      message: 'রিলিংক ফাইল প্রতিস্থাপন ও সেভ হচ্ছে...',
    });

    const fileId = `offline-${mapId}`;
    const uploadedMapFile: UploadedMapFile = {
      id: fileId,
      name: file.name,
      fileType: isPdf ? 'pdf' : 'image',
      mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      uploadedAt: new Date().toISOString(),
      category: isPdf ? 'cs_map' : 'bs_map',
      dataUrl,
    };

    // Save in IndexedDB under both fileId and mapId
    await saveMapFile(uploadedMapFile);
    await idbPut({ ...uploadedMapFile, id: mapId });

    // Update in local cache
    const items = getLocalMapLibrary();
    const idx = items.findIndex((x) => x.id === mapId);
    if (idx >= 0) {
      const updated: MouzaMapLibraryItem = {
        ...items[idx],
        originalFileName: file.name,
        fileType: isPdf ? 'pdf' : 'image',
        mimeType: file.type || (isPdf ? 'application/pdf' : 'image/png'),
        fileSizeBytes: file.size,
        fileSizeFormatted: formatFileSize(file.size),
        fileReference: fileId,
        storageProvider: 'indexeddb_offline',
        verificationStatus: 'Uploaded',
        updatedAt: Date.now(),
      };

      items[idx] = updated;
      saveLocalMapLibrary(items);

      if (isFirebaseConfigured && db) {
        try {
          await updateDoc(doc(db, 'mouzaMaps', mapId), {
            originalFileName: file.name,
            fileType: isPdf ? 'pdf' : 'image',
            mimeType: file.type,
            fileSizeBytes: file.size,
            fileSizeFormatted: formatFileSize(file.size),
            fileReference: fileId,
            storageProvider: 'indexeddb_offline',
            verificationStatus: 'Uploaded',
            updatedAt: Date.now(),
          });
        } catch (e) {
          console.warn('Failed to update Firestore during relink:', e);
        }
      }

      onProgress?.({
        fileId: mapId,
        fileName: file.name,
        fileSizeBytes: file.size,
        fileSizeFormatted: formatFileSize(file.size),
        bytesTransferred: file.size,
        totalBytes: file.size,
        percentage: 100,
        status: 'Completed',
        message: 'ফাইল সফলভাবে রিলিংক ও আপডেট হয়েছে।',
      });

      return { success: true, item: updated };
    }

    return { success: false, error: 'ম্যাপ রেকর্ডটি খুঁজে পাওয়া যায়নি।' };
  } catch (err: any) {
    const isCancelled = cancellationToken?.isCancelled;
    const errMsg = err instanceof Error ? err.message : String(err);
    onProgress?.({
      fileId: mapId,
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeFormatted: formatFileSize(file.size),
      bytesTransferred: 0,
      totalBytes: file.size,
      percentage: 0,
      status: isCancelled ? 'Cancelled' : 'Failed',
      error: errMsg,
    });
    return {
      success: false,
      error: errMsg,
    };
  }
}

// ==========================================
// 9. SMART SEARCH & MATCH HELPERS (Bengali & English Numeral Agnostic)
// ==========================================

export function matchesSearchQuery(
  target: string | undefined | null,
  query: string
): boolean {
  if (!target || !query) return false;
  const t = String(target).toLowerCase().trim();
  const q = String(query).toLowerCase().trim();
  if (t.includes(q)) return true;

  // Bengali numerals to English numerals
  const bnToEn = (str: string) =>
    str.replace(/[০-৯]/g, (d) => ({
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    }[d] || d));

  // English numerals to Bengali numerals
  const enToBn = (str: string) =>
    str.replace(/[0-9]/g, (d) => ({
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
    }[d] || d));

  const tEn = bnToEn(t);
  const qEn = bnToEn(q);
  if (tEn.includes(qEn)) return true;

  const tBn = enToBn(t);
  const qBn = enToBn(q);
  if (tBn.includes(qBn)) return true;

  // Leading zeroes normalization for sheet numbers and JL numbers (e.g. '01' === '1' or '০১' === '১')
  const tNumOnly = tEn.replace(/[^0-9]/g, '').replace(/^0+/, '');
  const qNumOnly = qEn.replace(/[^0-9]/g, '').replace(/^0+/, '');
  if (tNumOnly && qNumOnly && tNumOnly === qNumOnly) {
    return true;
  }

  return false;
}

// ==========================================
// 10. SMART CASCADE SEARCH FILTER
// ==========================================

export function filterMouzaMapLibrary(
  items: MouzaMapLibraryItem[],
  criteria: MapSearchFilterCriteria,
  availableOnly: boolean = false
): MouzaMapLibraryItem[] {
  const hasActiveQuery = Boolean(criteria.searchQuery && criteria.searchQuery.trim());

  return items.filter((item) => {
    // 1. Available-only filter: Hide items that have "Missing File" and no file reference
    // Exception: If the user is actively typing a search query, do NOT suppress search results
    const hasFile = Boolean(
      item.fileReference ||
      item.storageUrl ||
      item.fileRef ||
      item.downloadUrl ||
      item.storageBucketPath
    );

    if (availableOnly && !hasActiveQuery) {
      if (!hasFile || item.verificationStatus === 'Missing File') {
        return false;
      }
    }

    // 2. Division Cascade
    if (criteria.divisionId && criteria.divisionId !== 'all') {
      const divObj = getDivisionById(criteria.divisionId);
      const matchesDiv =
        item.divisionId === criteria.divisionId ||
        (divObj && item.divisionId === divObj.id) ||
        (item.divisionNameBn && divObj?.nameBn && matchesSearchQuery(item.divisionNameBn, divObj.nameBn)) ||
        (item.divisionNameBn && divObj?.nameEn && matchesSearchQuery(item.divisionNameBn, divObj.nameEn)) ||
        matchesSearchQuery(item.divisionNameBn, criteria.divisionId);
      if (!matchesDiv) return false;
    }

    // 3. District Cascade
    if (criteria.districtId && criteria.districtId !== 'all') {
      const distObj = getDistrictById(criteria.districtId) || findDistrictByName(criteria.districtId);
      const matchesDist =
        item.districtId === criteria.districtId ||
        (distObj && item.districtId === distObj.id) ||
        (item.districtNameBn && distObj?.nameBn && matchesSearchQuery(item.districtNameBn, distObj.nameBn)) ||
        (item.districtNameBn && distObj?.nameEn && matchesSearchQuery(item.districtNameBn, distObj.nameEn)) ||
        matchesSearchQuery(item.districtNameBn, criteria.districtId);
      if (!matchesDist) return false;
    }

    // 4. Upazila Cascade
    if (criteria.upazilaId && criteria.upazilaId !== 'all') {
      const upzObj = getUpazilaById(criteria.upazilaId) || findUpazilaByName(criteria.upazilaId);
      const matchesUpz =
        item.upazilaId === criteria.upazilaId ||
        (upzObj && item.upazilaId === upzObj.id) ||
        (item.upazilaNameBn && upzObj?.nameBn && matchesSearchQuery(item.upazilaNameBn, upzObj.nameBn)) ||
        (item.upazilaNameBn && upzObj?.nameEn && matchesSearchQuery(item.upazilaNameBn, upzObj.nameEn)) ||
        matchesSearchQuery(item.upazilaNameBn, criteria.upazilaId);
      if (!matchesUpz) return false;
    }

    // 5. Mouza Name
    if (criteria.mouzaNameBn && criteria.mouzaNameBn.trim()) {
      const q = criteria.mouzaNameBn.trim();
      const matchBn = matchesSearchQuery(item.mouzaNameBn, q);
      const matchEn = matchesSearchQuery(item.mouzaNameEn, q);
      if (!matchBn && !matchEn) return false;
    }

    // 6. JL Number (Bangla & English numerals supported)
    if (criteria.jlNo && criteria.jlNo.trim()) {
      if (!matchesSearchQuery(item.jlNo, criteria.jlNo.trim())) return false;
    }

    // 7. Survey Type
    if (criteria.surveyType && criteria.surveyType !== 'all') {
      if (item.surveyType.toUpperCase() !== criteria.surveyType.toUpperCase()) return false;
    }

    // 8. Sheet Number (Bangla & English numerals supported)
    if (criteria.sheetNumber && criteria.sheetNumber.trim() && criteria.sheetNumber !== 'all') {
      if (!matchesSearchQuery(item.sheetNumber, criteria.sheetNumber.trim())) return false;
    }

    // 9. Verification Status
    if (criteria.verificationStatus && criteria.verificationStatus !== 'all') {
      if (item.verificationStatus !== criteria.verificationStatus) return false;
    }

    // 10. General text search query across ALL map attributes
    if (hasActiveQuery) {
      const q = criteria.searchQuery.trim();
      const match =
        matchesSearchQuery(item.mapTitle, q) ||
        matchesSearchQuery(item.originalFileName, q) ||
        matchesSearchQuery(item.mouzaNameBn, q) ||
        matchesSearchQuery(item.mouzaNameEn, q) ||
        matchesSearchQuery(item.jlNo, q) ||
        matchesSearchQuery(item.sheetNumber, q) ||
        matchesSearchQuery(item.districtNameBn, q) ||
        matchesSearchQuery(item.upazilaNameBn, q) ||
        matchesSearchQuery(item.divisionNameBn, q) ||
        matchesSearchQuery(item.surveyType, q) ||
        matchesSearchQuery(item.source, q) ||
        matchesSearchQuery(item.notes, q) ||
        matchesSearchQuery(item.id, q) ||
        matchesSearchQuery(item.storageUrl, q) ||
        matchesSearchQuery(item.fileRef, q) ||
        matchesSearchQuery(item.fileReference, q);

      if (!match) {
        return false;
      }
    }

    return true;
  });
}
