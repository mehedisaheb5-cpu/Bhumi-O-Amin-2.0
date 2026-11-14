import React, { useRef } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  AlertTriangle,
  Scale,
  MapPin,
  Calendar,
  User,
  CheckCircle2,
  Compass,
  Layers,
} from 'lucide-react';
import { Language } from '../../types';
import { LAND_CONSTANTS } from '../../lib/land-units';
import { printWithNoto } from '../../lib/print-utils';

export interface DemarcationReportData {
  projectTitle: string;
  clientName?: string;
  mouzaName: string;
  district?: string;
  upazila?: string;
  jlNo?: string;
  sheetNo?: string;
  dagNo: string;
  khatianNo?: string;
  date: string;
  scaleText?: string;
  referenceBoundary: {
    title: string;
    pointsCount: number;
    perimeterFt: number;
    areaDecimal: number;
    areaSqFt: number;
  };
  surveyedBoundary: {
    title: string;
    pointsCount: number;
    perimeterFt: number;
    areaDecimal: number;
    areaSqFt: number;
  };
  comparison: {
    areaDifferenceDecimal: number;
    areaDifferenceSqFt: number;
    perimeterDifferenceFt: number;
    areaChangePercent: number;
    offsetFt?: number;
  };
  referencePoints: { x: number; y: number }[];
  surveyedPoints: { x: number; y: number }[];
  notes?: string;
  aminName?: string;
  unit: 'feet' | 'link';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: DemarcationReportData;
  lang: Language;
}

