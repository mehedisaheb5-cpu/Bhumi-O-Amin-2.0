import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Search,
  FileText,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
  X,
  Plus,
  Filter,
  ArrowUpDown,
  Check,
  FolderOpen,
} from 'lucide-react';
import { Language, UploadedMapFile, MapLayerCategory } from '../../types';
import {
  getStoredMapFiles,
  saveMapFile,
  deleteMapFile,
  renameMapFile,
  validateMapFile,
  formatFileSize,
  estimatePdfPageCount,
} from '../../lib/pentagraph-files';

interface PentagraphFileLibraryModalProps {
  lang: Language;
  onBack: () => void;
  selectedCsFile: UploadedMapFile | null;
  selectedBsFile: UploadedMapFile | null;
  onSelectCsFile: (file: UploadedMapFile) => void;
  onSelectBsFile: (file: UploadedMapFile) => void;
  onRemoveCsFile: () => void;
  onRemoveBsFile: () => void;
  onViewFile: (file: UploadedMapFile) => void;
}

export const PentagraphFileLibraryModal: React.FC<PentagraphFileLibraryModalProps> = ({
  lang,
  onBack,
  selectedCsFile,
  selectedBsFile,
  onSelectCsFile,
  onSelectBsFile,
  onRemoveCsFile,
  onRemoveBsFile,
  onViewFile,
}) => {
  const isBn = lang === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Files State
  const [files, setFiles] = useState<UploadedMapFile[]>(() => getStoredMapFiles());
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MapLayerCategory>('all');

  // Upload Form State
  const [showUploadDropzone, setShowUploadDropzone] = useState<boolean>(false);
  const [uploadCategory, setUploadCategory] = useState<MapLayerCategory>('cs_map');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

  // Inline Rename State
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  // Reload files from storage
  const refreshFiles = () => {
    setFiles(getStoredMapFiles());
  };

  useEffect(() => {
    const handleStorage = () => refreshFiles();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('bhumi_pentagraph_files_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('bhumi_pentagraph_files_updated', handleStorage);
    };
  }, []);

  // Filtered & Sorted files
  const filteredFiles = files
    .filter((f) => {
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.notes && f.notes.toLowerCase().includes(q)) ||
        f.fileType.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return Number(b.uploadedAt) - Number(a.uploadedAt);
      if (sortBy === 'oldest') return Number(a.uploadedAt) - Number(b.uploadedAt);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return b.size - a.size;
      return 0;
    });

  // Handle File Selection for Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
    e.target.value = '';
  };

  // Process File with Validation
  const processUploadedFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setIsProcessingUpload(true);

    try {
      // 1. Validate File (Format, Size, Corrupted PDF Check)
      const val = await validateMapFile(file);
      if (!val.valid) {
        setUploadError(isBn ? val.errorBn || 'ফাইলের ত্রুটি' : val.errorEn || 'File validation error');
        setIsProcessingUpload(false);
        return;
      }

      // 2. Read File Data
      const fileType = val.fileType || 'pdf';
      let pageCount = 1;

      if (fileType === 'pdf') {
        const textSlice = await file.slice(0, 100000).text();
        pageCount = estimatePdfPageCount(textSlice);
      }

      const reader = new FileReader();
      reader.onerror = () => {
        setUploadError(
          isBn ? 'ফাইলটি পড়তে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Failed to read file.'
        );
        setIsProcessingUpload(false);
      };

      reader.onload = async (loadEv) => {
        try {
          const dataUrl = loadEv.target?.result as string;
          const newRecord: UploadedMapFile = {
            id: `mapfile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            fileType,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            uploadedAt: Date.now(),
            dataUrl,
            category: uploadCategory,
            pageCount,
            notes: `${uploadCategory === 'cs_map' ? 'CS ম্যাপ' : uploadCategory === 'bs_map' ? 'BS ম্যাপ' : 'মৌজা নকশা'} ফাইল`,
          };

          await saveMapFile(newRecord);
          refreshFiles();

          setUploadSuccess(
            isBn
              ? `"${file.name}" সফলভাবে আপলোড করা হয়েছে!`
              : `"${file.name}" uploaded successfully!`
          );
          setIsProcessingUpload(false);
          setShowUploadDropzone(false);
          setTimeout(() => setUploadSuccess(null), 4000);
        } catch (err) {
          console.error(err);
          setUploadError(
            isBn ? 'ফাইল সংরক্ষণে সমস্যা হয়েছে।' : 'Error saving file to storage.'
          );
          setIsProcessingUpload(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'File upload error');
      setIsProcessingUpload(false);
    }
  };

  // Delete Action
  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        isBn
          ? `আপনি কি নিশ্চিত "${name}" ফাইলটি মুছে ফেলতে চান?`
          : `Are you sure you want to delete "${name}"?`
      )
    ) {
      if (selectedCsFile?.id === id) onRemoveCsFile();
      if (selectedBsFile?.id === id) onRemoveBsFile();
      await deleteMapFile(id);
      refreshFiles();
    }
  };

  // Rename Action
  const handleSaveRename = (id: string) => {
    if (!editName.trim()) return;
    renameMapFile(id, editName.trim());
    setEditingFileId(null);
    refreshFiles();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Toolbar with "← ফিরে যান" */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBn ? '← ফিরে যান' : '← Back'}</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                <FolderOpen className="w-5 h-5 text-emerald-800" />
                <span>{isBn ? 'আপলোড করা ফাইল' : 'Uploaded Files'}</span>
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {files.length} {isBn ? 'টি ফাইল' : 'files'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isBn
                ? 'সিএস ও বিএস মৌজা নকশা, পিডিএফ ও ড্রয়িং ফাইলের স্থায়ী সংরক্ষণাগার'
                : 'Persistent library of CS & BS Cadastral maps, PDFs & Survey files'}
            </p>
          </div>
        </div>

        {/* Upload Toggle Button */}
        <button
          onClick={() => setShowUploadDropzone((prev) => !prev)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{isBn ? 'ফাইল আপলোড করুন' : 'Upload File'}</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Active Selected CS & BS Map Status Strip */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 via-white to-slate-50 border border-slate-200/90 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* CS Map Selection */}
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
              {isBn ? 'CS ম্যাপ:' : 'CS Map:'}
            </span>
            <span className="text-xs font-bold text-slate-900 block truncate">
              {selectedCsFile ? selectedCsFile.name : isBn ? '— কোনো ফাইল নির্বাচিত নেই —' : '— No file selected —'}
            </span>
            {selectedCsFile && (
              <span className="text-[10px] text-amber-700">
                {selectedCsFile.sizeFormatted} | {selectedCsFile.fileType.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedCsFile ? (
              <>
                <button
                  onClick={() => onViewFile(selectedCsFile)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
                >
                  {isBn ? 'দেখুন' : 'View'}
                </button>
                <button
                  onClick={onRemoveCsFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title={isBn ? 'বাদ দিন' : 'Remove'}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span className="text-[11px] text-amber-700 font-semibold">
                {isBn ? 'নিচের তালিকা থেকে নির্বাচন করুন' : 'Select from list below'}
              </span>
            )}
          </div>
        </div>

        {/* BS Map Selection */}
        <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200/80 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800 block">
              {isBn ? 'BS ম্যাপ:' : 'BS Map:'}
            </span>
            <span className="text-xs font-bold text-slate-900 block truncate">
              {selectedBsFile ? selectedBsFile.name : isBn ? '— কোনো ফাইল নির্বাচিত নেই —' : '— No file selected —'}
            </span>
            {selectedBsFile && (
              <span className="text-[10px] text-cyan-700">
                {selectedBsFile.sizeFormatted} | {selectedBsFile.fileType.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {selectedBsFile ? (
              <>
                <button
                  onClick={() => onViewFile(selectedBsFile)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-cyan-300 text-cyan-900 text-xs font-bold hover:bg-cyan-100 transition cursor-pointer"
                >
                  {isBn ? 'দেখুন' : 'View'}
                </button>
                <button
                  onClick={onRemoveBsFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title={isBn ? 'বাদ দিন' : 'Remove'}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span className="text-[11px] text-cyan-700 font-semibold">
                {isBn ? 'নিচের তালিকা থেকে নির্বাচন করুন' : 'Select from list below'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Upload Drawer / Dropzone */}
      {/* -------------------------------------------------------------------- */}
      {showUploadDropzone && (
        <div className="p-4 rounded-2xl bg-white border-2 border-dashed border-emerald-400 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>{isBn ? 'নতুন নকশা / পিডিএফ ফাইল আপলোড করুন' : 'Upload Map / PDF File'}</span>
            </h4>
            <button
              onClick={() => setShowUploadDropzone(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category Picker */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">{isBn ? 'লেয়ার ক্যাটাগরি:' : 'Category:'}</span>
            {(['cs_map', 'bs_map', 'rs_map', 'general'] as MapLayerCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setUploadCategory(cat)}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  uploadCategory === cat
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat === 'cs_map'
                  ? 'CS ম্যাপ'
                  : cat === 'bs_map'
                  ? 'BS ম্যাপ'
                  : cat === 'rs_map'
                  ? 'RS ম্যাপ'
                  : 'সাধারণ'}
              </button>
            ))}
          </div>

          {/* Dropzone Container */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/40 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.geojson,.json,.kml,.kmz"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {isBn
                  ? 'ফাইল নির্বাচন করতে এখানে ক্লিক করুন বা ড্র্যাগ করে ছাড়ুন'
                  : 'Click to select file or drag and drop here'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isBn
                  ? 'সমর্থিত ফরম্যাট: PDF, JPG, PNG, GeoJSON, KML (সর্বোচ্চ ৩০ MB)'
                  : 'Supported: PDF, JPG, PNG, GeoJSON, KML (Max 30 MB)'}
              </p>
            </div>
          </div>

          {isProcessingUpload && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 py-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>{isBn ? 'ফাইল যাচাই ও প্রক্রিয়াকরণ হচ্ছে...' : 'Validating & processing file...'}</span>
            </div>
          )}
        </div>
      )}

      {/* Error & Success Messages */}
      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. Search, Filter & Sort Controls */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isBn ? 'ফাইলের নাম দিয়ে খুঁজুন...' : 'Search by filename...'}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-700 text-xs"
          />
        </div>

        {/* Category Filters & Sort */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 text-xs focus:outline-hidden"
          >
            <option value="all">{isBn ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
            <option value="cs_map">{isBn ? 'CS ম্যাপ' : 'CS Maps'}</option>
            <option value="bs_map">{isBn ? 'BS ম্যাপ' : 'BS Maps'}</option>
            <option value="rs_map">{isBn ? 'RS ম্যাপ' : 'RS Maps'}</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 text-xs focus:outline-hidden"
          >
            <option value="newest">{isBn ? 'সর্বশেষ আপলোড' : 'Newest'}</option>
            <option value="oldest">{isBn ? 'পুরাতন আগে' : 'Oldest'}</option>
            <option value="name">{isBn ? 'নাম অনুযায়ী' : 'Name'}</option>
            <option value="size">{isBn ? 'সাইজ অনুযায়ী' : 'File Size'}</option>
          </select>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 5. Uploaded Files List */}
      {/* -------------------------------------------------------------------- */}
      {filteredFiles.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-700">
              {isBn ? 'কোনো ফাইল পাওয়া যায়নি' : 'No files found'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? isBn
                  ? 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো ফাইল নেই।'
                  : 'No files match your search query.'
                : isBn
                ? 'পেন্টাগ্রাফ বিশ্লেষণের জন্য উপরের "ফাইল আপলোড করুন" বাটনে ক্লিক করে সিএস বা বিএস নকশা আপলোড করুন।'
                : 'Upload CS or BS map sheets above to compare cadastral boundaries.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFiles.map((file) => {
            const isCs = selectedCsFile?.id === file.id;
            const isBs = selectedBsFile?.id === file.id;

            return (
              <div
                key={file.id}
                className={`p-3.5 rounded-2xl bg-white border transition shadow-2xs hover:shadow-xs flex flex-col justify-between gap-3 ${
                  isCs
                    ? 'border-amber-400 ring-1 ring-amber-400 bg-amber-50/20'
                    : isBs
                    ? 'border-cyan-400 ring-1 ring-cyan-400 bg-cyan-50/20'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* File Details Top */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        file.fileType === 'pdf'
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : file.fileType === 'image'
                          ? 'bg-sky-50 text-sky-600 border border-sky-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      {file.fileType === 'pdf' ? (
                        <FileText className="w-5 h-5" />
                      ) : file.fileType === 'image' ? (
                        <ImageIcon className="w-5 h-5" />
                      ) : (
                        <Layers className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      {editingFileId === file.id ? (
                        <div className="flex items-center gap-1.5 mb-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2 py-0.5 rounded border border-emerald-600 text-xs font-bold w-48 text-slate-900"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(file.id)}
                            className="px-2 py-0.5 rounded bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                          >
                            {isBn ? 'সংরক্ষণ' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingFileId(null)}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h4
                            onClick={() => onViewFile(file)}
                            className="text-xs sm:text-sm font-bold text-slate-900 hover:text-emerald-800 cursor-pointer truncate max-w-[200px] sm:max-w-[240px]"
                            title={file.name}
                          >
                            {file.name}
                          </h4>
                          <button
                            onClick={() => {
                              setEditingFileId(file.id);
                              setEditName(file.name);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={isBn ? 'নাম পরিবর্তন' : 'Rename'}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-600">
                          {file.sizeFormatted || formatFileSize(file.size)}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(file.uploadedAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                        </span>
                        {file.pageCount && file.pageCount > 1 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-rose-600">
                              {file.pageCount} {isBn ? 'পৃষ্ঠা' : 'pages'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category Pill */}
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      file.category === 'cs_map'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : file.category === 'bs_map'
                        ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {file.category === 'cs_map'
                      ? 'CS ম্যাপ'
                      : file.category === 'bs_map'
                      ? 'BS ম্যাপ'
                      : file.category === 'rs_map'
                      ? 'RS ম্যাপ'
                      : 'সাধারণ'}
                  </span>
                </div>

                {/* File Action Controls Bottom */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                  {/* Left: View & Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onViewFile(file)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{isBn ? 'দেখুন' : 'View'}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(file.id, file.name)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title={isBn ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Right: Select for Pentagraph as CS or BS */}
                  <div className="flex items-center gap-1.5">
                    {/* CS Button */}
                    <button
                      onClick={() => (isCs ? onRemoveCsFile() : onSelectCsFile(file))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                        isCs
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80'
                      }`}
                    >
                      {isCs && <Check className="w-3 h-3" />}
                      <span>{isCs ? (isBn ? 'CS ম্যাপ সক্রিয়' : 'CS Active') : isBn ? 'CS ম্যাপ' : 'Set CS'}</span>
                    </button>

                    {/* BS Button */}
                    <button
                      onClick={() => (isBs ? onRemoveBsFile() : onSelectBsFile(file))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                        isBs
                          ? 'bg-cyan-600 text-white shadow-2xs'
                          : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300/80'
                      }`}
                    >
                      {isBs && <Check className="w-3 h-3" />}
                      <span>{isBs ? (isBn ? 'BS ম্যাপ সক্রিয়' : 'BS Active') : isBn ? 'BS ম্যাপ' : 'Set BS'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
