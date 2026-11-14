import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Layers,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit3,
  ExternalLink,
  Info,
  Check,
  Compass,
  ArrowRight,
} from 'lucide-react';
import {
  DigitizedDagRecord,
  DigitizedDagPoint,
  Language,
  MouzaMapRecord,
} from '../../types';
import { SegmentInfo, VertexEditMetrics } from '../../lib/vertex-editing';
import { formatNumberByLang, roundClean } from '../../lib/land-units';

interface DagMeasurementWorkspaceProps {
  currentMap: MouzaMapRecord | null;
  selectedDag: DigitizedDagRecord | null;
  activeEditPoints: DigitizedDagPoint[];
  currentMetrics: VertexEditMetrics;
  currentSegments: SegmentInfo[];
  scale: number;
  lang: Language;
  isEdited: boolean;
  onSaveEdits: () => void;
  onOpenReport?: (surveyId?: string) => void;
  onSwitchToCanvas: () => void;
  onSwitchToDagSelect: () => void;
}

type DisplayUnit = 'sqft' | 'decimal' | 'katha' | 'bigha' | 'acre';

export const DagMeasurementWorkspace: React.FC<DagMeasurementWorkspaceProps> = ({
  currentMap,
  selectedDag,
  activeEditPoints,
  currentMetrics,
  currentSegments,
  scale,
  lang,
  isEdited,
  onSaveEdits,
  onOpenReport,
  onSwitchToCanvas,
  onSwitchToDagSelect,
}) => {
  const isBn = lang === 'bn';
  const [primaryUnit, setPrimaryUnit] = useState<DisplayUnit>('decimal');
  const [sideUnit, setSideUnit] = useState<'ft' | 'link' | 'meter'>('ft');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Conversion helpers
  const getSideLengthFormatted = (lengthFt: number) => {
    if (sideUnit === 'link') {
      // 1 ft = 1.51515 links (66 ft = 100 links)
      return `${roundClean(lengthFt * 1.51515, 1)} ${isBn ? 'লিংক' : 'links'}`;
    }
    if (sideUnit === 'meter') {
      // 1 ft = 0.3048 m
      return `${roundClean(lengthFt * 0.3048, 2)} ${isBn ? 'মিটার' : 'm'}`;
    }
    return `${lengthFt} ${isBn ? 'ফুট' : 'ft'}`;
  };

  const handleSaveClick = () => {
    onSaveEdits();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  if (!selectedDag) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3 animate-fadeIn">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <Ruler className="w-6 h-6 text-emerald-800" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          {isBn ? 'কোনো দাগ নির্বাচিত নেই' : 'No Dag Selected'}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {isBn
            ? 'পরিমাপ দেখতে ও হিসাব করতে অনুগ্রহ করে "দাগ নির্বাচন" বা "ম্যাপ" থেকে একটি দাগ নির্বাচন করুন বা নতুন দাগ আঁকুন।'
            : 'Please select a dag from Dag Selection or Map tab to inspect detailed side lengths and area measurements.'}
        </p>
        <button
          onClick={onSwitchToDagSelect}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition shadow-xs"
        >
          <span>{isBn ? 'দাগ নির্বাচন করুন' : 'Select Dag'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Banner: Dag Identification & Actions */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {isBn ? `দাগ নং ${selectedDag.dagNo} — পরিমাপ ও ক্ষেত্রফল` : `Plot #${selectedDag.dagNo} Measurement`}
            </h3>
            {isEdited && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {isBn ? 'সম্পাদিত (Unsaved Edits)' : 'Unsaved Edits'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {currentMap?.mouza && `${isBn ? 'মৌজা: ' : 'Mouza: '}${currentMap.mouza}, `}
            {currentMap?.jlNo && `${isBn ? 'জে.এল: ' : 'JL: '}${currentMap.jlNo}, `}
            {currentMap?.district && `${isBn ? 'জেলা: ' : 'District: '}${currentMap.district}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSwitchToCanvas}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'ক্যানভাসে দেখুন' : 'View on Map'}</span>
          </button>

          <button
            onClick={handleSaveClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
          >
            <Save className="w-3.5 h-3.5 text-amber-300" />
            <span>{isBn ? 'পরিমাপ সংরক্ষণ করুন' : 'Save Measurement'}</span>
          </button>

          {onOpenReport && (
            <button
              onClick={() => onOpenReport()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-800 hover:bg-sky-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-sky-200" />
              <span>{isBn ? 'রিপোর্ট তৈরি' : 'Report'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isBn
              ? 'দাগের পরিমাপ ও শীর্ষবিন্দু সফলভাবে সংরক্ষিত হয়েছে!'
              : 'Measurement and vertices saved successfully!'}
          </span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Comprehensive Area Cards (All Units) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Decimal / শতাংশ */}
        <div
          onClick={() => setPrimaryUnit('decimal')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            primaryUnit === 'decimal'
              ? 'bg-emerald-800 text-white shadow-md border-emerald-800'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${primaryUnit === 'decimal' ? 'text-emerald-200' : 'text-slate-500'}`}>
            {isBn ? 'শতাংশ / শতক' : 'Decimal'}
          </div>
          <div className="text-lg sm:text-xl font-black mt-0.5">
            {formatNumberByLang(currentMetrics.areaDecimal, lang)}
          </div>
          <div className={`text-[10px] mt-0.5 ${primaryUnit === 'decimal' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {isBn ? '১ শতাংশ = ৪৩৫.৬ বর্গফুট' : '1 Dec = 435.6 sq ft'}
          </div>
        </div>

        {/* Square Feet / বর্গফুট */}
        <div
          onClick={() => setPrimaryUnit('sqft')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            primaryUnit === 'sqft'
              ? 'bg-emerald-800 text-white shadow-md border-emerald-800'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${primaryUnit === 'sqft' ? 'text-emerald-200' : 'text-slate-500'}`}>
            {isBn ? 'বর্গফুট (Sq. Ft)' : 'Square Feet'}
          </div>
          <div className="text-lg sm:text-xl font-black mt-0.5">
            {formatNumberByLang(currentMetrics.areaSqFt, lang)}
          </div>
          <div className={`text-[10px] mt-0.5 ${primaryUnit === 'sqft' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {isBn ? 'মোট বর্গাকার ক্ষেত্রফল' : 'Total square area'}
          </div>
        </div>

        {/* Katha / কাঠা */}
        <div
          onClick={() => setPrimaryUnit('katha')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            primaryUnit === 'katha'
              ? 'bg-emerald-800 text-white shadow-md border-emerald-800'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${primaryUnit === 'katha' ? 'text-emerald-200' : 'text-slate-500'}`}>
            {isBn ? 'কাঠা (Katha)' : 'Katha'}
          </div>
          <div className="text-lg sm:text-xl font-black mt-0.5">
            {formatNumberByLang(currentMetrics.areaKatha, lang)}
          </div>
          <div className={`text-[10px] mt-0.5 ${primaryUnit === 'katha' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {isBn ? '১ কাঠা = ১.৬৫ শতক' : '1 Katha = 720 sq ft'}
          </div>
        </div>

        {/* Bigha / বিঘা */}
        <div
          onClick={() => setPrimaryUnit('bigha')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            primaryUnit === 'bigha'
              ? 'bg-emerald-800 text-white shadow-md border-emerald-800'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${primaryUnit === 'bigha' ? 'text-emerald-200' : 'text-slate-500'}`}>
            {isBn ? 'বিঘা (Bigha)' : 'Bigha'}
          </div>
          <div className="text-lg sm:text-xl font-black mt-0.5">
            {formatNumberByLang(currentMetrics.areaBigha, lang)}
          </div>
          <div className={`text-[10px] mt-0.5 ${primaryUnit === 'bigha' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {isBn ? '১ বিঘা = ৩৩ শতক' : '1 Bigha = 33 Dec'}
          </div>
        </div>

        {/* Acre / একর */}
        <div
          onClick={() => setPrimaryUnit('acre')}
          className={`col-span-2 sm:col-span-1 p-3 rounded-2xl border transition cursor-pointer ${
            primaryUnit === 'acre'
              ? 'bg-emerald-800 text-white shadow-md border-emerald-800'
              : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${primaryUnit === 'acre' ? 'text-emerald-200' : 'text-slate-500'}`}>
            {isBn ? 'একর (Acre)' : 'Acre'}
          </div>
          <div className="text-lg sm:text-xl font-black mt-0.5">
            {formatNumberByLang(currentMetrics.areaAcre, lang)}
          </div>
          <div className={`text-[10px] mt-0.5 ${primaryUnit === 'acre' ? 'text-emerald-300' : 'text-slate-400'}`}>
            {isBn ? '১ একর = ১০০ শতক' : '1 Acre = 100 Dec'}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Perimeter & Geometric Method Verification */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Ruler className="w-4 h-4 text-emerald-800" />
          </div>
          <div>
            <span className="text-slate-500 font-semibold block">{isBn ? 'মোট পরিসীমা (Perimeter):' : 'Total Perimeter:'}</span>
            <span className="text-sm font-black text-slate-900">
              {formatNumberByLang(currentMetrics.perimeterFt, lang)} {isBn ? 'ফুট' : 'ft'}
              <span className="text-slate-500 font-normal ml-2">
                ({roundClean(currentMetrics.perimeterFt * 1.51515, 1)} {isBn ? 'কড়ি/লিংক' : 'links'} • {roundClean(currentMetrics.perimeterFt * 0.3048, 1)} {isBn ? 'মিটার' : 'm'})
              </span>
            </span>
          </div>
        </div>

        {/* Geometric Formula Badge */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <div className="text-[11px] leading-tight">
            <strong>{isBn ? 'প্রকৃত জ্যামিতিক বহুভুজ (Shoelace Formula)' : 'Exact Polygon Coordinate Geometry'}</strong>
            <p className="text-[10px] text-emerald-800">
              {isBn
                ? `${activeEditPoints.length}টি শীর্ষবিন্দুর কো-অর্ডিনেট দ্বারা যাচাইকৃত`
                : `Verified with ${activeEditPoints.length} boundary vertices`}
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Side Lengths Table & Unit Switcher */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-800" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              {isBn ? `সীমানা বাহু ও দৈর্ঘ্যের তালিকা (${currentSegments.length}টি বাহু)` : `Boundary Side Lengths (${currentSegments.length} segments)`}
            </h4>
          </div>

          {/* Side Unit Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSideUnit('ft')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sideUnit === 'ft' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'ফুট' : 'Feet'}
            </button>
            <button
              onClick={() => setSideUnit('link')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sideUnit === 'link' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'লিংক/কড়ি' : 'Links'}
            </button>
            <button
              onClick={() => setSideUnit('meter')}
              className={`px-2.5 py-1 rounded-lg transition ${
                sideUnit === 'meter' ? 'bg-emerald-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isBn ? 'মিটার' : 'Meters'}
            </button>
          </div>
        </div>

        {/* Segments Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-2 px-3">{isBn ? 'বাহু নং' : 'Side #'}</th>
                <th className="py-2 px-3">{isBn ? 'কোণ বিন্দু সংযোগ' : 'Corner Vertices'}</th>
                <th className="py-2 px-3">{isBn ? 'পরিমাপকৃত দৈর্ঘ্য' : 'Measured Length'}</th>
                <th className="py-2 px-3 text-right">{isBn ? 'অনুপাত' : 'Share'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentSegments.map((seg, idx) => {
                const percentage = currentMetrics.perimeterFt > 0
                  ? Math.round((seg.lengthFt / currentMetrics.perimeterFt) * 100)
                  : 0;

                return (
                  <tr key={seg.index} className="hover:bg-slate-50/80 transition font-medium">
                    <td className="py-2 px-3 font-bold text-slate-800">
                      {isBn ? `বাহু ${formatNumberByLang(idx + 1, lang)}` : `Side ${idx + 1}`}
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-mono">
                      P{seg.fromIndex + 1} &rarr; P{seg.toIndex + 1}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {getSideLengthFormatted(seg.lengthFt)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono">
                      {percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
