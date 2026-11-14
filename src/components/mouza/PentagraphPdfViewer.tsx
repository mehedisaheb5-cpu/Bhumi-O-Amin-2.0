import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Check,
  Layers,
  MapPin,
  ShieldCheck,
  Compass,
  FileWarning,
} from 'lucide-react';
import { Language, UploadedMapFile } from '../../types';
import { formatFileSize, getStoredMapFileWithContent } from '../../lib/pentagraph-files';

interface PentagraphPdfViewerProps {
  file: UploadedMapFile;
  lang: Language;
  onBack: () => void;
  onSelectAsCs?: (file: UploadedMapFile) => void;
  onSelectAsBs?: (file: UploadedMapFile) => void;
}

export const PentagraphPdfViewer: React.FC<PentagraphPdfViewerProps> = ({
  file: initialFile,
  lang,
  onBack,
  onSelectAsCs,
  onSelectAsBs,
}) => {
  const isBn = lang === 'bn';
  const [file, setFile] = useState<UploadedMapFile>(initialFile);
  const [loading, setLoading] = useState<boolean>(!initialFile.dataUrl && !initialFile.rawText);

  // Pagination
  const totalPages = Math.max(1, file.pageCount || 1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Zoom controls: 25% to 400%
  const [zoom, setZoom] = useState<number>(100);

  // Pan controls for image/canvas mode
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mode: 'embed' (standard browser PDF viewer) or 'canvas' (custom inspection preview)
  const [viewMode, setViewMode] = useState<'embed' | 'canvas'>('embed');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);

  // PDF vs Image detection based on MIME type, fileType, and extension
  const isPdf =
    file.fileType === 'pdf' ||
    Boolean(file.mimeType?.toLowerCase().includes('pdf')) ||
    Boolean(file.name?.toLowerCase().endsWith('.pdf')) ||
    Boolean(file.dataUrl?.startsWith('data:application/pdf')) ||
    Boolean(file.dataUrl?.toLowerCase().includes('.pdf'));

  // Fetch full binary content from storage if needed
  useEffect(() => {
    let isMounted = true;
    setImgError(false);
    if (!initialFile.dataUrl && !initialFile.rawText) {
      setLoading(true);
      getStoredMapFileWithContent(initialFile.id || initialFile.name).then((full) => {
        if (isMounted) {
          if (full && (full.dataUrl || full.rawText)) {
            setFile(full);
          } else {
            setFile(initialFile);
          }
          setLoading(false);
        }
      });
    } else {
      setFile(initialFile);
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [initialFile]);

  // Handle Zoom
  const handleZoomIn = () => setZoom((z) => Math.min(400, z + 25));
  const handleZoomOut = () => setZoom((z) => Math.max(25, z - 25));
  const handleResetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };
  const handleFitToScreen = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  // Handle Page Navigation
  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  // Handle Download
  const handleDownload = () => {
    if (!file.dataUrl) {
      // If sample without real blob, create simulated text download
      const blob = new Blob([file.rawText || 'Bhumi O Amin Cadastral Mouza Map Sheet Sample Content'], {
        type: file.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const a = document.createElement('a');
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  };

  // Image / Canvas Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Toolbar with CRITICAL "← ফিরে যান" Back button */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-800/95 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Back button & File Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            title={isBn ? 'পেন্টাগ্রাফ ওয়ার্কস্পেসে ফিরে যান' : 'Return to Pentagraph Workspace'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBn ? '← ফিরে যান' : '← Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-700 text-rose-400">
              {file.fileType === 'pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-white max-w-[240px] sm:max-w-md truncate">
                  {file.name}
                </h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {file.sizeFormatted || formatFileSize(file.size)}
                </span>
                {file.category && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                    {file.category === 'cs_map'
                      ? 'CS ম্যাপ'
                      : file.category === 'bs_map'
                      ? 'BS ম্যাপ'
                      : file.category === 'rs_map'
                      ? 'RS ম্যাপ'
                      : 'সাধারণ'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {isBn ? 'ডিজিটাল পেন্টাগ্রাফ মানচিত্র ভিউয়ার' : 'Digital Pentagraph Map Viewer'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Pagination & Zoom Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Multi-page controls */}
          {totalPages > 1 && (
            <div className="flex items-center bg-slate-700/80 rounded-xl px-2 py-1 gap-1.5 text-xs font-bold text-slate-200">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title={isBn ? 'পূর্ববর্তী পৃষ্ঠা' : 'Previous page'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1 text-[11px]">
                {isBn ? `পৃষ্ঠা ${currentPage} / ${totalPages}` : `Page ${currentPage} / ${totalPages}`}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1 rounded hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title={isBn ? 'পরবর্তী পৃষ্ঠা' : 'Next page'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-700/80 rounded-xl px-2 py-1 gap-1 text-xs font-bold text-slate-200">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-slate-600 transition cursor-pointer"
              title={isBn ? 'জুম আউট' : 'Zoom Out'}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 text-center text-[11px] text-emerald-300 font-mono">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-slate-600 transition cursor-pointer"
              title={isBn ? 'জুম ইন' : 'Zoom In'}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-600 mx-1" />
            <button
              onClick={handleResetZoom}
              className="p-1 rounded hover:bg-slate-600 transition cursor-pointer"
              title={isBn ? 'রিসেট (১০০%)' : 'Reset (100%)'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitToScreen}
              className="p-1 rounded hover:bg-slate-600 transition cursor-pointer"
              title={isBn ? 'স্ক্রিনে ফিট' : 'Fit to Screen'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Select as CS/BS & Download actions */}
        <div className="flex items-center gap-1.5">
          {onSelectAsCs && (
            <button
              onClick={() => {
                onSelectAsCs(file);
                setActionSuccess(isBn ? 'CS ম্যাপ হিসেবে নির্বাচিত!' : 'Selected as CS Map!');
                setTimeout(() => setActionSuccess(null), 3000);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
            >
              {isBn ? 'CS ম্যাপ হিসেবে ব্যবহার' : 'Set as CS Map'}
            </button>
          )}

          {onSelectAsBs && (
            <button
              onClick={() => {
                onSelectAsBs(file);
                setActionSuccess(isBn ? 'BS ম্যাপ হিসেবে নির্বাচিত!' : 'Selected as BS Map!');
                setTimeout(() => setActionSuccess(null), 3000);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer"
            >
              {isBn ? 'BS ম্যাপ হিসেবে ব্যবহার' : 'Set as BS Map'}
            </button>
          )}

          <button
            onClick={handleDownload}
            className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
            title={isBn ? 'ডাউনলোড করুন' : 'Download'}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-900/90 text-emerald-200 px-4 py-1.5 text-xs font-bold flex items-center gap-2 justify-center border-b border-emerald-700">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Main Viewing Canvas */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center p-2">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold">
              {isBn ? 'মানচিত্র ফাইল লোড হচ্ছে...' : 'Loading map file...'}
            </span>
          </div>
        ) : isPdf && file.dataUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <object
              data={file.dataUrl}
              type="application/pdf"
              className="w-full h-full rounded-xl bg-white border border-slate-800"
            >
              <iframe
                key={`pdf-frame-${file.id}-${currentPage}-${zoom}`}
                src={`${file.dataUrl}#page=${currentPage}&zoom=${zoom}`}
                className="w-full h-full rounded-xl bg-white border border-slate-800"
                title={file.name}
              />
            </object>
          </div>
        ) : !isPdf && file.dataUrl && !imgError ? (
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden"
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                transformOrigin: 'center center',
              }}
              className="select-none"
            >
              <img
                src={file.dataUrl}
                alt={file.name}
                onError={() => setImgError(true)}
                className="max-w-none rounded-lg shadow-2xl border border-slate-800 pointer-events-none"
              />
            </div>
          </div>
        ) : imgError ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900/90 rounded-2xl border border-rose-500/30 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <FileWarning className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {isBn ? 'মৌজা নকশা ইমেজটি লোড করা যায়নি' : 'Unable to render map image'}
            </h4>
            <p className="text-xs text-slate-400">
              {isBn
                ? 'ফাইল পাথ বা রেফারেন্সটি ক্ষতিগ্রস্ত হতে পারে। লাইব্রেরি থেকে ফাইলটি পুনরায় লিংক (Relink) করতে পারেন।'
                : 'File source or reference may be damaged. Please relink the file in the library.'}
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
              >
                {isBn ? 'লাইব্রেরিতে ফিরে যান' : 'Back to Library'}
              </button>
            )}
          </div>
        ) : (
          /* High-Resolution SVG Cadastral Simulation Mode for Samples / Previews */
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden select-none"
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                transformOrigin: 'center center',
              }}
              className="w-[850px] h-[600px] bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl relative"
            >
              {/* Cadastral Sheet Header */}
              <div className="border-b border-slate-700 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    {file.category === 'cs_map'
                      ? 'সিএস মৌজা নকশা শিট (Cadastral Survey)'
                      : file.category === 'bs_map'
                      ? 'বিএস জরিপ চূড়ান্ত নকশা (Bangladesh Survey)'
                      : 'মৌজা নকশা ডকুমেন্ট'}
                  </span>
                  <h3 className="text-sm font-black text-white">{file.name}</h3>
                  <p className="text-[10px] text-slate-400">
                    স্কেল: ১৬ ইঞ্চি = ১ মাইল | পৃষ্ঠা: {currentPage} / {totalPages}
                  </p>
                </div>
                {/* True North Compass */}
                <div className="flex flex-col items-center">
                  <Compass className="w-7 h-7 text-rose-400 animate-pulse" />
                  <span className="text-[9px] font-black text-rose-400">উত্তর (N)</span>
                </div>
              </div>

              {/* Cadastral Grid & Dag Lines */}
              <svg className="w-full h-[460px] border border-slate-800 rounded-xl bg-slate-950">
                <defs>
                  <pattern id="viewerGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#viewerGrid)" />

                {/* Sample Cadastral Dag Boundaries */}
                <g transform="translate(120, 60)">
                  {/* Dag 314 */}
                  <polygon
                    points="50,40 220,50 240,180 60,160"
                    fill={file.category === 'cs_map' ? '#065f46' : '#1e3a8a'}
                    fillOpacity="0.4"
                    stroke={file.category === 'cs_map' ? '#10b981' : '#3b82f6'}
                    strokeWidth="2"
                  />
                  <text x="140" y="115" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">
                    দাগ ৩১৪
                  </text>
                  <text x="140" y="135" fill="#cbd5e1" fontSize="10" textAnchor="middle">
                    ২৫.৫০ শতক
                  </text>

                  {/* Dag 315 */}
                  <polygon
                    points="220,50 380,60 390,190 240,180"
                    fill="#334155"
                    fillOpacity="0.3"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <text x="305" y="120" fill="#94a3b8" fontSize="13" fontWeight="bold" textAnchor="middle">
                    দাগ ৩১৫
                  </text>

                  {/* Dag 316 */}
                  <polygon
                    points="60,160 240,180 230,300 40,280"
                    fill="#334155"
                    fillOpacity="0.3"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <text x="140" y="235" fill="#94a3b8" fontSize="13" fontWeight="bold" textAnchor="middle">
                    দাগ ৩১৬
                  </text>

                  {/* Cadastral Diagonal Check Line */}
                  <line x1="50" y1="40" x2="240" y2="180" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
                  <text x="175" y="90" fill="#fcd34d" fontSize="9" fontWeight="bold">
                    কর্ণ ১২৪'
                  </text>
                </g>

                {/* Scale Bar */}
                <g transform="translate(40, 420)">
                  <rect x="0" y="0" width="160" height="5" fill="#cbd5e1" />
                  <rect x="0" y="0" width="80" height="5" fill="#10b981" />
                  <text x="0" y="-4" fill="#94a3b8" fontSize="9">
                    ০
                  </text>
                  <text x="80" y="-4" fill="#94a3b8" fontSize="9">
                    ১৬৫'
                  </text>
                  <text x="160" y="-4" fill="#94a3b8" fontSize="9">
                    ৩৩০' (১ চেইন)
                  </text>
                </g>
              </svg>

              {/* Bottom Notice */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>{isBn ? 'ড্র্যাগ করে প্যান করুন, জুম ইন/আউট করুন।' : 'Drag to pan, use controls to zoom.'}</span>
                <span className="text-emerald-400 font-semibold">
                  {file.notes || 'ভূমি ও আমিন ডিজিটাল পেন্টাগ্রাফ মানচিত্র সংরক্ষণাগার'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Footer Status & Disclaimer */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-800/90 px-4 py-2 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {isBn
              ? 'আইনি স্পষ্টীকরণ: প্রদর্শিত নকশাটি নির্দেশক তুলনার জন্য প্রস্তুতকৃত।'
              : 'Legal Clarification: For indicative comparative survey inspection only.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono">
            {isBn
              ? `আপলোড তারিখ: ${new Date(file.uploadedAt).toLocaleDateString('bn-BD')}`
              : `Uploaded: ${new Date(file.uploadedAt).toLocaleDateString()}`}
          </span>
          <button
            onClick={onBack}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
          >
            {isBn ? '← ফিরে যান' : '← Back'}
          </button>
        </div>
      </div>
    </div>
  );
};