export const ComparativeDemarcationReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  lang,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const isBn = lang === 'bn';

  if (!isOpen) return null;

  const toBn = (num: number | string): string => {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
  };

  const handlePrint = () => {
    void printWithNoto();
  };

  // Compute SVG bounding box for the comparative sketch
  const allPoints = [...data.referencePoints, ...data.surveyedPoints];
  let minX = 0,
    minY = 0,
    maxX = 400,
    maxY = 300;
  if (allPoints.length > 0) {
    minX = Math.min(...allPoints.map((p) => p.x));
    maxX = Math.max(...allPoints.map((p) => p.x));
    minY = Math.min(...allPoints.map((p) => p.y));
    maxY = Math.max(...allPoints.map((p) => p.y));
  }
  const padding = 35;
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = Math.max(maxX - minX + padding * 2, 100);
  const vbH = Math.max(maxY - minY + padding * 2, 100);

  const refPath =
    data.referencePoints.length > 2
      ? data.referencePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
      : '';

  const survPath =
    data.surveyedPoints.length > 2
      ? data.surveyedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
      : '';

  const aminName = data.aminName || (isBn ? 'মেহেদী হাসান বাবু' : 'Mehedi Hasan Babu');

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:!bg-white print:static print:overflow-visible">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:rounded-none print:!w-full print:!max-w-none">
          {/* Modal Controls Bar (Hidden during Print) */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800 print:hidden shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm sm:text-base font-bold">
                {isBn
                  ? 'ডিজিটাল তুলনামূলক ও সীমানা নির্ধারণ প্রতিবেদন'
                  : 'Comparative Demarcation & Survey Report'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isBn ? 'প্রিন্ট বা PDF সংরক্ষণ' : 'Print / Save PDF'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Area */}
          <div className="overflow-y-auto p-4 sm:p-8 space-y-6 print:overflow-visible print:!p-0">
            <div
              id="report-printable-area"
              ref={printRef}
              className="a4-print-page bg-white text-slate-900 mx-auto max-w-[210mm] min-h-[297mm] p-6 sm:p-8 flex flex-col justify-between border border-slate-200 print:border-none shadow-sm print:shadow-none"
            >
            <div className="space-y-5">
              {/* Report Header */}
              <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {isBn ? 'ভূমি ও আমিন' : 'BHUMI O AMIN'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isBn ? 'স্মার্ট ভূমি জরিপ ও বিশ্লেষণ' : 'Smart Cadastral Survey & Analysis'}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {isBn
                      ? 'ডিজিটাল তুলনামূলক ও সীমানা নির্ধারণ প্রতিবেদন'
                      : 'Comparative Boundary Demarcation Report'}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    {data.projectTitle}
                  </p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    {isBn ? 'তারিখ: ' : 'Date: '}
                    <span className="font-mono">{isBn ? toBn(data.date) : data.date}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    ID: DEMARC-{Date.now().toString().slice(-6)}
                  </div>
                </div>
              </div>

              {/* Legal Disclaimer Pill */}
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {isBn ? 'আইনি নোটিশ: ' : 'Legal Notice: '}
                  </span>
                  {isBn
                    ? 'ডিজিটাল তুলনামূলক/পরিমাপ প্রতিবেদন। চূড়ান্ত আইনগত সীমানা নির্ধারণের পরিবর্তে এটি মাঠ জরিপ ও তুলনামূলক সহায়ক প্রতিবেদন।'
                    : 'Digital comparative survey report. This is a field survey and comparative assistance report rather than a final statutory legal boundary determination.'}
                </div>
              </div>

              {/* Mouza & Plot Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isBn ? 'মৌজা' : 'Mouza'}
                  </span>
                  <span className="font-bold text-slate-800">{data.mouzaName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isBn ? 'দাগ নম্বর' : 'Plot (Dag) No'}
                  </span>
                  <span className="font-bold text-emerald-800 font-mono text-sm">
                    {isBn ? toBn(data.dagNo) : data.dagNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isBn ? 'জে.এল / শীট নং' : 'JL / Sheet No'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {data.jlNo ? `JL-${isBn ? toBn(data.jlNo) : data.jlNo}` : '—'}
                    {data.sheetNo ? ` / Sh-${isBn ? toBn(data.sheetNo) : data.sheetNo}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                    {isBn ? 'খতিয়ান / মালিক' : 'Khatian / Client'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {data.khatianNo ? `খতিয়ান ${isBn ? toBn(data.khatianNo) : data.khatianNo}` : data.clientName || '—'}
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison Metrics Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">{isBn ? 'বিবরণ' : 'Parameter'}</th>
                      <th className="p-2.5 text-emerald-800 font-bold">
                        {isBn ? '১. মূল নকশা / রেফারেন্স সীমানা' : '1. Reference Boundary'}
                      </th>
                      <th className="p-2.5 text-amber-800 font-bold">
                        {isBn ? '২. দখল / মাঠ জরিপ সীমানা' : '2. Surveyed / Occupied Boundary'}
                      </th>
                      <th className="p-2.5 text-rose-800 font-bold">
                        {isBn ? 'পার্থক্য / ব্যবধান' : 'Variance / Offset'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    <tr>
                      <td className="p-2.5 font-bold">{isBn ? 'কোণ/পয়েন্ট সংখ্যা' : 'Vertices'}</td>
                      <td className="p-2.5 font-mono">
                        {isBn ? toBn(data.referenceBoundary.pointsCount) : data.referenceBoundary.pointsCount} টি
                      </td>
                      <td className="p-2.5 font-mono">
                        {isBn ? toBn(data.surveyedBoundary.pointsCount) : data.surveyedBoundary.pointsCount} টি
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">—</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold">{isBn ? 'মোট পরিসীমা' : 'Total Perimeter'}</td>
                      <td className="p-2.5 font-mono">
                        {isBn
                          ? toBn(data.referenceBoundary.perimeterFt.toFixed(1))
                          : data.referenceBoundary.perimeterFt.toFixed(1)}{' '}
                        {isBn ? 'ফুট' : 'ft'}{' '}
                        <span className="text-slate-500 text-[10px]">
                          ({isBn
                            ? toBn((data.referenceBoundary.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK).toFixed(1))
                            : (data.referenceBoundary.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK).toFixed(1)}{' '}
                          {isBn ? 'লি.' : 'lk'})
                        </span>
                      </td>
                      <td className="p-2.5 font-mono">
                        {isBn
                          ? toBn(data.surveyedBoundary.perimeterFt.toFixed(1))
                          : data.surveyedBoundary.perimeterFt.toFixed(1)}{' '}
                        {isBn ? 'ফুট' : 'ft'}{' '}
                        <span className="text-slate-500 text-[10px]">
                          ({isBn
                            ? toBn((data.surveyedBoundary.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK).toFixed(1))
                            : (data.surveyedBoundary.perimeterFt / LAND_CONSTANTS.FEET_PER_LINK).toFixed(1)}{' '}
                          {isBn ? 'লি.' : 'lk'})
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-rose-700">
                        Δ{' '}
                        {isBn
                          ? toBn(Math.abs(data.comparison.perimeterDifferenceFt).toFixed(1))
                          : Math.abs(data.comparison.perimeterDifferenceFt).toFixed(1)}{' '}
                        {isBn ? 'ফুট' : 'ft'}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/60 font-semibold">
                      <td className="p-2.5 font-bold">{isBn ? 'আনুমানিক ক্ষেত্রফল' : 'Approx Area'}</td>
                      <td className="p-2.5 font-mono text-emerald-800">
                        {isBn
                          ? toBn(data.referenceBoundary.areaDecimal.toFixed(2))
                          : data.referenceBoundary.areaDecimal.toFixed(2)}{' '}
                        {isBn ? 'শতক' : 'Decimal'}
                        <div className="text-[10px] text-slate-500">
                          {isBn
                            ? toBn(Math.round(data.referenceBoundary.areaSqFt).toLocaleString())
                            : Math.round(data.referenceBoundary.areaSqFt).toLocaleString()}{' '}
                          বর্গফুট
                        </div>
                      </td>
                      <td className="p-2.5 font-mono text-amber-800">
                        {isBn
                          ? toBn(data.surveyedBoundary.areaDecimal.toFixed(2))
                          : data.surveyedBoundary.areaDecimal.toFixed(2)}{' '}
                        {isBn ? 'শতক' : 'Decimal'}
                        <div className="text-[10px] text-slate-500">
                          {isBn
                            ? toBn(Math.round(data.surveyedBoundary.areaSqFt).toLocaleString())
                            : Math.round(data.surveyedBoundary.areaSqFt).toLocaleString()}{' '}
                          বর্গফুট
                        </div>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-rose-700">
                        Δ{' '}
                        {isBn
                          ? toBn(Math.abs(data.comparison.areaDifferenceDecimal).toFixed(2))
                          : Math.abs(data.comparison.areaDifferenceDecimal).toFixed(2)}{' '}
                        {isBn ? 'শতক' : 'Dec'}
                        <div className="text-[10px] text-rose-600">
                          ({isBn ? toBn(data.comparison.areaChangePercent.toFixed(1)) : data.comparison.areaChangePercent.toFixed(1)}%)
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Comparative Vector Drawing Snapshot */}
              <div className="border border-slate-300 rounded-xl p-3 bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800">
                  <span className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Compass className="w-4 h-4" />
                    <span>{isBn ? 'তুলনামূলক নকশা স্কেচ (পেন্টাগ্রাফ ওভারলে)' : 'Comparative Vector Overlay Sketch'}</span>
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>{isBn ? 'মূল নকশা' : 'Reference'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>{isBn ? 'দখল / মাঠ সীমানা' : 'Occupied'}</span>
                    </span>
                  </div>
                </div>

                <div className="w-full h-56 bg-slate-950 rounded-lg flex items-center justify-center overflow-hidden border border-slate-800 relative">
                  <svg
                    viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                    className="w-full h-full p-2"
                  >
                    {/* Reference Boundary Polygon */}
                    {refPath && (
                      <path
                        d={refPath}
                        fill="#10b981"
                        fillOpacity={0.22}
                        stroke="#10b981"
                        strokeWidth={Math.max(1.8, vbW / 200)}
                      />
                    )}
                    {/* Surveyed Boundary Polygon */}
                    {survPath && (
                      <path
                        d={survPath}
                        fill="#f59e0b"
                        fillOpacity={0.25}
                        stroke="#f59e0b"
                        strokeWidth={Math.max(2, vbW / 180)}
                        strokeDasharray={`${Math.max(4, vbW / 70)}, ${Math.max(3, vbW / 90)}`}
                      />
                    )}
                    {/* Reference Points */}
                    {data.referencePoints.map((p, idx) => (
                      <circle
                        key={`ref-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={Math.max(3, vbW / 120)}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={Math.max(0.8, vbW / 350)}
                      />
                    ))}
                    {/* Surveyed Points */}
                    {data.surveyedPoints.map((p, idx) => (
                      <circle
                        key={`surv-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={Math.max(3.5, vbW / 110)}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth={Math.max(1, vbW / 300)}
                      />
                    ))}
                  </svg>
                </div>
              </div>

              {/* Survey Notes & Findings */}
              {data.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 block mb-1">
                    {isBn ? 'মাঠ নিরীক্ষা ও সীমানা মন্তব্য:' : 'Field Inspection & Boundary Remarks:'}
                  </span>
                  <p className="text-slate-800 leading-relaxed italic">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Signatures & Certification Footer */}
            <div className="pt-6 border-t-2 border-slate-800 grid grid-cols-2 gap-8 text-xs mt-6">
              <div>
                <span className="font-bold text-slate-700 block mb-8">
                  {isBn ? 'জমির মালিক / আবেদনকারী:' : 'Client / Land Owner:'}
                </span>
                <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-600">
                  {data.clientName || (isBn ? 'স্বাক্ষর ও তারিখ' : 'Signature & Date')}
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-slate-700 block mb-8">
                  {isBn ? 'আমিন / সার্ভেয়ার স্বাক্ষর:' : 'Licensed Amin / Surveyor:'}
                </span>
                <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-800 font-bold">
                  {aminName}
                  <div className="text-[10px] text-slate-500 font-normal">
                    {isBn ? 'প্রফেশনাল ডিজিটাল সার্ভে সনদধারী' : 'Certified Cadastral Surveyor'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};
