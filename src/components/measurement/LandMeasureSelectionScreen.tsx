import React from 'react';
import {
  Compass,
  MapPin,
  Ruler,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Language } from '../../types';

interface LandMeasureSelectionScreenProps {
  lang: Language;
  step: 'root' | 'practical';
  onSelectDigitalDemarcation: () => void;
  onSelectPracticalMenu: () => void;
  onSelectStandardMeasure: () => void;
  onSelectPossessionMeasure: () => void;
  onBack: () => void;
}

export const LandMeasureSelectionScreen: React.FC<LandMeasureSelectionScreenProps> = ({
  lang,
  step,
  onSelectDigitalDemarcation,
  onSelectPracticalMenu,
  onSelectStandardMeasure,
  onSelectPossessionMeasure,
  onBack,
}) => {
  const isBn = lang === 'bn';

  if (step === 'practical') {
    return (
      <div id="practical-measure-selection" className="space-y-4 pb-12 animate-fadeIn">
        {/* Back Button and Title */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isBn ? 'ফিরে যান' : 'Back'}</span>
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {isBn ? 'প্র্যাক্টিক্যাল পরিমাপ' : 'Practical Measurement'}
            </h2>
            <p className="text-xs text-slate-500">
              {isBn
                ? 'পদ্ধতি নির্বাচন করুন: সাধারণ হিসাব নাকি বাস্তব দখল'
                : 'Select method: Standard Land Calculation or Possession Measurement'}
            </p>
          </div>
        </div>

        {/* 2 Options inside Practical Measurement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Option 1: সাধারণ জমি পরিমাপ */}
          <button
            id="btn-select-standard-measure"
            onClick={onSelectStandardMeasure}
            className="text-left p-5 rounded-2xl bg-white border border-emerald-200/80 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                  <Ruler className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-950">
                  {isBn ? 'আকার ও রূপান্তর' : 'Shape Calc'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                {isBn ? '১. সাধারণ জমি পরিমাপ' : '1. Standard Land Measurement'}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {isBn
                  ? 'আয়তাকার, ত্রিভুজাকার, ট্রাপিজয়েড বা বহুভুজ আকৃতির জমির দৈর্ঘ্য-প্রস্থ ইনপুট দিয়ে শতক, কাঠা, বিঘা ও একর হিসাব।'
                  : 'Calculate area by entering length & width for rectangular, triangular, trapezoid, or polygon plots with full unit conversions.'}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'পরিমাপ শুরু করুন' : 'Open Calculator'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Option 2: দখল পরিমাপ */}
          <button
            id="btn-select-possession-measure"
            onClick={onSelectPossessionMeasure}
            className="text-left p-5 rounded-2xl bg-white border border-sky-200/80 hover:border-sky-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/70 flex items-center justify-center group-hover:bg-sky-700 group-hover:text-white transition-colors">
                  <Compass className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-950">
                  {isBn ? 'সরজমিনে আইল জরিপ' : 'Field Survey'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-950 transition-colors">
                {isBn ? '২. দখল পরিমাপ' : '2. Possession Measurement'}
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {isBn
                  ? 'জমির প্রতিটি কোণায় গিয়ে মোবাইল জিপিএস বা পরিমাপকের সাহায্যে বাস্তব দখল সীমানা রেকর্ড, আইল দৈর্ঘ্য ও ক্ষেত্রফল যাচাই।'
                  : 'Walk boundary corners on-site to record GPS points, real possession boundaries, segment lengths, and total occupied area.'}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'দখল পরিমাপ করুন' : 'Start Field Survey'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Quick Informational Note */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-slate-700 text-xs flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {isBn
              ? 'টিপস: দলিলের পরিমাপের সাথে বাস্তব দখল পরিমাপের মধ্যে কোনো অমিল থাকলে সার্ভে রিপোর্টে তা স্পষ্টভাবে চিহ্নিত করা যায়।'
              : 'Tip: Any discrepancy between deed measurements and field possession can be highlighted directly in your survey report.'}
          </p>
        </div>
      </div>
    );
  }

  // Root screen of "জমি মাপুন"
  return (
    <div id="land-measure-root-selection" className="space-y-4 pb-12 animate-fadeIn">
      {/* Header with Title and Back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-emerald-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isBn ? 'হোম' : 'Home'}</span>
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isBn ? 'জমি মাপুন' : 'Land Measurement'}
          </h2>
          <p className="text-xs text-slate-500">
            {isBn
              ? 'আপনার সুবিধাজনক পরিমাপ পদ্ধতিটি নির্বাচন করুন'
              : 'Choose your preferred land measurement approach'}
          </p>
        </div>
      </div>

      {/* The 2 Primary Choices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Choice 1: মৌজা ম্যাপ */}
        <button
          id="btn-select-mouza-map"
          onClick={onSelectDigitalDemarcation}
          className="text-left p-5 rounded-2xl bg-white border border-sky-200/80 hover:border-sky-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/70 flex items-center justify-center group-hover:bg-sky-700 group-hover:text-white transition-colors">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-950">
                {isBn ? 'মৌজা ম্যাপ' : 'Mouza Map'}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-sky-950 transition-colors">
              {isBn ? 'মৌজা ম্যাপ' : 'Mouza Map'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {isBn
                ? 'মৌজা ম্যাপের দাগ নম্বরের সাথে জিপিএস সমন্বয় করে ডিজিটাল সীমানা চিহ্নিতকরণ ও যাচাইকরণ।'
                : 'Correlate Mouza sheet dag numbers with GPS coordinates to digitally demarcate boundaries.'}
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-800 group-hover:translate-x-1 transition-transform">
            <span>{isBn ? 'মৌজা ম্যাপ খুলুন' : 'Open Mouza Map'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Choice 2: দখল পরিমাপ */}
        <button
          id="btn-select-possession-measure"
          onClick={onSelectPossessionMeasure}
          className="text-left p-5 rounded-2xl bg-white border border-emerald-200/80 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                <Ruler className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-950">
                {isBn ? 'দখল পরিমাপ' : 'Possession'}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
              {isBn ? 'দখল পরিমাপ' : 'Possession Measurement'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              {isBn
                ? 'জমির প্রতিটি কোণায় গিয়ে বাস্তব দখল সীমানা রেকর্ড, আইল দৈর্ঘ্য ও ক্ষেত্রফল যাচাই।'
                : 'Walk boundary corners on-site to record GPS points and verify actual field possession area.'}
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform">
            <span>{isBn ? 'পরিমাপ শুরু করুন' : 'Start Possession Survey'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
};
