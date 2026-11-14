import React, { useState, useMemo } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Info,
  Copy,
  Check,
  Layers,
  MapPin,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Compass,
  FileText,
} from 'lucide-react';
import {
  Language,
  DigitizedDagRecord,
  SurveyRecord,
  AdvancedVerificationMatrix,
} from '../../types';
import { computeAdvancedVerificationMatrix } from '../../lib/mouza-map';
import { LAND_CONSTANTS } from '../../lib/land-units';

interface AdvancedVerificationViewProps {
  lang: Language;
  selectedDag: DigitizedDagRecord | null;
  surveys: SurveyRecord[];
  activeGpsPointsCount?: number;
  activeGpsAreaSqFt?: number;
  onOpenReport?: (surveyId?: string) => void;
  onSwitchToPentagraph?: () => void;
}

export const AdvancedVerificationView: React.FC<AdvancedVerificationViewProps> = ({
  lang,
  selectedDag,
  surveys,
  activeGpsPointsCount = 0,
  activeGpsAreaSqFt = 0,
  onOpenReport,
  onSwitchToPentagraph,
}) => {
  const isBn = lang === 'bn';
  const [copied, setCopied] = useState(false);

  // Selected GPS Survey source
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(
    surveys.length > 0 ? surveys[0].id : 'active_gps'
  );

  // Selected Drawing / Second Survey source
  const [selectedDrawingId, setSelectedDrawingId] = useState<string>(
    surveys.length > 1 ? surveys[1].id : ''
  );

  const selectedGpsSurvey = useMemo(() => {
    if (selectedSurveyId === 'active_gps') return null;
    return surveys.find((s) => s.id === selectedSurveyId) || null;
  }, [selectedSurveyId, surveys]);

  const selectedDrawingSurvey = useMemo(() => {
    if (!selectedDrawingId) return null;
    return surveys.find((s) => s.id === selectedDrawingId) || null;
  }, [selectedDrawingId, surveys]);

  // Compute 3-way verification matrix
  const matrix: AdvancedVerificationMatrix = useMemo(() => {
    return computeAdvancedVerificationMatrix(
      selectedDag,
      selectedGpsSurvey,
      activeGpsAreaSqFt,
      selectedDrawingSurvey
    );
  }, [selectedDag, selectedGpsSurvey, activeGpsAreaSqFt, selectedDrawingSurvey]);

  // Copy full matrix report
  const handleCopyReport = () => {
    const text = isBn
      ? `ভূমি ও আমিন — উন্নত ৩-মুখী জমি পরিমাপ যাচাইকরণ
==============================================
দাগ নম্বর: ${selectedDag?.dagNo || '—'}
----------------------------------------------
[১] নকশায় ডিজিটাইজড দাগ:
  • ক্ষেত্রফল: ${matrix.dagAreaDecimal} শতাংশ (${matrix.dagAreaSqFt} বর্গফুট)
  • পরিসীমা: ${matrix.dagPerimeterFt} ফুট
  • শীর্ষবিন্দু: ${matrix.dagPointCount}টি পয়েন্ট

[২] মাঠপর্যায়ে বাস্তব GPS পরিমাপ:
  • ক্ষেত্রফল: ${matrix.gpsAreaDecimal} শতাংশ (${matrix.gpsAreaSqFt} বর্গফুট)
  • পরিসীমা: ${matrix.gpsPerimeterFt} ফুট
  • শীর্ষবিন্দু: ${matrix.gpsPointCount}টি পয়েন্ট

${
  matrix.drawingAreaSqFt
    ? `[৩] সংরক্ষিত ডিজিটাল ড্রয়িং/সার্ভে:
  • ক্ষেত্রফল: ${matrix.drawingAreaDecimal} শতাংশ (${matrix.drawingAreaSqFt} বর্গফুট)
  • পরিসীমা: ${matrix.drawingPerimeterFt} ফুট
  • শীর্ষবিন্দু: ${matrix.drawingPointCount}টি পয়েন্ট\n`
    : ''
}----------------------------------------------
[তুলনামূলক বিশ্লেষণ ও ব্যবধান]:
  • ক্ষেত্রফলের পার্থক্য: ${matrix.areaDiffDecimal} শতাংশ (${matrix.areaDiffSqFt} বর্গফুট)
  • শতকরা পার্থক্য (Variance): ${matrix.percentageDiff}%
  • পরিসীমার পার্থক্য: ${matrix.perimeterDiffFt} ফুট
  • যাচাই গ্রেড: ${
    matrix.matchGrade === 'excellent'
      ? 'চমৎকার মিল (Excellent Match - ≤3%)'
      : matrix.matchGrade === 'acceptable'
      ? 'গ্রহণযোগ্য পার্থক্য (Acceptable - ≤7.5%)'
      : 'উচ্চ পার্থক্য (High Variance - >7.5%)'
  }

[আইনি সতর্কতা]: ${matrix.disclaimerBn}`
      : `Bhumi O Amin — Advanced 3-Way Land Verification
==============================================
Plot / Dag: ${selectedDag?.dagNo || '—'}
----------------------------------------------
[1] Cadastral Digitized Dag:
  • Area: ${matrix.dagAreaDecimal} Decimal (${matrix.dagAreaSqFt} sq ft)
  • Perimeter: ${matrix.dagPerimeterFt} ft
  • Vertices: ${matrix.dagPointCount} points

[2] Field Real GPS Survey:
  • Area: ${matrix.gpsAreaDecimal} Decimal (${matrix.gpsAreaSqFt} sq ft)
  • Perimeter: ${matrix.gpsPerimeterFt} ft
  • Vertices: ${matrix.gpsPointCount} points

${
  matrix.drawingAreaSqFt
    ? `[3] Saved Digital Drawing:
  • Area: ${matrix.drawingAreaDecimal} Decimal (${matrix.drawingAreaSqFt} sq ft)
  • Perimeter: ${matrix.drawingPerimeterFt} ft
  • Vertices: ${matrix.drawingPointCount} points\n`
    : ''
}----------------------------------------------
[Comparative Variance Analysis]:
  • Area Difference: ${matrix.areaDiffDecimal} Decimal (${matrix.areaDiffSqFt} sq ft)
  • Variance: ${matrix.percentageDiff}%
  • Perimeter Difference: ${matrix.perimeterDiffFt} ft
  • Status: ${
    matrix.matchGrade === 'excellent'
      ? 'Excellent Match (≤3%)'
      : matrix.matchGrade === 'acceptable'
      ? 'Acceptable Variance (≤7.5%)'
      : 'High Variance (>7.5%)'
  }

[LEGAL DISCLAIMER]: ${matrix.disclaimerEn}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header with Legal Clarification */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {isBn ? 'উন্নত জমি পরিমাপ যাচাইকরণ' : 'Advanced Land Measurement Verification'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Phase 12C
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isBn
                  ? 'মৌজা নকশা দাগ, বাস্তব GPS ফিল্ড জরিপ এবং ডিজিটাল ড্রয়িংয়ের ৩-মুখী বিশ্লেষণ'
                  : '3-way analytical comparison across Digitized Dag, Field GPS & CAD Drawing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isBn ? 'অনুলিপি হয়েছে' : 'Copied'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isBn ? 'রিপোর্ট কপি' : 'Copy Report'}</span>
                </>
              )}
            </button>

            {onSwitchToPentagraph && (
              <button
                onClick={onSwitchToPentagraph}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
              >
                <Compass className="w-3.5 h-3.5 text-amber-300" />
                <span>{isBn ? 'পেন্টাগ্রাফে দেখুন' : 'View in Pentagraph'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mandatory Digital / Indicative Disclaimer */}
        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-extrabold uppercase tracking-wide">
              {isBn ? 'ডিজিটাল / নির্দেশক যাচাইকরণ (DIGITAL / INDICATIVE VERIFICATION): ' : 'DIGITAL / INDICATIVE VERIFICATION: '}
            </span>
            {isBn ? matrix.disclaimerBn : matrix.disclaimerEn}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Source Selection Controls */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? 'বাস্তব GPS ফিল্ড ডাটা উৎস:' : 'Field GPS Survey Source:'}
          </label>
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
          >
            <option value="active_gps">
              {isBn
                ? `সক্রিয় GPS পরিমাপ (${activeGpsPointsCount}টি পয়েন্ট)`
                : `Active GPS (${activeGpsPointsCount} points)`}
            </option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.dagNo ? `দাগ ${s.dagNo}` : ''})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {isBn ? '৩য় ডাটা উৎস — সংরক্ষিত ড্রয়িং / সার্ভে (ঐচ্ছিক):' : '3rd Source — CAD Drawing (Optional):'}
          </label>
          <select
            value={selectedDrawingId}
            onChange={(e) => setSelectedDrawingId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-700"
          >
            <option value="">{isBn ? '— কোনো ড্রয়িং নির্বাচন নেই —' : '— None —'}</option>
            {surveys
              .filter((s) => s.id !== selectedSurveyId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. 3-Way Comparative Matrix Table */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-800" />
            <h4 className="text-sm font-bold text-slate-900">
              {isBn ? 'তুলনামূলক পরিমাপ ম্যাট্রিক্স' : 'Comparative Measurement Matrix'}
            </h4>
          </div>

          {/* Match Grade Badge */}
          <div className="flex items-center gap-1.5">
            {matrix.matchGrade === 'excellent' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                {isBn ? 'চমৎকার মিল (≤৩%)' : 'Excellent Match'}
              </span>
            ) : matrix.matchGrade === 'acceptable' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                {isBn ? 'গ্রহণযোগ্য ব্যবধান (≤৭.৫%)' : 'Acceptable Variance'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                {isBn ? 'উচ্চ পার্থক্য (>৭.৫%)' : 'High Variance'}
              </span>
            )}
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <th className="py-2.5 px-3 font-bold">{isBn ? 'উৎস ও পরামিতি' : 'Source & Parameters'}</th>
                <th className="py-2.5 px-3 font-bold text-emerald-900">
                  {isBn ? 'মৌজা ডিজিটাইজড দাগ' : 'Map Cadastral Dag'}
                </th>
                <th className="py-2.5 px-3 font-bold text-cyan-900">
                  {isBn ? 'বাস্তব GPS ফিল্ড পরিমাপ' : 'Field GPS Survey'}
                </th>
                {matrix.drawingAreaSqFt !== undefined && (
                  <th className="py-2.5 px-3 font-bold text-amber-900">
                    {isBn ? 'সংরক্ষিত CAD ড্রয়িং' : 'CAD Drawing'}
                  </th>
                )}
                <th className="py-2.5 px-3 font-bold text-slate-900">
                  {isBn ? 'পার্থক্য / ভ্যারিয়েন্স' : 'Variance'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* Row 1: Area (Decimal) */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-bold text-slate-800">
                  {isBn ? 'ক্ষেত্রফল (শতক)' : 'Area (Decimal)'}
                </td>
                <td className="py-3 px-3 font-extrabold text-emerald-900">
                  {matrix.dagAreaDecimal} {isBn ? 'শতক' : 'Dec'}
                </td>
                <td className="py-3 px-3 font-extrabold text-cyan-900">
                  {matrix.gpsAreaDecimal} {isBn ? 'শতক' : 'Dec'}
                </td>
                {matrix.drawingAreaSqFt !== undefined && (
                  <td className="py-3 px-3 font-extrabold text-amber-900">
                    {matrix.drawingAreaDecimal} {isBn ? 'শতক' : 'Dec'}
                  </td>
                )}
                <td className="py-3 px-3 font-bold text-amber-800">
                  Δ {matrix.areaDiffDecimal} {isBn ? 'শতক' : 'Dec'} ({matrix.percentageDiff}%)
                </td>
              </tr>

              {/* Row 2: Area (Sq Ft) */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-bold text-slate-800">
                  {isBn ? 'ক্ষেত্রফল (বর্গফুট)' : 'Area (Sq Ft)'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.dagAreaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.gpsAreaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
                </td>
                {matrix.drawingAreaSqFt !== undefined && (
                  <td className="py-3 px-3 text-slate-700">
                    {matrix.drawingAreaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
                  </td>
                )}
                <td className="py-3 px-3 text-slate-700">
                  Δ {matrix.areaDiffSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
                </td>
              </tr>

              {/* Row 3: Perimeter (Feet) */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-bold text-slate-800">
                  {isBn ? 'পরিসীমা (ফুট)' : 'Perimeter (Feet)'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.dagPerimeterFt} {isBn ? 'ফুট' : 'ft'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.gpsPerimeterFt} {isBn ? 'ফুট' : 'ft'}
                </td>
                {matrix.drawingAreaSqFt !== undefined && (
                  <td className="py-3 px-3 text-slate-700">
                    {matrix.drawingPerimeterFt || '—'} {isBn ? 'ফুট' : 'ft'}
                  </td>
                )}
                <td className="py-3 px-3 font-bold text-slate-800">
                  Δ {matrix.perimeterDiffFt} {isBn ? 'ফুট' : 'ft'}
                </td>
              </tr>

              {/* Row 4: Vertices Count */}
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3 font-bold text-slate-800">
                  {isBn ? 'শীর্ষবিন্দুর সংখ্যা' : 'Vertices / Points'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.dagPointCount} {isBn ? 'টি কোণ' : 'pts'}
                </td>
                <td className="py-3 px-3 text-slate-700">
                  {matrix.gpsPointCount} {isBn ? 'টি পয়েন্ট' : 'pts'}
                </td>
                {matrix.drawingAreaSqFt !== undefined && (
                  <td className="py-3 px-3 text-slate-700">
                    {matrix.drawingPointCount || '—'} {isBn ? 'টি পয়েন্ট' : 'pts'}
                  </td>
                )}
                <td className="py-3 px-3 text-slate-500">
                  {Math.abs(matrix.dagPointCount - matrix.gpsPointCount)} {isBn ? 'পয়েন্ট তারতম্য' : 'diff'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
