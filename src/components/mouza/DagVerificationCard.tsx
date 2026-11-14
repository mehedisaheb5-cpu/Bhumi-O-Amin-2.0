import React, { useState } from 'react';
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
} from 'lucide-react';
import { Language, DigitizedDagRecord, SurveyRecord } from '../../types';
import { verifyLandMeasurement } from '../../lib/mouza-map';
import { LAND_CONSTANTS } from '../../lib/land-units';

interface DagVerificationCardProps {
  dag: DigitizedDagRecord | null;
  gpsSurvey: SurveyRecord | null;
  activeGpsAreaSqFt?: number;
  lang: Language;
  onOpenPentagraph?: () => void;
  onOpenAdvancedVerification?: () => void;
}

export const DagVerificationCard: React.FC<DagVerificationCardProps> = ({
  dag,
  gpsSurvey,
  activeGpsAreaSqFt = 0,
  lang,
  onOpenPentagraph,
  onOpenAdvancedVerification,
}) => {
  const isBn = lang === 'bn';
  const [copied, setCopied] = useState(false);

  if (!dag) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
        <Scale className="w-5 h-5 mx-auto mb-1 text-slate-400" />
        <p>{isBn ? 'যাচাই করার জন্য একটি দাগ নির্বাচন করুন' : 'Select a digitized dag to verify'}</p>
      </div>
    );
  }

  const gpsArea = gpsSurvey ? gpsSurvey.areaSqFt : activeGpsAreaSqFt;
  const hasGps = gpsArea > 0;

  const verification = verifyLandMeasurement(dag.areaSqFt, gpsArea);

  const handleCopySummary = () => {
    const text = isBn
      ? `ভূমি ও আমিন — দাগ ও জিপিএস পরিমাপ যাচাইকরণ
----------------------------------------
দাগ নম্বর: ${dag.dagNo}
নকশায় দাগের ক্ষেত্রফল: ${dag.areaDecimal} শতাংশ (${dag.areaSqFt} বর্গফুট)
জিপিএস পরিমাপকৃত ক্ষেত্রফল: ${verification.gpsAreaDecimal} শতাংশ (${verification.gpsAreaSqFt} বর্গফুট)
পার্থক্য: ${verification.diffDecimal} শতাংশ (${verification.diffSqFt} বর্গফুট)
শতকরা পার্থক্য: ${verification.percentageDiff}%
যাচাই গ্রেড: ${
          verification.matchGrade === 'excellent'
            ? 'চমৎকার মিল (Excellent Match)'
            : verification.matchGrade === 'acceptable'
            ? 'গ্রহণযোগ্য পার্থক্য (Acceptable Variance)'
            : 'উচ্চ পার্থক্য (High Variance)'
        }
মন্তব্য: ডিজিটাল/নির্দেশক যাচাইকরণ — কোনো আইনগত সীমানা প্রমাণ নয়।`
      : `Bhumi O Amin — Dag vs GPS Area Verification
----------------------------------------
Plot / Dag: ${dag.dagNo}
Map Digitized Area: ${dag.areaDecimal} Decimal (${dag.areaSqFt} sq ft)
GPS Measured Area: ${verification.gpsAreaDecimal} Decimal (${verification.gpsAreaSqFt} sq ft)
Difference: ${verification.diffDecimal} Decimal (${verification.diffSqFt} sq ft)
Variance: ${verification.percentageDiff}%
Status: ${
          verification.matchGrade === 'excellent'
            ? 'Excellent Match'
            : verification.matchGrade === 'acceptable'
            ? 'Acceptable Variance'
            : 'High Variance'
        }
Note: DIGITAL/INDICATIVE VERIFICATION — Not legal boundary evidence.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {isBn ? 'জমির পরিমাপ যাচাইকরণ টুল' : 'Land Measurement Verification'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {isBn ? `দাগ নং ${dag.dagNo} বনাম GPS ফিল্ড সার্ভে` : `Plot #${dag.dagNo} vs Field GPS Survey`}
            </p>
          </div>
        </div>

        {/* INDICATIVE BADGE */}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/80 uppercase tracking-wide">
          {isBn ? 'ডিজিটাল নির্দেশক যাচাই' : 'Indicative Verification'}
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* 1. Map Digitized Area */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isBn ? 'মৌজা নকশায় পরিমাপ' : 'Map Digitized'}</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900">
            {dag.areaDecimal}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {dag.areaSqFt} {isBn ? 'বর্গফুট' : 'sq ft'}
          </div>
        </div>

        {/* 2. GPS Measured Area */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-700" />
            <span>{isBn ? 'GPS ফিল্ড পরিমাপ' : 'Field GPS Survey'}</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-slate-900">
            {hasGps ? verification.gpsAreaDecimal : '—'}{' '}
            <span className="text-xs font-semibold text-slate-600">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {hasGps ? `${verification.gpsAreaSqFt} ${isBn ? 'বর্গফুট' : 'sq ft'}` : isBn ? 'GPS ডেটা অনুপস্থিত' : 'No GPS data'}
          </div>
        </div>

        {/* 3. Variance / Difference */}
        <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 mb-1">
            <span>{isBn ? 'পার্থক্য ও ব্যবধান' : 'Area Difference'}</span>
            <span className="text-xs font-extrabold">{hasGps ? `${verification.percentageDiff}%` : '—'}</span>
          </div>
          <div className="text-base sm:text-lg font-extrabold text-amber-950">
            {hasGps ? `${verification.diffDecimal}` : '—'}{' '}
            <span className="text-xs font-semibold text-amber-900">{isBn ? 'শতক' : 'Dec'}</span>
          </div>
          <div className="text-[11px] text-amber-800 font-medium">
            {hasGps ? `± ${verification.diffSqFt} ${isBn ? 'বর্গফুট' : 'sq ft'}` : isBn ? 'GPS সার্ভে যুক্ত করুন' : 'Connect GPS survey'}
          </div>
        </div>
      </div>

      {/* Match Grade Banner */}
      {hasGps ? (
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
            verification.matchGrade === 'excellent'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : verification.matchGrade === 'acceptable'
              ? 'bg-blue-50 border-blue-300 text-blue-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          {verification.matchGrade === 'excellent' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-bold">
              {verification.matchGrade === 'excellent'
                ? isBn
                  ? 'চমৎকার সামঞ্জস্য (≤৩% ব্যবধান): '
                  : 'Excellent Match (≤3% variance): '
                : verification.matchGrade === 'acceptable'
                ? isBn
                  ? 'গ্রহণযোগ্য সামঞ্জস্য (৩%—৭.৫% ব্যবধান): '
                  : 'Acceptable Match (3%–7.5% variance): '
                : isBn
                ? 'উচ্চ পার্থক্য (>৭.৫% ব্যবধান): '
                : 'High Variance (>7.5% variance): '}
            </span>
            <span>
              {verification.matchGrade === 'excellent'
                ? isBn
                  ? 'নকশার দাগের মাপ এবং মাঠে সংগৃহীত জিপিএস পরিমাপে চমৎকার মিল পাওয়া গেছে।'
                  : 'The digitized plot closely aligns with the on-site GPS polygon.'
                : verification.matchGrade === 'acceptable'
                ? isBn
                  ? 'আইল বা সীমানা বাঁকের কারণে সামান্য পার্থক্য রয়েছে, যা গ্রহণযোগ্য সীমার মধ্যে।'
                  : 'Minor corner discrepancy detected, within normal smartphone variance.'
                : isBn
                ? 'নকশা ও মাঠের জিপিএস পরিমাপে বড় পার্থক্য লক্ষ্য করা গেছে। সীমানা পিলার বা দাগ নম্বর পুনর্যাচাই করুন।'
                : 'Significant difference between map and field. Re-verify boundary pillars.'}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center justify-between">
          <span>{isBn ? 'তুলনা করার জন্য একটি বাস্তব GPS সার্ভে বা ফিল্ড ডাটা সিলেক্ট করুন।' : 'Select an active GPS survey to compare.'}</span>
        </div>
      )}

      {/* Mandatory Disclaimer */}
      <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>{isBn ? verification.disclaimerBn : verification.disclaimerEn}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {onOpenPentagraph && (
            <button
              onClick={onOpenPentagraph}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition active:scale-95 border border-emerald-200"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isBn ? 'পেন্টাগ্রাফে দেখুন' : 'Pentagraph'}</span>
            </button>
          )}

          {onOpenAdvancedVerification && (
            <button
              onClick={onOpenAdvancedVerification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition active:scale-95 border border-indigo-200"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-700" />
              <span>{isBn ? 'উন্নত ৩-মুখী যাচাই' : 'Advanced 3-Way'}</span>
            </button>
          )}
        </div>

        <button
          onClick={handleCopySummary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 border border-slate-300"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? (isBn ? 'কপি হয়েছে' : 'Copied') : isBn ? 'যাচাই তথ্য কপি' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
