import React from 'react';
import {
  Compass,
  Map as MapIcon,
  Layers,
  Split,
  FileSpreadsheet,
  Banknote,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  MapPin,
  Ruler,
  Scale,
  FileText,
} from 'lucide-react';
import { Language, NavTab } from '../types';

interface HomeScreenProps {
  lang: Language;
  onSelectMeasure: () => void;
  onSelectMapsAndDrawings: () => void;
  onSelectKhatian: () => void;
  onSelectReports: () => void;
  onSelectMouzaRate: () => void;
  onSelectInheritance?: () => void;
  onSelectDalil?: () => void;
  onNavigate?: (tab: NavTab) => void;
  onOpenChat?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  lang,
  onSelectMeasure,
  onSelectMapsAndDrawings,
  onSelectKhatian,
  onSelectReports,
  onSelectMouzaRate,
  onSelectInheritance,
  onSelectDalil,
}) => {
  const isBn = lang === 'bn';

  return (
    <div id="home-screen" className="space-y-4 pb-12 animate-fadeIn">
      {/* 1. CLEAN LIGHT HEADER / BANNER */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/80 to-sky-50 p-5 sm:p-6 border border-emerald-100/90 shadow-2xs">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-emerald-200 text-emerald-950 text-xs font-bold mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
            <span>{isBn ? 'ডিজিটাল ভূমি ও সার্ভে সমাধান' : 'Digital Land & Surveying'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
            {isBn ? 'ভূমি ও আমিন' : 'Bhumi & Amin'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-medium">
            {isBn
              ? 'মৌজা ম্যাপ ডিজিটাল ডিমার্কেশন, নিখুঁত প্র্যাক্টিক্যাল পরিমাপ, খতিয়ান বিশ্লেষণ ও দলিল খরচের আধুনিক প্ল্যাটফর্ম।'
              : 'Digital Mouza demarcation, accurate practical field measurement, khatian analysis, and verified deed valuation.'}
          </p>

          <div className="flex items-center gap-3 mt-4 text-[11px] font-bold text-emerald-950 flex-wrap">
            <span className="flex items-center gap-1 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
              {isBn ? 'সরজমিন ও ক্যাড নির্ভুলতা' : 'Field & CAD Verified'}
            </span>
            <span className="flex items-center gap-1 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
              {isBn ? 'সরকারি গ্যাজেট অনুসৃত' : 'Govt. Benchmark Compliant'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. THE 5 MAIN FEATURE ENTRIES (A, B, C, D, E) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isBn ? 'প্রধান সেবাসমূহ' : 'Main Features'}
          </h2>
          <span className="text-[11px] font-semibold text-emerald-800">
            {isBn ? '৫টি মূল সেবা' : '5 Core Services'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* ১. দখল পরিমাপ — P1 Mobile: 4 bahu direct */}
          <button
            id="home-entry-measure"
            onClick={onSelectMeasure}
            className="text-left p-5 rounded-3xl bg-white border border-emerald-200/70 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                  <Compass className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-950">
                  {isBn ? '১' : '1'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-emerald-950 transition-colors">
                {isBn ? 'দখল পরিমাপ' : 'Possession Measure'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {isBn ? '৪ বাহু বসালেই শতাংশ অটো — বাহু মেপে বা চিত্র এঁকে সরাসরি জরিপ, মৌজা ম্যাপ ছাড়া।' : 'Enter 4 sides — percent auto — direct field survey without Mouza map.'}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'পরিমাপ শুরু করুন' : 'Start Measuring'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* ২. নকশা ও ম্যাপ — 3 features */}
          <button
            id="home-entry-maps"
            onClick={onSelectMapsAndDrawings}
            className="text-left p-5 rounded-3xl bg-white border border-sky-200/70 hover:border-sky-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-800 border border-sky-200/70 flex items-center justify-center group-hover:bg-sky-700 group-hover:text-white transition-colors">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-950">
                  {isBn ? '২' : '2'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-sky-950 transition-colors">
                {isBn ? 'নকশা ও ম্যাপ' : 'Maps & Drawings'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {isBn ? '১. ডিমার্কেশন  ২. পেন্টাগ্রাফ  ৩. স্কেচ টু ড্রয়িং — ১৬\"=১ মাইল, পিঞ্চ জুম ম্যাপে।' : '1. Demarcation 2. Pentagraph 3. Sketch-to-Drawing — 16\"=1 mile, pinch map only.'}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'নকশা ও ম্যাপ দেখুন' : 'Open Maps'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* ৩. খতিয়ান — image + voice */}
          <button
            id="home-entry-khatian"
            onClick={onSelectKhatian}
            className="text-left p-5 rounded-3xl bg-white border border-amber-200/80 hover:border-amber-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200/70 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-colors">
                  <Split className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-950">
                  {isBn ? '৩' : '3'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-amber-950 transition-colors">
                {isBn ? 'খতিয়ান' : 'Khatian'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {isBn ? 'খতিয়ানের ছবি আপলোড + সমস্যার কথা লিখুন / Voice — যৌথ মালিক, দাগ, শ্রেণি, শতাংশ হিসাব।' : 'Upload Khatian image + describe issue / Voice — joint owners, dags, class, percent calc.'}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'খতিয়ান বিশ্লেষণ' : 'Analyze'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* ৪. উত্তরাধিকার — Hindu / Muslim */}
          <button
            id="home-entry-inheritance"
            onClick={() => (onSelectInheritance ? onSelectInheritance() : onSelectKhatian())}
            className="text-left p-5 rounded-3xl bg-white border border-pink-200/70 hover:border-pink-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-800 border border-pink-200/70 flex items-center justify-center group-hover:bg-pink-700 group-hover:text-white transition-colors">
                  <Scale className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-pink-100/90 text-pink-950">
                  {isBn ? '৪' : '4'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-pink-950 transition-colors">
                {isBn ? 'উত্তরাধিকার' : 'Inheritance'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {isBn ? 'হিন্দু / মুসলিম — ওয়ারিশ তালিকা + মোট সম্পত্তি → অটো ভাগ, রিপোর্ট।' : 'Hindu / Muslim — heirs + total property → auto share, report.'}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-pink-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'হিসাব করুন' : 'Calculate'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* ৫. দলিল সেবা — mouza rate + reg fee + nokol */}
          <button
            id="home-entry-mouza-rate"
            onClick={() => (onSelectDalil ? onSelectDalil() : onSelectMouzaRate())}
            className="text-left p-5 rounded-3xl bg-white border border-orange-200/70 hover:border-orange-400 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group sm:col-span-2"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-800 border border-orange-200/70 flex items-center justify-center group-hover:bg-orange-800 group-hover:text-white transition-colors">
                  <Banknote className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-orange-100/90 text-orange-950">
                  {isBn ? '৫' : '5'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-orange-950 transition-colors">
                {isBn ? 'দলিল সেবা' : 'Dalil Services'}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {isBn ? 'মৌজা রেট • রেজিস্ট্রেশন ফি (শীঘ্রই) • নকল উত্তোলন (শীঘ্রই) — এক জায়গায়।' : 'Mouza rate • Registration fee (soon) • Certified copy (soon) — one place.'}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-orange-800 group-hover:translate-x-1 transition-transform">
              <span>{isBn ? 'দলিল সেবা দেখুন' : 'Explore Dalil'}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. SUBTLE TRUST & COMPLIANCE FOOTER */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 text-slate-600 text-xs flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0" />
        <p className="leading-relaxed">
          {isBn
            ? 'সার্ভে অ্যান্ড সেটেলমেন্ট ম্যানুয়াল ও বাংলাদেশ রেজিস্ট্রেশন বিধিমালা অনুযায়ী প্রস্তুতকৃত।'
            : 'Prepared according to the Bangladesh Survey & Settlement Manual and Sub-Registry valuation guidelines.'}
        </p>
      </div>
    </div>
  );
};
