import React, { useState } from 'react';
import { ShieldCheck, Info, X, CheckCircle2, ChevronRight, FileCheck, ChevronDown } from 'lucide-react';
import { Language } from '../../types';

export interface ProfessionalServiceDisclaimerProps {
  lang?: Language;
  variant?: 'card' | 'compact' | 'badge' | 'modal-trigger';
  className?: string;
  showVerificationBadges?: boolean;
  collapsible?: boolean;
}

export const PROFESSIONAL_DISCLAIMER_TEXT_BN =
  'ভূমি ও আমিন প্রতিটি জরিপ ও ডিজিটাল ম্যাপিং সেবা নির্ভরযোগ্য তথ্য, প্রযোজ্য রেকর্ড এবং পেশাদার যাচাইয়ের ভিত্তিতে সম্পন্ন করার জন্য প্রতিশ্রুতিবদ্ধ। সেবার ধরন অনুযায়ী সংগৃহীত তথ্য, ব্যবহৃত ম্যাপের উৎস এবং পরিমাপ পদ্ধতি গ্রাহককে জানানো হবে। সরকারি রেকর্ড, স্ক্যান কপি, মাঠ জরিপ ও GPS-এর নির্ভুলতার সীমাবদ্ধতা সেবার প্রকৃতি অনুযায়ী প্রযোজ্য হবে। চূড়ান্ত রিপোর্টে যাচাইয়ের অবস্থা ও প্রযোজ্য শর্ত উল্লেখ থাকবে।';

export const PROFESSIONAL_DISCLAIMER_TEXT_EN =
  'Bhumi & Amin is committed to providing reliable land survey and digital mapping services grounded in verifiable records and professional validation. For each service tier, data collection methods, map provenance, and measurement tolerances are explicitly disclosed. Technical limitations of government records, scanned paper sheets, field surveys, and GPS apply in accordance with the nature of the engagement. Final reports explicitly certify verification status and applicable statutory conditions.';

export const ProfessionalServiceDisclaimer: React.FC<ProfessionalServiceDisclaimerProps> = ({
  lang = 'bn',
  variant = 'card',
  className = '',
  showVerificationBadges = false,
  collapsible = false,
}) => {
  const isBn = lang === 'bn';
  const [showModal, setShowModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!collapsible);

  const mainText = isBn ? PROFESSIONAL_DISCLAIMER_TEXT_BN : PROFESSIONAL_DISCLAIMER_TEXT_EN;

  if (variant === 'badge') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold transition cursor-pointer ${className}`}
          title={isBn ? 'পেশাদার সেবা অঙ্গীকার ও প্রযোজ্য শর্ত' : 'Professional Service Assurance'}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
          <span>{isBn ? 'পেশাদার সেবা অঙ্গীকার' : 'Professional Assurance'}</span>
          <Info className="w-3 h-3 text-emerald-800" />
        </button>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 relative space-y-3">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 text-emerald-900">
                <div className="p-2 rounded-xl bg-emerald-100/80">
                  <ShieldCheck className="w-5 h-5 text-emerald-800" />
                </div>
                <h4 className="text-sm font-bold">
                  {isBn ? 'পেশাদার সেবা অঙ্গীকার ও আইনি স্বচ্ছতা' : 'Professional Service Assurance & Legal Transparency'}
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 font-medium">
                {mainText}
              </p>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition"
                >
                  {isBn ? 'বুঝেছি' : 'Understood'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'compact') {
    if (!collapsible) {
      return (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 text-[11px] leading-relaxed ${className}`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{mainText}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={`p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] ${className}`}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between text-slate-700"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
            <span className="font-bold">
              {isBn ? 'পেশাদার সেবা অঙ্গীকার ও স্বচ্ছতা' : 'Professional Service Assurance'}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {isExpanded && <p className="mt-2 text-slate-700 leading-relaxed">{mainText}</p>}
      </div>
    );
  }

  // Default 'card' variant
  return (
    <div
      className={`p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/60 border border-emerald-200/70 shadow-2xs space-y-2 ${className}`}
    >
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-emerald-900">
          <div className="p-1.5 rounded-lg bg-emerald-100/90 text-emerald-800">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-tight">
            {isBn ? 'পেশাদার সেবা অঙ্গীকার ও স্বচ্ছতা' : 'Professional Service Assurance'}
          </span>
        </div>
        {collapsible ? (
          <ChevronDown
            className={`w-4 h-4 text-emerald-800 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {isBn ? 'মান নিয়ন্ত্রণ' : 'Quality Assured'}
          </span>
        )}
      </div>
      {isExpanded && (
        <>
          <p className="text-xs text-slate-700 leading-relaxed font-normal">
            {mainText}
          </p>
          {showVerificationBadges && (
            <div className="pt-2 border-t border-emerald-100/80 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                {isBn ? 'যাচাইযোগ্য উৎস' : 'Verifiable Sources'}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                <FileCheck className="w-3 h-3 text-emerald-800" />
                {isBn ? 'স্বচ্ছ পরিমাপ পদ্ধতি' : 'Transparent Methodology'}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                <ShieldCheck className="w-3 h-3 text-emerald-800" />
                {isBn ? 'প্রযোজ্য শর্তাবলী' : 'Statutory Disclosures'}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
