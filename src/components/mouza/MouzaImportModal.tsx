import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  Info,
  Scale,
} from 'lucide-react';
import { Language, MouzaMapRecord, MouzaMapSourceType } from '../../types';
import { LocationSelectionValue } from '../../types/administrative-location';
import { BangladeshLocationSelector } from '../common/BangladeshLocationSelector';
import { ProfessionalServiceDisclaimer } from '../common/ProfessionalServiceDisclaimer';
import {
  MOUZA_SCALE_PRESETS,
  parseGeoJsonToDags,
  parseKmlToDags,
  parseDxfToDags,
} from '../../lib/mouza-map';

interface MouzaImportModalProps {
  lang: Language;
  onClose: () => void;
  onImportComplete: (record: MouzaMapRecord) => void;
  initialLocation?: LocationSelectionValue;
}

export const MouzaImportModal: React.FC<MouzaImportModalProps> = ({
  lang,
  onClose,
  onImportComplete,
  initialLocation,
}) => {
  const isBn = lang === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<MouzaMapSourceType>('image');
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileContentText, setFileContentText] = useState<string | null>(null);

  // Metadata form
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState<LocationSelectionValue>(() => ({
    divisionId: initialLocation?.divisionId,
    divisionNameBn: initialLocation?.divisionNameBn,
    districtId: initialLocation?.districtId,
    districtNameBn: initialLocation?.districtNameBn || 'ঢাকা',
    upazilaId: initialLocation?.upazilaId,
    upazilaNameBn: initialLocation?.upazilaNameBn || '',
    mouzaNameBn: initialLocation?.mouzaNameBn || '',
    jlNo: initialLocation?.jlNo || '',
    surveyType: initialLocation?.surveyType || 'RS',
  }));
  const [khatianRef, setKhatianRef] = useState('');
  const [defaultDagNo, setDefaultDagNo] = useState('');
  const [selectedScale, setSelectedScale] = useState('16_inch');
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Detect file type
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      setFileType('image');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (ext === 'pdf') {
      setFileType('pdf');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (ext === 'geojson' || ext === 'json') {
      setFileType('geojson');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContentText(e.target?.result as string);
      };
      reader.readAsText(file);
    } else if (ext === 'kml' || ext === 'kmz') {
      setFileType('kml');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContentText(e.target?.result as string);
      };
      reader.readAsText(file);
    } else if (ext === 'dxf') {
      setFileType('dxf');
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContentText(e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      setErrorMsg(
        isBn
          ? 'সমর্থিত ফরম্যাট: JPG, PNG, PDF, GeoJSON, KML, DXF'
          : 'Supported formats: JPG, PNG, PDF, GeoJSON, KML, DXF'
      );
      setSelectedFile(null);
      return;
    }

    // Default title if empty
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      setErrorMsg(isBn ? 'অনুগ্রহ করে একটি শিরোনাম দিন' : 'Please enter a title');
      return;
    }
    if (!selectedFile && !filePreviewUrl && !fileContentText) {
      setErrorMsg(isBn ? 'অনুগ্রহ করে একটি ফাইল নির্বাচন করুন' : 'Please select a file');
      return;
    }

    setIsProcessing(true);

    const mapId = `mouza-${Date.now()}`;
    const preset = MOUZA_SCALE_PRESETS.find((p) => p.id === selectedScale);
    const scaleRatio = preset?.defaultPixelsPerFoot || 1.2;

    let parsedDags: any[] = [];
    if (fileType === 'geojson' && fileContentText) {
      parsedDags = parseGeoJsonToDags(fileContentText, mapId);
    } else if (fileType === 'kml' && fileContentText) {
      parsedDags = parseKmlToDags(fileContentText, mapId);
    } else if (fileType === 'dxf' && fileContentText) {
      parsedDags = parseDxfToDags(fileContentText, mapId);
    }

    const newRecord: MouzaMapRecord = {
      id: mapId,
      title: title.trim(),
      district: location.districtNameBn || 'ঢাকা',
      upazila: location.upazilaNameBn || 'সদর',
      mouza: location.mouzaNameBn || title.trim(),
      jlNo: location.jlNo || '',
      khatianRef: khatianRef.trim(),
      defaultDagNo: defaultDagNo.trim(),
      sourceType: fileType,
      fileName: selectedFile?.name || 'mouza_sheet.png',
      fileDataUrl: filePreviewUrl || undefined,
      rawGeoJson: fileType === 'geojson' ? fileContentText : undefined,
      rawKmlText: fileType === 'kml' ? fileContentText : undefined,
      rawDxfText: fileType === 'dxf' ? fileContentText : undefined,
      scalePixelsPerFoot: scaleRatio,
      digitizedDags: parsedDags,
      notes: notes.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setTimeout(() => {
      setIsProcessing(false);
      onImportComplete(newRecord);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isBn ? 'মৌজা নকশা বা ফাইল আমদানি' : 'Import Mouza Map or Vector File'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isBn ? 'JPG, PNG, PDF, GeoJSON, KML, DXF ফরম্যাট সমর্থিত' : 'JPG, PNG, PDF, GeoJSON, KML, DXF supported'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal Disclaimer notice on maps */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">
              {isBn ? 'অনুমোদিত ফাইল ব্যবহারের নিয়ম: ' : 'Authorized Map Data Only: '}
            </span>
            {isBn
              ? 'কেবল আপনার নিকট থাকা ব্যক্তি বা প্রতিষ্ঠানিক জরিপ শিট ও জিপিএস ফাইল আমদানি করুন। এটি ডিজিটাল বিশ্লেষণের সহায়ক টুল, কোনো আদালত বা ভূমি রেকর্ড অফিসের আইনগত স্বত্ব প্রমাণের দলিল নয়।'
              : 'Upload only user-provided or authorized cadastral drawings. This tool provides indicative visualization, not conclusive legal boundary determination.'}
          </div>
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition ${
            selectedFile
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.geojson,.json,.kml,.kmz,.dxf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />

          {selectedFile ? (
            <div className="space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
              <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">
                {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                <span className="uppercase font-bold text-emerald-700">{fileType}</span>
              </p>
              <span className="text-[11px] text-emerald-800 font-semibold underline">
                {isBn ? 'অন্য ফাইল নির্বাচন করুন' : 'Choose another file'}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                {isBn ? 'মৌজা নকশা বা ফাইল ড্রপ করুন অথবা ব্রাউজ করুন' : 'Drop Mouza map file or browse'}
              </p>
              <p className="text-[11px] text-slate-500">
                JPG, PNG, PDF, GeoJSON, KML, AutoCAD DXF (Max 25MB)
              </p>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 italic">
          {isBn
            ? 'নোটিশ: ফাইল আপলোড করলেই ম্যাপের অবস্থান স্বয়ংক্রিয়ভাবে নিশ্চিত দাবি করা যাবে না। অনুগ্রহ করে নিচের প্রশাসনিক লোকেশন ও জে.এল. নম্বর মিলিয়ে নিন।'
            : 'Notice: Uploading a file does not guarantee automatic location recognition. Please verify the administrative location and JL number below.'}
        </p>

        {/* Metadata Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isBn ? 'ম্যাপ/নকশার শিরোনাম *' : 'Map Title *'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBn ? 'উদা: কমলাপুর মৌজা - দাগ ৩১২' : 'e.g. Kamalapur Mouza - Dag 312'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Bangladesh Location Selector Cascade */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {isBn ? 'প্রশাসনিক মৌজা ও সার্ভে লোকেশন' : 'Administrative Location & Survey'}
              </span>
              <span className="text-[10px] font-semibold text-emerald-800">
                {isBn ? 'ক্যাসকেড ড্রপডাউন' : 'Auto Cascade'}
              </span>
            </div>
            <BangladeshLocationSelector
              value={location}
              onChange={setLocation}
              lang={lang}
              showSurveyType={true}
              showJlInput={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'নির্দিষ্ট দাগ নম্বর (ঐচ্ছিক)' : 'Dag No. (Optional)'}
              </label>
              <input
                type="text"
                value={defaultDagNo}
                onChange={(e) => setDefaultDagNo(e.target.value)}
                placeholder={isBn ? '৩১২' : '312'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'খতিয়ান রেফারেন্স' : 'Khatian Ref.'}
              </label>
              <input
                type="text"
                value={khatianRef}
                onChange={(e) => setKhatianRef(e.target.value)}
                placeholder={isBn ? '১৫৪ (RS)' : '154 (RS)'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isBn ? 'নকশার স্কেল' : 'Sheet Scale'}
              </label>
              <select
                value={selectedScale}
                onChange={(e) => setSelectedScale(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
              >
                {MOUZA_SCALE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isBn ? p.nameBn : p.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Professional Service Disclaimer */}
        <ProfessionalServiceDisclaimer lang={lang} variant="compact" />

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
          >
            {isBn ? 'বাতিল' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {isProcessing
              ? isBn
                ? 'আমদানি হচ্ছে...'
                : 'Importing...'
              : isBn
              ? 'মৌজা ম্যাপ যুক্ত করুন'
              : 'Add Mouza Map'}
          </button>
        </div>
      </div>
    </div>
  );
};
