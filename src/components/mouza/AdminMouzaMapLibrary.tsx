import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderArchive,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Archive,
  Upload,
  ExternalLink,
  ShieldCheck,
  Tag,
  Scale,
  MapPin,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  X,
  Layers,
  Info,
  Check,
  Filter,
  Eye,
  FileSpreadsheet,
  Link2,
  Copy,
  ArrowLeft,
  Server,
  HardDrive,
  Paperclip,
  UploadCloud,
  Clock,
  XCircle,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { Language, UploadedMapFile } from '../../types';
import {
  MouzaMapLibraryItem,
  MapCatalogStatus,
  ExternalMapSourceRecord,
  MapSearchFilterCriteria,
  BulkMapImportValidationResult,
} from '../../types/mouza-server-library';
import { SurveyRecordType, LocationSelectionValue } from '../../types/administrative-location';
import {
  fetchMouzaMapLibrary,
  uploadMouzaMapFile,
  relinkMapFile,
  updateMapVerificationStatus,
  deleteMapLibraryItem,
  formatFileSize,
  type UploadStatus,
  type UploadProgressEvent,
  type UploadCancellationToken,
  getExternalMapSources,
  saveExternalMapSource,
  deleteExternalMapSource,
  validateAndParseBulkMapMetadata,
  saveBulkImportedMapRecords,
  getBulkMapCsvTemplate,
  getBulkMapJsonTemplate,
  filterMouzaMapLibrary,
} from '../../services/mouzaMapLibraryService';
import {
  getDivisions,
  getDistricts,
  getUpazilas,
  getDistrictById,
  getUpazilaById,
  getDivisionById,
} from '../../lib/mouza-database-service';
import {
  isFirebaseStorageConfigured,
  storage,
  storageRef,
  getDownloadURL,
} from '../../lib/firebase';
import { getStoredMapFileWithContent } from '../../lib/pentagraph-files';
import { useAuth } from '../../contexts/AuthContext';
import { PentagraphPdfViewer } from './PentagraphPdfViewer';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';

export interface UploadBatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  sizeFormatted: string;
  sheetNumber: string;
  mapTitle: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  status: UploadStatus;
  message?: string;
  error?: string;
  cancellationToken?: UploadCancellationToken;
}

interface AdminMouzaMapLibraryProps {
  lang?: Language;
  onClose?: () => void;
  onSelectMap?: (item: MouzaMapLibraryItem) => void;
  onSelectForPentagraph?: (item: MouzaMapLibraryItem) => void;
  onSelectAsCs?: (item: MouzaMapLibraryItem) => void;
  onSelectAsBs?: (item: MouzaMapLibraryItem) => void;
  initialLocation?: Partial<LocationSelectionValue>;
  initialSurveyType?: SurveyRecordType;
  asModal?: boolean;
}

