import React from 'react';
import { Ruler, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { GpsAreaResult } from '../../lib/gps-geometry';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { Language } from '../../types';

interface DrawingAreaSummaryProps {
  areaResult: GpsAreaResult | null;
  lang: Language;
}

export const DrawingAreaSummary: React.FC<DrawingAreaSummaryProps> = ({ areaResult, lang }) => {
  const isBn = lang === 'bn';

  if (!areaResult || !areaResult.isValid) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold">
            {isBn
              ? 'পর্যাপ্ত জিপিএস পয়েন্ট নেই'
              : 'Insufficient GPS Points for Area Calculation'}
          </p>
          <p className="text-amber-800 leading-relaxed">
            {isBn
              ? 'আবদ্ধ সীমানা ও ক্ষেত্রফল পরিমাপের জন্য কমপক্ষে ৩টি বৈধ জিপিএস পয়েন্ট প্রয়োজন।'
              : 'At least 3 valid GPS points are required to calculate polygon area and closed boundary.'}
          </p>
        </div>
      </div>
    );
  }

  const u = areaResult.landUnits;

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📐</span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              {isBn ? 'জমির পরিমাপ ও ক্ষেত্রফল ফলাফল' : 'Land Area & Measurement Summary'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isBn
                ? `${formatNumberByLang(areaResult.pointCount, lang)}টি পয়েন্ট দ্বারা আবদ্ধ সীমানা`
                : `Closed boundary formed by ${areaResult.pointCount} points`}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{isBn ? 'আবদ্ধ বহুভুজ' : 'Closed Polygon'}</span>
        </span>
      </div>

      {/* Primary Area Highlights (Decimal / শতক & Katha / কাঠা) */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90">
          <div className="text-[11px] font-bold text-amber-900">
            {isBn ? 'শতক / ডেসিমেল (Decimal)' : 'Decimal (শতক)'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-950 mt-0.5">
            {formatNumberByLang(roundClean(u.shatangsha, 3), lang)}
          </div>
          <div className="text-[10px] text-amber-750 font-medium mt-0.5">
            {isBn ? '১ শতক = ৪৩৫.৬ বর্গফুট' : '1 decimal = 435.6 sq ft'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90">
          <div className="text-[11px] font-bold text-emerald-900">
            {isBn ? 'কাঠা (Katha)' : 'Katha (কাঠা)'}
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-0.5">
            {formatNumberByLang(roundClean(u.katha, 3), lang)}
          </div>
          <div className="text-[10px] text-emerald-750 font-medium mt-0.5">
            {isBn ? '১ কাঠা = ৭২০ বর্গফুট' : '1 katha = 720 sq ft'}
          </div>
        </div>
      </div>

      {/* Metric & Imperial Units Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {/* Sq Feet */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">
            {isBn ? 'ক্ষেত্রফল (বর্গফুট)' : 'Area (Sq Ft)'}
          </span>
          <span className="text-sm font-bold text-slate-900 mt-0.5 block">
            {formatNumberByLang(roundClean(areaResult.areaSqFt, 1), lang)}
          </span>
        </div>

        {/* Sq Meters */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">
            {isBn ? 'ক্ষেত্রফল (বর্গমিটার)' : 'Area (Sq Meters)'}
          </span>
          <span className="text-sm font-bold text-slate-900 mt-0.5 block">
            {formatNumberByLang(roundClean(areaResult.areaSqMeters, 1), lang)}
          </span>
        </div>

        {/* Bigha */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">
            {isBn ? 'বিঘা (Bigha)' : 'Bigha (বিঘা)'}
          </span>
          <span className="text-sm font-bold text-slate-900 mt-0.5 block">
            {formatNumberByLang(roundClean(u.bigha, 4), lang)}
          </span>
        </div>

        {/* Acre */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] text-slate-500 font-semibold block">
            {isBn ? 'একর (Acre)' : 'Acre (একর)'}
          </span>
          <span className="text-sm font-bold text-slate-900 mt-0.5 block">
            {formatNumberByLang(roundClean(u.acre, 4), lang)}
          </span>
        </div>
      </div>

      {/* Perimeter Breakdown */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-800" />
          <span className="text-xs font-bold text-slate-800">
            {isBn ? 'মোট পরিসীমা (আইলের মোট দৈর্ঘ্য):' : 'Total Perimeter (Boundary length):'}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-extrabold text-emerald-900">
            {formatNumberByLang(roundClean(areaResult.perimeterFt, 1), lang)} {isBn ? 'ফুট' : 'ft'}
          </span>
          <span className="text-[11px] text-slate-500 ml-1.5 font-medium">
            ({formatNumberByLang(roundClean(areaResult.perimeterMeters, 1), lang)} {isBn ? 'মি' : 'm'})
          </span>
        </div>
      </div>
    </div>
  );
};
