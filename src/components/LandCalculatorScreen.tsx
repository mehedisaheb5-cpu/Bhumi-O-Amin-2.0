import React, { useState } from 'react';
import {
  Calculator,
  Users,
  Scale,
  FileText,
  Split,
  Sparkles,
  Bot,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/translations';
import { HisshaCalculator } from './calculator/HisshaCalculator';
import { AnaGondaCalculator } from './calculator/AnaGondaCalculator';
import { TafsilDistribution } from './calculator/TafsilDistribution';
import { InheritanceCalculator } from './calculator/InheritanceCalculator';
import { KhatianAnalysis } from './calculator/KhatianAnalysis';

interface LandCalculatorScreenProps {
  lang: Language;
  onOpenChat?: () => void;
  initialSubTab?: 'khatian' | 'hissha' | 'ana_gonda' | 'tafsil' | 'inheritance';
}

type CalcSubTab = 'khatian' | 'hissha' | 'ana_gonda' | 'tafsil' | 'inheritance';

export const LandCalculatorScreen: React.FC<LandCalculatorScreenProps> = ({
  lang,
  onOpenChat,
  initialSubTab = 'khatian',
}) => {
  const isBn = lang === 'bn';
  const t = translations[lang].calc;

  // Active sub-tab (Defaulting to 'khatian' for Khatian Analysis focus)
  const [subTab, setSubTab] = useState<CalcSubTab>(initialSubTab);

  return (
    <div id="khatian-analysis-screen" className="space-y-4 pb-12 animate-fadeIn">
      {/* Title Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Split className="w-6 h-6 text-amber-800" />
            <span>{isBn ? 'খতিয়ান বিশ্লেষণ ও হিস্যা বণ্টন' : 'Khatian Analysis & Distribution'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBn
              ? 'সিএস, এসএ, আরএস, বিএস খতিয়ান যাচাই, আনা-গন্ডা হিস্যা, ১৬ আনা বণ্টন ও ফারায়েজ'
              : 'CS, SA, RS, BS Khatian Analysis, 16 Ana Share Verification, and Inheritance'}
          </p>
        </div>
      </div>

      {/* AMIN AI INTEGRATION CARD - Requirement 2: Move Amin AI access inside খতিয়ান বিশ্লেষণ */}
      {onOpenChat && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50/70 border border-teal-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-teal-950">
                  {isBn ? 'আমিন এআই সহকারী' : 'Amin AI Assistant'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-teal-100 text-teal-900 border border-teal-200">
                  {isBn ? 'অনলাইন' : 'Active'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {isBn
                  ? 'খতিয়ানের আনা-গন্ডার হিসেব মেলাতে পারছেন না? সিএস বা আরএস সংক্রান্ত যেকোনো জটিল প্রশ্ন সরাসরি এআই-কে করুন।'
                  : 'Stuck on 16 Ana shares or khatian ownership chains? Ask the AI Land Consultant for instant legal guidance.'}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenChat}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isBn ? 'এআই পরামর্শ নিন' : 'Ask Amin AI'}</span>
          </button>
        </div>
      )}

      {/* KHATIAN TOOLKIT TABS */}
      <div className="p-1 rounded-2xl bg-slate-100 border border-slate-200 shadow-2xs flex flex-wrap gap-1">
        <button
          id="tab-khatian"
          onClick={() => setSubTab('khatian')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            subTab === 'khatian'
              ? 'bg-amber-800 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>{isBn ? 'খতিয়ান বিশ্লেষণ' : 'Khatian'}</span>
        </button>

        <button
          id="tab-hissha"
          onClick={() => setSubTab('hissha')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            subTab === 'hissha'
              ? 'bg-amber-800 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isBn ? 'হিস্যা বণ্টন' : 'Hissha'}</span>
        </button>

        <button
          id="tab-ana-gonda"
          onClick={() => setSubTab('ana_gonda')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            subTab === 'ana_gonda'
              ? 'bg-amber-800 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>{isBn ? 'আনা-গন্ডা' : 'Ana-Gonda'}</span>
        </button>

        <button
          id="tab-tafsil"
          onClick={() => setSubTab('tafsil')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            subTab === 'tafsil'
              ? 'bg-amber-800 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isBn ? 'তফসিল বণ্টন' : 'Tafsil'}</span>
        </button>

        <button
          id="tab-inheritance"
          onClick={() => setSubTab('inheritance')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
            subTab === 'inheritance'
              ? 'bg-amber-800 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>{isBn ? 'উত্তরাধিকার' : 'Inheritance'}</span>
        </button>
      </div>

      {/* RENDER ACTIVE TOOL */}
      <div className="pt-1">
        {subTab === 'khatian' && <KhatianAnalysis lang={lang} />}
        {subTab === 'hissha' && <HisshaCalculator lang={lang} />}
        {subTab === 'ana_gonda' && <AnaGondaCalculator lang={lang} />}
        {subTab === 'tafsil' && <TafsilDistribution lang={lang} />}
        {subTab === 'inheritance' && <InheritanceCalculator lang={lang} />}
      </div>
    </div>
  );
};