export const AdminMouzaMapLibrary: React.FC<AdminMouzaMapLibraryProps> = ({
  lang = 'bn',
  onClose,
  onSelectMap,
  onSelectForPentagraph,
  onSelectAsCs,
  onSelectAsBs,
  initialLocation,
  initialSurveyType,
  asModal = false,
}) => {
  const isBn = lang === 'bn';
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<
    'library' | 'upload' | 'bulk_import' | 'external_sources'
  >('library');

  // Map Data
  const [maps, setMaps] = useState<MouzaMapLibraryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    msg: string;
  } | null>(null);

  // Active Preview State
  const [previewItem, setPreviewItem] = useState<MouzaMapLibraryItem | null>(null);

  // ----------------------------------------------------
  // Search Cascade State
  // ----------------------------------------------------
  const [filterDivisionId, setFilterDivisionId] = useState<string>(
    initialLocation?.divisionId || 'all'
  );
  const [filterDistrictId, setFilterDistrictId] = useState<string>(
    initialLocation?.districtId || 'all'
  );
  const [filterUpazilaId, setFilterUpazilaId] = useState<string>(
    initialLocation?.upazilaId || 'all'
  );
  const [filterMouzaName, setFilterMouzaName] = useState<string>(
    initialLocation?.mouzaNameBn || ''
  );
  const [filterJlNo, setFilterJlNo] = useState<string>(initialLocation?.jlNo || '');
  const [filterSurveyType, setFilterSurveyType] = useState<string>(
    initialSurveyType || 'all'
  );
  const [filterSheetNumber, setFilterSheetNumber] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);

  // File Relink / Replace State
  const [relinkingItemId, setRelinkingItemId] = useState<string | null>(null);
  const relinkInputRef = React.useRef<HTMLInputElement | null>(null);
  const [relinkLoading, setRelinkLoading] = useState<boolean>(false);

  // Preview Loaded File State
  const [previewLoadedFile, setPreviewLoadedFile] = useState<UploadedMapFile | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);

  // Cascade Options
  const divisions = useMemo(() => getDivisions(), []);
  const districts = useMemo(() => {
    if (filterDivisionId && filterDivisionId !== 'all') {
      return getDistricts(filterDivisionId);
    }
    return getDistricts();
  }, [filterDivisionId]);
  const upazilas = useMemo(() => {
    if (filterDistrictId && filterDistrictId !== 'all') {
      return getUpazilas(filterDistrictId);
    }
    return [];
  }, [filterDistrictId]);

  // Load maps
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchMouzaMapLibrary()
      .then((items) => {
        if (isMounted) {
          setMaps(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load mouza map library:', err);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  // Filtered Map Items
  const filteredMaps = useMemo(() => {
    const criteria: MapSearchFilterCriteria = {
      divisionId: filterDivisionId,
      districtId: filterDistrictId,
      upazilaId: filterUpazilaId,
      mouzaNameBn: filterMouzaName,
      jlNo: filterJlNo,
      surveyType: filterSurveyType,
      sheetNumber: filterSheetNumber,
      verificationStatus: filterStatus,
      searchQuery,
    };
    return filterMouzaMapLibrary(maps, criteria, availableOnly);
  }, [
    maps,
    filterDivisionId,
    filterDistrictId,
    filterUpazilaId,
    filterMouzaName,
    filterJlNo,
    filterSurveyType,
    filterSheetNumber,
    filterStatus,
    searchQuery,
    availableOnly,
  ]);

  const resetFilters = () => {
    setFilterDivisionId('all');
    setFilterDistrictId('all');
    setFilterUpazilaId('all');
    setFilterMouzaName('');
    setFilterJlNo('');
    setFilterSurveyType('all');
    setFilterSheetNumber('all');
    setFilterStatus('all');
    setSearchQuery('');
  };

  // ----------------------------------------------------
  // Admin Upload Form State
  // ----------------------------------------------------
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDivId, setUploadDivId] = useState<string>(
    initialLocation?.divisionId || 'div-dhaka'
  );
  const [uploadDistId, setUploadDistId] = useState<string>(
    initialLocation?.districtId || 'dist-dhaka'
  );
  const [uploadUpzId, setUploadUpzId] = useState<string>(
    initialLocation?.upazilaId || 'upz-savar'
  );
  const [uploadUnionName, setUploadUnionName] = useState<string>(
    initialLocation?.unionNameBn || ''
  );
  const [uploadMouzaNameBn, setUploadMouzaNameBn] = useState<string>(
    initialLocation?.mouzaNameBn || ''
  );
  const [uploadMouzaNameEn, setUploadMouzaNameEn] = useState<string>('');
  const [uploadJlNo, setUploadJlNo] = useState<string>(initialLocation?.jlNo || '');
  const [uploadSurveyType, setUploadSurveyType] = useState<SurveyRecordType>(
    initialSurveyType || 'RS'
  );
  const [uploadSheetNumber, setUploadSheetNumber] = useState<string>('০১');
  const [uploadMapTitle, setUploadMapTitle] = useState<string>('');
  const [uploadSource, setUploadSource] = useState<string>('জেলা রেকর্ড রুম থেকে সংগৃহীত');
  const [uploadScale, setUploadScale] = useState<string>('16" = 1 mile');
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadQueue, setUploadQueue] = useState<UploadBatchFileItem[]>([]);
  const [relinkProgress, setRelinkProgress] = useState<UploadProgressEvent | null>(null);
  const [relinkToken, setRelinkToken] = useState<UploadCancellationToken | null>(null);

  const toBengaliNumber = (num: number | string): string => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/\d/g, (d) => bnDigits[Number(d)]);
  };

  // Pre-fill upload title automatically when mouza/sheet changes
  useEffect(() => {
    if (uploadMouzaNameBn && uploadSheetNumber && !uploadMapTitle) {
      setUploadMapTitle(
        `${uploadMouzaNameBn} মৌজা নকশা - শীট ${uploadSheetNumber} (${uploadSurveyType})`
      );
    }
  }, [uploadMouzaNameBn, uploadSheetNumber, uploadSurveyType]);

  const uploadDistricts = useMemo(() => {
    return uploadDivId ? getDistricts(uploadDivId) : getDistricts();
  }, [uploadDivId]);

  const uploadUpazilas = useMemo(() => {
    return uploadDistId ? getUpazilas(uploadDistId) : [];
  }, [uploadDistId]);

  const overallBatchProgress = useMemo(() => {
    if (uploadQueue.length === 0) return null;
    const totalFiles = uploadQueue.length;
    const completedFiles = uploadQueue.filter((f) => f.status === 'Completed').length;
    const failedFiles = uploadQueue.filter((f) => f.status === 'Failed').length;
    const cancelledFiles = uploadQueue.filter((f) => f.status === 'Cancelled').length;
    const activeFiles = uploadQueue.filter(
      (f) => f.status === 'Uploading' || f.status === 'Processing'
    ).length;

    const totalBytes = uploadQueue.reduce((acc, f) => acc + (f.totalBytes || f.size), 0);
    const transferredBytes = uploadQueue.reduce((acc, f) => acc + (f.bytesTransferred || 0), 0);
    const overallPercentage =
      totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;

    return {
      totalFiles,
      completedFiles,
      failedFiles,
      cancelledFiles,
      activeFiles,
      totalBytes,
      transferredBytes,
      overallPercentage,
      totalBytesFormatted: formatFileSize(totalBytes),
      transferredBytesFormatted: formatFileSize(transferredBytes),
    };
  }, [uploadQueue]);

  const handleFilesSelected = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const newItems: UploadBatchFileItem[] = [];
    const startIndex = uploadQueue.length;

    Array.from(files).forEach((f, idx) => {
      const seq = startIndex + idx + 1;
      const sheetSeq = seq < 10 ? `0${seq}` : `${seq}`;
      const bnSheet = toBengaliNumber(sheetSeq);

      newItems.push({
        id: `uq-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        sizeFormatted: formatFileSize(f.size),
        sheetNumber: bnSheet,
        mapTitle: uploadMouzaNameBn
          ? `${uploadMouzaNameBn} মৌজা নকশা - শীট ${bnSheet} (${uploadSurveyType})`
          : f.name.replace(/\.[^/.]+$/, ''),
        bytesTransferred: 0,
        totalBytes: f.size,
        percentage: 0,
        status: 'Waiting',
      });
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
    if (newItems.length > 0) {
      setUploadFile(newItems[0].file);
      if (!uploadMapTitle && uploadMouzaNameBn) {
        setUploadMapTitle(
          `${uploadMouzaNameBn} মৌজা নকশা - শীট ${uploadSheetNumber} (${uploadSurveyType})`
        );
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
    e.target.value = '';
  };

  const handleUpdateItemSheetNumber = (itemId: string, val: string) => {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, sheetNumber: val } : q))
    );
  };

  const handleUpdateItemTitle = (itemId: string, val: string) => {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, mapTitle: val } : q))
    );
  };

  const handleRemoveQueueItem = (itemId: string) => {
    if (isUploading) return;
    setUploadQueue((prev) => prev.filter((x) => x.id !== itemId));
    if (uploadQueue.length <= 1) {
      setUploadFile(null);
    }
  };

  const handleClearQueue = () => {
    if (isUploading) return;
    setUploadQueue([]);
    setUploadFile(null);
  };

  const handleCancelItem = (itemId: string) => {
    const item = uploadQueue.find((x) => x.id === itemId);
    if (item?.cancellationToken) {
      item.cancellationToken.cancel();
    }
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.id === itemId
          ? {
              ...q,
              status: 'Cancelled',
              message: isBn ? 'ব্যবহারকারী কর্তৃক বাতিল' : 'Cancelled by user',
            }
          : q
      )
    );
  };

  const executeUploadForItem = async (item: UploadBatchFileItem): Promise<boolean> => {
    const divObj = getDivisionById(uploadDivId);
    const distObj = getDistrictById(uploadDistId);
    const upzObj = getUpazilaById(uploadUpzId);

    const token: UploadCancellationToken = {
      isCancelled: false,
      cancel: () => {
        token.isCancelled = true;
      },
    };

    setUploadQueue((prev) =>
      prev.map((q) =>
        q.id === item.id
          ? {
              ...q,
              status: 'Uploading',
              bytesTransferred: 0,
              percentage: 0,
              error: undefined,
              message: undefined,
              cancellationToken: token,
            }
          : q
      )
    );

    try {
      const res = await uploadMouzaMapFile({
        file: item.file,
        mapTitle:
          item.mapTitle.trim() ||
          `${uploadMouzaNameBn} মৌজা নকশা - শীট ${item.sheetNumber} (${uploadSurveyType})`,
        divisionId: uploadDivId,
        divisionNameBn: divObj?.nameBn || '',
        districtId: uploadDistId,
        districtNameBn: distObj?.nameBn || '',
        upazilaId: uploadUpzId,
        upazilaNameBn: upzObj?.nameBn || '',
        unionNameBn: uploadUnionName.trim() || undefined,
        mouzaNameBn: uploadMouzaNameBn.trim(),
        mouzaNameEn: uploadMouzaNameEn.trim() || undefined,
        jlNo: uploadJlNo.trim(),
        surveyType: uploadSurveyType,
        sheetNumber: item.sheetNumber.trim() || '০১',
        source: uploadSource.trim(),
        notes: uploadNotes.trim() || undefined,
        scale: uploadScale,
        uploadedBy: {
          uid: currentUser?.id || 'admin-local',
          name: currentUser?.name || 'Authorized Admin',
          email: currentUser?.email || 'admin@bhumi-amin.gov.bd',
          role: 'admin',
        },
        onProgress: (evt) => {
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    bytesTransferred: evt.bytesTransferred,
                    totalBytes: evt.totalBytes,
                    percentage: evt.percentage,
                    status: evt.status,
                    message: evt.message,
                    error: evt.error,
                  }
                : q
            )
          );
        },
        cancellationToken: token,
      });

      if (token.isCancelled) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'Cancelled',
                  message: isBn ? 'আপলোড বাতিল করা হয়েছে।' : 'Upload cancelled.',
                }
              : q
          )
        );
        return false;
      }

      if (res.success && res.item) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'Completed',
                  percentage: 100,
                  bytesTransferred: item.totalBytes || item.file.size,
                  message: isBn ? res.messageBn : res.messageEn,
                }
              : q
          )
        );
        return true;
      } else {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'Failed',
                  error: res.error || (isBn ? res.messageBn : res.messageEn),
                }
              : q
          )
        );
        return false;
      }
    } catch (err: any) {
      const isCancelled = token.isCancelled;
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: isCancelled ? 'Cancelled' : 'Failed',
                error: isCancelled
                  ? undefined
                  : err instanceof Error
                  ? err.message
                  : String(err),
                message: isCancelled
                  ? isBn
                    ? 'আপলোড বাতিল হয়েছে।'
                    : 'Upload cancelled.'
                  : undefined,
              }
            : q
        )
      );
      return false;
    }
  };

  const handleRetrySingleItem = async (itemId: string) => {
    if (isUploading) return;
    const item = uploadQueue.find((x) => x.id === itemId);
    if (!item) return;

    if (!uploadMouzaNameBn.trim() || !uploadJlNo.trim()) {
      setNotification({
        type: 'error',
        msg: isBn
          ? 'মৌজার নাম এবং জে.এল. নম্বর প্রদান করা আবশ্যক'
          : 'Mouza name and JL number are required',
      });
      return;
    }

    setIsUploading(true);
    setNotification(null);
    const ok = await executeUploadForItem(item);
    setIsUploading(false);
    setRefreshKey((k) => k + 1);

    if (ok) {
      setNotification({
        type: 'success',
        msg: isBn ? 'ফাইলটি সফলভাবে আপলোড হয়েছে।' : 'File uploaded successfully.',
      });
    } else {
      setNotification({
        type: 'error',
        msg: isBn ? 'ফাইলটি পুনরায় আপলোড ব্যর্থ হয়েছে।' : 'Retry upload failed.',
      });
    }
  };

  const handleDoUpload = async () => {
    if (uploadQueue.length === 0) {
      setNotification({
        type: 'error',
        msg: isBn
          ? 'দয়া করে অন্তত একটি ম্যাপ ফাইল নির্বাচন করুন'
          : 'Please select at least one map file',
      });
      return;
    }
    if (!uploadMouzaNameBn.trim() || !uploadJlNo.trim()) {
      setNotification({
        type: 'error',
        msg: isBn
          ? 'মৌজার নাম এবং জে.এল. নম্বর প্রদান করা আবশ্যক'
          : 'Mouza name and JL number are required',
      });
      return;
    }

    if (isUploading) return;
    setIsUploading(true);
    setNotification(null);

    const pendingItems = uploadQueue.filter(
      (x) => x.status === 'Waiting' || x.status === 'Failed' || x.status === 'Cancelled'
    );

    if (pendingItems.length === 0) {
      setIsUploading(false);
      setNotification({
        type: 'info',
        msg: isBn ? 'সকল ফাইল ইতিমধ্যে আপলোড সম্পন্ন হয়েছে।' : 'All files already uploaded.',
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      const ok = await executeUploadForItem(item);
      if (ok) successCount++;
      else failCount++;
    }

    setIsUploading(false);
    setRefreshKey((k) => k + 1);

    if (successCount > 0 && failCount === 0) {
      setNotification({
        type: 'success',
        msg: isBn
          ? `অভিনন্দন! ${toBengaliNumber(successCount)} টি মৌজা ম্যাপ ফাইল সফলভাবে সংরক্ষিত হয়েছে।`
          : `All ${successCount} maps successfully uploaded and saved!`,
      });
    } else if (successCount > 0 && failCount > 0) {
      setNotification({
        type: 'warning',
        msg: isBn
          ? `${toBengaliNumber(successCount)} টি ফাইল সফল, কিন্তু ${toBengaliNumber(failCount)} টি ফাইলে সমস্যা হয়েছে। 'পুনরায় চেষ্টা' বাটন চাপুন।`
          : `${successCount} uploaded, ${failCount} failed. You can retry failed files.`,
      });
    } else {
      setNotification({
        type: 'error',
        msg: isBn
          ? 'ফাইল সংরক্ষণ ব্যর্থ হয়েছে। নেটওয়ার্ক ও মেমোরি পরীক্ষা করে আবার চেষ্টা করুন।'
          : 'Upload failed. Please check connection and retry.',
      });
    }
  };

  // ----------------------------------------------------
  // Admin Status Update & Delete
  // ----------------------------------------------------
  const handleUpdateStatus = async (item: MouzaMapLibraryItem, newStatus: MapCatalogStatus) => {
    const res = await updateMapVerificationStatus(
      item.id,
      newStatus,
      {
        uid: currentUser?.id || 'admin',
        name: currentUser?.name || 'Admin Surveyor',
        email: currentUser?.email,
        role: 'admin',
      },
      newStatus === 'Verified' ? 'অ্যাডমিন কর্তৃক ফিল্ড ও রেকর্ড যাচাই সম্পন্ন' : undefined
    );
    if (res.success) {
      setNotification({
        type: 'success',
        msg: isBn
          ? `ম্যাপ #${item.id} স্ট্যাটাস '${newStatus}'-এ পরিবর্তিত হয়েছে।`
          : `Status updated to ${newStatus}.`,
      });
      setRefreshKey((k) => k + 1);
    } else {
      setNotification({ type: 'error', msg: res.error || 'Failed to update status' });
    }
  };

  const handleDeleteItem = async (item: MouzaMapLibraryItem) => {
    const ok = window.confirm(
      isBn
        ? `আপনি কি নিশ্চিত যে '${item.mapTitle}' নকশাটি সার্ভার ও লাইব্রেরি থেকে মুছে ফেলতে চান?`
        : `Are you sure you want to delete '${item.mapTitle}'?`
    );
    if (!ok) return;

    const res = await deleteMapLibraryItem(item, {
      uid: currentUser?.id || 'admin',
      role: 'admin',
    });
    if (res.success) {
      setNotification({
        type: 'info',
        msg: isBn ? 'নকশাটি সফলভাবে মুছে ফেলা হয়েছে।' : 'Map deleted successfully.',
      });
      setRefreshKey((k) => k + 1);
    } else {
      setNotification({ type: 'error', msg: res.error || 'Failed to delete map' });
    }
  };

  // ----------------------------------------------------
  // Bulk Metadata Import State
  // ----------------------------------------------------
  const [bulkFormat, setBulkFormat] = useState<'csv' | 'json'>('csv');
  const [bulkText, setBulkText] = useState<string>(getBulkMapCsvTemplate());
  const [bulkResult, setBulkResult] = useState<BulkMapImportValidationResult | null>(null);

  const handleValidateBulk = () => {
    const res = validateAndParseBulkMapMetadata(bulkText, bulkFormat, {
      uid: currentUser?.id || 'admin',
      name: currentUser?.name || 'Admin',
      role: 'admin',
    });
    setBulkResult(res);
  };

  const handleCommitBulk = () => {
    if (!bulkResult || bulkResult.validCount === 0) return;
    saveBulkImportedMapRecords(bulkResult.records);
    setNotification({
      type: 'success',
      msg: isBn
        ? `${bulkResult.validCount} টি মেটাডাটা রেকর্ড সফলভাবে সংরক্ষিত হয়েছে। ${bulkResult.missingFileCount} টি রেকর্ডের ফাইল সংযুক্ত নেই (Missing File চিহ্নিত)।`
        : `${bulkResult.validCount} metadata records imported.`,
    });
    setBulkResult(null);
    setRefreshKey((k) => k + 1);
    setActiveTab('library');
  };

  // ----------------------------------------------------
  // External Sources Directory State
  // ----------------------------------------------------
  const [externalSources, setExternalSources] = useState<ExternalMapSourceRecord[]>(() =>
    getExternalMapSources()
  );
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceNotes, setNewSourceNotes] = useState('');

  const handleAddExternalSource = () => {
    if (!newSourceTitle.trim() || !newSourceUrl.trim()) return;
    const rec: ExternalMapSourceRecord = {
      id: `ext-${Date.now()}`,
      sourceName: newSourceTitle.trim(),
      websiteUrl: newSourceUrl.trim(),
      accessType: 'External Link',
      notes: newSourceNotes.trim() || 'অ্যাডমিন সংগৃহীত বহিঃস্থ লিংক',
      lastCheckedDate: new Date().toISOString().split('T')[0],
      isVerifiedPublicPortal: false,
    };
    saveExternalMapSource(rec, { role: 'admin' });
    setExternalSources(getExternalMapSources());
    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourceNotes('');
    setNotification({
      type: 'success',
      msg: isBn ? 'বহিঃস্থ লিংক সফলভাবে ডিরেক্টরিতে যুক্ত হয়েছে।' : 'External link added.',
    });
  };

  const handleDeleteExternalSource = (id: string) => {
    deleteExternalMapSource(id, { role: 'admin' });
    setExternalSources(getExternalMapSources());
  };

  // ----------------------------------------------------
  // FILE RELINK / REPLACE HANDLERS (Preserves Mouza & JL Metadata)
  // ----------------------------------------------------
  const handleInitiateRelink = (item: MouzaMapLibraryItem) => {
    setRelinkingItemId(item.id);
    if (relinkInputRef.current) {
      relinkInputRef.current.value = '';
      relinkInputRef.current.click();
    }
  };

  const handleRelinkFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !relinkingItemId) return;
    setRelinkLoading(true);

    const token: UploadCancellationToken = {
      isCancelled: false,
      cancel: () => {
        token.isCancelled = true;
      },
    };
    setRelinkToken(token);

    try {
      const res = await relinkMapFile(
        relinkingItemId,
        file,
        currentUser,
        (progressEvt) => {
          setRelinkProgress(progressEvt);
        },
        token
      );
      if (res.success && res.item) {
        setMaps((prev) => prev.map((m) => (m.id === relinkingItemId ? res.item! : m)));
        if (previewItem && previewItem.id === relinkingItemId) {
          setPreviewItem(res.item);
        }
        setNotification({
          type: 'success',
          msg: isBn
            ? 'ম্যাপ ফাইলটি সফলভাবে রিলিংক ও সংরক্ষিত হয়েছে।'
            : 'Map file relinked and saved successfully.',
        });
        setTimeout(() => {
          setRelinkProgress(null);
          setRelinkToken(null);
          setNotification(null);
        }, 2000);
      } else {
        setNotification({
          type: 'error',
          msg: res.error || (isBn ? 'রিলিংক ব্যর্থ হয়েছে।' : 'Failed to relink file.'),
        });
        setTimeout(() => {
          setRelinkProgress(null);
          setRelinkToken(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Relink error:', err);
      setNotification({
        type: 'error',
        msg: isBn ? 'রিলিংক করার সময় ত্রুটি ঘটেছে।' : 'Error during relink.',
      });
      setTimeout(() => {
        setRelinkProgress(null);
        setRelinkToken(null);
      }, 3000);
    } finally {
      setRelinkLoading(false);
      setRelinkingItemId(null);
    }
  };

  const handleDownloadMapItem = async (item: MouzaMapLibraryItem) => {
    const fileUrl =
      item.storageUrl || item.fileReference || item.fileRef || item.downloadUrl || '';

    if (
      fileUrl &&
      (fileUrl.startsWith('http://') ||
        fileUrl.startsWith('https://') ||
        fileUrl.startsWith('data:') ||
        fileUrl.startsWith('/'))
    ) {
      window.open(fileUrl, '_blank');
      return;
    }
    const found = await getStoredMapFileWithContent(fileUrl || item.id);
    if (found?.dataUrl) {
      const a = document.createElement('a');
      a.href = found.dataUrl;
      a.download = item.originalFileName || `${item.mouzaNameBn}_sheet_${item.sheetNumber}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setNotification({
        type: 'error',
        msg: isBn ? 'ফাইল কনটেন্ট পাওয়া যায়নি।' : 'File content not found.',
      });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // ----------------------------------------------------
  // ASYNC PREVIEW RESOLUTION (Loads binary from Firestore/Cloud/IndexedDB without broken icon)
  // ----------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    if (!previewItem) {
      setPreviewLoadedFile(null);
      setPreviewLoadError(null);
      return;
    }

    const directUrl =
      previewItem.storageUrl ||
      previewItem.fileReference ||
      previewItem.fileRef ||
      previewItem.downloadUrl ||
      previewItem.storageBucketPath ||
      '';

    const isPdfMime =
      Boolean(previewItem.mimeType?.toLowerCase().includes('pdf')) ||
      previewItem.fileType === 'pdf' ||
      Boolean(previewItem.originalFileName?.toLowerCase().endsWith('.pdf')) ||
      Boolean(directUrl.toLowerCase().endsWith('.pdf')) ||
      Boolean(directUrl.startsWith('data:application/pdf'));

    const detectedFileType: 'pdf' | 'image' = isPdfMime ? 'pdf' : 'image';
    const detectedMimeType =
      previewItem.mimeType || (isPdfMime ? 'application/pdf' : 'image/png');

    // 1. Direct web/cloud or base64 data URL
    if (
      directUrl &&
      (directUrl.startsWith('http://') ||
        directUrl.startsWith('https://') ||
        directUrl.startsWith('data:') ||
        directUrl.startsWith('blob:') ||
        directUrl.startsWith('/'))
    ) {
      setPreviewLoadedFile({
        id: previewItem.id,
        name: previewItem.originalFileName,
        fileType: detectedFileType,
        mimeType: detectedMimeType,
        size: previewItem.fileSizeBytes,
        sizeFormatted: previewItem.fileSizeFormatted,
        uploadedAt: previewItem.uploadDate,
        category:
          previewItem.surveyType === 'CS' || previewItem.surveyType === 'SA'
            ? 'cs_map'
            : 'bs_map',
        notes: previewItem.notes,
        dataUrl: directUrl,
      });
      setPreviewLoadError(null);
      return;
    }

    // 2. Demo maps without external binary
    if (previewItem.isDemo) {
      setPreviewLoadedFile({
        id: previewItem.id,
        name: previewItem.originalFileName,
        fileType: detectedFileType,
        mimeType: detectedMimeType,
        size: previewItem.fileSizeBytes,
        sizeFormatted: previewItem.fileSizeFormatted,
        uploadedAt: previewItem.uploadDate,
        category:
          previewItem.surveyType === 'CS' || previewItem.surveyType === 'SA'
            ? 'cs_map'
            : 'bs_map',
        notes: previewItem.notes,
        dataUrl: undefined,
      });
      setPreviewLoadError(null);
      return;
    }

    // 3. Resolve from Firebase Storage or IndexedDB offline storage
    setIsPreviewLoading(true);
    setPreviewLoadError(null);

    (async () => {
      // 3A. If it's a Firebase Storage path (e.g. mouza_maps/... or gs://...)
      if (
        directUrl &&
        isFirebaseStorageConfigured &&
        storage &&
        !directUrl.startsWith('offline-') &&
        (directUrl.includes('/') || directUrl.startsWith('gs://'))
      ) {
        try {
          const downloadUrl = await getDownloadURL(storageRef(storage, directUrl));
          if (downloadUrl && isMounted) {
            setPreviewLoadedFile({
              id: previewItem.id,
              name: previewItem.originalFileName,
              fileType: detectedFileType,
              mimeType: detectedMimeType,
              size: previewItem.fileSizeBytes,
              sizeFormatted: previewItem.fileSizeFormatted,
              uploadedAt: previewItem.uploadDate,
              category:
                previewItem.surveyType === 'CS' || previewItem.surveyType === 'SA'
                  ? 'cs_map'
                  : 'bs_map',
              notes: previewItem.notes,
              dataUrl: downloadUrl,
            });
            setIsPreviewLoading(false);
            setPreviewLoadError(null);
            return;
          }
        } catch (storageErr) {
          console.warn('Could not resolve download URL from Firebase storage:', storageErr);
        }
      }

      // 3B. Try IndexedDB offline storage
      const keysToTry = [
        directUrl,
        previewItem.fileReference,
        previewItem.fileRef,
        previewItem.storageUrl,
        `offline-${previewItem.id}`,
        previewItem.id,
        previewItem.originalFileName,
        previewItem.fileReference?.replace(/^offline-/, ''),
      ].filter(Boolean) as string[];

      let found: UploadedMapFile | null = null;
      for (const k of keysToTry) {
        found = await getStoredMapFileWithContent(k);
        if (found && (found.dataUrl || found.rawText)) break;
      }

      if (!isMounted) return;
      setIsPreviewLoading(false);

      if (found && (found.dataUrl || found.rawText)) {
        setPreviewLoadedFile({
          ...found,
          id: previewItem.id,
          name: previewItem.originalFileName || found.name,
          fileType: detectedFileType || found.fileType,
          mimeType: detectedMimeType || found.mimeType,
          category:
            previewItem.surveyType === 'CS' || previewItem.surveyType === 'SA'
              ? 'cs_map'
              : 'bs_map',
          notes: previewItem.notes || found.notes,
          dataUrl: found.dataUrl,
        });
        setPreviewLoadError(null);
      } else {
        // Render file metadata in preview, with graceful relink option
        setPreviewLoadedFile({
          id: previewItem.id,
          name: previewItem.originalFileName,
          fileType: detectedFileType,
          mimeType: detectedMimeType,
          size: previewItem.fileSizeBytes,
          sizeFormatted: previewItem.fileSizeFormatted,
          uploadedAt: previewItem.uploadDate,
          category:
            previewItem.surveyType === 'CS' || previewItem.surveyType === 'SA'
              ? 'cs_map'
              : 'bs_map',
          notes: previewItem.notes,
          dataUrl: undefined,
        });
        setPreviewLoadError(
          isBn
            ? 'ফাইল রেফারেন্সটি অফলাইন স্টোরেজে পাওয়া যায়নি। আপনি নিচের বাটনে ক্লিক করে ফাইলটি পুনরায় লিংক (Relink) করতে পারেন।'
            : 'File binary not found in offline storage. You can relink the file below.'
        );
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [previewItem, isBn]);

  // ----------------------------------------------------
  // IF PREVIEW IS OPEN, RENDER PentagraphPdfViewer
  // ----------------------------------------------------
  if (previewItem) {
    return (
      <div className="space-y-3 animate-fadeIn">
        <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => {
              setPreviewItem(null);
              setPreviewLoadedFile(null);
              setPreviewLoadError(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBn ? 'লাইব্রেরিতে ফিরে যান' : 'Back to Library'}</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleInitiateRelink(previewItem)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5 text-amber-700" />
              <span>{isBn ? 'ফাইল রিলিংক / প্রতিস্থাপন' : 'Relink / Replace'}</span>
            </button>
            <div className="text-right">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {previewItem.mapTitle}
              </h4>
              <span className="text-[11px] text-slate-500">
                {previewItem.districtNameBn} &gt; {previewItem.upazilaNameBn} &gt;{' '}
                {previewItem.mouzaNameBn} (জে.এল. {previewItem.jlNo}, শীট {previewItem.sheetNumber})
              </span>
            </div>
          </div>
        </div>

        {isPreviewLoading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-900 rounded-2xl text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium text-slate-300">
              {isBn ? 'মৌজা নকশা ফাইলটি স্টোরেজ থেকে লোড হচ্ছে...' : 'Loading Mouza Map from storage...'}
            </p>
          </div>
        ) : previewLoadError ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-2xl border border-amber-500/30 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <FileWarning className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">
              {isBn ? 'মৌজা নকশা ফাইল সংযুক্ত করা প্রয়োজন' : 'Mouza Map File Needs Relinking'}
            </h4>
            <p className="text-xs text-slate-400 max-w-md">
              {previewLoadError}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleInitiateRelink(previewItem)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
                <span>{isBn ? 'আসল ফাইলটি নির্বাচন করুন (Relink)' : 'Select Original File (Relink)'}</span>
              </button>
              <button
                onClick={() => {
                  setPreviewItem(null);
                  setPreviewLoadedFile(null);
                  setPreviewLoadError(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                {isBn ? 'ফিরে যান' : 'Back'}
              </button>
            </div>
          </div>
        ) : previewLoadedFile ? (
          <PentagraphPdfViewer
            file={previewLoadedFile}
            lang={lang}
            onBack={() => {
              setPreviewItem(null);
              setPreviewLoadedFile(null);
            }}
            onSelectAsCs={() => {
              if (onSelectAsCs) onSelectAsCs(previewItem);
              setPreviewItem(null);
            }}
            onSelectAsBs={() => {
              if (onSelectAsBs) onSelectAsBs(previewItem);
              setPreviewItem(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN LIBRARY VIEW
  // ----------------------------------------------------
  return (
    <div
      id="mouza-map-server-library"
      className={`${
        asModal
          ? 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs'
          : 'space-y-4'
      } animate-fadeIn`}
    >
      <div
        className={`${
          asModal
            ? 'bg-slate-50 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden'
            : 'bg-slate-50/70 rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-900">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {isBn
                    ? 'স্ক্যানকৃত মৌজা নকশা সার্ভার লাইব্রেরি ও স্মার্ট অনুসন্ধান'
                    : 'Scanned Mouza Map Server Library'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Phase 20G
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isBn
                  ? 'বৈধভাবে সংগৃহীত CS, SA, RS, BS/BRS ডিজিটাল মৌজা নকশা সংরক্ষণ ও পেন্টাগ্রাফ ইন্টিগ্রেশন'
                  : 'Official CS, SA, RS, BS/BRS Scanned Cadastral Sheets & Digital Pentagraph Link'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {asModal && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title={isBn ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-slate-200 bg-white text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>{isBn ? 'নকশা অনুসন্ধান ও লাইব্রেরি' : 'Search & Library'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'library' ? 'bg-amber-900 text-amber-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {filteredMaps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{isBn ? 'নকশা আপলোড (অ্যাডমিন)' : 'Upload Map (Admin)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('bulk_import')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'bulk_import'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isBn ? 'বাল্ক মেটাডাটা ইম্পোর্ট' : 'Bulk Import'}</span>
          </button>

          <button
            onClick={() => setActiveTab('external_sources')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === 'external_sources'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>{isBn ? 'বহিঃস্থ লিংক ডিরেক্টরি' : 'External Sources'}</span>
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`mx-4 mt-3 p-3 rounded-2xl flex items-center justify-between text-xs font-medium border ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <span>{notification.msg}</span>
            <button
              onClick={() => setNotification(null)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[70vh] space-y-4">
          {/* ========================================================================= */}
          {/* TAB 1: SMART SEARCH CASCADE & MAP LIBRARY */}
          {/* ========================================================================= */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              {/* Search Cascade Filter Box */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Filter className="w-4 h-4 text-amber-800" />
                    <span>
                      {isBn
                        ? 'স্মার্ট লোকেশন ক্যাসকেড ও ফিল্টার'
                        : 'Cascading Location Search Filter'}
                    </span>
                  </div>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-bold hover:underline cursor-pointer"
                  >
                    {isBn ? 'ফিল্টার রিসেট' : 'Reset Filters'}
                  </button>
                </div>

                {/* Cascade Row 1: Division -> District -> Upazila */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '১. বিভাগ' : '1. Division'}
                    </label>
                    <select
                      value={filterDivisionId}
                      onChange={(e) => {
                        setFilterDivisionId(e.target.value);
                        setFilterDistrictId('all');
                        setFilterUpazilaId('all');
                      }}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="all">{isBn ? '-- সকল বিভাগ --' : '-- All Divisions --'}</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameBn} ({d.nameEn})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '২. জেলা' : '2. District'}
                    </label>
                    <select
                      value={filterDistrictId}
                      onChange={(e) => {
                        setFilterDistrictId(e.target.value);
                        setFilterUpazilaId('all');
                      }}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="all">{isBn ? '-- সকল জেলা --' : '-- All Districts --'}</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameBn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '৩. উপজেলা / থানা' : '3. Upazila / Thana'}
                    </label>
                    <select
                      value={filterUpazilaId}
                      onChange={(e) => setFilterUpazilaId(e.target.value)}
                      disabled={!upazilas.length}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden disabled:opacity-50"
                    >
                      <option value="all">
                        {isBn ? '-- সকল উপজেলা --' : '-- All Upazilas --'}
                      </option>
                      {upazilas.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nameBn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cascade Row 2: Mouza -> JL -> Survey Type -> Sheet */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '৪. মৌজা নাম' : '4. Mouza Name'}
                    </label>
                    <input
                      type="text"
                      value={filterMouzaName}
                      onChange={(e) => setFilterMouzaName(e.target.value)}
                      placeholder={isBn ? 'যেমন: সাভার' : 'e.g. Savar'}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '৫. জে.এল. নম্বর' : '5. JL Number'}
                    </label>
                    <input
                      type="text"
                      value={filterJlNo}
                      onChange={(e) => setFilterJlNo(e.target.value)}
                      placeholder={isBn ? 'যেমন: ২৪' : 'e.g. 24'}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '৬. সার্ভে টাইপ' : '6. Survey Type'}
                    </label>
                    <select
                      value={filterSurveyType}
                      onChange={(e) => setFilterSurveyType(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    >
                      <option value="all">{isBn ? 'সকল টাইপ' : 'All Types'}</option>
                      <option value="CS">CS (ক্যাডাস্ট্রাল)</option>
                      <option value="SA">SA (স্টেট একুইজিশন)</option>
                      <option value="RS">RS (রিভিশনাল)</option>
                      <option value="BS">BS / BRS (বাংলাদেশ জরিপ)</option>
                      <option value="City">City / Diara / অন্যান্য</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {isBn ? '৭. শীট নম্বর' : '7. Sheet No.'}
                    </label>
                    <input
                      type="text"
                      value={filterSheetNumber === 'all' ? '' : filterSheetNumber}
                      onChange={(e) => setFilterSheetNumber(e.target.value || 'all')}
                      placeholder={isBn ? 'যেমন: ০১' : 'e.g. 01'}
                      className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Filter Row 3: Keyword search & Available-only toggle */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        isBn
                          ? 'ম্যাপ টাইটেল, সূত্র বা ফাইলনেম দিয়ে খুঁজুন...'
                          : 'Search by title, source or file name...'
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={availableOnly}
                        onChange={(e) => setAvailableOnly(e.target.checked)}
                        className="rounded text-amber-800 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>
                        {isBn
                          ? 'শুধু বাস্তবে সংরক্ষিত ম্যাপ দেখান'
                          : 'Available Maps Only'}
                      </span>
                    </label>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="p-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium"
                    >
                      <option value="all">{isBn ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
                      <option value="Verified">Verified (যাচাইকৃত)</option>
                      <option value="Uploaded">Uploaded (নতুন)</option>
                      <option value="Needs Review">Needs Review (পর্যালোচনা)</option>
                      <option value="Missing File">Missing File (ফাইলহীন)</option>
                      <option value="Archived">Archived (আর্কাইভ)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Map Results Grid */}
              {loading ? (
                <div className="p-10 text-center text-slate-500 text-xs font-medium animate-pulse">
                  {isBn ? 'মৌজা নকশা লাইব্রেরি লোড হচ্ছে...' : 'Loading Mouza Map Library...'}
                </div>
              ) : filteredMaps.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                  <FolderArchive className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">
                    {isBn
                      ? 'কোনো মৌজা নকশা পাওয়া যায়নি'
                      : 'No Mouza Maps Found'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {availableOnly
                      ? isBn
                        ? 'আপনার বর্তমান ফিল্টারের অধীনে কোনো আপলোডকৃত ম্যাপ ফাইল নেই। আপনি ফিল্টার শিথিল করতে পারেন বা অ্যাডমিন হিসেবে নতুন ম্যাপ আপলোড করতে পারেন।'
                        : 'No available map files match current filters.'
                      : isBn
                      ? 'কোনো মেটাডাটা বা ফাইল রেকর্ড নেই।'
                      : 'No records found.'}
                  </p>
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isBn ? 'সকল নকশা প্রদর্শন করুন' : 'Show All Maps'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredMaps.map((item) => {
                    const isVerified = item.verificationStatus === 'Verified';
                    const isMissingFile = item.verificationStatus === 'Missing File';
                    const isNeedsReview = item.verificationStatus === 'Needs Review';

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-400 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2">
                          {/* Top row: Survey Type & Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                  item.surveyType === 'CS'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : item.surveyType === 'SA'
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : item.surveyType === 'RS'
                                    ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                }`}
                              >
                                {item.surveyType}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                শীট {item.sheetNumber}
                              </span>
                              {item.isDemo && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  নমুনা ডেমো
                                </span>
                              )}
                            </div>

                            {/* Verification Status Badge */}
                            <div>
                              {isVerified && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>যাচাইকৃত (Verified)</span>
                                </span>
                              )}
                              {isMissingFile && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateRelink(item);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                                  title={isBn ? 'ফাইল রিলিংক করতে ক্লিক করুন' : 'Click to relink file'}
                                >
                                  <FileWarning className="w-3 h-3 text-rose-600" />
                                  <span>ফাইল রেফারেন্স অনুপস্থিত (রিলিংক করুন)</span>
                                </button>
                              )}
                              {isNeedsReview && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>পর্যালোচনা প্রয়োজন</span>
                                </span>
                              )}
                              {item.verificationStatus === 'Uploaded' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                                  <Upload className="w-3 h-3 text-blue-600" />
                                  <span>আপলোডকৃত (Uploaded)</span>
                                </span>
                              )}
                              {item.verificationStatus === 'Archived' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  <Archive className="w-3 h-3 text-slate-500" />
                                  <span>আর্কাইভকৃত</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Map Title */}
                          <h4 className="text-sm font-black text-slate-900 leading-snug">
                            {item.mapTitle}
                          </h4>

                          {/* Location Cascade Breadcrumb */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <MapPin className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                            <span className="font-semibold text-slate-800">
                              {item.divisionNameBn} &gt; {item.districtNameBn} &gt;{' '}
                              {item.upazilaNameBn} &gt; {item.mouzaNameBn}
                            </span>
                            <span className="text-slate-500 font-bold ml-auto">
                              জে.এল. {item.jlNo}
                            </span>
                          </div>

                          {/* Meta Specs: file type, size, storage provider, source */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                            <div className="flex items-center gap-1.5">
                              {item.fileType === 'pdf' ? (
                                <FileText className="w-3.5 h-3.5 text-rose-600" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
                              )}
                              <span>
                                {item.fileType.toUpperCase()} ({item.fileSizeFormatted})
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-[10px]">
                              {item.storageProvider === 'firebase_storage' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <Server className="w-3 h-3" />
                                  Firebase Storage
                                </span>
                              ) : item.storageProvider === 'indexeddb_offline' ? (
                                <span className="inline-flex items-center gap-1 text-slate-600 font-bold">
                                  <HardDrive className="w-3 h-3" />
                                  IndexedDB (Offline)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                                  <Server className="w-3 h-3" />
                                  App Asset
                                </span>
                              )}
                            </div>

                            <div className="col-span-2 text-[10px] text-slate-500 truncate">
                              <span className="font-bold text-slate-700">সূত্র:</span>{' '}
                              {item.source}
                            </div>
                            {item.notes && (
                              <div className="col-span-2 text-[10px] text-slate-500 italic truncate">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {/* Preview button */}
                            <button
                              onClick={() => setPreviewItem(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                              title={isBn ? 'নকশা প্রিভিউ করুন' : 'Preview Map'}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isBn ? 'প্রিভিউ' : 'Preview'}</span>
                            </button>

                            {/* Relink / Replace File Button */}
                            <button
                              onClick={() => handleInitiateRelink(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition active:scale-95 cursor-pointer"
                              title={isBn ? 'ফাইল রিলিংক বা নতুন ফাইল প্রতিস্থাপন করুন' : 'Relink or replace file'}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                              <span>{isBn ? 'রিলিংক' : 'Relink'}</span>
                            </button>

                            {/* Universal Download Button */}
                            <button
                              onClick={() => handleDownloadMapItem(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                              title={isBn ? 'ম্যাপ ডাউনলোড' : 'Download Map'}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Integration Select Buttons */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {onSelectForPentagraph && (
                              <button
                                disabled={isMissingFile}
                                onClick={() => onSelectForPentagraph(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-40"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>{isBn ? 'পেন্টাগ্রাফে যোগ' : 'Add to Pentagraph'}</span>
                              </button>
                            )}

                            {onSelectAsCs && (
                              <button
                                disabled={isMissingFile}
                                onClick={() => onSelectAsCs(item)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-40"
                              >
                                <span>CS সিলেক্ট</span>
                              </button>
                            )}

                            {onSelectAsBs && (
                              <button
                                disabled={isMissingFile}
                                onClick={() => onSelectAsBs(item)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-40"
                              >
                                <span>BS সিলেক্ট</span>
                              </button>
                            )}

                            {onSelectMap && !onSelectForPentagraph && (
                              <button
                                disabled={isMissingFile}
                                onClick={() => onSelectMap(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-40"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isBn ? 'নির্বাচন করুন' : 'Select'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Admin Controls Toolbar */}
                        <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] bg-slate-50/70 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl">
                          <span className="text-slate-500 font-bold">
                            অ্যাডমিন কন্ট্রোল:
                          </span>
                          <div className="flex items-center gap-1">
                            {item.verificationStatus !== 'Verified' && (
                              <button
                                onClick={() => handleUpdateStatus(item, 'Verified')}
                                className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold transition cursor-pointer"
                                title="যাচাইকৃত হিসেবে অনুমোদন দিন"
                              >
                                যাচাই করুন
                              </button>
                            )}
                            {item.verificationStatus !== 'Needs Review' && (
                              <button
                                onClick={() => handleUpdateStatus(item, 'Needs Review')}
                                className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold transition cursor-pointer"
                                title="পর্যালোচনা তালিকায় পাঠান"
                              >
                                রিভিউ
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 transition cursor-pointer"
                              title="ম্যাপ ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ADMIN UPLOAD MAP FILE */}
          {/* ========================================================================= */}
          {activeTab === 'upload' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900">
                    {isBn ? 'নতুন মৌজা নকশা সার্ভার আপলোড' : 'Upload Mouza Map to Server'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isBn
                      ? 'বৈধভাবে সংগৃহীত PDF, JPG, PNG ম্যাপ আপলোড ও মেটাডাটা সংরক্ষণ'
                      : 'Upload scanned cadastral map file and save verification metadata'}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
                  <span>অ্যাডমিন ফিচার</span>
                </div>
              </div>

              {/* Storage Provider Status Warning / Banner */}
              <div
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                  isFirebaseStorageConfigured
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" />
                <div>
                  {isFirebaseStorageConfigured ? (
                    <p className="font-semibold">
                      <strong>Firebase Storage সংযুক্ত:</strong> আপলোডকৃত ফাইল সরাসরি
                      ক্লাউড স্টোরেজে জমা হবে এবং Firestore-এ মেটাডাটা সংরক্ষিত হবে।
                    </p>
                  ) : (
                    <p className="font-semibold">
                      <strong>ক্লাউড স্টোরেজ অফলাইন / বিকল্প মোড:</strong> ফাইলটি আপনার
                      ব্রাউজারের সুরক্ষিত <strong>IndexedDB</strong>-তে জমা রাখা হবে।
                      (কোনো অসত্য ক্লাউড আপলোড দাবি করা হয় না; ফাইলটি নিরাপদ ও অফলাইনে ব্যবহারের জন্য প্রস্তুত থাকবে)।
                    </p>
                  )}
                </div>
              </div>

              {/* File Selector Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isUploading) setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (isUploading) return;
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className={`border-2 border-dashed p-6 rounded-2xl text-center space-y-2 transition ${
                  isDragOver
                    ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-200'
                    : 'border-slate-200 hover:border-amber-400 bg-slate-50/60'
                }`}
              >
                <input
                  type="file"
                  id="admin-mouza-map-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  disabled={isUploading}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="admin-mouza-map-file"
                  className={`flex flex-col items-center gap-2 ${
                    isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <div className="p-3 rounded-full bg-white shadow-2xs text-amber-800">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {uploadQueue.length > 0
                      ? isBn
                        ? `মোট ${toBengaliNumber(uploadQueue.length)} টি ফাইল নির্বাচিত (আরও যোগ করতে ক্লিক করুন)`
                        : `${uploadQueue.length} files selected (click or drop to add more)`
                      : isBn
                      ? 'ম্যাপ ফাইল নির্বাচন করুন (PDF, JPG, PNG) — একাধিক ফাইল সমর্থিত'
                      : 'Select Map Files (PDF, JPG, PNG) — Multi-file supported'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isBn
                      ? 'ড্র্যাগ অ্যান্ড ড্রপ করুন অথবা ব্রাউজ করুন (এক বা একাধিক ফাইল নির্বাচন করুন, সর্বোচ্চ ৫০ মেগাবাইট)'
                      : 'Drag and drop or browse (select one or multiple files, max 50MB)'}
                  </span>
                </label>
              </div>

              {/* Upload Queue & Real-time Progress Display */}
              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  {/* Overall Batch Progress Header */}
                  {overallBatchProgress && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-slate-50 border border-amber-200/80 shadow-2xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-amber-800" />
                          <h5 className="text-xs font-black text-slate-800">
                            {isBn ? 'ব্যাচ আপলোড অগ্রগতি (Batch Progress)' : 'Batch Upload Progress'}
                          </h5>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            {toBengaliNumber(overallBatchProgress.overallPercentage)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                          <span>
                            {isBn ? 'ফাইল:' : 'Files:'}{' '}
                            <strong className="text-slate-800">
                              {toBengaliNumber(overallBatchProgress.completedFiles)}/
                              {toBengaliNumber(overallBatchProgress.totalFiles)}
                            </strong>
                          </span>
                          <span>
                            {isBn ? 'ডেটা:' : 'Data:'}{' '}
                            <strong className="text-slate-800">
                              {overallBatchProgress.transferredBytesFormatted} /{' '}
                              {overallBatchProgress.totalBytesFormatted}
                            </strong>
                          </span>
                          {!isUploading && (
                            <button
                              onClick={handleClearQueue}
                              className="text-rose-600 hover:text-rose-800 font-bold transition cursor-pointer"
                              title="সব মুছুন"
                            >
                              {isBn ? 'সব মুছুন' : 'Clear all'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Master Progress Bar */}
                      <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            overallBatchProgress.failedFiles > 0 &&
                            overallBatchProgress.completedFiles === 0
                              ? 'bg-rose-500'
                              : overallBatchProgress.completedFiles ===
                                overallBatchProgress.totalFiles
                              ? 'bg-emerald-600'
                              : 'bg-gradient-to-r from-amber-700 via-amber-600 to-emerald-500'
                          }`}
                          style={{
                            width: `${Math.max(
                              overallBatchProgress.totalFiles > 0 ? 3 : 0,
                              overallBatchProgress.overallPercentage
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Individual Files List */}
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {uploadQueue.map((item) => {
                      const isPdf = item.name.toLowerCase().endsWith('.pdf');
                      const isDone = item.status === 'Completed';
                      const isFailed = item.status === 'Failed';
                      const isUploadingItem = item.status === 'Uploading';
                      const isProcessingItem = item.status === 'Processing';
                      const isCancelled = item.status === 'Cancelled';
                      const isWaiting = item.status === 'Waiting';

                      let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                      let badgeIcon = <Clock className="w-3.5 h-3.5 text-slate-500" />;
                      let badgeLabelBn = 'অপেক্ষারত (Waiting)';
                      let badgeLabelEn = 'Waiting';

                      if (isUploadingItem) {
                        badgeBg = 'bg-blue-100 text-blue-900 border-blue-300 animate-pulse';
                        badgeIcon = <UploadCloud className="w-3.5 h-3.5 text-blue-700" />;
                        badgeLabelBn = 'আপলোড হচ্ছে (Uploading)';
                        badgeLabelEn = 'Uploading';
                      } else if (isProcessingItem) {
                        badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                        badgeIcon = <RefreshCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />;
                        badgeLabelBn = 'প্রসেসিং ও ভেরিফিকেশন...';
                        badgeLabelEn = 'Processing...';
                      } else if (isDone) {
                        badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                        badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />;
                        badgeLabelBn = 'সম্পন্ন (Completed)';
                        badgeLabelEn = 'Completed';
                      } else if (isFailed) {
                        badgeBg = 'bg-rose-100 text-rose-900 border-rose-300';
                        badgeIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-700" />;
                        badgeLabelBn = 'ব্যর্থ (Failed)';
                        badgeLabelEn = 'Failed';
                      } else if (isCancelled) {
                        badgeBg = 'bg-slate-100 text-slate-600 border-slate-300';
                        badgeIcon = <XCircle className="w-3.5 h-3.5 text-slate-500" />;
                        badgeLabelBn = 'বাতিলকৃত (Cancelled)';
                        badgeLabelEn = 'Cancelled';
                      }

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-2xl border transition ${
                            isFailed
                              ? 'bg-rose-50/50 border-rose-200'
                              : isDone
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : isUploadingItem || isProcessingItem
                              ? 'bg-blue-50/30 border-blue-200 ring-1 ring-blue-100'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* File Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div
                                className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                                  isPdf
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {isPdf ? (
                                  <FileText className="w-4 h-4" />
                                ) : (
                                  <ImageIcon className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                                    {item.name}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    ({item.sizeFormatted})
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                  {isBn ? 'শীট:' : 'Sheet:'}{' '}
                                  <strong className="text-slate-800">{item.sheetNumber}</strong> |{' '}
                                  {item.mapTitle}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge & Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div
                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg}`}
                              >
                                {badgeIcon}
                                <span>{isBn ? badgeLabelBn : badgeLabelEn}</span>
                                {(isUploadingItem || isProcessingItem || isDone) && (
                                  <span>({item.percentage}%)</span>
                                )}
                              </div>

                              {/* Action buttons */}
                              {(isUploadingItem || isProcessingItem) && (
                                <button
                                  onClick={() => handleCancelItem(item.id)}
                                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                  title="আপলোড বাতিল করুন"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}

                              {(isFailed || isCancelled) && (
                                <button
                                  disabled={isUploading}
                                  onClick={() => handleRetrySingleItem(item.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-800 hover:bg-amber-900 text-white transition cursor-pointer disabled:opacity-50"
                                  title="পুনরায় চেষ্টা করুন"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>{isBn ? 'রিট্রাই' : 'Retry'}</span>
                                </button>
                              )}

                              {isWaiting && !isUploading && (
                                <button
                                  onClick={() => handleRemoveQueueItem(item.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                                  title="মুছে ফেলুন"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar & Byte Count */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                              <span>
                                {isBn ? 'স্থানান্তরিত:' : 'Transferred:'}{' '}
                                <strong className="text-slate-800">
                                  {item.bytesTransferred > 0
                                    ? formatFileSize(item.bytesTransferred)
                                    : isBn ? '০ বাইট' : '0 Bytes'}{' '}
                                  / {item.sizeFormatted}
                                </strong>
                              </span>
                              <span className="font-mono font-bold text-slate-800">
                                {toBengaliNumber(item.percentage)}%
                              </span>
                            </div>

                            <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-150 ${
                                  isDone
                                    ? 'bg-emerald-600'
                                    : isFailed
                                    ? 'bg-rose-500'
                                    : isCancelled
                                    ? 'bg-slate-400'
                                    : isProcessingItem
                                    ? 'bg-amber-500 animate-pulse'
                                    : isUploadingItem
                                    ? 'bg-blue-600'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${Math.max(isWaiting ? 0 : 2, item.percentage)}%` }}
                              />
                            </div>
                          </div>

                          {/* Info message */}
                          {item.message && (
                            <p className="text-[11px] text-slate-600 italic mt-1.5 flex items-center gap-1">
                              <Info className="w-3 h-3 shrink-0 text-slate-500" />
                              <span>{item.message}</span>
                            </p>
                          )}

                          {/* Error block if failed */}
                          {isFailed && item.error && (
                            <div className="mt-2 p-2 rounded-xl bg-rose-100/90 border border-rose-200 text-rose-900 text-xs flex items-start gap-1.5 font-medium">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-bold">আপলোড ত্রুটি:</p>
                                <p>{item.error}</p>
                              </div>
                            </div>
                          )}

                          {/* Editable Sheet & Title for waiting files */}
                          {isWaiting && !isUploading && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  শীট নং *
                                </label>
                                <input
                                  type="text"
                                  value={item.sheetNumber}
                                  onChange={(e) =>
                                    handleUpdateItemSheetNumber(item.id, e.target.value)
                                  }
                                  className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                  placeholder="০১"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  ম্যাপ শিরোনাম
                                </label>
                                <input
                                  type="text"
                                  value={item.mapTitle}
                                  onChange={(e) =>
                                    handleUpdateItemTitle(item.id, e.target.value)
                                  }
                                  className="w-full p-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                  placeholder="ম্যাপ শিরোনাম"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cascade Location Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    বিভাগ *
                  </label>
                  <select
                    value={uploadDivId}
                    onChange={(e) => {
                      setUploadDivId(e.target.value);
                      const d = getDistricts(e.target.value);
                      if (d.length > 0) {
                        setUploadDistId(d[0].id);
                        const u = getUpazilas(d[0].id);
                        if (u.length > 0) setUploadUpzId(u[0].id);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    জেলা *
                  </label>
                  <select
                    value={uploadDistId}
                    onChange={(e) => {
                      setUploadDistId(e.target.value);
                      const u = getUpazilas(e.target.value);
                      if (u.length > 0) setUploadUpzId(u[0].id);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {uploadDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    উপজেলা / থানা *
                  </label>
                  <select
                    value={uploadUpzId}
                    onChange={(e) => setUploadUpzId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    {uploadUpazilas.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nameBn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mouza Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    মৌজার নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    value={uploadMouzaNameBn}
                    onChange={(e) => setUploadMouzaNameBn(e.target.value)}
                    placeholder="যেমন: সাভার"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    জে.এল. নম্বর *
                  </label>
                  <input
                    type="text"
                    value={uploadJlNo}
                    onChange={(e) => setUploadJlNo(e.target.value)}
                    placeholder="যেমন: ২৪"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    সার্ভে টাইপ *
                  </label>
                  <select
                    value={uploadSurveyType}
                    onChange={(e) =>
                      setUploadSurveyType(e.target.value as SurveyRecordType)
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="CS">CS (ক্যাডাস্ট্রাল)</option>
                    <option value="SA">SA (স্টেট একুইজিশন)</option>
                    <option value="RS">RS (রিভিশনাল)</option>
                    <option value="BS">BS / BRS (বাংলাদেশ)</option>
                    <option value="City">City Survey</option>
                    <option value="Diara">Diara Survey</option>
                    <option value="Other">অন্যান্য</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    শীট নম্বর *
                  </label>
                  <input
                    type="text"
                    value={uploadSheetNumber}
                    onChange={(e) => setUploadSheetNumber(e.target.value)}
                    placeholder="যেমন: ০১ বা ১"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* Title & Provenance Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ম্যাপের শিরোনাম / পরিচিতি
                  </label>
                  <input
                    type="text"
                    value={uploadMapTitle}
                    onChange={(e) => setUploadMapTitle(e.target.value)}
                    placeholder="সাভার মৌজা নকশা - শীট ০১ (RS)"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    উৎস / প্রোভেন্যান্স (Provenance) *
                  </label>
                  <input
                    type="text"
                    value={uploadSource}
                    onChange={(e) => setUploadSource(e.target.value)}
                    placeholder="যেমন: জেলা রেকর্ড রুম সংগ্রহ / সার্ভেয়ারের কপি"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* Scale & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    নকশার স্কেল
                  </label>
                  <input
                    type="text"
                    value={uploadScale}
                    onChange={(e) => setUploadScale(e.target.value)}
                    placeholder='16" = 1 mile'
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    অতিরিক্ত নোট / বিবরণ
                  </label>
                  <input
                    type="text"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="দাগ নম্বর ও সীমানার প্রাসঙ্গিক তথ্য..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* Upload Button Section */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                <div className="text-xs text-slate-600 font-medium">
                  {uploadQueue.length > 0 && (
                    <div>
                      {overallBatchProgress?.completedFiles === uploadQueue.length &&
                      uploadQueue.length > 0 ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{isBn ? 'সকল ম্যাপ ফাইল সফলভাবে লাইব্রেরিতে সংরক্ষিত হয়েছে!' : 'All map files successfully saved to library!'}</span>
                        </span>
                      ) : (
                        <span>
                          {toBengaliNumber(
                            uploadQueue.filter(
                              (x) =>
                                x.status === 'Waiting' ||
                                x.status === 'Failed' ||
                                x.status === 'Cancelled'
                            ).length
                          )}{' '}
                          {isBn ? 'টি ফাইল আপলোড বাকি রয়েছে' : 'files pending upload'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {overallBatchProgress?.completedFiles === uploadQueue.length &&
                    uploadQueue.length > 0 && (
                      <button
                        onClick={() => setActiveTab('library')}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                      >
                        <Archive className="w-4 h-4 text-amber-800" />
                        <span>{isBn ? 'লাইব্রেরি তালিকায় দেখুন' : 'View in Library'}</span>
                      </button>
                    )}

                  <button
                    disabled={
                      isUploading ||
                      uploadQueue.length === 0 ||
                      (overallBatchProgress?.completedFiles === uploadQueue.length &&
                        uploadQueue.length > 0)
                    }
                    onClick={handleDoUpload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>
                      {isUploading
                        ? isBn
                          ? 'আপলোড ও সংরক্ষণ হচ্ছে...'
                          : 'Uploading & Processing...'
                        : uploadQueue.some((q) => q.status === 'Failed')
                        ? isBn
                          ? 'ব্যর্থ ফাইলগুলো পুনরায় আপলোড করুন'
                          : 'Retry Failed Files'
                        : isBn
                        ? 'ম্যাপ সংরক্ষণ ও লাইব্রেরিতে যোগ করুন'
                        : 'Upload and Save to Library'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BULK METADATA IMPORT ARCHITECTURE */}
          {/* ========================================================================= */}
          {activeTab === 'bulk_import' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  {isBn ? 'বাল্ক মেটাডাটা ইম্পোর্ট আর্কিটেকচার' : 'Bulk Map Metadata Import'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'CSV বা JSON ফরম্যাটের মাধ্যমে একাধিক মৌজা ম্যাপের সূচি ও মেটাডাটা যাচাই করে ইম্পোর্ট করুন'
                    : 'Validate and import multiple mouza map metadata entries via CSV or JSON'}
                </p>
              </div>

              {/* Important Disclaimer about bulk metadata */}
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" />
                <div>
                  <strong>নীতিমালা সতর্কতা:</strong> মেটাডাটা ইম্পোর্ট করলেই ম্যাপ ফাইল
                  আপলোড হয়েছে বলে গণ্য হবে না। যেসব রেকর্ডে ফাইল রেফারেন্স থাকবে না,
                  সেগুলো স্বয়ংক্রিয়ভাবে <strong>'Missing File'</strong> স্ট্যাটাসে
                  সংরক্ষিত হবে যেন পরবর্তীতে অ্যাডমিন ফাইল সংযুক্ত করতে পারেন।
                </div>
              </div>

              {/* Format selection and templates */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => {
                      setBulkFormat('csv');
                      setBulkText(getBulkMapCsvTemplate());
                    }}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      bulkFormat === 'csv'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    CSV ফরম্যাট
                  </button>
                  <button
                    onClick={() => {
                      setBulkFormat('json');
                      setBulkText(getBulkMapJsonTemplate());
                    }}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      bulkFormat === 'json'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    JSON ফরম্যাট
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setBulkText(
                        bulkFormat === 'csv'
                          ? getBulkMapCsvTemplate()
                          : getBulkMapJsonTemplate()
                      )
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>টেমপ্লেট লোড করুন</span>
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <div>
                <textarea
                  rows={8}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={
                    bulkFormat === 'csv'
                      ? 'district,upazila,mouza,jlNo,surveyType,sheetNumber,fileReference,notes...'
                      : '[{ "districtNameBn": "...", ... }]'
                  }
                  className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Validate button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleValidateBulk}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>যাচাইকরণ চালান (Validate Data)</span>
                </button>
              </div>

              {/* Validation Result Box */}
              {bulkResult && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="text-xs font-bold text-slate-800">
                      যাচাইকরণের ফলাফল (Validation Summary)
                    </h5>
                    <span className="text-[11px] text-slate-500">
                      মোট সারি: {bulkResult.total}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold">
                      বৈধ রেকর্ড: {bulkResult.validCount}
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-bold">
                      ফাইলহীন (Missing File): {bulkResult.missingFileCount}
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 font-bold">
                      ডুপ্লিকেট: {bulkResult.duplicateCount}
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 font-bold">
                      ত্রুটিযুক্ত: {bulkResult.rejectedCount}
                    </div>
                  </div>

                  {bulkResult.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                      <div className="font-bold">চিহ্নিত ত্রুটিসমূহ:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {bulkResult.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {bulkResult.validCount > 0 && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleCommitBulk}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {bulkResult.validCount} টি মেটাডাটা লাইব্রেরিতে সংরক্ষণ করুন
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: EXTERNAL SOURCE DIRECTORY */}
          {/* ========================================================================= */}
          {activeTab === 'external_sources' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-slate-900">
                    {isBn
                      ? 'বহিঃস্থ মৌজা নকশা রেফারেন্স ডিরেক্টরি'
                      : 'External Mouza Map Source Directory'}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    সরকারি ও উন্মুক্ত রেফারেন্স
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'অনুমোদিত তৃতীয় পক্ষের ওয়েবসাইট রেফারেন্স লিংক। আমাদের সার্ভারে ম্যাপ নেই এমন ক্ষেত্রে ব্যবহারকারীদের সরকারি বা উন্মুক্ত সোর্স ব্রাউজ করার সুবিধা।'
                    : 'External reference links for public and governmental mouza portals.'}
                </p>
              </div>

              {/* CRITICAL COMPLIANCE NOTICE */}
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4" />
                  <span>আইনগত ও স্বচ্ছতা নিশ্চয়তা (Compliance & Disclaimer)</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ১. এই বহিঃস্থ ওয়েবসাইটগুলো আমাদের নিজস্ব সার্ভারের অংশ নয়। এগুলোকে
                  কখনো নিজস্ব সার্ভার ম্যাপ হিসেবে দাবি করা হয় না।
                  <br />
                  ২. কোনো তৃতীয় পক্ষের ওয়েবসাইট থেকে অনুমতি ছাড়া bulk scraping,
                  স্বয়ংক্রিয় ডাউনলোড বা রিডিস্ট্রিবিউশন করা হয় না।
                  <br />
                  ৩. বহিঃস্থ লিংকে নির্দিষ্ট মৌজা নকশা সক্রিয় আছে কি না তা পূর্বানুমান
                  করা হয় না; ব্যবহারকারী সরাসরি মূল সাইটে ভিজিট করে যাচাই করবেন।
                </p>
              </div>

              {/* External Sources List */}
              <div className="space-y-3">
                {externalSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-amber-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                          {source.sourceName}
                        </h5>
                        {source.isVerifiedPublicPortal && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                            সরকারি পোর্টাল
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-slate-400" />
                        <span>{source.websiteUrl}</span>
                      </div>
                      <p className="text-xs text-slate-600">{source.notes}</p>
                      <div className="text-[10px] text-slate-400">
                        সর্বশেষ পর্যবেক্ষণ: {source.lastCheckedDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <a
                        href={source.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold shadow-2xs transition active:scale-95"
                      >
                        <span>ভিজিট করুন</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Admin delete for custom external sources */}
                      {!source.isVerifiedPublicPortal && (
                        <button
                          onClick={() => handleDeleteExternalSource(source.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Admin: Add New External Source Form */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-800">
                  নতুন বহিঃস্থ রেফারেন্স লিংক যুক্ত করুন (অ্যাডমিন)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <input
                    type="text"
                    value={newSourceTitle}
                    onChange={(e) => setNewSourceTitle(e.target.value)}
                    placeholder="সোর্সের নাম (যেমন: ঢাকা জেলা রেকর্ড রুম অনলাইন)"
                    className="p-2.5 rounded-xl border border-slate-200"
                  />
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="https://example.gov.bd/mouza"
                    className="p-2.5 rounded-xl border border-slate-200"
                  />
                  <input
                    type="text"
                    value={newSourceNotes}
                    onChange={(e) => setNewSourceNotes(e.target.value)}
                    placeholder="নোট বা বিবরণ..."
                    className="p-2.5 rounded-xl border border-slate-200 sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddExternalSource}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>লিংক যুক্ত করুন</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Service Disclaimer */}
          <ProfessionalServiceDisclaimer lang={lang} variant="compact" />
        </div>
      </div>

      {/* Hidden File Input for Relinking / Replacing Maps */}
      <input
        type="file"
        ref={relinkInputRef}
        onChange={handleRelinkFileSelected}
        accept="image/*,application/pdf"
        className="hidden"
      />

      {/* Floating Relink Progress Modal */}
      {relinkProgress && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-amber-800" />
                <h4 className="text-sm font-black text-slate-900">
                  {isBn ? 'ম্যাপ ফাইল রিলিংক হচ্ছে...' : 'Relinking Map File...'}
                </h4>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                {relinkProgress.percentage}%
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800 truncate">
                {relinkProgress.fileName}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>
                  স্থানান্তরিত: {formatFileSize(relinkProgress.bytesTransferred)} /{' '}
                  {formatFileSize(relinkProgress.totalBytes)}
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {toBengaliNumber(relinkProgress.percentage)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    relinkProgress.status === 'Completed'
                      ? 'bg-emerald-600'
                      : relinkProgress.status === 'Failed'
                      ? 'bg-rose-500'
                      : 'bg-amber-600'
                  }`}
                  style={{ width: `${relinkProgress.percentage}%` }}
                />
              </div>
              {relinkProgress.message && (
                <p className="text-[11px] text-slate-600 italic">
                  {relinkProgress.message}
                </p>
              )}
            </div>

            {relinkProgress.status === 'Uploading' && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => relinkToken?.cancel()}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition cursor-pointer"
                >
                  রিলিংক বাতিল করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
