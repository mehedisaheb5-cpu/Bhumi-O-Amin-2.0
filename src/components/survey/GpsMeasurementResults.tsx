import React from 'react';
import { GpsAreaResult, GpsAccuracyStats, GpsPolygonSegment } from '../../lib/gps-geometry';
import { GpsPoint } from '../../lib/gps-types';
import { Language } from '../../types';
import { formatNumberByLang, roundClean } from '../../lib/land-units';
import { formatCoordinate } from '../../lib/gps-utils';
import {
  Ruler,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Layers,
  Compass,
  Crosshair,
  Sparkles,
} from 'lucide-react';

interface GpsMeasurementResultsProps {
  points: GpsPoint[];
  areaResult: GpsAreaResult | null;
  accuracyStats: GpsAccuracyStats | null;
  lang: Language;
}

export const GpsMeasurementResults: React.FC<GpsMeasurementResultsProps> = ({
  points,
  areaResult,
  accuracyStats,
  lang,
}) => {
  const isBn = lang === 'bn';
  const pointCount = points.length;

  // Case 1: Less than 2 points -> Not enough data for measurement
  if (pointCount < 2) {
    return (
      <div
        id="gps-measurement-empty-state"
        className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs space-y-2 animate-fadeIn"
      >
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Info className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{isBn ? 'পরিমাপ শুরু করার নির্দেশিকা' : 'Measurement Guidance'}</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {pointCount === 0
            ? isBn
              ? 'জমির প্রতিটি সীমানা কোণায় দাঁড়িয়ে "পয়েন্ট নিন" বাটনে ট্যাপ করুন। কমপক্ষে ৩টি পয়েন্ট সংগ্রহ করলে স্বয়ংক্রিয়ভাবে মোট ক্ষেত্রফল ও খতিয়ান এককসমূহ প্রদর্শিত হবে।'
              : 'Stand at each parcel corner and tap "Take Point". At least 3 points are required to compute polygon boundary and area.'
            : isBn
            ? 'পয়েন্ট A সংরক্ষিত হয়েছে। এবার পরবর্তী কোণায় গিয়ে পয়েন্ট B সংগ্রহ করুন।'
            : 'Point A recorded. Move to the next boundary corner to record Point B.'}
        </p>
      </div>
    );
  }

  // Case 2: Exactly 2 points -> Linear measurement, needs 3rd point for polygon area
  if (pointCount === 2) {
    return (
      <div
        id="gps-measurement-two-points-state"
        className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs space-y-2 animate-fadeIn"
      >
        <div className="flex items-center gap-2 text-amber-900 font-bold">
          <Ruler className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            {isBn
              ? 'সরলরৈখিক পরিমাপ সংগৃহীত (২টি পয়েন্ট)'
              : 'Linear Segment Recorded (2 Points)'}
          </span>
        </div>
        <p className="text-[11px] text-amber-900/90 leading-relaxed">
          {isBn
            ? 'পয়েন্ট A ও B-এর মধ্যবর্তী সরলরৈখিক দৈর্ঘ্য ও দিক উপরের তালিকায় প্রদর্শিত হয়েছে। জমির মোট ক্ষেত্রফল (শতাংশ, কাঠা) বের করার জন্য ৩য় সীমানা কোণায় গিয়ে আরেকটি পয়েন্ট (পয়েন্ট C) নিন।'
            : 'Linear distance between A and B is calculated. To compute enclosed polygon area (Decimal, Katha), move to the 3rd boundary corner and record Point C.'}
        </p>
      </div>
    );
  }

  // Case 3: 3 or more points, but geometry calculation is invalid (e.g. invalid points or duplicate errors)
  if (!areaResult || !areaResult.isValid) {
    const errorMessages = areaResult?.validation.errors || [];
    return (
      <div
        id="gps-measurement-error-state"
        className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-2 animate-fadeIn"
      >
        <div className="flex items-center gap-2 text-rose-800 font-bold">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            {isBn
              ? 'বহুভুজ ক্ষেত্রফল হিসাব করা সম্ভব হয়নি'
              : 'Unable to Calculate Closed Polygon Area'}
          </span>
        </div>
        <ul className="list-disc list-inside text-[11px] text-rose-900 space-y-1">
          {errorMessages.map((err, idx) => (
            <li key={idx}>{err}</li>
          ))}
          {errorMessages.length === 0 && (
            <li>
              {isBn
                ? 'কমপক্ষে ৩টি ভিন্ন ভৌগোলিক স্থানাঙ্ক প্রয়োজন।'
                : 'At least 3 distinct geographic coordinates are required.'}
            </li>
          )}
        </ul>
      </div>
    );
  }

  // Case 4: 3 or more valid points -> Full Professional Measurement Results Card
  const { areaSqFt, areaSqMeters, perimeterFt, perimeterMeters, landUnits, segments } =
    areaResult;

  // Find closing segment (connecting last point back to Point A)
  const closingSegment: GpsPolygonSegment | undefined =
    segments.find((s) => s.isClosing) || segments[segments.length - 1];

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return (
    <div
      id="gps-measurement-result-card"
      className="p-4 sm:p-5 rounded-2xl bg-white border border-emerald-300 shadow-sm space-y-4 animate-fadeIn"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-900 text-white flex items-center justify-center shadow-xs">
            <Ruler className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>{isBn ? '📐 পরিমাপের ফলাফল' : '📐 Measurement Results'}</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {isBn
                ? 'রিয়েল জিপিএস স্থানাঙ্ক ভিত্তিক আবদ্ধ সীমানা ও ক্ষেত্রফল'
                : 'Closed boundary perimeter & area from real GPS coordinates'}
            </p>
          </div>
        </div>

        {/* Closed Boundary Confirmation Pill */}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
          <span>{isBn ? 'আবদ্ধ বহুভুজ (Closed)' : 'Closed Polygon'}</span>
        </span>
      </div>

      {/* Validation Warnings (e.g. Identical points close to each other) */}
      {areaResult.validation.warnings && areaResult.validation.warnings.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {isBn ? 'সতর্কতা নোটিশ:' : 'Survey Notice:'}
            </p>
            {areaResult.validation.warnings.map((w, idx) => (
              <p key={idx} className="mt-0.5 text-amber-800">{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Primary Metrics: Total Points, Total Perimeter, Total Land Area */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Metric 1: Total Points */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            {isBn ? 'মোট পয়েন্ট' : 'Total Points'}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">
              {formatNumberByLang(areaResult.pointCount, lang)}
            </span>
            <span className="text-xs text-slate-500">
              {isBn ? 'টি সীমানা কোণা' : 'corners'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {points[0]?.label} → {points[points.length - 1]?.label} ({isBn ? 'আবদ্ধ' : 'closed'})
          </p>
        </div>

        {/* Metric 2: Total Perimeter */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            {isBn ? 'মোট পরিসীমা' : 'Total Perimeter'}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-950">
              {formatNumberByLang(roundClean(perimeterFt, 2), lang)}
            </span>
            <span className="text-xs font-semibold text-emerald-900">
              {isBn ? 'ফুট' : 'ft'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 font-mono mt-0.5">
            ({formatNumberByLang(roundClean(perimeterMeters, 2), lang)}{' '}
            <span className="font-sans text-[10px] text-slate-500">
              {isBn ? 'মিটার' : 'm'}
            </span>)
          </p>
        </div>

        {/* Metric 3: Total Land Area */}
        <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
            {isBn ? 'মোট জমির ক্ষেত্রফল' : 'Total Land Area'}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-950">
              {formatNumberByLang(roundClean(areaSqFt, 2), lang)}
            </span>
            <span className="text-xs font-semibold text-emerald-900">
              {isBn ? 'বর্গফুট' : 'sq ft'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
            ({formatNumberByLang(roundClean(areaSqMeters, 2), lang)}{' '}
            <span className="font-sans text-[10px] text-emerald-700">
              {isBn ? 'বর্গমিটার' : 'sq m'}
            </span>)
          </p>
        </div>
      </div>

      {/* Bangladesh Standard Land Units (Decimal, Katha, Bigha, Acre) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'বাংলাদেশ ভূমি জরিপ এককসমূহ' : 'Bangladesh Land Measurement Units'}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {isBn ? 'সরকারি মান অনুযায়ী' : 'Official Standards'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Decimal / Shatangsha */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-900 block uppercase tracking-wider">
              {isBn ? 'শতাংশ / শতক' : 'Decimal (Shotok)'}
            </span>
            <p className="text-lg font-black text-amber-950 mt-1">
              {formatNumberByLang(roundClean(landUnits.shatangsha, 3), lang)}
            </p>
            <span className="text-[10px] text-amber-800 font-medium">
              {isBn ? 'ডেসিমেল' : 'Decimal'}
            </span>
          </div>

          {/* Katha */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
            <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
              {isBn ? 'কাঠা' : 'Katha'}
            </span>
            <p className="text-lg font-black text-slate-900 mt-1">
              {formatNumberByLang(roundClean(landUnits.katha, 3), lang)}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">
              {isBn ? 'কাঠা' : 'Katha'}
            </span>
          </div>

          {/* Bigha */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
            <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
              {isBn ? 'বিঘা' : 'Bigha'}
            </span>
            <p className="text-lg font-black text-slate-900 mt-1">
              {formatNumberByLang(roundClean(landUnits.bigha, 4), lang)}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">
              {isBn ? 'বিঘা (২০ কাঠা)' : 'Bigha (20 Katha)'}
            </span>
          </div>

          {/* Acre */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90">
            <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
              {isBn ? 'একর' : 'Acre'}
            </span>
            <p className="text-lg font-black text-slate-900 mt-1">
              {formatNumberByLang(roundClean(landUnits.acre, 4), lang)}
            </p>
            <span className="text-[10px] text-slate-500 font-medium">
              {isBn ? 'একর (১০০ শতক)' : 'Acre (100 Decimal)'}
            </span>
          </div>
        </div>
      </div>

      {/* GPS Accuracy Section (TASK 4) */}
      <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-emerald-800" />
            <span className="text-xs font-bold text-slate-800">
              {isBn ? 'ডিভাইস জিপিএস নির্ভুলতা' : 'Device GPS Accuracy'}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold">
            {isBn ? 'ডিভাইস সেন্সর স্ট্যাটাস' : 'Hardware Sensor Data'}
          </span>
        </div>

        {accuracyStats ? (
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            {/* Average Accuracy */}
            <div className="p-2 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block">
                {isBn ? 'গড় নির্ভুলতা' : 'Average Accuracy'}
              </span>
              <p className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                ±{formatNumberByLang(accuracyStats.averageAccuracy, lang)} m
              </p>
            </div>

            {/* Best Accuracy */}
            <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950">
              <span className="text-[10px] text-emerald-800 block font-medium">
                {isBn ? 'সেরা নির্ভুলতা' : 'Best Accuracy'}
              </span>
              <p className="text-xs font-bold text-emerald-950 mt-0.5 font-mono">
                ±{formatNumberByLang(accuracyStats.bestAccuracy, lang)} m
              </p>
            </div>

            {/* Worst Accuracy */}
            <div className="p-2 rounded-lg bg-white border border-slate-200/80">
              <span className="text-[10px] text-slate-500 block">
                {isBn ? 'সর্বনিম্ন নির্ভুলতা' : 'Worst Accuracy'}
              </span>
              <p className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                ±{formatNumberByLang(accuracyStats.worstAccuracy, lang)} m
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            {isBn
              ? 'GPS নির্ভুলতা তথ্য পাওয়া যায়নি।'
              : 'GPS accuracy metadata not available from device.'}
          </p>
        )}
      </div>

      {/* Boundary Closure Details (TASK 5) */}
      <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/90 space-y-2 text-xs text-emerald-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-800 shrink-0" />
            <span className="font-bold text-emerald-950">
              {isBn ? 'সীমানা পরিক্রমা সমাপ্তি (Boundary Closure)' : 'Mathematical Boundary Closure'}
            </span>
          </div>
          <span className="text-[10px] font-bold text-emerald-800">
            {points[0]?.label} ↔ {points[points.length - 1]?.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
          {/* First & Last Points */}
          <div className="space-y-1 bg-white/80 p-2 rounded-lg border border-emerald-100">
            <p>
              <span className="font-semibold text-emerald-900">
                {isBn ? '১ম বিন্দু (Point A):' : 'Start Point (A):'}
              </span>{' '}
              <span className="font-mono text-slate-800">
                {formatCoordinate(firstPoint.latitude, 'lat')},{' '}
                {formatCoordinate(firstPoint.longitude, 'lng')}
              </span>
            </p>
            <p>
              <span className="font-semibold text-emerald-900">
                {isBn ? `শেষ বিন্দু (${lastPoint.label}):` : `Last Point (${lastPoint.label}):`}
              </span>{' '}
              <span className="font-mono text-slate-800">
                {formatCoordinate(lastPoint.latitude, 'lat')},{' '}
                {formatCoordinate(lastPoint.longitude, 'lng')}
              </span>
            </p>
          </div>

          {/* Closing Segment Distance & Bearing */}
          <div className="space-y-1 bg-white/80 p-2 rounded-lg border border-emerald-100">
            <p>
              <span className="font-semibold text-emerald-900">
                {isBn ? `সমাপ্তি বাহু (${lastPoint.label} → A):` : `Closing Leg (${lastPoint.label} → A):`}
              </span>{' '}
              <span className="font-bold text-slate-900">
                {closingSegment
                  ? `${formatNumberByLang(roundClean(closingSegment.distanceFeet, 2), lang)} ${isBn ? 'ফুট' : 'ft'} (${formatNumberByLang(roundClean(closingSegment.distanceMeters, 2), lang)} m)`
                  : 'N/A'}
              </span>
            </p>
            <p>
              <span className="font-semibold text-emerald-900">
                {isBn ? 'সমাপ্তি কোণ:' : 'Closing Bearing:'}
              </span>{' '}
              <span className="font-bold text-slate-900 font-mono">
                {closingSegment
                  ? `${formatNumberByLang(roundClean(closingSegment.bearingDegrees, 1), lang)}° ${isBn ? closingSegment.compassDirectionBn : closingSegment.compassDirectionEn}`
                  : 'N/A'}
              </span>
            </p>
          </div>
        </div>

        <p className="text-[11px] text-emerald-900/90 font-medium pt-0.5">
          ✓{' '}
          {isBn
            ? `পরিক্রমা গাণিতিকভাবে পয়েন্ট A-তে আবদ্ধ হয়ে মোট ${formatNumberByLang(roundClean(perimeterFt, 2), lang)} ফুট পরিসীমা ও ${formatNumberByLang(roundClean(landUnits.shatangsha, 3), lang)} শতাংশ ক্ষেত্রফল সম্পন্ন হয়েছে।`
            : `Boundary is mathematically closed back to Point A. Enclosed perimeter is ${roundClean(perimeterFt, 2)} ft and area is ${roundClean(landUnits.shatangsha, 3)} Decimal.`}
        </p>
      </div>

      {/* Mandatory Legal Disclaimer (TASK 10) */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-amber-950 text-[11px] leading-relaxed">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-amber-900 font-medium">
          {isBn
            ? 'মোবাইল GPS-এর পরিমাপ আনুমানিক। এটি survey-grade বা আইনগত সীমানা নির্ধারণের প্রমাণ নয়।'
            : 'Mobile GPS measurements are approximate. They are not survey-grade or legally binding.'}
        </p>
      </div>
    </div>
  );
};
